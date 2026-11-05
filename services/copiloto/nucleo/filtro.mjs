/**
 * EL FILTRO LOCAL. Llamar a Claude cada 5 s serían 720 consultas por hora de reunión contra el límite
 * de la suscripción, así que primero se decide aquí, gratis, si algo tiene forma de pregunta. Claude
 * tiene la última palabra (responde NADA), pero solo le llega lo que pasa este filtro.
 */
import { normalizar } from './palabra-clave.mjs';

// Whisper rellena los silencios con frases de los videos con los que se entrenó.
const ALUCINACIONES = [
  /gracias por (ver|su atenci)/i, /suscr[ií]b/i, /subt[ií]tul/i, /amara\.org/i, /dale (a )?like/i,
  /nos vemos en el pr[oó]ximo/i, /^\W*(m[uú]sica|aplausos|risas|silencio)\W*$/i, /^\W*$/, /^[\[(].*[\])]$/,
  /^\W*gracias\W*$/i,
];

// Con ruido, Whisper repite el vocabulario que se le da para orientarlo. La clave queda fuera: sola es una orden.
const VOCABULARIO = new Set('grupo corazones cruzados gcc world reunion de trabajo con un cliente'.split(' '));

export function esAlucinacion(texto) {
  const t = String(texto || '').trim();
  if (ALUCINACIONES.some((r) => r.test(t))) return true;
  const p = normalizar(t).match(/[\p{L}\p{N}]+/gu) || [];
  return p.length > 0 && p.every((x) => VOCABULARIO.has(x));
}

const INTERROGATIVAS = /(^|[\s,¿(])(qué|cómo|cuánto|cuánta|cuántos|cuántas|cuándo|dónde|adónde|quién|quiénes|cuál|cuáles|por qué|para qué)\b/i;
const FRASES = /\b(podr[ií]an?|puede[ns]?|pueden|se puede|ser[ií]a posible|es posible|hay (alguna?|forma|manera)|tienen|ofrecen|manejan|trabajan con|han hecho|hicieron|cobran|incluye|me (gustar[ií]a|interesa) saber|quisi[eé]ra(mos)? saber|quer[ií]a(mos)? saber|queremos saber|necesit\w+ saber|me (puede|podr[ií]a)s? (decir|explicar|contar)|nos (puede|podr[ií]a)n? (decir|explicar|contar))\b/i;

export function parecePregunta(texto) {
  const t = String(texto || '');
  return t.includes('?') || t.includes('¿') || INTERROGATIVAS.test(t) || FRASES.test(t);
}

const palabrasDe = (t) => normalizar(t).match(/[\p{L}\p{N}]+/gu) || [];

/**
 * Con altavoces, el micrófono también oye al cliente. Si lo que entró por el micrófono coincide con lo
 * que acaba de sonar en el equipo, es eco y no lo dijo Fernando.
 */
export function esEco(textoMic, recienteSistema) {
  const mic = palabrasDe(textoMic);
  if (mic.length < 3) return false;
  const sistema = new Set(palabrasDe(recienteSistema));
  if (!sistema.size) return false;
  return mic.filter((p) => sistema.has(p)).length / mic.length >= 0.7;
}
