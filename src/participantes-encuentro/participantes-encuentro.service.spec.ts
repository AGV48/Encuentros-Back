import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParticipanteEncuentro } from './entities/participante-encuentro.entity';
import { ParticipantesEncuentroView } from './entities/participantes-encuentro-view.entity';
import { VistaParticipantesAportes } from './entities/vista-participantes-aportes.entity';
import { Encuentro } from '../encuentro/entities/encuentro.entity';
import { DataSource, Repository } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';

describe('ParticipantesEncuentroService', () => {
  let service: ParticipantesEncuentroService;
  let participanteRepository: Repository<ParticipanteEncuentro>;
  let encuentroRepository: Repository<Encuentro>;
  let dataSource: DataSource;

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

    service = module.get<ParticipantesEncuentroService>(ParticipantesEncuentroService);
    participanteRepository = module.get<Repository<ParticipanteEncuentro>>(getRepositoryToken(ParticipanteEncuentro));
    encuentroRepository = module.get<Repository<Encuentro>>(getRepositoryToken(Encuentro));
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería agregar un participante exitosamente', async () => {
      const dto: CreateParticipanteDto = { idEncuentro: 1, idUsuario: 2, idSolicitante: 1, rol: 'participante' };
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      mockParticipanteRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1, ...dto });
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.create(dto);
      expect(result.idUsuario).toBe(2);
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue(null);
      await expect(service.create({ idEncuentro: 99 } as any)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar ForbiddenException si no es el creador', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 2 });
      await expect(service.create({ idEncuentro: 1, idSolicitante: 1 } as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los participantes', async () => {
      mockParticipanteRepository.find.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('debería lanzar NotFoundException si no existe', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeByEncuentroAndUsuario', () => {
    it('debería permitir salir del encuentro', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 2 });
      mockParticipanteRepository.findOne.mockResolvedValue({ id: 1 });
      mockParticipanteRepository.remove.mockResolvedValue({ id: 1 });

      const result = await service.removeByEncuentroAndUsuario(1, 1);
      expect(result.message).toContain('salido');
    });
  });
});
