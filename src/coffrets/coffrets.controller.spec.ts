import { Test, TestingModule } from '@nestjs/testing';
import { CoffretsController } from './coffrets.controller';

describe('CoffretsController', () => {
  let controller: CoffretsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoffretsController],
    }).compile();

    controller = module.get<CoffretsController>(CoffretsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
