import { Test, TestingModule } from '@nestjs/testing';
import { EncuentroService } from './encuentro.service';

describe('EncuentroService', () => {
  let service: EncuentroService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncuentroService],
    }).compile();

    service = module.get<EncuentroService>(EncuentroService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
