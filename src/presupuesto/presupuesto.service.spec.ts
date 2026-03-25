import { Test, TestingModule } from '@nestjs/testing';
import { PresupuestoService } from './presupuesto.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Presupuesto } from './entities/presupuesto.entity';
import { ItemPresupuesto } from './entities/item-presupuesto.entity';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto';
import { CreateItemPresupuestoDto } from './dto/create-item-presupuesto.dto';

const mockPresupuestoRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockItemPresupuestoRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

const mockDataSource = {
  createQueryRunner: jest.fn(),
};

describe('PresupuestoService', () => {
  let service: PresupuestoService;
  let presupuestoRepository: Repository<Presupuesto>;
  let itemRepository: Repository<ItemPresupuesto>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresupuestoService,
        {
          provide: getRepositoryToken(Presupuesto),
          useValue: mockPresupuestoRepository,
        },
        {
          provide: getRepositoryToken(ItemPresupuesto),
          useValue: mockItemPresupuestoRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<PresupuestoService>(PresupuestoService);
    presupuestoRepository = module.get<Repository<Presupuesto>>(
      getRepositoryToken(Presupuesto),
    );
    itemRepository = module.get<Repository<ItemPresupuesto>>(
      getRepositoryToken(ItemPresupuesto),
    );
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un presupuesto exitosamente', async () => {
      // Arrange
      const createPresupuestoDto: CreatePresupuestoDto = {
        idEncuentro: 1,
      };

      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 0,
      };

      mockPresupuestoRepository.create.mockReturnValue(mockPresupuesto);
      mockPresupuestoRepository.save.mockResolvedValue(mockPresupuesto);

      // Act
      const result = await service.create(createPresupuestoDto);

      // Assert
      expect(result).toEqual(mockPresupuesto);
      expect(mockPresupuestoRepository.create).toHaveBeenCalledWith(
        createPresupuestoDto,
      );
      expect(mockPresupuestoRepository.save).toHaveBeenCalledWith(mockPresupuesto);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los presupuestos', async () => {
      // Arrange
      const mockPresupuestos = [
        {
          id: 1,
          idEncuentro: 1,
          presupuestoTotal: 1000,
          items: [],
        },
      ];

      mockPresupuestoRepository.find.mockResolvedValue(mockPresupuestos);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockPresupuestos);
      expect(mockPresupuestoRepository.find).toHaveBeenCalledWith({
        relations: ['encuentro', 'items'],
      });
    });
  });

  describe('findOne', () => {
    it('debería obtener un presupuesto por ID', async () => {
      // Arrange
      const id = 1;
      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 1000,
        items: [],
      };

      mockPresupuestoRepository.findOne.mockResolvedValue(mockPresupuesto);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(result).toEqual(mockPresupuesto);
      expect(mockPresupuestoRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['encuentro', 'items'],
      });
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = 999;
      mockPresupuestoRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(id)).rejects.toThrow(
        `Presupuesto con ID ${id} no encontrado`,
      );
    });
  });

  describe('findByEncuentro', () => {
    it('debería obtener presupuesto por ID de encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 1000,
        items: [],
      };

      mockPresupuestoRepository.findOne.mockResolvedValue(mockPresupuesto);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toEqual(mockPresupuesto);
      expect(mockPresupuestoRepository.findOne).toHaveBeenCalledWith({
        where: { idEncuentro },
        relations: ['encuentro', 'items'],
      });
    });

    it('debería devolver null si no existe presupuesto para el encuentro', async () => {
      // Arrange
      const idEncuentro = 999;
      mockPresupuestoRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('debería actualizar un presupuesto exitosamente', async () => {
      // Arrange
      const id = 1;
      const updatePresupuestoDto: UpdatePresupuestoDto = {};

      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 1000,
        items: [],
      };

      mockPresupuestoRepository.findOne.mockResolvedValue(mockPresupuesto);
      mockPresupuestoRepository.save.mockResolvedValue({
        ...mockPresupuesto,
        presupuestoTotal: 5000,
      });

      // Act
      const result = await service.update(id, updatePresupuestoDto);

      // Assert
      expect(result.presupuestoTotal).toBe(5000);
      expect(mockPresupuestoRepository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('debería eliminar un presupuesto', async () => {
      // Arrange
      const id = 1;
      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 1000,
      };

      mockPresupuestoRepository.findOne.mockResolvedValue(mockPresupuesto);
      mockPresupuestoRepository.remove.mockResolvedValue(mockPresupuesto);

      // Act
      await service.remove(id);

      // Assert
      expect(mockPresupuestoRepository.remove).toHaveBeenCalledWith(mockPresupuesto);
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = 999;
      mockPresupuestoRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('agregarItem', () => {
    it('debería agregar un item exitosamente', async () => {
      // Arrange
      const createItemDto: CreateItemPresupuestoDto = {
        idPresupuesto: 1,
        idEncuentro: 1,
        nombreItem: 'Comida',
        montoItem: 250.5,
      };

      const mockItem = {
        id: 1,
        ...createItemDto,
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id_item: 1 }]) // INSERT
          .mockResolvedValueOnce(undefined), // UPDATE
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockItemPresupuestoRepository.findOne.mockResolvedValue(mockItem);

      // Act
      const result = await service.agregarItem(createItemDto);

      // Assert
      expect(result).toEqual(mockItem);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería hacer rollback si hay error al agregar item', async () => {
      // Arrange
      const createItemDto: CreateItemPresupuestoDto = {
        idPresupuesto: 1,
        idEncuentro: 1,
        nombreItem: 'Comida',
        montoItem: 250.5,
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest.fn().mockRejectedValue(new Error('DB Error')),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      // Act & Assert
      await expect(service.agregarItem(createItemDto)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getItems', () => {
    it('debería obtener items de un presupuesto', async () => {
      // Arrange
      const idPresupuesto = 1;
      const mockItems = [
        {
          id: 1,
          idPresupuesto: 1,
          nombreItem: 'Comida',
          montoItem: 250,
        },
        {
          id: 2,
          idPresupuesto: 1,
          nombreItem: 'Bebidas',
          montoItem: 100,
        },
      ];

      mockItemPresupuestoRepository.find.mockResolvedValue(mockItems);

      // Act
      const result = await service.getItems(idPresupuesto);

      // Assert
      expect(result).toEqual(mockItems);
      expect(result).toHaveLength(2);
      expect(mockItemPresupuestoRepository.find).toHaveBeenCalledWith({
        where: { idPresupuesto },
        order: { id: 'ASC' },
      });
    });

    it('debería devolver lista vacía si no hay items', async () => {
      // Arrange
      const idPresupuesto = 999;
      mockItemPresupuestoRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getItems(idPresupuesto);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('removeItem', () => {
    it('debería eliminar un item exitosamente', async () => {
      // Arrange
      const idItem = 1;
      const idUsuario = 1;

      const mockItem = {
        id: 1,
        idPresupuesto: 1,
        idEncuentro: 1,
        nombreItem: 'Comida',
        montoItem: 250,
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id_creador: 1 }]) // SELECT id_creador
          .mockResolvedValueOnce(undefined), // UPDATE presupuestos
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockItemPresupuestoRepository.findOne.mockResolvedValue(mockItem);
      mockItemPresupuestoRepository.remove.mockResolvedValue(mockItem);

      // Act
      const result = await service.removeItem(idItem, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el item no existe', async () => {
      // Arrange
      const idItem = 999;
      const idUsuario = 1;

      mockItemPresupuestoRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.removeItem(idItem, idUsuario)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
