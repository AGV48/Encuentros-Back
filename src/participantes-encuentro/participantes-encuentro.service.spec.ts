import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ParticipanteEncuentro } from './entities/participante-encuentro.entity';
import { ParticipantesEncuentroView } from './entities/participantes-encuentro-view.entity';
import { VistaParticipantesAportes } from './entities/vista-participantes-aportes.entity';
import { Encuentro } from '../encuentro/entities/encuentro.entity';
import { DataSource } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ParticipantesEncuentroService', () => {
  let service: ParticipantesEncuentroService;

  const mockParticipanteRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockViewRepository = { find: jest.fn() };
  const mockAportesRepository = { find: jest.fn() };

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
        { provide: getRepositoryToken(ParticipanteEncuentro), useValue: mockParticipanteRepository },
        { provide: getRepositoryToken(ParticipantesEncuentroView), useValue: mockViewRepository },
        { provide: getRepositoryToken(VistaParticipantesAportes), useValue: mockAportesRepository },
        { provide: getRepositoryToken(Encuentro), useValue: mockEncuentroRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ParticipantesEncuentroService>(ParticipantesEncuentroService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería lanzar NotFound si el encuentro no existe', async () => {
      // Arrange
      mockEncuentroRepository.findOne.mockResolvedValue(null);
      
      // Act & Assert
      await expect(service.create({ idEncuentro: 1, idSolicitante: 1, idUsuario: 2 } as any))
        .rejects.toThrow(NotFoundException);
    });

    it('debería lanzar ForbiddenException si solicitante no es creador', async () => {
      // Arrange
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 99 });
      
      // Act & Assert
      await expect(service.create({ idEncuentro: 1, idSolicitante: 1, idUsuario: 2 } as any))
        .rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar ConflictException si usuario ya participa', async () => {
      // Arrange
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      mockParticipanteRepository.findOne.mockResolvedValue({ idUsuario: 2 }); // Ya existe
      
      // Act & Assert
      await expect(service.create({ idEncuentro: 1, idSolicitante: 1, idUsuario: 2 } as any))
        .rejects.toThrow(ConflictException);
    });

    it('debería insertar participante mediante query e retornar objeto', async () => {
      // Arrange
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      mockParticipanteRepository.findOne
        .mockResolvedValueOnce(null) // Primera vez no existe
        .mockResolvedValueOnce({ idEncuentro: 1, idUsuario: 2, rol: 'participante' }); // Segunda vez lo encuentra
      mockDataSource.query.mockResolvedValue([]);

      // Act
      const result = await service.create({ idEncuentro: 1, idSolicitante: 1, idUsuario: 2 } as any);

      // Assert
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO participantes_encuentro'),
        [1, 2, 'participante']
      );
      expect(result).toEqual(expect.objectContaining({ rol: 'participante' }));
    });

    it('debería atrapar errores sql y convertirlos en ConflictException', async () => {
      // Arrange
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      mockParticipanteRepository.findOne.mockResolvedValue(null);
      mockDataSource.query.mockRejectedValue(new Error('SQL Fail'));

      // Act & Assert
      await expect(service.create({ idEncuentro: 1, idSolicitante: 1, idUsuario: 2 } as any))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('Metodos basicos repository', () => {
    it('findAll', async () => {
      mockParticipanteRepository.find.mockResolvedValue([{ id: 1 }]);
      expect(await service.findAll()).toEqual([{ id: 1 }]);
    });
    it('findByEncuentro', async () => {
      mockParticipanteRepository.find.mockResolvedValue([{ idEncuentro: 1 }]);
      expect(await service.findByEncuentro(1)).toEqual([{ idEncuentro: 1 }]);
    });
    it('findByUsuario', async () => {
      mockParticipanteRepository.find.mockResolvedValue([{ idUsuario: 1 }]);
      expect(await service.findByUsuario(1)).toEqual([{ idUsuario: 1 }]);
    });
  });

  describe('update & remove via findOne', () => {
    it('debería lanzar error si findOne no lo encuentra', async () => {
      mockParticipanteRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
    });

    it('update', async () => {
      const part = { id: 1, rol: 'participante' };
      mockParticipanteRepository.findOne.mockResolvedValue(part);
      mockParticipanteRepository.save.mockResolvedValue({ id: 1, rol: 'admin' });
      const result = await service.update(1, { rol: 'admin' } as any);
      expect(result.rol).toBe('admin');
    });

    it('remove', async () => {
      const part = { id: 1 };
      mockParticipanteRepository.findOne.mockResolvedValue(part);
      mockParticipanteRepository.remove.mockResolvedValue(part);
      const res = await service.remove(1);
      expect(res.message).toBe('Participante eliminado correctamente');
    });
  });

  describe('removeByEncuentroAndUsuario', () => {
    it('falla si dictamen no existe', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue(null);
      await expect(service.removeByEncuentroAndUsuario(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('falla si usuario es creador', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      await expect(service.removeByEncuentroAndUsuario(1, 1)).rejects.toThrow(ForbiddenException);
    });

    it('falla si no es participante', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 2 });
      mockParticipanteRepository.findOne.mockResolvedValue(null);
      await expect(service.removeByEncuentroAndUsuario(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('éxito al salir', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 2 });
      mockParticipanteRepository.findOne.mockResolvedValue({ idEncuentro: 1, idUsuario: 1 });
      const res = await service.removeByEncuentroAndUsuario(1, 1);
      expect(mockParticipanteRepository.remove).toHaveBeenCalled();
      expect(res.message).toBeDefined();
    });
  });

  describe('findAllFromView', () => {
    it('ejecuta consulta cruda con idEncuentro', async () => {
      mockDataSource.query.mockResolvedValue([{ id_encuentro: 1, id_usuario: 2 }]);
      const res = await service.findAllFromView(1);
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('id_encuentro = $1'), [1]);
      expect(res.length).toBe(1);
    });

    it('ejecuta consulta cruda con idUsuario', async () => {
      mockDataSource.query.mockResolvedValue([{ id_encuentro: 1, id_usuario: 2 }]);
      await service.findAllFromView(undefined, 2);
      expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('id_usuario = $1'), [2]);
    });
  });

  describe('findParticipantesConAportes', () => {
    it('ejecuta consulta cruda con total_aportes', async () => {
      mockDataSource.query.mockResolvedValue([
        { id_encuentro: 1, total_aportes: '10.5', nombre_usuario: 'A' }
      ]);
      const res = await service.findParticipantesConAportes(1, 2);
      expect(res[0].totalAportes).toBe(10.5);
    });
  });

  describe('wrappers de Vistas', () => {
    it('findParticipantesByEncuentroFromView llama findAllFromView', async () => {
      jest.spyOn(service, 'findAllFromView').mockResolvedValue([]);
      await service.findParticipantesByEncuentroFromView(1);
      expect(service.findAllFromView).toHaveBeenCalledWith(1, undefined);
    });
    it('findEncuentrosByUsuarioFromView llama findAllFromView', async () => {
      jest.spyOn(service, 'findAllFromView').mockResolvedValue([]);
      await service.findEncuentrosByUsuarioFromView(1);
      expect(service.findAllFromView).toHaveBeenCalledWith(undefined, 1);
    });
    it('findAportesByEncuentro llama findParticipantesConAportes', async () => {
      jest.spyOn(service, 'findParticipantesConAportes').mockResolvedValue([]);
      await service.findAportesByEncuentro(1);
      expect(service.findParticipantesConAportes).toHaveBeenCalledWith(1, undefined);
    });
    it('findAportesByUsuario llama findParticipantesConAportes', async () => {
      jest.spyOn(service, 'findParticipantesConAportes').mockResolvedValue([]);
      await service.findAportesByUsuario(1);
      expect(service.findParticipantesConAportes).toHaveBeenCalledWith(undefined, 1);
    });
  });
});
