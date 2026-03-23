import { Controller, Post, Body, BadRequestException, Get, Query, HttpException, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users') // Agrupa estos endpoints bajo "users" en Swagger
@Controller('users')
@UseGuards(JwtAuthGuard) // Protege todos los endpoints de usuarios
export class UsersController {
  constructor(private readonly usersService: UsersService, private dataSource: DataSource) {}

  @Get('search_user')
  async searchUser(@Query('q') q: string, @Query('currentUser') currentUser?: string) {
    try {
      const results = await this.usersService.searchByName(q || '');

      // if currentUser provided, annotate each user with friendship/pending info
      if (currentUser) {
        const cur = Number(currentUser);
        const annotated = [] as any[];
        for (const u of results) {
          const otherId = (u as any).id ?? (u as any).ID_USUARIO ?? (u as any).ID_USUARIO;

          // check friendship existence in amistades
          let isFriend = false;
          try {
            const friendSql = `
              SELECT COUNT(*) as cnt FROM amistades a
              WHERE (a.usuario1 = $1 AND a.usuario2 = $2) OR (a.usuario1 = $3 AND a.usuario2 = $4)
            `;
            const friendRes = await this.dataSource.query(friendSql, [cur, Number(otherId), Number(otherId), cur]);
            isFriend = friendRes && friendRes[0] && Number(friendRes[0].cnt ?? friendRes[0].count ?? 0) > 0;
          } catch (e) {
            // If amistades doesn't exist or query fails, fallback to false and log for debugging
            console.warn('Could not check amistades table for friendship status', e && e.message ? e.message : e);
            isFriend = false;
          }

          // check pending request sent by current user to other
          const pendingFromSql = `
            SELECT COUNT(*) as cnt FROM relaciones_amistades ra
            JOIN solicitudes_amistad sa ON sa.id_relacion_amistad = ra.id_relacion_amistad
            WHERE ra.id_usuario = $1 AND sa.id_destinatario = $2 AND ra.estado = 'pendiente'
          `;
          let pendingRequestFromMe = false;
          try {
            const pendingFromRes = await this.dataSource.query(pendingFromSql, [cur, Number(otherId)]);
            pendingRequestFromMe = pendingFromRes && pendingFromRes[0] && Number(pendingFromRes[0].cnt ?? pendingFromRes[0].count ?? 0) > 0;
          } catch (e) {
            console.warn('Could not check pending requests (from) for search annotation', e && e.message ? e.message : e);
            pendingRequestFromMe = false;
          }

          // check pending request sent by other to current user
          const pendingToSql = `
            SELECT COUNT(*) as cnt FROM relaciones_amistades ra
            JOIN solicitudes_amistad sa ON sa.id_relacion_amistad = ra.id_relacion_amistad
            WHERE ra.id_usuario = $1 AND sa.id_destinatario = $2 AND ra.estado = 'pendiente'
          `;
          let pendingRequestToMe = false;
          try {
            const pendingToRes = await this.dataSource.query(pendingToSql, [Number(otherId), cur]);
            pendingRequestToMe = pendingToRes && pendingToRes[0] && Number(pendingToRes[0].cnt ?? pendingToRes[0].count ?? 0) > 0;
          } catch (e) {
            console.warn('Could not check pending requests (to) for search annotation', e && e.message ? e.message : e);
            pendingRequestToMe = false;
          }

          annotated.push({ ...u, isFriend, pendingRequestFromMe, pendingRequestToMe });
        }
        return { success: true, results: annotated };
      }

      return { success: true, results };
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
      // Antes de crear la solicitud, verificar si ya existen como amigos
      try {
        const friendCheckSql = `
          SELECT COUNT(*) as cnt FROM amistades a
          WHERE (a.usuario1 = $1 AND a.usuario2 = $2) OR (a.usuario1 = $3 AND a.usuario2 = $4)
        `;
        const friendCheck = await this.dataSource.query(friendCheckSql, [from, to, to, from]);
        const isFriend = friendCheck && friendCheck[0] && Number(friendCheck[0].cnt ?? friendCheck[0].count ?? 0) > 0;
        if (isFriend) {
          throw new HttpException('Ya son amigos', 400);
        }
      } catch (e) {
        // Si la tabla amistades no existe o falla la consulta, no bloquear la creación
        // pero se registra la advertencia para debugging
        if (e instanceof HttpException) throw e;
        console.warn('amistades check failed; continuing to create request if allowed', e && e.message ? e.message : e);
      }

      // Verificar si existe una solicitud pendiente en sentido inverso (to -> from).
      try {
        const reverseSql = `
          SELECT ra.id_relacion_amistad as id_relacion
          FROM relaciones_amistades ra
          JOIN solicitudes_amistad sa ON sa.id_relacion_amistad = ra.id_relacion_amistad
          WHERE ra.id_usuario = $1 AND sa.id_destinatario = $2 AND ra.estado = 'pendiente'
        `;
        const reverseRows = await this.dataSource.query(reverseSql, [to, from]);
        if (reverseRows && reverseRows[0]) {
          // Hay una solicitud inversa pendiente: aceptar esa solicitud automáticamente para evitar duplicados
          const reverseId = reverseRows[0].id_relacion ?? reverseRows[0].id_relacion_amistad;
          
          // Aceptar la solicitud creando la amistad
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Actualizar estado de la relación
            await queryRunner.query(
              `UPDATE relaciones_amistades SET estado = 'aceptada', fecha_aceptacion_amistad = CURRENT_TIMESTAMP WHERE id_relacion_amistad = $1`,
              [Number(reverseId)]
            );

            // Crear amistad
            await queryRunner.query(
              `INSERT INTO amistades (id_relacion_amistad, usuario1, usuario2, fecha_amistad) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
              [Number(reverseId), to, from]
            );

            await queryRunner.commitTransaction();
            return { success: true, message: 'Solicitud cruzada detectada: amistad aceptada automáticamente' };
          } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
          } finally {
            await queryRunner.release();
          }
        }
      } catch (e) {
        if (e instanceof HttpException) throw e;
        console.warn('Reverse pending check failed; proceeding to create request', e && e.message ? e.message : e);
      }

      // Crear nueva solicitud
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Insertar en relaciones_amistades
        const relResult = await queryRunner.query(
          `INSERT INTO relaciones_amistades (id_usuario, estado, fecha_solicitud_amistad) VALUES ($1, 'pendiente', CURRENT_TIMESTAMP) RETURNING id_relacion_amistad`,
          [from]
        );
        const idRelacion = relResult[0].id_relacion_amistad;

        // Insertar en solicitudes_amistad
        await queryRunner.query(
          `INSERT INTO solicitudes_amistad (id_relacion_amistad, id_remitente, id_destinatario) VALUES ($1, $2, $3)`,
          [idRelacion, from, to]
        );

        await queryRunner.commitTransaction();
        return { success: true, message: 'Solicitud enviada' };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (err: any) {
      console.error('Error creando solicitud de amistad', err);
      // Si Oracle devolvió un error RAISE_APPLICATION_ERROR con código -20002/-20003/-20001,
      // el mensaje llega en err.message o err.error. Hacemos un match simple.
      const msg = (err && (err.message || err.error || JSON.stringify(err))) || 'Error desconocido';
      if (msg.includes('-20002')) {
        throw new HttpException('El usuario al que le va a enviar una solicitud ya le ha enviado una a usted.', 400);
      }
      if (msg.includes('-20003')) {
        throw new HttpException('Ya le ha enviado una solicitud de amistad a este usuario.', 400);
      }
      if (msg.includes('-20001')) {
        throw new HttpException('Error al crear la solicitud de amistad.', 500);
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
      if (!relRows || !relRows[0]) {
        throw new HttpException('No se encontró la relación de amistad', 404);
      }
      const usuario_origen = Number(relRows[0].usuario_origen ?? relRows[0].id_usuario);

      const destSql = `SELECT sa.id_destinatario as usuario_destino FROM solicitudes_amistad sa WHERE sa.id_relacion_amistad = $1`;
      const destRows = await this.dataSource.query(destSql, [id_relacion_amistad]);
      if (!destRows || !destRows[0]) {
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
        const alreadyFriend = friendCheck && friendCheck[0] && Number(friendCheck[0].cnt ?? friendCheck[0].count ?? 0) > 0;
        if (alreadyFriend) {
          // marcar la relación como aceptada (si no lo está) para mantener consistencia
          const updateSql = `UPDATE relaciones_amistades SET estado = 'aceptada', fecha_aceptacion_amistad = CURRENT_TIMESTAMP WHERE id_relacion_amistad = $1`;
          await this.dataSource.query(updateSql, [id_relacion_amistad]);
          return { success: true, message: 'Ya son amigos' };
        }
      } catch (e) {
        console.warn('amistades check failed during accept; proceeding', e && e.message ? e.message : e);
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
      if (!solRows || !solRows[0]) {
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
      if (isNaN(userIdNum)) {
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
