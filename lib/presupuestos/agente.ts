import { pool } from '@/lib/db';
import { claveIA, mensajeDeErrorIA, MODELO_IA } from '@/lib/ia/openai';
import { buscarMiembros, cargarCatalogo, instrucciones, leerTrabajo, type Catalogo } from './contexto';
import { consultarCuenta, instruccionesDeCuenta, modulosDe, type Cuenta } from './cuenta';
import { MAX_TOKENS_SESION, type Mensaje, type Presupuesto } from './db';

/**
 * UN TURNO DEL AGENTE: una llamada a `/v1/responses` en bucle mientras pida herramientas (ver
 * `gcc-agente-una-llamada-responses`). Con `store: false` la sesión es nuestra: se guardan los ítems,
 * con el razonamiento cifrado, y se reenvían en el turno siguiente.
 */

export type EventoAgente =
  | { tipo: 'texto'; delta: string }
  | { tipo: 'estado'; texto: string }
  | { tipo: 'presupuesto'; presupuesto: Presupuesto }
  | { tipo: 'tokens'; tokens: number }
  | { tipo: 'error'; texto: string };

const MAX_VUELTAS = 8;

const herramientaDeCuenta = (c: Cuenta) => ({
  type: 'function', name: 'consultar_mi_cuenta', strict: true,
  description: 'Lee los datos de la propia cuenta de quien conversa en un módulo. busqueda filtra por texto; vacía trae lo más reciente.',
  parameters: {
    type: 'object', additionalProperties: false, required: ['modulo', 'busqueda'],
    properties: { modulo: { type: 'string', enum: modulosDe(c.rol) }, busqueda: { type: 'string' } },
  },
});

const herramientas = (c: Catalogo) => [
  {
    type: 'function', name: 'leer_trabajo', strict: true,
    description: 'Lee el detalle de un trabajo terminado del catálogo: requerimientos y subtareas de un proyecto o acciones de un ticket, y sus responsables.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['tipo', 'id'],
      properties: { tipo: { type: 'string', enum: ['proyecto', 'ticket'] }, id: { type: 'integer' } },
    },
  },
  {
    type: 'function', name: 'buscar_miembros', strict: true,
    description: 'Busca miembros por nombre, talento o portafolio. Devuelve su perfil público: contacto, ubicación, talentos y portafolio.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['consulta'],
      properties: { consulta: { type: 'string', description: 'Vacía para listarlos a todos.' } },
    },
  },
  {
    type: 'function', name: 'actualizar_presupuesto', strict: true,
    description: 'Registra la versión actual del presupuesto. Llámala cada vez que cambie un dato. En un proyecto van los requerimientos, con dias null y acciones vacías. En un ticket van dias y acciones, con requerimientos vacíos.',
    parameters: {
      type: 'object', additionalProperties: false,
      required: ['tipo', 'titulo', 'descripcion', 'requerimientos', 'dias', 'acciones', 'precio_min', 'precio_max', 'talentos'],
      properties: {
        tipo: { type: 'string', enum: ['proyecto', 'ticket'] },
        titulo: { type: 'string', description: 'Proyecto: qué sistema es. Ticket: verbo en infinitivo y objeto. Máximo 70 caracteres.' },
        descripcion: { type: 'string' },
        requerimientos: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false, required: ['titulo', 'descripcion'],
            properties: { titulo: { type: 'string' }, descripcion: { type: 'string' } },
          },
        },
        dias: { type: ['integer', 'null'] },
        acciones: { type: 'array', items: { type: 'string' } },
        precio_min: { type: 'number' },
        precio_max: { type: 'number' },
        talentos: { type: 'array', items: { type: 'string', enum: c.talentos } },
      },
    },
  },
];

/** Comprueba el presupuesto. Devuelve el texto del error para que el agente lo corrija. */
function validar(a: Presupuesto, c: Catalogo): string | null {
  if (!a.titulo?.trim() || !a.descripcion?.trim()) return 'Faltan el título o la descripción.';
  if (!(a.precio_min > 0) || a.precio_max <= a.precio_min) return 'El precio debe ser un rango: mínimo mayor que 0 y máximo mayor que el mínimo.';
  const precios = (a.tipo === 'proyecto' ? c.proyectos : c.tickets).map((x) => x.precio);
  const piso = precios.length ? Math.min(...precios) : 0;
  if (a.precio_min < piso * 0.5) return `El mínimo no puede quedar por debajo de ${(piso * 0.5).toFixed(2)} USD: el catálogo no respalda algo más barato. Reduce el alcance o sube el rango.`;
  if (!a.talentos.length) return 'Elige al menos un talento.';
  if (a.tipo === 'proyecto' && !a.requerimientos.length) return 'Un proyecto necesita requerimientos.';
  if (a.tipo === 'ticket' && (!a.dias || a.dias < 1 || !a.acciones.length)) return 'Un ticket necesita días de trabajo y acciones.';
  return null;
}

/** Una vuelta en streaming: reenvía el texto y devuelve la respuesta completa. */
async function vuelta(cuerpo: Record<string, unknown>, emitir: (e: EventoAgente) => void) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${claveIA()}` },
    body: JSON.stringify({ ...cuerpo, stream: true }),
  });
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => '');
    console.error('[presupuestos]', res.status, err.slice(0, 300));
    throw new Error(mensajeDeErrorIA(res.status, err));
  }
  const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = '';
  let final: any = null;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    resto += value;
    const lineas = resto.split('\n');
    resto = lineas.pop() ?? '';
    for (const l of lineas) {
      if (!l.startsWith('data: ')) continue;
      const d = l.slice(6).trim();
      if (!d || d === '[DONE]') continue;
      const ev = JSON.parse(d);
      if (ev.type === 'response.output_text.delta') emitir({ tipo: 'texto', delta: ev.delta });
      else if (ev.type === 'response.completed' || ev.type === 'response.incomplete') final = ev.response;
      else if (ev.type === 'response.failed' || ev.type === 'error') {
        throw new Error(ev.response?.error?.message ?? ev.message ?? 'El modelo no pudo responder.');
      }
    }
  }
  if (!final) throw new Error('La respuesta del modelo se cortó.');
  return final;
}

/** Corre un turno completo y lo guarda. El bloqueo de la sesión lo pone y lo quita quien llama. */
export async function correrTurno(sesion: any, texto: string, emitir: (e: EventoAgente) => void, cuentaDeSesion: Cuenta | null = null) {
  // Solo en una sesión de la cuenta: una anónima abierta en el mismo equipo puede leerla otra persona.
  const cuenta = cuentaDeSesion && sesion.user_id === cuentaDeSesion.userId && modulosDe(cuentaDeSesion.rol).length ? cuentaDeSesion : null;
  const catalogo = await cargarCatalogo(sesion.solucion);
  if (!catalogo) throw new Error('La solución ya no existe.');
  const items: any[] = [...(sesion.items ?? []), { role: 'user', content: texto }];
  const mensajes: Mensaje[] = [...(sesion.mensajes ?? []), { rol: 'usuario', texto }];
  let tokens = Number(sesion.tokens);
  let presupuesto: Presupuesto | null = sesion.presupuesto ?? null;
  let respuesta = '';

  const guardar = () => pool.query(
    `UPDATE gcc_world.presupuesto_sesiones
        SET items = $2::jsonb, mensajes = $3::jsonb, presupuesto = $4::jsonb, tokens = $5, actualizada = NOW()
      WHERE id = $1`,
    [sesion.id, JSON.stringify(items), JSON.stringify([...mensajes, ...(respuesta ? [{ rol: 'agente', texto: respuesta }] : [])]), presupuesto ? JSON.stringify(presupuesto) : null, tokens],
  );

  try {
    const base = {
      model: MODELO_IA,
      instructions: instrucciones(catalogo) + (cuenta ? instruccionesDeCuenta(cuenta) : ''),
      tools: [...herramientas(catalogo), ...(cuenta ? [herramientaDeCuenta(cuenta)] : [])],
      max_output_tokens: 6000,
      reasoning: { effort: 'low' },
      store: false,
      include: ['reasoning.encrypted_content'],
    };
    for (let i = 0; i < MAX_VUELTAS; i++) {
      if (tokens >= MAX_TOKENS_SESION) break;
      const r = await vuelta({ ...base, input: items }, (e) => {
        if (e.tipo === 'texto') respuesta += e.delta;
        emitir(e);
      });
      tokens += Number(r.usage?.total_tokens ?? 0);
      emitir({ tipo: 'tokens', tokens });
      const llamadas = (r.output ?? []).filter((x: any) => x.type === 'function_call');
      items.push(...(r.output ?? []));
      if (!llamadas.length) break;
      for (const ll of llamadas) {
        let salida: unknown;
        try {
          const a = JSON.parse(ll.arguments);
          if (ll.name === 'leer_trabajo') {
            emitir({ tipo: 'estado', texto: 'Revisando trabajos parecidos…' });
            salida = await leerTrabajo(a.tipo, a.id, catalogo);
          } else if (ll.name === 'consultar_mi_cuenta' && cuenta) {
            emitir({ tipo: 'estado', texto: 'Revisando tu cuenta…' });
            salida = await consultarCuenta(cuenta, String(a.modulo), String(a.busqueda ?? ''));
          } else if (ll.name === 'buscar_miembros') {
            emitir({ tipo: 'estado', texto: 'Buscando miembros…' });
            salida = await buscarMiembros(String(a.consulta ?? ''));
          } else {
            const error = validar(a, catalogo);
            if (error) salida = { error };
            else {
              presupuesto = a as Presupuesto;
              emitir({ tipo: 'presupuesto', presupuesto });
              salida = { ok: true };
            }
          }
        } catch (e) {
          salida = { error: (e as Error).message };
        }
        items.push({ type: 'function_call_output', call_id: ll.call_id, output: JSON.stringify(salida) });
      }
    }
    if (!respuesta.trim()) {
      respuesta = tokens >= MAX_TOKENS_SESION
        ? 'Esta sesión llegó a su límite de uso. Tu presupuesto sigue a la derecha y puedes aceptarlo.'
        : 'No pude completar la respuesta. ¿Puedes intentarlo otra vez?';
      emitir({ tipo: 'texto', delta: respuesta });
    }
  } finally {
    await guardar();
  }
}
