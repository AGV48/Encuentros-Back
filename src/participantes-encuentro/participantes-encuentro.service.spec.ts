import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { ParticipanteEncuentro } from './entities/participante-encuentro.entity';
import { ParticipantesEncuentroView } from './entities/participantes-encuentro-view.entity';
import { VistaParticipantesAportes } from './entities/vista-participantes-aportes.entity';
import { Encuentro } from '../encuentro/entities/encuentro.entity';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';

describe('ParticipantesEncuentroService', () => {
  let service: ParticipantesEncuentroService;
  let mockParticipanteRepository: any;
  let mockParticipantesViewRepository: any;
  let mockParticipantesAportesRepository: any;
  let mockEncuentroRepository: any;
  let mockDataSource: any;

  const mockEncuentro = {
    id: 1,
    titulo: 'Viaje a la playa',
    fecha: new Date(),
    idCreador: 1,
  };

  const mockParticipante = {
    id: 1,
    idEncuentro: 1,
    idUsuario: 2,
    rol: 'participante',
    encuentro: mockEncuentro,
    usuario: { id: 2, nombre: 'Juan' },
  };

  beforeEach(async () => {
    mockParticipanteRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
    };

    mockParticipantesViewRepository = {
      find: jest.fn(),
    };

    mockParticipantesAportesRepository = {
      find: jest.fn(),
    };

    mockEncuentroRepository = {
      findOne: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn(),
    };

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

    service = module.get<ParticipantesEncuentroService>(ParticipantesEncuentroService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new participant', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValue([{ id_participante_encuentro: 1 }]);
      mockParticipanteRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockParticipante);

      const result = await service.create(createDto);

      expect(mockEncuentroRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockDataSource.query).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if encuentro does not exist', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 999,
        idUsuario: 2,
        idSolicitante: 1,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the creator', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 999,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      await expect(service.create(createDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if user already participates', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should use default role if not provided', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(null);
      mockDataSource.query.mockResolvedValue([]);
      mockParticipanteRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(mockParticipante);

      await service.create(createDto);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO participantes_encuentro'),
        expect.arrayContaining([1, 2, 'participante']),
      );
    });

    it('should handle SQL error and throw ConflictException', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
        rol: 'participante',
      };

      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(null);
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all participants', async () => {
      mockParticipanteRepository.find.mockResolvedValue([mockParticipante]);

      const result = await service.findAll();

      expect(result).toEqual([mockParticipante]);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        relations: ['encuentro', 'usuario'],
      });
    });

    it('should return empty array if no participants exist', async () => {
      mockParticipanteRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByEncuentro', () => {
    it('should return participants by encuentro ID', async () => {
      mockParticipanteRepository.find.mockResolvedValue([mockParticipante]);

      const result = await service.findByEncuentro(1);

      expect(result).toEqual([mockParticipante]);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        where: { idEncuentro: 1 },
        relations: ['usuario'],
      });
    });

    it('should return empty array if no participants found', async () => {
      mockParticipanteRepository.find.mockResolvedValue([]);

      const result = await service.findByEncuentro(999);

      expect(result).toEqual([]);
    });
  });

  describe('findByUsuario', () => {
    it('should return encuentros by user ID', async () => {
      mockParticipanteRepository.find.mockResolvedValue([mockParticipante]);

      const result = await service.findByUsuario(2);

      expect(result).toEqual([mockParticipante]);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        where: { idUsuario: 2 },
        relations: ['encuentro'],
      });
    });

    it('should return empty array if user has no participation', async () => {
      mockParticipanteRepository.find.mockResolvedValue([]);

      const result = await service.findByUsuario(999);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a participant by ID', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);

      const result = await service.findOne(1);

      expect(result).toEqual(mockParticipante);
      expect(mockParticipanteRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['encuentro', 'usuario'],
      });
    });

    it('should throw NotFoundException if participant not found', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a participant', async () => {
      const updateDto: UpdateParticipanteDto = { rol: 'organizador' };

      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);
      mockParticipanteRepository.save.mockResolvedValue({
        ...mockParticipante,
        rol: 'organizador',
      });

      const result = await service.update(1, updateDto);

      expect(mockParticipanteRepository.save).toHaveBeenCalled();
      expect(result.rol).toBe('organizador');
    });

    it('should throw NotFoundException when updating non-existent participant', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a participant', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(mockParticipante);
      mockParticipanteRepository.remove.mockResolvedValue(mockParticipante);

      const result = await service.remove(1);

      expect(mockParticipanteRepository.remove).toHaveBeenCalledWith(mockParticipante);
      expect(result.message).toBe('Participante eliminado correctamente');
    });

    it('should throw NotFoundException when removing non-existent participant', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeByEncuentroAndUsuario', () => {
    it('should remove participant from encuentro', async () => {
      const participante = { ...mockParticipante, idUsuario: 2 };
      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(participante);
      mockParticipanteRepository.remove.mockResolvedValue(participante);

      const result = await service.removeByEncuentroAndUsuario(1, 2);

      expect(mockParticipanteRepository.remove).toHaveBeenCalledWith(participante);
      expect(result.message).toBe('Has salido del encuentro correctamente');
    });

    it('should throw NotFoundException if encuentro does not exist', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue(null);

      await expect(service.removeByEncuentroAndUsuario(999, 2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is the creator', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);

      await expect(service.removeByEncuentroAndUsuario(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if user is not a participant', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue(mockEncuentro);
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.removeByEncuentroAndUsuario(1, 2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllFromView', () => {
    it('should return all participants from view', async () => {
      const mockViewData = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Viaje',
          fecha: new Date(),
          id_usuario: 2,
          nombre_completo: 'Juan Pérez',
          rol: 'participante',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockViewData);

      const result = await service.findAllFromView();

      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
      expect(result[0].nombreCompleto).toBe('Juan Pérez');
    });

    it('should return participants filtered by encuentro', async () => {
      const mockViewData = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Viaje',
          fecha: new Date(),
          id_usuario: 2,
          nombre_completo: 'Juan Pérez',
          rol: 'participante',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockViewData);

      const result = await service.findAllFromView(1);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('id_encuentro = $1'),
        expect.arrayContaining([1]),
      );
      expect(result).toHaveLength(1);
    });

    it('should return participants filtered by usuario', async () => {
      const mockViewData = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Viaje',
          fecha: new Date(),
          id_usuario: 2,
          nombre_completo: 'Juan Pérez',
          rol: 'participante',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockViewData);

      const result = await service.findAllFromView(undefined, 2);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('id_usuario = $1'),
        expect.arrayContaining([2]),
      );
      expect(result).toHaveLength(1);
    });

    it('should return participants filtered by both encuentro and usuario', async () => {
      const mockViewData = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Viaje',
          fecha: new Date(),
          id_usuario: 2,
          nombre_completo: 'Juan Pérez',
          rol: 'participante',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockViewData);

      const result = await service.findAllFromView(1, 2);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('id_encuentro = $1'),
        expect.arrayContaining([1, 2]),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findParticipantesByEncuentroFromView', () => {
    it('should return participants by encuentro from view', async () => {
      const mockViewData = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Viaje',
          fecha: new Date(),
          id_usuario: 2,
          nombre_completo: 'Juan Pérez',
          rol: 'participante',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockViewData);

      const result = await service.findParticipantesByEncuentroFromView(1);

      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
    });
  });

  describe('findEncuentrosByUsuarioFromView', () => {
    it('should return encuentros by usuario from view', async () => {
      const mockViewData = [
        {
          id_encuentro: 1,
          titulo_encuentro: 'Viaje',
          fecha: new Date(),
          id_usuario: 2,
          nombre_completo: 'Juan Pérez',
          rol: 'participante',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockViewData);

      const result = await service.findEncuentrosByUsuarioFromView(2);

      expect(result).toHaveLength(1);
      expect(result[0].idUsuario).toBe(2);
    });
  });

  describe('findParticipantesConAportes', () => {
    it('should return participants with contributions', async () => {
      const mockData = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Viaje',
          id_usuario: 2,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '100.50',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockData);

      const result = await service.findParticipantesConAportes();

      expect(result).toHaveLength(1);
      expect(result[0].nombreCompleto).toBe('Juan Pérez');
      expect(result[0].totalAportes).toBe(100.5);
    });

    it('should return participants filtered by encuentro with contributions', async () => {
      const mockData = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Viaje',
          id_usuario: 2,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '100.50',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockData);

      const result = await service.findParticipantesConAportes(1);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('id_encuentro = $1'),
        expect.arrayContaining([1]),
      );
      expect(result).toHaveLength(1);
    });

    it('should return participants filtered by usuario with contributions', async () => {
      const mockData = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Viaje',
          id_usuario: 2,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '100.50',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockData);

      const result = await service.findParticipantesConAportes(undefined, 2);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('id_usuario = $1'),
        expect.arrayContaining([2]),
      );
    });

    it('should handle null totalAportes as 0', async () => {
      const mockData = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Viaje',
          id_usuario: 2,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: null,
        },
      ];

      mockDataSource.query.mockResolvedValue(mockData);

      const result = await service.findParticipantesConAportes();

      expect(result[0].totalAportes).toBe(0);
    });
  });

  describe('findAportesByEncuentro', () => {
    it('should return contributions by encuentro', async () => {
      const mockData = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Viaje',
          id_usuario: 2,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '100.50',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockData);

      const result = await service.findAportesByEncuentro(1);

      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
    });
  });

  describe('findAportesByUsuario', () => {
    it('should return contributions by usuario', async () => {
      const mockData = [
        {
          id_encuentro: 1,
          nombre_encuentro: 'Viaje',
          id_usuario: 2,
          nombre_usuario: 'Juan',
          apellido_usuario: 'Pérez',
          rol: 'participante',
          total_aportes: '100.50',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockData);

      const result = await service.findAportesByUsuario(2);

      expect(result).toHaveLength(1);
      expect(result[0].idUsuario).toBe(2);
    });
  });

  describe('service definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });
});
