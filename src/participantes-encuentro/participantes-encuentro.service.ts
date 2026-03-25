import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateParticipanteDto } from './dto/create-participante.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';
import { ParticipanteEncuentro } from './entities/participante-encuentro.entity';
import { ParticipantesEncuentroView } from './entities/participantes-encuentro-view.entity';
import { VistaParticipantesAportes } from './entities/vista-participantes-aportes.entity';
import { Encuentro } from '../encuentro/entities/encuentro.entity';

@Injectable()
export class ParticipantesEncuentroService {
  constructor(
    @InjectRepository(ParticipanteEncuentro)
    private readonly participanteRepository: Repository<ParticipanteEncuentro>,
    @InjectRepository(ParticipantesEncuentroView)
    private readonly participantesViewRepository: Repository<ParticipantesEncuentroView>,
    @InjectRepository(VistaParticipantesAportes)
    private readonly participantesAportesRepository: Repository<VistaParticipantesAportes>,
    @InjectRepository(Encuentro)
    private readonly encuentroRepository: Repository<Encuentro>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createParticipanteDto: CreateParticipanteDto) {
    // Verificar que el encuentro existe
    const encuentro = await this.encuentroRepository.findOne({
      where: { id: createParticipanteDto.idEncuentro }
    });

    if (!encuentro) {
      throw new NotFoundException('El encuentro no existe');
    }

    // Verificar que el solicitante es el creador del encuentro
    if (encuentro.idCreador !== createParticipanteDto.idSolicitante) {
      throw new ForbiddenException('Solo el creador del encuentro puede agregar participantes');
    }

    // Verificar si el usuario ya está participando en el encuentro
    const existente = await this.participanteRepository.findOne({
      where: {
        idEncuentro: createParticipanteDto.idEncuentro,
        idUsuario: createParticipanteDto.idUsuario,
      },
    });

    if (existente) {
      throw new ConflictException('El usuario ya está participando en este encuentro');
    }

    // Usar SQL directo para insertar
    const rol = createParticipanteDto.rol || 'participante';
    
    try {
      const sql = `
        INSERT INTO participantes_encuentro (id_encuentro, id_usuario, rol)
        VALUES ($1, $2, $3)
      `;
      
      await this.dataSource.query(sql, [
        createParticipanteDto.idEncuentro,
        createParticipanteDto.idUsuario,
        rol
      ]);
      
      // Recuperar el registro insertado
      const inserted = await this.participanteRepository.findOne({
        where: {
          idEncuentro: createParticipanteDto.idEncuentro,
          idUsuario: createParticipanteDto.idUsuario,
        },
      });
      
      return inserted;
    } catch (error) {
      console.error('Error insertando participante:', error);
      throw new ConflictException('Error al agregar participante al encuentro');
    }
  }

  async findAll() {
    return await this.participanteRepository.find({
      relations: ['encuentro', 'usuario'],
    });
  }

  async findByEncuentro(idEncuentro: number) {
    return await this.participanteRepository.find({
      where: { idEncuentro },
      relations: ['usuario'],
    });
  }

  async findByUsuario(idUsuario: number) {
    return await this.participanteRepository.find({
      where: { idUsuario },
      relations: ['encuentro'],
    });
  }

  async findOne(id: number) {
    const participante = await this.participanteRepository.findOne({
      where: { id },
      relations: ['encuentro', 'usuario'],
    });

    if (!participante) {
      throw new NotFoundException(`Participante con ID ${id} no encontrado`);
    }

    return participante;
  }

  async update(id: number, updateParticipanteDto: UpdateParticipanteDto) {
    const participante = await this.findOne(id);
    Object.assign(participante, updateParticipanteDto);
    return await this.participanteRepository.save(participante);
  }

  async remove(id: number) {
    const participante = await this.findOne(id);
    await this.participanteRepository.remove(participante);
    return { message: 'Participante eliminado correctamente' };
  }

  async removeByEncuentroAndUsuario(idEncuentro: number, idUsuario: number) {
    // Verificar que el encuentro existe
    const encuentro = await this.encuentroRepository.findOne({
      where: { id: idEncuentro }
    });

    if (!encuentro) {
      throw new NotFoundException('El encuentro no existe');
    }

    // Verificar que el usuario no es el creador del encuentro
    if (encuentro.idCreador === idUsuario) {
      throw new ForbiddenException('El creador no puede salir de su propio encuentro. Debe eliminarlo si desea cancelarlo.');
    }

    const participante = await this.participanteRepository.findOne({
      where: { idEncuentro, idUsuario },
    });

    if (!participante) {
      throw new NotFoundException('No eres participante de este encuentro');
    }

    await this.participanteRepository.remove(participante);
    return { message: 'Has salido del encuentro correctamente' };
  }

  // Métodos para consultar la vista v_participantes_encuentro
  async findAllFromView(idEncuentro?: number, idUsuario?: number) {
    let sql = `
      SELECT 
        id_encuentro,
        titulo_encuentro,
        fecha,
        id_usuario,
        nombre_completo,
        rol
      FROM v_participantes_encuentro
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (idEncuentro) {
      sql += ` AND id_encuentro = $1`;
      params.push(idEncuentro);
    }
    
    if (idUsuario) {
      const paramIndex = params.length + 1;
      sql += ` AND id_usuario = $${paramIndex}`;
      params.push(idUsuario);
    }
    
    sql += ` ORDER BY fecha DESC, titulo_encuentro`;
    
    const result = await this.dataSource.query(sql, params);
    
    return result.map((row: any) => ({
      idEncuentro: row.id_encuentro,
      tituloEncuentro: row.titulo_encuentro,
      fecha: row.fecha,
      idUsuario: row.id_usuario,
      nombreCompleto: row.nombre_completo,
      rol: row.rol
    }));
  }

  async findParticipantesByEncuentroFromView(idEncuentro: number) {
    return this.findAllFromView(idEncuentro);
  }

  async findEncuentrosByUsuarioFromView(idUsuario: number) {
    return this.findAllFromView(undefined, idUsuario);
  }

  // Métodos para consultar la vista vistaparticipantesaportes
  async findParticipantesConAportes(idEncuentro?: number, idUsuario?: number) {
    let sql = `
      SELECT 
        id_encuentro,
        nombre_encuentro,
        id_usuario,
        nombre_usuario,
        apellido_usuario,
        rol,
        total_aportes
      FROM vistaparticipantesaportes
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (idEncuentro) {
      sql += ` AND id_encuentro = $1`;
      params.push(idEncuentro);
    }
    
    if (idUsuario) {
      const paramIndex = params.length + 1;
      sql += ` AND id_usuario = $${paramIndex}`;
      params.push(idUsuario);
    }
    
    sql += ` ORDER BY total_aportes DESC, nombre_usuario`;
    
    const result = await this.dataSource.query(sql, params);
    
    return result.map((row: any) => ({
      idEncuentro: row.id_encuentro,
      nombreEncuentro: row.nombre_encuentro,
      idUsuario: row.id_usuario,
      nombreUsuario: row.nombre_usuario,
      apellidoUsuario: row.apellido_usuario,
      nombreCompleto: `${row.nombre_usuario} ${row.apellido_usuario}`,
      rol: row.rol,
      totalAportes: Number.parseFloat(row.total_aportes) || 0
    }));
  }

  async findAportesByEncuentro(idEncuentro: number) {
    return this.findParticipantesConAportes(idEncuentro);
  }

  async findAportesByUsuario(idUsuario: number) {
    return this.findParticipantesConAportes(undefined, idUsuario);
  }
}
