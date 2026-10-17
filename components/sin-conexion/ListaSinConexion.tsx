'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CloudOff, Plus, Send, AlertTriangle, X, ExternalLink } from 'lucide-react';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { CampoClienteOCorreo } from '@/components/clients/CamposResponsable';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { TALENTOS } from '@/lib/centralized/talentos';
import {
  listar, guardar, quitar, ticketVacio, proyectoVacio,
  type Borrador, type DatosTicket, type DatosProyecto, type Catalogos, type Dueno,
} from '@/lib/borradores/almacen';
import {
  sincronizar, duenoGuardado, catalogosGuardados, resolverConMia, resolverConServidor, EVENTO_SINCRONIZADO,
} from '@/lib/borradores/sincronizar';

const mf = { fontFamily: 'var(--font-body)' } as const;

export type TipoSinConexion = 'ticket' | 'proyecto';

const NOMBRE: Record<TipoSinConexion, { uno: string; varios: string; nuevo: string; descartado: string }> = {
  ticket: { uno: 'ticket', varios: 'tickets', nuevo: 'Nuevo ticket', descartado: 'Ticket descartado' },
  proyecto: { uno: 'proyecto', varios: 'proyectos', nuevo: 'Nuevo proyecto', descartado: 'Proyecto descartado' },
};

/**
 * LO CREADO «SIN CONEXIÓN» — un estado DENTRO de Tickets y de Proyectos (Fernando, 2026-10-16:
 * «quita el módulo de Borradores; lo que me interesa es que dentro del mismo módulo de tickets
 * exista un estado que permita gestionar los tickets que se han creado sin conexión»; y el
 * 10-17, lo mismo en Proyectos).
 *
 * Se pinta en dos sitios y es el mismo control (no dos parecidos):
 *  · la pestaña «Sin conexión» de Tickets y de Proyectos, con red: lo que el dispositivo aún no
 *    ha subido o necesita una decisión (`soloPorAtender`);
 *  · la pantalla que abre la app SIN RED (`/sin-conexion`): todo lo que está en borrador en el
 *    dispositivo, que se puede crear y editar sin conexión.
 *
 * Lo creado sin red se ve «Sin conexión» y, al volver la red, se sube solo y pasa a «Borrador»
 * (desde ahí vive en la pestaña «Borradores»/«Borrador»). Pasar al siguiente estado exige red.
 */
export function porAtender(b: Borrador, tipo: TipoSinConexion) {
  return b.tipo === tipo && (b.serverId == null || b.pendiente || !!b.conflicto || !!b.error);
}

/**
 * Para la lista de Tickets o de Proyectos: cuántos esperan en el dispositivo (el número de la
 * pestaña) y si hay red. Tras cada sincronización se recuenta y se llama a `alSincronizar`
 * (lo subido aparece entonces en la lista del servidor, en «Borrador»).
 */
export function useSinConexion(tipo: TipoSinConexion, alSincronizar?: () => void) {
  const [enDispositivo, setEnDispositivo] = useState(0);
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const contar = () => listar().then((l) => setEnDispositivo(l.filter((b) => porAtender(b, tipo)).length)).catch(() => {});
    const tras = () => { contar(); alSincronizar?.(); };
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    setEnLinea(navigator.onLine);
    contar();
    window.addEventListener(EVENTO_SINCRONIZADO, tras);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener(EVENTO_SINCRONIZADO, tras);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [tipo, alSincronizar]);
  return { enDispositivo, enLinea };
}

export default function ListaSinConexion({ tipo, enLinea, soloPorAtender, permitirNuevo, onCambio }: {
  tipo: TipoSinConexion;
  enLinea: boolean;
  soloPorAtender?: boolean;
  permitirNuevo?: boolean;
  onCambio?: () => void;
}) {
  const [items, setItems] = useState<Borrador[]>([]);
  const [dueno, setDueno] = useState<Dueno | null>(null);
  const [cat, setCat] = useState<Catalogos | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [cargado, setCargado] = useState(false);
  const n = NOMBRE[tipo];

  const recargar = useCallback(async () => {
    try {
      const [l, d, c] = await Promise.all([listar(), duenoGuardado(), catalogosGuardados()]);
      const mios = l.filter((b) => b.tipo === tipo && (!soloPorAtender || porAtender(b, tipo)));
      mios.sort((a, b) => (b.actualizadoLocal || '').localeCompare(a.actualizadoLocal || ''));
      setItems(mios); setDueno(d ?? null); setCat(c ?? null);
    } catch { /* sin almacén (navegador privado): lista vacía */ }
    setCargado(true);
  }, [tipo, soloPorAtender]);

  useEffect(() => {
    recargar();
    window.addEventListener(EVENTO_SINCRONIZADO, recargar);
    return () => window.removeEventListener(EVENTO_SINCRONIZADO, recargar);
  }, [recargar]);

  const nuevo = useCallback(() => {
    const ahora = new Date().toISOString();
    setEditando({
      localId: crypto.randomUUID(), tipo, serverId: null, version: null, pendiente: true,
      datos: tipo === 'ticket' ? ticketVacio() : proyectoVacio(), creadoLocal: ahora, actualizadoLocal: ahora,
    });
  }, [tipo]);

  const cambio = async () => { await recargar(); onCambio?.(); };

  return (
    <div className="space-y-2">
      {/* Solo en la pantalla sin red: con red, la cuenta se guarda sola en la siguiente vuelta. */}
      {permitirNuevo && cargado && !dueno && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900" style={mf}>
          Abre GCC World una vez con conexión y tu sesión para poder crear {n.varios} sin red.
        </div>
      )}
      {permitirNuevo && dueno && (
        <div className="flex justify-end">
          <button onClick={nuevo} className={BTN_SECONDARY}><Plus className="w-4 h-4" /> {n.nuevo}</button>
        </div>
      )}
      {cargado && items.length === 0 && (
        <div className="rounded-lg border border-digi-border bg-digi-card p-6 text-center">
          <CloudOff className="w-5 h-5 text-digi-muted mx-auto mb-2" />
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Sin {n.varios} sin conexión</p>
          <p className="text-[12px] text-digi-muted" style={mf}>
            {soloPorAtender ? 'Todo lo creado sin red ya se subió.' : `Crea un ${n.uno} y se subirá al volver la conexión.`}
          </p>
        </div>
      )}
      {items.map((b) => (
        <Tarjeta key={b.localId} b={b} enLinea={enLinea} onAbrir={() => setEditando(b)} onCambio={cambio} />
      ))}

      {editando && (
        <Formulario
          b={editando} cat={cat}
          onClose={() => setEditando(null)}
          onGuardado={async () => {
            setEditando(null);
            await cambio();
            if (navigator.onLine) sincronizar();
          }}
        />
      )}
    </div>
  );
}

function Tarjeta({ b, enLinea, onAbrir, onCambio }: { b: Borrador; enLinea: boolean; onAbrir: () => void; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const sinConexion = b.serverId == null;
  const n = NOMBRE[b.tipo];

  const enviar = async () => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/tickets/${b.serverId}/enviar`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar');
      await quitar(b.localId);
      toast.success('Ticket enviado: ya está «Pendiente» y el cliente recibió el aviso');
      onCambio();
    } catch (e: any) { toast.error(e.message); } finally { setOcupado(false); }
  };
  const descartar = async () => { await quitar(b.localId); toast.success(n.descartado); onCambio(); };

  return (
    <div className="rounded-lg border border-digi-border bg-digi-card p-3">
      <button onClick={onAbrir} className="w-full text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${sinConexion ? 'bg-black/5 text-digi-muted' : 'bg-accent-light text-accent'}`} style={mf}>
            {sinConexion && <CloudOff className="w-3 h-3" />}{sinConexion ? 'Sin conexión' : 'Borrador'}
          </span>
          {b.pendiente && !sinConexion && <span className="text-[11px] text-amber-700" style={mf}>Cambios sin subir</span>}
          {b.serverId != null && <span className="text-[11px] text-digi-muted tabular-nums" style={mf}>#{b.serverId}</span>}
        </div>
        <p className="mt-1 text-[14px] font-medium text-digi-text truncate" style={mf}>{b.datos.title || 'Sin título'}</p>
        {b.datos.description && <p className="text-[12px] text-digi-muted line-clamp-2" style={mf}>{b.datos.description}</p>}
      </button>

      {b.error && <p className="mt-2 text-[12px] text-red-600" style={mf}>{b.error}</p>}
      {b.conflicto && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 space-y-2">
          <p className="flex items-center gap-1.5 text-[12.5px] text-amber-900" style={mf}>
            <AlertTriangle className="w-4 h-4 shrink-0" /> Este {n.uno} cambió en la plataforma mientras lo editabas sin conexión.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={async () => { await resolverConMia(b); onCambio(); }} className={BTN_PRIMARY}>Quedarme con la mía</button>
            <button onClick={async () => { await resolverConServidor(b); onCambio(); }} className={BTN_SECONDARY}>Usar la de la plataforma</button>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {sinConexion && <button onClick={descartar} className={BTN_SECONDARY}><X className="w-4 h-4" /> Descartar</button>}
        {!sinConexion && b.tipo === 'ticket' && (
          <span title={!enLinea ? 'Enviar exige conexión' : b.pendiente ? 'Espera a que se suban los cambios' : undefined} className="inline-flex">
            <button onClick={enviar} disabled={!enLinea || ocupado || b.pendiente || !!b.conflicto} className={BTN_PRIMARY}>
              <Send className="w-4 h-4" /> Enviar
            </button>
          </span>
        )}
        {/* El proyecto sigue su flujo de siempre (requerimientos, propuestas…) en su ficha. */}
        {!sinConexion && b.tipo === 'proyecto' && enLinea && (
          <a href={`/dashboard/projects/${b.serverId}`} className={BTN_SECONDARY}><ExternalLink className="w-4 h-4" /> Abrir proyecto</a>
        )}
      </div>
    </div>
  );
}

function Formulario({ b, cat, onClose, onGuardado }: {
  b: Borrador; cat: Catalogos | null; onClose: () => void; onGuardado: () => void;
}) {
  const [d, setD] = useState<any>(b.datos);
  const [modoCliente, setModoCliente] = useState<'lista' | 'correo'>(b.datos.client_email && !b.datos.client_id ? 'correo' : 'lista');
  const [diaNuevo, setDiaNuevo] = useState('');
  const set = (k: string, v: any) => setD((x: any) => ({ ...x, [k]: v }));
  const esTicket = b.tipo === 'ticket';
  const n = NOMBRE[b.tipo];
  const talentos = useMemo(() => TALENTOS.map((t) => ({ value: t, label: t })), []);

  const guardarLocal = async () => {
    if (!String(d.title || '').trim()) { toast.error('Ponle un título'); return; }
    const diasCambiados = esTicket && JSON.stringify((b.datos as DatosTicket).dias) !== JSON.stringify(d.dias);
    await guardar({
      ...b, datos: d as DatosTicket | DatosProyecto, pendiente: true,
      diasCambiados: b.diasCambiados || diasCambiados, error: null, actualizadoLocal: new Date().toISOString(),
    });
    toast.success(navigator.onLine ? 'Guardado' : 'Guardado en el dispositivo: se subirá al volver la conexión');
    onGuardado();
  };

  return (
    <EditPanel open title={b.serverId == null ? `${n.nuevo} (sin conexión)` : `Editar ${n.uno} #${b.serverId} (borrador)`}
      onClose={onClose} onSave={guardarLocal} saveLabel="Guardar">
      <EditField label="Título">
        <input value={d.title} onChange={(e) => set('title', e.target.value)} className={EDIT_INPUT} style={mf} />
      </EditField>
      <EditField label="Descripción">
        <textarea value={d.description} onChange={(e) => set('description', e.target.value)} rows={4} className={`${EDIT_INPUT} resize-y`} style={mf} />
      </EditField>
      <CampoClienteOCorreo
        modo={modoCliente}
        onModo={(m) => { setModoCliente(m); setD((x: any) => ({ ...x, client_id: '', client_email: '' })); }}
        clienteId={d.client_id} onClienteId={(v) => set('client_id', v)}
        correo={d.client_email} onCorreo={(v) => set('client_email', v)}
        clientes={cat?.clientes ?? []}
      />
      {esTicket && (
        <>
          <EditField label="Servicio">
            <select value={d.service_id} onChange={(e) => set('service_id', e.target.value)} className={EDIT_INPUT} style={mf}>
              <option value="">Sin elegir</option>
              {(cat?.servicios ?? []).map((s) => <option key={String(s.id)} value={String(s.id)}>{s.name}</option>)}
            </select>
          </EditField>
          <EditField label="Talentos">
            <MultiSelectSearch options={talentos} selected={d.required_talents} onChange={(v) => set('required_talents', v)} placeholder="Buscar talento…" />
          </EditField>
        </>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <EditField label="Fecha límite">
          <input type="date" value={d.deadline} onChange={(e) => set('deadline', e.target.value)} className={EDIT_INPUT} style={mf} />
        </EditField>
        {esTicket ? (
          <>
            <EditField label="Horas estimadas">
              <input inputMode="decimal" value={d.estimated_hours} onChange={(e) => set('estimated_hours', e.target.value)} className={EDIT_INPUT} style={mf} />
            </EditField>
            <EditField label="Costo estimado">
              <input inputMode="decimal" value={d.estimated_cost} onChange={(e) => set('estimated_cost', e.target.value)} className={EDIT_INPUT} style={mf} />
            </EditField>
          </>
        ) : (
          <>
            <EditField label="Presupuesto mínimo">
              <input inputMode="decimal" value={d.budget_min} onChange={(e) => set('budget_min', e.target.value)} className={EDIT_INPUT} style={mf} />
            </EditField>
            <EditField label="Presupuesto máximo">
              <input inputMode="decimal" value={d.budget_max} onChange={(e) => set('budget_max', e.target.value)} className={EDIT_INPUT} style={mf} />
            </EditField>
          </>
        )}
      </div>
      {esTicket && (
        <EditField label="Días de trabajo">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="date" value={diaNuevo} onChange={(e) => setDiaNuevo(e.target.value)} className={`${EDIT_INPUT} flex-1`} style={mf} />
              <button type="button" disabled={!diaNuevo || d.dias.includes(diaNuevo)} className={BTN_SECONDARY}
                onClick={() => { set('dias', [...d.dias, diaNuevo].sort()); setDiaNuevo(''); }}>
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </div>
            {d.dias.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {d.dias.map((dia: string) => (
                  <span key={dia} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md border border-digi-border text-[12px] text-digi-text" style={mf}>
                    {new Date(dia + 'T12:00:00').toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' })}
                    <BotonQuitar onClick={() => set('dias', d.dias.filter((x: string) => x !== dia))} etiqueta={`Quitar ${dia}`} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </EditField>
      )}
    </EditPanel>
  );
}
