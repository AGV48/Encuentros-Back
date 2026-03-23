import { PartialType } from '@nestjs/mapped-types';
import { CreateBolsilloDto } from './create-bolsillo.dto';

export class UpdateBolsilloDto extends PartialType(CreateBolsilloDto) {}
