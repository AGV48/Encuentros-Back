import { PartialType } from '@nestjs/mapped-types';
import { CreateAporteDto } from './create-aporte.dto';

export class UpdateAporteDto extends PartialType(CreateAporteDto) {}
