import { Test, TestingModule } from '@nestjs/testing';
import { AporteService } from './aporte.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Aporte } from './entities/aporte.entity';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CreateAporteDto } from './dto/create-aporte.dto';
import { UpdateAporteDto } from './dto/update-aporte.dto';

describe('AporteService', () => {
  let service: AporteService;
  let aporteRepository: Repository<Aporte>;
  let dataSource: DataSource;

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
        {
          provide: getRepositoryToken(Aporte),
          useValue: mockAporteRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AporteService>(AporteService);
    aporteRepository = module.get<Repository<Aporte>>(getRepositoryToken(Aporte));
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
    it('debería crear un aporte exitosamente', async () => {
      const createAporteDto: CreateAporteDto = {
        idBolsillo: 1,
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250.5,
      };
      const mockAporte = {
        id: 1,
        ...createAporteDto,
        fechaAporte: new Date(),
      };
      mockAporteRepository.create.mockReturnValue(mockAporte);
      mockAporteRepository.save.mockResolvedValue(mockAporte);

      const result = await service.create(createAporteDto);
      expect(result).toEqual(mockAporte);
      expect(mockAporteRepository.create).toHaveBeenCalledWith(createAporteDto);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los aportes', async () => {
      const mockAportes = [
        {
          id: 1,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 1,
          monto: 250,
          fechaAporte: new Date(),
        },
      ];
      mockAporteRepository.find.mockResolvedValue(mockAportes);
      const result = await service.findAll();
      expect(result).toEqual(mockAportes);
    });
  });

  describe('findByEncuentro', () => {
    it('debería obtener aportes por ID de encuentro', async () => {
      const idEncuentro = 1;
      const mockAportes = [{ id: 1, idEncuentro }];
      mockAporteRepository.find.mockResolvedValue(mockAportes);
      const result = await service.findByEncuentro(idEncuentro);
      expect(result).toEqual(mockAportes);
    });
  });

  describe('findByBolsillo', () => {
    it('debería obtener aportes por ID de bolsillo', async () => {
      const idBolsillo = 1;
      const mockAportes = [{ id: 1, idBolsillo }];
      mockAporteRepository.find.mockResolvedValue(mockAportes);
      const result = await service.findByBolsillo(idBolsillo);
      expect(result).toEqual(mockAportes);
      expect(mockAporteRepository.find).toHaveBeenCalledWith({
        where: { idBolsillo },
        relations: ['usuario', 'encuentro'],
      });
    });
  });

  describe('findByUsuario', () => {
    it('debería obtener aportes por ID de usuario', async () => {
      const idUsuario = 1;
      const mockAportes = [{ id: 1, idUsuario }];
      mockAporteRepository.find.mockResolvedValue(mockAportes);
      const result = await service.findByUsuario(idUsuario);
      expect(result).toEqual(mockAportes);
      expect(mockAporteRepository.find).toHaveBeenCalledWith({
        where: { idUsuario },
        relations: ['bolsillo', 'encuentro'],
      });
    });
  });

  describe('findOne', () => {
    it('debería obtener un aporte por ID', async () => {
      const mockAporte = { id: 1 };
      mockAporteRepository.findOne.mockResolvedValue(mockAporte);
      const result = await service.findOne(1);
      expect(result).toEqual(mockAporte);
    });
    it('debería devolver null si no existe', async () => {
      mockAporteRepository.findOne.mockResolvedValue(null);
      expect(await service.findOne(999)).toBeNull();
    });
  });

  describe('update', () => {
    it('debería actualizar un aporte exitosamente', async () => {
      const updateAporteDto: UpdateAporteDto = { monto: 300 };
      const mockAporte = { id: 1, monto: 300 };
      mockAporteRepository.update.mockResolvedValue({ affected: 1 });
      mockAporteRepository.findOne.mockResolvedValue(mockAporte);

      const result = await service.update(1, updateAporteDto);
      expect(result.monto).toBe(300);
    });
  });

  describe('remove', () => {
    it('debería eliminar un aporte', async () => {
      mockAporteRepository.delete.mockResolvedValue({ affected: 1 });
      await service.remove(1);
      expect(mockAporteRepository.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('agregarAporte', () => {
    it('debería agregar un aporte con transacción', async () => {
      const createAporteDto: CreateAporteDto = {
        idBolsillo: 1,
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250.5,
      };
      const mockAporte = { id: 1, ...createAporteDto, fechaAporte: new Date() };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ id_aporte: 1 }]) // INSERT
        .mockResolvedValueOnce(undefined); // UPDATE
      mockAporteRepository.findOne.mockResolvedValue(mockAporte);

      const result = await service.agregarAporte(createAporteDto);
      expect(result).toEqual(mockAporte);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería validar que idBolsillo e idUsuario sean requeridos', async () => {
      await expect(service.agregarAporte({ idEncuentro: 1 } as any)).rejects.toThrow();
    });

    it('debería hacer rollback si hay error durante la transacción', async () => {
      mockQueryRunner.query.mockRejectedValue(new Error('DB Error'));
      await expect(service.agregarAporte({ idBolsillo: 1, idUsuario: 1, monto: 100 } as any)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si no se puede encontrar el aporte tras crearlo', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ id_aporte: 1 }]).mockResolvedValueOnce(undefined);
      mockAporteRepository.findOne.mockResolvedValue(null);
      await expect(service.agregarAporte({ idBolsillo: 1, idUsuario: 1, monto: 100 } as any)).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
