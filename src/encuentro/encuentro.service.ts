import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateEncuentroDto } from './dto/create-encuentro.dto';
import { UpdateEncuentroDto } from './dto/update-encuentro.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Encuentro } from './entities/encuentro.entity';
import { EncuentroResumen } from './entities/encuentro-resumen.entity';
import { Repository, DataSource } from 'typeorm';
import { ParticipanteEncuentro } from '../participantes-encuentro/entities/participante-encuentro.entity';

@Injectable()
export class EncuentroService {
  constructor(
      @InjectRepository(Encuentro)
      private encuentrosRepository: Repository<Encuentro>,
      @InjectRepository(EncuentroResumen)
      private encuentroResumenRepository: Repository<EncuentroResumen>,
      @InjectRepository(ParticipanteEncuentro)
      private participanteRepository: Repository<ParticipanteEncuentro>,
      private dataSource: DataSource,
    ) {}
  async create(createEncuentroDto: CreateEncuentroDto) {
    const { idCreador, titulo, descripcion, lugar, fecha } = createEncuentroDto as any;
    try {
      const fechaParam = fecha instanceof Date ? fecha : new Date(fecha);
      
      // Validación: la fecha no puede ser pasada
      if (fechaParam.getTime() < Date.now()) {
        throw new BadRequestException('La fecha del encuentro no puede ser anterior a la fecha actual');
      }
      
      // Insertar directamente usando TypeORM
      const nuevoEncuentro = this.encuentrosRepository.create({
        idCreador,
        titulo,
        descripcion,
        lugar,
        fecha: fechaParam,
      });
      
      // Guardar el encuentro para obtener su ID generado
      await this.encuentrosRepository.save(nuevoEncuentro);

      // Insertar el usuario como creador en la tabla de participantes usando SQL directo
      const sql = `
        INSERT INTO participantes_encuentro (id_encuentro, id_usuario, rol)
        VALUES ($1, $2, 'creador')
      `;

      //Crear presupuesto asociado al encuentro
      const sqlPresupuesto = `
        INSERT INTO presupuestos (id_encuentro, presupuesto_total)
        VALUES ($1, 0)
      `;

      await this.dataSource.query(sql, [nuevoEncuentro.id, idCreador]);
      await this.dataSource.query(sqlPresupuesto, [nuevoEncuentro.id]);
      return { success: true };
    } catch (err) {
      throw err;
    }
  }

  async findAll(creadorId?: number) {
    if (creadorId) {
      // Obtener encuentros donde el usuario es creador O participante
      const sql = `
        SELECT e.id_encuentro, e.id_creador, e.titulo, e.descripcion, e.lugar, e.fecha, e.fecha_creacion
        FROM encuentros e
        WHERE e.id_creador = $1
        UNION
        SELECT e.id_encuentro, e.id_creador, e.titulo, e.descripcion, e.lugar, e.fecha, e.fecha_creacion
        FROM encuentros e
        INNER JOIN participantes_encuentro pe ON e.id_encuentro = pe.id_encuentro
        WHERE pe.id_usuario = $2
        ORDER BY fecha DESC
      `;
      
      const result = await this.dataSource.query(sql, [creadorId, creadorId]);
      
      // Normalizar las propiedades a camelCase
      return result.map((row: any) => ({
        id: row.id_encuentro,
        idCreador: row.id_creador,
        titulo: row.titulo,
        descripcion: row.descripcion,
        lugar: row.lugar,
        fecha: row.fecha,
        fechaCreacion: row.fecha_creacion
      }));
    }
    return this.encuentrosRepository.find();
  }

  findOne(id: number) {
    return this.encuentrosRepository.findOne({ where: { id } });
  }

  async findAllWithResumen(creadorId?: number) {
    // Consulta simplificada: solo usa la vista para participantes y presupuesto
    // Evita duplicados por múltiples bolsillos usando DISTINCT o agrupando
    if (creadorId) {
      const sql = `
        SELECT DISTINCT
          e.id_encuentro,
          e.id_creador,
          e.titulo,
          e.descripcion,
          e.lugar,
          e.fecha,
          e.fecha_creacion,
          p.id_presupuesto AS id_presupuesto,
          COALESCE(p.presupuesto_total, 0) AS presupuesto_total,
          COALESCE((
            SELECT COUNT(*) 
            FROM participantes_encuentro pe2 
            WHERE pe2.id_encuentro = e.id_encuentro
          ), 0) AS cant_participantes
        FROM encuentros e
        LEFT JOIN presupuestos p ON e.id_encuentro = p.id_encuentro
        WHERE e.id_encuentro IN (
          SELECT e2.id_encuentro 
          FROM encuentros e2 
          WHERE e2.id_creador = $1
          UNION
          SELECT pe.id_encuentro 
          FROM participantes_encuentro pe 
          WHERE pe.id_usuario = $2
        )
        ORDER BY e.fecha DESC
      `;
      
      const result = await this.dataSource.query(sql, [creadorId, creadorId]);
      
      // Normalizar las propiedades a camelCase
      return result.map((row: any) => ({
        id: row.id_encuentro,
        idCreador: row.id_creador,
        titulo: row.titulo,
        descripcion: row.descripcion,
        lugar: row.lugar,
        fecha: row.fecha,
        fechaCreacion: row.fecha_creacion,
        idPresupuesto: row.id_presupuesto,
        presupuestoTotal: parseFloat(row.presupuesto_total) || 0,
        cantParticipantes: parseInt(row.cant_participantes) || 0
      }));
    }
    
    // Si no hay filtro, devolver todos los registros
    const result = await this.dataSource.query(`
      SELECT DISTINCT
        e.id_encuentro,
        e.id_creador,
        e.titulo,
        e.descripcion,
        e.lugar,
        e.fecha,
        e.fecha_creacion,
        p.id_presupuesto AS id_presupuesto,
        COALESCE(p.presupuesto_total, 0) AS presupuesto_total,
        COALESCE((
          SELECT COUNT(*) 
          FROM participantes_encuentro pe 
          WHERE pe.id_encuentro = e.id_encuentro
        ), 0) AS cant_participantes
      FROM encuentros e
      LEFT JOIN presupuestos p ON e.id_encuentro = p.id_encuentro
      ORDER BY e.fecha DESC
    `);
    
    return result.map((row: any) => ({
      id: row.id_encuentro,
      idCreador: row.id_creador,
      titulo: row.titulo,
      descripcion: row.descripcion,
      lugar: row.lugar,
      fecha: row.fecha,
      fechaCreacion: row.fecha_creacion,
      idPresupuesto: row.id_presupuesto,
      presupuestoTotal: parseFloat(row.presupuesto_total) || 0,
      cantParticipantes: parseInt(row.cant_participantes) || 0
    }));
  }

  async update(idEncuentro: number, updateEncuentroDto: UpdateEncuentroDto, idUsuario: number) {
    // Verificar que el encuentro existe
    const encuentro = await this.encuentrosRepository.findOne({
      where: { id: idEncuentro }
    });

    if (!encuentro) {
      throw new NotFoundException('El encuentro no existe');
    }

    // Verificar que el usuario es el creador del encuentro
    if (encuentro.idCreador !== idUsuario) {
      throw new ForbiddenException('Solo el creador puede editar este encuentro');
    }

    // Validar la fecha si se está actualizando
    if (updateEncuentroDto.fecha) {
      const fechaParam = updateEncuentroDto.fecha instanceof Date 
        ? updateEncuentroDto.fecha 
        : new Date(updateEncuentroDto.fecha);
      
      // Validación: la fecha no puede ser pasada
      if (fechaParam.getTime() < Date.now()) {
        throw new BadRequestException('La fecha del encuentro no puede ser anterior a la fecha actual');
      }
      updateEncuentroDto.fecha = fechaParam;
    }

    // Actualizar los campos proporcionados
    Object.assign(encuentro, updateEncuentroDto);
    await this.encuentrosRepository.save(encuentro);
    
    return { 
      success: true,
      message: 'El encuentro ha sido actualizado correctamente',
      encuentro
    };
  }

  async remove(idEncuentro: number, idUsuario: number) {
    // Verificar que el encuentro existe
    const encuentro = await this.encuentrosRepository.findOne({
      where: { id: idEncuentro }
    });

    if (!encuentro) {
      throw new NotFoundException('El encuentro no existe');
    }

    // Verificar que el usuario es el creador del encuentro
    if (encuentro.idCreador !== idUsuario) {
      throw new ForbiddenException('Solo el creador puede eliminar este encuentro');
    }

    // Eliminar el encuentro (las eliminaciones en cascada se manejan en la BD)
    await this.encuentrosRepository.remove(encuentro);
    
    return { 
      success: true,
      message: 'El encuentro ha sido eliminado correctamente' 
    };
  }

  async salirDelEncuentro(idEncuentro: number, idUsuario: number) {
    // Verificar que el encuentro existe
    const encuentro = await this.encuentrosRepository.findOne({
      where: { id: idEncuentro }
    });

    if (!encuentro) {
      throw new NotFoundException('El encuentro no existe');
    }

    // Verificar que el usuario no es el creador del encuentro
    if (encuentro.idCreador === idUsuario) {
      throw new ForbiddenException('El creador no puede salir de su propio encuentro. Debe eliminarlo si desea cancelarlo.');
    }

    // Verificar que el usuario es participante
    const participante = await this.participanteRepository.findOne({
      where: { idEncuentro, idUsuario },
    });

    if (!participante) {
      throw new NotFoundException('No eres participante de este encuentro');
    }

    // Eliminar la participación
    await this.participanteRepository.remove(participante);
    
    return { 
      success: true,
      message: 'Has salido del encuentro correctamente' 
    };
  }
}
