import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Verificar si el usuario ya existe
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new UnauthorizedException('El email ya está registrado');
    }

    // Cifrar la contraseña
    const hashedPassword = await bcrypt.hash(registerDto.contrasena, 10);

    // Crear el usuario con la contraseña cifrada
    const user = await this.usersService.create({
      ...registerDto,
      contrasena: hashedPassword,
    });

    // Generar token JWT
    const payload = { email: user.email, sub: user.id };
    const token = this.jwtService.sign(payload);

    // Retornar usuario sin contraseña y el token
    const { contrasena, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      access_token: token,
    };
  }

  async login(loginDto: LoginDto) {
    // Buscar usuario por email
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar la contraseña
    const isPasswordValid = await bcrypt.compare(loginDto.contrasena, user.contrasena);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar token JWT
    const payload = { email: user.email, sub: user.id };
    const token = this.jwtService.sign(payload);

    // Retornar usuario sin contraseña y el token
    const { contrasena, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      access_token: token,
    };
  }

  async validateUser(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    const { contrasena, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    
    if (!user) {
      // Por seguridad, no revelamos si el usuario existe o no
      return { 
        message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña' 
      };
    }

    // Generar token aleatorio
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Guardar token en la base de datos
    await this.usersService.updateResetToken(user.id, hashedToken);
    
    return { 
      message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña',
      // En desarrollo, devolvemos el token. En producción, esto debería ir por email
      resetToken: resetToken,
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    // Hash del token recibido para comparar con el almacenado
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetPasswordDto.token)
      .digest('hex');

    // Buscar usuario con el token
    const user = await this.usersService.findByResetToken(hashedToken);

    if (!user) {
      throw new BadRequestException('El token es inválido');
    }

    // Cifrar la nueva contraseña
    const hashedPassword = await bcrypt.hash(resetPasswordDto.nuevaContrasena, 10);

    // Actualizar contraseña y limpiar el token
    await this.usersService.resetUserPassword(user.id, hashedPassword);

    return { 
      message: 'Contraseña restablecida exitosamente' 
    };
  }
}
