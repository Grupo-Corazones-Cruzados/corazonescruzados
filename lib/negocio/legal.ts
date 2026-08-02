/**
 * REGISTRO DE DOCUMENTOS LEGALES — la fuente única de qué hay y dónde está.
 *
 * ── EL PROBLEMA QUE RESUELVE ───────────────────────────────────────────────────
 * Cada servicio nuevo trae su parte legal. Sin un registro, eso acaba en páginas sueltas
 * repartidas por el sitio, enlazadas de formas distintas desde sitios distintos, y con la
 * navegación de cada una escrita a mano. A los tres servicios ya nadie sabe qué documentos
 * existen ni si el enlace que puso en un formulario sigue siendo el bueno.
 *
 * Aquí se declara **una vez** cada documento: dónde vive, a quién habla, qué papel jugamos
 * en él y qué puntos concretos se enlazan desde fuera. De este registro salen:
 *
 *   · el índice de `/legal`,
 *   · la lista de documentos en la barra lateral de TODOS ellos —se navega entre documentos
 *     como en una documentación, no volviendo atrás—,
 *   · y `enlaceLegal()`, que da la URL correcta a quien la necesite.
 *
 * ── CÓMO SE AÑADE UN SERVICIO NUEVO ────────────────────────────────────────────
 * 1. Se crea `app/(sitio)/legal/<id>/page.tsx` con `DocumentoLegal`.
 * 2. Se añade su entrada aquí.
 * Y ya aparece en el índice, en la barra lateral de todos los documentos y en el mapa del
 * sitio. **No hay un tercer sitio que tocar.**
 *
 * ── LA REGLA DE LAS URLs ───────────────────────────────────────────────────────
 * ⚠️ Una URL publicada **no se cambia**. `/legal` y `/legal/whatsapp`, con sus anclas, están
 * declaradas en la app de Meta y enlazadas desde formularios. Reorganizar la navegación no
 * puede mover las páginas de sitio: se añaden puertas, no se mueven las habitaciones.
 */

/** Qué papel jugamos sobre los datos de ese documento. Es lo que más confunde. */
export type PapelGCC = 'responsable' | 'encargado';

export interface PuntoLegal {
  /** El ancla, sin `#`. */
  id: string;
  label: string;
  /** Se muestra destacado en el índice: es de los que la gente busca. */
  destacado?: boolean;
}

export interface DocumentoLegalMeta {
  id: string;
  ruta: string;
  titulo: string;
  /** Nombre corto para la barra lateral, donde no cabe el largo. */
  corto: string;
  /** A quién habla. Es lo primero que alguien necesita saber para elegir. */
  para: string;
  resumen: string;
  papel: PapelGCC;
  /** Los puntos enlazables desde fuera. Los `destacado` salen en el índice. */
  puntos: PuntoLegal[];
}

export const DOCUMENTOS_LEGALES: DocumentoLegalMeta[] = [
  {
    id: 'general',
    ruta: '/legal',
    titulo: 'Términos y condiciones y política de privacidad',
    corto: 'Términos del sitio',
    para: 'Personas candidatas y miembros del proyecto, y quien use este sitio.',
    resumen:
      'Condiciones de uso del sitio y tratamiento de los datos de las personas del proyecto.',
    papel: 'responsable',
    puntos: [
      { id: 'eliminar-datos', label: 'Cómo eliminar tus datos', destacado: true },
      { id: 's14', label: 'Derechos del titular' },
      { id: 's12', label: 'Encargados y transferencias internacionales' },
      { id: 's19', label: 'Términos de uso del sitio' },
    ],
  },
  {
    id: 'whatsapp',
    ruta: '/legal/whatsapp',
    titulo: 'Servicio de Agente IA en WhatsApp',
    corto: 'Agente IA en WhatsApp',
    para:
      'Quien escribe por WhatsApp a una empresa atendida por nuestro agente, y la empresa que contrata el servicio.',
    resumen:
      'Privacidad del servicio, condiciones para la empresa cliente y anexo de encargo del tratamiento.',
    papel: 'encargado',
    puntos: [
      { id: 'eliminar-datos', label: 'Cómo eliminar tus datos', destacado: true },
      { id: 'condiciones', label: 'Condiciones del servicio', destacado: true },
      { id: 'autoridades', label: 'Solicitudes de autoridades', destacado: true },
      { id: 'encargo', label: 'Anexo de encargo del tratamiento' },
      { id: 'a2', label: 'Qué datos se tratan' },
      { id: 'a6', label: 'Con quién se comparten' },
    ],
  },
];

/**
 * La URL estandarizada de un documento o de uno de sus puntos.
 *
 * Se usa donde haga falta enlazar: formularios de alta, avisos de cookies, el panel de
 * Meta, un contrato. Así el enlace sale de una función y no de la memoria de quien escribe.
 *
 *   enlaceLegal('whatsapp')                    → '/legal/whatsapp'
 *   enlaceLegal('whatsapp', 'eliminar-datos')  → '/legal/whatsapp#eliminar-datos'
 */
export function enlaceLegal(idDocumento: string, idPunto?: string): string {
  const doc = DOCUMENTOS_LEGALES.find((d) => d.id === idDocumento);
  if (!doc) throw new Error(`No existe el documento legal «${idDocumento}»`);
  return idPunto ? `${doc.ruta}#${idPunto}` : doc.ruta;
}

/** La entrada del registro que corresponde a una ruta, para saber en cuál estamos. */
export function documentoDeRuta(ruta: string): DocumentoLegalMeta | undefined {
  // La más específica primero: `/legal/whatsapp` empieza por `/legal`.
  return [...DOCUMENTOS_LEGALES]
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .find((d) => ruta === d.ruta || ruta.startsWith(`${d.ruta}#`));
}
