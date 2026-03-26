import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    validateUser: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('debería registrar un nuevo usuario exitosamente', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        contrasena: 'password123',
        nombre: 'Juan',
        apellido: 'Pérez',
        imagenPerfil: "",
      };

      const mockResponse = {
        user: { id: 1, email: 'test@example.com', nombre: 'Juan', apellido: 'Pérez' },
        access_token: 'jwt_token_123',
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await controller.register(registerDto);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });

    it('debería manejar errores de registro', async () => {
      const registerDto: RegisterDto = {
        email: 'test@example.com',
        contrasena: 'password123',
        nombre: 'Juan',
        apellido: 'Pérez',
        imagenPerfil: "",
      };

      mockAuthService.register.mockRejectedValue(new Error('Email ya existe'));

      await expect(controller.register(registerDto)).rejects.toThrow('Email ya existe');
    });
  });

  describe('login', () => {
    it('debería loguear un usuario exitosamente', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        contrasena: 'password123',
      };

      const mockResponse = {
        user: { id: 1, email: 'test@example.com', nombre: 'Juan', apellido: 'Pérez' },
        access_token: 'jwt_token_123',
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });

    it('debería manejar errores de login', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        contrasena: 'wrongpassword',
      };

      mockAuthService.login.mockRejectedValue(new Error('Credenciales inválidas'));

      await expect(controller.login(loginDto)).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('getProfile', () => {
    it('debería retornar el perfil del usuario autenticado', async () => {
      const mockUser = { id: 1, email: 'test@example.com', nombre: 'Juan' };
      const mockRequest = { user: mockUser };

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockUser);
    });
  });

  describe('validateToken', () => {
    it('debería validar el token y retornar el usuario', async () => {
      const mockUser = { id: 1, email: 'test@example.com', nombre: 'Juan' };
      const mockRequest = { user: mockUser };

      const result = await controller.validateToken(mockRequest);

      expect(result).toEqual({
        valid: true,
        user: mockUser,
      });
    });

    it('debería devolver valid: true para cualquier usuario autenticado', async () => {
      const mockRequest = { user: {} };

      const result = await controller.validateToken(mockRequest);

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
    });
  });

  describe('forgotPassword', () => {
    it('debería procesar solicitud de olvidé contraseña', async () => {
      const forgotPasswordDto: ForgotPasswordDto = {
        email: 'test@example.com',
      };

      const mockResponse = {
        message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña',
        resetToken: 'reset_token_123',
      };

      mockAuthService.forgotPassword.mockResolvedValue(mockResponse);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
    });

    it('debería retornar mensaje genérico si usuario no existe', async () => {
      const forgotPasswordDto: ForgotPasswordDto = {
        email: 'nonexistent@example.com',
      };

      const mockResponse = {
        message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña',
      };

      mockAuthService.forgotPassword.mockResolvedValue(mockResponse);

      const result = await controller.forgotPassword(forgotPasswordDto);

      expect(result.message).toBeDefined();
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(forgotPasswordDto);
    });
  });

  describe('resetPassword', () => {
    it('debería resetear la contraseña exitosamente', async () => {
      const resetPasswordDto: ResetPasswordDto = {
        token: 'reset_token_123',
        nuevaContrasena: 'newpassword123',
      };

      const mockResponse = {
        message: 'Contraseña restablecida exitosamente',
      };

      mockAuthService.resetPassword.mockResolvedValue(mockResponse);

      const result = await controller.resetPassword(resetPasswordDto);

      expect(result).toEqual(mockResponse);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(resetPasswordDto);
    });

    it('debería manejar errores de token inválido', async () => {
      const resetPasswordDto: ResetPasswordDto = {
        token: 'invalid_token',
        nuevaContrasena: 'newpassword123',
      };

      mockAuthService.resetPassword.mockRejectedValue(new Error('El token es inválido'));

      await expect(controller.resetPassword(resetPasswordDto)).rejects.toThrow('El token es inválido');
    });
  });
});
