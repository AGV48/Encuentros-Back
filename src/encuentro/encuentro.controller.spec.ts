import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroController } from './encuentro.controller';
import { EncuentroService } from './encuentro.service';
import { CreateEncuentroDto } from './dto/create-encuentro.dto';
import { UpdateEncuentroDto } from './dto/update-encuentro.dto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

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

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un encuentro exitosamente', async () => {
      const dto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Desc',
        lugar: 'Madrid',
        fecha: new Date(Date.now() + 86400000),
      };
      mockEncuentroService.create.mockResolvedValue({ success: true });
      const result = await controller.create(dto);
      expect(result.success).toBe(true);
      expect(mockEncuentroService.create).toHaveBeenCalledWith(dto);
    });

    it('debería manejar error con fecha pasada', async () => {
      const dto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Encuentro Test',
        descripcion: 'Desc',
        lugar: 'Madrid',
        fecha: new Date(Date.now() - 86400000),
      };
      mockEncuentroService.create.mockRejectedValue(new BadRequestException('La fecha del encuentro no puede ser anterior'));
      await expect(controller.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los encuentros sin filtro', async () => {
      mockEncuentroService.findAll.mockResolvedValue([]);
      const result = await controller.findAll();
      expect(result).toEqual([]);
      expect(mockEncuentroService.findAll).toHaveBeenCalledWith(undefined);
    });

    it('debería obtener encuentros filtrados por creador', async () => {
      const mockEnc = [{ id: 1, idCreador: 1 }];
      mockEncuentroService.findAll.mockResolvedValue(mockEnc);
      const result = await controller.findAll('1');
      expect(result).toEqual(mockEnc);
      expect(mockEncuentroService.findAll).toHaveBeenCalledWith(1);
    });
  });

  describe('findAllWithResumen', () => {
    it('debería obtener encuentros con resumen', async () => {
      const mockEnc = [{ id: 1, titulo: 'Test', presupuestoTotal: 100 }];
      mockEncuentroService.findAllWithResumen.mockResolvedValue(mockEnc);
      const result = await controller.findAllWithResumen();
      expect(result).toEqual(mockEnc);
      expect(mockEncuentroService.findAllWithResumen).toHaveBeenCalledWith(undefined);
    });

    it('debería obtener encuentros con resumen filtrados por creador', async () => {
      const mockEnc = [{ id: 1, titulo: 'Test', presupuestoTotal: 100 }];
      mockEncuentroService.findAllWithResumen.mockResolvedValue(mockEnc);
      const result = await controller.findAllWithResumen('1');
      expect(result).toEqual(mockEnc);
      expect(mockEncuentroService.findAllWithResumen).toHaveBeenCalledWith(1);
    });
  });

  describe('findOne', () => {
    it('debería obtener un encuentro por ID', async () => {
      const mockEnc = { id: 1, titulo: 'Test', idCreador: 1 };
      mockEncuentroService.findOne.mockResolvedValue(mockEnc);
      const result = await controller.findOne('1');
      expect(result).toEqual(mockEnc);
      expect(mockEncuentroService.findOne).toHaveBeenCalledWith(1);
    });

    it('debería retornar null si el encuentro no existe', async () => {
      mockEncuentroService.findOne.mockResolvedValue(null);
      const result = await controller.findOne('999');
      expect(result).toBeNull();
    });

    it('debería convertir el ID de string a número', async () => {
      const mockEnc = { id: 1 };
      mockEncuentroService.findOne.mockResolvedValue(mockEnc);
      await controller.findOne('123');
      expect(mockEncuentroService.findOne).toHaveBeenCalledWith(123);
    });
  });

  describe('update', () => {
    it('debería actualizar un encuentro exitosamente', async () => {
      const dto: UpdateEncuentroDto = { titulo: 'Nuevo' };
      const mockResult = { success: true, encuentro: { id: 1, titulo: 'Nuevo' } };
      mockEncuentroService.update.mockResolvedValue(mockResult);
      const result = await controller.update('1', dto, 1);
      expect(result.success).toBe(true);
      expect(mockEncuentroService.update).toHaveBeenCalledWith(1, dto, 1);
    });

    it('debería manejar error cuando no es el creador', async () => {
      mockEncuentroService.update.mockRejectedValue(new ForbiddenException('Solo el creador puede editar este encuentro'));
      const dto: UpdateEncuentroDto = { titulo: 'Nuevo' };
      await expect(controller.update('1', dto, 2)).rejects.toThrow(ForbiddenException);
    });

    it('debería manejar error cuando el encuentro no existe', async () => {
      mockEncuentroService.update.mockRejectedValue(new NotFoundException('El encuentro no existe'));
      const dto: UpdateEncuentroDto = { titulo: 'Nuevo' };
      await expect(controller.update('999', dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('debería manejar error con fecha pasada', async () => {
      mockEncuentroService.update.mockRejectedValue(new BadRequestException('La fecha del encuentro no puede ser anterior'));
      const dto: UpdateEncuentroDto = { fecha: new Date(Date.now() - 86400000) };
      await expect(controller.update('1', dto, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('debería eliminar un encuentro exitosamente', async () => {
      mockEncuentroService.remove.mockResolvedValue({ success: true, message: 'El encuentro ha sido eliminado correctamente' });
      const result = await controller.remove('1', 1);
      expect(result.success).toBe(true);
      expect(mockEncuentroService.remove).toHaveBeenCalledWith(1, 1);
    });

    it('debería manejar error cuando no es el creador', async () => {
      mockEncuentroService.remove.mockRejectedValue(new ForbiddenException('Solo el creador puede eliminar este encuentro'));
      await expect(controller.remove('1', 2)).rejects.toThrow(ForbiddenException);
    });

    it('debería manejar error cuando el encuentro no existe', async () => {
      mockEncuentroService.remove.mockRejectedValue(new NotFoundException('El encuentro no existe'));
      await expect(controller.remove('999', 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('salirDelEncuentro', () => {
    it('debería permitir salir del encuentro exitosamente', async () => {
      mockEncuentroService.salirDelEncuentro.mockResolvedValue({ success: true, message: 'Has salido del encuentro correctamente' });
      const result = await controller.salirDelEncuentro('1', 2);
      expect(result.success).toBe(true);
      expect(mockEncuentroService.salirDelEncuentro).toHaveBeenCalledWith(1, 2);
    });

    it('debería manejar error cuando el creador intenta salir', async () => {
      mockEncuentroService.salirDelEncuentro.mockRejectedValue(new ForbiddenException('El creador no puede salir de su propio encuentro'));
      await expect(controller.salirDelEncuentro('1', 1)).rejects.toThrow(ForbiddenException);
    });

    it('debería manejar error cuando el encuentro no existe', async () => {
      mockEncuentroService.salirDelEncuentro.mockRejectedValue(new NotFoundException('El encuentro no existe'));
      await expect(controller.salirDelEncuentro('999', 2)).rejects.toThrow(NotFoundException);
    });

    it('debería manejar error cuando no es participante', async () => {
      mockEncuentroService.salirDelEncuentro.mockRejectedValue(new NotFoundException('No eres participante de este encuentro'));
      await expect(controller.salirDelEncuentro('1', 2)).rejects.toThrow('No eres participante');
    });
  });
});
