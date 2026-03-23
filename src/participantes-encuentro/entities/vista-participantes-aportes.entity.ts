import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({
  name: 'vistaparticipantesaportes',
  expression: `
    SELECT 
      p.id_encuentro,
      e.titulo AS nombre_encuentro,
      p.id_usuario,
      u.nombre AS nombre_usuario,
      u.apellido AS apellido_usuario,
      p.rol,
      COALESCE(SUM(a.monto),0) AS total_aportes
    FROM participantes_encuentro p
    JOIN usuarios u ON p.id_usuario = u.id_usuario        
    JOIN encuentros e ON p.id_encuentro = e.id_encuentro
    LEFT JOIN aportes a ON p.id_usuario = a.id_usuario 
                         AND p.id_encuentro = a.id_encuentro
    GROUP BY 
      p.id_encuentro, e.titulo, p.id_usuario, u.nombre, u.apellido, p.rol
  `
})
export class VistaParticipantesAportes {
  @ViewColumn({ name: 'id_encuentro' })
  idEncuentro: number;

  @ViewColumn({ name: 'nombre_encuentro' })
  nombreEncuentro: string;

  @ViewColumn({ name: 'id_usuario' })
  idUsuario: number;

  @ViewColumn({ name: 'nombre_usuario' })
  nombreUsuario: string;

  @ViewColumn({ name: 'apellido_usuario' })
  apellidoUsuario: string;

  @ViewColumn({ name: 'rol' })
  rol: string;

  @ViewColumn({ name: 'total_aportes' })
  totalAportes: number;
}
