import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('debería validar correctamente un payload con usuario existente', async () => {
      const payload = { sub: 1, email: 'test@example.com' };
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        nombre: 'Juan',
        apellido: 'Pérez',
      };

      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith(payload.sub);
    });

    it('debería lanzar UnauthorizedException si el usuario no existe', async () => {
      const payload = { sub: 999, email: 'nonexistent@example.com' };

      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('debería manejar errores del validateUser', async () => {
      const payload = { sub: 1 };

      mockAuthService.validateUser.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate(payload)).rejects.toThrow('Database error');
    });

    it('debería lanzar UnauthorizedException si validateUser lanza UnauthorizedException', async () => {
      const payload = { sub: 1 };

      mockAuthService.validateUser.mockRejectedValue(new UnauthorizedException('Usuario no encontrado'));

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('debería validar correctamente un payload sin email', async () => {
      const payload = { sub: 1 };
      const mockUser = { id: 1, email: 'test@example.com' };

      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
    });
  });
});
