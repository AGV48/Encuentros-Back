import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('relaciones_amistades')
export class RelacionAmistad {
  @PrimaryGeneratedColumn({ name: 'id_relacion_amistad' })
  id: number;

  @Column({ name: 'id_usuario', type: 'integer', nullable: false })
  idUsuario: number;

  @Column({ name: 'estado', type: 'varchar', length: 20, nullable: false })
  estado: string;

  @Column({ name: 'fecha_solicitud_amistad', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaSolicitud: Date;

  @Column({ name: 'fecha_aceptacion_amistad', type: 'timestamp', nullable: true })
  fechaAceptacion: Date;
}
