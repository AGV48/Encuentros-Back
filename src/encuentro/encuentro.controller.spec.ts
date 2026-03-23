import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroController } from './encuentro.controller';
import { EncuentroService } from './encuentro.service';

describe('EncuentroController', () => {
  let controller: EncuentroController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EncuentroController],
      providers: [EncuentroService],
    }).compile();

    controller = module.get<EncuentroController>(EncuentroController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
