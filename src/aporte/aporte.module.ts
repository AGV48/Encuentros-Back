import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AporteService } from './aporte.service';
import { AporteController } from './aporte.controller';
import { Aporte } from './entities/aporte.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Aporte])],
  controllers: [AporteController],
  providers: [AporteService],
  exports: [AporteService],
})
export class AporteModule {}
