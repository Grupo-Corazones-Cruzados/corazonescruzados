import { pool, prisma } from '@/lib/db';
import { embeber, aVector } from '@/lib/ia';

/**
 * LOS ADJUNTOS DEL DOCENTE. El archivo no se guarda: se le saca el texto, se parte
 * en fragmentos y cada fragmento queda como vector en `adjunto_fragmentos`
 * (pgvector). El agente los consulta con la herramienta `buscar_en_adjuntos` y,
 * además, recibe de entrada los fragmentos más cercanos a las indicaciones.
 *
 * Máximo 5 archivos por solicitud (Fernando, 2026-09-15).
 */

export const MAX_ADJUNTOS = 5;
export const MAX_TAMANO = 10 * 1024 * 1024; // 10 MB
const MAX_CARACTERES = 200_000;
const TAMANO_FRAGMENTO = 1200;
const SOLAPE = 150;

export const TIPOS_ADMITIDOS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'text/plain': 'Texto',
  'text/markdown': 'Texto',
  'text/csv': 'Texto',
};

const porExtension = (nombre: string) => {
  const ext = nombre.toLowerCase().split('.').pop() ?? '';
  return { pdf: 'application/pdf', docx: TIPOS_ADMITIDOS_DOCX, txt: 'text/plain', md: 'text/markdown', csv: 'text/csv' }[ext] ?? '';
};
const TIPOS_ADMITIDOS_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Qué tipo real es: el navegador a veces manda `application/octet-stream`. */
export function tipoDe(archivo: { type: string; name: string }) {
  if (TIPOS_ADMITIDOS[archivo.type]) return archivo.type;
  const porExt = porExtension(archivo.name);
  return TIPOS_ADMITIDOS[porExt] ? porExt : null;
}

/** El texto de un archivo. Lanza con un mensaje para el docente si no se puede. */
export async function extraerTexto(datos: Buffer, tipo: string): Promise<string> {
  if (tipo === 'application/pdf') {
    // El módulo interno, no el índice: el índice de pdf-parse 1.x intenta leer un
    // PDF de prueba al cargarse cuando cree que está en modo depuración.
    const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default as (b: Buffer) => Promise<{ text: string }>;
    const r = await pdf(datos);
    return r.text ?? '';
  }
  if (tipo === TIPOS_ADMITIDOS_DOCX) {
    const mammoth = await import('mammoth');
    const r = await mammoth.extractRawText({ buffer: datos });
    return r.value ?? '';
  }
  return datos.toString('utf8');
}

/** Limpia y parte en fragmentos solapados, cortando en fin de párrafo o de frase cuando se puede. */
export function fragmentar(texto: string): string[] {
  const limpio = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CARACTERES);
  if (!limpio) return [];
  const trozos: string[] = [];
  let i = 0;
  while (i < limpio.length) {
    let fin = Math.min(i + TAMANO_FRAGMENTO, limpio.length);
    if (fin < limpio.length) {
      const ventana = limpio.slice(i, fin);
      const corte = Math.max(ventana.lastIndexOf('\n\n'), ventana.lastIndexOf('. '), ventana.lastIndexOf('\n'));
      if (corte > TAMANO_FRAGMENTO * 0.5) fin = i + corte + 1;
    }
    const trozo = limpio.slice(i, fin).trim();
    if (trozo) trozos.push(trozo);
    if (fin >= limpio.length) break;
    i = Math.max(fin - SOLAPE, i + 1);
  }
  return trozos;
}

/**
 * Sube un adjunto: extrae, fragmenta, embebe y guarda. Devuelve la fila. El
 * adjunto nace sin semana; se ata al crear la solicitud.
 */
export async function guardarAdjunto(p: {
  inquilinoId: number;
  usuarioId: number;
  archivo: File;
}): Promise<{ ok: true; adjunto: { id: number; nombre: string; fragmentos: number; caracteres: number } } | { ok: false; error: string }> {
  const tipo = tipoDe(p.archivo);
  if (!tipo) return { ok: false, error: 'Solo se admiten PDF, Word (.docx) y texto (.txt, .md, .csv).' };
  if (p.archivo.size > MAX_TAMANO) return { ok: false, error: 'El archivo no puede pasar de 10 MB.' };

  // Los huérfanos de otro día (subidos y nunca enviados) se van al subir el siguiente.
  await prisma.adjunto.deleteMany({
    where: { usuarioId: p.usuarioId, semanaId: null, creado: { lt: new Date(Date.now() - 86_400_000) } },
  });

  let texto: string;
  try {
    texto = await extraerTexto(Buffer.from(await p.archivo.arrayBuffer()), tipo);
  } catch (e: any) {
    console.error('[adjunto] extraer', e?.message);
    return { ok: false, error: `No se pudo leer «${p.archivo.name}». Si es un PDF escaneado, no tiene texto que extraer.` };
  }
  const trozos = fragmentar(texto);
  if (!trozos.length) return { ok: false, error: `«${p.archivo.name}» no tiene texto que se pueda leer.` };

  let vectores: number[][];
  try {
    vectores = [];
    // Por lotes: la API admite muchos a la vez, pero un documento largo son cientos.
    for (let i = 0; i < trozos.length; i += 64) vectores.push(...(await embeber(trozos.slice(i, i + 64))));
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'No se pudieron calcular los embeddings.' };
  }

  const adjunto = await prisma.adjunto.create({
    data: {
      inquilinoId: p.inquilinoId,
      usuarioId: p.usuarioId,
      nombre: p.archivo.name.slice(0, 200),
      tipo,
      tamano: p.archivo.size,
      caracteres: Math.min(texto.length, MAX_CARACTERES),
      fragmentos: trozos.length,
    },
  });
  // La columna `embedding` no la conoce Prisma: SQL crudo por el mismo pool.
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    for (let i = 0; i < trozos.length; i++)
      await cliente.query(
        'INSERT INTO adjunto_fragmentos (adjunto_id, orden, texto, embedding) VALUES ($1, $2, $3, $4::vector)',
        [adjunto.id, i, trozos[i], aVector(vectores[i])],
      );
    await cliente.query('COMMIT');
  } catch (e) {
    await cliente.query('ROLLBACK');
    await prisma.adjunto.delete({ where: { id: adjunto.id } }).catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
  return { ok: true, adjunto: { id: adjunto.id, nombre: adjunto.nombre, fragmentos: trozos.length, caracteres: adjunto.caracteres } };
}

export type Fragmento = { adjunto: string; orden: number; texto: string; distancia: number };

/** Los fragmentos más cercanos a una consulta, dentro de un conjunto de adjuntos. */
export async function buscarFragmentos(adjuntoIds: number[], consulta: string, k = 8): Promise<Fragmento[]> {
  if (!adjuntoIds.length || !consulta.trim()) return [];
  const [v] = await embeber([consulta.slice(0, 4000)]);
  const { rows } = await pool.query(
    `SELECT a.nombre AS adjunto, f.orden, f.texto, (f.embedding <=> $1::vector) AS distancia
       FROM adjunto_fragmentos f JOIN adjuntos a ON a.id = f.adjunto_id
      WHERE f.adjunto_id = ANY($2::int[]) AND f.embedding IS NOT NULL
      ORDER BY f.embedding <=> $1::vector
      LIMIT $3`,
    [aVector(v), adjuntoIds, k],
  );
  return rows.map((r) => ({ adjunto: r.adjunto, orden: r.orden, texto: r.texto, distancia: Number(r.distancia) }));
}
