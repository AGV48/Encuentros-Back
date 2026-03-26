import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

jest.mock('bcrypt');
jest.mock('crypto', () => ({
  randomBytes: jest.fn(),
  createHash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateResetToken: jest.fn(),
    findByResetToken: jest.fn(),
    resetUserPassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('debería registrar y retornar access_token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPass');
      mockUsersService.create.mockResolvedValue({ id: 1, email: 't@t.c', contrasena: 'hashedPass' });
      mockJwtService.sign.mockReturnValue('token_123');

      const registerDto = { email: 't@t.c', contrasena: 'pass', nombre: 'A', apellido: 'B', imagenPerfil: "" };
      const result = await service.register(registerDto);

      expect(mockUsersService.create).toHaveBeenCalledWith({ ...registerDto, contrasena: 'hashedPass' });
      expect(result.access_token).toBe('token_123');
      expect((result.user as any).contrasena).toBeUndefined();
    });

    it('debería lanzar Unauthorized si email existe', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 1 });
      await expect(service.register({ email: 't@t.c', contrasena: 'p' } as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('debería loguear y retornar access_token', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 1, email: 't@t.c', contrasena: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token_123');

      const result = await service.login({ email: 't@t.c', contrasena: 'pass' });
      
      expect(result.access_token).toBe('token_123');
      expect((result.user as any).contrasena).toBeUndefined();
    });

    it('debería lanzar error si email no existe', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x', contrasena: 'p' })).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar error si password es incorrecta', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 1, email: 't@t.c', contrasena: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'x', contrasena: 'p' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('debería retornar user sin pass', async () => {
      mockUsersService.findById.mockResolvedValue({ id: 1, contrasena: 'hash' });
      const user = await service.validateUser(1);
      expect((user as any).contrasena).toBeUndefined();
    });

    it('debería lanzar error si no se encuentra', async () => {
      mockUsersService.findById.mockResolvedValue(null);
      await expect(service.validateUser(1)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('retornar mensaje si el usuario no existe (seguridad)', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      const res = await service.forgotPassword({ email: 'a@a.com' });
      expect(res.message).toBe('Si el correo está registrado, recibirás un enlace para restablecer tu contraseña');
    });

    it('deberia procesar solicitud de olvido', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: 1 });
      
      const mockHashObj = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('hashedHex') };
      (crypto.randomBytes as jest.Mock).mockReturnValue({ toString: () => 'tokenString' });
      (crypto.createHash as jest.Mock).mockReturnValue(mockHashObj);

      const res = await service.forgotPassword({ email: 'a@a.com' });
      expect(mockUsersService.updateResetToken).toHaveBeenCalledWith(1, 'hashedHex');
      expect(res.resetToken).toBe('tokenString');
    });
  });

  describe('resetPassword', () => {
    it('falla si token es invalido', async () => {
      const mockHashObj = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('hashedHex') };
      (crypto.createHash as jest.Mock).mockReturnValue(mockHashObj);
      
      mockUsersService.findByResetToken.mockResolvedValue(null);

      await expect(service.resetPassword({ token: 'abc', nuevaContrasena: '123' })).rejects.toThrow(BadRequestException);
    });

    it('restablece si token es valido', async () => {
      const mockHashObj = { update: jest.fn().mockReturnThis(), digest: jest.fn().mockReturnValue('hashedHex') };
      (crypto.createHash as jest.Mock).mockReturnValue(mockHashObj);
      
      mockUsersService.findByResetToken.mockResolvedValue({ id: 1 });
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHash');

      const res = await service.resetPassword({ token: 'abc', nuevaContrasena: '123' });
      expect(mockUsersService.resetUserPassword).toHaveBeenCalledWith(1, 'newHash');
      expect(res.message).toBeDefined();
    });
  });
});
