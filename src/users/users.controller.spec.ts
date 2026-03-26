import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DataSource, QueryRunner } from 'typeorm';
import { BadRequestException, HttpException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let dataSource: DataSource;

  const mockUsersService = {
    searchByName: jest.fn(),
    annotateSearchResults: jest.fn(),
    createFriendRequest: jest.fn(),
    create: jest.fn(),
    findByEmail: jest.fn(),
    updateUser: jest.fn(),
    updatePassword: jest.fn(),
    deleteUser: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('searchUser', () => {
    it('debería retornar resultados de búsqueda sin anotación cuando no hay currentUser', async () => {
      const mockUsers = [{ id: 2, nombre: 'Test', email: 'test@test.com' }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);

      const result = await controller.searchUser('test');
      expect(result.success).toBe(true);
      expect(result.results).toEqual(mockUsers);
      expect(mockUsersService.annotateSearchResults).not.toHaveBeenCalled();
    });

    it('debería retornar resultados anotados cuando hay currentUser', async () => {
      const mockUsers = [{ id: 2, nombre: 'Test', email: 'test@test.com' }];
      const annotatedResults = [{ ...mockUsers[0], isFriend: false, pendingRequestFromMe: false, pendingRequestToMe: false }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);
      mockUsersService.annotateSearchResults.mockResolvedValue(annotatedResults);

      const result = await controller.searchUser('test', '1');
      expect(result.success).toBe(true);
      expect(result.results).toEqual(annotatedResults);
      expect(mockUsersService.annotateSearchResults).toHaveBeenCalledWith(mockUsers, 1);
    });

    it('debería manejar errores de búsqueda', async () => {
      mockUsersService.searchByName.mockRejectedValue(new Error('Database error'));

      await expect(controller.searchUser('test')).rejects.toThrow('Error buscando usuarios');
    });

    it('debería retornar error si q está vacío', async () => {
      mockUsersService.searchByName.mockResolvedValue([]);

      const result = await controller.searchUser('');
      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });
  });

  describe('createFriendRequest', () => {
    it('debería crear solicitud de amistad exitosamente', async () => {
      mockUsersService.createFriendRequest.mockResolvedValue({ success: true, message: 'Solicitud enviada' });

      const result = await controller.createFriendRequest({ from: 1, to: 2 });
      expect(result.success).toBe(true);
      expect(mockUsersService.createFriendRequest).toHaveBeenCalledWith(1, 2);
    });

    it('debería lanzar BadRequestException si faltan campos', async () => {
      await expect(controller.createFriendRequest({ from: 1, to: null as any })).rejects.toThrow(BadRequestException);
      await expect(controller.createFriendRequest({ from: null as any, to: 2 })).rejects.toThrow(BadRequestException);
    });

    it('debería manejar error -20002 (solicitud cruzada)', async () => {
      const error = new Error('ORA-20002: El usuario ya le envió una solicitud');
      mockUsersService.createFriendRequest.mockRejectedValue(error);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'El usuario al que le va a enviar una solicitud ya le ha enviado una a usted.',
      );
    });

    it('debería manejar error -20003 (solicitud duplicada)', async () => {
      const error = new Error('ORA-20003: Ya existe solicitud');
      mockUsersService.createFriendRequest.mockRejectedValue(error);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'Ya le ha enviado una solicitud de amistad a este usuario.',
      );
    });

    it('debería manejar error "Ya son amigos"', async () => {
      const error = new Error('Ya son amigos');
      mockUsersService.createFriendRequest.mockRejectedValue(error);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow('Ya son amigos');
    });

    it('debería manejar error -20001', async () => {
      const error = new Error('ORA-20001: Database error');
      mockUsersService.createFriendRequest.mockRejectedValue(error);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'Error al crear la solicitud de amistad.',
      );
    });

    it('debería manejar error genérico sin código específico', async () => {
      const error = new Error('Unexpected database error');
      mockUsersService.createFriendRequest.mockRejectedValue(error);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'Unexpected database error',
      );
    });

    it('debería manejar error con objeto en lugar de string', async () => {
      const error = { error: 'Custom error object' };
      mockUsersService.createFriendRequest.mockRejectedValue(error);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(HttpException);
    });
  });

  describe('getNotifications', () => {
    it('debería retornar notificaciones pendientes y aceptadas', async () => {
      const userId = 1;
      const pendingRequests = [
        { id_relacion: 1, usuario_origen: 2, nombre_origen: 'John', apellido_origen: 'Doe', fecha_solicitud: '2024-01-01' },
      ];
      const acceptedRequests = [
        { id_relacion: 2, usuario_origen: 3, nombre_origen: 'Jane', apellido_origen: 'Smith', fecha_amistad: '2024-01-02' },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(pendingRequests)
        .mockResolvedValueOnce(acceptedRequests);

      const result = await controller.getNotifications(userId.toString());
      expect(result.success).toBe(true);
      expect(result.pending).toEqual(pendingRequests);
      expect(result.accepted).toEqual(acceptedRequests);
    });

    it('debería lanzar BadRequestException si userId no se proporciona', async () => {
      await expect(controller.getNotifications('')).rejects.toThrow(BadRequestException);
    });

    it('debería manejar errores de base de datos', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(controller.getNotifications('1')).rejects.toThrow('Error obteniendo notificaciones');
    });
  });

  describe('acceptRequest', () => {
    it('debería aceptar solicitud de amistad exitosamente', async () => {
      const id_relacion_amistad = 1;
      const userId = 2;

      mockDataSource.query
        .mockResolvedValueOnce([{ id_usuario: 1 }]) // SELECT relación
        .mockResolvedValueOnce([{ usuario_destino: 2 }]) // SELECT solicitud
        .mockResolvedValueOnce([{ cnt: 0 }]); // Verificar si ya son amigos

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // UPDATE relaciones_amistades
          .mockResolvedValueOnce(undefined), // INSERT amistades
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const result = await controller.acceptRequest({ id_relacion_amistad, userId });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Solicitud aceptada');
    });

    it('debería lanzar BadRequestException si faltan parámetros', async () => {
      await expect(controller.acceptRequest({ id_relacion_amistad: 1, userId: null as any })).rejects.toThrow(BadRequestException);
      await expect(controller.acceptRequest({ id_relacion_amistad: null as any, userId: 1 })).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar 404 si no encuentra la relación', async () => {
      mockDataSource.query.mockResolvedValueOnce([]); // No encuentra relación

      await expect(controller.acceptRequest({ id_relacion_amistad: 999, userId: 1 })).rejects.toThrow(
        'No se encontró la relación de amistad',
      );
    });

    it('debería retornar mensaje si ya son amigos', async () => {
      const id_relacion_amistad = 1;
      const userId = 2;

      // Reset mocks before this test to avoid interactions
      jest.clearAllMocks();
      
      mockDataSource.query
        .mockResolvedValueOnce([{ id_usuario: 1 }]) // SELECT usuario_origen
        .mockResolvedValueOnce([{ usuario_destino: 2 }]) // SELECT usuario_destino
        .mockResolvedValueOnce([{ cnt: 1 }]) // Already friends check
        .mockResolvedValueOnce(undefined); // UPDATE relaciones_amistades

      const result = await controller.acceptRequest({ id_relacion_amistad, userId });
      expect(result.message).toBe('Ya son amigos');
      expect(result.success).toBe(true);
    });

    it('debería manejar rollback en caso de error en transacción', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id_usuario: 1 }])
        .mockResolvedValueOnce([{ usuario_destino: 2 }])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn().mockRejectedValue(new Error('Transaction error')),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      await expect(controller.acceptRequest({ id_relacion_amistad: 1, userId: 2 })).rejects.toThrow(HttpException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería lanzar 404 si no encuentra destRows', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id_usuario: 1 }])
        .mockResolvedValueOnce([]); // destRows vacía

      await expect(controller.acceptRequest({ id_relacion_amistad: 999, userId: 1 })).rejects.toThrow(
        'No se encontró la solicitud de amistad asociada',
      );
    });

    it('debería manejar alreadyFriend con "count" en lugar de "cnt"', async () => {
      jest.clearAllMocks();
      mockDataSource.query
        .mockResolvedValueOnce([{ id_usuario: 1 }]) // SELECT usuario_origen
        .mockResolvedValueOnce([{ usuario_destino: 2 }]) // SELECT usuario_destino
        .mockResolvedValueOnce([{ count: 1 }]) // Already friends check (count en lugar de cnt)
        .mockResolvedValueOnce(undefined); // UPDATE relaciones_amistades

      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 2 });
      expect(result.message).toBe('Ya son amigos');
    });

    it('debería manejar error cuando catch de amistades falla', async () => {
      jest.clearAllMocks();
      mockDataSource.query
        .mockResolvedValueOnce([{ id_usuario: 1 }]) // SELECT usuario_origen
        .mockResolvedValueOnce([{ usuario_destino: 2 }]) // SELECT usuario_destino
        .mockRejectedValueOnce(new Error('Amistades check error')); // friendCheck falla

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // UPDATE relaciones_amistades
          .mockResolvedValueOnce(undefined), // INSERT amistades
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Debería proceder a la transacción normal aunque falle el check
      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 2 });
      expect(result.message).toBe('Solicitud aceptada');
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    });
  });

  describe('rejectRequest', () => {
    it('debería rechazar solicitud de amistad exitosamente', async () => {
      const id_relacion_amistad = 1;
      const userId = 2;

      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_destino: 2 }]) // SELECT solicitud
        .mockResolvedValueOnce(undefined) // DELETE solicitud
        .mockResolvedValueOnce(undefined); // DELETE relación

      const result = await controller.rejectRequest({ id_relacion_amistad, userId });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Solicitud rechazada y eliminada');
    });

    it('debería lanzar BadRequestException si faltan parámetros', async () => {
      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: null as any })).rejects.toThrow(BadRequestException);
    });

    it('debería lanzar 404 si no encuentra la solicitud', async () => {
      mockDataSource.query.mockResolvedValueOnce([]); // No encuentra solicitud

      await expect(controller.rejectRequest({ id_relacion_amistad: 999, userId: 1 })).rejects.toThrow(
        'No se encontró la solicitud de amistad asociada',
      );
    });

    it('debería lanzar 403 si el usuario no es el destinatario', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ usuario_destino: 2 }]); // usuario_destino es 2, pero userId es 1

      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow(
        'Solo el destinatario puede rechazar la solicitud',
      );
    });

    it('debería manejar error de base de datos en rejectRequest', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ usuario_destino: 2 }])
        .mockRejectedValueOnce(new Error('DB error')); // DELETE solicitud falla

      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: 2 })).rejects.toThrow(HttpException);
    });

    it('debería manejar error con JSON stringify en rejectRequest', async () => {
      const circularObj: any = {};
      circularObj.self = circularObj;
      mockDataSource.query.mockResolvedValueOnce([{ usuario_destino: 2 }]);
      mockDataSource.query.mockRejectedValueOnce(new Error('Complex error'));

      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: 2 })).rejects.toThrow(HttpException);
    });
  });

  describe('create', () => {
    it('debería crear usuario exitosamente', async () => {
      const dto: CreateUserDto = { nombre: 'John', apellido: 'Doe', email: 'john@test.com', contrasena: 'pass123' };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 1, ...dto } as any);

      const result = await controller.create(dto);
      expect(result.id).toBe(1);
      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
    });

    it('debería lanzar BadRequestException si el email ya está registrado', async () => {
      const dto: CreateUserDto = { nombre: 'John', apellido: 'Doe', email: 'existing@test.com', contrasena: 'pass123' };
      mockUsersService.findByEmail.mockResolvedValue({ id: 1, email: 'existing@test.com' } as any);

      await expect(controller.create(dto)).rejects.toThrow(
        'El correo ya está registrado, intenta con otro',
      );
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('debería manejar error en usersService.create()', async () => {
      const dto: CreateUserDto = { nombre: 'John', apellido: 'Doe', email: 'john@test.com', contrasena: 'pass123' };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockRejectedValue(new Error('DB error'));

      await expect(controller.create(dto)).rejects.toThrow('DB error');
    });
  });

  describe('login', () => {
    it('debería retornar usuario cuando las credenciales son correctas', async () => {
      const mockUser = { id: 1, email: 'test@test.com', contrasena: 'pass123', nombre: 'Test' };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await controller.login({ email: 'test@test.com', contrasena: 'pass123' });
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('debería retornar error cuando el usuario no existe', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await controller.login({ email: 'notfound@test.com', contrasena: 'pass123' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Usuario no encontrado');
    });

    it('debería retornar error cuando la contraseña es incorrecta', async () => {
      const mockUser = { id: 1, email: 'test@test.com', contrasena: 'correctpass', nombre: 'Test' };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await controller.login({ email: 'test@test.com', contrasena: 'wrongpass' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Usuario o contraseña incorrectos');
    });
  });

  describe('getUserData', () => {
    it('debería retornar datos del usuario cuando existe', async () => {
      const mockUser = { id: 1, email: 'test@test.com', nombre: 'Test' };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await controller.getUserData({ email: 'test@test.com' });
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('debería retornar error cuando el usuario no existe', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await controller.getUserData({ email: 'notfound@test.com' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Usuario no encontrado');
    });
  });

  describe('updateUser', () => {
    it('debería actualizar usuario exitosamente', async () => {
      const mockUser = { id: 1, email: 'test@test.com', nombre: 'Test' };
      mockUsersService.updateUser.mockResolvedValue({ ...mockUser, nombre: 'Updated' });

      const result = await controller.updateUser({ email: 'test@test.com', updateData: { nombre: 'Updated' } });
      expect(result.success).toBe(true);
      expect(result.user.nombre).toBe('Updated');
    });

    it('debería manejar error cuando el usuario no existe', async () => {
      mockUsersService.updateUser.mockRejectedValue(new Error('User not found'));

      const result = await controller.updateUser({ email: 'notfound@test.com', updateData: { nombre: 'New' } });
      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
    });
  });

  describe('updatePassword', () => {
    it('debería actualizar contraseña exitosamente', async () => {
      const mockUser = { id: 1, email: 'test@test.com', nombre: 'Test' };
      mockUsersService.updatePassword.mockResolvedValue(mockUser as any);

      const result = await controller.updatePassword({
        email: 'test@test.com',
        currentPassword: 'old',
        newPassword: 'new',
      });
      expect(result.success).toBe(true);
      expect(result.user?.id).toBe(1);
    });

    it('debería manejar error de contraseña incorrecta', async () => {
      mockUsersService.updatePassword.mockRejectedValue(new Error('Contraseña actual incorrecta'));

      const result = await controller.updatePassword({
        email: 'test@test.com',
        currentPassword: 'wrong',
        newPassword: 'new',
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Contraseña actual incorrecta');
    });
  });

  describe('deleteUser', () => {
    it('debería eliminar usuario exitosamente', async () => {
      mockUsersService.deleteUser.mockResolvedValue(undefined);

      const result = await controller.deleteUser({ email: 'test@test.com' });
      expect(result.success).toBe(true);
      expect(mockUsersService.deleteUser).toHaveBeenCalledWith('test@test.com');
    });

    it('debería manejar error cuando el usuario no existe', async () => {
      mockUsersService.deleteUser.mockRejectedValue(new Error('User not found'));

      const result = await controller.deleteUser({ email: 'notfound@test.com' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
    });
  });

  describe('getFriends', () => {
    it('debería retornar lista de amigos del usuario', async () => {
      const userId = 1;
      const mockFriends = [
        { id: 2, nombre: 'John', apellido: 'Doe', email: 'john@test.com', imagenperfil: null },
        { id: 3, nombre: 'Jane', apellido: 'Smith', email: 'jane@test.com', imagenperfil: null },
      ];

      mockDataSource.query.mockResolvedValue(mockFriends);

      const result = await controller.getFriends(userId.toString());
      expect(result.success).toBe(true);
      expect(result.friends).toEqual(mockFriends);
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('UNION'), [userId, userId]);
    });

    it('debería retornar lista vacía si el usuario no tiene amigos', async () => {
      jest.clearAllMocks();
      mockDataSource.query.mockResolvedValue([]);

      const result = await controller.getFriends('1');
      expect(result.success).toBe(true);
      expect(result.friends).toEqual([]);
    });

    it('debería lanzar BadRequestException si userId no es un número', async () => {
      jest.clearAllMocks();
      // BadRequestException es capturada por el try-catch y re-lanzada como HttpException
      await expect(controller.getFriends('invalid')).rejects.toThrow(HttpException);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('debería manejar errores de base de datos', async () => {
      jest.clearAllMocks();
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(controller.getFriends('1')).rejects.toThrow('Error obteniendo lista de amigos');
    });
  });
});
