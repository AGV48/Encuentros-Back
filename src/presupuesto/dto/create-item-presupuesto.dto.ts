import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateItemPresupuestoDto {
  @IsNotEmpty()
  @IsNumber()
  idPresupuesto: number;

  @IsNotEmpty()
  @IsNumber()
  idEncuentro: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  nombreItem: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  montoItem: number;
}
