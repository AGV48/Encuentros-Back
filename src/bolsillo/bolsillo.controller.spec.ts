import { Test, TestingModule } from '@nestjs/testing';
import { BolsilloController } from './bolsillo.controller';
import { BolsilloService } from './bolsillo.service';
import { CreateBolsilloDto } from './dto/create-bolsillo.dto';
import { UpdateBolsilloDto } from './dto/update-bolsillo.dto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockBolsilloService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByEncuentro: jest.fn(),
  findByPresupuesto: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('BolsilloController', () => {
  let controller: BolsilloController;
  let service: BolsilloService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BolsilloController],
      providers: [
        {
          provide: BolsilloService,
          useValue: mockBolsilloService,
        },
      ],
    }).compile();

    controller = module.get<BolsilloController>(BolsilloController);
    service = module.get<BolsilloService>(BolsilloService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un bolsillo exitosamente', async () => {
      // Arrange
      const createBolsilloDto: CreateBolsilloDto = {
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 0,
      };

      const mockBolsillo = {
        id: 1,
        ...createBolsilloDto,
      };

      mockBolsilloService.create.mockResolvedValue(mockBolsillo);

      // Act
      const result = await controller.create(createBolsilloDto);

      // Assert
      expect(result).toEqual(mockBolsillo);
      expect(mockBolsilloService.create).toHaveBeenCalledWith(createBolsilloDto);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los bolsillos sin filtro', async () => {
      // Arrange
      const mockBolsillos = [
        {
          id: 1,
          idEncuentro: 1,
          nombre: 'Comida',
          saldoActual: 500,
        },
      ];

      mockBolsilloService.findAll.mockResolvedValue(mockBolsillos);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockBolsillos);
      expect(mockBolsilloService.findAll).toHaveBeenCalled();
    });

    it('debería obtener bolsillos filtrados por encuentro', async () => {
      // Arrange
      const encuentroId = '1';
      const mockBolsillos = [
        {
          id: 1,
          idEncuentro: 1,
          nombre: 'Comida',
          saldoActual: 500,
        },
      ];

      mockBolsilloService.findByEncuentro.mockResolvedValue(mockBolsillos);

      // Act
      const result = await controller.findAll(encuentroId);

      // Assert
      expect(result).toEqual(mockBolsillos);
      expect(mockBolsilloService.findByEncuentro).toHaveBeenCalledWith(1);
    });

    it('debería obtener bolsillos filtrados por presupuesto', async () => {
      // Arrange
      const presupuestoId = '1';
      const mockBolsillos = [
        {
          id: 1,
          idPresupuesto: 1,
          idEncuentro: 1,
          nombre: 'Comida',
          saldoActual: 500,
        },
      ];

      mockBolsilloService.findByPresupuesto.mockResolvedValue(mockBolsillos);

      // Act
      const result = await controller.findAll(undefined, presupuestoId);

      // Assert
      expect(result).toEqual(mockBolsillos);
      expect(mockBolsilloService.findByPresupuesto).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('debería obtener un bolsillo por ID', async () => {
      // Arrange
      const id = '1';
      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida',
        saldoActual: 500,
      };

      mockBolsilloService.findOne.mockResolvedValue(mockBolsillo);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toEqual(mockBolsillo);
      expect(mockBolsilloService.findOne).toHaveBeenCalledWith(1);
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = '999';
      mockBolsilloService.findOne.mockRejectedValue(
        new NotFoundException('Bolsillo con ID 999 no encontrado'),
      );

      // Act & Assert
      await expect(controller.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debería actualizar un bolsillo exitosamente', async () => {
      // Arrange
      const id = '1';
      const updateBolsilloDto: UpdateBolsilloDto = {
        nombre: 'Comida Actualizada',
      };

      const mockBolsillo = {
        id: 1,
        idEncuentro: 1,
        nombre: 'Comida Actualizada',
        saldoActual: 500,
      };

      mockBolsilloService.update.mockResolvedValue(mockBolsillo);

      // Act
      const result = await controller.update(id, updateBolsilloDto);

      // Assert
      expect(result.nombre).toBe('Comida Actualizada');
      expect(mockBolsilloService.update).toHaveBeenCalledWith(
        1,
        updateBolsilloDto,
      );
    });
  });

  describe('remove', () => {
    it('debería eliminar un bolsillo exitosamente', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 1;
      const mockResponse = {
        success: true,
        message: 'Bolsillo eliminado correctamente',
      };

      mockBolsilloService.remove.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.remove(id, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(mockBolsilloService.remove).toHaveBeenCalledWith(1, idUsuario);
    });

    it('debería lanzar ForbiddenException si no es el creador del encuentro', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 2;

      mockBolsilloService.remove.mockRejectedValue(
        new ForbiddenException('Solo el creador puede eliminar bolsillos'),
      );

      // Act & Assert
      await expect(controller.remove(id, idUsuario)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('debería lanzar ForbiddenException si tiene aportes asociados', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 1;

      mockBolsilloService.remove.mockRejectedValue(
        new ForbiddenException(
          'No se puede eliminar el bolsillo porque tiene aportes asociados. Elimina primero los aportes.',
        ),
      );

      // Act & Assert
      await expect(controller.remove(id, idUsuario)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
