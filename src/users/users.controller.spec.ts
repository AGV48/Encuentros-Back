import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, HttpException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchUser - edge cases', () => {
    it('debería manejar error al verificar amistad en amistades table', async () => {
      // Arrange
      const mockUsers = [{ id: 2, nombre: 'Test', email: 'test@test.com' }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);
      mockDataSource.query.mockRejectedValueOnce(new Error('Table amistades no existe'));

      // Act
      const result = await controller.searchUser('test', '1');

      // Assert - Debería continuar con isFriend = false
      expect(result.results[0].isFriend).toBe(false);
      expect(result.success).toBe(true);
    });

    it('debería manejar error al verificar pending request from me', async () => {
      // Arrange
      const mockUsers = [{ id: 2, nombre: 'Test', email: 'test@test.com' }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // isFriend = false
        .mockRejectedValueOnce(new Error('Table no existe')) // pendingFrom error
        .mockResolvedValueOnce([{ cnt: 0 }]); // pendingTo = false

      // Act
      const result = await controller.searchUser('test', '1');

      // Assert
      expect(result.results[0].pendingRequestFromMe).toBe(false);
    });

    it('debería manejar error al verificar pending request to me', async () => {
      // Arrange
      const mockUsers = [{ id: 2, nombre: 'Test', email: 'test@test.com' }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockRejectedValueOnce(new Error('Table no existe'));

      // Act
      const result = await controller.searchUser('test', '1');

      // Assert
      expect(result.results[0].pendingRequestToMe).toBe(false);
    });

    it('debería usar fallback ID_USUARIO cuando id no existe', async () => {
      // Arrange
      const mockUsers = [{ ID_USUARIO: 5, nombre: 'Test', email: 'test@test.com' }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      // Act
      const result = await controller.searchUser('test', '1');

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('createFriendRequest - edge cases', () => {
    it('debería continuar cuando amistades check falla pero no es HttpException', async () => {
      // Arrange
      mockDataSource.query
        .mockRejectedValueOnce(new Error('amistades table no existe')) // friendCheck falla
        .mockResolvedValueOnce([]); // reverseCheck pasa

      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_relacion_amistad: 1 }])
        .mockResolvedValueOnce(undefined);

      // Act
      const result = await controller.createFriendRequest({ from: 1, to: 2 });

      // Assert
      expect(result.success).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('debería manejar error en reverse pending check pero continuar', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // No son amigos
        .mockRejectedValueOnce(new Error('reverse check failed')); // reverse pending falla

      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_relacion_amistad: 1 }])
        .mockResolvedValueOnce(undefined);

      // Act
      const result = await controller.createFriendRequest({ from: 1, to: 2 });

      // Assert
      expect(result.success).toBe(true);
    });

    it('debería lanzar error con código -20002 (solicitud cruzada)', async () => {
      // Arrange - Los errores Oracle -20002/-20003 vienen de la transacción principal
      // El friend check y reverse check deben pasar, el error viene del INSERT
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // friendCheck: no son amigos
        .mockResolvedValueOnce([]); // reverseCheck: no hay solicitud inversa

      const oracleError = new Error('ORA-20002: El usuario al que le va a enviar una solicitud ya le ha enviado una a usted.');
      mockQueryRunner.query.mockRejectedValue(oracleError);

      // Act & Assert
      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'El usuario al que le va a enviar una solicitud ya le ha enviado una a usted.',
      );
    });

    it('debería lanzar error con código -20003 (ya envió solicitud)', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // friendCheck: no son amigos
        .mockResolvedValueOnce([]); // reverseCheck: no hay solicitud inversa

      const oracleError = new Error('ORA-20003: Ya le ha enviado una solicitud de amistad a este usuario.');
      mockQueryRunner.query.mockRejectedValue(oracleError);

      // Act & Assert
      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'Ya le ha enviado una solicitud de amistad a este usuario.',
      );
    });

    it('debería lanzar error con código -20001 (error general)', async () => {
      // Arrange - Simulamos error en la creación de solicitud (queryRunner)
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]); // friendCheck pasa
      mockDataSource.query.mockResolvedValueOnce([]); // reverseCheck pasa

      const oracleError = new Error('ORA-20001: Error al crear la solicitud de amistad.');
      mockQueryRunner.query.mockRejectedValue(oracleError);

      // Act & Assert
      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'Error al crear la solicitud de amistad.',
      );
    });
  });

  describe('acceptRequest - edge cases', () => {
    it('debería continuar cuando amistad check falla durante accept', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_origen: 2 }]) // relación existe
        .mockResolvedValueOnce([{ usuario_destino: 1 }]) // solicitud existe
        .mockRejectedValueOnce(new Error('amistades check failed')); // amistad check falla

      mockQueryRunner.query.mockResolvedValue(undefined);

      // Act
      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 1 });

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Solicitud aceptada');
    });

    it('debería manejar error general en acceptRequest', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_origen: 2 }])
        .mockResolvedValueOnce([{ usuario_destino: 1 }])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      mockQueryRunner.query.mockRejectedValue(new Error('transaction error'));

      // Act & Assert
      await expect(controller.acceptRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('rejectRequest - edge cases', () => {
    it('debería manejar error general en rejectRequest', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([{ usuario_destino: 1 }]);
      mockDataSource.query.mockRejectedValueOnce(new Error('delete error'));

      // Act & Assert
      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow();
    });
  });

  describe('CRUD methods', () => {
    describe('create', () => {
      it('debería crear usuario exitosamente', async () => {
        // Arrange
        const mockUserDto: CreateUserDto = {
          nombre: 'Test',
          apellido: 'User',
          email: 'test@test.com',
          contrasena: 'password123',
        };
        const mockUser = { id: 1, ...mockUserDto };
        mockUsersService.findByEmail.mockResolvedValue(null);
        mockUsersService.create.mockResolvedValue(mockUser as any);

        // Act
        const result = await controller.create(mockUserDto);

        // Assert
        expect(result).toEqual(mockUser);
        expect(mockUsersService.findByEmail).toHaveBeenCalledWith('test@test.com');
        expect(mockUsersService.create).toHaveBeenCalledWith(mockUserDto);
      });

      it('debería lanzar error cuando email ya está registrado', async () => {
        // Arrange
        const mockUserDto: CreateUserDto = {
          nombre: 'Test',
          apellido: 'User',
          email: 'test@test.com',
          contrasena: 'password123',
        };
        mockUsersService.findByEmail.mockResolvedValue({ id: 99, email: 'test@test.com' });

        // Act & Assert
        await expect(controller.create(mockUserDto)).rejects.toThrow(
          'El correo ya está registrado, intenta con otro',
        );
      });
    });

    describe('login', () => {
      it('debería retornar éxito cuando credenciales son correctas', async () => {
        // Arrange
        const mockUser = {
          id: 1,
          nombre: 'Test',
          email: 'test@test.com',
          contrasena: 'password123',
        };
        mockUsersService.findByEmail.mockResolvedValue(mockUser);

        // Act
        const result = await controller.login({ email: 'test@test.com', contrasena: 'password123' });

        // Assert
        expect(result).toEqual({ success: true, user: mockUser });
      });

      it('debería retornar fallo cuando usuario no existe', async () => {
        // Arrange
        mockUsersService.findByEmail.mockResolvedValue(null);

        // Act
        const result = await controller.login({ email: 'noexist@test.com', contrasena: 'password' });

        // Assert
        expect(result).toEqual({ success: false, message: 'Usuario no encontrado' });
      });

      it('debería retornar fallo cuando contraseña es incorrecta', async () => {
        // Arrange
        const mockUser = { id: 1, email: 'test@test.com', contrasena: 'correctpassword' };
        mockUsersService.findByEmail.mockResolvedValue(mockUser);

        // Act
        const result = await controller.login({ email: 'test@test.com', contrasena: 'wrongpassword' });

        // Assert
        expect(result).toEqual({ success: false, message: 'Usuario o contraseña incorrectos' });
      });
    });

    describe('getUserData', () => {
      it('debería retornar datos de usuario exitosamente', async () => {
        // Arrange
        const mockUser = { id: 1, nombre: 'Test', email: 'test@test.com' };
        mockUsersService.findByEmail.mockResolvedValue(mockUser);

        // Act
        const result = await controller.getUserData({ email: 'test@test.com' });

        // Assert
        expect(result).toEqual({ success: true, user: mockUser });
      });

      it('debería retornar fallo cuando usuario no existe', async () => {
        // Arrange
        mockUsersService.findByEmail.mockResolvedValue(null);

        // Act
        const result = await controller.getUserData({ email: 'noexist@test.com' });

        // Assert
        expect(result).toEqual({ success: false, message: 'Usuario no encontrado' });
      });
    });

    describe('updateUser', () => {
      it('debería actualizar usuario exitosamente', async () => {
        // Arrange
        const mockUpdatedUser = { id: 1, nombre: 'Updated', email: 'test@test.com' };
        mockUsersService.updateUser.mockResolvedValue(mockUpdatedUser);

        // Act
        const result = await controller.updateUser({
          email: 'test@test.com',
          updateData: { nombre: 'Updated' },
        });

        // Assert
        expect(result).toEqual({ success: true, user: mockUpdatedUser });
      });

      it('debería retornar fallo cuando update falla', async () => {
        // Arrange
        mockUsersService.updateUser.mockRejectedValue(new Error('Update error'));

        // Act
        const result = await controller.updateUser({
          email: 'test@test.com',
          updateData: { nombre: 'Updated' },
        });

        // Assert
        expect(result).toEqual({ success: false, message: 'Update error' });
      });
    });

    describe('updatePassword', () => {
      it('debería actualizar contraseña exitosamente', async () => {
        // Arrange
        const mockUpdatedUser = { id: 1, email: 'test@test.com', contrasena: 'newpassword' };
        mockUsersService.updatePassword.mockResolvedValue(mockUpdatedUser);

        // Act
        const result = await controller.updatePassword({
          email: 'test@test.com',
          currentPassword: 'oldpassword',
          newPassword: 'newpassword',
        });

        // Assert
        expect(result).toEqual({ success: true, user: { id: 1, email: 'test@test.com' } });
        expect(result.user.contrasena).toBeUndefined();
      });

      it('debería retornar fallo cuando updatePassword falla', async () => {
        // Arrange
        mockUsersService.updatePassword.mockRejectedValue(new Error('Password error'));

        // Act
        const result = await controller.updatePassword({
          email: 'test@test.com',
          currentPassword: 'old',
          newPassword: 'new',
        });

        // Assert
        expect(result).toEqual({ success: false, message: 'Password error' });
      });
    });

    describe('deleteUser', () => {
      it('debería eliminar usuario exitosamente', async () => {
        // Arrange
        mockUsersService.deleteUser.mockResolvedValue(undefined);

        // Act
        const result = await controller.deleteUser({ email: 'test@test.com' });

        // Assert
        expect(result).toEqual({ success: true });
      });

      it('debería retornar fallo cuando delete falla', async () => {
        // Arrange
        mockUsersService.deleteUser.mockRejectedValue(new Error('Delete error'));

        // Act
        const result = await controller.deleteUser({ email: 'test@test.com' });

        // Assert
        expect(result).toEqual({ success: false, message: 'Delete error' });
      });
    });
  });
});
