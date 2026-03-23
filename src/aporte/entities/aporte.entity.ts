import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Bolsillo } from '../../bolsillo/entities/bolsillo.entity';
import { Encuentro } from '../../encuentro/entities/encuentro.entity';
import { User } from '../../users/entities/user.entity';

@Entity('aportes')
export class Aporte {
  @PrimaryGeneratedColumn({ name: 'id_aporte' })
  id: number;

  @Column({ name: 'id_bolsillo', nullable: true })
  idBolsillo: number;

  @Column({ name: 'id_encuentro' })
  idEncuentro: number;

  @Column({ name: 'id_usuario', nullable: true })
  idUsuario: number;

  @Column({ name: 'monto', type: 'decimal', precision: 10, scale: 2 })
  monto: number;

  @CreateDateColumn({
    name: 'fecha_aporte',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaAporte: Date;

  @ManyToOne(() => Bolsillo, { nullable: true })
  @JoinColumn({ name: 'id_bolsillo' })
  bolsillo: Bolsillo;

  @ManyToOne(() => Encuentro)
  @JoinColumn({ name: 'id_encuentro' })
  encuentro: Encuentro;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;
}
