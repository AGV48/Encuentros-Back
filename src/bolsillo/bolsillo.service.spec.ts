import { Test, TestingModule } from '@nestjs/testing';
import { BolsilloService } from './bolsillo.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bolsillo } from './entities/bolsillo.entity';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BolsilloService', () => {
  let service: BolsilloService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BolsilloService,
        { provide: getRepositoryToken(Bolsillo), useValue: mockBolsilloRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BolsilloService>(BolsilloService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('Métodos Base (CRUD)', () => {
    it('create', async () => {
      mockBolsilloRepository.create.mockReturnValue({ id: 1 });
      mockBolsilloRepository.save.mockResolvedValue({ id: 1 });
      expect(await service.create({} as any)).toEqual({ id: 1 });
    });
    it('findAll', async () => {
      mockBolsilloRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findAll()).toEqual([{ id: 1 }]);
    });
    it('findOne - ok', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1 });
      expect(await service.findOne(1)).toEqual({ id: 1 });
    });
    it('findOne - fail', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
    it('findByEncuentro', async () => {
      mockBolsilloRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findByEncuentro(1)).toEqual([{ id: 1 }]);
    });
    it('findByPresupuesto', async () => {
      mockBolsilloRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findByPresupuesto(1)).toEqual([{ id: 1 }]);
    });
    it('update', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1 });
      mockBolsilloRepository.save.mockResolvedValue({ id: 1, a: 2 });
      expect(await service.update(1, { a: 2 } as any)).toHaveProperty('a', 2);
    });
  });

  describe('remove (Validaciones complejas)', () => {
    it('lanza NotFoundException si no existe el encuentro', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockDataSource.query.mockResolvedValue([]); // No retorna encuentro
      
      await expect(service.remove(1, 1)).rejects.toThrow('Encuentro no encontrado');
    });

    it('lanza ForbiddenException si el usuario no es creador del encuentro', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockDataSource.query.mockResolvedValue([{ id_creador: 99 }]); // creador != 1
      
      await expect(service.remove(1, 1)).rejects.toThrow('Solo el creador puede eliminar bolsillos');
    });

    it('lanza ForbiddenException si el bolsillo tiene aportes asociados', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockDataSource.query
        .mockResolvedValueOnce([{ id_creador: 1 }]) // SELECT encuentro
        .mockResolvedValueOnce([{ count: 5 }]); // SELECT count aportes (5 aportes)
      
      await expect(service.remove(1, 1)).rejects.toThrow('tiene aportes asociados');
    });

    it('elimina el bolsillo correctamente si no tiene aportes y es el creador', async () => {
      const mockBolsillo = { id: 1, idEncuentro: 1 };
      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockDataSource.query
        .mockResolvedValueOnce([{ id_creador: 1 }]) // Creador es 1
        .mockResolvedValueOnce([{ count: 0 }]); // 0 aportes

      mockBolsilloRepository.remove.mockResolvedValue(mockBolsillo);

      const result = await service.remove(1, 1);
      expect(mockBolsilloRepository.remove).toHaveBeenCalledWith(mockBolsillo);
      expect(result.success).toBe(true);
    });
  });
});
