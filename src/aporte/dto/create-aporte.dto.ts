import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateAporteDto {
  @IsNotEmpty()
  @IsNumber()
  idBolsillo: number;

  @IsNotEmpty()
  @IsNumber()
  idEncuentro: number;

  @IsNotEmpty()
  @IsNumber()
  idUsuario: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  monto: number;
}
