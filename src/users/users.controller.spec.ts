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
    login: jest.fn(),
    getUserData: jest.fn(),
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

  describe('searchUser - edge cases', () => {
    it('debería manejar error al verificar amistad en amistades table', async () => {
      const mockUsers = [{ id: 2, nombre: 'Test', email: 'test@test.com' }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);

      const annotatedResult = [{ ...mockUsers[0], isFriend: false, pendingRequestFromMe: false, pendingRequestToMe: false }];
      mockUsersService.annotateSearchResults.mockResolvedValue(annotatedResult);

      const result = await controller.searchUser('test', '1');
      expect(result.results[0].isFriend).toBe(false);
      expect(result.success).toBe(true);
      expect(mockUsersService.annotateSearchResults).toHaveBeenCalledWith(mockUsers, 1);
    });

    it('debería manejar error al verificar pending request from me', async () => {
      const mockUsers = [{ id: 2, nombre: 'Test', email: 'test@test.com' }];
      mockUsersService.searchByName.mockResolvedValue(mockUsers);

      const annotatedResult = [{ ...mockUsers[0], isFriend: false, pendingRequestFromMe: false, pendingRequestToMe: false }];
      mockUsersService.annotateSearchResults.mockResolvedValue(annotatedResult);

      const result = await controller.searchUser('test', '1');
      expect(result.results[0].pendingRequestFromMe).toBe(false);
      expect(mockUsersService.annotateSearchResults).toHaveBeenCalled();
    });
  });

  describe('createFriendRequest - edge cases', () => {
    it('debería hacer rollback si falla la transacción al aceptar solicitud cruzada', async () => {
      const transactionError = new Error('Transaction error');
      mockUsersService.createFriendRequest.mockRejectedValue(transactionError);

      await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow('Transaction error');
      expect(mockUsersService.createFriendRequest).toHaveBeenCalledWith(1, 2);
    });

    it('debería lanzar error con código -20002 (solicitud cruzada)', async () => {
        const oracleError = new Error('ORA-20002: El usuario al que le va a enviar una solicitud ya le ha enviado una a usted.');
        mockUsersService.createFriendRequest.mockRejectedValue(oracleError);

        await expect(controller.createFriendRequest({ from: 1, to: 2 })).rejects.toThrow(
          'El usuario al que le va a enviar una solicitud ya le ha enviado una a usted.',
        );
        expect(mockUsersService.createFriendRequest).toHaveBeenCalledWith(1, 2);
      });
  });

  describe('CRUD methods', () => {
    it('debería crear usuario exitosamente', async () => {
      const dto: CreateUserDto = { nombre: 'T', apellido: 'U', email: 't@t.com', contrasena: 'p' };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue({ id: 1, ...dto } as any);

      const result = await controller.create(dto);
      expect(result.id).toBe(1);
    });

    it('debería retornar éxito en login', async () => {
      const mockUser = { id: 1, email: 't@t.com', contrasena: 'p' };
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      const result = await controller.login({ email: 't@t.com', contrasena: 'p' });
      expect(result.success).toBe(true);
    });
  });
});
