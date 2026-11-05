import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import type { DocFlujo } from '@/components/espacio/flujo/colocar';

/**
 * EL DIAGRAMA QUE SE COMPARTE POR ENLACE.
 *
 * El diagrama vive en la Mac y la web no llega hasta allí, así que al compartir se guarda una COPIA en la base
 * y `/flujo/<token>` lee esa copia. Publicarla solo se puede desde el Espacio de trabajo; leerla, con el token.
 * · Un enlace por proyecto, como la cotización: generar otro deja sin efecto el anterior.
 * · En la base solo queda el hash del token: quien lea la tabla no puede abrir los enlaces.
 */
export interface FlujoCompartido { nombre: string; doc: DocFlujo; actualizado: number | null; vence: number }

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Solo lo que dibuja el visor. La ubicación en el código (`origen`) no sale de la Mac. */
export function docPublico(doc: DocFlujo): DocFlujo {
  return {
    version: doc.version,
    resumen: doc.resumen,
    roles: doc.roles.map(({ id, nombre, descripcion }) => ({ id, nombre, descripcion })),
    nodos: doc.nodos.map(({ id, tipo, rol, titulo, descripcion }) => ({ id, tipo, rol, titulo, descripcion })),
    conexiones: doc.conexiones.map(({ de, a, clase, etiqueta }) => ({ de, a, clase, etiqueta })),
  };
}

export async function publicarFlujo(o: { proyecto: string; nombre: string; doc: DocFlujo; actualizado: number | null; horas: number; correo: string | null }) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.flujos_compartidos (
      proyecto TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      doc JSONB NOT NULL,
      actualizado TIMESTAMPTZ,
      vence_en TIMESTAMPTZ NOT NULL,
      correo TEXT,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  const token = crypto.randomBytes(32).toString('hex');
  const vence = new Date(Date.now() + o.horas * 3600 * 1000);
  await pool.query(
    `INSERT INTO gcc_world.flujos_compartidos (proyecto, token_hash, nombre, doc, actualizado, vence_en, correo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (proyecto) DO UPDATE SET token_hash = $2, nombre = $3, doc = $4, actualizado = $5, vence_en = $6, correo = $7, creado_en = now()`,
    [o.proyecto, hash(token), o.nombre, JSON.stringify(docPublico(o.doc)), o.actualizado ? new Date(o.actualizado) : null, vence, o.correo],
  );
  return { token, vence };
}

/** Null si el enlace no existe, se sustituyó o venció: a quien lo abre le da igual cuál de las tres. */
export async function leerFlujoCompartido(token: string): Promise<FlujoCompartido | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows: [f] } = await pool.query(
    `SELECT nombre, doc, actualizado, vence_en FROM gcc_world.flujos_compartidos WHERE token_hash = $1 AND vence_en > now()`,
    [hash(token)],
  );
  return f ? { nombre: f.nombre, doc: f.doc, actualizado: f.actualizado ? new Date(f.actualizado).getTime() : null, vence: new Date(f.vence_en).getTime() } : null;
}
