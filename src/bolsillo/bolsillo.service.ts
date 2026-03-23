import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateBolsilloDto } from './dto/create-bolsillo.dto';
import { UpdateBolsilloDto } from './dto/update-bolsillo.dto';
import { Bolsillo } from './entities/bolsillo.entity';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class BolsilloService {
  constructor(
    @InjectRepository(Bolsillo)
    private readonly bolsilloRepository: Repository<Bolsillo>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(createBolsilloDto: CreateBolsilloDto): Promise<Bolsillo> {
    const bolsillo = this.bolsilloRepository.create(createBolsilloDto);
    return await this.bolsilloRepository.save(bolsillo);
  }

  async findAll(): Promise<Bolsillo[]> {
    return await this.bolsilloRepository.find({
      relations: ['presupuesto', 'encuentro'],
    });
  }

  async findOne(id: number): Promise<Bolsillo> {
    const bolsillo = await this.bolsilloRepository.findOne({
      where: { id },
      relations: ['presupuesto', 'encuentro'],
    });

    if (!bolsillo) {
      throw new NotFoundException(`Bolsillo con ID ${id} no encontrado`);
    }

    return bolsillo;
  }

  async findByEncuentro(idEncuentro: number): Promise<Bolsillo[]> {
    return await this.bolsilloRepository.find({
      where: { idEncuentro },
      relations: ['presupuesto', 'encuentro'],
    });
  }

  async findByPresupuesto(idPresupuesto: number): Promise<Bolsillo[]> {
    return await this.bolsilloRepository.find({
      where: { idPresupuesto },
      relations: ['presupuesto', 'encuentro'],
    });
  }

  async update(
    id: number,
    updateBolsilloDto: UpdateBolsilloDto,
  ): Promise<Bolsillo> {
    const bolsillo = await this.findOne(id);
    Object.assign(bolsillo, updateBolsilloDto);
    return await this.bolsilloRepository.save(bolsillo);
  }

  async remove(id: number, idUsuario: number): Promise<{ success: boolean; message: string }> {
    const bolsillo = await this.findOne(id);

    // Verificar que el usuario es el creador del encuentro
    const encuentro = await this.dataSource.query(
      'SELECT id_creador FROM encuentros WHERE id_encuentro = $1',
      [bolsillo.idEncuentro],
    );

    if (!encuentro || encuentro.length === 0) {
      throw new NotFoundException('Encuentro no encontrado');
    }

    if (encuentro[0].id_creador !== idUsuario) {
      throw new ForbiddenException('Solo el creador puede eliminar bolsillos');
    }

    // Verificar si el bolsillo tiene aportes asociados
    const aportes = await this.dataSource.query(
      'SELECT COUNT(*) as count FROM aportes WHERE id_bolsillo = $1',
      [id],
    );

    if (aportes[0].count > 0) {
      throw new ForbiddenException(
        'No se puede eliminar el bolsillo porque tiene aportes asociados. Elimina primero los aportes.',
      );
    }

    await this.bolsilloRepository.remove(bolsillo);

    return {
      success: true,
      message: 'Bolsillo eliminado correctamente',
    };
  }
}
