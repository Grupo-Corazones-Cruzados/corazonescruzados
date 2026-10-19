import { revisarAvisosPush } from '@/lib/calendar/avisos-push';

/**
 * ⇒ AVISOS DE REUNIÓN AL MÓVIL (2026-10-19): se revisan CADA MINUTO aquí, dentro del servidor
 * web, porque el cron de Railway va cada 10 min y un aviso de «faltan 5 min» no puede esperar
 * tanto. El cron frecuente lo llama también, de respaldo; el trabajo es idempotente
 * (`lib/calendar/avisos-push.ts`). Solo en producción, y `AVISOS_PUSH=no` lo apaga (pruebas en
 * local contra la base real: no hay que mandar push reales desde aquí).
 */
if (process.env.NODE_ENV === 'production' && process.env.AVISOS_PUSH !== 'no') {
  const correr = () => { revisarAvisosPush().catch((e) => console.error('[avisos-push]', e?.message)); };
  setTimeout(correr, 20_000);
  setInterval(correr, 60_000);
}
