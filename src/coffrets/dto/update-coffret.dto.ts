import { PartialType } from '@nestjs/swagger';
import { CreateCoffretDto } from './create-coffret.dto';

export class UpdateCoffretDto extends PartialType(CreateCoffretDto) {}