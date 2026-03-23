import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateAporteDto } from './dto/create-aporte.dto';
import { UpdateAporteDto } from './dto/update-aporte.dto';
import { Aporte } from './entities/aporte.entity';

@Injectable()
export class AporteService {
  constructor(
    @InjectRepository(Aporte)
    private aporteRepository: Repository<Aporte>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  create(createAporteDto: CreateAporteDto) {
    const aporte = this.aporteRepository.create(createAporteDto);
    return this.aporteRepository.save(aporte);
  }

  findAll() {
    return this.aporteRepository.find({
      relations: ['bolsillo', 'encuentro', 'usuario'],
    });
  }

  findByEncuentro(idEncuentro: number) {
    return this.aporteRepository.find({
      where: { idEncuentro },
      relations: ['bolsillo', 'usuario'],
    });
  }

  findByBolsillo(idBolsillo: number) {
    return this.aporteRepository.find({
      where: { idBolsillo },
      relations: ['usuario', 'encuentro'],
    });
  }

  findByUsuario(idUsuario: number) {
    return this.aporteRepository.find({
      where: { idUsuario },
      relations: ['bolsillo', 'encuentro'],
    });
  }

  findOne(id: number) {
    return this.aporteRepository.findOne({
      where: { id },
      relations: ['bolsillo', 'encuentro', 'usuario'],
    });
  }

  async update(id: number, updateAporteDto: UpdateAporteDto) {
    await this.aporteRepository.update(id, updateAporteDto);
    return this.findOne(id);
  }

  remove(id: number) {
    return this.aporteRepository.delete(id);
  }

  async agregarAporte(createAporteDto: CreateAporteDto): Promise<Aporte> {
    // Validar que todos los campos requeridos estén presentes
    if (!createAporteDto.idBolsillo || !createAporteDto.idUsuario) {
      throw new Error(
        'Los campos idBolsillo e idUsuario son requeridos para agregar un aporte',
      );
    }

    // Usar transacción para insertar aporte y actualizar saldo del bolsillo
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Insertar el aporte
      const result = await queryRunner.query(
        `INSERT INTO aportes (id_bolsillo, id_encuentro, id_usuario, monto, fecha_aporte)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING id_aporte`,
        [
          createAporteDto.idBolsillo,
          createAporteDto.idEncuentro,
          createAporteDto.idUsuario,
          createAporteDto.monto,
        ],
      );

      // Actualizar el saldo del bolsillo
      await queryRunner.query(
        `UPDATE bolsillos 
         SET saldo_actual = saldo_actual + $1 
         WHERE id_bolsillo = $2`,
        [createAporteDto.monto, createAporteDto.idBolsillo],
      );

      await queryRunner.commitTransaction();

      // Obtener el aporte recién creado
      const aporte = await this.aporteRepository.findOne({
        where: { id: result[0].id_aporte },
        relations: ['bolsillo', 'usuario', 'encuentro'],
      });

      if (!aporte) {
        throw new NotFoundException('No se pudo crear el aporte');
      }

      return aporte;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
