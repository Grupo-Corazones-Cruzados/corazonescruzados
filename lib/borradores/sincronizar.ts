'use client';

import {
  listar, guardar, quitar, asegurarDueno, escribirMeta, leerMeta,
  type Borrador, type DatosTicket, type DatosProyecto, type Catalogos, type Dueno,
} from './almacen';

/**
 * EL SINCRONIZADOR DE BORRADORES (Fernando, 2026-10-07).
 *
 * Con conexión, en este orden:
 *  1. Lo creado SIN CONEXIÓN se sube como borrador (`offline_id` = su `localId`: si la subida
 *     se repite, el servidor devuelve el mismo, no crea otro). Pasa solo a «Borrador».
 *  2. Lo editado sin conexión se sube con la versión que se conocía (`si_no_cambio_desde`). Si
 *     el servidor la cambió entretanto → `conflicto`, y decide la persona (nunca se pisa).
 *  3. Se baja la lista de mis borradores (`/api/borradores`): lo nuevo se añade, lo que ya no
 *     es borrador (enviado o borrado en otro sitio) y no tiene cambios locales se quita.
 *  4. Se guardan las listas para elegir sin conexión (clientes y servicios).
 *
 * Una sola vuelta a la vez (`enCurso`). Sin sesión no hace nada: lo del dispositivo se queda
 * donde está hasta que se entre.
 */

let enCurso: Promise<ResultadoSync> | null = null;
export type ResultadoSync = { ok: boolean; motivo?: 'sin-red' | 'sin-sesion' | 'error'; subidos: number; conflictos: number };

const fechaCorta = (v: any) => (v ? String(v).slice(0, 10) : '');
const texto = (v: any) => (v == null ? '' : String(v));

export function datosDeTicketServidor(t: any, dias?: string[]): DatosTicket {
  return {
    title: texto(t.title), description: texto(t.description),
    client_id: t.client_id != null ? String(t.client_id) : '', client_email: texto(t.draft_client_email),
    service_id: t.service_id != null ? String(t.service_id) : '', deadline: fechaCorta(t.deadline),
    estimated_hours: texto(t.estimated_hours), estimated_cost: texto(t.estimated_cost),
    required_talents: Array.isArray(t.required_talents) ? t.required_talents : [],
    dias: dias ?? (Array.isArray(t.dias) ? t.dias : []),
  };
}
export function datosDeProyectoServidor(p: any): DatosProyecto {
  return {
    title: texto(p.title), description: texto(p.description),
    client_id: p.client_id != null ? String(p.client_id) : '', client_email: p.client_id ? '' : texto(p.client_email),
    deadline: fechaCorta(p.deadline), budget_min: texto(p.budget_min), budget_max: texto(p.budget_max),
  };
}

const nulo = (v: string) => (v.trim() === '' ? null : v.trim());
const numero = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

function cuerpoTicket(d: DatosTicket) {
  return {
    title: d.title.trim(), description: nulo(d.description),
    service_id: d.service_id ? Number(d.service_id) : null,
    deadline: nulo(d.deadline), estimated_hours: numero(d.estimated_hours), estimated_cost: numero(d.estimated_cost),
    required_talents: d.required_talents,
    ...(d.client_id ? { client_id: Number(d.client_id) } : { client_email: nulo(d.client_email) }),
  };
}
function cuerpoProyecto(d: DatosProyecto) {
  return {
    title: d.title.trim(), description: nulo(d.description), deadline: nulo(d.deadline),
    budget_min: numero(d.budget_min), budget_max: numero(d.budget_max),
    ...(d.client_id ? { client_id: Number(d.client_id) } : { client_email: nulo(d.client_email) }),
  };
}

async function pedir(url: string, metodo = 'GET', cuerpo?: unknown) {
  const r = await fetch(url, {
    method: metodo, cache: 'no-store',
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  return { s: r.status, j };
}

/** La cuenta de quien usa el dispositivo; se guarda para poder trabajar sin conexión. */
export async function duenoActual(): Promise<Dueno | null> {
  try {
    const { s, j } = await pedir('/api/auth/me');
    if (s !== 200 || !j?.user) return null;
    const u = j.user;
    const d: Dueno = {
      userId: String(u.id), memberId: u.member_id != null ? Number(u.member_id) : null,
      nombre: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '',
    };
    await asegurarDueno(d);
    return d;
  } catch { return null; }
}

export async function duenoGuardado(): Promise<Dueno | undefined> {
  try { return await leerMeta<Dueno>('dueno'); } catch { return undefined; }
}
export async function catalogosGuardados(): Promise<Catalogos | undefined> {
  try { return await leerMeta<Catalogos>('catalogos'); } catch { return undefined; }
}

export function sincronizar(): Promise<ResultadoSync> {
  if (enCurso) return enCurso;
  enCurso = vuelta().finally(() => { enCurso = null; });
  return enCurso;
}

async function vuelta(): Promise<ResultadoSync> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, motivo: 'sin-red', subidos: 0, conflictos: 0 };
  let dueno: Dueno | null;
  try { dueno = await duenoActual(); } catch { return { ok: false, motivo: 'sin-red', subidos: 0, conflictos: 0 }; }
  if (!dueno) return { ok: false, motivo: 'sin-sesion', subidos: 0, conflictos: 0 };

  let subidos = 0;
  try {
    // 1 y 2: subir.
    for (const b of await listar()) {
      if (b.conflicto) continue;
      if (b.serverId == null) {
        const ruta = b.tipo === 'ticket' ? '/api/tickets' : '/api/projects';
        const cuerpo = b.tipo === 'ticket'
          ? { ...cuerpoTicket(b.datos as DatosTicket), borrador: true, mode: 'create', offline_id: b.localId,
              member_id: dueno.memberId, time_slots: (b.datos as DatosTicket).dias.map((date) => ({ date })) }
          : { ...cuerpoProyecto(b.datos as DatosProyecto), mode: 'create', offline_id: b.localId };
        const { s, j } = await pedir(ruta, 'POST', cuerpo);
        if ((s === 200 || s === 201) && j.data?.id) {
          await guardar({ ...b, serverId: Number(j.data.id), version: j.data.updated_at, pendiente: false, diasCambiados: false, error: null });
          subidos++;
        } else {
          await guardar({ ...b, error: j.error || `No se pudo subir (${s})` });
        }
        continue;
      }
      if (!b.pendiente) continue;
      const ruta = b.tipo === 'ticket' ? `/api/tickets/${b.serverId}` : `/api/projects/${b.serverId}`;
      const cuerpo = b.tipo === 'ticket' ? cuerpoTicket(b.datos as DatosTicket) : cuerpoProyecto(b.datos as DatosProyecto);
      const { s, j } = await pedir(ruta, 'PATCH', { ...cuerpo, si_no_cambio_desde: b.version });
      if (s === 409 && j.conflicto) { await guardar({ ...b, conflicto: { servidor: j.data } }); continue; }
      if (s === 404) { await guardar({ ...b, error: 'Ya no existe en la plataforma (se envió o se borró en otro sitio).' }); continue; }
      if (s !== 200) { await guardar({ ...b, error: j.error || `No se pudo guardar (${s})` }); continue; }
      if (b.tipo === 'ticket' && b.diasCambiados) {
        await pedir(`/api/tickets/${b.serverId}/time-slots`, 'PUT', {
          time_slots: (b.datos as DatosTicket).dias.map((date) => ({ date })),
        });
      }
      await guardar({ ...b, version: j.data?.updated_at ?? b.version, pendiente: false, diasCambiados: false, error: null });
      subidos++;
    }

    // 3: bajar mis borradores.
    const { s, j } = await pedir('/api/borradores');
    if (s === 200) {
      const locales = await listar();
      const porServidor = new Map(locales.filter((b) => b.serverId != null).map((b) => [`${b.tipo}-${b.serverId}`, b]));
      const vistos = new Set<string>();
      const ahora = new Date().toISOString();
      for (const t of j.tickets || []) {
        const clave = `ticket-${t.id}`; vistos.add(clave);
        const local = porServidor.get(clave);
        if (local && (local.pendiente || local.conflicto)) continue;
        await guardar({
          localId: local?.localId ?? t.offline_id ?? clave, tipo: 'ticket', serverId: Number(t.id), version: t.updated_at,
          pendiente: false, conflicto: null, error: null, datos: datosDeTicketServidor(t),
          creadoLocal: local?.creadoLocal ?? ahora, actualizadoLocal: local?.actualizadoLocal ?? ahora,
        });
      }
      for (const p of j.proyectos || []) {
        const clave = `proyecto-${p.id}`; vistos.add(clave);
        const local = porServidor.get(clave);
        if (local && (local.pendiente || local.conflicto)) continue;
        await guardar({
          localId: local?.localId ?? p.offline_id ?? clave, tipo: 'proyecto', serverId: Number(p.id), version: p.updated_at,
          pendiente: false, conflicto: null, error: null, datos: datosDeProyectoServidor(p),
          creadoLocal: local?.creadoLocal ?? ahora, actualizadoLocal: local?.actualizadoLocal ?? ahora,
        });
      }
      for (const b of locales) {
        if (b.serverId != null && !vistos.has(`${b.tipo}-${b.serverId}`) && !b.pendiente && !b.conflicto) await quitar(b.localId);
      }
    }

    // 4: listas para elegir sin conexión.
    const [cl, sv] = await Promise.all([
      pedir('/api/clients?mine=1'),
      pedir(dueno.memberId ? `/api/members/${dueno.memberId}/services?active=1` : '/api/services'),
    ]);
    if (cl.s === 200 && sv.s === 200) {
      // ⚠️ Esas rutas responden 200 con lista VACÍA cuando fallan: una lista vacía no pisa una
      // copia que tenía datos (se quedaría sin poder elegir cliente sin conexión).
      const antes = await catalogosGuardados();
      const nuevos = (l: any, viejo: any[] | undefined) => (Array.isArray(l) && l.length ? l : (viejo ?? []));
      const cat: Catalogos = {
        clientes: nuevos(cl.j.data, antes?.clientes),
        servicios: nuevos(sv.j.data, antes?.servicios),
        leidoEn: new Date().toISOString(),
      };
      await escribirMeta('catalogos', cat);
    }

    const conflictos = (await listar()).filter((b) => b.conflicto).length;
    return { ok: true, subidos, conflictos };
  } catch {
    // Se cayó la red a mitad: lo que no subió sigue en el dispositivo y se reintenta.
    return { ok: false, motivo: 'sin-red', subidos, conflictos: 0 };
  }
}

/** «Quedarme con la mía»: se sube lo del dispositivo sobre la versión actual del servidor. */
export async function resolverConMia(b: Borrador) {
  await guardar({ ...b, version: b.conflicto?.servidor?.updated_at ?? b.version, conflicto: null, pendiente: true });
  return sincronizar();
}
/** «Usar la de la plataforma»: se descarta lo del dispositivo. */
export async function resolverConServidor(b: Borrador) {
  const s = b.conflicto?.servidor;
  const datos = b.tipo === 'ticket'
    ? datosDeTicketServidor(s, (b.datos as DatosTicket).dias)
    : datosDeProyectoServidor(s);
  await guardar({ ...b, datos, version: s?.updated_at ?? b.version, conflicto: null, pendiente: false, diasCambiados: false });
  return sincronizar();
}
