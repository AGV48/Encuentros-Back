import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Encuentro } from '../../encuentro/entities/encuentro.entity';
import { User } from '../../users/entities/user.entity';

@Entity('participantes_encuentro')
export class ParticipanteEncuentro {
  @PrimaryGeneratedColumn({ name: 'id_participacion' })
  id: number;

  @Column({ name: 'id_encuentro', type: 'integer', nullable: false })
  idEncuentro: number;

  @Column({ name: 'id_usuario', type: 'integer', nullable: false })
  idUsuario: number;

  @Column({ name: 'rol', type: 'varchar', length: 50, nullable: false })
  rol: string;

  @ManyToOne(() => Encuentro)
  @JoinColumn({ name: 'id_encuentro' })
  encuentro: Encuentro;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;
}
