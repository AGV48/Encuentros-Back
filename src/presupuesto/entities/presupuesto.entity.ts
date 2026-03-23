import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Encuentro } from '../../encuentro/entities/encuentro.entity';
import { ItemPresupuesto } from './item-presupuesto.entity';

@Entity('presupuestos')
export class Presupuesto {
  @PrimaryGeneratedColumn({ name: 'id_presupuesto' })
  id: number;

  @Column({ name: 'id_encuentro' })
  idEncuentro: number;

  @Column({
    name: 'presupuesto_total',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  presupuestoTotal: number;

  @ManyToOne(() => Encuentro)
  @JoinColumn({ name: 'id_encuentro' })
  encuentro: Encuentro;

  @OneToMany(() => ItemPresupuesto, (item) => item.presupuesto)
  items: ItemPresupuesto[];
}
