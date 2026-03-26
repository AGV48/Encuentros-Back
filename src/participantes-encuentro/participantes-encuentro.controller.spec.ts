import { Test, TestingModule } from '@nestjs/testing';
import { ParticipantesEncuentroController } from './participantes-encuentro.controller';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';

describe('ParticipantesEncuentroController', () => {
  let controller: ParticipantesEncuentroController;
  let service: ParticipantesEncuentroService;

  const mockParticipante = {
    id: 1,
    idEncuentro: 1,
    idUsuario: 2,
    rol: 'participante',
    encuentro: { id: 1, titulo: 'Viaje' },
    usuario: { id: 2, nombre: 'Juan' },
  };

  const mockViewParticipante = {
    idEncuentro: 1,
    tituloEncuentro: 'Viaje a la playa',
    fecha: new Date(),
    idUsuario: 2,
    nombreCompleto: 'Juan Pérez',
    rol: 'participante',
  };

  const mockAportesData = {
    idEncuentro: 1,
    nombreEncuentro: 'Viaje',
    idUsuario: 2,
    nombreUsuario: 'Juan',
    apellidoUsuario: 'Pérez',
    nombreCompleto: 'Juan Pérez',
    rol: 'participante',
    totalAportes: 100.5,
  };

  beforeEach(async () => {
    const mockService = {
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
      findAportesByUsuario: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParticipantesEncuentroController],
      providers: [
        {
          provide: ParticipantesEncuentroService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ParticipantesEncuentroController>(
      ParticipantesEncuentroController,
    );
    service = module.get<ParticipantesEncuentroService>(ParticipantesEncuentroService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a participant', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
        rol: 'participante',
      };

      (service.create as jest.Mock).mockResolvedValue(mockParticipante);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockParticipante);
    });

    it('should throw ConflictException on create error', async () => {
      const createDto: CreateParticipanteDto = {
        idEncuentro: 1,
        idUsuario: 2,
        idSolicitante: 1,
        rol: 'participante',
      };

      (service.create as jest.Mock).mockRejectedValue(
        new ConflictException('Ya existe'),
      );

      await expect(controller.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all participants', async () => {
      (service.findAll as jest.Mock).mockResolvedValue([mockParticipante]);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockParticipante]);
    });

    it('should return participants by encuentro', async () => {
      (service.findByEncuentro as jest.Mock).mockResolvedValue([mockParticipante]);

      const result = await controller.findAll('1', undefined);

      expect(service.findByEncuentro).toHaveBeenCalledWith(1);
      expect(result).toEqual([mockParticipante]);
    });

    it('should return participants by usuario', async () => {
      (service.findByUsuario as jest.Mock).mockResolvedValue([mockParticipante]);

      const result = await controller.findAll(undefined, '2');

      expect(service.findByUsuario).toHaveBeenCalledWith(2);
      expect(result).toEqual([mockParticipante]);
    });

    it('should prioritize encuentro over usuario query', async () => {
      (service.findByEncuentro as jest.Mock).mockResolvedValue([mockParticipante]);

      const result = await controller.findAll('1', '2');

      expect(service.findByEncuentro).toHaveBeenCalledWith(1);
      expect(service.findByUsuario).not.toHaveBeenCalled();
    });
  });

  describe('findAllFromView', () => {
    it('should return all participants from view', async () => {
      (service.findAllFromView as jest.Mock).mockResolvedValue([mockViewParticipante]);

      const result = await controller.findAllFromView();

      expect(service.findAllFromView).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual([mockViewParticipante]);
    });

    it('should return participants from view filtered by encuentro', async () => {
      (service.findAllFromView as jest.Mock).mockResolvedValue([mockViewParticipante]);

      const result = await controller.findAllFromView('1', undefined);

      expect(service.findAllFromView).toHaveBeenCalledWith(1, undefined);
      expect(result).toEqual([mockViewParticipante]);
    });

    it('should return participants from view filtered by usuario', async () => {
      (service.findAllFromView as jest.Mock).mockResolvedValue([mockViewParticipante]);

      const result = await controller.findAllFromView(undefined, '2');

      expect(service.findAllFromView).toHaveBeenCalledWith(undefined, 2);
      expect(result).toEqual([mockViewParticipante]);
    });
  });

  describe('findParticipantesConAportes', () => {
    it('should return participants with contributions', async () => {
      (service.findParticipantesConAportes as jest.Mock).mockResolvedValue([
        mockAportesData,
      ]);

      const result = await controller.findParticipantesConAportes();

      expect(service.findParticipantesConAportes).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
      expect(result).toEqual([mockAportesData]);
    });

    it('should return contributions filtered by encuentro', async () => {
      (service.findParticipantesConAportes as jest.Mock).mockResolvedValue([
        mockAportesData,
      ]);

      const result = await controller.findParticipantesConAportes('1', undefined);

      expect(service.findParticipantesConAportes).toHaveBeenCalledWith(1, undefined);
      expect(result).toEqual([mockAportesData]);
    });

    it('should return contributions filtered by usuario', async () => {
      (service.findParticipantesConAportes as jest.Mock).mockResolvedValue([
        mockAportesData,
      ]);

      const result = await controller.findParticipantesConAportes(undefined, '2');

      expect(service.findParticipantesConAportes).toHaveBeenCalledWith(undefined, 2);
      expect(result).toEqual([mockAportesData]);
    });
  });

  describe('findOne', () => {
    it('should return a participant by ID', async () => {
      (service.findOne as jest.Mock).mockResolvedValue(mockParticipante);

      const result = await controller.findOne('1');

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockParticipante);
    });

    it('should throw NotFoundException if not found', async () => {
      (service.findOne as jest.Mock).mockRejectedValue(new NotFoundException());

      await expect(controller.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a participant', async () => {
      const updateDto: UpdateParticipanteDto = { rol: 'organizador' };
      const updated = { ...mockParticipante, rol: 'organizador' };

      (service.update as jest.Mock).mockResolvedValue(updated);

      const result = await controller.update('1', updateDto);

      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result.rol).toBe('organizador');
    });
  });

  describe('remove', () => {
    it('should remove a participant', async () => {
      const removeMessage = { message: 'Participante eliminado correctamente' };
      (service.remove as jest.Mock).mockResolvedValue(removeMessage);

      const result = await controller.remove('1');

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result.message).toBe('Participante eliminado correctamente');
    });
  });

  describe('removeByEncuentroAndUsuario', () => {
    it('should remove user from encuentro', async () => {
      const removeMessage = { message: 'Has salido del encuentro correctamente' };
      (service.removeByEncuentroAndUsuario as jest.Mock).mockResolvedValue(removeMessage);

      const result = await controller.removeByEncuentroAndUsuario('1', '2');

      expect(service.removeByEncuentroAndUsuario).toHaveBeenCalledWith(1, 2);
      expect(result.message).toBe('Has salido del encuentro correctamente');
    });

    it('should throw ForbiddenException if user is creator', async () => {
      (service.removeByEncuentroAndUsuario as jest.Mock).mockRejectedValue(
        new ForbiddenException('El creador no puede salir'),
      );

      await expect(
        controller.removeByEncuentroAndUsuario('1', '1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if not a participant', async () => {
      (service.removeByEncuentroAndUsuario as jest.Mock).mockRejectedValue(
        new NotFoundException('No eres participante'),
      );

      await expect(
        controller.removeByEncuentroAndUsuario('1', '999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('controller definition', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });
});
