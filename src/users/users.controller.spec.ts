import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, HttpException } from '@nestjs/common';

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
});