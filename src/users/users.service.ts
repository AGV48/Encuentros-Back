import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: CreateUserDto): Promise<User> {
    const toSave: Partial<User> = {
      nombre: data.nombre,
      apellido: data.apellido ?? undefined,
      email: data.email,
      contrasena: data.contrasena,
      imagenPerfil: data.imagenPerfil ?? undefined,
    };

    const newUser = this.usersRepository.create(toSave as any);

    return (await this.usersRepository.save(newUser)) as unknown as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { id } });
  }

  async updateUser(email: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    Object.assign(user, updateData);
    return await this.usersRepository.save(user);
  }

  async updatePassword(email: string, currentPassword: string, newPassword: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    // Verificar la contraseña actual con bcrypt
    const isPasswordValid = await bcrypt.compare(currentPassword, user.contrasena);
    if (!isPasswordValid) {
      throw new Error('Contraseña actual incorrecta');
    }
    // Cifrar la nueva contraseña
    user.contrasena = await bcrypt.hash(newPassword, 10);
    const saved = await this.usersRepository.save(user);
    // No devolver la contraseña en la respuesta (caller puede filtrar)
    (saved as any).contrasena = undefined;
    return saved;
  }

  async deleteUser(email: string): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    await this.usersRepository.remove(user);
  }

  async searchByName(q: string): Promise<User[]> {
    const term = (q || '').trim().toLowerCase();
    if (!term) return [];
    // Buscar por nombre, apellido o email que contenga el término (case-insensitive)
    return await this.usersRepository
      .createQueryBuilder('u')
      .where('LOWER(u.nombre) LIKE :t', { t: `%${term}%` })
      .orWhere('LOWER(u.apellido) LIKE :t', { t: `%${term}%` })
      .orWhere('LOWER(u.email) LIKE :t', { t: `%${term}%` })
      .select(['u.id', 'u.nombre', 'u.apellido', 'u.email', 'u.imagenPerfil'])
      .getMany();
  }

  async updateResetToken(userId: number, token: string): Promise<void> {
    await this.usersRepository.update(userId, {
      resetPasswordToken: token,
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return await this.usersRepository.findOne({ 
      where: { resetPasswordToken: token } 
    });
  }

  async resetUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await this.usersRepository.update(userId, {
      contrasena: hashedPassword,
      resetPasswordToken: null,
    });
  }

  async annotateSearchResults(results: User[], currentUserId: number): Promise<any[]> {
    return Promise.all(
      results.map(async (user) => ({
        ...user,
        isFriend: await this.checkFriendship(currentUserId, user.id),
        pendingRequestFromMe: await this.checkPendingRequestFromMe(currentUserId, user.id),
        pendingRequestToMe: await this.checkPendingRequestToMe(user.id, currentUserId),
      }))
    );
  }

  private async checkFriendship(userId: number, otherId: number): Promise<boolean> {
    try {
      const sql = `
        SELECT COUNT(*) as cnt FROM amistades a
        WHERE (a.usuario1 = $1 AND a.usuario2 = $2) OR (a.usuario1 = $3 AND a.usuario2 = $4)
      `;
      const res = await this.dataSource.query(sql, [userId, otherId, otherId, userId]);
      return Number(res?.[0]?.cnt ?? res?.[0]?.count ?? 0) > 0;
    } catch (e) {
      console.warn('Could not check amistades table for friendship status', e?.message);
      return false;
    }
  }

  private async checkPendingRequestFromMe(userId: number, otherId: number): Promise<boolean> {
    try {
      const sql = `
        SELECT COUNT(*) as cnt FROM relaciones_amistades ra
        JOIN solicitudes_amistad sa ON sa.id_relacion_amistad = ra.id_relacion_amistad
        WHERE ra.id_usuario = $1 AND sa.id_destinatario = $2 AND ra.estado = 'pendiente'
      `;
      const res = await this.dataSource.query(sql, [userId, otherId]);
      return Number(res?.[0]?.cnt ?? res?.[0]?.count ?? 0) > 0;
    } catch (e) {
      console.warn('Could not check pending requests (from) for search annotation', e?.message);
      return false;
    }
  }

  private async checkPendingRequestToMe(userId: number, currentUserId: number): Promise<boolean> {
    try {
      const sql = `
        SELECT COUNT(*) as cnt FROM relaciones_amistades ra
        JOIN solicitudes_amistad sa ON sa.id_relacion_amistad = ra.id_relacion_amistad
        WHERE ra.id_usuario = $1 AND sa.id_destinatario = $2 AND ra.estado = 'pendiente'
      `;
      const res = await this.dataSource.query(sql, [userId, currentUserId]);
      return Number(res?.[0]?.cnt ?? res?.[0]?.count ?? 0) > 0;
    } catch (e) {
      console.warn('Could not check pending requests (to) for search annotation', e?.message);
      return false;
    }
  }

  async createFriendRequest(from: number, to: number): Promise<any> {
    // Check if already friends
    const isFriend = await this.checkFriendshipForRequest(from, to);
    if (isFriend) {
      throw new Error('Ya son amigos');
    }

    // Check for reverse pending request and accept if exists
    const reversePendingResult = await this.checkAndAcceptReversePendingRequest(to, from);
    if (reversePendingResult.accepted) {
      return reversePendingResult;
    }

    // Create new friend request
    return await this.createNewFriendRequest(from, to);
  }

  private async checkFriendshipForRequest(userId: number, otherId: number): Promise<boolean> {
    try {
      const sql = `
        SELECT COUNT(*) as cnt FROM amistades a
        WHERE (a.usuario1 = $1 AND a.usuario2 = $2) OR (a.usuario1 = $3 AND a.usuario2 = $4)
      `;
      const res = await this.dataSource.query(sql, [userId, otherId, otherId, userId]);
      return Number(res?.[0]?.cnt ?? res?.[0]?.count ?? 0) > 0;
    } catch (e) {
      console.warn('amistades check failed', e?.message);
      return false;
    }
  }

  private async checkAndAcceptReversePendingRequest(to: number, from: number): Promise<any> {
    try {
      const reverseSql = `
        SELECT ra.id_relacion_amistad as id_relacion
        FROM relaciones_amistades ra
        JOIN solicitudes_amistad sa ON sa.id_relacion_amistad = ra.id_relacion_amistad
        WHERE ra.id_usuario = $1 AND sa.id_destinatario = $2 AND ra.estado = 'pendiente'
      `;
      const reverseRows = await this.dataSource.query(reverseSql, [to, from]);
      
      if (!reverseRows?.[0]) {
        return { accepted: false };
      }

      const reverseId = reverseRows[0].id_relacion ?? reverseRows[0].id_relacion_amistad;
      const queryRunner = this.dataSource.createQueryRunner();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.query(
          `UPDATE relaciones_amistades SET estado = 'aceptada', fecha_aceptacion_amistad = CURRENT_TIMESTAMP WHERE id_relacion_amistad = $1`,
          [Number(reverseId)]
        );

        await queryRunner.query(
          `INSERT INTO amistades (id_relacion_amistad, usuario1, usuario2, fecha_amistad) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          [Number(reverseId), to, from]
        );

        await queryRunner.commitTransaction();
        return {
          accepted: true,
          success: true,
          message: 'Solicitud cruzada detectada: amistad aceptada automáticamente',
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (e) {
      console.warn('Reverse pending check failed', e?.message);
      return { accepted: false };
    }
  }

  private async createNewFriendRequest(from: number, to: number): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const relResult = await queryRunner.query(
        `INSERT INTO relaciones_amistades (id_usuario, estado, fecha_solicitud_amistad) VALUES ($1, 'pendiente', CURRENT_TIMESTAMP) RETURNING id_relacion_amistad`,
        [from]
      );
      const idRelacion = relResult[0].id_relacion_amistad;

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
  }
}