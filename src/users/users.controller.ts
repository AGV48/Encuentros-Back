import { Controller, Post, Body, BadRequestException, Get, Query, HttpException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users') // Agrupa estos endpoints bajo "users" en Swagger
@Controller('users')
@UseGuards(JwtAuthGuard) // Protege todos los endpoints de usuarios
export class UsersController {
  constructor(private readonly usersService: UsersService, private readonly dataSource: DataSource) {}

  @Get('search_user')
  async searchUser(@Query('q') q: string, @Query('currentUser') currentUser?: string) {
    try {
      const results = await this.usersService.searchByName(q || '');

      if (!currentUser) {
        return { success: true, results };
      }

      const annotatedResults = await this.usersService.annotateSearchResults(results, Number(currentUser));
      return { success: true, results: annotatedResults };
    } catch (error) {
      console.error('Error en search_user', error);
      throw new HttpException('Error buscando usuarios', 500);
    }
  }

  @Post('friend-request')
  async createFriendRequest(@Body() body: { from: number; to: number }) {
    const { from, to } = body;
    if (!from || !to) {
      throw new BadRequestException('Se requieren campos from y to');
    }

    try {
      const result = await this.usersService.createFriendRequest(from, to);
      return result;
    } catch (error: any) {
      console.error('Error creando solicitud de amistad', error);
      const msg = error?.message || error?.error || JSON.stringify(error) || 'Error desconocido';

      if (msg.includes('-20002')) {
        throw new HttpException('El usuario al que le va a enviar una solicitud ya le ha enviado una a usted.', 400);
      }
      if (msg.includes('-20003')) {
        throw new HttpException('Ya le ha enviado una solicitud de amistad a este usuario.', 400);
      }
      if (msg.includes('-20001')) {
        throw new HttpException('Error al crear la solicitud de amistad.', 500);
      }
      if (msg.includes('Ya son amigos')) {
        throw new HttpException(msg, 400);
      }

      throw new HttpException(msg, 500);
    }
  }

  @Get('notifications')
  async getNotifications(@Query('userId') userId: string) {
    if (!userId) throw new BadRequestException('userId es requerido');
    try {
      // Obtener solicitudes pendientes donde el destinatario es userId
      const sql = `
        SELECT ra.id_relacion_amistad as id_relacion,
               ra.id_usuario as usuario_origen,
               u.nombre as nombre_origen,
               u.apellido as apellido_origen,
               ra.fecha_solicitud_amistad as fecha_solicitud
        FROM relaciones_amistades ra
        JOIN solicitudes_amistad sa ON sa.id_relacion_amistad = ra.id_relacion_amistad
        JOIN usuarios u ON u.id_usuario = ra.id_usuario
        WHERE sa.id_destinatario = $1
          AND ra.estado = 'pendiente'
        ORDER BY ra.fecha_solicitud_amistad DESC
      `;
      const rows = await this.dataSource.query(sql, [Number(userId)]);

      // Además, obtener notificaciones de aceptación: amistades creadas donde el usuario fue el origen
      const acceptedSql = `
        SELECT a.id_relacion_amistad as id_relacion,
               a.usuario1 as usuario_origen,
               u2.nombre as nombre_origen,
               u2.apellido as apellido_origen,
               a.fecha_amistad as fecha_amistad
        FROM amistades a
        JOIN usuarios u2 ON u2.id_usuario = a.usuario2
        WHERE a.usuario1 = $1
        ORDER BY a.fecha_amistad DESC
      `;
      const accepted = await this.dataSource.query(acceptedSql, [Number(userId)]);

      return { success: true, pending: rows, accepted };
    } catch (err) {
      console.error('Error obteniendo notificaciones', err);
      throw new HttpException('Error obteniendo notificaciones', 500);
    }
  }

  @Post('accept-request')
  async acceptRequest(@Body() body: { id_relacion_amistad: number; userId: number }) {
    const { id_relacion_amistad, userId } = body;
    if (!id_relacion_amistad || !userId) throw new BadRequestException('id_relacion_amistad y userId son requeridos');
    try {
      // Antes de llamar al procedimiento, obtener los usuarios implicados
      const relSql = `
        SELECT ra.id_usuario as usuario_origen
        FROM relaciones_amistades ra
        WHERE ra.id_relacion_amistad = $1
      `;
      const relRows = await this.dataSource.query(relSql, [id_relacion_amistad]);
      if (!relRows?.[0]) {
        throw new HttpException('No se encontró la relación de amistad', 404);
      }
      const usuario_origen = Number(relRows[0].usuario_origen ?? relRows[0].id_usuario);

      const destSql = `SELECT sa.id_destinatario as usuario_destino FROM solicitudes_amistad sa WHERE sa.id_relacion_amistad = $1`;
      const destRows = await this.dataSource.query(destSql, [id_relacion_amistad]);
      if (!destRows?.[0]) {
        throw new HttpException('No se encontró la solicitud de amistad asociada', 404);
      }
      const usuario_destino = Number(destRows[0].usuario_destino);

      // Verificar si ya existe amistad entre ambos (para evitar duplicados)
      try {
        const friendCheckSql = `
          SELECT COUNT(*) as cnt FROM amistades a
          WHERE (a.usuario1 = $1 AND a.usuario2 = $2) OR (a.usuario1 = $3 AND a.usuario2 = $4)
        `;
        const friendCheck = await this.dataSource.query(friendCheckSql, [usuario_origen, usuario_destino, usuario_destino, usuario_origen]);
        const alreadyFriend = Number(friendCheck?.[0]?.cnt ?? friendCheck?.[0]?.count ?? 0) > 0;
        if (alreadyFriend) {
          // marcar la relación como aceptada (si no lo está) para mantener consistencia
          const updateSql = `UPDATE relaciones_amistades SET estado = 'aceptada', fecha_aceptacion_amistad = CURRENT_TIMESTAMP WHERE id_relacion_amistad = $1`;
          await this.dataSource.query(updateSql, [id_relacion_amistad]);
          return { success: true, message: 'Ya son amigos' };
        }
      } catch (e) {
        console.warn('amistades check failed during accept; proceeding', e?.message ?? e);
      }

      // Aceptar la solicitud usando transacciones
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Actualizar estado de la relación
        await queryRunner.query(
          `UPDATE relaciones_amistades SET estado = 'aceptada', fecha_aceptacion_amistad = CURRENT_TIMESTAMP WHERE id_relacion_amistad = $1`,
          [id_relacion_amistad]
        );

        // Crear amistad
        await queryRunner.query(
          `INSERT INTO amistades (id_relacion_amistad, usuario1, usuario2, fecha_amistad) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [id_relacion_amistad, usuario_origen, usuario_destino]
        );

        await queryRunner.commitTransaction();
        return { success: true, message: 'Solicitud aceptada' };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (err: any) {
      console.error('Error aceptando solicitud', err);
      const msg = (err && (err.message || err.error || JSON.stringify(err))) || 'Error desconocido';
      throw new HttpException(msg, err instanceof HttpException ? err.getStatus() : 500);
    }
  }

  @Post('reject-request')
  async rejectRequest(@Body() body: { id_relacion_amistad: number; userId: number }) {
    const { id_relacion_amistad, userId } = body;
    if (!id_relacion_amistad || !userId) throw new BadRequestException('id_relacion_amistad y userId son requeridos');
    try {
      // Verificar que la solicitud existe y obtener el destinatario
      const solSql = `SELECT sa.id_destinatario as usuario_destino FROM solicitudes_amistad sa WHERE sa.id_relacion_amistad = $1`;
      const solRows = await this.dataSource.query(solSql, [id_relacion_amistad]);
      if (!solRows?.[0]) {
        throw new HttpException('No se encontró la solicitud de amistad asociada', 404);
      }
      const usuario_destino = Number(solRows[0].usuario_destino);

      // Solo el destinatario puede rechazar
      if (usuario_destino !== Number(userId)) {
        throw new HttpException('Solo el destinatario puede rechazar la solicitud', 403);
      }

      // Eliminar la solicitud y la relación asociada
      const delSolSql = `DELETE FROM solicitudes_amistad WHERE id_relacion_amistad = $1`;
      await this.dataSource.query(delSolSql, [id_relacion_amistad]);

      const delRelSql = `DELETE FROM relaciones_amistades WHERE id_relacion_amistad = $1`;
      await this.dataSource.query(delRelSql, [id_relacion_amistad]);

      return { success: true, message: 'Solicitud rechazada y eliminada' };
    } catch (err: any) {
      console.error('Error rechazando solicitud', err);
      const msg = (err && (err.message || err.error || JSON.stringify(err))) || 'Error desconocido';
      throw new HttpException(msg, err instanceof HttpException ? err.getStatus() : 500);
    }
  }

  @Post()
  async create(@Body() userData: CreateUserDto): Promise<User> {
    console.log('Received user data:', userData);

    // Evita crear usuarios con el mismo email
    const existing = await this.usersService.findByEmail(userData.email);
    if (existing) {
      throw new BadRequestException('El correo ya está registrado, intenta con otro');
    }

    return this.usersService.create(userData);
  }

  @Post('login')
  async login(@Body() body: { email: string; contrasena: string }) {
    const user = await this.usersService.findByEmail(body.email);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    if (user.contrasena !== body.contrasena) {
      return { success: false, message: 'Usuario o contraseña incorrectos' };
    }
    return { success: true, user };
  }

  @Get('userData')
  async getUserData(@Body() body: { email: string }) {
    const user = await this.usersService.findByEmail(body.email);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    return { success: true, user };
  }

  @Post('update')
  async updateUser(@Body() body: { email: string; updateData: Partial<User> }) {
    try {
      const updatedUser = await this.usersService.updateUser(body.email, body.updateData);
      return { success: true, user: updatedUser };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('updatePassword')
  async updatePassword(@Body() body: { email: string; currentPassword: string; newPassword: string }) {
    try {
      const updatedUser = await this.usersService.updatePassword(body.email, body.currentPassword, body.newPassword);
      // No devolver la contraseña en la respuesta
      const safeUser = { ...updatedUser } as any;
      if (safeUser.contrasena) delete safeUser.contrasena;
      return { success: true, user: safeUser };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Post('delete')
  async deleteUser(@Body() body: { email: string }) {
    try {
      await this.usersService.deleteUser(body.email);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @Get('friends/:userId')
  async getFriends(@Query('userId') userId: string) {
    try {
      const userIdNum = Number(userId);
      if (Number.isNaN(userIdNum)) {
        throw new BadRequestException('userId debe ser un número válido');
      }

      // Consultar la tabla amistades para obtener los amigos del usuario
      // Simplificamos la consulta usando UNION para evitar problemas con CASE
      const friendsSql = `
        SELECT DISTINCT
          u.id_usuario as id,
          u.nombre as nombre,
          u.apellido as apellido,
          u.email as email,
          u.imagen_perfil as imagenperfil
        FROM amistades a
        JOIN usuarios u ON u.id_usuario = a.usuario2
        WHERE a.usuario1 = $1
        UNION
        SELECT DISTINCT
          u.id_usuario as id,
          u.nombre as nombre,
          u.apellido as apellido,
          u.email as email,
          u.imagen_perfil as imagenperfil
        FROM amistades a
        JOIN usuarios u ON u.id_usuario = a.usuario1
        WHERE a.usuario2 = $2
      `;

      const friends = await this.dataSource.query(friendsSql, [userIdNum, userIdNum]);
      
      return { success: true, friends };
    } catch (error) {
      console.error('Error obteniendo amigos', error);
      throw new HttpException('Error obteniendo lista de amigos', 500);
    }
  }
}
