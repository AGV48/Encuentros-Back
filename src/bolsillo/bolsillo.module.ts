import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BolsilloService } from './bolsillo.service';
import { BolsilloController } from './bolsillo.controller';
import { Bolsillo } from './entities/bolsillo.entity';
import { Gasto } from './entities/gasto.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bolsillo, Gasto])],
  controllers: [BolsilloController],
  providers: [BolsilloService],
  exports: [BolsilloService],
})
export class BolsilloModule {}
