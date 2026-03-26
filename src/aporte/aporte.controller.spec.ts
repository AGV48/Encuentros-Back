import { Test, TestingModule } from '@nestjs/testing';
import { AporteController } from './aporte.controller';
import { AporteService } from './aporte.service';
import { CreateAporteDto } from './dto/create-aporte.dto';
import { UpdateAporteDto } from './dto/update-aporte.dto';
import { NotFoundException } from '@nestjs/common';

const mockAporteService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByEncuentro: jest.fn(),
  findByBolsillo: jest.fn(),
  findByUsuario: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  agregarAporte: jest.fn(),
};

describe('AporteController', () => {
  let controller: AporteController;
  let service: AporteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AporteController],
      providers: [
        {
          provide: AporteService,
          useValue: mockAporteService,
        },
      ],
    }).compile();

    controller = module.get<AporteController>(AporteController);
    service = module.get<AporteService>(AporteService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debería agregar un aporte exitosamente', async () => {
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

      mockAporteService.agregarAporte.mockResolvedValue(mockAporte);

      // Act
      const result = await controller.create(createAporteDto);

      // Assert
      expect(result).toEqual(mockAporte);
      expect(mockAporteService.agregarAporte).toHaveBeenCalledWith(
        createAporteDto,
      );
    });

    it('debería validar que idBolsillo sea requerido', async () => {
      // Arrange
      const createAporteDto = {
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250.5,
      } as CreateAporteDto;

      mockAporteService.agregarAporte.mockRejectedValue(
        new Error(
          'Los campos idBolsillo e idUsuario son requeridos para agregar un aporte',
        ),
      );

      // Act & Assert
      await expect(controller.create(createAporteDto)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los aportes sin filtro', async () => {
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

      mockAporteService.findAll.mockResolvedValue(mockAportes);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockAportes);
      expect(mockAporteService.findAll).toHaveBeenCalled();
    });

    it('debería obtener aportes filtrados por encuentro', async () => {
      // Arrange
      const encuentroId = '1';
      const mockAportes = [
        {
          id: 1,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 1,
          monto: 250,
        },
      ];

      mockAporteService.findByEncuentro.mockResolvedValue(mockAportes);

      // Act
      const result = await controller.findAll(encuentroId);

      // Assert
      expect(result).toEqual(mockAportes);
      expect(mockAporteService.findByEncuentro).toHaveBeenCalledWith(1);
    });

    it('debería obtener aportes filtrados por bolsillo', async () => {
      // Arrange
      const bolsilloId = '1';
      const mockAportes = [
        {
          id: 1,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 1,
          monto: 250,
        },
      ];

      mockAporteService.findByBolsillo.mockResolvedValue(mockAportes);

      // Act
      const result = await controller.findAll(undefined, bolsilloId);

      // Assert
      expect(result).toEqual(mockAportes);
      expect(mockAporteService.findByBolsillo).toHaveBeenCalledWith(1);
    });

    it('debería obtener aportes filtrados por usuario', async () => {
      // Arrange
      const usuarioId = '1';
      const mockAportes = [
        {
          id: 1,
          idBolsillo: 1,
          idEncuentro: 1,
          idUsuario: 1,
          monto: 250,
        },
      ];

      mockAporteService.findByUsuario.mockResolvedValue(mockAportes);

      // Act
      const result = await controller.findAll(undefined, undefined, usuarioId);

      // Assert
      expect(result).toEqual(mockAportes);
      expect(mockAporteService.findByUsuario).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('debería obtener un aporte por ID', async () => {
      // Arrange
      const id = '1';
      const mockAporte = {
        id: 1,
        idBolsillo: 1,
        idEncuentro: 1,
        idUsuario: 1,
        monto: 250,
        fechaAporte: new Date(),
      };

      mockAporteService.findOne.mockResolvedValue(mockAporte);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toEqual(mockAporte);
      expect(mockAporteService.findOne).toHaveBeenCalledWith(1);
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = '999';
      mockAporteService.findOne.mockResolvedValue(null);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('debería actualizar un aporte exitosamente', async () => {
      // Arrange
      const id = '1';
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

      mockAporteService.update.mockResolvedValue(mockAporte);

      // Act
      const result = await controller.update(id, updateAporteDto);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.monto).toBe(300);
      expect(mockAporteService.update).toHaveBeenCalledWith(1, updateAporteDto);
    });
  });

  describe('remove', () => {
    it('debería eliminar un aporte exitosamente', async () => {
      // Arrange
      const id = '1';
      mockAporteService.remove.mockResolvedValue({ affected: 1 });

      // Act
      const result = await controller.remove(id);

      // Assert
      expect(mockAporteService.remove).toHaveBeenCalledWith(1);
    });
  });
});
