'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, CloudOff, Cloud, RefreshCw, Plus, Ticket, FolderKanban, Send, AlertTriangle, ExternalLink, X,
} from 'lucide-react';
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
  sincronizar, duenoGuardado, catalogosGuardados, resolverConMia, resolverConServidor,
} from '@/lib/borradores/sincronizar';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * BORRADORES — LA PANTALLA QUE FUNCIONA SIN CONEXIÓN (Fernando, 2026-10-07).
 *
 * «Los tickets y proyectos pueden funcionar sin conexión mientras su estado sea borrador;
 * para llevarlos al siguiente estado deben tener conexión.» Y: lo creado sin red queda en
 * «Sin conexión» y, al volver la conexión, pasa SOLO a «Borrador».
 *
 * Todo se guarda primero en el dispositivo (`lib/borradores/almacen.ts`) y el sincronizador lo
 * sube cuando hay red. Lo que exige conexión —enviar un ticket, abrir el proyecto en la
 * plataforma— solo se ofrece con conexión.
 */
export default function BorradoresPage() {
  const [items, setItems] = useState<Borrador[]>([]);
  const [dueno, setDueno] = useState<Dueno | null>(null);
  const [cat, setCat] = useState<Catalogos | null>(null);
  const [enLinea, setEnLinea] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [cargado, setCargado] = useState(false);

  const recargar = useCallback(async () => {
    const [l, d, c] = await Promise.all([listar(), duenoGuardado(), catalogosGuardados()]);
    l.sort((a, b) => (b.actualizadoLocal || '').localeCompare(a.actualizadoLocal || ''));
    setItems(l); setDueno(d ?? null); setCat(c ?? null); setCargado(true);
  }, []);

  const sync = useCallback(async (manual = false) => {
    if (!navigator.onLine) { setEnLinea(false); if (manual) toast.error('Sin conexión: se sincronizará al volver la red'); return; }
    setSincronizando(true);
    const r = await sincronizar();
    setSincronizando(false);
    await recargar();
    // El navegador puede creer que hay red sin que el servidor responda (wifi sin internet,
    // servidor caído): lo que dice si hay conexión es si la sincronización llegó.
    setEnLinea(r.ok || r.motivo === 'sin-sesion');
    if (r.ok) {
      setUltimaSync(new Date().toISOString());
      if (r.subidos) toast.success(r.subidos === 1 ? 'Se subió 1 borrador' : `Se subieron ${r.subidos} borradores`);
      if (r.conflictos) toast.warning('Hay borradores que cambiaron en la plataforma: elige con cuál quedarte');
    } else if (manual) {
      toast.error(r.motivo === 'sin-sesion' ? 'Entra en GCC World para sincronizar' : 'No se pudo sincronizar');
    }
  }, [recargar]);

  useEffect(() => {
    setEnLinea(navigator.onLine);
    recargar().then(() => sync());
    const on = () => { setEnLinea(true); sync(); };
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [recargar, sync]);

  const nuevo = (tipo: 'ticket' | 'proyecto') => {
    const ahora = new Date().toISOString();
    setEditando({
      localId: crypto.randomUUID(), tipo, serverId: null, version: null, pendiente: true,
      datos: tipo === 'ticket' ? ticketVacio() : proyectoVacio(), creadoLocal: ahora, actualizadoLocal: ahora,
    });
  };

  const tickets = items.filter((b) => b.tipo === 'ticket');
  const proyectos = items.filter((b) => b.tipo === 'proyecto');

  return (
    <div className="min-h-screen flex flex-col pt-[var(--seguro-arriba)] pb-[var(--seguro-abajo)]">
      <header className="rail shrink-0 h-14 flex items-center gap-2 px-2 bg-digi-card border-b border-digi-border">
        {enLinea ? (
          <a href="/dashboard" aria-label="Volver a la plataforma" className="w-11 h-11 flex items-center justify-center rounded-lg text-digi-text">
            <ChevronLeft className="w-6 h-6" />
          </a>
        ) : <span className="w-2" />}
        <p className="flex-1 min-w-0 text-[15px] font-bold text-digi-text truncate" style={df}>Borradores</p>
        <span className={`inline-flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-full ${enLinea ? 'text-emerald-700 bg-emerald-500/10' : 'text-digi-muted bg-black/5'}`} style={mf}>
          {enLinea ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
          {enLinea ? 'Con conexión' : 'Sin conexión'}
        </span>
        <button onClick={() => sync(true)} disabled={sincronizando} aria-label="Sincronizar"
          className="w-11 h-11 flex items-center justify-center rounded-lg text-digi-text disabled:opacity-40">
          <RefreshCw className={`w-5 h-5 ${sincronizando ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 space-y-5">
        {cargado && !dueno && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-900" style={mf}>
            Abre GCC World una vez con conexión y tu sesión para poder trabajar aquí sin red.
          </div>
        )}
        {cat && (
          <p className="text-[11.5px] text-digi-muted" style={mf}>
            Clientes y servicios guardados el {new Date(cat.leidoEn).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' })}
            {ultimaSync ? ` · sincronizado a las ${new Date(ultimaSync).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </p>
        )}

        <Seccion titulo="Tickets" Icon={Ticket} onNuevo={dueno ? () => nuevo('ticket') : undefined} vacio="Sin tickets en borrador.">
          {tickets.map((b) => (
            <Tarjeta key={b.localId} b={b} enLinea={enLinea} onAbrir={() => setEditando(b)} onCambio={recargar} />
          ))}
        </Seccion>
        <Seccion titulo="Proyectos" Icon={FolderKanban} onNuevo={dueno ? () => nuevo('proyecto') : undefined} vacio="Sin proyectos en borrador.">
          {proyectos.map((b) => (
            <Tarjeta key={b.localId} b={b} enLinea={enLinea} onAbrir={() => setEditando(b)} onCambio={recargar} />
          ))}
        </Seccion>
      </main>

      {editando && (
        <Formulario
          b={editando} cat={cat}
          onClose={() => setEditando(null)}
          onGuardado={async () => { setEditando(null); await recargar(); if (navigator.onLine) sync(); }}
        />
      )}
    </div>
  );
}

function Seccion({ titulo, Icon, onNuevo, vacio, children }: {
  titulo: string; Icon: any; onNuevo?: () => void; vacio: string; children: React.ReactNode[];
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-accent" />
        <h2 className="flex-1 text-[14px] font-semibold text-digi-text" style={df}>{titulo}</h2>
        {onNuevo && (
          <button onClick={onNuevo} className={BTN_SECONDARY}><Plus className="w-4 h-4" /> Nuevo</button>
        )}
      </div>
      {children.length ? <div className="space-y-2">{children}</div>
        : <p className="text-[12.5px] text-digi-muted px-1" style={mf}>{vacio}</p>}
    </section>
  );
}

function Tarjeta({ b, enLinea, onAbrir, onCambio }: { b: Borrador; enLinea: boolean; onAbrir: () => void; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const sinConexion = b.serverId == null;

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
  const descartar = async () => { await quitar(b.localId); toast.success('Borrador descartado'); onCambio(); };

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
            <AlertTriangle className="w-4 h-4 shrink-0" /> Este borrador cambió en la plataforma mientras lo editabas aquí.
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
        {!sinConexion && b.tipo === 'proyecto' && enLinea && (
          <a href={`/dashboard/projects/${b.serverId}`} className={BTN_SECONDARY}><ExternalLink className="w-4 h-4" /> Abrir en la plataforma</a>
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
    <EditPanel open title={`${b.serverId == null ? 'Nuevo' : 'Editar'} ${esTicket ? 'ticket' : 'proyecto'} (borrador)`}
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
