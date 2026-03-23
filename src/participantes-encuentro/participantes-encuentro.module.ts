import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipantesEncuentroService } from './participantes-encuentro.service';
import { ParticipantesEncuentroController } from './participantes-encuentro.controller';
import { ParticipanteEncuentro } from './entities/participante-encuentro.entity';
import { ParticipantesEncuentroView } from './entities/participantes-encuentro-view.entity';
import { VistaParticipantesAportes } from './entities/vista-participantes-aportes.entity';
import { Encuentro } from '../encuentro/entities/encuentro.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    ParticipanteEncuentro, 
    ParticipantesEncuentroView, 
    VistaParticipantesAportes,
    Encuentro
  ])],
  controllers: [ParticipantesEncuentroController],
  providers: [ParticipantesEncuentroService],
  exports: [ParticipantesEncuentroService],
})
export class ParticipantesEncuentroModule {}
