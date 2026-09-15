import type {
  TipoComida,
  DiaSemana,
  CategoriaAlimento,
  EstadoCliente,
  Genero,
  Actividad,
  TipoMensaje,
} from '@/generated/prisma/enums';
import type { Tono } from '@/componentes/ui';

/**
 * Los nombres que se enseñan de cada enumeración. Fuente única: una pantalla
 * que escriba «Media Tarde» a mano es la forma de que otra ponga «Media tarde».
 */

export const TIPOS_COMIDA: TipoComida[] = ['DESAYUNO', 'MEDIA_MANANA', 'ALMUERZO', 'MEDIA_TARDE', 'CENA'];
export const ETIQUETA_COMIDA: Record<TipoComida, string> = {
  DESAYUNO: 'Desayuno',
  MEDIA_MANANA: 'Media mañana',
  ALMUERZO: 'Almuerzo',
  MEDIA_TARDE: 'Media tarde',
  CENA: 'Cena',
};
/** El color de la banda de cada comida en la etiqueta: se distingue de lejos. */
export const COLOR_COMIDA: Record<TipoComida, string> = {
  DESAYUNO: '#0f6cbd',
  MEDIA_MANANA: '#008272',
  ALMUERZO: '#0f7b0f',
  MEDIA_TARDE: '#ca5010',
  CENA: '#5c2d91',
};

export const DIAS_SEMANA: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
export const ETIQUETA_DIA: Record<DiaSemana, string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
  DOMINGO: 'Domingo',
};
export const DIA_CORTO: Record<DiaSemana, string> = {
  LUNES: 'L',
  MARTES: 'M',
  MIERCOLES: 'X',
  JUEVES: 'J',
  VIERNES: 'V',
  SABADO: 'S',
  DOMINGO: 'D',
};

export const CATEGORIAS: CategoriaAlimento[] = ['PROTEINA', 'CARBOHIDRATO', 'VEGETAL', 'FRUTA', 'LACTEO', 'OTRO'];
export const ETIQUETA_CATEGORIA: Record<CategoriaAlimento, string> = {
  PROTEINA: 'Proteína',
  CARBOHIDRATO: 'Carbohidrato',
  VEGETAL: 'Vegetal',
  FRUTA: 'Fruta',
  LACTEO: 'Lácteo',
  OTRO: 'Otro',
};

export const ETIQUETA_ESTADO_CLIENTE: Record<EstadoCliente, string> = {
  PENDIENTE: 'Pendiente',
  ACTIVO: 'Activo',
  INACTIVO: 'Inactivo',
  RECHAZADO: 'Rechazado',
};
export const TONO_ESTADO_CLIENTE: Record<EstadoCliente, Tono> = {
  PENDIENTE: 'aviso',
  ACTIVO: 'exito',
  INACTIVO: 'neutro',
  RECHAZADO: 'error',
};

export const ETIQUETA_GENERO: Record<Genero, string> = { MASCULINO: 'Masculino', FEMENINO: 'Femenino', OTRO: 'Otro' };
export const ETIQUETA_ACTIVIDAD: Record<Actividad, string> = {
  SEDENTARIO: 'Sedentario',
  LEVE: 'Leve',
  MODERADO: 'Moderado',
  INTENSO: 'Intenso',
};

export const ETIQUETA_MENSAJE: Record<TipoMensaje, string> = {
  SOLICITUD_INFO: 'Solicitud de información',
  NOTIFICACION: 'Notificación',
  APROBACION: 'Aprobación',
  RECHAZO: 'Rechazo',
};
export const TONO_MENSAJE: Record<TipoMensaje, Tono> = {
  SOLICITUD_INFO: 'aviso',
  NOTIFICACION: 'info',
  APROBACION: 'exito',
  RECHAZO: 'error',
};

/** Las restricciones fijas de despacho, con el texto que va en la etiqueta. */
export const RESTRICCIONES_DESPACHO = [
  ['sinAgua', 'Sin agua'],
  ['sinFruta', 'Sin fruta'],
  ['sinCubiertos', 'Sin cubiertos'],
  ['envasesPropios', 'Envases propios'],
] as const;
export type ClaveDespacho = (typeof RESTRICCIONES_DESPACHO)[number][0];
