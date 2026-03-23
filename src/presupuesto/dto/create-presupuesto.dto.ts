import {
  IsNotEmpty,
  IsNumber,
} from 'class-validator';

export class CreatePresupuestoDto {
  @IsNotEmpty()
  @IsNumber()
  idEncuentro: number;
}
