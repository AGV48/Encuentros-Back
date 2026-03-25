import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('encuentros')
export class Encuentro {
  @PrimaryGeneratedColumn({ name: 'id_encuentro' })
  id: number;

  @Column({ name: 'id_creador', type: 'integer', nullable: false })
  idCreador: number;

  @Column({ name: 'titulo', type: 'varchar', length: 200, nullable: false })
  titulo: string;

  @Column({ name: 'descripcion', type: 'varchar', length: 500, nullable: false })
  descripcion: string;

  @Column({ name: 'lugar', type: 'varchar', length: 100, nullable: false })
  lugar: string;

  @Column({ name: 'fecha', type: 'timestamp', nullable: false })
  fecha: Date;

  @Column({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', nullable: false })
  fechaCreacion: Date;
}
