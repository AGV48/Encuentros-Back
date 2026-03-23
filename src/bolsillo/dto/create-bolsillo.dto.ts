import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBolsilloDto {
  @IsOptional()
  @IsNumber()
  idPresupuesto?: number;

  @IsNotEmpty()
  @IsNumber()
  idEncuentro: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  saldoActual?: number;
}
