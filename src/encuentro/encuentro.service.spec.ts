import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroService } from './encuentro.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Encuentro } from './entities/encuentro.entity';
import { EncuentroResumen } from './entities/encuentro-resumen.entity';
import { ParticipanteEncuentro } from '../participantes-encuentro/entities/participante-encuentro.entity';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('EncuentroService', () => {
  let service: EncuentroService;

  const mockEncuentrosRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  const mockEncuentroResumenRepository = {
    find: jest.fn(),
  };

  const mockParticipanteRepository = {
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncuentroService,
        { provide: getRepositoryToken(Encuentro), useValue: mockEncuentrosRepository },
        { provide: getRepositoryToken(EncuentroResumen), useValue: mockEncuentroResumenRepository },
        { provide: getRepositoryToken(ParticipanteEncuentro), useValue: mockParticipanteRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<EncuentroService>(EncuentroService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un encuentro exitosamente', async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1); // Fecha futura
      
      const createDto = {
        idCreador: 1,
        titulo: 'Partido',
        descripcion: 'Futbol 5',
        lugar: 'Cancha',
        fecha: futureDate,
      };

      const expectedEncuentro = { id: 10, ...createDto };
      mockEncuentrosRepository.create.mockReturnValue(expectedEncuentro);
      mockEncuentrosRepository.save.mockResolvedValue(expectedEncuentro);
      mockDataSource.query.mockResolvedValue([]);

      // Act
      const result = await service.create(createDto as any);

      // Assert
      expect(mockEncuentrosRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        idCreador: 1,
        titulo: 'Partido',
      }));
      expect(mockEncuentrosRepository.save).toHaveBeenCalledWith(expectedEncuentro);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO participantes_encuentro'),
        [10, 1]
      );
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO presupuestos'),
        [10]
      );
      expect(result).toEqual({ success: true });
    });

    it('debería lanzar BadRequestException si la fecha es en el pasado', async () => {
      // Arrange
      const pastDate = new Date('2000-01-01');
      const createDto = {
        idCreador: 1,
        titulo: 'Partido',
        fecha: pastDate,
      };

      // Act & Assert
      await expect(service.create(createDto as any)).rejects.toThrow(BadRequestException);
      expect(mockEncuentrosRepository.create).not.toHaveBeenCalled();
    });

    it('debería propagar otros errores producidos durante la creación', async () => {
      // Arrange
      const futureDate = new Date(Date.now() + 86400000); // +1 día
      const createDto = { idCreador: 1, fecha: futureDate };
      mockEncuentrosRepository.create.mockReturnValue(createDto);
      mockEncuentrosRepository.save.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.create(createDto as any)).rejects.toThrow('DB Error');
    });
  });

  describe('findAll', () => {
    it('debería usar dataSource.query cuando se provee creadorId', async () => {
      // Arrange
      const creadorId = 1;
      const mockRows = [
        {
          id_encuentro: 10,
          id_creador: creadorId,
          titulo: 'Test',
          descripcion: 'Desc',
          lugar: 'Lugar',
          fecha: new Date(),
          fecha_creacion: new Date()
        }
      ];
      mockDataSource.query.mockResolvedValue(mockRows);

      // Act
      const result = await service.findAll(creadorId);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('SELECT e.id_encuentro'), [1, 1]);
      expect(result[0]).toHaveProperty('id', 10);
      expect(result[0]).toHaveProperty('idCreador', creadorId);
      expect(result[0]).toHaveProperty('titulo', 'Test');
    });

    it('debería usar TypeORM find() cuando no se provee creadorId', async () => {
      // Arrange
      mockEncuentrosRepository.find.mockResolvedValue([{ id: 10 }]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockEncuentrosRepository.find).toHaveBeenCalled();
      expect(result).toEqual([{ id: 10 }]);
    });
  });

  describe('findAllWithResumen', () => {
    it('debería retornar el resumen con filtros si se provee creadorId', async () => {
      // Arrange
      const creadorId = 1;
      const mockResult = [{
        id_encuentro: 10,
        id_creador: creadorId,
        id_presupuesto: 5,
        presupuesto_total: '1000',
        cant_participantes: '4'
      }];
      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllWithResumen(creadorId);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('WHERE pe.id_usuario = $2'), [1, 1]);
      expect(result[0]).toMatchObject({
        id: 10,
        idPresupuesto: 5,
        presupuestoTotal: 1000,
        cantParticipantes: 4
      });
    });

    it('debería retornar el resumen global sin filtros si no hay creadorId', async () => {
      // Arrange
      const mockResult = [{
        id_encuentro: 11,
        id_creador: 2,
        presupuesto_total: null,
        cant_participantes: null
      }];
      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllWithResumen();

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.not.stringContaining('$1'));
      expect(result[0]).toMatchObject({
        id: 11,
        presupuestoTotal: 0,
        cantParticipantes: 0
      });
    });
  });

  describe('findOne', () => {
    it('debería retornar un solo encuentro por el id dado', async () => {
      // Arrange
      const id = 10;
      mockEncuentrosRepository.findOne.mockResolvedValue({ id });

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(mockEncuentrosRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual({ id });
    });
  });

  describe('update', () => {
    it('debería lanzar NotFoundException si el encuentro a actualizar no existe', async () => {
      // Arrange
      mockEncuentrosRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(10, {}, 1)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar ForbiddenException si el usuario no es el creador', async () => {
      // Arrange
      const encuentroExistente = { id: 10, idCreador: 2 }; // Creador es 2
      mockEncuentrosRepository.findOne.mockResolvedValue(encuentroExistente);

      // Act & Assert
      await expect(service.update(10, {}, 1)).rejects.toThrow(ForbiddenException); // Usuario es 1
    });

    it('debería lanzar BadRequestException si la nueva fecha es en el pasado', async () => {
      // Arrange
      const encuentroExistente = { id: 10, idCreador: 1 };
      mockEncuentrosRepository.findOne.mockResolvedValue(encuentroExistente);
      const updateDto = { fecha: new Date('2000-01-01') };

      // Act & Assert
      await expect(service.update(10, updateDto, 1)).rejects.toThrow(BadRequestException);
    });

    it('debería actualizar correctamente un encuentro si todo es válido', async () => {
      // Arrange
      const encuentroExistente = { id: 10, idCreador: 1, titulo: 'Viejo' };
      mockEncuentrosRepository.findOne.mockResolvedValue(encuentroExistente);
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const updateDto = { titulo: 'Nuevo', fecha: futureDate };

      mockEncuentrosRepository.save.mockImplementation(async (enc) => enc);

      // Act
      const result = await service.update(10, updateDto, 1);

      // Assert
      expect(mockEncuentrosRepository.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.encuentro.titulo).toBe('Nuevo');
    });
  });

  describe('remove', () => {
    it('debería lanzar NotFoundException si no existe el encuentro a eliminar', async () => {
      // Arrange
      mockEncuentrosRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(10, 1)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar ForbiddenException si usuario no es creador', async () => {
      // Arrange
      mockEncuentrosRepository.findOne.mockResolvedValue({ id: 10, idCreador: 2 });

      // Act & Assert
      await expect(service.remove(10, 1)).rejects.toThrow(ForbiddenException);
    });

    it('debería eliminar el encuentro exitosamente', async () => {
      // Arrange
      const encuentro = { id: 10, idCreador: 1 };
      mockEncuentrosRepository.findOne.mockResolvedValue(encuentro);
      mockEncuentrosRepository.remove.mockResolvedValue(encuentro);

      // Act
      const result = await service.remove(10, 1);

      // Assert
      expect(mockEncuentrosRepository.remove).toHaveBeenCalledWith(encuentro);
      expect(result.success).toBe(true);
    });
  });

  describe('salirDelEncuentro', () => {
    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      mockEncuentrosRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.salirDelEncuentro(10, 1)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar ForbiddenException si el usuario creador intenta salir', async () => {
      // Arrange
      mockEncuentrosRepository.findOne.mockResolvedValue({ id: 10, idCreador: 1 });

      // Act & Assert
      await expect(service.salirDelEncuentro(10, 1)).rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar NotFoundException si el usuario no participa en el encuentro', async () => {
      // Arrange
      mockEncuentrosRepository.findOne.mockResolvedValue({ id: 10, idCreador: 2 }); // Usuario es 1
      mockParticipanteRepository.findOne.mockResolvedValue(null); // No participa

      // Act & Assert
      await expect(service.salirDelEncuentro(10, 1)).rejects.toThrow(NotFoundException);
    });

    it('debería eliminar la participación correctamente', async () => {
      // Arrange
      mockEncuentrosRepository.findOne.mockResolvedValue({ id: 10, idCreador: 2 });
      const participante = { idEncuentro: 10, idUsuario: 1 };
      mockParticipanteRepository.findOne.mockResolvedValue(participante);
      mockParticipanteRepository.remove.mockResolvedValue(participante);

      // Act
      const result = await service.salirDelEncuentro(10, 1);

      // Assert
      expect(mockParticipanteRepository.remove).toHaveBeenCalledWith(participante);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Has salido del encuentro correctamente');
    });
  });
});
