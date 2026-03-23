import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { EncuentroModule } from './encuentro/encuentro.module';
import { ChatModule } from './chat/chat.module';
import { ParticipantesEncuentroModule } from './participantes-encuentro/participantes-encuentro.module';
import { PresupuestoModule } from './presupuesto/presupuesto.module';
import { BolsilloModule } from './bolsillo/bolsillo.module';
import { AporteModule } from './aporte/aporte.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      migrationsRun: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    UsersModule,
    EncuentroModule,
    ChatModule,
    ParticipantesEncuentroModule,
    PresupuestoModule,
    BolsilloModule,
    AporteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
