import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroService } from './encuentro.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Encuentro } from './entities/encuentro.entity';
import { EncuentroResumen } from './entities/encuentro-resumen.entity';
import { ParticipanteEncuentro } from '../participantes-encuentro/entities/participante-encuentro.entity';
import { DataSource } from 'typeorm';

describe('EncuentroService', () => {
  let service: EncuentroService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncuentroService,
        {
          provide: getRepositoryToken(Encuentro),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EncuentroResumen),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ParticipanteEncuentro),
          useValue: {
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<EncuentroService>(EncuentroService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
