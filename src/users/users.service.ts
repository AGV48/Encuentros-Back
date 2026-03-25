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
      return res && res[0] && Number(res[0].cnt ?? res[0].count ?? 0) > 0;
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
      return res && res[0] && Number(res[0].cnt ?? res[0].count ?? 0) > 0;
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
      return res && res[0] && Number(res[0].cnt ?? res[0].count ?? 0) > 0;
    } catch (e) {
      console.warn('Could not check pending requests (to) for search annotation', e?.message);
      return false;
    }
  }
}