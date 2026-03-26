import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Hacemos mock de la libería externa bcrypt
jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;
  let dataSource: DataSource;

  // Creamos el mock global del repositorio que vamos a inyectar
  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    // Limpiamos los mocks entre pruebas para asegurar independencia
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
    expect(repository).toBeDefined();
    expect(dataSource).toBeDefined();
  });

  describe('create', () => {
    it('debería crear y retornar un nuevo usuario satisfactoriamente', async () => {
      // Arrange
      const createUserDto = {
        nombre: 'John',
        apellido: 'Doe',
        email: 'john@test.com',
        contrasena: 'pass123',
        imagenPerfil: 'url.jpg',
      };
      const expectedSavedUser = { id: 1, ...createUserDto };

      mockUserRepository.create.mockReturnValue(expectedSavedUser);
      mockUserRepository.save.mockResolvedValue(expectedSavedUser);

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        nombre: 'John',
        apellido: 'Doe',
        email: 'john@test.com',
        contrasena: 'pass123',
        imagenPerfil: 'url.jpg',
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(expectedSavedUser);
      expect(result).toEqual(expectedSavedUser);
    });
  });

  describe('findByEmail', () => {
    it('debería encontrar y retornar un usuario cuando el email existe', async () => {
      // Arrange
      const email = 'test@test.com';
      const existingUser = { id: 1, email };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Act
      const result = await service.findByEmail(email);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(result).toEqual(existingUser);
    });

    it('debería retornar null cuando el email no existe', async () => {
      // Arrange
      const email = 'notfound@test.com';
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByEmail(email);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('debería encontrar y retornar un usuario cuando el id existe', async () => {
      // Arrange
      const id = 1;
      const existingUser = { id, email: 'test@test.com' };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Act
      const result = await service.findById(id);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(existingUser);
    });

    it('debería retornar null cuando el id no se encuentra', async () => {
      // Arrange
      const id = 99;
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findById(id);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('debería actualizar y retornar el usuario cuando éste existe', async () => {
      // Arrange
      const email = 'test@test.com';
      const updateData = { nombre: 'New Name' };
      const existingUser = { id: 1, email, nombre: 'Old Name' };
      const updatedUser = { id: 1, email, nombre: 'New Name' };

      jest.spyOn(service, 'findByEmail').mockResolvedValue(existingUser as any);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      // Act
      const result = await service.updateUser(email, updateData);

      // Assert
      expect(service.findByEmail).toHaveBeenCalledWith(email);
      expect(mockUserRepository.save).toHaveBeenCalledWith(updatedUser);
      expect(result).toEqual(updatedUser);
    });

    it('debería lanzar un error si el usuario a actualizar no existe', async () => {
      // Arrange
      const email = 'notfound@test.com';
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateUser(email, { nombre: 'New' })).rejects.toThrow('User not found');
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updatePassword', () => {
    it('debería actualizar la contraseña correctamente si todo es válido', async () => {
      // Arrange
      const email = 'test@test.com';
      const currentPassword = 'oldPassword';
      const newPassword = 'newPassword';
      const existingUser = { id: 1, email, contrasena: 'hashedOldPassword' };
      const hashedNewPassword = 'hashedNewPassword';

      jest.spyOn(service, 'findByEmail').mockResolvedValue(existingUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedNewPassword);
      
      const savedUser = { ...existingUser, contrasena: hashedNewPassword };
      mockUserRepository.save.mockResolvedValue(savedUser);

      // Act
      const result = await service.updatePassword(email, currentPassword, newPassword);

      // Assert
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, 'hashedOldPassword');
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect((result as any).contrasena).toBeUndefined(); // Verifica que se eliminó el property
    });

    it('debería lanzar un error si el usuario no existe', async () => {
      // Arrange
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      // Act & Assert
      await expect(service.updatePassword('notfound@test.com', 'old', 'new')).rejects.toThrow('User not found');
    });

    it('debería lanzar un error si la contraseña actual no es correcta', async () => {
      // Arrange
      const existingUser = { id: 1, email: 'test@test.com', contrasena: 'hashedOldPassword' };
      jest.spyOn(service, 'findByEmail').mockResolvedValue(existingUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Contraseña incorrecta

      // Act & Assert
      await expect(service.updatePassword('test@test.com', 'wrongOld', 'new')).rejects.toThrow('Contraseña actual incorrecta');
      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('debería eliminar el usuario si este existe', async () => {
      // Arrange
      const email = 'test@test.com';
      const existingUser = { id: 1, email };
      jest.spyOn(service, 'findByEmail').mockResolvedValue(existingUser as any);
      mockUserRepository.remove.mockResolvedValue(existingUser);

      // Act
      await service.deleteUser(email);

      // Assert
      expect(mockUserRepository.remove).toHaveBeenCalledWith(existingUser);
    });

    it('debería lanzar un error si el usuario a eliminar no existe', async () => {
      // Arrange
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteUser('notfound@test.com')).rejects.toThrow('User not found');
      expect(mockUserRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('searchByName', () => {
    it('debería retornar un array vacío si la consulta está vacía o es completada solo por espacios', async () => {
      // Arrange
      // Act
      const resultSpace = await service.searchByName('   ');
      const resultEmpty = await service.searchByName('');

      // Assert
      expect(resultSpace).toEqual([]);
      expect(resultEmpty).toEqual([]);
      expect(mockUserRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('debería ejecutar el filtro del queryBuilder cuando se proporcione un término válido', async () => {
      // Arrange
      const term = 'john';
      const usersFound = [
        { id: 1, nombre: 'John', apellido: 'Doe', email: 'john@test.com', imagenPerfil: null }
      ];

      // Simulamos la cadena de métodos del QueryBuilder
      const queryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(usersFound),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      // Act
      const result = await service.searchByName(term);

      // Assert
      expect(mockUserRepository.createQueryBuilder).toHaveBeenCalledWith('u');
      expect(queryBuilder.where).toHaveBeenCalledWith('LOWER(u.nombre) LIKE :t', { t: '%john%' });
      expect(queryBuilder.orWhere).toHaveBeenCalledWith('LOWER(u.apellido) LIKE :t', { t: '%john%' });
      expect(queryBuilder.select).toHaveBeenCalledWith(['u.id', 'u.nombre', 'u.apellido', 'u.email', 'u.imagenPerfil']);
      expect(queryBuilder.getMany).toHaveBeenCalled();
      expect(result).toEqual(usersFound);
    });
  });

  describe('updateResetToken', () => {
    it('debería actualizar el token de restablecimiento para el usuario proporcionado', async () => {
      // Arrange
      const userId = 1;
      const token = 'reset-token-123';
      mockUserRepository.update.mockResolvedValue(undefined);

      // Act
      await service.updateResetToken(userId, token);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        resetPasswordToken: token,
      });
    });
  });

  describe('findByResetToken', () => {
    it('debería retornar el usuario correspondiente al token proveído', async () => {
      // Arrange
      const token = 'reset-token-123';
      const userFound = { id: 1, email: 'test@test.com', resetPasswordToken: token };
      mockUserRepository.findOne.mockResolvedValue(userFound);

      // Act
      const result = await service.findByResetToken(token);

      // Assert
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { resetPasswordToken: token }
      });
      expect(result).toEqual(userFound);
    });
  });

  describe('resetUserPassword', () => {
    it('debería actualizar la contraseña hasheada y limpiar el token', async () => {
      // Arrange
      const userId = 1;
      const hashedPassword = 'hashedPassword123';
      mockUserRepository.update.mockResolvedValue(undefined);

      // Act
      await service.resetUserPassword(userId, hashedPassword);

      // Assert
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
        contrasena: hashedPassword,
        resetPasswordToken: null,
      });
    });
  });

  describe('annotateSearchResults', () => {
    it('debería anotar resultados de búsqueda con información de amistad', async () => {
      // Arrange
      const currentUserId = 1;
      const results = [
        { id: 2, nombre: 'John', apellido: 'Doe', email: 'john@test.com', imagenPerfil: null },
      ];

      // Cada llamada a query retorna un resultado diferente
      mockDataSource.query
        .mockResolvedValueOnce([{ cnt: 1 }]) // checkFriendship - isFriend true
        .mockResolvedValueOnce([{ cnt: 0 }]) // checkPendingRequestFromMe
        .mockResolvedValueOnce([{ cnt: 0 }]); // checkPendingRequestToMe

      // Act
      const result = await service.annotateSearchResults(results, currentUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...results[0],
        isFriend: true,
        pendingRequestFromMe: false,
        pendingRequestToMe: false,
      });
    });

    it('debería retornar false para todas las propiedades si hay error en las consultas', async () => {
      // Arrange
      const currentUserId = 1;
      const results = [
        { id: 2, nombre: 'John', apellido: 'Doe', email: 'john@test.com', imagenPerfil: null },
      ];

      mockDataSource.query
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error'));

      // Act
      const result = await service.annotateSearchResults(results, currentUserId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].isFriend).toBe(false);
      expect(result[0].pendingRequestFromMe).toBe(false);
      expect(result[0].pendingRequestToMe).toBe(false);
    });
  });

  describe('createFriendRequest', () => {
    it('debería crear una nueva solicitud de amistad cuando no son amigos y no hay solicitud cruzada', async () => {
      // Arrange
      const from = 1;
      const to = 2;
      
      // checkFriendshipForRequest
      mockDataSource.query.mockResolvedValueOnce([{ cnt: 0 }]); // No son amigos
      
      // checkAndAcceptReversePendingRequest - busca solicitud cruzada
      mockDataSource.query.mockResolvedValueOnce([]); // No hay solicitud cruzada pendiente

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn()
          .mockResolvedValueOnce([{ id_relacion_amistad: 5 }]) // INSERT relaciones_amistades
          .mockResolvedValueOnce(undefined), // INSERT solicitudes_amistad
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act
      const result = await service.createFriendRequest(from, to);

      // Assert
      expect(result).toEqual({ success: true, message: 'Solicitud enviada' });
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería lanzar error si ya son amigos', async () => {
      // Arrange
      const from = 1;
      const to = 2;
      mockDataSource.query.mockResolvedValue([{ cnt: 1 }]); // Ya son amigos

      // Act & Assert
      await expect(service.createFriendRequest(from, to)).rejects.toThrow('Ya son amigos');
    });

    it('debería aceptar automáticamente solicitud cruzada pendiente', async () => {
      // Arrange
      const from = 1;
      const to = 2;
      
      // checkFriendshipForRequest
      mockDataSource.query.mockResolvedValueOnce([{ cnt: 0 }]); // No son amigos
      
      // checkAndAcceptReversePendingRequest - busca solicitud cruzada
      mockDataSource.query.mockResolvedValueOnce([{ id_relacion: 5 }]); // Existe solicitud cruzada

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

      // Act
      const result = await service.createFriendRequest(from, to);

      // Assert
      expect(result.accepted).toBe(true);
      expect(result.message).toContain('amistad aceptada automáticamente');
    });

    it('debería rollback si falla la transacción de nueva solicitud', async () => {
      // Arrange
      const from = 1;
      const to = 2;
      
      // checkFriendshipForRequest
      mockDataSource.query.mockResolvedValueOnce([{ cnt: 0 }]);
      
      // checkAndAcceptReversePendingRequest
      mockDataSource.query.mockResolvedValueOnce([]);

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn().mockRejectedValue(new Error('DB error')),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act & Assert
      await expect(service.createFriendRequest(from, to)).rejects.toThrow('DB error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería rollback si falla la transacción de solicitud cruzada aceptada', async () => {
      // Arrange
      const from = 1;
      const to = 2;
      
      // checkFriendshipForRequest
      mockDataSource.query.mockResolvedValueOnce([{ cnt: 0 }]);
      
      // checkAndAcceptReversePendingRequest - busca solicitud cruzada
      mockDataSource.query.mockResolvedValueOnce([{ id_relacion: 5 }]);

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn().mockRejectedValue(new Error('Transaction failed')),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act & Assert
      await expect(service.createFriendRequest(from, to)).rejects.toThrow('Transaction failed');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('debería crear usuario con apellido y imagenPerfil undefined', async () => {
      // Arrange
      const createUserDto = {
        nombre: 'John',
        apellido: undefined,
        email: 'john@test.com',
        contrasena: 'hashedPass',
        imagenPerfil: undefined,
      };

      const expectedUser: Partial<User> = {
        nombre: 'John',
        apellido: undefined,
        email: 'john@test.com',
        contrasena: 'hashedPass',
        imagenPerfil: undefined,
      };

      mockUserRepository.create.mockReturnValue(expectedUser);
      mockUserRepository.save.mockResolvedValue(expectedUser as User);

      // Act
      const result = await service.create(createUserDto as any);

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalledWith(expectedUser);
      expect(result).toEqual(expectedUser);
    });

    it('debería crear usuario sin apellido y con imagenPerfil', async () => {
      // Arrange
      const createUserDto = {
        nombre: 'Jane',
        email: 'jane@test.com',
        contrasena: 'hashedPass',
        imagenPerfil: 'profile.jpg',
      };

      const expectedUser: Partial<User> = {
        nombre: 'Jane',
        apellido: undefined,
        email: 'jane@test.com',
        contrasena: 'hashedPass',
        imagenPerfil: 'profile.jpg',
      };

      mockUserRepository.create.mockReturnValue(expectedUser);
      mockUserRepository.save.mockResolvedValue(expectedUser as User);

      // Act
      const result = await service.create(createUserDto as any);

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(result.imagenPerfil).toBe('profile.jpg');
    });
  });

  describe('Private methods error handling', () => {
    it('checkFriendship: debería retornar false si la query falla', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB connection error'));

      // Act & Assert - no debería lanzar error, retorna false
      const result = await (service as any).checkFriendship(1, 2);
      expect(result).toBe(false);
    });

    it('checkPendingRequestFromMe: debería retornar false si la query falla', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      const result = await (service as any).checkPendingRequestFromMe(1, 2);
      expect(result).toBe(false);
    });

    it('checkPendingRequestToMe: debería retornar false si la query falla', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      const result = await (service as any).checkPendingRequestToMe(1, 2);
      expect(result).toBe(false);
    });

    it('checkFriendshipForRequest: debería retornar false si la query falla', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      const result = await (service as any).checkFriendshipForRequest(1, 2);
      expect(result).toBe(false);
    });

    it('checkFriendship: debería manejar respuesta con "count" en lugar de "cnt"', async () => {
      // Arrange - algunos drivers retornan "count" en lugar de "cnt"
      mockDataSource.query.mockResolvedValue([{ count: 1 }]);

      // Act
      const result = await (service as any).checkFriendship(1, 2);

      // Assert
      expect(result).toBe(true);
    });

    it('checkPendingRequestFromMe: debería manejar respuesta null', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValue([]);

      // Act
      const result = await (service as any).checkPendingRequestFromMe(1, 2);

      // Assert
      expect(result).toBe(false);
    });

    it('checkAndAcceptReversePendingRequest: debería retornar {accepted: false} si query falla', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      // Act
      const result = await (service as any).checkAndAcceptReversePendingRequest(1, 2);

      // Assert
      expect(result).toEqual({ accepted: false });
    });

    it('checkAndAcceptReversePendingRequest: debería manejar id_relacion_amistad como alternativa a id_relacion', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([{ id_relacion_amistad: 7 }]); // Busca solicitud cruzada

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // UPDATE
          .mockResolvedValueOnce(undefined), // INSERT amistades
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act
      const result = await (service as any).checkAndAcceptReversePendingRequest(2, 1);

      // Assert
      expect(result.accepted).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('annotateSearchResults: debería retornar anotaciones correctas incluso si métodos privados fallan', async () => {
      // Arrange
      const users = [
        { id: 2, nombre: 'User2', apellido: 'Two' } as User,
        { id: 3, nombre: 'User3', apellido: 'Three' } as User,
      ];

      // Hacer que checkFriendship, checkPendingRequestFromMe, checkPendingRequestToMe fallen
      mockDataSource.query
        .mockRejectedValueOnce(new Error('DB error')) // checkFriendship para user 2
        .mockRejectedValueOnce(new Error('DB error')) // checkPendingRequestFromMe para user 2
        .mockRejectedValueOnce(new Error('DB error')) // checkPendingRequestToMe para user 2
        .mockRejectedValueOnce(new Error('DB error')) // checkFriendship para user 3
        .mockRejectedValueOnce(new Error('DB error')) // checkPendingRequestFromMe para user 3
        .mockRejectedValueOnce(new Error('DB error')); // checkPendingRequestToMe para user 3

      // Act
      const result = await service.annotateSearchResults(users, 1);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].isFriend).toBe(false); // Default cuando hay error
      expect(result[0].pendingRequestFromMe).toBe(false);
      expect(result[0].pendingRequestToMe).toBe(false);
    });
  });
});
