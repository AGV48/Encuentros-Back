import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  id: number;

  @Column({ name: 'nombre', type: 'varchar', length: 100, nullable: false })
  nombre: string;

  @Column({ name: 'apellido', type: 'varchar', length: 100, nullable: true })
  apellido: string;

  @Column({ name: 'email', type: 'varchar', length: 150, nullable: false })
  email: string;

  @Column({ name: 'contrasena', type: 'varchar', length: 200, nullable: false })
  contrasena: string;

  @Column({ name: 'imagen_perfil', type: 'varchar', length: 255, nullable: true })
  imagenPerfil: string | null;

  @Column({ name: 'fecha_registro', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaRegistro: Date;

  @Column({ name: 'reset_password_token', type: 'varchar', length: 255, nullable: true })
  resetPasswordToken: string | null;
}
