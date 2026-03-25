import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantesEncuentroController } from './participantes-encuentro.controller';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// Mock del servicio
const mockParticipantesEncuentroService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByEncuentro: jest.fn(),
  findByUsuario: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  removeByEncuentroAndUsuario: jest.fn(),
  findAllFromView: jest.fn(),
  findParticipantesByEncuentroFromView: jest.fn(),
  findEncuentrosByUsuarioFromView: jest.fn(),
  findParticipantesConAportes: jest.fn(),
  findAportesByEncuentro: jest.fn(),
};

describe('ParticipantesEncuentroController', () => {
  let controller: ParticipantesEncuentroController;
  let service: ParticipantesEncuentroService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParticipantesEncuentroController],
      providers: [
        {
          provide: ParticipantesEncuentroService,
          useValue: mockParticipantesEncuentroService,
        },
      ],
    }).compile();

    controller = module.get<ParticipantesEncuentroController>(
      ParticipantesEncuentroController,
    );
    service = module.get<ParticipantesEncuentroService>(
      ParticipantesEncuentroService,
    );

    // Limpiar mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debería agregar un participante exitosamente', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1, // Creador del encuentro
        rol: 'participante',
      };

      const mockParticipante = {
        id: 1,
        ...createParticipanteDto,
      };

      mockParticipantesEncuentroService.create.mockResolvedValue(
        mockParticipante,
      );

      // Act
      const result = await controller.create(createParticipanteDto);

      // Assert
      expect(result).toEqual(mockParticipante);
      expect(mockParticipantesEncuentroService.create).toHaveBeenCalledWith(
        createParticipanteDto,
      );
    });

    it('debería lanzar ForbiddenException si no es el creador del encuentro', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 3, // No es el creador
      };

      mockParticipantesEncuentroService.create.mockRejectedValue(
        new ForbiddenException(
          'Solo el creador del encuentro puede agregar participantes',
        ),
      );

      // Act & Assert
      await expect(controller.create(createParticipanteDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 999,
        idUsuario: 2,
        idSolicitante: 1,
      };

      mockParticipantesEncuentroService.create.mockRejectedValue(
        new NotFoundException('El encuentro no existe'),
      );

      // Act & Assert
      await expect(controller.create(createParticipanteDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debería lanzar ConflictException si el usuario ya participa', async () => {
      // Arrange
      const createParticipanteDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
      };

      mockParticipantesEncuentroService.create.mockRejectedValue(
        new ConflictException(
          'El usuario ya está participando en este encuentro',
        ),
      );

      // Act & Assert
      await expect(controller.create(createParticipanteDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los participantes sin filtro', async () => {
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

      mockParticipantesEncuentroService.findAll.mockResolvedValue(
        mockParticipantes,
      );

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockParticipantes);
      expect(mockParticipantesEncuentroService.findAll).toHaveBeenCalled();
    });

    it('debería obtener participantes filtrados por encuentro', async () => {
      // Arrange
      const encuentroId = '1';
      const mockParticipantes = [
        {
          id: 1,
          idEncuentro: 1,
          idUsuario: 1,
          rol: 'creador',
        },
      ];

      mockParticipantesEncuentroService.findByEncuentro.mockResolvedValue(
        mockParticipantes,
      );

      // Act
      const result = await controller.findAll(encuentroId);

      // Assert
      expect(result).toEqual(mockParticipantes);
      expect(
        mockParticipantesEncuentroService.findByEncuentro,
      ).toHaveBeenCalledWith(1);
    });

    it('debería obtener participantes filtrados por usuario', async () => {
      // Arrange
      const usuarioId = '1';
      const mockParticipantes = [
        {
          id: 1,
          idEncuentro: 1,
          idUsuario: 1,
          rol: 'creador',
        },
      ];

      mockParticipantesEncuentroService.findByUsuario.mockResolvedValue(
        mockParticipantes,
      );

      // Act
      const result = await controller.findAll(undefined, usuarioId);

      // Assert
      expect(result).toEqual(mockParticipantes);
      expect(
        mockParticipantesEncuentroService.findByUsuario,
      ).toHaveBeenCalledWith(1);
    });
  });

  describe('findAllFromView', () => {
    it('debería obtener participantes desde la vista sin filtro', async () => {
      // Arrange
      const mockResult = [
        {
          idEncuentro: 1,
          tituloEncuentro: 'Encuentro Test',
          fecha: new Date(),
          idUsuario: 1,
          nombreCompleto: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockParticipantesEncuentroService.findAllFromView.mockResolvedValue(
        mockResult,
      );

      // Act
      const result = await controller.findAllFromView();

      // Assert
      expect(result).toEqual(mockResult);
      expect(
        mockParticipantesEncuentroService.findAllFromView,
      ).toHaveBeenCalledWith(undefined, undefined);
    });

    it('debería obtener participantes desde la vista filtrados por encuentro', async () => {
      // Arrange
      const encuentroId = '1';
      const mockResult = [
        {
          idEncuentro: 1,
          tituloEncuentro: 'Encuentro Test',
          fecha: new Date(),
          idUsuario: 1,
          nombreCompleto: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockParticipantesEncuentroService.findAllFromView.mockResolvedValue(
        mockResult,
      );

      // Act
      const result = await controller.findAllFromView(encuentroId);

      // Assert
      expect(result).toEqual(mockResult);
      expect(
        mockParticipantesEncuentroService.findAllFromView,
      ).toHaveBeenCalledWith(1, undefined);
    });

    it('debería obtener participantes desde la vista filtrados por usuario', async () => {
      // Arrange
      const usuarioId = '1';
      const mockResult = [
        {
          idEncuentro: 1,
          tituloEncuentro: 'Encuentro Test',
          fecha: new Date(),
          idUsuario: 1,
          nombreCompleto: 'Juan Pérez',
          rol: 'creador',
        },
      ];

      mockParticipantesEncuentroService.findAllFromView.mockResolvedValue(
        mockResult,
      );

      // Act
      const result = await controller.findAllFromView(undefined, usuarioId);

      // Assert
      expect(result).toEqual(mockResult);
      expect(
        mockParticipantesEncuentroService.findAllFromView,
      ).toHaveBeenCalledWith(undefined, 1);
    });
  });

  describe('findParticipantesConAportes', () => {
    it('debería obtener participantes con aportes sin filtro', async () => {
      // Arrange
      const mockResult = [
        {
          idEncuentro: 1,
          nombreEncuentro: 'Encuentro Test',
          idUsuario: 1,
          nombreUsuario: 'Juan',
          apellidoUsuario: 'Pérez',
          nombreCompleto: 'Juan Pérez',
          rol: 'participante',
          totalAportes: 150.5,
        },
      ];

      mockParticipantesEncuentroService.findParticipantesConAportes.mockResolvedValue(
        mockResult,
      );

      // Act
      const result = await controller.findParticipantesConAportes();

      // Assert
      expect(result).toEqual(mockResult);
      expect(
        mockParticipantesEncuentroService.findParticipantesConAportes,
      ).toHaveBeenCalledWith(undefined, undefined);
    });

    it('debería obtener participantes con aportes filtrados por encuentro', async () => {
      // Arrange
      const encuentroId = '1';
      const mockResult = [
        {
          idEncuentro: 1,
          nombreEncuentro: 'Encuentro Test',
          idUsuario: 1,
          nombreUsuario: 'Juan',
          apellidoUsuario: 'Pérez',
          nombreCompleto: 'Juan Pérez',
          rol: 'participante',
          totalAportes: 150.5,
        },
      ];

      mockParticipantesEncuentroService.findParticipantesConAportes.mockResolvedValue(
        mockResult,
      );

      // Act
      const result = await controller.findParticipantesConAportes(encuentroId);

      // Assert
      expect(result).toEqual(mockResult);
      expect(
        mockParticipantesEncuentroService.findParticipantesConAportes,
      ).toHaveBeenCalledWith(1, undefined);
    });

    it('debería convertir totalAportes a número', async () => {
      // Arrange
      const mockResult = [
        {
          idEncuentro: 1,
          nombreEncuentro: 'Encuentro Test',
          idUsuario: 1,
          nombreUsuario: 'Juan',
          apellidoUsuario: 'Pérez',
          nombreCompleto: 'Juan Pérez',
          rol: 'participante',
          totalAportes: 250.75,
        },
      ];

      mockParticipantesEncuentroService.findParticipantesConAportes.mockResolvedValue(
        mockResult,
      );

      // Act
      const result = await controller.findParticipantesConAportes();

      // Assert
      expect(typeof result[0].totalAportes).toBe('number');
      expect(result[0].totalAportes).toBe(250.75);
    });
  });
});
