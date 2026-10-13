'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BotonEditar from '@/components/ui/BotonEditar';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { FilaMarcable } from '@/components/ui/ListaMarcable';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import EspacioDrive, { fmtBytes, type EspacioDriveDatos } from '@/components/google/EspacioDrive';
import {
  ChevronLeft, FolderOpen, Plus, RefreshCw, Upload, FileText, Film, Image as ImageIcon,
  CalendarDays, XCircle, AlertTriangle, Link2, Inbox, BookHeart, X,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const BENEFICIOS = [
  { valor: 'laboral', etiqueta: 'Laboral' },
  { valor: 'mental', etiqueta: 'Mental' },
  { valor: 'social', etiqueta: 'Social' },
  { valor: 'corporal', etiqueta: 'Corporal' },
] as const;
type Beneficio = (typeof BENEFICIOS)[number]['valor'];
const BENEFICIO_LABEL = Object.fromEntries(BENEFICIOS.map((b) => [b.valor, b.etiqueta])) as Record<Beneficio, string>;

interface Experiencia { id: number; nombre: string; descripcion: string | null; fechaInicio: string; fechaFin: string; eventos: number }
interface Evento { id: number; nombre: string; fecha: string; descripcion: string | null; beneficios: Beneficio[] }
interface Archivo {
  id: string; nombre: string; mime: string; tamano: number | null; verUrl: string;
  tieneMiniatura: boolean; eventoId: number | null;
}
interface Detalle {
  experiencia: { id: number; nombre: string; descripcion: string | null; fechaInicio: string; fechaFin: string; driveUrl: string };
  eventos: Evento[];
  archivos: Archivo[];
  carpetaPerdida: boolean;
}
interface Conexion {
  puede: boolean; configurado: boolean;
  conexion: { email: string; estado: 'activa' | 'revocada' } | null;
  espacio: EspacioDriveDatos | null;
}
interface Subida { nombre: string; pct: number; error?: string }

const fmtFecha = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};
/** «03 oct 2026 – 10 oct 2026», o un solo día si empieza y termina igual. */
const fmtRango = (i: string, f: string) => (i === f ? fmtFecha(i) : `${fmtFecha(i)} – ${fmtFecha(f)}`);
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function pedir<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init?.body ? { ...init, headers: { 'Content-Type': 'application/json' } } : init);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || 'No se pudo completar la acción.'), { code: j.code });
  return j.data as T;
}

/** Sube los bytes DIRECTO a Google (sesión reanudable abierta por el servidor), con progreso. */
function subirAGoogle(url: string, file: File, onPct: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(
      xhr.status === 403 && /storageQuotaExceeded/.test(xhr.responseText) ? 'Tu Google Drive se quedó sin espacio.' : `Google rechazó la subida (${xhr.status}).`,
    )));
    xhr.onerror = () => reject(new Error('Se cortó la conexión durante la subida.'));
    xhr.send(file);
  });
}

/**
 * EXPERIENCIAS PERSONALES — las que crea el propio usuario. No afectan su perfil.
 * Experiencia → eventos (nombre, fecha, descripción, tipos de beneficio) → archivos en su
 * Google Drive. Lo que añada desde la app de Drive a la carpeta de la experiencia aparece
 * en «Sin evento» al sincronizar.
 */
export default function ExperienciasPersonales() {
  const [conexion, setConexion] = useState<Conexion | null>(null);
  const [lista, setLista] = useState<Experiencia[] | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [err, setErr] = useState<{ text: string; code?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);
  const [formExp, setFormExp] = useState<{ id: number | null; nombre: string; descripcion: string; fechaInicio: string; fechaFin: string } | null>(null);
  /** Filtro de la lista: las experiencias cuyo rango incluye este día. '' = todas. */
  const [diaFiltro, setDiaFiltro] = useState('');
  const [formEv, setFormEv] = useState<{ id: number | null; nombre: string; fecha: string; descripcion: string; beneficios: Beneficio[] } | null>(null);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const destinoSubida = useRef<number | null>(null);
  const inputArchivos = useRef<HTMLInputElement>(null);

  const fallo = (e: any) => setErr({ text: e?.message || 'Error', code: e?.code });

  const cargarConexion = useCallback(async () => {
    try { setConexion(await pedir<Conexion>('/api/google/conexion')); } catch (e) { fallo(e); }
  }, []);

  const cargarLista = useCallback(async () => {
    try {
      const d = await pedir<{ experiencias: Experiencia[] }>('/api/experiencias/personales');
      setLista(d.experiencias);
    } catch (e) { fallo(e); }
  }, []);

  const cargarDetalle = useCallback(async (id: number) => {
    setCargandoDetalle(true);
    try {
      setDetalle(await pedir<Detalle>(`/api/experiencias/personales/${id}`));
      setErr(null);
    } catch (e) { fallo(e); } finally { setCargandoDetalle(false); }
  }, []);

  useEffect(() => { cargarConexion(); cargarLista(); }, [cargarConexion, cargarLista]);
  useEffect(() => { if (abierta != null) cargarDetalle(abierta); else setDetalle(null); }, [abierta, cargarDetalle]);

  /**
   * `recargarDetalle: false` cuando la acción BORRA la experiencia abierta: si no, se
   * recargaba su detalle con el id viejo y salía «Experiencia no encontrada» aunque el
   * borrado había ido bien (lo vio Fernando, 2026-10-13).
   */
  const accion = async (fn: () => Promise<unknown>, recargarDetalle = true) => {
    setBusy(true);
    try {
      await fn();
      setErr(null);
      if (recargarDetalle && abierta != null) await cargarDetalle(abierta);
      await cargarLista();
    } catch (e) { fallo(e); } finally { setBusy(false); }
  };

  // ── Guardar formularios ──
  const guardarExp = async () => { if (!formExp) return; await accion(async () => {
    const body = JSON.stringify({ nombre: formExp.nombre, descripcion: formExp.descripcion, fechaInicio: formExp.fechaInicio, fechaFin: formExp.fechaFin });
    if (formExp.id == null) {
      const { id } = await pedir<{ id: number }>('/api/experiencias/personales', { method: 'POST', body });
      setAbierta(id);
    } else {
      await pedir(`/api/experiencias/personales/${formExp.id}`, { method: 'PATCH', body });
    }
    setFormExp(null);
  }); };

  const guardarEv = async () => { if (!formEv || abierta == null) return; await accion(async () => {
    const body = JSON.stringify({ nombre: formEv.nombre, fecha: formEv.fecha, descripcion: formEv.descripcion, beneficios: formEv.beneficios });
    if (formEv.id == null) await pedir(`/api/experiencias/personales/${abierta}/eventos`, { method: 'POST', body });
    else await pedir(`/api/experiencias/personales/${abierta}/eventos/${formEv.id}`, { method: 'PATCH', body });
    setFormEv(null);
  }); };

  // ── Subida ──
  const elegirArchivos = (eventoId: number) => {
    destinoSubida.current = eventoId;
    inputArchivos.current?.click();
  };

  const subir = async (files: File[]) => {
    if (abierta == null || files.length === 0) return;
    const validos = files.filter((f) => f.type === 'application/pdf' || f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validos.length < files.length) {
      setErr({ text: 'Solo se admiten PDF, imágenes y videos; el resto se omitió.' });
    }
    // Con el espacio a la vista, se avisa ANTES de empezar a subir.
    const total = validos.reduce((s, f) => s + f.size, 0);
    const libre = conexion?.espacio?.libre;
    if (libre != null && total > libre) {
      setErr({ text: `No hay espacio en tu Google Drive: necesitas ${fmtBytes(total)} y quedan ${fmtBytes(libre)}.`, code: 'drive_sin_espacio' });
      return;
    }
    const eventoId = destinoSubida.current;
    setSubidas(validos.map((f) => ({ nombre: f.name, pct: 0 })));
    setBusy(true);
    for (let i = 0; i < validos.length; i++) {
      const f = validos[i];
      const marcar = (cambio: Partial<Subida>) => setSubidas((s) => s.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
      try {
        const { url } = await pedir<{ url: string }>(`/api/experiencias/personales/${abierta}/subidas`, {
          method: 'POST', body: JSON.stringify({ eventoId, nombre: f.name, mime: f.type, tamano: f.size }),
        });
        await subirAGoogle(url, f, (pct) => marcar({ pct }));
        marcar({ pct: 100 });
      } catch (e: any) {
        marcar({ error: e.message });
        if (e?.code === 'drive_sin_espacio') { fallo(e); break; }
      }
    }
    setBusy(false);
    await Promise.all([cargarDetalle(abierta), cargarConexion()]);
    setSubidas((s) => s.filter((x) => x.error));
  };

  const desconectado = conexion && (!conexion.conexion || conexion.conexion.estado === 'revocada');
  const sinEspacio = conexion?.espacio?.libre != null && conexion.espacio.libre <= 0;

  // ── Sin conexión con Google ──
  if (conexion && desconectado) {
    const revocada = conexion.conexion?.estado === 'revocada';
    return (
      <div className="bg-digi-card border border-digi-border rounded-xl py-14 px-4 text-center">
        <Link2 className="w-8 h-8 text-digi-muted mx-auto mb-2" />
        <p className="text-[13px] text-digi-text font-medium" style={mf}>
          {revocada ? 'Google retiró el acceso de la app' : 'Conecta tu cuenta de Google'}
        </p>
        <p className="text-[12px] text-digi-muted mt-1 max-w-[420px] mx-auto" style={mf}>
          Los archivos de tus experiencias personales se guardan en tu propio Google Drive.
        </p>
        <a href="/dashboard/settings?tab=conexiones" className={`${BTN_PRIMARY} mt-4`} style={mf}>
          {revocada ? 'Reconectar en Configuración' : 'Conectar en Configuración'}
        </a>
      </div>
    );
  }

  const banner = err && (
    <div className="mb-3 px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
      <XCircle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{err.text}</span>
      {(err.code === 'google_reconectar' || err.code === 'google_no_conectado') && (
        <a href="/dashboard/settings?tab=conexiones" className="underline font-medium">Ir a Conexiones</a>
      )}
    </div>
  );

  const espacio = conexion?.espacio && (
    <div className={`bg-digi-card border rounded-lg px-3 py-2.5 ${sinEspacio ? 'border-red-400/60' : 'border-digi-border'}`}>
      <EspacioDrive espacio={conexion.espacio} />
    </div>
  );

  const formularios = (
    <>
      <EditPanel
        open={!!formExp}
        title={formExp?.id == null ? 'Nueva experiencia personal' : 'Editar experiencia'}
        onClose={() => setFormExp(null)}
        onSave={guardarExp}
        saving={busy}
        canSave={!!formExp?.nombre.trim() && !!formExp.fechaInicio && !!formExp.fechaFin && formExp.fechaFin >= formExp.fechaInicio}
        saveLabel={formExp?.id == null ? 'Crear' : 'Guardar'}
      >
        {formExp && (
          <>
            <EditField label="Nombre">
              <input value={formExp.nombre} maxLength={120} autoFocus className={EDIT_INPUT}
                onChange={(e) => setFormExp({ ...formExp, nombre: e.target.value })} />
            </EditField>
            <div className="grid gap-3 grid-cols-2">
              <EditField label="Desde">
                <input type="date" value={formExp.fechaInicio} className={EDIT_INPUT}
                  onChange={(e) => {
                    const fechaInicio = e.target.value;
                    // Si el fin queda antes que el nuevo inicio, se arrastra con él.
                    setFormExp({ ...formExp, fechaInicio, fechaFin: formExp.fechaFin && formExp.fechaFin < fechaInicio ? fechaInicio : formExp.fechaFin });
                  }} />
              </EditField>
              <EditField label="Hasta">
                <input type="date" value={formExp.fechaFin} min={formExp.fechaInicio || undefined} className={EDIT_INPUT}
                  onChange={(e) => setFormExp({ ...formExp, fechaFin: e.target.value })} />
              </EditField>
            </div>
            <EditField label="Descripción (opcional)">
              <textarea value={formExp.descripcion} maxLength={2000} rows={4} className={`${EDIT_INPUT} resize-y`}
                onChange={(e) => setFormExp({ ...formExp, descripcion: e.target.value })} />
            </EditField>
          </>
        )}
      </EditPanel>

      <EditPanel
        open={!!formEv}
        title={formEv?.id == null ? 'Nuevo evento' : 'Editar evento'}
        onClose={() => setFormEv(null)}
        onSave={guardarEv}
        saving={busy}
        canSave={!!formEv?.nombre.trim() && !!formEv?.fecha && (formEv?.beneficios.length ?? 0) > 0}
        saveLabel={formEv?.id == null ? 'Crear' : 'Guardar'}
      >
        {formEv && (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <EditField label="Nombre del evento">
                <input value={formEv.nombre} maxLength={120} autoFocus className={EDIT_INPUT}
                  onChange={(e) => setFormEv({ ...formEv, nombre: e.target.value })} />
              </EditField>
              <EditField label="Fecha">
                <input type="date" value={formEv.fecha} className={EDIT_INPUT}
                  min={detalle?.experiencia.fechaInicio} max={detalle?.experiencia.fechaFin}
                  onChange={(e) => setFormEv({ ...formEv, fecha: e.target.value })} />
              </EditField>
            </div>
            <EditField label="Beneficio para tu vida">
              <div className="border border-digi-border rounded divide-y divide-digi-border">
                {BENEFICIOS.map((b) => {
                  const marcada = formEv.beneficios.includes(b.valor);
                  return (
                    <FilaMarcable key={b.valor} marcada={marcada} etiqueta={b.etiqueta}
                      onClick={() => setFormEv({
                        ...formEv,
                        beneficios: marcada ? formEv.beneficios.filter((x) => x !== b.valor) : [...formEv.beneficios, b.valor],
                      })} />
                  );
                })}
              </div>
            </EditField>
            <EditField label="Descripción (opcional)">
              <textarea value={formEv.descripcion} maxLength={2000} rows={4} className={`${EDIT_INPUT} resize-y`}
                onChange={(e) => setFormEv({ ...formEv, descripcion: e.target.value })} />
            </EditField>
          </>
        )}
      </EditPanel>

      <PixelConfirm
        open={!!confirm}
        danger
        message={confirm?.text || ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const c = confirm; setConfirm(null); c?.onOk(); }}
      />
    </>
  );

  // ── Detalle ──
  if (abierta != null) {
    const d = detalle?.experiencia.id === abierta ? detalle : null;
    const sueltos = d?.archivos.filter((a) => a.eventoId == null) ?? [];
    return (
      <div className="flex-1 min-w-0 w-full">
        <button onClick={() => { setAbierta(null); setErr(null); }} className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-3" style={mf}>
          <ChevronLeft className="w-4 h-4" /> Experiencias personales
        </button>
        {banner}
        {!d ? (
          <p className="py-12 text-center text-[13px] text-digi-muted" style={mf}>{cargandoDetalle ? 'Cargando…' : ''}</p>
        ) : (
          <>
            <div className="bg-digi-card border border-digi-border rounded-xl p-4">
              <div className="flex items-start gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-[17px] font-semibold text-digi-text" style={df}>{d.experiencia.nombre}</h1>
                    <span className="text-[10.5px] px-2 py-0.5 rounded-full border bg-black/[0.05] text-digi-muted border-digi-border" style={mf}>Personal</span>
                  </div>
                  <p className="text-[12.5px] text-digi-muted mt-1 inline-flex items-center gap-1.5" style={mf}>
                    <CalendarDays className="w-4 h-4" /> {fmtRango(d.experiencia.fechaInicio, d.experiencia.fechaFin)}
                  </p>
                  {d.experiencia.descripcion && <p className="text-[13px] text-digi-muted mt-2 whitespace-pre-wrap" style={mf}>{d.experiencia.descripcion}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <BotonEditar etiqueta="Editar experiencia" onClick={() => setFormExp({ id: d.experiencia.id, nombre: d.experiencia.nombre, descripcion: d.experiencia.descripcion || '', fechaInicio: d.experiencia.fechaInicio, fechaFin: d.experiencia.fechaFin })} />
                  <BotonQuitar etiqueta="Eliminar experiencia" onClick={() => setConfirm({
                    text: `¿Eliminar «${d.experiencia.nombre}»? Su carpeta y todos sus archivos irán a la papelera de tu Google Drive (se pueden recuperar durante 30 días).`,
                    onOk: () => accion(async () => {
                      await pedir(`/api/experiencias/personales/${d.experiencia.id}`, { method: 'DELETE' });
                      setAbierta(null);
                    }, false),
                  })} />
                </div>
              </div>
              {d.carpetaPerdida && (
                <div className="mt-3 px-3 py-2 rounded-md border border-amber-400/50 bg-amber-400/10 text-[12px] text-amber-700 flex items-center gap-2" style={mf}>
                  <AlertTriangle className="w-4 h-4 shrink-0" /> La carpeta de esta experiencia ya no está en tu Google Drive (¿la borraste o está en la papelera?).
                </div>
              )}
              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-digi-border flex-wrap">
                {espacio && <div className="w-full sm:w-auto sm:min-w-[300px]">{conexion?.espacio && <EspacioDrive espacio={conexion.espacio} />}</div>}
                <div className="flex items-center gap-2 flex-wrap ml-auto">
                  <a href={d.experiencia.driveUrl} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY} style={mf}>
                    <FolderOpen className="w-4 h-4" /> Abrir en Drive
                  </a>
                  <button className={BTN_SECONDARY} disabled={busy || cargandoDetalle} style={mf}
                    onClick={() => { cargarDetalle(d.experiencia.id); cargarConexion(); }}>
                    <RefreshCw className={`w-4 h-4 ${cargandoDetalle ? 'animate-spin' : ''}`} /> Sincronizar
                  </button>
                  <button className={BTN_PRIMARY} disabled={busy} style={mf}
                    onClick={() => {
                      const h = hoy(), { fechaInicio: i, fechaFin: f } = d.experiencia;
                      setFormEv({ id: null, nombre: '', fecha: h < i ? i : h > f ? f : h, descripcion: '', beneficios: [] });
                    }}>
                    <Plus className="w-4 h-4" /> Nuevo evento
                  </button>
                </div>
              </div>
            </div>

            {subidas.length > 0 && (
              <div className="mt-3 bg-digi-card border border-digi-border rounded-lg p-3 space-y-2">
                {subidas.map((s, i) => (
                  <div key={i} className="text-[12px]" style={mf}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-digi-text">{s.nombre}</span>
                      <span className={s.error ? 'text-red-600' : 'text-digi-muted tabular-nums'}>{s.error || `${s.pct} %`}</span>
                    </div>
                    {!s.error && <div className="h-1 mt-1 rounded-full bg-black/[0.06] overflow-hidden"><div className="h-full bg-accent" style={{ width: `${s.pct}%` }} /></div>}
                  </div>
                ))}
              </div>
            )}

            {sueltos.length > 0 && (
              <Seccion
                titulo="Sin evento"
                icono={<Inbox className="w-4 h-4 text-amber-600" />}
                nota={`${sueltos.length} archivo(s) añadidos desde Google Drive`}
              >
                <Rejilla archivos={sueltos} eventos={d.eventos} busy={busy}
                  onMover={(a, ev) => accion(() => pedir(`/api/experiencias/personales/${abierta}/archivos/${a.id}`, { method: 'PATCH', body: JSON.stringify({ eventoId: ev }) }))}
                  onQuitar={(a) => setConfirm({ text: `¿Enviar «${a.nombre}» a la papelera de tu Google Drive?`, onOk: () => accion(() => pedir(`/api/experiencias/personales/${abierta}/archivos/${a.id}`, { method: 'DELETE' })) })} />
              </Seccion>
            )}

            {d.eventos.length === 0 ? (
              <div className="mt-3 bg-digi-card border border-digi-border rounded-xl py-12 text-center">
                <CalendarDays className="w-8 h-8 text-digi-muted mx-auto mb-2" />
                <p className="text-[13px] text-digi-text font-medium" style={mf}>Aún no hay eventos</p>
                <p className="text-[12px] text-digi-muted mt-1" style={mf}>Crea un evento para empezar a subir tus archivos.</p>
              </div>
            ) : d.eventos.map((ev) => {
              const archivos = d.archivos.filter((a) => a.eventoId === ev.id);
              return (
                <Seccion
                  key={ev.id}
                  titulo={ev.nombre}
                  icono={<CalendarDays className="w-4 h-4 text-accent" />}
                  nota={fmtFecha(ev.fecha)}
                  chips={ev.beneficios.map((b) => BENEFICIO_LABEL[b])}
                  descripcion={ev.descripcion}
                  acciones={
                    <>
                      <BotonEditar etiqueta="Editar evento" onClick={() => setFormEv({ id: ev.id, nombre: ev.nombre, fecha: ev.fecha, descripcion: ev.descripcion || '', beneficios: ev.beneficios })} />
                      <BotonQuitar etiqueta="Eliminar evento" onClick={() => setConfirm({
                        text: `¿Eliminar el evento «${ev.nombre}»? Sus archivos no se borran: quedarán en «Sin evento».`,
                        onOk: () => accion(() => pedir(`/api/experiencias/personales/${abierta}/eventos/${ev.id}`, { method: 'DELETE' })),
                      })} />
                      <button className={BTN_SECONDARY} disabled={busy || sinEspacio} onClick={() => elegirArchivos(ev.id)} style={mf}>
                        <Upload className="w-4 h-4" /> Subir archivos
                      </button>
                    </>
                  }
                >
                  {archivos.length === 0
                    ? <p className="text-[12px] text-digi-muted py-3" style={mf}>Sin archivos.</p>
                    : <Rejilla archivos={archivos} eventos={d.eventos} busy={busy}
                        onMover={(a, destino) => accion(() => pedir(`/api/experiencias/personales/${abierta}/archivos/${a.id}`, { method: 'PATCH', body: JSON.stringify({ eventoId: destino }) }))}
                        onQuitar={(a) => setConfirm({ text: `¿Enviar «${a.nombre}» a la papelera de tu Google Drive?`, onOk: () => accion(() => pedir(`/api/experiencias/personales/${abierta}/archivos/${a.id}`, { method: 'DELETE' })) })} />}
                </Seccion>
              );
            })}
          </>
        )}
        <input ref={inputArchivos} type="file" multiple hidden accept="application/pdf,image/*,video/*"
          onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; subir(fs); }} />
        {formularios}
      </div>
    );
  }

  // ── Lista ──
  // AAAA-MM-DD se compara bien como texto: el día cae dentro si inicio ≤ día ≤ fin.
  const visibles = (lista ?? []).filter((e) => !diaFiltro || (e.fechaInicio <= diaFiltro && diaFiltro <= e.fechaFin));
  return (
    <div className="flex-1 min-w-0 w-full">
      {banner}
      {/* Una sola fila (Fernando, 2026-10-13): espacio del Drive · filtro por día · «Nueva experiencia». */}
      <div className="flex items-center justify-end gap-2 mb-3 flex-wrap">
        {espacio && <div className="w-full sm:w-[320px]">{espacio}</div>}
        <div className="flex items-center gap-1.5">
          <input type="date" aria-label="Filtrar por fecha" value={diaFiltro} className={`${EDIT_INPUT} !w-auto`}
            onChange={(e) => setDiaFiltro(e.target.value)} />
          {diaFiltro && (
            <button type="button" onClick={() => setDiaFiltro('')} title="Quitar filtro" aria-label="Quitar filtro"
              className="w-8 h-8 inline-flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-black/[0.04]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button className={`${BTN_PRIMARY} max-sm:ml-auto`} disabled={!conexion} style={mf}
          onClick={() => setFormExp({ id: null, nombre: '', descripcion: '', fechaInicio: hoy(), fechaFin: hoy() })}>
          <Plus className="w-4 h-4" /> Nueva experiencia
        </button>
      </div>
      {lista == null ? (
        <p className="py-12 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>
      ) : visibles.length === 0 && diaFiltro ? (
        <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
          <CalendarDays className="w-8 h-8 text-digi-muted mx-auto mb-2" />
          <p className="text-[13px] text-digi-text font-medium" style={mf}>Ninguna experiencia incluye el {fmtFecha(diaFiltro)}</p>
        </div>
      ) : lista.length === 0 ? (
        <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
          <BookHeart className="w-8 h-8 text-digi-muted mx-auto mb-2" />
          <p className="text-[13px] text-digi-text font-medium" style={mf}>Aún no tienes experiencias personales</p>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>Guarda aquí tus eventos con sus fotos, videos y documentos.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((e) => (
            <button key={e.id} onClick={() => setAbierta(e.id)}
              className="text-left bg-digi-card border border-digi-border rounded-lg p-3.5 hover:border-accent transition-colors">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13.5px] font-semibold text-digi-text" style={df}>{e.nombre}</span>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full border bg-black/[0.05] text-digi-muted border-digi-border" style={mf}>Personal</span>
              </div>
              {e.descripcion && <p className="text-[12px] text-digi-muted mt-1.5 line-clamp-2" style={mf}>{e.descripcion}</p>}
              <p className="mt-2 text-[11.5px] text-digi-muted flex items-center gap-1 flex-wrap" style={mf}>
                <CalendarDays className="w-3.5 h-3.5" /> {fmtRango(e.fechaInicio, e.fechaFin)}
                <span className="mx-1">·</span>{e.eventos} evento(s)
              </p>
            </button>
          ))}
        </div>
      )}
      {formularios}
    </div>
  );
}

function Seccion({ titulo, icono, nota, chips, descripcion, acciones, children }: {
  titulo: string; icono: React.ReactNode; nota?: string; chips?: string[];
  descripcion?: string | null; acciones?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="mt-3 bg-digi-card border border-digi-border rounded-xl p-4">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {icono}
            <h2 className="text-[14px] font-semibold text-digi-text" style={df}>{titulo}</h2>
            {nota && <span className="text-[12px] text-digi-muted" style={mf}>{nota}</span>}
            {chips?.map((c) => (
              <span key={c} className="text-[10.5px] px-2 py-0.5 rounded-full border bg-accent-light border-accent/30 text-accent" style={mf}>{c}</span>
            ))}
          </div>
          {descripcion && <p className="text-[12.5px] text-digi-muted mt-1.5 whitespace-pre-wrap" style={mf}>{descripcion}</p>}
        </div>
        {acciones && <div className="flex items-center gap-1 flex-wrap">{acciones}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function IconoTipo({ mime, className }: { mime: string; className: string }) {
  if (mime.startsWith('video/')) return <Film className={className} />;
  if (mime.startsWith('image/')) return <ImageIcon className={className} />;
  return <FileText className={className} />;
}

/** Cuadrícula de miniaturas. Al pulsar se abre el archivo en Google Drive (sin visor propio). */
function Rejilla({ archivos, eventos, busy, onMover, onQuitar }: {
  archivos: Archivo[]; eventos: Evento[]; busy: boolean;
  onMover: (a: Archivo, eventoId: number | null) => void;
  onQuitar: (a: Archivo) => void;
}) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {archivos.map((a) => (
        <div key={a.id} className="border border-digi-border rounded-lg overflow-hidden flex flex-col bg-digi-card">
          <a href={a.verUrl} target="_blank" rel="noopener noreferrer" title={a.nombre}
            className="relative aspect-[4/3] bg-black/[0.04] flex items-center justify-center hover:opacity-90 transition-opacity">
            {a.tieneMiniatura
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/api/google/miniatura/${a.id}`} alt="" loading="lazy" className="w-full h-full object-cover" />
              : <IconoTipo mime={a.mime} className="w-8 h-8 text-digi-muted" />}
            {a.mime.startsWith('video/') && a.tieneMiniatura && (
              <span className="absolute bottom-1 left-1 bg-black/60 text-white rounded px-1 py-0.5"><Film className="w-3 h-3" /></span>
            )}
          </a>
          <div className="p-2 flex flex-col gap-1.5">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-digi-text truncate" style={mf} title={a.nombre}>{a.nombre}</p>
                {a.tamano != null && <p className="text-[10.5px] text-digi-muted tabular-nums" style={mf}>{fmtBytes(a.tamano)}</p>}
              </div>
              <BotonQuitar tamano="xs" etiqueta="Enviar a la papelera" disabled={busy} onClick={() => onQuitar(a)} />
            </div>
            {eventos.length > 0 && (
              <select
                aria-label="Evento"
                className={`${EDIT_INPUT} select-compacto !py-1 !text-[11.5px]`}
                value={a.eventoId ?? ''}
                disabled={busy}
                onChange={(e) => onMover(a, e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">Sin evento</option>
                {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
              </select>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
