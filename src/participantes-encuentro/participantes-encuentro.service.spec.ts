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
  let participantesViewRepository: Repository<ParticipantesEncuentroView>;
  let participantesAportesRepository: Repository<VistaParticipantesAportes>;
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
    participantesViewRepository = module.get<Repository<ParticipantesEncuentroView>>(getRepositoryToken(ParticipantesEncuentroView));
    participantesAportesRepository = module.get<Repository<VistaParticipantesAportes>>(getRepositoryToken(VistaParticipantesAportes));
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
      const newParticipante = { id: 1, ...dto };
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      mockParticipanteRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(newParticipante);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.create(dto);
      expect(result).toEqual(newParticipante);
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue(null);
      await expect(service.create({ idEncuentro: 99, idUsuario: 1, idSolicitante: 1 } as any)).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar ForbiddenException si no es el creador', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 2 });
      await expect(service.create({ idEncuentro: 1, idUsuario: 3, idSolicitante: 1 } as any)).rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar ConflictException si el usuario ya está participando', async () => {
      const dto: CreateParticipanteDto = { idEncuentro: 1, idUsuario: 2, idSolicitante: 1, rol: 'participante' };
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      mockParticipanteRepository.findOne.mockResolvedValue({ id: 1, ...dto });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los participantes', async () => {
      const participantes = [
        { id: 1, idEncuentro: 1, idUsuario: 1 },
        { id: 2, idEncuentro: 1, idUsuario: 2 },
      ];
      mockParticipanteRepository.find.mockResolvedValue(participantes);

      const result = await service.findAll();
      expect(result).toEqual(participantes);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        relations: ['encuentro', 'usuario'],
      });
    });

    it('debería retornar un array vacío si no hay participantes', async () => {
      mockParticipanteRepository.find.mockResolvedValue([]);

      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findByEncuentro', () => {
    it('debería obtener participantes de un encuentro específico', async () => {
      const participantes = [
        { id: 1, idEncuentro: 1, idUsuario: 1, usuario: { id: 1, nombre: 'User1' } },
        { id: 2, idEncuentro: 1, idUsuario: 2, usuario: { id: 2, nombre: 'User2' } },
      ];
      mockParticipanteRepository.find.mockResolvedValue(participantes);

      const result = await service.findByEncuentro(1);
      expect(result).toEqual(participantes);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        where: { idEncuentro: 1 },
        relations: ['usuario'],
      });
    });

    it('debería retornar array vacío si no hay participantes en el encuentro', async () => {
      mockParticipanteRepository.find.mockResolvedValue([]);

      const result = await service.findByEncuentro(99);
      expect(result).toEqual([]);
    });
  });

  describe('findByUsuario', () => {
    it('debería obtener encuentros de un usuario específico', async () => {
      const participantes = [
        { id: 1, idEncuentro: 1, idUsuario: 1, encuentro: { id: 1, nombre: 'Encuentro1' } },
        { id: 2, idEncuentro: 2, idUsuario: 1, encuentro: { id: 2, nombre: 'Encuentro2' } },
      ];
      mockParticipanteRepository.find.mockResolvedValue(participantes);

      const result = await service.findByUsuario(1);
      expect(result).toEqual(participantes);
      expect(mockParticipanteRepository.find).toHaveBeenCalledWith({
        where: { idUsuario: 1 },
        relations: ['encuentro'],
      });
    });

    it('debería retornar array vacío si el usuario no participa en encuentros', async () => {
      mockParticipanteRepository.find.mockResolvedValue([]);

      const result = await service.findByUsuario(99);
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('debería obtener un participante por ID', async () => {
      const participante = { id: 1, idEncuentro: 1, idUsuario: 1 };
      mockParticipanteRepository.findOne.mockResolvedValue(participante);

      const result = await service.findOne(1);
      expect(result).toEqual(participante);
      expect(mockParticipanteRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['encuentro', 'usuario'],
      });
    });

    it('debería lanzar NotFoundException si el participante no existe', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debería actualizar un participante exitosamente', async () => {
      const dto: UpdateParticipanteDto = { rol: 'admin' };
      const participante = { id: 1, idEncuentro: 1, idUsuario: 1, rol: 'participante' };
      const updatedParticipante = { ...participante, ...dto };

      mockParticipanteRepository.findOne.mockResolvedValue(participante);
      mockParticipanteRepository.save.mockResolvedValue(updatedParticipante);

      const result = await service.update(1, dto);
      expect(result).toEqual(updatedParticipante);
      expect(mockParticipanteRepository.save).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el participante no existe', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.update(99, { rol: 'admin' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('debería eliminar un participante', async () => {
      const participante = { id: 1, idEncuentro: 1, idUsuario: 1 };
      mockParticipanteRepository.findOne.mockResolvedValue(participante);
      mockParticipanteRepository.remove.mockResolvedValue(participante);

      const result = await service.remove(1);
      expect(result).toHaveProperty('message');
      expect(mockParticipanteRepository.remove).toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el participante no existe', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeByEncuentroAndUsuario', () => {
    it('debería permitir que un usuario deje un encuentro', async () => {
      const participante = { id: 1, idEncuentro: 1, idUsuario: 2, encuentro: { idCreador: 1 } };
      mockParticipanteRepository.findOne.mockResolvedValue(participante);
      mockParticipanteRepository.remove.mockResolvedValue(participante);

      const result = await service.removeByEncuentroAndUsuario(1, 2);
      expect(result).toHaveProperty('message');
    });

    it('debería lanzar ForbiddenException si es el creador del encuentro', async () => {
      const participante = { id: 1, idEncuentro: 1, idUsuario: 1, encuentro: { idCreador: 1 } };
      mockParticipanteRepository.findOne.mockResolvedValue(participante);

      await expect(service.removeByEncuentroAndUsuario(1, 1)).rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar NotFoundException si el participante no existe', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(service.removeByEncuentroAndUsuario(1, 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllFromView', () => {
    it('debería obtener participantes desde la vista sin filtros', async () => {
      const queryData = [{ id_encuentro: 1, titulo_encuentro: 'Encuentro1', fecha: '2024-01-01', id_usuario: 1, nombre_completo: 'User1', rol: 'participante' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findAllFromView();
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
    });

    it('debería filtrar por idEncuentro', async () => {
      const queryData = [{ id_encuentro: 1, titulo_encuentro: 'Encuentro1', fecha: '2024-01-01', id_usuario: 1, nombre_completo: 'User1', rol: 'participante' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findAllFromView(1, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
    });

    it('debería filtrar por idUsuario', async () => {
      const queryData = [{ id_encuentro: 1, titulo_encuentro: 'Encuentro1', fecha: '2024-01-01', id_usuario: 2, nombre_completo: 'User2', rol: 'participante' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findAllFromView(undefined, 2);
      expect(result).toHaveLength(1);
      expect(result[0].idUsuario).toBe(2);
    });

    it('debería filtrar por ambos idEncuentro e idUsuario', async () => {
      const queryData = [{ id_encuentro: 1, titulo_encuentro: 'Encuentro1', fecha: '2024-01-01', id_usuario: 2, nombre_completo: 'User2', rol: 'participante' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findAllFromView(1, 2);
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
      expect(result[0].idUsuario).toBe(2);
    });
  });

  describe('findParticipantesByEncuentroFromView', () => {
    it('debería obtener participantes de un encuentro desde la vista', async () => {
      const queryData = [{ id_encuentro: 1, titulo_encuentro: 'Encuentro1', fecha: '2024-01-01', id_usuario: 1, nombre_completo: 'User1', rol: 'participante' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findParticipantesByEncuentroFromView(1);
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
    });

    it('debería retornar array vacío si no hay participantes', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.findParticipantesByEncuentroFromView(99);
      expect(result).toEqual([]);
    });
  });

  describe('findEncuentrosByUsuarioFromView', () => {
    it('debería obtener encuentros de un usuario desde la vista', async () => {
      const queryData = [{ id_encuentro: 1, titulo_encuentro: 'Encuentro1', fecha: '2024-01-01', id_usuario: 1, nombre_completo: 'User1', rol: 'participante' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findEncuentrosByUsuarioFromView(1);
      expect(result).toHaveLength(1);
      expect(result[0].idUsuario).toBe(1);
    });

    it('debería retornar array vacío si el usuario no tiene encuentros', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.findEncuentrosByUsuarioFromView(99);
      expect(result).toEqual([]);
    });
  });

  describe('findParticipantesConAportes', () => {
    it('debería obtener participantes con aportes sin filtros', async () => {
      const queryData = [{ id_encuentro: 1, nombre_encuentro: 'Encuentro1', id_usuario: 1, nombre_usuario: 'John', apellido_usuario: 'Doe', rol: 'participante', total_aportes: '50.00' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findParticipantesConAportes();
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
      expect(result[0].totalAportes).toBe(50);
    });

    it('debería filtrar por idEncuentro', async () => {
      const queryData = [{ id_encuentro: 1, nombre_encuentro: 'Encuentro1', id_usuario: 1, nombre_usuario: 'John', apellido_usuario: 'Doe', rol: 'participante', total_aportes: '50.00' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findParticipantesConAportes(1, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
    });

    it('debería filtrar por idUsuario', async () => {
      const queryData = [{ id_encuentro: 1, nombre_encuentro: 'Encuentro1', id_usuario: 2, nombre_usuario: 'Jane', apellido_usuario: 'Smith', rol: 'participante', total_aportes: '75.00' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findParticipantesConAportes(undefined, 2);
      expect(result).toHaveLength(1);
      expect(result[0].idUsuario).toBe(2);
    });

    it('debería filtrar por ambos idEncuentro e idUsuario', async () => {
      const queryData = [{ id_encuentro: 1, nombre_encuentro: 'Encuentro1', id_usuario: 2, nombre_usuario: 'Jane', apellido_usuario: 'Smith', rol: 'participante', total_aportes: '75.00' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findParticipantesConAportes(1, 2);
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
      expect(result[0].idUsuario).toBe(2);
    });
  });

  describe('findAportesByEncuentro', () => {
    it('debería obtener aportes de un encuentro', async () => {
      const queryData = [{ id_encuentro: 1, nombre_encuentro: 'Encuentro1', id_usuario: 1, nombre_usuario: 'John', apellido_usuario: 'Doe', rol: 'participante', total_aportes: '50.00' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findAportesByEncuentro(1);
      expect(result).toHaveLength(1);
      expect(result[0].idEncuentro).toBe(1);
    });

    it('debería retornar array vacío si no hay aportes', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.findAportesByEncuentro(99);
      expect(result).toEqual([]);
    });
  });

  describe('findAportesByUsuario', () => {
    it('debería obtener aportes de un usuario', async () => {
      const queryData = [{ id_encuentro: 1, nombre_encuentro: 'Encuentro1', id_usuario: 1, nombre_usuario: 'John', apellido_usuario: 'Doe', rol: 'participante', total_aportes: '50.00' }];
      mockDataSource.query.mockResolvedValue(queryData);

      const result = await service.findAportesByUsuario(1);
      expect(result).toHaveLength(1);
      expect(result[0].idUsuario).toBe(1);
    });

    it('debería retornar array vacío si el usuario no tiene aportes', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.findAportesByUsuario(99);
      expect(result).toEqual([]);
    });
  });
});
