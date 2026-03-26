import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { DataSource } from 'typeorm';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let dataSource: DataSource;

  const mockUser: User = {
    id: 1,
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@example.com',
    contrasena: 'password123',
    imagenPerfil: 'https://example.com/image.jpg',
    fechaRegistro: new Date(),
    resetPasswordToken: null,
  };

  beforeEach(async () => {
    const mockUsersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      searchByName: jest.fn(),
      updateUser: jest.fn(),
      updatePassword: jest.fn(),
      deleteUser: jest.fn(),
    };

    const mockDataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      }),
    };

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchUser', () => {
    it('should return search results without currentUser', async () => {
      const searchResults = [mockUser];
      (service.searchByName as jest.Mock).mockResolvedValue(searchResults);

      const result = await controller.searchUser('juan');

      expect(service.searchByName).toHaveBeenCalledWith('juan');
      expect(result).toEqual({ success: true, results: searchResults });
    });

    it('should return search results with friendship annotations - friends found', async () => {
      const searchResults = [mockUser];
      (service.searchByName as jest.Mock).mockResolvedValue(searchResults);
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ cnt: 1 }]) // isFriend = true
        .mockResolvedValueOnce([{ cnt: 0 }]) // pendingRequestFromMe = false
        .mockResolvedValueOnce([{ cnt: 0 }]); // pendingRequestToMe = false

      const result = await controller.searchUser('juan', '2');

      expect(result.success).toBe(true);
      expect(result.results[0].isFriend).toBe(true);
    });

    it('should return search results with pending requests', async () => {
      const searchResults = [mockUser];
      (service.searchByName as jest.Mock).mockResolvedValue(searchResults);
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ cnt: 0 }]) // isFriend = false
        .mockResolvedValueOnce([{ cnt: 1 }]) // pendingRequestFromMe = true
        .mockResolvedValueOnce([{ cnt: 1 }]); // pendingRequestToMe = true

      const result = await controller.searchUser('juan', '2');

      expect(result.success).toBe(true);
      expect(result.results[0].pendingRequestFromMe).toBe(true);
      expect(result.results[0].pendingRequestToMe).toBe(true);
    });

    it('should return search results when friendship check fails', async () => {
      const searchResults = [mockUser];
      (service.searchByName as jest.Mock).mockResolvedValue(searchResults);
      (dataSource.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await controller.searchUser('juan', '2');

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toHaveProperty('isFriend');
      expect(result.results[0]).toHaveProperty('pendingRequestFromMe');
      expect(result.results[0]).toHaveProperty('pendingRequestToMe');
    });

    it('should throw error on search service failure', async () => {
      (service.searchByName as jest.Mock).mockRejectedValue(new Error('Search failed'));

      await expect(controller.searchUser('juan')).rejects.toThrow('Error buscando usuarios');
    });
  });

  describe('createFriendRequest', () => {
    it('should throw error if from or to is missing', async () => {
      await expect(controller.createFriendRequest({ from: 1, to: undefined as any })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create new friend request', async () => {
      const queryRunner = dataSource.createQueryRunner();
      (dataSource.query as jest.Mock).mockResolvedValue([]);
      (queryRunner.query as jest.Mock).mockResolvedValueOnce([{ id_relacion_amistad: 1 }]);

      const result = await controller.createFriendRequest({ from: 1, to: 2 });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Solicitud enviada');
    });

    it('should throw error if users are already friends', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([{ cnt: 1 }]);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
        'Ya son amigos',
      );
    });

    it('should handle reverse pending request', async () => {
      const queryRunner = dataSource.createQueryRunner();
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ cnt: 0 }]) // friendship check
        .mockResolvedValueOnce([{ id_relacion: 1 }]); // reverse request found

      const result = await controller.createFriendRequest({ from: 1, to: 2 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('amistad aceptada automáticamente');
    });

    it('should handle transaction error', async () => {
      const queryRunner = dataSource.createQueryRunner();
      (queryRunner.query as jest.Mock).mockRejectedValue(new Error('Transaction error'));
      (dataSource.query as jest.Mock).mockResolvedValue([]);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow();
    });
  });

  describe('getNotifications', () => {
    it('should throw error if userId is missing', async () => {
      await expect(controller.getNotifications('')).rejects.toThrow(BadRequestException);
    });

    it('should return pending and accepted notifications', async () => {
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { id_relacion: 1, nombre_origen: 'Juan', apellido_origen: 'Pérez' },
        ])
        .mockResolvedValueOnce([
          { id_relacion: 2, nombre_origen: 'Maria', apellido_origen: 'García' },
        ]);

      const result = await controller.getNotifications('1');

      expect(result.success).toBe(true);
      expect(result.pending).toHaveLength(1);
      expect(result.accepted).toHaveLength(1);
    });

    it('should handle database error', async () => {
      (dataSource.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(controller.getNotifications('1')).rejects.toThrow('Error obteniendo notificaciones');
    });
  });

  describe('acceptRequest', () => {
    it('should throw error if required fields are missing', async () => {
      await expect(
        controller.acceptRequest({ id_relacion_amistad: undefined as any, userId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if relation not found', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce(null);

      await expect(controller.acceptRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow(
        'No se encontró la relación de amistad',
      );
    });

    it('should throw error if destination not found', async () => {
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ usuario_origen: 1 }])
        .mockResolvedValueOnce(null);

      await expect(controller.acceptRequest({ id_relacion_amistad: 1, userId: 2 })).rejects.toThrow(
        'No se encontró la solicitud de amistad asociada',
      );
    });

    it('should accept friend request successfully', async () => {
      const queryRunner = dataSource.createQueryRunner();
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ usuario_origen: 1 }]) // relation found
        .mockResolvedValueOnce([{ usuario_destino: 2 }]) // destiny found
        .mockResolvedValueOnce([{ cnt: 0 }]); // not already friends

      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 2 });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Solicitud aceptada');
    });

    it('should handle when users are already friends', async () => {
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ usuario_origen: 1 }])
        .mockResolvedValueOnce([{ usuario_destino: 2 }])
        .mockResolvedValueOnce([{ cnt: 1 }]); // already friends

      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 2 });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Ya son amigos');
    });

    it('should handle friendship check failure during accept', async () => {
      const queryRunner = dataSource.createQueryRunner();
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ usuario_origen: 1 }])
        .mockResolvedValueOnce([{ usuario_destino: 2 }])
        .mockRejectedValueOnce(new Error('Check failed'));

      const result = await controller.acceptRequest({ id_relacion_amistad: 1, userId: 2 });

      expect(result.success).toBe(true);
    });
  });

  describe('rejectRequest', () => {
    it('should throw error if required fields are missing', async () => {
      await expect(
        controller.rejectRequest({ id_relacion_amistad: undefined as any, userId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if request not found', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow(
        'No se encontró la solicitud de amistad asociada',
      );
    });

    it('should throw error if user is not the recipient', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([{ usuario_destino: 2 }]);

      await expect(controller.rejectRequest({ id_relacion_amistad: 1, userId: 1 })).rejects.toThrow(
        'Solo el destinatario puede rechazar la solicitud',
      );
    });

    it('should reject request successfully', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([{ usuario_destino: 1 }]);

      const result = await controller.rejectRequest({ id_relacion_amistad: 1, userId: 1 });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Solicitud rechazada y eliminada');
    });
  });

  describe('create', () => {
    it('should throw error if email already exists', async () => {
      const createUserDto: CreateUserDto = {
        nombre: 'Juan',
        email: 'juan@example.com',
        contrasena: 'password123',
      };

      (service.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(controller.create(createUserDto)).rejects.toThrow(
        'El correo ya está registrado, intenta con otro',
      );
    });

    it('should create user successfully', async () => {
      const createUserDto: CreateUserDto = {
        nombre: 'Juan',
        email: 'juan@example.com',
        contrasena: 'password123',
      };

      (service.findByEmail as jest.Mock).mockResolvedValue(null);
      (service.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.create(createUserDto);

      expect(service.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(service.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockUser);
    });
  });

  describe('login', () => {
    it('should return error if user not found', async () => {
      (service.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await controller.login({ email: 'nonexistent@example.com', contrasena: 'password' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Usuario no encontrado');
    });

    it('should return error if password is incorrect', async () => {
      (service.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.login({ email: 'juan@example.com', contrasena: 'wrongpassword' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Usuario o contraseña incorrectos');
    });

    it('should return user if credentials are correct', async () => {
      (service.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.login({ email: 'juan@example.com', contrasena: 'password123' });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('getUserData', () => {
    it('should return error if user not found', async () => {
      (service.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await controller.getUserData({ email: 'nonexistent@example.com' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Usuario no encontrado');
    });

    it('should return user data', async () => {
      (service.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.getUserData({ email: 'juan@example.com' });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should return error if update fails', async () => {
      (service.updateUser as jest.Mock).mockRejectedValue(new Error('Update failed'));

      const result = await controller.updateUser({
        email: 'juan@example.com',
        updateData: { nombre: 'Juan Actualizado' },
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Update failed');
    });

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, nombre: 'Juan Actualizado' };
      (service.updateUser as jest.Mock).mockResolvedValue(updatedUser);

      const result = await controller.updateUser({
        email: 'juan@example.com',
        updateData: { nombre: 'Juan Actualizado' },
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
    });
  });

  describe('updatePassword', () => {
    it('should return error if update fails', async () => {
      (service.updatePassword as jest.Mock).mockRejectedValue(new Error('Password update failed'));

      const result = await controller.updatePassword({
        email: 'juan@example.com',
        currentPassword: 'oldPassword',
        newPassword: 'newPassword',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Password update failed');
    });

    it('should update password successfully', async () => {
      const updatedUser = { ...mockUser, contrasena: undefined };
      (service.updatePassword as jest.Mock).mockResolvedValue(updatedUser);

      const result = await controller.updatePassword({
        email: 'juan@example.com',
        currentPassword: 'oldPassword',
        newPassword: 'newPassword',
      });

      expect(result.success).toBe(true);
      expect(result.user.contrasena).toBeUndefined();
    });
  });

  describe('deleteUser', () => {
    it('should return error if delete fails', async () => {
      (service.deleteUser as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      const result = await controller.deleteUser({ email: 'juan@example.com' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Delete failed');
    });

    it('should delete user successfully', async () => {
      (service.deleteUser as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.deleteUser({ email: 'juan@example.com' });

      expect(result.success).toBe(true);
    });
  });

  describe('getFriends', () => {
    it('should throw error if userId is invalid', async () => {
      await expect(controller.getFriends('invalid')).rejects.toThrow(
        'Error obteniendo lista de amigos',
      );
    });

    it('should return friends list', async () => {
      const friends = [
        { id: 2, nombre: 'Maria', apellido: 'García', email: 'maria@example.com' },
      ];
      (dataSource.query as jest.Mock).mockResolvedValue(friends);

      const result = await controller.getFriends('1');

      expect(result.success).toBe(true);
      expect(result.friends).toEqual(friends);
    });

    it('should handle database error', async () => {
      (dataSource.query as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(controller.getFriends('1')).rejects.toThrow('Error obteniendo lista de amigos');
    });
  });

  describe('controller definition', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });
});
