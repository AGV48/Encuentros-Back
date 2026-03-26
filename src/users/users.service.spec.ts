import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

jest.mock('bcrypt');

const mockBcrypt = require('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepository: any;

  const mockUser: User = {
    id: 1,
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'juan@example.com',
    contrasena: 'hashedPassword123',
    imagenPerfil: 'https://example.com/image.jpg',
    fechaRegistro: new Date(),
    resetPasswordToken: null,
  };

  beforeEach(async () => {
    mockUserRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockBcrypt.compare.mockClear();
    mockBcrypt.hash.mockClear();
  });

  describe('create', () => {
    it('should create a new user with all fields', async () => {
      const createUserDto: CreateUserDto = {
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
        contrasena: 'password123',
        imagenPerfil: 'https://example.com/image.jpg',
      };

      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'juan@example.com',
        contrasena: 'password123',
        imagenPerfil: 'https://example.com/image.jpg',
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should create a user without optional fields', async () => {
      const createUserDto: CreateUserDto = {
        nombre: 'Juan',
        email: 'juan@example.com',
        contrasena: 'password123',
      };

      const userWithoutOptional = { ...mockUser, apellido: undefined, imagenPerfil: undefined };
      mockUserRepository.create.mockReturnValue(userWithoutOptional);
      mockUserRepository.save.mockResolvedValue(userWithoutOptional);

      const result = await service.create(createUserDto);

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        nombre: 'Juan',
        apellido: undefined,
        email: 'juan@example.com',
        contrasena: 'password123',
        imagenPerfil: undefined,
      });
      expect(result).toEqual(userWithoutOptional);
    });
  });

  describe('findByEmail', () => {
    it('should return a user when email exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('juan@example.com');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'juan@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when email does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when id exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when id does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const updateData: Partial<User> = {
        nombre: 'Juan Actualizado',
        apellido: 'García',
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUser('juan@example.com', updateData);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'juan@example.com' },
      });
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUser('nonexistent@example.com', {})).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('updatePassword', () => {
    it('should update password successfully when current password is correct', async () => {
      const currentPassword = 'oldPassword123';
      const newPassword = 'newPassword456';
      const hashedNewPassword = 'hashedNewPassword';

      const userCopy = { ...mockUser };
      mockUserRepository.findOne.mockResolvedValue(userCopy);
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue(hashedNewPassword);

      const updatedUser = { ...userCopy, contrasena: hashedNewPassword };
      mockUserRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updatePassword('juan@example.com', currentPassword, newPassword);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(currentPassword, mockUser.contrasena);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.contrasena).toBeUndefined();
    });

    it('should throw error when current password is incorrect', async () => {
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser });
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.updatePassword('juan@example.com', 'wrongPassword', 'newPassword456'),
      ).rejects.toThrow('Contraseña actual incorrecta');
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePassword('nonexistent@example.com', 'oldPassword', 'newPassword'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.remove.mockResolvedValue(undefined);

      await service.deleteUser('juan@example.com');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'juan@example.com' },
      });
      expect(mockUserRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteUser('nonexistent@example.com')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('searchByName', () => {
    it('should return users matching search term for nombre', async () => {
      const searchResults = [mockUser];
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(searchResults),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchByName('juan');

      expect(mockUserRepository.createQueryBuilder).toHaveBeenCalledWith('u');
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.orWhere).toHaveBeenCalledTimes(2);
      expect(result).toEqual(searchResults);
    });

    it('should return users matching search term for apellido', async () => {
      const searchResults = [mockUser];
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(searchResults),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchByName('pérez');

      expect(result).toEqual(searchResults);
    });

    it('should return users matching search term for email', async () => {
      const searchResults = [mockUser];
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(searchResults),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchByName('juan@example.com');

      expect(result).toEqual(searchResults);
    });

    it('should return empty array when search term is empty', async () => {
      const result = await service.searchByName('');

      expect(result).toEqual([]);
      expect(mockUserRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should return empty array when search term is only whitespace', async () => {
      const result = await service.searchByName('   ');

      expect(result).toEqual([]);
      expect(mockUserRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should return empty array when search term is null', async () => {
      const result = await service.searchByName(null as any);

      expect(result).toEqual([]);
    });
  });

  describe('updateResetToken', () => {
    it('should update reset password token', async () => {
      const token = 'reset-token-12345';
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateResetToken(1, token);

      expect(mockUserRepository.update).toHaveBeenCalledWith(1, {
        resetPasswordToken: token,
      });
    });
  });

  describe('findByResetToken', () => {
    it('should return user when reset token exists', async () => {
      const token = 'reset-token-12345';
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByResetToken(token);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { resetPasswordToken: token },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when reset token does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByResetToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('resetUserPassword', () => {
    it('should reset user password and clear token', async () => {
      const hashedPassword = 'newHashedPassword123';
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.resetUserPassword(1, hashedPassword);

      expect(mockUserRepository.update).toHaveBeenCalledWith(1, {
        contrasena: hashedPassword,
        resetPasswordToken: null,
      });
    });
  });

  describe('service definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });
});
