import { pool } from '@/lib/db';

/**
 * ⇒ APPS PARA EL TELÉFONO (Herramientas; Fernando, 2026-10-21).
 *
 * Un tipo de herramienta que no corre en la web: es un paquete para instalar en el teléfono, fuera
 * de las tiendas. La primera es el «Descargador GCC» (Android, `movil/descargador/`).
 *
 * - El APK vive en el Drive de la empresa (`GCC World · Archivos de la empresa / Apps para el
 *   teléfono / <slug>`), no en el repo ni en la imagen de Railway: pesa ~67 MB por versión.
 * - Se descarga con sesión (`/api/herramientas/apps/<slug>/apk`); la versión vigente es pública
 *   (`…/version`) porque la consulta la propia app para avisar de que hay una nueva.
 * - Cada versión se publica con `scripts/publicar-app-movil.ts` (sube a Drive y deja una fila
 *   por versión; la vigente es la de `version_code` más alto).
 * - Firmadas con `~/.android/gcc-herramientas.jks`: sin ESA clave el teléfono no acepta la
 *   actualización y hay que desinstalar. Ver MEMORIA.md.
 */

export type AppMovil = {
  slug: string;
  plataforma: 'android';
  version_name: string;
  version_code: number;
  drive_id: string;
  tamano: number;
  sha256: string;
  publicada_en: string;
};

let asegurando: Promise<void> | null = null;
export function asegurarTablaApps(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.apps_moviles (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        plataforma TEXT NOT NULL DEFAULT 'android',
        version_name TEXT NOT NULL,
        version_code INT NOT NULL,
        drive_id TEXT NOT NULL,
        tamano BIGINT NOT NULL,
        sha256 TEXT NOT NULL,
        publicada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (slug, plataforma, version_code)
      );
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

/** La versión vigente (la más alta) de una app, o null si aún no se publicó ninguna. */
export async function appVigente(slug: string, plataforma = 'android'): Promise<AppMovil | null> {
  await asegurarTablaApps();
  const { rows: [r] } = await pool.query(
    `SELECT slug, plataforma, version_name, version_code, drive_id, tamano::float8 AS tamano, sha256, publicada_en
       FROM gcc_world.apps_moviles WHERE slug = $1 AND plataforma = $2
      ORDER BY version_code DESC LIMIT 1`,
    [slug, plataforma],
  );
  return r ?? null;
}

export const nombreApk = (a: Pick<AppMovil, 'slug' | 'version_name'>) => `gcc-${a.slug}-${a.version_name}.apk`;
