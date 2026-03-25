import { Test, TestingModule } from '@nestjs/testing';
import { PresupuestoController } from './presupuesto.controller';
import { PresupuestoService } from './presupuesto.service';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto';
import { CreateItemPresupuestoDto } from './dto/create-item-presupuesto.dto';
import { NotFoundException } from '@nestjs/common';

const mockPresupuestoService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findByEncuentro: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  agregarItem: jest.fn(),
  getItems: jest.fn(),
  removeItem: jest.fn(),
};

describe('PresupuestoController', () => {
  let controller: PresupuestoController;
  let service: PresupuestoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PresupuestoController],
      providers: [
        {
          provide: PresupuestoService,
          useValue: mockPresupuestoService,
        },
      ],
    }).compile();

    controller = module.get<PresupuestoController>(PresupuestoController);
    service = module.get<PresupuestoService>(PresupuestoService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un presupuesto exitosamente', async () => {
      // Arrange
      const createPresupuestoDto: CreatePresupuestoDto = {
        idEncuentro: 1,
      };

      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 0,
      };

      mockPresupuestoService.create.mockResolvedValue(mockPresupuesto);

      // Act
      const result = await controller.create(createPresupuestoDto);

      // Assert
      expect(result).toEqual(mockPresupuesto);
      expect(mockPresupuestoService.create).toHaveBeenCalledWith(
        createPresupuestoDto,
      );
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los presupuestos sin filtro', async () => {
      // Arrange
      const mockPresupuestos = [
        {
          id: 1,
          idEncuentro: 1,
          presupuestoTotal: 1000,
        },
      ];

      mockPresupuestoService.findAll.mockResolvedValue(mockPresupuestos);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockPresupuestos);
      expect(mockPresupuestoService.findAll).toHaveBeenCalled();
    });

    it('debería obtener presupuesto filtrado por encuentro', async () => {
      // Arrange
      const encuentroId = '1';
      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 1000,
      };

      mockPresupuestoService.findByEncuentro.mockResolvedValue(mockPresupuesto);

      // Act
      const result = await controller.findAll(encuentroId);

      // Assert
      expect(result).toEqual(mockPresupuesto);
      expect(mockPresupuestoService.findByEncuentro).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('debería obtener un presupuesto por ID', async () => {
      // Arrange
      const id = '1';
      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 1000,
        items: [],
      };

      mockPresupuestoService.findOne.mockResolvedValue(mockPresupuesto);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toEqual(mockPresupuesto);
      expect(mockPresupuestoService.findOne).toHaveBeenCalledWith(1);
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      // Arrange
      const id = '999';
      mockPresupuestoService.findOne.mockRejectedValue(
        new NotFoundException('Presupuesto con ID 999 no encontrado'),
      );

      // Act & Assert
      await expect(controller.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('debería actualizar un presupuesto exitosamente', async () => {
      // Arrange
      const id = '1';
      const updatePresupuestoDto: UpdatePresupuestoDto = {};

      const mockPresupuesto = {
        id: 1,
        idEncuentro: 1,
        presupuestoTotal: 5000,
      };

      mockPresupuestoService.update.mockResolvedValue(mockPresupuesto);

      // Act
      const result = await controller.update(id, updatePresupuestoDto);

      // Assert
      expect(result.presupuestoTotal).toBe(5000);
      expect(mockPresupuestoService.update).toHaveBeenCalledWith(
        1,
        updatePresupuestoDto,
      );
    });
  });

  describe('remove', () => {
    it('debería eliminar un presupuesto exitosamente', async () => {
      // Arrange
      const id = '1';
      mockPresupuestoService.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove(id);

      // Assert
      expect(mockPresupuestoService.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('agregarItem', () => {
    it('debería agregar un item al presupuesto', async () => {
      // Arrange
      const createItemDto: CreateItemPresupuestoDto = {
        idPresupuesto: 1,
        idEncuentro: 1,
        nombreItem: 'Comida',
        montoItem: 250.5,
      };

      const mockItem = {
        id: 1,
        ...createItemDto,
      };

      mockPresupuestoService.agregarItem.mockResolvedValue(mockItem);

      // Act
      const result = await controller.agregarItem(createItemDto);

      // Assert
      expect(result).toEqual(mockItem);
      expect(mockPresupuestoService.agregarItem).toHaveBeenCalledWith(
        createItemDto,
      );
    });
  });

  describe('getItems', () => {
    it('debería obtener items de un presupuesto', async () => {
      // Arrange
      const id = '1';
      const mockItems = [
        {
          id: 1,
          idPresupuesto: 1,
          nombreItem: 'Comida',
          montoItem: 250,
        },
        {
          id: 2,
          idPresupuesto: 1,
          nombreItem: 'Bebidas',
          montoItem: 100,
        },
      ];

      mockPresupuestoService.getItems.mockResolvedValue(mockItems);

      // Act
      const result = await controller.getItems(id);

      // Assert
      expect(result).toEqual(mockItems);
      expect(result).toHaveLength(2);
      expect(mockPresupuestoService.getItems).toHaveBeenCalledWith(1);
    });

    it('debería devolver lista vacía si no hay items', async () => {
      // Arrange
      const id = '1';
      mockPresupuestoService.getItems.mockResolvedValue([]);

      // Act
      const result = await controller.getItems(id);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('removeItem', () => {
    it('debería eliminar un item del presupuesto', async () => {
      // Arrange
      const id = '1';
      const idUsuario = 1;
      const mockResponse = {
        success: true,
        message: 'Item eliminado correctamente',
      };

      mockPresupuestoService.removeItem.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.removeItem(id, idUsuario);

      // Assert
      expect(result.success).toBe(true);
      expect(mockPresupuestoService.removeItem).toHaveBeenCalledWith(1, idUsuario);
    });

    it('debería lanzar NotFoundException si el item no existe', async () => {
      // Arrange
      const id = '999';
      const idUsuario = 1;

      mockPresupuestoService.removeItem.mockRejectedValue(
        new NotFoundException('Item de presupuesto no encontrado'),
      );

      // Act & Assert
      await expect(controller.removeItem(id, idUsuario)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
