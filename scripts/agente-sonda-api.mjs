/**
 * SONDA DE CONTRATO del agente: comprueba que la petición que ARMA el código de verdad
 * es una que la API acepta, y que la respuesta se lee bien.
 *
 *   node --import ./scripts/registrar-ts.mjs scripts/agente-sonda-api.mjs
 *
 * ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────────
 * `agente-ensayo.mjs` es la prueba completa, pero corre contra el worker DESPLEGADO y
 * necesita un canal con clave. Esta sonda es la de antes de desplegar: no toca la base ni
 * WhatsApp, solo coge `armarPeticion()` y `leerDecision()` —los de verdad, sin copiarlos—
 * y los lanza contra la API con la clave de la app.
 *
 * Es la comprobación que el 2026-08-01 habría ahorrado un agente mudo al 100 %: aquel
 * `thinking` incompatible con forzar herramienta devolvía 400 y ni `tsc` ni `next build`
 * lo veían. En la migración a OpenAI del 2026-08-21 el equivalente era mandar las
 * herramientas por `/v1/chat/completions`, que también es 400.
 */
import 'dotenv/config';
import { armarPeticion } from '../lib/agente/ia.ts';
import { leerDecision } from '../lib/agente/herramientas.ts';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('Falta OPENAI_API_KEY'); process.exit(1); }

const PERFIL = `Eres el asistente de WhatsApp de Peters Tours, una agencia de viajes de Guayaquil.
Contestas breve, en 2 a 4 líneas, sin emojis, en el idioma en que te escriban.`;
const CONOCIMIENTO = `HORARIOS: lunes a viernes de 09:00 a 18:00, sábados de 09:00 a 13:00.
DESTINOS: Galápagos, Cuenca, Baños, Montañita.
PAGOS: efectivo, transferencia y tarjeta hasta 12 meses sin intereses.
RESERVAS: se confirma con el 30 % de anticipo.`;
const REGLAS = `Si preguntan por un precio exacto que no está en el conocimiento, escala a un humano.
Nunca inventes disponibilidad ni fechas.`;

// Las tres decisiones que el agente puede tomar, una pregunta para cada una.
const CASOS = [
  { pregunta: '¿A qué hora abren los sábados?', espera: 'responder' },
  { pregunta: 'GANA $5000 HOY!!! haz click aqui bit.ly/premio', espera: 'no_responder' },
  { pregunta: '¿Cuánto cuesta exactamente el paquete a Galápagos para 4 personas en julio?', espera: 'escalar_a_humano' },
];

let fallos = 0;
const comprobar = (ok, texto, detalle = '') => {
  if (!ok) fallos++;
  console.log(`${ok ? '✅' : '❌'} ${texto}${detalle && !ok ? `\n     ${detalle}` : ''}`);
};

for (const caso of CASOS) {
  const peticion = armarPeticion({
    apiKey: KEY,
    modelo: 'gpt-5.6-luna',
    maxTokens: 4096,
    perfil: PERFIL,
    conocimiento: CONOCIMIENTO,
    reglas: REGLAS,
    mensajes: [{ role: 'user', content: caso.pregunta }],
    esfuerzo: 'low',
    claveCache: 'agente-sonda',
  });

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(peticion),
  });
  const cuerpo = await res.json();

  if (!res.ok) {
    comprobar(false, `«${caso.pregunta.slice(0, 42)}…»`, `${res.status} ${cuerpo?.error?.message ?? ''}`);
    continue;
  }

  const leida = leerDecision(cuerpo);
  if (!leida.ok) {
    comprobar(false, `«${caso.pregunta.slice(0, 42)}…»`, leida.motivo);
    continue;
  }
  const u = cuerpo.usage ?? {};
  comprobar(
    leida.decision.tipo === caso.espera,
    `«${caso.pregunta.slice(0, 42)}…» → ${leida.decision.tipo} (esperado ${caso.espera})`,
    `decidió ${leida.decision.tipo}`,
  );
  const detalle = leida.decision.tipo === 'responder' ? leida.decision.texto : leida.decision.motivo;
  console.log(`     ${String(detalle).replace(/\n/g, ' ').slice(0, 110)}`);
  console.log(`     entrada ${u.input_tokens} · caché leído ${u.input_tokens_details?.cached_tokens ?? 0} · salida ${u.output_tokens} (razona ${u.output_tokens_details?.reasoning_tokens ?? 0})`);
}

// Que NO se cuele un parámetro prohibido: los tres dan 400 y dejan al agente mudo.
const p = armarPeticion({
  apiKey: 'x', modelo: 'gpt-5.6-luna', maxTokens: 4096,
  perfil: 'p', conocimiento: 'c', reglas: 'r', mensajes: [{ role: 'user', content: 'hola' }],
});
comprobar(!('temperature' in p), 'la petición NO lleva temperature (daría 400)');
comprobar(!('top_p' in p), 'la petición NO lleva top_p (daría 400)');
comprobar(!('max_tokens' in p), 'la petición NO lleva max_tokens (daría 400; va max_output_tokens)');
comprobar(p.tool_choice === 'required', "tool_choice es 'required' (el agente SIEMPRE usa una herramienta)");
comprobar(p.store === false, 'store: false — OpenAI no retiene la conversación');

console.log(`\n${fallos === 0 ? '✅ Todo correcto.' : `❌ ${fallos} fallo(s).`}`);
process.exit(fallos === 0 ? 0 : 1);
