import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroService } from './encuentro.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Encuentro } from './entities/encuentro.entity';
import { EncuentroResumen } from './entities/encuentro-resumen.entity';
import { ParticipanteEncuentro } from '../participantes-encuentro/entities/participante-encuentro.entity';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateEncuentroDto } from './dto/create-encuentro.dto';
import { UpdateEncuentroDto } from './dto/update-encuentro.dto';

describe('EncuentroService', () => {
  let service: EncuentroService;
  let encuentroRepository: Repository<Encuentro>;
  let participanteRepository: Repository<ParticipanteEncuentro>;
  let dataSource: DataSource;

  const mockEncuentroRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockEncuentroResumenRepository = {
    find: jest.fn(),
  };

  const mockParticipanteRepository = {
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncuentroService,
        {
          provide: getRepositoryToken(Encuentro),
          useValue: mockEncuentroRepository,
        },
        {
          provide: getRepositoryToken(EncuentroResumen),
          useValue: mockEncuentroResumenRepository,
        },
        {
          provide: getRepositoryToken(ParticipanteEncuentro),
          useValue: mockParticipanteRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<EncuentroService>(EncuentroService);
    encuentroRepository = module.get<Repository<Encuentro>>(getRepositoryToken(Encuentro));
    participanteRepository = module.get<Repository<ParticipanteEncuentro>>(getRepositoryToken(ParticipanteEncuentro));
    dataSource = module.get<DataSource>(DataSource);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear un encuentro exitosamente', async () => {
      const dto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Partido',
        descripcion: 'Desc',
        lugar: 'Cancha',
        fecha: new Date(Date.now() + 86400000),
      };
      const mockEnc = { id: 10, ...dto };
      mockEncuentroRepository.create.mockReturnValue(mockEnc);
      mockEncuentroRepository.save.mockResolvedValue(mockEnc);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.create(dto);
      expect(result.success).toBe(true);
      expect(mockEncuentroRepository.create).toHaveBeenCalled();
      expect(mockEncuentroRepository.save).toHaveBeenCalled();
      expect(mockDataSource.query).toHaveBeenCalledTimes(2); // Participante y presupuesto
    });

    it('debería lanzar BadRequestException si la fecha es pasada', async () => {
      const dto: CreateEncuentroDto = {
        idCreador: 1,
        titulo: 'Pasado',
        fecha: new Date(Date.now() - 86400000),
      } as any;
      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('debería obtener todos los encuentros sin filtro', async () => {
      mockEncuentroRepository.find.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
      expect(mockEncuentroRepository.find).toHaveBeenCalled();
    });

    it('debería filtrar encuentros por creador', async () => {
      const id_creador = 1;
      mockDataSource.query.mockResolvedValue([{ id_encuentro: 1, id_creador, titulo: 'T', descripcion: 'D', lugar: 'L', fecha: new Date(), fecha_creacion: new Date() }]);
      const result = await service.findAll(id_creador);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].idCreador).toBe(1);
    });
  });

  describe('findOne', () => {
    it('debería retornar un encuentro por ID', async () => {
      const mockEnc = { id: 1 };
      mockEncuentroRepository.findOne.mockResolvedValue(mockEnc);
      const result = await service.findOne(1);
      expect(result).toEqual(mockEnc);
    });
  });

  describe('findAllWithResumen', () => {
    it('debería obtener encuentros con resumen', async () => {
      mockDataSource.query.mockResolvedValue([{
        id_encuentro: 1,
        id_creador: 1,
        titulo: 'T',
        presupuesto_total: '100.5',
        cant_participantes: '5'
      }]);
      const result = await service.findAllWithResumen();
      expect(result[0].presupuestoTotal).toBe(100.5);
      expect(result[0].cantParticipantes).toBe(5);
    });

    it('debería manejar valores NULL en resumen', async () => {
        mockDataSource.query.mockResolvedValue([{
          id_encuentro: 1,
          id_creador: 1,
          presupuesto_total: null,
          cant_participantes: null
        }]);
        const result = await service.findAllWithResumen();
        expect(result[0].presupuestoTotal).toBe(0);
        expect(result[0].cantParticipantes).toBe(0);
    });
  });

  describe('update', () => {
    it('debería actualizar un encuentro exitosamente', async () => {
      const mockEnc = { id: 1, idCreador: 1, titulo: 'Old' };
      mockEncuentroRepository.findOne.mockResolvedValue(mockEnc);
      mockEncuentroRepository.save.mockImplementation(async (enc) => enc);

      const result = await service.update(1, { titulo: 'New' }, 1);
      expect(result.success).toBe(true);
      expect(result.encuentro.titulo).toBe('New');
    });

    it('debería lanzar ForbiddenException si no es el creador', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 2 });
      await expect(service.update(1, {}, 1)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('debería eliminar un encuentro', async () => {
      const mockEnc = { id: 1, idCreador: 1 };
      mockEncuentroRepository.findOne.mockResolvedValue(mockEnc);
      mockEncuentroRepository.remove.mockResolvedValue(mockEnc);

      const result = await service.remove(1, 1);
      expect(result.success).toBe(true);
      expect(mockEncuentroRepository.remove).toHaveBeenCalled();
    });
  });

  describe('salirDelEncuentro', () => {
    it('debería permitir salir', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 2 });
      const mockPart = { idEncuentro: 1, idUsuario: 1 };
      mockParticipanteRepository.findOne.mockResolvedValue(mockPart);
      mockParticipanteRepository.remove.mockResolvedValue(mockPart);

      const result = await service.salirDelEncuentro(1, 1);
      expect(result.success).toBe(true);
    });

    it('debería lanzar ForbiddenException si el creador intenta salir', async () => {
      mockEncuentroRepository.findOne.mockResolvedValue({ id: 1, idCreador: 1 });
      await expect(service.salirDelEncuentro(1, 1)).rejects.toThrow(ForbiddenException);
    });
  });
});
