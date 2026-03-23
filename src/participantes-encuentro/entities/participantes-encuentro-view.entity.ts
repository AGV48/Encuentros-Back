import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  name: 'v_participantes_encuentro',
  expression: `
    SELECT
      e.id_encuentro,
      e.titulo AS titulo_encuentro,
      e.fecha,
      u.id_usuario,
      CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo,
      p.rol
    FROM participantes_encuentro p
    JOIN usuarios u ON p.id_usuario = u.id_usuario
    JOIN encuentros e ON p.id_encuentro = e.id_encuentro
  `
})
export class ParticipantesEncuentroView {
  @ViewColumn({ name: 'id_encuentro' })
  idEncuentro: number;

  @ViewColumn({ name: 'titulo_encuentro' })
  tituloEncuentro: string;

  @ViewColumn({ name: 'fecha' })
  fecha: Date;

  @ViewColumn({ name: 'id_usuario' })
  idUsuario: number;

  @ViewColumn({ name: 'nombre_completo' })
  nombreCompleto: string;

  @ViewColumn({ name: 'rol' })
  rol: string;
}
