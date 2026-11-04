/**
 * GENERAR UN ENTREGABLE CON CLAUDE CODE LOCAL. Una sola respuesta, sin herramientas ni sesión guardada:
 * es lo que hacía la API, pero con la suscripción. Si detecta que se cobraría por API, se detiene.
 */
const REGLA = 'Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después y sin bloques de código.';

/** Lo que devuelve el modelo puede venir envuelto en un bloque de código o con una frase delante. */
export function extraerJson(texto) {
  const t = String(texto || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* se prueba con lo que hay entre llaves */ }
  const i = t.indexOf('{');
  const f = t.lastIndexOf('}');
  if (i < 0 || f <= i) throw new Error('Claude no devolvió JSON.');
  try { return JSON.parse(t.slice(i, f + 1)); } catch { throw new Error('Claude devolvió un JSON que no se puede leer.'); }
}

async function unaRespuesta({ query, system, user, opciones }) {
  const q = query({
    prompt: user,
    options: { ...opciones, systemPrompt: `${system}\n\n${REGLA}`, tools: [], settingSources: [], persistSession: false, maxTurns: 1 },
  });
  let resultado = null;
  try {
    for await (const m of q) {
      if (m.type === 'system' && m.subtype === 'init' && m.apiKeySource && m.apiKeySource !== 'none') {
        throw new Error(`Se detuvo: esta llamada se cobraría por API (${m.apiKeySource}), no por la suscripción.`);
      }
      if (m.type === 'result') resultado = m;
    }
  } finally {
    q.close();
  }
  if (!resultado) throw new Error('Claude terminó sin responder.');
  if (resultado.subtype !== 'success' || resultado.is_error) throw new Error((resultado.errors || []).join(' ') || resultado.result || 'Claude no pudo responder.');
  return resultado.result;
}

/** Un JSON mal cerrado se repite una vez. Un error del motor no, porque repetirlo no lo arregla. */
export async function generarJson({ query, system, user, opciones }) {
  const primera = await unaRespuesta({ query, system, user, opciones });
  try { return extraerJson(primera); } catch { /* otra vuelta */ }
  return extraerJson(await unaRespuesta({ query, system, user, opciones }));
}
