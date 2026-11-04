/**
 * CONTROL PSICOSOCIAL — lo que comparten el servidor, la pantalla y el teléfono.
 * Sistema de Centralizado (colaborador · implementación). Primera sección: Rastreo.
 */

export const SLUG_CONTROL_PSICOSOCIAL = 'control-psicosocial';
export const RUTA_CONTROL_PSICOSOCIAL = `/dashboard/centralized/colaborador/implementacion/${SLUG_CONTROL_PSICOSOCIAL}`;

/** La frase que dispara el auxilio. El teléfono la recibe al activarse: cambiarla es cambiar esto. */
export const FRASE_AUXILIO = 'yo te entrego todo';
/** Margen para cancelar una detección de voz equivocada antes de avisar a todos. */
export const SEGUNDOS_PARA_CANCELAR = 10;

/** Cada cuánto manda el teléfono su posición: normal y durante un auxilio. */
export const INTERVALO_NORMAL_S = 300;
export const INTERVALO_AUXILIO_S = 15;
/** Más viejo que esto, ya no se considera señal activa (el doble y medio del intervalo normal). */
export const MINUTOS_SENAL_ACTIVA = 15;
export const DIAS_HISTORIAL = 7;

export type FuncionCp = 'ubicacion' | 'voz';

/** Si cambia lo que se acepta, se sube la versión: queda escrito qué texto aceptó cada quien. */
export const VERSION_CONSENTIMIENTO = 2;

export const CONSENTIMIENTO: Record<FuncionCp, { titulo: string; puntos: string[]; aceptar: string }> = {
  ubicacion: {
    titulo: 'Compartir mi ubicación',
    aceptar: 'Acepto y activar',
    puntos: [
      'Este teléfono enviará tu ubicación a GCC World cada 5 minutos, también con la app cerrada, y cada 15 segundos durante un auxilio.',
      'Todos los miembros, incluido el administrador, pueden ver tu última ubicación en el mapa en cualquier momento.',
      'Cada vez que otro miembro abre el mapa queda registrado, y tú puedes ver quién fue.',
      'El mapa se dibuja con OpenStreetMap: al abrirlo, ese servicio recibe la zona que se está mirando.',
      `El historial se borra a los ${DIAS_HISTORIAL} días. Lo registrado durante un auxilio se conserva con ese auxilio.`,
      'El teléfono mostrará siempre que está activo. Puedes apagarlo cuando quieras desde aquí: se deja de enviar y se borra tu historial.',
      'Es voluntario. Negarte no te impide usar el resto de la plataforma.',
    ],
  },
  voz: {
    titulo: 'Detección de la frase de auxilio',
    aceptar: 'Acepto y activar',
    puntos: [
      `Este teléfono escuchará de forma continua para detectar la frase «${FRASE_AUXILIO}».`,
      'El audio se procesa solo dentro del teléfono: no se graba, no se guarda y no se envía a ningún sitio.',
      `Al detectarla, el teléfono vibra y tienes ${SEGUNDOS_PARA_CANCELAR} segundos para cancelar. Después, todos los miembros reciben tu alerta con tu ubicación.`,
      'El teléfono mostrará siempre que el micrófono está en uso. Gasta más batería. Puedes apagarlo cuando quieras desde aquí.',
      'Es voluntario. Negarte no te impide usar el resto de la plataforma.',
    ],
  },
};

export type FilaRastreo = {
  user_id: string;
  nombre: string;
  ubicacion_activa: boolean;
  voz_activa: boolean;
  lat: number | null;
  lng: number | null;
  precision_m: number | null;
  bateria: number | null;
  registrada_en: string | null;
  alerta_id: number | null;
};

export type EstadoSenal = 'auxilio' | 'activa' | 'sin_senal' | 'no_comparte';

export function estadoSenal(f: FilaRastreo, ahora = Date.now()): EstadoSenal {
  if (f.alerta_id) return 'auxilio';
  if (!f.ubicacion_activa) return 'no_comparte';
  if (!f.registrada_en) return 'sin_senal';
  return ahora - new Date(f.registrada_en).getTime() <= MINUTOS_SENAL_ACTIVA * 60_000 ? 'activa' : 'sin_senal';
}
