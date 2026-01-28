import { Test, TestingModule } from '@nestjs/testing';
import { CoffretsService } from './coffrets.service';

describe('CoffretsService', () => {
  let service: CoffretsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoffretsService],
    }).compile();

    service = module.get<CoffretsService>(CoffretsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
