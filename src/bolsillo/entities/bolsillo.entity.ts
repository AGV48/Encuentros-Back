import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Presupuesto } from '../../presupuesto/entities/presupuesto.entity';
import { Encuentro } from '../../encuentro/entities/encuentro.entity';

@Entity('bolsillos')
export class Bolsillo {
  @PrimaryGeneratedColumn({ name: 'id_bolsillo' })
  id: number;

  @Column({ name: 'id_presupuesto', nullable: true })
  idPresupuesto: number;

  @Column({ name: 'id_encuentro' })
  idEncuentro: number;

  @Column({ name: 'nombre', type: 'varchar', length: 200 })
  nombre: string;

  @Column({
    name: 'saldo_actual',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  saldoActual: number;

  @ManyToOne(() => Presupuesto)
  @JoinColumn({ name: 'id_presupuesto' })
  presupuesto: Presupuesto;

  @ManyToOne(() => Encuentro)
  @JoinColumn({ name: 'id_encuentro' })
  encuentro: Encuentro;
}
