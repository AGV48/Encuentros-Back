import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Presupuesto } from './presupuesto.entity';
import { Encuentro } from '../../encuentro/entities/encuentro.entity';

@Entity('items_presupuesto')
export class ItemPresupuesto {
  @PrimaryGeneratedColumn({ name: 'id_item' })
  id: number;

  @Column({ name: 'id_presupuesto' })
  idPresupuesto: number;

  @Column({ name: 'id_encuentro' })
  idEncuentro: number;

  @Column({
    name: 'nombre_item',
    type: 'varchar',
    length: 200,
  })
  nombreItem: string;

  @Column({
    name: 'monto_item',
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  montoItem: number;

  @ManyToOne(() => Presupuesto)
  @JoinColumn({ name: 'id_presupuesto' })
  presupuesto: Presupuesto;

  @ManyToOne(() => Encuentro)
  @JoinColumn({ name: 'id_encuentro' })
  encuentro: Encuentro;
}
