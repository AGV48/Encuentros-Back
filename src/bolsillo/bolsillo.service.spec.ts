import { Test, TestingModule } from '@nestjs/testing';
import { BolsilloService } from './bolsillo.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bolsillo } from './entities/bolsillo.entity';
import { DataSource, Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateBolsilloDto } from './dto/create-bolsillo.dto';
import { UpdateBolsilloDto } from './dto/update-bolsillo.dto';

describe('BolsilloService', () => {
  let service: BolsilloService;
  let bolsilloRepository: Repository<Bolsillo>;
  let dataSource: DataSource;

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
    bolsilloRepository = module.get<Repository<Bolsillo>>(getRepositoryToken(Bolsillo));
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un bolsillo exitosamente', async () => {
      const createBolsilloDto: CreateBolsilloDto = {
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 0,
      };
      const mockBolsillo = { id: 1, ...createBolsilloDto };
      mockBolsilloRepository.create.mockReturnValue(mockBolsillo);
      mockBolsilloRepository.save.mockResolvedValue(mockBolsillo);

      const result = await service.create(createBolsilloDto);
      expect(result).toEqual(mockBolsillo);
      expect(mockBolsilloRepository.create).toHaveBeenCalledWith(createBolsilloDto);
      expect(mockBolsilloRepository.save).toHaveBeenCalledWith(mockBolsillo);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los bolsillos', async () => {
      const mockBolsillos = [{ id: 1, nombre: 'Comida' }];
      mockBolsilloRepository.find.mockResolvedValue(mockBolsillos);
      const result = await service.findAll();
      expect(result).toEqual(mockBolsillos);
    });
  });

  describe('findOne', () => {
    it('debería obtener un bolsillo por ID', async () => {
      const mockBolsillo = { id: 1, nombre: 'Comida' };
      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      const result = await service.findOne(1);
      expect(result).toEqual(mockBolsillo);
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEncuentro', () => {
    it('debería obtener bolsillos por ID de encuentro', async () => {
      const idEncuentro = 1;
      const mockBolsillos = [{ id: 1, idEncuentro }];
      mockBolsilloRepository.find.mockResolvedValue(mockBolsillos);
      const result = await service.findByEncuentro(idEncuentro);
      expect(result).toEqual(mockBolsillos);
      expect(mockBolsilloRepository.find).toHaveBeenCalledWith({
        where: { idEncuentro },
        relations: ['presupuesto', 'encuentro'],
      });
    });

    it('debería retornar lista vacía si no hay bolsillos para el encuentro', async () => {
      mockBolsilloRepository.find.mockResolvedValue([]);
      const result = await service.findByEncuentro(999);
      expect(result).toEqual([]);
    });
  });

  describe('findByPresupuesto', () => {
    it('debería obtener bolsillos por ID de presupuesto', async () => {
      const idPresupuesto = 1;
      const mockBolsillos = [{ id: 1, idPresupuesto }];
      mockBolsilloRepository.find.mockResolvedValue(mockBolsillos);
      const result = await service.findByPresupuesto(idPresupuesto);
      expect(result).toEqual(mockBolsillos);
      expect(mockBolsilloRepository.find).toHaveBeenCalledWith({
        where: { idPresupuesto },
        relations: ['presupuesto', 'encuentro'],
      });
    });

    it('debería retornar lista vacía si no hay bolsillos para el presupuesto', async () => {
      mockBolsilloRepository.find.mockResolvedValue([]);
      const result = await service.findByPresupuesto(999);
      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('debería actualizar un bolsillo exitosamente', async () => {
      const updateBolsilloDto: UpdateBolsilloDto = { nombre: 'Comida Upd' };
      const mockBolsillo = { id: 1, nombre: 'Comida' };
      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockBolsilloRepository.save.mockResolvedValue({ ...mockBolsillo, ...updateBolsilloDto });

      const result = await service.update(1, updateBolsilloDto);
      expect(result.nombre).toBe('Comida Upd');
    });
  });

  describe('remove', () => {
    it('debería eliminar un bolsillo exitosamente', async () => {
      const id = 1;
      const idUsuario = 1;
      const mockBolsillo = { id: 1, idEncuentro: 1 };

      mockBolsilloRepository.findOne.mockResolvedValue(mockBolsillo);
      mockDataSource.query
        .mockResolvedValueOnce([{ id_creador: 1 }]) // creador
        .mockResolvedValueOnce([{ count: 0 }]); // 0 aportes

      mockBolsilloRepository.remove.mockResolvedValue(mockBolsillo);

      const result = await service.remove(id, idUsuario);
      expect(result.success).toBe(true);
      expect(mockBolsilloRepository.remove).toHaveBeenCalledWith(mockBolsillo);
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockDataSource.query.mockResolvedValueOnce([]); // Encuentro no encontrado
      await expect(service.remove(1, 1)).rejects.toThrow('Encuentro no encontrado');
    });

    it('debería lanzar ForbiddenException si el usuario no es creador', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockDataSource.query.mockResolvedValue([{ id_creador: 99 }]); // creador != 1
      await expect(service.remove(1, 1)).rejects.toThrow('Solo el creador puede eliminar bolsillos');
    });

    it('debería lanzar ForbiddenException si tiene aportes asociados', async () => {
      mockBolsilloRepository.findOne.mockResolvedValue({ id: 1, idEncuentro: 1 });
      mockDataSource.query
        .mockResolvedValueOnce([{ id_creador: 1 }])
        .mockResolvedValueOnce([{ count: 5 }]); // tiene aportes
      await expect(service.remove(1, 1)).rejects.toThrow('tiene aportes asociados');
    });
  });
});
