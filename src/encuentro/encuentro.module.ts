import { Module } from '@nestjs/common';
import { EncuentroService } from './encuentro.service';
import { EncuentroController } from './encuentro.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encuentro } from './entities/encuentro.entity';
import { EncuentroResumen } from './entities/encuentro-resumen.entity';
import { ParticipanteEncuentro } from '../participantes-encuentro/entities/participante-encuentro.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Encuentro, EncuentroResumen, ParticipanteEncuentro])],
  controllers: [EncuentroController],
  providers: [EncuentroService],
  exports: [TypeOrmModule],
})
export class EncuentroModule {}
