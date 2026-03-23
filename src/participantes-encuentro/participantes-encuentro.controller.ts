import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('participantes-encuentro')
@UseGuards(JwtAuthGuard)
export class ParticipantesEncuentroController {
  constructor(private readonly participantesEncuentroService: ParticipantesEncuentroService) {}

  @Post()
  create(@Body() createParticipanteDto: CreateParticipanteDto) {
    return this.participantesEncuentroService.create(createParticipanteDto);
  }

  @Get()
  findAll(
    @Query('encuentro') encuentro?: string,
    @Query('usuario') usuario?: string,
  ) {
    if (encuentro) {
      return this.participantesEncuentroService.findByEncuentro(+encuentro);
    }
    if (usuario) {
      return this.participantesEncuentroService.findByUsuario(+usuario);
    }
    return this.participantesEncuentroService.findAll();
  }

  // Endpoint para consultar la vista V_PARTICIPANTES_ENCUENTRO
  @Get('vista/detalle')
  findAllFromView(
    @Query('encuentro') encuentro?: string,
    @Query('usuario') usuario?: string,
  ) {
    const idEncuentro = encuentro ? +encuentro : undefined;
    const idUsuario = usuario ? +usuario : undefined;
    return this.participantesEncuentroService.findAllFromView(idEncuentro, idUsuario);
  }

  // Endpoint para consultar la vista VISTAPARTICIPANTESAPORTES
  @Get('aportes/resumen')
  findParticipantesConAportes(
    @Query('encuentro') encuentro?: string,
    @Query('usuario') usuario?: string,
  ) {
    const idEncuentro = encuentro ? +encuentro : undefined;
    const idUsuario = usuario ? +usuario : undefined;
    return this.participantesEncuentroService.findParticipantesConAportes(idEncuentro, idUsuario);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.participantesEncuentroService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateParticipanteDto: UpdateParticipanteDto) {
    return this.participantesEncuentroService.update(+id, updateParticipanteDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.participantesEncuentroService.remove(+id);
  }

  @Delete('encuentro/:idEncuentro/usuario/:idUsuario')
  removeByEncuentroAndUsuario(
    @Param('idEncuentro') idEncuentro: string,
    @Param('idUsuario') idUsuario: string,
  ) {
    return this.participantesEncuentroService.removeByEncuentroAndUsuario(+idEncuentro, +idUsuario);
  }
}
