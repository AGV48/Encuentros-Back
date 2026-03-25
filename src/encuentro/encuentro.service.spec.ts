import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroService } from './encuentro.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Encuentro } from './entities/encuentro.entity';
import { EncuentroResumen } from './entities/encuentro-resumen.entity';
import { ParticipanteEncuentro } from '../participantes-encuentro/entities/participante-encuentro.entity';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateEncuentroDto } from './dto/create-encuentro.dto';
import { UpdateEncuentroDto } from './dto/update-encuentro.dto';

// Mocks
const mockEncuentroRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
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

describe('EncuentroService', () => {
  let service: EncuentroService;
  let encuentroRepository: Repository<Encuentro>;
  let participanteRepository: Repository<ParticipanteEncuentro>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncuentroService,
        {
          provide: getRepositoryToken(Encuentro),
          useValue: mockEncuentroRepository,
        },
        {
          provide: getRepositoryToken(EncuentroResumen),
          useValue: mockEncuentroResumenRepository,
        },
        {
          provide: getRepositoryToken(ParticipanteEncuentro),
          useValue: mockParticipanteRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<EncuentroService>(EncuentroService);
    encuentroRepository = module.get<Repository<Encuentro>>(
      getRepositoryToken(Encuentro),
    );
    participanteRepository = module.get<Repository<ParticipanteEncuentro>>(
      getRepositoryToken(ParticipanteEncuentro),
    );
    dataSource = module.get<DataSource>(DataSource);

    // Limpiar mocks antes de cada prueba
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un encuentro exitosamente', async () => {
      // Arrange
      const createEncuentroDto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción test',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000), // Mañana
      };

      const mockEncuentro = {
        id: 1,
        ...createEncuentroDto,
      };

      mockEncuentroRepository.create.mockReturnValue(mockEncuentro);
      mockEncuentroRepository.save.mockResolvedValue(mockEncuentro);
      mockDataSource.query.mockResolvedValue([]);

      // Act
      const result = await service.create(createEncuentroDto);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEncuentroRepository.create).toHaveBeenCalledWith({
        idCreador: createEncuentroDto.idCreador,
        titulo: createEncuentroDto.titulo,
        descripcion: createEncuentroDto.descripcion,
        lugar: createEncuentroDto.lugar,
        fecha: expect.any(Date),
      });
      expect(mockEncuentroRepository.save).toHaveBeenCalledWith(mockEncuentro);
      expect(mockDataSource.query).toHaveBeenCalledTimes(2); // SQL para participante e inserciones
    });

    it('debería lanzar BadRequestException si la fecha es pasada', async () => {
      // Arrange
      const createEncuentroDto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Pasado',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() - 86400000), // Ayer
      };

      // Act & Assert
      await expect(service.create(createEncuentroDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createEncuentroDto)).rejects.toThrow(
        'La fecha del encuentro no puede ser anterior a la fecha actual',
      );
    });

    it('debería insertar al creador como participante', async () => {
      // Arrange
      const createEncuentroDto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción test',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      const mockEncuentro = {
        id: 1,
        ...createEncuentroDto,
      };

      mockEncuentroRepository.create.mockReturnValue(mockEncuentro);
      mockEncuentroRepository.save.mockResolvedValue(mockEncuentro);
      mockDataSource.query.mockResolvedValue([]);

      // Act
      await service.create(createEncuentroDto);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO participantes_encuentro'),
        [mockEncuentro.id, createEncuentroDto.idCreador],
      );
    });

    it('debería crear presupuesto asociado al encuentro', async () => {
      // Arrange
      const createEncuentroDto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción test',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      const mockEncuentro = {
        id: 1,
        ...createEncuentroDto,
      };

      mockEncuentroRepository.create.mockReturnValue(mockEncuentro);
      mockEncuentroRepository.save.mockResolvedValue(mockEncuentro);
      mockDataSource.query.mockResolvedValue([]);

      // Act
      await service.create(createEncuentroDto);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO presupuestos'),
        [mockEncuentro.id],
      );
    });

    it('debería manejar errores en la creación', async () => {
      // Arrange
      const createEncuentroDto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción test',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.create.mockReturnValue(createEncuentroDto);
      mockEncuentroRepository.save.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(service.create(createEncuentroDto)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los encuentros sin filtro', async () => {
      // Arrange
      const mockEncuentros = [
        {
          id: 1,
          idCreador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          fechaCreacion: new Date(),
        },
      ];

      mockEncuentroRepository.find.mockResolvedValue(mockEncuentros);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockEncuentros);
      expect(mockEncuentroRepository.find).toHaveBeenCalled();
    });

    it('debería filtrar encuentros por creador', async () => {
      // Arrange
      const creadorId = 1;
      const mockResult = [
        {
          id_encuentro: 1,
          id_creador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          fecha_creacion: new Date(),
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAll(creadorId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].idCreador).toBe(1);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.id_creador'),
        [creadorId, creadorId],
      );
    });

    it('debería normalizar propiedades a camelCase', async () => {
      // Arrange
      const creadorId = 1;
      const mockResult = [
        {
          id_encuentro: 1,
          id_creador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          fecha_creacion: new Date(),
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAll(creadorId);

      // Assert
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('idCreador');
      expect(result[0]).toHaveProperty('fechaCreacion');
      expect(result[0]).not.toHaveProperty('id_encuentro');
      expect(result[0]).not.toHaveProperty('id_creador');
    });

    it('debería devolver lista vacía cuando no hay encuentros', async () => {
      // Arrange
      const creadorId = 999;
      mockDataSource.query.mockResolvedValue([]);

      // Act
      const result = await service.findAll(creadorId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('debería obtener un encuentro por ID', async () => {
      // Arrange
      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro 1',
        descripcion: 'Descripción 1',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(result).toEqual(mockEncuentro);
      expect(mockEncuentroRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('debería devolver null si el encuentro no existe', async () => {
      // Arrange
      mockEncuentroRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findOne(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findAllWithResumen', () => {
    it('debería obtener encuentros con resumen sin filtro', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          id_creador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          fecha_creacion: new Date(),
          id_presupuesto: 1,
          presupuesto_total: '100.00',
          cant_participantes: '5',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllWithResumen();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].presupuestoTotal).toBe(100);
      expect(result[0].cantParticipantes).toBe(5);
    });

    it('debería filtrar encuentros con resumen por creador', async () => {
      // Arrange
      const creadorId = 1;
      const mockResult = [
        {
          id_encuentro: 1,
          id_creador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          fecha_creacion: new Date(),
          id_presupuesto: 1,
          presupuesto_total: '100.00',
          cant_participantes: '5',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllWithResumen(creadorId);

      // Assert
      expect(result).toHaveLength(1);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.id_encuentro IN'),
        [creadorId, creadorId],
      );
    });

    it('debería convertir presupuesto y participantes a números', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          id_creador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          fecha_creacion: new Date(),
          id_presupuesto: 1,
          presupuesto_total: '250.50',
          cant_participantes: '10',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllWithResumen();

      // Assert
      expect(result[0].presupuestoTotal).toBe(250.5);
      expect(result[0].cantParticipantes).toBe(10);
      expect(typeof result[0].presupuestoTotal).toBe('number');
      expect(typeof result[0].cantParticipantes).toBe('number');
    });

    it('debería manejar valores NULL en presupuesto', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          id_creador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          fecha_creacion: new Date(),
          id_presupuesto: null,
          presupuesto_total: null,
          cant_participantes: '0',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllWithResumen();

      // Assert
      expect(result[0].presupuestoTotal).toBe(0);
      expect(result[0].cantParticipantes).toBe(0);
    });
  });

  describe('update', () => {
    it('debería actualizar un encuentro exitosamente', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 1;
      const updateEncuentroDto: UpdateEncuentroDto = {
        titulo: 'Encuentro Actualizado',
        descripcion: 'Nueva descripción',
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción original',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockEncuentroRepository.save.mockResolvedValue({
        ...mockEncuentro,
        ...updateEncuentroDto,
      });

      // Act
      const result = await service.update(
        idEncuentro,
        updateEncuentroDto,
        idUsuario,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('actualizado correctamente');
      expect(mockEncuentroRepository.findOne).toHaveBeenCalledWith({
        where: { id: idEncuentro },
      });
      expect(mockEncuentroRepository.save).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const idEncuentro = 999;
      const idUsuario = 1;
      const updateEncuentroDto: UpdateEncuentroDto = {
        titulo: 'Actualizado',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(idEncuentro, updateEncuentroDto, idUsuario),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(idEncuentro, updateEncuentroDto, idUsuario),
      ).rejects.toThrow('El encuentro no existe');
    });

    it('debería lanzar ForbiddenException si no es el creador', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 2; // Diferente al creador
      const updateEncuentroDto: UpdateEncuentroDto = {
        titulo: 'Actualizado',
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      // Act & Assert
      await expect(
        service.update(idEncuentro, updateEncuentroDto, idUsuario),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(idEncuentro, updateEncuentroDto, idUsuario),
      ).rejects.toThrow('Solo el creador puede editar este encuentro');
    });

    it('debería validar que la fecha no sea pasada', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 1;
      const updateEncuentroDto: UpdateEncuentroDto = {
        fecha: new Date(Date.now() - 86400000), // Fecha pasada
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      // Act & Assert
      await expect(
        service.update(idEncuentro, updateEncuentroDto, idUsuario),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update(idEncuentro, updateEncuentroDto, idUsuario),
      ).rejects.toThrow(
        'La fecha del encuentro no puede ser anterior a la fecha actual',
      );
    });

    it('debería actualizar solo los campos proporcionados', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 1;
      const updateEncuentroDto: UpdateEncuentroDto = {
        titulo: 'Nuevo Título',
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Título Original',
        descripcion: 'Descripción Original',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockEncuentroRepository.save.mockResolvedValue({
        ...mockEncuentro,
        titulo: 'Nuevo Título',
      });

      // Act
      const result = await service.update(
        idEncuentro,
        updateEncuentroDto,
        idUsuario,
      );

      // Assert
      expect(result.encuentro.descripcion).toBe('Descripción Original');
      expect(result.encuentro.lugar).toBe('Madrid');
    });
  });

  describe('remove', () => {
    it('debería eliminar un encuentro exitosamente', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 1;

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockEncuentroRepository.remove.mockResolvedValue(mockEncuentro);

      // Act
      const result = await service.remove(idEncuentro, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('eliminado correctamente');
      expect(mockEncuentroRepository.remove).toHaveBeenCalledWith(mockEncuentro);
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const idEncuentro = 999;
      const idUsuario = 1;

      mockEncuentroRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(idEncuentro, idUsuario)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(idEncuentro, idUsuario)).rejects.toThrow(
        'El encuentro no existe',
      );
    });

    it('debería lanzar ForbiddenException si no es el creador', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 2; // Diferente al creador

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      // Act & Assert
      await expect(service.remove(idEncuentro, idUsuario)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove(idEncuentro, idUsuario)).rejects.toThrow(
        'Solo el creador puede eliminar este encuentro',
      );
    });
  });

  describe('salirDelEncuentro', () => {
    it('debería permitir que un participante salga del encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 2; // Participante, no creador

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      const mockParticipante = {
        id: 1,
        idEncuentro,
        idUsuario,
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);
      mockParticipanteRepository.remove.mockResolvedValue(mockParticipante);

      // Act
      const result = await service.salirDelEncuentro(idEncuentro, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('salido del encuentro correctamente');
      expect(mockParticipanteRepository.remove).toHaveBeenCalledWith(
        mockParticipante,
      );
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const idEncuentro = 999;
      const idUsuario = 2;

      mockEncuentroRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.salirDelEncuentro(idEncuentro, idUsuario),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.salirDelEncuentro(idEncuentro, idUsuario),
      ).rejects.toThrow('El encuentro no existe');
    });

    it('debería lanzar ForbiddenException si el usuario es el creador', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 1; // Creador

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      // Act & Assert
      await expect(
        service.salirDelEncuentro(idEncuentro, idUsuario),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.salirDelEncuentro(idEncuentro, idUsuario),
      ).rejects.toThrow(
        'El creador no puede salir de su propio encuentro. Debe eliminarlo si desea cancelarlo.',
      );
    });

    it('debería lanzar NotFoundException si no es participante', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 3; // No es participante

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Original',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.salirDelEncuentro(idEncuentro, idUsuario),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.salirDelEncuentro(idEncuentro, idUsuario),
      ).rejects.toThrow('No eres participante de este encuentro');
    });
  });
});
