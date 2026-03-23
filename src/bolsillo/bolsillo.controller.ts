import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BolsilloService } from './bolsillo.service';
import { CreateBolsilloDto } from './dto/create-bolsillo.dto';
import { UpdateBolsilloDto } from './dto/update-bolsillo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('bolsillo')
@UseGuards(JwtAuthGuard)
export class BolsilloController {
  constructor(private readonly bolsilloService: BolsilloService) {}

  @Post()
  create(@Body() createBolsilloDto: CreateBolsilloDto) {
    return this.bolsilloService.create(createBolsilloDto);
  }

  @Get()
  findAll(
    @Query('encuentro') encuentroId?: string,
    @Query('presupuesto') presupuestoId?: string,
  ) {
    if (encuentroId) {
      return this.bolsilloService.findByEncuentro(Number(encuentroId));
    }
    if (presupuestoId) {
      return this.bolsilloService.findByPresupuesto(Number(presupuestoId));
    }
    return this.bolsilloService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bolsilloService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBolsilloDto: UpdateBolsilloDto,
  ) {
    return this.bolsilloService.update(+id, updateBolsilloDto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body('idUsuario') idUsuario: number,
  ) {
    return this.bolsilloService.remove(+id, idUsuario);
  }
}
