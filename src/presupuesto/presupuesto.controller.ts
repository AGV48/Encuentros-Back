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
import { PresupuestoService } from './presupuesto.service';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto';
import { CreateItemPresupuestoDto } from './dto/create-item-presupuesto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('presupuesto')
@UseGuards(JwtAuthGuard)
export class PresupuestoController {
  constructor(private readonly presupuestoService: PresupuestoService) {}

  @Post()
  create(@Body() createPresupuestoDto: CreatePresupuestoDto) {
    return this.presupuestoService.create(createPresupuestoDto);
  }

  @Get()
  findAll(@Query('encuentro') encuentroId?: string) {
    if (encuentroId) {
      return this.presupuestoService.findByEncuentro(Number(encuentroId));
    }
    return this.presupuestoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.presupuestoService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePresupuestoDto: UpdatePresupuestoDto,
  ) {
    return this.presupuestoService.update(+id, updatePresupuestoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.presupuestoService.remove(+id);
  }

  @Post('item')
  agregarItem(@Body() createItemDto: CreateItemPresupuestoDto) {
    return this.presupuestoService.agregarItem(createItemDto);
  }

  @Get(':id/items')
  getItems(@Param('id') id: string) {
    return this.presupuestoService.getItems(+id);
  }

  @Delete('item/:id')
  removeItem(
    @Param('id') id: string,
    @Body('idUsuario') idUsuario: number,
  ) {
    return this.presupuestoService.removeItem(+id, idUsuario);
  }
}
