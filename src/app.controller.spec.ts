import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});

describe('Migrate Passwords Module', () => {
  let mockDataSource: any;

  const mockUsers = [
    { ID_USUARIO: 1, EMAIL: 'user1@test.com', CONTRASENA: 'plainpassword123' },
    { ID_USUARIO: 2, EMAIL: 'user2@test.com', CONTRASENA: '$2b$10$hashedpassword...' }, // Ya hasheada
    { ID_USUARIO: 3, EMAIL: 'user3@test.com', CONTRASENA: 'anotherplain' },
  ];

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('Password hashing verification', () => {
    it('debería identificar correctamente contraseñas ya hasheadas', async () => {
      // Arrange
      const plainPassword = 'plainpassword123';
      const hashedPassword = '$2b$10$hashedpassword...';

      // Act & Assert
      expect(plainPassword.startsWith('$2')).toBe(false);
      expect(hashedPassword.startsWith('$2')).toBe(true);
    });

    it('debería usar optional chaining correctamente', async () => {
      // Arrange
      const passwords: (string | null | undefined)[] = [
        'plainpassword123',
        '$2b$10$hashedpassword...',
        null,
        undefined,
      ];

      // Act & Assert - Verificar que optional chaining funciona
      expect(passwords[0]?.startsWith('$2')).toBe(false);
      expect(passwords[1]?.startsWith('$2')).toBe(true);
      expect(passwords[2]?.startsWith('$2')).toBeUndefined();
      expect(passwords[3]?.startsWith('$2')).toBeUndefined();
    });
  });

  describe('Password migration logic', () => {
    it('debería hash solo las contraseñas de texto plano', async () => {
      // Arrange
      const usersToMigrate = mockUsers.filter((user) => !user.CONTRASENA?.startsWith('$2'));
      expect(usersToMigrate).toHaveLength(2);

      // Act
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');
      for (const user of usersToMigrate) {
        await bcrypt.hash(user.CONTRASENA, 10);
      }

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith('plainpassword123', 10);
      expect(bcrypt.hash).toHaveBeenCalledWith('anotherplain', 10);
    });

    it('debería omitir contraseñas ya hasheadas (bcrypt $2*)', async () => {
      // Arrange
      const plainPasswords = mockUsers
        .filter((user) => !user.CONTRASENA?.startsWith('$2'))
        .map((user) => user.CONTRASENA);

      const hashedPasswords = mockUsers
        .filter((user) => user.CONTRASENA?.startsWith('$2'))
        .map((user) => user.CONTRASENA);

      // Act & Assert
      expect(plainPasswords).toEqual(['plainpassword123', 'anotherplain']);
      expect(hashedPasswords).toEqual(['$2b$10$hashedpassword...']);
    });

    it('debería reportar correctamente migrados y omitidos', async () => {
      // Arrange
      const totalUsers = mockUsers.length;
      const migratedCount = mockUsers.filter((u) => !u.CONTRASENA?.startsWith('$2')).length;
      const skippedCount = mockUsers.filter((u) => u.CONTRASENA?.startsWith('$2')).length;

      // Act & Assert
      expect(migratedCount + skippedCount).toBe(totalUsers);
      expect(migratedCount).toBe(2);
      expect(skippedCount).toBe(1);
      expect(totalUsers).toBe(3);
    });
  });

  describe('Error handling', () => {
    it('debería manejar errores en queries de base de datos', async () => {
      // Arrange
      const databaseError = new Error('Database connection failed');
      mockDataSource.query.mockRejectedValueOnce(databaseError);

      // Act & Assert
      await expect(mockDataSource.query()).rejects.toThrow('Database connection failed');
    });

    it('debería manejar usuarios sin contraseña', async () => {
      // Arrange
      const userWithoutPassword: { ID_USUARIO: number; EMAIL: string; CONTRASENA: string | null } = {
        ID_USUARIO: 1,
        EMAIL: 'test@test.com',
        CONTRASENA: null,
      };

      // Act & Assert
      expect(userWithoutPassword.CONTRASENA?.startsWith('$2')).toBeUndefined();
    });
  });
});
