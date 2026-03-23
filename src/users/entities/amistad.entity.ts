import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { RelacionAmistad } from './relacion-amistad.entity';

@Entity('amistades')
export class Amistad {
  @PrimaryGeneratedColumn({ name: 'id_amistad' })
  id: number;

  @Column({ name: 'id_relacion_amistad', type: 'integer', nullable: false })
  idRelacionAmistad: number;

  @Column({ name: 'usuario1', type: 'integer', nullable: false })
  usuario1: number;

  @Column({ name: 'usuario2', type: 'integer', nullable: false })
  usuario2: number;

  @Column({ name: 'fecha_amistad', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaAmistad: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario1' })
  usuarioPrimero: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario2' })
  usuarioSegundo: User;

  @ManyToOne(() => RelacionAmistad)
  @JoinColumn({ name: 'id_relacion_amistad' })
  relacion: RelacionAmistad;
}
