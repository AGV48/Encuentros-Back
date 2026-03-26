import { DataSource } from 'typeorm';

jest.mock('@nestjs/core');
jest.mock('bcrypt');

describe('migrate-passwords', () => {
  let mockApp: any;
  let mockDataSource: any;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let migratePasswords: any;
  let NestFactory: any;
  let bcrypt: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    jest.resetModules();
    
    // Setup console mocks
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Setup fresh DataSource mock for each test
    mockDataSource = {
      query: jest.fn(),
    };

    // Setup fresh App mock for each test
    mockApp = {
      get: jest.fn().mockReturnValue(mockDataSource),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Get mocked modules
    NestFactory = require('@nestjs/core').NestFactory;
    bcrypt = require('bcrypt');

    // Mock NestFactory.createApplicationContext with fresh mock
    NestFactory.createApplicationContext = jest.fn().mockResolvedValue(mockApp);

    // Import the module after mocks are set up
    const module = require('./migrate-passwords');
    migratePasswords = module.migratePasswords;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('migratePasswords', () => {
    it('should migrate plain text passwords to bcrypt hashes', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user1@example.com',
          CONTRASENA: 'plainPassword123',
        },
        {
          ID_USUARIO: 2,
          EMAIL: 'user2@example.com',
          CONTRASENA: 'anotherPassword456',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users) // First call returns users
        .mockResolvedValue(undefined); // Subsequent calls for updates

      bcrypt.hash
        .mockResolvedValueOnce('$2b$10$hashedPassword1')
        .mockResolvedValueOnce('$2b$10$hashedPassword2');

      // Act
      await migratePasswords();

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        'SELECT ID_USUARIO, EMAIL, CONTRASENA FROM USUARIOS',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('plainPassword123', 10);
      expect(bcrypt.hash).toHaveBeenCalledWith('anotherPassword456', 10);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        'UPDATE USUARIOS SET CONTRASENA = :1 WHERE ID_USUARIO = :2',
        ['$2b$10$hashedPassword1', 1],
      );
      expect(mockApp.close).toHaveBeenCalled();
    });

    it('should skip users with already hashed passwords', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user1@example.com',
          CONTRASENA: '$2b$10$alreadyHashedPassword',
        },
        {
          ID_USUARIO: 2,
          EMAIL: 'user2@example.com',
          CONTRASENA: 'plainPassword456',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users)
        .mockResolvedValue(undefined);

      bcrypt.hash.mockResolvedValueOnce('$2b$10$newHash');

      // Act
      await migratePasswords();

      // Assert - bcrypt.hash should only be called once (for the plain password)
      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      expect(bcrypt.hash).toHaveBeenCalledWith('plainPassword456', 10);

      // Only one update should be performed
      const updateCalls = mockDataSource.query.mock.calls.filter((call: any[]) =>
        call[0].includes('UPDATE'),
      );
      expect(updateCalls).toHaveLength(1);
    });

    it('should handle empty user list', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([]);

      // Act
      await migratePasswords();

      // Assert
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Se encontraron 0 usuarios'),
      );
      expect(mockApp.close).toHaveBeenCalled();
    });

    it('should handle mixed plain and hashed passwords', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user1@example.com',
          CONTRASENA: 'plainPassword1',
        },
        {
          ID_USUARIO: 2,
          EMAIL: 'user2@example.com',
          CONTRASENA: '$2b$10$hash1',
        },
        {
          ID_USUARIO: 3,
          EMAIL: 'user3@example.com',
          CONTRASENA: 'plainPassword2',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users)
        .mockResolvedValue(undefined);

      bcrypt.hash
        .mockResolvedValueOnce('$2b$10$newHash1')
        .mockResolvedValueOnce('$2b$10$newHash2');

      // Act
      await migratePasswords();

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migrados: 2'),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Omitidos (ya cifrados): 1'),
      );
    });

    it('should handle users with null or empty passwords', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user1@example.com',
          CONTRASENA: null,
        },
        {
          ID_USUARIO: 2,
          EMAIL: 'user2@example.com',
          CONTRASENA: 'plainPassword',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users)
        .mockResolvedValue(undefined);

      bcrypt.hash
        .mockResolvedValueOnce('$2b$10$hash1')
        .mockResolvedValueOnce('$2b$10$hash2');

      // Act
      await migratePasswords();

      // Assert - bcrypt.hash will be called for both users (null still gets hashed)
      expect(bcrypt.hash).toHaveBeenCalledTimes(2);
      // First call will be with null
      expect(bcrypt.hash).toHaveBeenNthCalledWith(1, null, 10);
      // Second call with plainPassword
      expect(bcrypt.hash).toHaveBeenNthCalledWith(2, 'plainPassword', 10);
    });

    it('should close the app even on error', async () => {
      // Arrange
      const error = new Error('Database error');
      mockDataSource.query.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(migratePasswords()).rejects.toThrow('Database error');
      expect(mockApp.close).toHaveBeenCalled();
    });

    it('should handle bcrypt hashing errors', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user1@example.com',
          CONTRASENA: 'plainPassword',
        },
      ];

      mockDataSource.query.mockResolvedValueOnce(users);
      const bcryptError = new Error('Bcrypt error');
      bcrypt.hash.mockRejectedValueOnce(bcryptError);

      // Act & Assert
      await expect(migratePasswords()).rejects.toThrow('Bcrypt error');
      expect(mockApp.close).toHaveBeenCalled();
    });

    it('should handle database update errors', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user1@example.com',
          CONTRASENA: 'plainPassword',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users) // First call returns users
        .mockRejectedValueOnce(new Error('Update failed')); // Second call fails

      bcrypt.hash.mockResolvedValueOnce('$2b$10$hash');

      // Act & Assert
      await expect(migratePasswords()).rejects.toThrow('Update failed');
      expect(mockApp.close).toHaveBeenCalled();
    });

    it('should log initial migration message', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([]);

      // Act
      await migratePasswords();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Iniciando migración de contraseñas'),
      );
    });

    it('should log success message', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user@example.com',
          CONTRASENA: 'plainPassword',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users)
        .mockResolvedValue(undefined);

      bcrypt.hash.mockResolvedValueOnce('$2b$10$hash');

      // Act
      await migratePasswords();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Migración completada exitosamente'),
      );
    });

    it('should log error details on failure', async () => {
      // Arrange
      const error = new Error('Critical error');
      mockDataSource.query.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(migratePasswords()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error durante la migración'),
        error,
      );
    });

    it('should use bcrypt with correct salt rounds', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user@example.com',
          CONTRASENA: 'plainPassword',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users)
        .mockResolvedValue(undefined);

      bcrypt.hash.mockResolvedValueOnce('$2b$10$hash');

      // Act
      await migratePasswords();

      // Assert - verify 10 salt rounds
      expect(bcrypt.hash).toHaveBeenCalledWith('plainPassword', 10);
    });

    it('should process users sequentially', async () => {
      // Arrange
      const users = [
        {
          ID_USUARIO: 1,
          EMAIL: 'user1@example.com',
          CONTRASENA: 'password1',
        },
        {
          ID_USUARIO: 2,
          EMAIL: 'user2@example.com',
          CONTRASENA: 'password2',
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users)
        .mockResolvedValue(undefined);

      bcrypt.hash
        .mockResolvedValueOnce('$2b$10$hash1')
        .mockResolvedValueOnce('$2b$10$hash2');

      // Act
      await migratePasswords();

      // Assert
      const updateCalls = mockDataSource.query.mock.calls.filter((call: any[]) =>
        call[0]?.includes('UPDATE'),
      );
      expect(updateCalls.length).toBe(2);
      expect(updateCalls[0][1]).toEqual(['$2b$10$hash1', 1]);
      expect(updateCalls[1][1]).toEqual(['$2b$10$hash2', 2]);
    });

    it('should get DataSource from app context', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([]);

      // Act
      await migratePasswords();

      // Assert - verify that app.get was called to retrieve the DataSource
      // mockApp.get should be called at least once with DataSource
      const getCallsWithDataSource = mockApp.get.mock.calls.filter(
        (call: any[]) => call[0] === DataSource || (call[0] && call[0].name === 'DataSource'),
      );
      expect(getCallsWithDataSource.length).toBeGreaterThan(0);
    });

    it('should create application context with AppModule', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([]);

      // Act
      await migratePasswords();

      // Assert
      expect(NestFactory.createApplicationContext).toHaveBeenCalled();
    });

    it('should show summary statistics', async () => {
      // Arrange
      const users = [
        { ID_USUARIO: 1, EMAIL: 'user1@example.com', CONTRASENA: 'password1' },
        { ID_USUARIO: 2, EMAIL: 'user2@example.com', CONTRASENA: '$2b$10$hash' },
        { ID_USUARIO: 3, EMAIL: 'user3@example.com', CONTRASENA: 'password3' },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(users)
        .mockResolvedValue(undefined);

      bcrypt.hash
        .mockResolvedValueOnce('$2b$10$h1')
        .mockResolvedValueOnce('$2b$10$h2');

      // Act
      await migratePasswords();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Migrados: 2/),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Omitidos \(ya cifrados\): 1/),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Total: 3/),
      );
    });
  });

  describe('Script execution', () => {
    it('should export migratePasswords function', () => {
      // This test verifies the function is properly exported
      expect(typeof migratePasswords).toBe('function');
    });
  });
});
