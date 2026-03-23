import { PartialType } from '@nestjs/swagger';
import { CreateEncuentroDto } from './create-encuentro.dto';

export class UpdateEncuentroDto extends PartialType(CreateEncuentroDto) {}
