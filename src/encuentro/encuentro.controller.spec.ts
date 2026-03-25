import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroController } from './encuentro.controller';
import { EncuentroService } from './encuentro.service';

describe('EncuentroController', () => {
  let controller: EncuentroController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EncuentroController],
      providers: [
        {
          provide: EncuentroService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findAllWithResumen: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            salirDelEncuentro: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EncuentroController>(EncuentroController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
