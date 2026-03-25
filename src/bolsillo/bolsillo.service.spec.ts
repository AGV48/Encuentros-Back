import { Test, TestingModule } from '@nestjs/testing';
import { BolsilloService } from './bolsillo.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bolsillo } from './entities/bolsillo.entity';
import { DataSource, Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateBolsilloDto } from './dto/create-bolsillo.dto';
import { UpdateBolsilloDto } from './dto/update-bolsillo.dto';

const mockBolsilloRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
};

describe('BolsilloService', () => {
  let service: BolsilloService;
  let bolsilloRepository: Repository<Bolsillo>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BolsilloService,
        {
          provide: getRepositoryToken(Bolsillo),
          useValue: mockBolsilloRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BolsilloService>(BolsilloService);
    bolsilloRepository = module.get<Repository<Bolsillo>>(
      getRepositoryToken(Bolsillo),
    );
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
    mockBolsilloRepository.find.mockReset();
    mockBolsilloRepository.findOne.mockReset();
    mockBolsilloRepository.create.mockReset();
    mockBolsilloRepository.save.mockReset();
    mockBolsilloRepository.remove.mockReset();
    mockDataSource.query.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un bolsillo exitosamente', async () => {
      // Arrange
      const createBolsilloDto: CreateBolsilloDto = {
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 0,
      };

      const mockBolsillo = {
        id: 1,
        ...createBolsilloDto,
      };

      mockBolsilloRepository.create.mockReturnValue(mockBolsillo);
      mockBolsilloRepository.save.mockResolvedValue(mockBolsillo);

      // Act
      const result = await service.create(createBolsilloDto);

      // Assert
      expect(result).toEqual(mockBolsillo);
      expect(mockBolsilloRepository.create).toHaveBeenCalledWith(
        createBolsilloDto,
      );
      expect(mockBolsilloRepository.save).toHaveBeenCalledWith(mockBolsillo);
    });

    it('debería crear bolsillo con presupuesto opcional', async () => {
      // Arrange
      const createBolsilloDto: CreateBolsilloDto = {
        idPresupuesto: 1,
        idEncuentro: 1,
        nombre: 'Presupuestado',
      };

      const mockBolsillo = {
        id: 1,
        ...createBolsilloDto,
        saldoActual: 0,
      };

      mockBolsilloRepository.create.mockReturnValue(mockBolsillo);
      mockBolsilloRepository.save.mockResolvedValue(mockBolsillo);

      // Act
      const result = await service.create(createBolsilloDto);

      // Assert
      expect(result.idPresupuesto).toBe(1);
      expect(mockBolsilloRepository.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los bolsillos', async () => {
      // Arrange
      const mockBolsillos = [
        {
          id: 1,
          idEncuentro: 1,
          nombre: 'Comida',
          saldoActual: 500,
        },
      ];

      mockBolsilloRepository.find.mockResolvedValue(mockBolsillos);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockBolsillos);
      expect(mockBolsilloRepository.find).toHaveBeenCalledWith({
        relations: ['presupuesto', 'encuentro'],
      });
    });
  });

  describe('findOne', () => {
    it('debería obtener un bolsillo por ID', async () => {
      // Arrange
      const id = 1;
      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(result).toEqual(mockBolsillo);
      expect(mockBolsilloRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['presupuesto', 'encuentro'],
      });
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = 999;
      mockBolsilloRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(id)).rejects.toThrow(
        `Bolsillo con ID ${id} no encontrado`,
      );
    });
  });

  describe('findByEncuentro', () => {
    it('debería obtener bolsillos por ID de encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const mockBolsillos = [
        {
          id: 1,
          idEncuentro: 1,
          nombre: 'Comida',
          saldoActual: 500,
        },
        {
          id: 2,
          idEncuentro: 1,
          nombre: 'Transporte',
          saldoActual: 200,
        },
      ];

      mockBolsilloRepository.find.mockResolvedValue(mockBolsillos);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toEqual(mockBolsillos);
      expect(result).toHaveLength(2);
      expect(mockBolsilloRepository.find).toHaveBeenCalledWith({
        where: { idEncuentro },
        relations: ['presupuesto', 'encuentro'],
      });
    });

    it('debería devolver lista vacía si no hay bolsillos', async () => {
      // Arrange
      const idEncuentro = 999;
      mockBolsilloRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findByPresupuesto', () => {
    it('debería obtener bolsillos por ID de presupuesto', async () => {
      // Arrange
      const idPresupuesto = 1;
      const mockBolsillos = [
        {
          id: 1,
          idPresupuesto: 1,
          idEncuentro: 1,
          nombre: 'Comida',
          saldoActual: 500,
        },
      ];

      mockBolsilloRepository.find.mockResolvedValue(mockBolsillos);

      // Act
      const result = await service.findByPresupuesto(idPresupuesto);

      // Assert
      expect(result).toEqual(mockBolsillos);
      expect(mockBolsilloRepository.find).toHaveBeenCalledWith({
        where: { idPresupuesto },
        relations: ['presupuesto', 'encuentro'],
      });
    });
  });

  describe('update', () => {
    it('debería actualizar un bolsillo exitosamente', async () => {
      // Arrange
      const id = 1;
      const updateBolsilloDto: UpdateBolsilloDto = {
        nombre: 'Comida Actualizada',
      };

      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockBolsilloRepository.save.mockResolvedValue({
        ...mockBolsillo,
        nombre: 'Comida Actualizada',
      });

      // Act
      const result = await service.update(id, updateBolsilloDto);

      // Assert
      expect(result.nombre).toBe('Comida Actualizada');
      expect(mockBolsilloRepository.save).toHaveBeenCalled();
    });

    it('debería actualizar saldo del bolsillo', async () => {
      // Arrange
      const id = 1;
      const updateBolsilloDto: UpdateBolsilloDto = {
        saldoActual: 750,
      };

      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockBolsilloRepository.save.mockResolvedValue({
        ...mockBolsillo,
        saldoActual: 750,
      });

      // Act
      const result = await service.update(id, updateBolsilloDto);

      // Assert
      expect(result.saldoActual).toBe(750);
    });
  });

  describe('remove', () => {
    it('debería eliminar un bolsillo exitosamente', async () => {
      // Arrange
      const id = 1;
      const idUsuario = 1;

      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockDataSource.query
        .mockResolvedValueOnce([{ id_creador: 1 }]) // SELECT id_creador
        .mockResolvedValueOnce([{ count: 0 }]); // SELECT COUNT aportes
      mockBolsilloRepository.remove.mockResolvedValue(mockBolsillo);

      // Act
      const result = await service.remove(id, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(mockBolsilloRepository.remove).toHaveBeenCalledWith(mockBolsillo);
    });

    it('debería lanzar NotFoundException si el bolsillo no existe', async () => {
      // Arrange
      const id = 999;
      const idUsuario = 1;

      mockBolsilloRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(id, idUsuario)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const id = 1;
      const idUsuario = 1;

      const mockBolsillo = {
        id: 1,
        idEncuentro: 999,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockDataSource.query.mockResolvedValueOnce([]); // Encuentro no existe

      // Act & Assert
      await expect(service.remove(id, idUsuario)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(id, idUsuario)).rejects.toThrow(
        'Encuentro no encontrado',
      );
    });

    it('debería lanzar ForbiddenException si no es el creador del encuentro', async () => {
      // Arrange
      const id = 1;
      const idUsuario = 2; // Diferente al creador

      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockDataSource.query.mockResolvedValue([{ id_creador: 1 }]); // Creador es 1

      // Act & Assert
      await expect(service.remove(id, idUsuario)).rejects.toThrow(
        'Solo el creador puede eliminar bolsillos',
      );
    });

    it('debería lanzar ForbiddenException si tiene aportes asociados', async () => {
      // Arrange
      const id = 1;
      const idUsuario = 1;

      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockDataSource.query.mockImplementation((query: string) => {
        if (query.includes('SELECT id_creador')) {
          return Promise.resolve([{ id_creador: 1 }]);
        }
        if (query.includes('SELECT COUNT')) {
          return Promise.resolve([{ count: 3 }]);
        }
      });

      // Act & Assert
      await expect(service.remove(id, idUsuario)).rejects.toThrow(
        'No se puede eliminar el bolsillo porque tiene aportes asociados',
      );
    });
  });
});
