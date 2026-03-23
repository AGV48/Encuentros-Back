export class CreateParticipanteDto {
  idEncuentro: number;
  idUsuario: number;
  idSolicitante: number; // ID del usuario que está agregando al participante
  rol?: string;
}
