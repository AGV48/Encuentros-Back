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

describe('PresupuestoService', () => {
  let service: PresupuestoService;
  let presupuestoRepository: Repository<Presupuesto>;
  let itemRepository: Repository<ItemPresupuesto>;
  let dataSource: DataSource;

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

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

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
    presupuestoRepository = module.get<Repository<Presupuesto>>(getRepositoryToken(Presupuesto));
    itemRepository = module.get<Repository<ItemPresupuesto>>(getRepositoryToken(ItemPresupuesto));
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un presupuesto', async () => {
      const dto: CreatePresupuestoDto = { idEncuentro: 1 };
      mockPresupuestoRepository.create.mockReturnValue({ id: 1, ...dto });
      mockPresupuestoRepository.save.mockResolvedValue({ id: 1, ...dto });
      const result = await service.create(dto);
      expect(result.id).toBe(1);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los presupuestos', async () => {
      mockPresupuestoRepository.find.mockResolvedValue([]);
      expect(await service.findAll()).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('debería lanzar NotFound si no existe', async () => {
      mockPresupuestoRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('agregarItem', () => {
    it('debería agregar un item con transacción', async () => {
      const dto: CreateItemPresupuestoDto = { idPresupuesto: 1, idEncuentro: 1, nombreItem: 'Carne', montoItem: 500 };
      mockQueryRunner.query.mockResolvedValueOnce([{ id_item: 10 }]).mockResolvedValueOnce([]);
      mockItemPresupuestoRepository.findOne.mockResolvedValue({ id: 10, ...dto });

      const result = await service.agregarItem(dto);
      expect(result.id).toBe(10);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('debería eliminar un item con transacción', async () => {
      mockItemPresupuestoRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1, montoItem: 100, idPresupuesto: 1 });
      // Necesita 3 queries: SELECT creador, UPDATE presupuesto, DELETE item
      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_creador: 1 }]) 
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.removeItem(1, 1);
      expect(result.success).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
