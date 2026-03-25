import { Test, TestingModule } from '@nestjs/testing';
import { AporteService } from './aporte.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Aporte } from './entities/aporte.entity';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CreateAporteDto } from './dto/create-aporte.dto';
import { UpdateAporteDto } from './dto/update-aporte.dto';

const mockAporteRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockDataSource = {
  createQueryRunner: jest.fn(),
};

describe('AporteService', () => {
  let service: AporteService;
  let aporteRepository: Repository<Aporte>;
  let dataSource: DataSource;

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un aporte exitosamente', async () => {
      // Arrange
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

      // Act
      const result = await service.create(createAporteDto);

      // Assert
      expect(result).toEqual(mockAporte);
      expect(mockAporteRepository.create).toHaveBeenCalledWith(createAporteDto);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los aportes', async () => {
      // Arrange
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

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockAportes);
      expect(mockAporteRepository.find).toHaveBeenCalledWith({
        relations: ['bolsillo', 'encuentro', 'usuario'],
      });
    });
  });

  describe('findByEncuentro', () => {
    it('debería obtener aportes por ID de encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const mockAportes = [
        {
          id: 1,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 1,
          monto: 250,
        },
        {
          id: 2,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 2,
          monto: 500,
        },
      ];

      mockAporteRepository.find.mockResolvedValue(mockAportes);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toEqual(mockAportes);
      expect(result).toHaveLength(2);
      expect(mockAporteRepository.find).toHaveBeenCalledWith({
        where: { idEncuentro },
        relations: ['bolsillo', 'usuario'],
      });
    });

    it('debería devolver lista vacía si no hay aportes', async () => {
      // Arrange
      const idEncuentro = 999;
      mockAporteRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findByBolsillo', () => {
    it('debería obtener aportes por ID de bolsillo', async () => {
      // Arrange
      const idBolsillo = 1;
      const mockAportes = [
        {
          id: 1,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 1,
          monto: 250,
        },
      ];

      mockAporteRepository.find.mockResolvedValue(mockAportes);

      // Act
      const result = await service.findByBolsillo(idBolsillo);

      // Assert
      expect(result).toEqual(mockAportes);
      expect(mockAporteRepository.find).toHaveBeenCalledWith({
        where: { idBolsillo },
        relations: ['usuario', 'encuentro'],
      });
    });
  });

  describe('findByUsuario', () => {
    it('debería obtener aportes por ID de usuario', async () => {
      // Arrange
      const idUsuario = 1;
      const mockAportes = [
        {
          id: 1,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 1,
          monto: 250,
        },
        {
          id: 2,
          idBolsillo: 2,
          idEncuentro: 2,
          idUsuario: 1,
          monto: 100,
        },
      ];

      mockAporteRepository.find.mockResolvedValue(mockAportes);

      // Act
      const result = await service.findByUsuario(idUsuario);

      // Assert
      expect(result).toEqual(mockAportes);
      expect(result).toHaveLength(2);
      expect(mockAporteRepository.find).toHaveBeenCalledWith({
        where: { idUsuario },
        relations: ['bolsillo', 'encuentro'],
      });
    });
  });

  describe('findOne', () => {
    it('debería obtener un aporte por ID', async () => {
      // Arrange
      const id = 1;
      const mockAporte = {
        id: 1,
        idBolsillo: 1,
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250,
        fechaAporte: new Date(),
      };

      mockAporteRepository.findOne.mockResolvedValue(mockAporte);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(result).toEqual(mockAporte);
      expect(mockAporteRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['bolsillo', 'encuentro', 'usuario'],
      });
    });

    it('debería devolver null si no existe', async () => {
      // Arrange
      const id = 999;
      mockAporteRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('debería actualizar un aporte exitosamente', async () => {
      // Arrange
      const id = 1;
      const updateAporteDto: UpdateAporteDto = {
        monto: 300,
      };

      const mockAporte = {
        id: 1,
        idBolsillo: 1,
        idEncuentro: 1,
        idUsuario: 1,
        monto: 300,
        fechaAporte: new Date(),
      };

      mockAporteRepository.update.mockResolvedValue({ affected: 1 });
      mockAporteRepository.findOne.mockResolvedValue(mockAporte);

      // Act
      const result = await service.update(id, updateAporteDto);

      // Assert
      expect(result).toEqual(mockAporte);
      expect(mockAporteRepository.update).toHaveBeenCalledWith(
        id,
        updateAporteDto,
      );
      expect(mockAporteRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('debería eliminar un aporte', async () => {
      // Arrange
      const id = 1;
      mockAporteRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.remove(id);

      // Assert
      expect(mockAporteRepository.delete).toHaveBeenCalledWith(id);
    });
  });

  describe('agregarAporte', () => {
    it('debería agregar un aporte con transacción', async () => {
      // Arrange
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

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id_aporte: 1 }]) // INSERT
          .mockResolvedValueOnce(undefined), // UPDATE
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockAporteRepository.findOne.mockResolvedValue(mockAporte);

      // Act
      const result = await service.agregarAporte(createAporteDto);

      // Assert
      expect(result).toEqual(mockAporte);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería validar que idBolsillo sea requerido', async () => {
      // Arrange
      const createAporteDto = {
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250.5,
      } as CreateAporteDto;

      // Act & Assert
      await expect(service.agregarAporte(createAporteDto)).rejects.toThrow();
      await expect(service.agregarAporte(createAporteDto)).rejects.toThrow(
        'Los campos idBolsillo e idUsuario son requeridos para agregar un aporte',
      );
    });

    it('debería validar que idUsuario sea requerido', async () => {
      // Arrange
      const createAporteDto = {
        idBolsillo: 1,
        idEncuentro: 1,
        monto: 250.5,
      } as CreateAporteDto;

      // Act & Assert
      await expect(service.agregarAporte(createAporteDto)).rejects.toThrow();
    });

    it('debería hacer rollback si hay error durante la transacción', async () => {
      // Arrange
      const createAporteDto: CreateAporteDto = {
        idBolsillo: 1,
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250.5,
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
      await expect(service.agregarAporte(createAporteDto)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('debería actualizar el saldo del bolsillo después de agregar aporte', async () => {
      // Arrange
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

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id_aporte: 1 }]) // INSERT
          .mockResolvedValueOnce(undefined), // UPDATE bolsillos
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockAporteRepository.findOne.mockResolvedValue(mockAporte);

      // Act
      await service.agregarAporte(createAporteDto);

      // Assert
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE bolsillos'),
        expect.arrayContaining([250.5, 1]),
      );
    });

    it('debería lanzar NotFoundException si no se puede crear el aporte', async () => {
      // Arrange
      const createAporteDto: CreateAporteDto = {
        idBolsillo: 1,
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250.5,
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        query: jest
          .fn()
          .mockResolvedValueOnce([{ id_aporte: 1 }])
          .mockResolvedValueOnce(undefined),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
      mockAporteRepository.findOne.mockResolvedValue(null); // No se encontró el aporte

      // Act & Assert
      await expect(service.agregarAporte(createAporteDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
