/**
 * Sube GCC Progreso a un canal de prueba de Google Play, con su API.
 *
 *   node scripts/publicar-play.mjs                         solo lee el estado de los canales
 *   node scripts/publicar-play.mjs <paquete.aab> internal  sube y publica en la prueba interna
 *   node scripts/publicar-play.mjs <paquete.aab> alpha     sube y publica en la prueba cerrada
 *
 * Producción queda fuera a propósito: la cuenta de servicio no tiene ese permiso y ese paso lo da
 * Fernando en Play Console. La clave está en `~/.android/gcc-play-api.json`, fuera del repo.
 * Recuerda subir `versionCode` en `movil/android/app/build.gradle`: Play rechaza uno repetido.
 */
import { createReadStream, statSync } from 'fs';
import { homedir } from 'os';
import { google } from 'googleapis';

const PAQUETE = 'org.grupocc.gccworld';
const CANALES = ['internal', 'alpha'];
const [ruta, canal] = process.argv.slice(2);
if (ruta && !CANALES.includes(canal)) throw new Error(`Canal no válido: usa ${CANALES.join(' o ')}`);

const auth = new google.auth.GoogleAuth({
  keyFile: `${homedir()}/.android/gcc-play-api.json`,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const play = google.androidpublisher({ version: 'v3', auth });
const packageName = PAQUETE;

const { data: { id: editId } } = await play.edits.insert({ packageName });
let confirmado = false;
try {
  if (ruta) {
    console.log(`Subiendo ${ruta} (${(statSync(ruta).size / 1e6).toFixed(1)} MB)…`);
    const { data: b } = await play.edits.bundles.upload({
      packageName, editId,
      media: { mimeType: 'application/octet-stream', body: createReadStream(ruta) },
    });
    await play.edits.tracks.update({
      packageName, editId, track: canal,
      requestBody: { track: canal, releases: [{ name: process.env.NOTAS_NOMBRE || undefined, versionCodes: [String(b.versionCode)], status: 'completed', releaseNotes: process.env.NOTAS ? [{ language: 'es-419', text: process.env.NOTAS }] : undefined }] },
    });
    await play.edits.commit({ packageName, editId });
    confirmado = true;
    console.log(`Publicada la versión ${b.versionCode} en ${canal}.`);
  } else {
    const { data } = await play.edits.tracks.list({ packageName, editId });
    for (const t of data.tracks ?? []) {
      console.log(t.track, (t.releases ?? []).map((r) => `${r.name ?? ''} ${r.status} [${r.versionCodes ?? ''}]`).join(' | ') || '(vacío)');
    }
  }
} finally {
  if (!confirmado) await play.edits.delete({ packageName, editId }).catch(() => {});
}
