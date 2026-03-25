import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, HttpException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersController - Amistades', () => {
  let controller: UsersController;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  // Mock del servicio de usuarios
  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    searchByName: jest.fn(),
    updateUser: jest.fn(),
    updatePassword: jest.fn(),
    deleteUser: jest.fn(),
  };

  beforeEach(async () => {
    // Crear mock del QueryRunner para transacciones
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
    } as unknown as jest.Mocked<QueryRunner>;

    // Crear mock del DataSource
    mockDataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    } as unknown as jest.Mocked<DataSource>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchUser', () => {
    it('debería retornar usuarios sin información de amistad cuando no se proporciona currentUser', async () => {
      // Arrange
      const mockUsers = [
        { id: 1, nombre: 'Juan', apellido: 'Perez', email: 'juan@test.com' },
        { id: 2, nombre: 'Maria', apellido: 'Lopez', email: 'maria@test.com' },
      ];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);

      // Act
      const result = await controller.searchUser('juan');

      // Assert
      expect(result).toEqual({ success: true, results: mockUsers });
      expect(mockUsersService.searchByName).toHaveBeenCalledWith('juan');
    });

    it('debería retornar usuarios con información de amistad cuando se proporciona currentUser', async () => {
      // Arrange
      const mockUsers = [
        { id: 2, nombre: 'Maria', apellido: 'Lopez', email: 'maria@test.com' },
      ];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 1 }]) // isFriend = true
        .mockResolvedValueOnce([{ cnt: 0 }]) // pendingRequestFromMe = false
        .mockResolvedValueOnce([{ cnt: 1 }]); // pendingRequestToMe = true

      // Act
      const result = await controller.searchUser('maria', '1');

      // Assert
      expect(result).toEqual({
        success: true,
        results: [
          {
            id: 2,
            nombre: 'Maria',
            apellido: 'Lopez',
            email: 'maria@test.com',
            isFriend: true,
            pendingRequestFromMe: false,
            pendingRequestToMe: true,
          },
        ],
      });
    });

    it('debería manejar errores en la búsqueda de usuarios', async () => {
      // Arrange
      mockUsersService.searchByName.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(controller.searchUser('test')).rejects.toThrow(HttpException);
    });
  });

  describe('createFriendRequest', () => {
    it('debería lanzar error cuando falta el campo "from"', async () => {
      // Arrange - No es necesario, el error es inmediato

      // Act & Assert
      await expect(controller.createFriendRequest({ from: undefined as any, to: 2 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debería lanzar error cuando falta el campo "to"', async () => {
      // Arrange - No es necesario

      // Act & Assert
      await expect(controller.createFriendRequest({ from: 1, to: undefined as any })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debería rechazar solicitud si ya son amigos', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([{ cnt: 1 }]); // Ya son amigos

      // Act & Assert
      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(HttpException);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*) as cnt FROM amistades'),
        [1, 2, 2, 1],
      );
    });

    it('debería aceptar automáticamente solicitud cruzada si existe solicitud inversa pendiente', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // No son amigos
        .mockResolvedValueOnce([{ id_relacion: 5 }]); // Existe solicitud inversa pendiente
      mockQueryRunner.query.mockResolvedValue(undefined);

      // Act
      const result = await controller.createFriendRequest({ from: 1, to: 2 });

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Solicitud cruzada detectada: amistad aceptada automáticamente',
      });
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería crear nueva solicitud de amistad exitosamente', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // No son amigos
        .mockResolvedValueOnce([]); // No existe solicitud inversa
      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_relacion_amistad: 10 }]) // Insert relación
        .mockResolvedValueOnce(undefined); // Insert solicitud

      // Act
      const result = await controller.createFriendRequest({ from: 1, to: 2 });

      // Assert
      expect(result).toEqual({ success: true, message: 'Solicitud enviada' });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO relaciones_amistades'),
        [1],
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO solicitudes_amistad'),
        [10, 1, 2],
      );
    });

    it('debería hacer rollback en caso de error al crear solicitud', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // No son amigos
        .mockResolvedValueOnce([]); // No existe solicitud inversa
      mockQueryRunner.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getNotifications', () => {
    it('debería lanzar error cuando userId no está proporcionado', async () => {
      // Act & Assert
      await expect(controller.getNotifications('')).rejects.toThrow(BadRequestException);
    });

    it('debería retornar solicitudes pendientes y aceptadas correctamente', async () => {
      // Arrange
      const mockPending = [
        {
          id_relacion: 1,
          usuario_origen: 2,
          nombre_origen: 'Juan',
          apellido_origen: 'Perez',
          fecha_solicitud: new Date(),
        },
      ];
      const mockAccepted = [
        {
          id_relacion: 2,
          usuario_origen: 3,
          nombre_origen: 'Maria',
          apellido_origen: 'Lopez',
          fecha_amistad: new Date(),
        },
      ];
      mockDataSource.query
        .mockResolvedValueOnce(mockPending)
        .mockResolvedValueOnce(mockAccepted);

      // Act
      const result = await controller.getNotifications('1');

      // Assert
      expect(result).toEqual({
        success: true,
        pending: mockPending,
        accepted: mockAccepted,
      });
    });

    it('debería manejar errores al obtener notificaciones', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(controller.getNotifications('1')).rejects.toThrow(HttpException);
    });
  });

  describe('acceptRequest', () => {
    it('debería lanzar error cuando falta id_relacion_amistad', async () => {
      // Act & Assert
      await expect(
        controller.acceptRequest({ id_relacion_amistad: undefined as any, userId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar error cuando falta userId', async () => {
      // Act & Assert
      await expect(
        controller.acceptRequest({ id_relacion_amistad: 1, userId: undefined as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar error cuando la relación no existe', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([]); // No encuentra relación

      // Act & Assert
      await expect(controller.acceptRequest({ id_relacion_amistad: 999, userId: 1 })).rejects.toThrow(
        HttpException,
      );
    });

    it('debería lanzar error cuando la solicitud no existe', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_origen: 2 }]) // Relación existe
        .mockResolvedValueOnce([]); // Solicitud no existe

      // Act & Assert
      await expect(controller.acceptRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow(
        HttpException,
      );
    });

    it('debería retornar mensaje cuando ya son amigos', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_origen: 2 }]) // Relación existe
        .mockResolvedValueOnce([{ usuario_destino: 1 }]) // Solicitud existe
        .mockResolvedValueOnce([{ cnt: 1 }]); // Ya son amigos

      // Act
      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 1 });

      // Assert
      expect(result).toEqual({ success: true, message: 'Ya son amigos' });
    });

    it('debería aceptar solicitud exitosamente', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_origen: 2 }]) // Relación existe
        .mockResolvedValueOnce([{ usuario_destino: 1 }]) // Solicitud existe
        .mockResolvedValueOnce([{ cnt: 0 }]); // No son amigos aún
      mockQueryRunner.query.mockResolvedValue(undefined);

      // Act
      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 1 });

      // Assert
      expect(result).toEqual({ success: true, message: 'Solicitud aceptada' });
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE relaciones_amistades'),
        [1],
      );
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO amistades'),
        [1, 2, 1],
      );
    });

    it('debería hacer rollback en caso de error al aceptar', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_origen: 2 }])
        .mockResolvedValueOnce([{ usuario_destino: 1 }])
        .mockResolvedValueOnce([{ cnt: 0 }]);
      mockQueryRunner.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(controller.acceptRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('rejectRequest', () => {
    it('debería lanzar error cuando falta id_relacion_amistad', async () => {
      // Act & Assert
      await expect(
        controller.rejectRequest({ id_relacion_amistad: undefined as any, userId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar error cuando falta userId', async () => {
      // Act & Assert
      await expect(
        controller.rejectRequest({ id_relacion_amistad: 1, userId: undefined as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar error cuando la solicitud no existe', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(controller.rejectRequest({ id_relacion_amistad: 999, userId: 1 })).rejects.toThrow(
        HttpException,
      );
    });

    it('debería rechazar solicitud exitosamente', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_destino: 1 }]) // Obtener destinatario
        .mockResolvedValueOnce(undefined) // Eliminar solicitud
        .mockResolvedValueOnce(undefined); // Eliminar relación

      // Act
      const result = await controller.rejectRequest({ id_relacion_amistad: 1, userId: 1 });

      // Assert
      expect(result).toEqual({ success: true, message: 'Solicitud rechazada y eliminada' });
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM solicitudes_amistad'),
        [1],
      );
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM relaciones_amistades'),
        [1],
      );
    });

    it('debería impedir que usuario no destinatario rechace la solicitud', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([{ usuario_destino: 2 }]); // Destinatario es 2, no 1

      // Act & Assert
      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getFriends', () => {
    it('debería retornar lista de amigos exitosamente', async () => {
      // Arrange
      const mockFriends = [
        { id: 2, nombre: 'Juan', apellido: 'Perez', email: 'juan@test.com', imagenperfil: null },
        { id: 3, nombre: 'Maria', apellido: 'Lopez', email: 'maria@test.com', imagenperfil: null },
      ];
      mockDataSource.query.mockResolvedValue(mockFriends);

      // Act
      const result = await controller.getFriends('1');

      // Assert
      expect(result).toEqual({ success: true, friends: mockFriends });
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT'),
        [1, 1],
      );
    });

    it('debería lanzar error cuando userId no es un número válido', async () => {
      // Act & Assert
      // Nota: El BadRequestException es capturado por el catch general y se convierte en HttpException
      await expect(controller.getFriends('invalid')).rejects.toThrow(HttpException);
    });

    it('debería manejar errores al obtener amigos', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(controller.getFriends('1')).rejects.toThrow(HttpException);
    });
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

    it('debería hacer rollback si falla la transacción al aceptar solicitud cruzada', async () => {
      // Arrange
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 0 }]) // No son amigos
        .mockResolvedValueOnce([{ id_relacion: 5 }]); // Existe solicitud inversa pendiente

      // Forzar que el queryRunner falle al intentar hacer UPDATE o INSERT de la amistad cruzada
      mockQueryRunner.query.mockRejectedValue(new Error('Transaction error accepting cross request'));

      // Act & Assert
      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow('Transaction error accepting cross request');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
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