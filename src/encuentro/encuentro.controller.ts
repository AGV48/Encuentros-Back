import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { EncuentroService } from './encuentro.service';
import { CreateEncuentroDto } from './dto/create-encuentro.dto';
import { UpdateEncuentroDto } from './dto/update-encuentro.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('encuentro')
@UseGuards(JwtAuthGuard) // Protege todos los endpoints de encuentros
export class EncuentroController {
  constructor(private readonly encuentroService: EncuentroService) {}

  @Post()
  create(@Body() createEncuentroDto: CreateEncuentroDto) {
    return this.encuentroService.create(createEncuentroDto);
  }

  @Get()
  findAll(@Query('creador') creador?: string) {
    const id = creador ? +creador : undefined;
    return this.encuentroService.findAll(id);
  }

  @Get('resumen')
  findAllWithResumen(@Query('creador') creador?: string) {
    const id = creador ? +creador : undefined;
    return this.encuentroService.findAllWithResumen(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.encuentroService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string, 
    @Body() updateEncuentroDto: UpdateEncuentroDto,
    @Body('idUsuario') idUsuario: number
  ) {
    return this.encuentroService.update(+id, updateEncuentroDto, idUsuario);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Body('idUsuario') idUsuario: number) {
    return this.encuentroService.remove(+id, idUsuario);
  }

  @Post(':id/salir')
  @HttpCode(HttpStatus.OK)
  salirDelEncuentro(@Param('id') id: string, @Body('idUsuario') idUsuario: number) {
    return this.encuentroService.salirDelEncuentro(+id, idUsuario);
  }
}
