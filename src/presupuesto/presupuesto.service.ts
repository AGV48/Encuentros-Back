import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto';
import { CreateItemPresupuestoDto } from './dto/create-item-presupuesto.dto';
import { Presupuesto } from './entities/presupuesto.entity';
import { ItemPresupuesto } from './entities/item-presupuesto.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PresupuestoService {
  constructor(
    @InjectRepository(Presupuesto)
    private readonly presupuestoRepository: Repository<Presupuesto>,
    @InjectRepository(ItemPresupuesto)
    private readonly itemPresupuestoRepository: Repository<ItemPresupuesto>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createPresupuestoDto: CreatePresupuestoDto,
  ): Promise<Presupuesto> {
    const presupuesto = this.presupuestoRepository.create(createPresupuestoDto);
    return await this.presupuestoRepository.save(presupuesto);
  }

  async findAll(): Promise<Presupuesto[]> {
    return await this.presupuestoRepository.find({
      relations: ['encuentro', 'items'],
    });
  }

  async findOne(id: number): Promise<Presupuesto> {
    const presupuesto = await this.presupuestoRepository.findOne({
      where: { id },
      relations: ['encuentro', 'items'],
    });

    if (!presupuesto) {
      throw new NotFoundException(`Presupuesto con ID ${id} no encontrado`);
    }

    return presupuesto;
  }

  async findByEncuentro(idEncuentro: number): Promise<Presupuesto | null> {
    return await this.presupuestoRepository.findOne({
      where: { idEncuentro },
      relations: ['encuentro', 'items'],
    });
  }

  async update(
    id: number,
    updatePresupuestoDto: UpdatePresupuestoDto,
  ): Promise<Presupuesto> {
    const presupuesto = await this.findOne(id);
    Object.assign(presupuesto, updatePresupuestoDto);
    return await this.presupuestoRepository.save(presupuesto);
  }

  async remove(id: number): Promise<void> {
    const presupuesto = await this.findOne(id);
    await this.presupuestoRepository.remove(presupuesto);
  }

  async agregarItem(
    createItemDto: CreateItemPresupuestoDto,
  ): Promise<ItemPresupuesto> {
    // Usar transacción para insertar item y actualizar presupuesto total
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Insertar el item
      const result = await queryRunner.query(
        `INSERT INTO items_presupuesto (id_presupuesto, id_encuentro, nombre_item, monto_item)
         VALUES ($1, $2, $3, $4)
         RETURNING id_item`,
        [
          createItemDto.idPresupuesto,
          createItemDto.idEncuentro,
          createItemDto.nombreItem,
          createItemDto.montoItem,
        ],
      );

      // Actualizar el presupuesto total
      await queryRunner.query(
        `UPDATE presupuestos 
         SET presupuesto_total = presupuesto_total + $1 
         WHERE id_presupuesto = $2`,
        [createItemDto.montoItem, createItemDto.idPresupuesto],
      );

      await queryRunner.commitTransaction();

      // Obtener el item recién creado
      const item = await this.itemPresupuestoRepository.findOne({
        where: { id: result[0].id_item },
      });

      if (!item) {
        throw new NotFoundException('No se pudo crear el item');
      }

      return item;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getItems(idPresupuesto: number): Promise<ItemPresupuesto[]> {
    return await this.itemPresupuestoRepository.find({
      where: { idPresupuesto },
      order: { id: 'ASC' },
    });
  }

  async removeItem(idItem: number, idUsuario: number): Promise<{ success: boolean; message: string }> {
    // Usar transacción para eliminar item y actualizar presupuesto total
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener el item a eliminar
      const item = await this.itemPresupuestoRepository.findOne({
        where: { id: idItem },
      });

      if (!item) {
        throw new NotFoundException('Item de presupuesto no encontrado');
      }

      // Verificar que el usuario es el creador del encuentro
      const encuentro = await queryRunner.query(
        'SELECT id_creador FROM encuentros WHERE id_encuentro = $1',
        [item.idEncuentro],
      );

      if (!encuentro || encuentro.length === 0) {
        throw new NotFoundException('Encuentro no encontrado');
      }

      if (encuentro[0].id_creador !== idUsuario) {
        throw new NotFoundException('Solo el creador puede eliminar items del presupuesto');
      }

      // Actualizar el presupuesto total (restar el monto del item)
      await queryRunner.query(
        `UPDATE presupuestos 
         SET presupuesto_total = presupuesto_total - $1 
         WHERE id_presupuesto = $2`,
        [item.montoItem, item.idPresupuesto],
      );

      // Eliminar el item
      await queryRunner.query(
        'DELETE FROM items_presupuesto WHERE id_item = $1',
        [idItem],
      );

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Item de presupuesto eliminado correctamente',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
