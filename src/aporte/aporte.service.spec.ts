import { Test, TestingModule } from '@nestjs/testing';
import { AporteService } from './aporte.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Aporte } from './entities/aporte.entity';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('AporteService', () => {
  let service: AporteService;

  const mockAporteRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
        AporteService,
        { provide: getRepositoryToken(Aporte), useValue: mockAporteRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AporteService>(AporteService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('Métodos básicos de repositorio', () => {
    it('create', async () => {
      mockAporteRepository.create.mockReturnValue({ id: 1 });
      mockAporteRepository.save.mockResolvedValue({ id: 1 });
      expect(await service.create({} as any)).toEqual({ id: 1 });
    });
    it('findAll', async () => {
      mockAporteRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findAll()).toEqual([{ id: 1 }]);
    });
    it('findByEncuentro', async () => {
      mockAporteRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findByEncuentro(1)).toEqual([{ id: 1 }]);
    });
    it('findByBolsillo', async () => {
      mockAporteRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findByBolsillo(1)).toEqual([{ id: 1 }]);
    });
    it('findByUsuario', async () => {
      mockAporteRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findByUsuario(1)).toEqual([{ id: 1 }]);
    });
    it('findOne', async () => {
      mockAporteRepository.findOne.mockResolvedValue({ id: 1 });
      expect(await service.findOne(1)).toEqual({ id: 1 });
    });
    it('update', async () => {
      mockAporteRepository.update.mockResolvedValue({});
      mockAporteRepository.findOne.mockResolvedValue({ id: 1, val: 'upd' });
      expect(await service.update(1, { val: 'upd' } as any)).toEqual({ id: 1, val: 'upd' });
    });
    it('remove', async () => {
      mockAporteRepository.delete.mockResolvedValue({});
      await service.remove(1);
      expect(mockAporteRepository.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('agregarAporte (Transacción)', () => {
    it('debería lanzar error si falta idBolsillo o idUsuario', async () => {
      await expect(service.agregarAporte({ idEncuentro: 1, monto: 100 } as any)).rejects.toThrow('requeridos');
    });

    it('debería realizar insert, update, commit y retornar objeto', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_aporte: 10 }]) // INSERT
        .mockResolvedValueOnce([]); // UPDATE

      mockAporteRepository.findOne.mockResolvedValue({ id: 10, monto: 100 });

      const res = await service.agregarAporte({ idBolsillo: 1, idUsuario: 1, idEncuentro: 1, monto: 100 });
      
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(res.id).toBe(10);
    });

    it('debería hacer rollback si findOne falla al no encontrar el item tras el commit', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ id_aporte: 10 }]).mockResolvedValueOnce([]);
      mockAporteRepository.findOne.mockResolvedValue(null);

      await expect(service.agregarAporte({ idBolsillo: 1, idUsuario: 1, monto: 100 } as any))
        .rejects.toThrow(NotFoundException);
      
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería hacer rollback ante excepción en query', async () => {
      mockQueryRunner.query.mockRejectedValue(new Error('SQL Error'));

      await expect(service.agregarAporte({ idBolsillo: 1, idUsuario: 1, monto: 100 } as any))
        .rejects.toThrow('SQL Error');
      
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
