import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { RelacionAmistad } from './entities/relacion-amistad.entity';
import { SolicitudAmistad } from './entities/solicitud-amistad.entity';
import { Amistad } from './entities/amistad.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, RelacionAmistad, SolicitudAmistad, Amistad])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Exportar UsersService para que esté disponible en otros módulos
})
export class UsersModule {}
