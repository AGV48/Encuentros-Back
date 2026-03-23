import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { RelacionAmistad } from './relacion-amistad.entity';

@Entity('solicitudes_amistad')
export class SolicitudAmistad {
  @PrimaryGeneratedColumn({ name: 'id_solicitud' })
  id: number;

  @Column({ name: 'id_remitente', type: 'integer', nullable: false })
  idRemitente: number;

  @Column({ name: 'id_relacion_amistad', type: 'integer', nullable: false })
  idRelacionAmistad: number;

  @Column({ name: 'id_destinatario', type: 'integer', nullable: false })
  idDestinatario: number;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'pendiente' })
  estado: string;

  @Column({ name: 'fecha_solicitud', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaSolicitud: Date;

  @ManyToOne(() => RelacionAmistad)
  @JoinColumn({ name: 'id_relacion_amistad' })
  relacion: RelacionAmistad;
}
