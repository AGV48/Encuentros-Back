import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroController } from './encuentro.controller';
import { EncuentroService } from './encuentro.service';
import { CreateEncuentroDto } from './dto/create-encuentro.dto';
import { UpdateEncuentroDto } from './dto/update-encuentro.dto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

// Mock del servicio
const mockEncuentroService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findAllWithResumen: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  salirDelEncuentro: jest.fn(),
};

describe('EncuentroController', () => {
  let controller: EncuentroController;
  let service: EncuentroService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EncuentroController],
      providers: [
        {
          provide: EncuentroService,
          useValue: mockEncuentroService,
        },
      ],
    }).compile();

    controller = module.get<EncuentroController>(EncuentroController);
    service = module.get<EncuentroService>(EncuentroService);

    // Limpiar mocks antes de cada prueba
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un encuentro exitosamente', async () => {
      // Arrange
      const createEncuentroDto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro de Prueba',
        descripcion: 'Descripción del encuentro',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000), // Mañana
      };
      mockEncuentroService.create.mockResolvedValue({
        success: true,
      });

      // Act
      const result = await controller.create(createEncuentroDto);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEncuentroService.create).toHaveBeenCalledWith(
        createEncuentroDto,
      );
      expect(mockEncuentroService.create).toHaveBeenCalledTimes(1);
    });

    it('debería lanzar error si la fecha es pasada', async () => {
      // Arrange
      const createEncuentroDto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Pasado',
        descripcion: 'Descripción',
        lugar: 'Madrid',
        fecha: new Date(Date.now() - 86400000), // Ayer
      };
      mockEncuentroService.create.mockRejectedValue(
        new BadRequestException(
          'La fecha del encuentro no puede ser anterior a la fecha actual',
        ),
      );

      // Act & Assert
      await expect(controller.create(createEncuentroDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debería lanzar error si faltan datos obligatorios', async () => {
      // Arrange
      const createEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro',
        // Faltan descripcion, lugar y fecha
      } as CreateEncuentroDto;

      mockEncuentroService.create.mockRejectedValue(
        new BadRequestException('Faltan datos obligatorios'),
      );

      // Act & Assert
      await expect(controller.create(createEncuentroDto)).rejects.toThrow(
        BadRequestException,
      );
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
        },
        {
          id: 2,
          idCreador: 2,
          titulo: 'Encuentro 2',
          descripcion: 'Descripción 2',
          lugar: 'Barcelona',
          fecha: new Date(),
        },
      ];
      mockEncuentroService.findAll.mockResolvedValue(mockEncuentros);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockEncuentros);
      expect(mockEncuentroService.findAll).toHaveBeenCalledWith(undefined);
      expect(mockEncuentroService.findAll).toHaveBeenCalledTimes(1);
    });

    it('debería obtener encuentros filtrados por creador', async () => {
      // Arrange
      const creadorId = '1';
      const mockEncuentros = [
        {
          id: 1,
          idCreador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
        },
      ];
      mockEncuentroService.findAll.mockResolvedValue(mockEncuentros);

      // Act
      const result = await controller.findAll(creadorId);

      // Assert
      expect(result).toEqual(mockEncuentros);
      expect(mockEncuentroService.findAll).toHaveBeenCalledWith(1);
    });

    it('debería devolver lista vacía cuando no hay encuentros', async () => {
      // Arrange
      mockEncuentroService.findAll.mockResolvedValue([]);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual([]);
      expect(mockEncuentroService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAllWithResumen', () => {
    it('debería obtener encuentros con resumen sin filtro', async () => {
      // Arrange
      const mockEncuentros = [
        {
          id: 1,
          idCreador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          cantParticipantes: 5,
          presupuestoTotal: 100,
        },
      ];
      mockEncuentroService.findAllWithResumen.mockResolvedValue(
        mockEncuentros,
      );

      // Act
      const result = await controller.findAllWithResumen();

      // Assert
      expect(result).toEqual(mockEncuentros);
      expect(result[0].cantParticipantes).toBe(5);
      expect(result[0].presupuestoTotal).toBe(100);
    });

    it('debería obtener encuentros con resumen filtrados por creador', async () => {
      // Arrange
      const creadorId = '1';
      const mockEncuentros = [
        {
          id: 1,
          idCreador: 1,
          titulo: 'Encuentro 1',
          descripcion: 'Descripción 1',
          lugar: 'Madrid',
          fecha: new Date(),
          cantParticipantes: 5,
          presupuestoTotal: 100,
        },
      ];
      mockEncuentroService.findAllWithResumen.mockResolvedValue(
        mockEncuentros,
      );

      // Act
      const result = await controller.findAllWithResumen(creadorId);

      // Assert
      expect(result).toEqual(mockEncuentros);
      expect(mockEncuentroService.findAllWithResumen).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('debería obtener un encuentro por ID', async () => {
      // Arrange
      const id = '1';
      const mockEncuentro = {
        id: 1,
        idCreador: 1,
        titulo: 'Encuentro 1',
        descripcion: 'Descripción 1',
        lugar: 'Madrid',
        fecha: new Date(),
      };
      mockEncuentroService.findOne.mockResolvedValue(mockEncuentro);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toEqual(mockEncuentro);
      expect(mockEncuentroService.findOne).toHaveBeenCalledWith(1);
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const id = '999';
      mockEncuentroService.findOne.mockResolvedValue(null);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toBeNull();
      expect(mockEncuentroService.findOne).toHaveBeenCalledWith(999);
    });
  });

  describe('update', () => {
    it('debería actualizar un encuentro exitosamente', async () => {
      // Arrange
      const id = '1';
      const updateEncuentroDto: UpdateEncuentroDto = {
        titulo: 'Encuentro Actualizado',
        descripcion: 'Nueva descripción',
      };
      const idUsuario = 1;
      const mockResponse = {
        success: true,
        message: 'El encuentro ha sido actualizado correctamente',
        encuentro: {
          id: 1,
          idCreador: 1,
          titulo: 'Encuentro Actualizado',
          descripcion: 'Nueva descripción',
          lugar: 'Madrid',
          fecha: new Date(),
        },
      };
      mockEncuentroService.update.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.update(id, updateEncuentroDto, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEncuentroService.update).toHaveBeenCalledWith(
        1,
        updateEncuentroDto,
        idUsuario,
      );
    });

    it('debería lanzar ForbiddenException si el usuario no es creador', async () => {
      // Arrange
      const id = '1';
      const updateEncuentroDto: UpdateEncuentroDto = {
        titulo: 'Encuentro Actualizado',
      };
      const idUsuario = 2; // Usuario diferente al creador
      mockEncuentroService.update.mockRejectedValue(
        new ForbiddenException('Solo el creador puede editar este encuentro'),
      );

      // Act & Assert
      await expect(
        controller.update(id, updateEncuentroDto, idUsuario),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const id = '999';
      const updateEncuentroDto: UpdateEncuentroDto = {
        titulo: 'Encuentro Actualizado',
      };
      const idUsuario = 1;
      mockEncuentroService.update.mockRejectedValue(
        new NotFoundException('El encuentro no existe'),
      );

      // Act & Assert
      await expect(
        controller.update(id, updateEncuentroDto, idUsuario),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería validar que la fecha no sea pasada', async () => {
      // Arrange
      const id = '1';
      const updateEncuentroDto: UpdateEncuentroDto = {
        fecha: new Date(Date.now() - 86400000), // Fecha pasada
      };
      const idUsuario = 1;
      mockEncuentroService.update.mockRejectedValue(
        new BadRequestException(
          'La fecha del encuentro no puede ser anterior a la fecha actual',
        ),
      );

      // Act & Assert
      await expect(
        controller.update(id, updateEncuentroDto, idUsuario),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('debería eliminar un encuentro exitosamente', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 1;
      const mockResponse = {
        success: true,
        message: 'El encuentro ha sido eliminado correctamente',
      };
      mockEncuentroService.remove.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.remove(id, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEncuentroService.remove).toHaveBeenCalledWith(1, idUsuario);
    });

    it('debería lanzar ForbiddenException si no es el creador', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 2; // Usuario diferente al creador
      mockEncuentroService.remove.mockRejectedValue(
        new ForbiddenException('Solo el creador puede eliminar este encuentro'),
      );

      // Act & Assert
      await expect(controller.remove(id, idUsuario)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const id = '999';
      const idUsuario = 1;
      mockEncuentroService.remove.mockRejectedValue(
        new NotFoundException('El encuentro no existe'),
      );

      // Act & Assert
      await expect(controller.remove(id, idUsuario)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('salirDelEncuentro', () => {
    it('debería permitir que un participante salga del encuentro', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 2; // Participante, no creador
      const mockResponse = {
        success: true,
        message: 'Has salido del encuentro correctamente',
      };
      mockEncuentroService.salirDelEncuentro.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.salirDelEncuentro(id, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEncuentroService.salirDelEncuentro).toHaveBeenCalledWith(
        1,
        idUsuario,
      );
    });

    it('debería lanzar ForbiddenException si el usuario es creador', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 1; // Creador
      mockEncuentroService.salirDelEncuentro.mockRejectedValue(
        new ForbiddenException(
          'El creador no puede salir de su propio encuentro. Debe eliminarlo si desea cancelarlo.',
        ),
      );

      // Act & Assert
      await expect(
        controller.salirDelEncuentro(id, idUsuario),
      ).rejects.toThrow(ForbiddenException);
    });

    it('debería lanzar NotFoundException si el encuentro no existe', async () => {
      // Arrange
      const id = '999';
      const idUsuario = 2;
      mockEncuentroService.salirDelEncuentro.mockRejectedValue(
        new NotFoundException('El encuentro no existe'),
      );

      // Act & Assert
      await expect(
        controller.salirDelEncuentro(id, idUsuario),
      ).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar NotFoundException si no eres participante', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 3; // No es participante
      mockEncuentroService.salirDelEncuentro.mockRejectedValue(
        new NotFoundException('No eres participante de este encuentro'),
      );

      // Act & Assert
      await expect(
        controller.salirDelEncuentro(id, idUsuario),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
