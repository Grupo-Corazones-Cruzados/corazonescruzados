/**
 * Publica una versión de una app para el teléfono (`lib/herramientas/apps.ts`).
 *
 *   set -a; source .env; source .env.local; set +a
 *   npx tsx --tsconfig tsconfig.json scripts/publicar-app-movil.ts descargador-video movil/descargador/app/build/outputs/apk/release/app-release.apk
 *
 * Lee versionName/versionCode del propio APK (aapt2), comprueba que esté firmado con la clave de
 * herramientas, lo sube al Drive de la empresa y deja la fila. Rechaza un versionCode ya publicado.
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { pool } from '@/lib/db';
import { subir } from '@/lib/media/drive';
import { asegurarTablaApps, nombreApk } from '@/lib/herramientas/apps';

const TOOLS = `${homedir()}/Library/Android/sdk/build-tools/36.1.0`;
// Huella del certificado de `~/.android/gcc-herramientas.jks` (creado el 2026-10-21).
const HUELLA = 'ce7ae0e72fedd1e4c275c7a4c318d67e1353dd4b4a41e4cf40029956cec525b7';

async function main() {
  const [slug, ruta] = process.argv.slice(2);
  if (!slug || !ruta) throw new Error('Uso: publicar-app-movil.ts <slug> <ruta.apk>');

  const badging = execFileSync(`${TOOLS}/aapt2`, ['dump', 'badging', ruta]).toString();
  const m = badging.match(/versionCode='(\d+)' versionName='([^']+)'/);
  if (!m) throw new Error('No se pudo leer la versión del APK');
  const [versionCode, versionName] = [Number(m[1]), m[2]];

  const firma = execFileSync(`${TOOLS}/apksigner`, ['verify', '--print-certs', ruta]).toString();
  if (!firma.includes(HUELLA)) throw new Error('El APK no está firmado con la clave de herramientas (¿es el de depuración?)');

  await asegurarTablaApps();
  const { rowCount } = await pool.query(
    `SELECT 1 FROM gcc_world.apps_moviles WHERE slug = $1 AND plataforma = 'android' AND version_code = $2`, [slug, versionCode],
  );
  if (rowCount) throw new Error(`La versión ${versionCode} de ${slug} ya está publicada: sube versionCode en app/build.gradle`);

  const datos = readFileSync(ruta);
  const sha256 = createHash('sha256').update(datos).digest('hex');
  const nombre = nombreApk({ slug, version_name: versionName });
  console.log(`Subiendo ${nombre} (${(datos.length / 1e6).toFixed(1)} MB)…`);
  const s = await subir({ datos, nombre, mime: 'application/vnd.android.package-archive', ruta: ['Apps para el teléfono', slug] });
  await pool.query(
    `INSERT INTO gcc_world.apps_moviles (slug, plataforma, version_name, version_code, drive_id, tamano, sha256)
     VALUES ($1, 'android', $2, $3, $4, $5, $6)`,
    [slug, versionName, versionCode, s.id, s.tamano, sha256],
  );
  console.log(`Publicada ${slug} ${versionName} (${versionCode}) · Drive ${s.id} · sha256 ${sha256}`);
  await pool.end();
}

main().catch(async (e) => { console.error(e.message); await pool.end().catch(() => {}); process.exit(1); });
