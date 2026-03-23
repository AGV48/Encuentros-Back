import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Bolsillo } from '../../bolsillo/entities/bolsillo.entity';
import { Encuentro } from '../../encuentro/entities/encuentro.entity';
import { User } from '../../users/entities/user.entity';

@Entity('gastos')
export class Gasto {
  @PrimaryGeneratedColumn({ name: 'id_gasto' })
  id: number;

  @Column({ name: 'id_bolsillo', type: 'integer', nullable: false })
  idBolsillo: number;

  @Column({ name: 'id_encuentro', type: 'integer', nullable: false })
  idEncuentro: number;

  @Column({ name: 'id_usuario', type: 'integer', nullable: true })
  idUsuario: number;

  @Column({ name: 'descripcion', type: 'varchar', length: 200, nullable: false })
  descripcion: string;

  @Column({ name: 'monto', type: 'numeric', precision: 10, scale: 2, nullable: false })
  monto: number;

  @CreateDateColumn({ name: 'fecha_gasto', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaGasto: Date;

  @ManyToOne(() => Bolsillo)
  @JoinColumn({ name: 'id_bolsillo' })
  bolsillo: Bolsillo;

  @ManyToOne(() => Encuentro)
  @JoinColumn({ name: 'id_encuentro' })
  encuentro: Encuentro;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;
}
