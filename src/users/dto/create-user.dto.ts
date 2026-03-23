export class CreateUserDto {
  nombre: string;
  apellido?: string;
  email: string;
  contrasena: string;
  imagenPerfil?: string;
}
