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
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los encuentros', async () => {
      mockEncuentroService.findAll.mockResolvedValue([]);
      const result = await controller.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('debería obtener un encuentro por ID', async () => {
      const mockEnc = { id: 1 };
      mockEncuentroService.findOne.mockResolvedValue(mockEnc);
      const result = await controller.findOne('1');
      expect(result).toEqual(mockEnc);
    });
  });

  describe('update', () => {
    it('debería actualizar un encuentro', async () => {
      const dto: UpdateEncuentroDto = { titulo: 'Nuevo' };
      mockEncuentroService.update.mockResolvedValue({ success: true });
      const result = await controller.update('1', dto, 1);
      expect(result.success).toBe(true);
    });
  });

  describe('remove', () => {
    it('debería eliminar un encuentro', async () => {
      mockEncuentroService.remove.mockResolvedValue({ success: true });
      const result = await controller.remove('1', 1);
      expect(result.success).toBe(true);
    });
  });

  describe('salirDelEncuentro', () => {
    it('debería permitir salir del encuentro', async () => {
      mockEncuentroService.salirDelEncuentro.mockResolvedValue({ success: true });
      const result = await controller.salirDelEncuentro('1', 2);
      expect(result.success).toBe(true);
    });
  });
});
