// Worker del AGENTE IA de WhatsApp. Servicio de larga vida: no es un cron.
//
// La diferencia con `frequent-cron.mjs` es la cadencia, y por eso son dos servicios
// distintos: aquel corre cada 10 minutos y sirve para campañas de correo; una persona
// que escribe por WhatsApp espera respuesta en segundos, no en un cuarto de hora.
//
// ── Configuración del servicio en Railway (mismo repositorio) ──────────────────────
//     Start command : node scripts/agente-worker.mjs
//     Sin cron schedule: es un proceso que no termina.
//   Variables:
//     CRON_TOKEN  (requerido) el MISMO valor que en el servicio web
//     APP_URL     (requerido) https://app.grupocc.org
//     AGENTE_INTERVALO_MS (opcional) por defecto 5000
//
// Todo el trabajo lo hace la app en /api/agente/procesar. Aquí no hay lógica de negocio
// a propósito: si la hubiera, habría que mantenerla en dos sitios y acabarían divergiendo.

const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const TOKEN = process.env.CRON_TOKEN || '';
const INTERVALO = Number(process.env.AGENTE_INTERVALO_MS || 5000);

if (!APP_URL || !TOKEN) {
  console.error('✖ Faltan APP_URL o CRON_TOKEN. El worker no arranca.');
  process.exit(1);
}

let corriendo = true;
let fallosSeguidos = 0;

/** Espera creciente ante fallos seguidos, para no martillear una app caída. */
function esperaTrasFallo() {
  return Math.min(60_000, INTERVALO * Math.pow(2, Math.min(fallosSeguidos, 4)));
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function unPase() {
  const control = new AbortController();
  // Un pase no debería pasar de dos minutos; si se cuelga, se corta y se reintenta.
  const corte = setTimeout(() => control.abort(), 130_000);
  try {
    const res = await fetch(`${APP_URL}/api/agente/procesar`, {
      method: 'POST',
      headers: { 'x-cron-token': TOKEN, 'Content-Type': 'application/json' },
      signal: control.signal,
    });
    const cuerpo = await res.json().catch(() => ({}));

    if (!res.ok) {
      fallosSeguidos++;
      console.error(`✖ pase HTTP ${res.status}: ${cuerpo.error ?? ''} (fallo ${fallosSeguidos})`);
      return { ok: false, quedan: false };
    }

    fallosSeguidos = 0;
    // Solo se escribe cuando pasó algo: si no, el registro se llena de líneas vacías y
    // deja de servir para encontrar el día que algo falle de verdad.
    if (cuerpo.reclamados > 0 || cuerpo.recuperados > 0) {
      const detalle = Object.entries(cuerpo.cuenta ?? {}).map(([k, v]) => `${k}:${v}`).join(' ');
      console.log(
        `· ${cuerpo.reclamados} trabajo(s)${cuerpo.recuperados ? `, ${cuerpo.recuperados} recuperado(s)` : ''}` +
        `${detalle ? ` → ${detalle}` : ''} (${cuerpo.ms} ms)`,
      );
    }
    return { ok: true, quedan: !!cuerpo.quedan };
  } catch (err) {
    fallosSeguidos++;
    const motivo = err?.name === 'AbortError' ? 'el pase tardó demasiado' : err?.message;
    console.error(`✖ ${motivo} (fallo ${fallosSeguidos})`);
    return { ok: false, quedan: false };
  } finally {
    clearTimeout(corte);
  }
}

async function bucle() {
  console.log(`▶ Worker del agente en marcha · ${APP_URL} · cada ${INTERVALO} ms`);
  while (corriendo) {
    const r = await unPase();
    if (!corriendo) break;
    // Si el pase se llenó, quedan conversaciones esperando: se vuelve enseguida en vez
    // de dejarlas otro intervalo sin respuesta.
    if (r.ok && r.quedan) continue;
    await dormir(r.ok ? INTERVALO : esperaTrasFallo());
  }
  console.log('■ Worker detenido.');
}

// Railway manda SIGTERM al redesplegar. Se termina el pase en curso antes de salir: si se
// cortara en seco, el trabajo quedaría en 'procesando' y habría que esperar a que la
// recuperación de colgados lo devolviera a la cola.
for (const señal of ['SIGTERM', 'SIGINT']) {
  process.on(señal, () => {
    if (!corriendo) process.exit(0);
    console.log(`… ${señal} recibido: terminando el pase en curso.`);
    corriendo = false;
  });
}

bucle().catch((e) => {
  console.error('✖ El worker se cayó:', e);
  process.exit(1);
});
