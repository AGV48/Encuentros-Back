import { Test, TestingModule } from '@nestjs/testing';
import { PresupuestoService } from './presupuesto.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Presupuesto } from './entities/presupuesto.entity';
import { ItemPresupuesto } from './entities/item-presupuesto.entity';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('PresupuestoService', () => {
  let service: PresupuestoService;

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
        { provide: getRepositoryToken(Presupuesto), useValue: mockPresupuestoRepository },
        { provide: getRepositoryToken(ItemPresupuesto), useValue: mockItemPresupuestoRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PresupuestoService>(PresupuestoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('Metodos CRR', () => {
    it('create', async () => {
      mockPresupuestoRepository.create.mockReturnValue({ id: 1 });
      mockPresupuestoRepository.save.mockResolvedValue({ id: 1 });
      expect(await service.create({} as any)).toEqual({ id: 1 });
    });
    it('findAll', async () => {
      mockPresupuestoRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findAll()).toEqual([{ id: 1 }]);
    });
    it('findOne o throw', async () => {
      mockPresupuestoRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);

      mockPresupuestoRepository.findOne.mockResolvedValue({ id: 1 });
      expect(await service.findOne(1)).toEqual({ id: 1 });
    });
    it('findByEncuentro', async () => {
      mockPresupuestoRepository.findOne.mockResolvedValue({ id: 1 });
      expect(await service.findByEncuentro(1)).toEqual({ id: 1 });
    });
    it('update', async () => {
      mockPresupuestoRepository.findOne.mockResolvedValue({ id: 1 });
      mockPresupuestoRepository.save.mockResolvedValue({ id: 1, a: 2 });
      expect(await service.update(1, { a: 2 } as any)).toHaveProperty('a', 2);
    });
    it('remove', async () => {
      mockPresupuestoRepository.findOne.mockResolvedValue({ id: 1 });
      mockPresupuestoRepository.remove.mockResolvedValue({ id: 1 });
      await service.remove(1);
      expect(mockPresupuestoRepository.remove).toHaveBeenCalled();
    });
  });

  describe('Transaccion: agregarItem', () => {
    it('debería insertar item, actualizar presupuesto y commit', async () => {
      // Arrange
      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_item: 10 }]) // INSERT
        .mockResolvedValueOnce([]); // UPDATE
      
      mockItemPresupuestoRepository.findOne.mockResolvedValue({ id: 10 });

      // Act
      const res = await service.agregarItem({
        idPresupuesto: 1,
        idEncuentro: 1,
        nombreItem: 'Carne',
        montoItem: 500
      });

      // Assert
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(res.id).toBe(10);
    });

    it('debería hacer rollback si falla insert', async () => {
      mockQueryRunner.query.mockRejectedValue(new Error('DB Fail'));

      await expect(service.agregarItem({} as any)).rejects.toThrow('DB Fail');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería lanzar NotFound si no retorna id', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ id_item: 10 }]).mockResolvedValueOnce([]);
      mockItemPresupuestoRepository.findOne.mockResolvedValue(null);

      await expect(service.agregarItem({} as any)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getItems', () => {
    it('retorna items', async () => {
      mockItemPresupuestoRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.getItems(1)).toEqual([{ id: 1 }]);
    });
  });

  describe('Transaccion: removeItem', () => {
    it('lanza NotFoundException si item no existe', async () => {
      mockItemPresupuestoRepository.findOne.mockResolvedValue(null);
      await expect(service.removeItem(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si encuentro no existe', async () => {
      mockItemPresupuestoRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockQueryRunner.query.mockResolvedValue([]); // Nada

      await expect(service.removeItem(1, 1)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('lanza NotFoundException si no es creador', async () => {
      mockItemPresupuestoRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockQueryRunner.query.mockResolvedValue([{ id_creador: 99 }]); 

      await expect(service.removeItem(1, 1)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('efectua validacion, actualizacion, elminacion y hace commit', async () => {
      mockItemPresupuestoRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1, montoItem: 50, idPresupuesto: 1 });
      
      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_creador: 1 }]) // SELECT
        .mockResolvedValueOnce([]) // UPDATE
        .mockResolvedValueOnce([]); // DELETE

      const res = await service.removeItem(1, 1);
      
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
      expect(res.success).toBe(true);
    });
  });
});
