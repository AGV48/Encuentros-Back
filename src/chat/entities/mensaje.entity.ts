import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Encuentro } from '../../encuentro/entities/encuentro.entity';

@Entity('mensajes')
export class Mensaje {
  @PrimaryGeneratedColumn({ name: 'id_mensaje' })
  id: number;

  @Column({ name: 'id_encuentro', type: 'integer', nullable: false })
  idEncuentro: number;

  @Column({ name: 'id_usuario', type: 'integer', nullable: false })
  idUsuario: number;

  @Column({ name: 'contenido', type: 'text', nullable: false })
  contenido: string;

  @CreateDateColumn({ name: 'fecha_mensaje', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaMensaje: Date;

  @ManyToOne(() => Encuentro)
  @JoinColumn({ name: 'id_encuentro' })
  encuentro: Encuentro;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'id_usuario' })
  usuario: User;
}
