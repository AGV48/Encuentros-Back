import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParticipanteEncuentro } from './entities/participante-encuentro.entity';
import { ParticipantesEncuentroView } from './entities/participantes-encuentro-view.entity';
import { VistaParticipantesAportes } from './entities/vista-participantes-aportes.entity';
import { Encuentro } from '../encuentro/entities/encuentro.entity';
import { DataSource, Repository } from 'typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';

// Mocks
const mockParticipanteRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockParticipantesViewRepository = {
  find: jest.fn(),
};

const mockParticipantesAportesRepository = {
  find: jest.fn(),
};

const mockEncuentroRepository = {
  findOne: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
};

describe('ParticipantesEncuentroService', () => {
  let service: ParticipantesEncuentroService;
  let participanteRepository: Repository<ParticipanteEncuentro>;
  let encuentroRepository: Repository<Encuentro>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantesEncuentroService,
        {
          provide: getRepositoryToken(ParticipanteEncuentro),
          useValue: mockParticipanteRepository,
        },
        {
          provide: getRepositoryToken(ParticipantesEncuentroView),
          useValue: mockParticipantesViewRepository,
        },
        {
          provide: getRepositoryToken(VistaParticipantesAportes),
          useValue: mockParticipantesAportesRepository,
        },
        {
          provide: getRepositoryToken(Encuentro),
          useValue: mockEncuentroRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ParticipantesEncuentroService>(
      ParticipantesEncuentroService,
    );
    participanteRepository = module.get<Repository<ParticipanteEncuentro>>(
      getRepositoryToken(ParticipanteEncuentro),
    );
    encuentroRepository = module.get<Repository<Encuentro>>(
      getRepositoryToken(Encuentro),
    );
    dataSource = module.get<DataSource>(DataSource);

    // Limpiar mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería agregar un participante exitosamente', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
        rol: 'participante',
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      const mockParticipante = {
        id: 1,
        idEncuentro: 1,
        idUsuario: 2,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne
        .mockResolvedValueOnce(null) // Primera llamada - verificar que no existe
        .mockResolvedValueOnce(mockParticipante); // Segunda llamada - recuperar insertado
      mockDataSource.query.mockResolvedValue([]);

      // Act
      const result = await service.create(createParticipanteDto);

      // Assert
      expect(mockEncuentroRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO participantes_encuentro'),
        [1, 2, 'participante'],
      );
      expect(result).toEqual(mockParticipante);
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 999,
        idUsuario: 2,
        idSolicitante: 1,
      };

      mockEncuentroRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createParticipanteDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createParticipanteDto)).rejects.toThrow(
        'El encuentro no existe',
      );
    });

    it('debería lanzar ForbiddenException si no es el creador', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 3, // Diferente al creador
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      // Act & Assert
      await expect(service.create(createParticipanteDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(createParticipanteDto)).rejects.toThrow(
        'Solo el creador del encuentro puede agregar participantes',
      );
    });

    it('debería lanzar ConflictException si el usuario ya participa', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      const mockParticipanteExistente = {
        id: 1,
        idEncuentro: 1,
        idUsuario: 2,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(
        mockParticipanteExistente,
      );

      // Act & Assert
      await expect(service.create(createParticipanteDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createParticipanteDto)).rejects.toThrow(
        'El usuario ya está participando en este encuentro',
      );
    });

    it('debería usar rol "participante" por defecto', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
        // sin rol especificado
      };

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      const mockParticipante = {
        id: 1,
        idEncuentro: 1,
        idUsuario: 2,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne
        .mockResolvedValueOnce(null) // Primera llamada - verificar que no existe
        .mockResolvedValueOnce(mockParticipante); // Segunda llamada - recuperar insertado
      mockDataSource.query.mockResolvedValue([]);

      // Act
      await service.create(createParticipanteDto);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO participantes_encuentro'),
        [1, 2, 'participante'],
      );
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los participantes', async () => {
      // Arrange
      const mockParticipantes = [
        {
          id: 1,
          idEncuentro: 1,
          idUsuario: 1,
          rol: 'creador',
        },
        {
          id: 2,
          idEncuentro: 1,
          idUsuario: 2,
          rol: 'participante',
        },
      ];

      mockParticipanteRepository.find.mockResolvedValue(mockParticipantes);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockParticipantes);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        relations: ['encuentro', 'usuario'],
      });
    });
  });

  describe('findByEncuentro', () => {
    it('debería obtener participantes por ID de encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const mockParticipantes = [
        {
          id: 1,
          idEncuentro: 1,
          idUsuario: 1,
          rol: 'creador',
        },
        {
          id: 2,
          idEncuentro: 1,
          idUsuario: 2,
          rol: 'participante',
        },
      ];

      mockParticipanteRepository.find.mockResolvedValue(mockParticipantes);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toEqual(mockParticipantes);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        where: { idEncuentro },
        relations: ['usuario'],
      });
    });

    it('debería devolver lista vacía si no hay participantes', async () => {
      // Arrange
      const idEncuentro = 999;
      mockParticipanteRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findByEncuentro(idEncuentro);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findByUsuario', () => {
    it('debería obtener encuentros del usuario', async () => {
      // Arrange
      const idUsuario = 1;
      const mockParticipantes = [
        {
          id: 1,
          idEncuentro: 1,
          idUsuario: 1,
          rol: 'creador',
        },
        {
          id: 2,
          idEncuentro: 2,
          idUsuario: 1,
          rol: 'participante',
        },
      ];

      mockParticipanteRepository.find.mockResolvedValue(mockParticipantes);

      // Act
      const result = await service.findByUsuario(idUsuario);

      // Assert
      expect(result).toEqual(mockParticipantes);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        where: { idUsuario },
        relations: ['encuentro'],
      });
    });
  });

  describe('findOne', () => {
    it('debería obtener un participante por ID', async () => {
      // Arrange
      const id = 1;
      const mockParticipante = {
        id: 1,
        idEncuentro: 1,
        idUsuario: 1,
        rol: 'creador',
      };

      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(result).toEqual(mockParticipante);
      expect(mockParticipanteRepository.findOne).toHaveBeenCalledWith({
        where: { id },
        relations: ['encuentro', 'usuario'],
      });
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = 999;
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(id)).rejects.toThrow(
        `Participante con ID ${id} no encontrado`,
      );
    });
  });

  describe('update', () => {
    it('debería actualizar un participante', async () => {
      // Arrange
      const id = 1;
      const updateParticipanteDto: UpdateParticipanteDto = {
        rol: 'asistente',
      };

      const mockParticipante = {
        id: 1,
        idEncuentro: 1,
        idUsuario: 1,
        rol: 'participante',
      };

      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);
      mockParticipanteRepository.save.mockResolvedValue({
        ...mockParticipante,
        ...updateParticipanteDto,
      });

      // Act
      const result = await service.update(id, updateParticipanteDto);

      // Assert
      expect(result.rol).toBe('asistente');
      expect(mockParticipanteRepository.save).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el participante no existe', async () => {
      // Arrange
      const id = 999;
      const updateParticipanteDto: UpdateParticipanteDto = {
        rol: 'asistente',
      };

      mockParticipanteRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.update(id, updateParticipanteDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debería eliminar un participante', async () => {
      // Arrange
      const id = 1;
      const mockParticipante = {
        id: 1,
        idEncuentro: 1,
        idUsuario: 2,
        rol: 'participante',
      };

      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);
      mockParticipanteRepository.remove.mockResolvedValue(mockParticipante);

      // Act
      const result = await service.remove(id);

      // Assert
      expect(result.message).toContain('eliminado correctamente');
      expect(mockParticipanteRepository.remove).toHaveBeenCalledWith(
        mockParticipante,
      );
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = 999;
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeByEncuentroAndUsuario', () => {
    it('debería permitir que un participante salga del encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 2; // Participante, no creador

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      const mockParticipante = {
        id: 1,
        idEncuentro,
        idUsuario,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);
      mockParticipanteRepository.remove.mockResolvedValue(mockParticipante);

      // Act
      const result = await service.removeByEncuentroAndUsuario(
        idEncuentro,
        idUsuario,
      );

      // Assert
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
        service.removeByEncuentroAndUsuario(idEncuentro, idUsuario),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeByEncuentroAndUsuario(idEncuentro, idUsuario),
      ).rejects.toThrow('El encuentro no existe');
    });

    it('debería lanzar ForbiddenException si es el creador', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 1; // Creador

      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      // Act & Assert
      await expect(
        service.removeByEncuentroAndUsuario(idEncuentro, idUsuario),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.removeByEncuentroAndUsuario(idEncuentro, idUsuario),
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
        titulo: 'Encuentro Test',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(),
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeByEncuentroAndUsuario(idEncuentro, idUsuario),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeByEncuentroAndUsuario(idEncuentro, idUsuario),
      ).rejects.toThrow('No eres participante de este encuentro');
    });
  });

  describe('findAllFromView', () => {
    it('debería obtener participantes desde la vista sin filtro', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Encuentro Test',
          fecha: new Date(),
          id_usuario: 1,
          nombre_completo: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllFromView();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
      expect(result[0].tituloEncuentro).toBe('Encuentro Test');
      expect(result[0].nombreCompleto).toBe('Juan Pérez');
    });

    it('debería filtrar por encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const mockResult = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Encuentro Test',
          fecha: new Date(),
          id_usuario: 1,
          nombre_completo: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllFromView(idEncuentro);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id_encuentro = $1'),
        [idEncuentro],
      );
    });

    it('debería filtrar por usuario', async () => {
      // Arrange
      const idUsuario = 1;
      const mockResult = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Encuentro Test',
          fecha: new Date(),
          id_usuario: 1,
          nombre_completo: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllFromView(undefined, idUsuario);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id_usuario = $1'),
        [idUsuario],
      );
    });

    it('debería filtrar por encuentro y usuario', async () => {
      // Arrange
      const idEncuentro = 1;
      const idUsuario = 1;
      const mockResult = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Encuentro Test',
          fecha: new Date(),
          id_usuario: 1,
          nombre_completo: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllFromView(idEncuentro, idUsuario);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id_encuentro = $1'),
        expect.arrayContaining([idEncuentro, idUsuario]),
      );
    });

    it('debería normalizar propiedades a camelCase', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Encuentro Test',
          fecha: new Date(),
          id_usuario: 1,
          nombre_completo: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findAllFromView();

      // Assert
      expect(result[0]).toHaveProperty('idEncuentro');
      expect(result[0]).toHaveProperty('tituloEncuentro');
      expect(result[0]).toHaveProperty('idUsuario');
      expect(result[0]).toHaveProperty('nombreCompleto');
      expect(result[0]).not.toHaveProperty('id_encuentro');
    });
  });

  describe('findParticipantesConAportes', () => {
    it('debería obtener participantes con aportes sin filtro', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Encuentro Test',
          id_usuario: 1,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '150.50',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findParticipantesConAportes();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].nombreCompleto).toBe('Juan Pérez');
      expect(result[0].totalAportes).toBe(150.5);
    });

    it('debería filtrar por encuentro', async () => {
      // Arrange
      const idEncuentro = 1;
      const mockResult = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Encuentro Test',
          id_usuario: 1,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '150.50',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findParticipantesConAportes(idEncuentro);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('AND id_encuentro = $1'),
        [idEncuentro],
      );
    });

    it('debería convertir totalAportes a número', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Encuentro Test',
          id_usuario: 1,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '250.75',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findParticipantesConAportes();

      // Assert
      expect(typeof result[0].totalAportes).toBe('number');
      expect(result[0].totalAportes).toBe(250.75);
    });

    it('debería manejar totalAportes NULL', async () => {
      // Arrange
      const mockResult = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Encuentro Test',
          id_usuario: 1,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: null,
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResult);

      // Act
      const result = await service.findParticipantesConAportes();

      // Assert
      expect(result[0].totalAportes).toBe(0);
    });
  });
});
