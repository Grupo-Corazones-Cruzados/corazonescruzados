'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ChevronLeft, Copy, Loader2, Pencil, Power, SquareTerminal } from 'lucide-react';
import MenuMas from '@/components/ui/MenuMas';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PieAcciones from '@/components/ui/PieAcciones';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import ListaMensajes from './Bloques';
import TarjetaSolicitud from './Solicitud';
import Compositor, { type Imagen } from './Compositor';
import { api, BASE, ErrorEspacio, TEXTO_ESTADO, type EstadoViva, type Mensaje, type Proyecto, type Solicitud } from './api';

interface Fin { ok: boolean; duracion: number; error: string | null }

const segundos = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`);

/**
 * UNA SESIÓN. El historial sale de los archivos de Claude Code y el directo del servicio; los dos
 * llevan el mismo `uuid` por mensaje, así que al recargar a mitad de trabajo no se repite nada.
 */
export default function Conversacion({
  proyecto, sesionId, alVolver, alCrear, alNueva, alCambiar,
}: {
  proyecto: Proyecto;
  sesionId: string | null;
  alVolver?: () => void;
  alCrear: (id: string) => void;
  alNueva: () => void;
  alCambiar: () => void;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [parcial, setParcial] = useState('');
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [estado, setEstado] = useState<EstadoViva | null>(null);
  const [fin, setFin] = useState<Fin | null>(null);
  const [error, setError] = useState('');
  const [titulo, setTitulo] = useState('');
  const [carpeta, setCarpeta] = useState('');
  const [enTerminal, setEnTerminal] = useState(false);
  const [modelo, setModelo] = useState('default');
  const [modo, setModo] = useState('bypassPermissions');
  const [cargando, setCargando] = useState(!!sesionId);
  const [anteriores, setAnteriores] = useState<number | null>(null);
  const [lejos, setLejos] = useState(false);
  const [confirmar, setConfirmar] = useState<null | (() => void)>(null);
  const [renombrar, setRenombrar] = useState<string | null>(null);
  const [comando, setComando] = useState('');
  const fuente = useRef<EventSource | null>(null);
  const ultimoSeq = useRef(0);
  const vistos = useRef(new Set<string>());
  const caja = useRef<HTMLDivElement>(null);
  const pegado = useRef(true);
  const idRef = useRef(sesionId);
  idRef.current = sesionId;

  const bajar = useCallback((suave = false) => {
    const c = caja.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => { if (pegado.current) bajar(); }, [mensajes, parcial, solicitudes, fin, bajar]);

  const manejar = useCallback((e: any) => {
    if (e.seq <= ultimoSeq.current) return;
    ultimoSeq.current = e.seq;
    switch (e.tipo) {
      case 'delta': setParcial((p) => p + e.texto); setFin(null); break;
      case 'mensaje':
        if (e.padre) break;
        if (e.rol === 'assistant') setParcial('');
        if (vistos.current.has(e.uuid)) break;
        vistos.current.add(e.uuid);
        setMensajes((l) => [...l, { uuid: e.uuid, rol: e.rol, bloques: e.bloques }]);
        if (e.propio) { setFin(null); setError(''); }
        break;
      case 'estado': setEstado(e.estado); break;
      case 'inicio': setModelo((m) => (m === 'default' ? m : e.modelo)); setModo(e.modo); break;
      case 'ajustes': setModo(e.modo); break;
      case 'solicitud': setSolicitudes((l) => (l.some((x) => x.solicitudId === e.solicitudId) ? l : [...l, e])); break;
      case 'solicitud_fin': setSolicitudes((l) => l.filter((x) => x.solicitudId !== e.solicitudId)); break;
      case 'fin':
        setParcial(''); setFin({ ok: e.ok, duracion: e.duracion, error: e.error }); alCambiar();
        if (idRef.current) api(`/sesiones/${idRef.current}/mensajes?proyecto=${proyecto.id}&antes=0`).then((j) => { if (j.titulo) setTitulo(j.titulo); }).catch(() => {});
        break;
      case 'error': setError(e.texto); break;
    }
  }, [alCambiar, proyecto.id]);

  const conectar = useCallback((id: string) => {
    fuente.current?.close();
    // Cada proceso del servicio numera desde cero; lo ya visto lo descarta el `uuid`.
    ultimoSeq.current = 0;
    const f = new EventSource(`${BASE}/sesiones/${id}/eventos?desde=0`);
    f.onmessage = (m) => {
      const e = JSON.parse(m.data);
      manejar(e);
      if (e.tipo === 'estado' && e.estado === 'cerrada') { f.close(); setSolicitudes([]); }
    };
    fuente.current = f;
  }, [manejar]);

  const cargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      const j = await api(`/sesiones/${id}/mensajes?proyecto=${proyecto.id}`);
      vistos.current = new Set(j.mensajes.map((m: Mensaje) => m.uuid));
      setMensajes(j.mensajes);
      setAnteriores(j.hayAnteriores ? j.inicio : null);
      setTitulo(j.titulo || '');
      setCarpeta(j.carpeta || '');
      setEnTerminal(j.enTerminal);
      if (j.error) setError(`La sesión se detuvo: ${j.error}`);
      if (j.viva) {
        setEstado(j.viva.estado);
        if (j.viva.modo) setModo(j.viva.modo);
        setSolicitudes(j.viva.solicitudes || []);
        conectar(id);
      } else setEstado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la sesión.');
    } finally {
      setCargando(false);
      pegado.current = true;
      requestAnimationFrame(() => bajar());
    }
  }, [proyecto.id, conectar, bajar]);

  useEffect(() => {
    setMensajes([]); setParcial(''); setSolicitudes([]); setEstado(null); setFin(null); setError(''); setTitulo(''); setEnTerminal(false); setAnteriores(null);
    if (sesionId) cargar(sesionId); else { setCargando(false); setCarpeta(proyecto.ruta); }
    return () => { fuente.current?.close(); fuente.current = null; };
    // Solo al cambiar de sesión: `cargar` depende del proyecto, que cambia con ella.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionId, proyecto.id]);

  async function verAnteriores() {
    if (anteriores === null || !sesionId) return;
    const c = caja.current;
    const alto = c?.scrollHeight || 0;
    const j = await api(`/sesiones/${sesionId}/mensajes?proyecto=${proyecto.id}&antes=${anteriores}`);
    const nuevos = (j.mensajes as Mensaje[]).filter((m) => !vistos.current.has(m.uuid));
    nuevos.forEach((m) => vistos.current.add(m.uuid));
    pegado.current = false;
    setMensajes((l) => [...nuevos, ...l]);
    setAnteriores(j.hayAnteriores ? j.inicio : null);
    requestAnimationFrame(() => { if (c) c.scrollTop = c.scrollHeight - alto; });
  }

  async function mandar(texto: string, imagenes: Imagen[], forzar = false): Promise<boolean> {
    const cuerpo = {
      proyecto: proyecto.id, texto, forzar, modo,
      modelo: modelo === 'default' ? undefined : modelo,
      imagenes: imagenes.map(({ tipo, datos }) => ({ tipo, datos })),
    };
    setError('');
    pegado.current = true;
    try {
      if (!sesionId) {
        const { id } = await api('/sesiones', { cuerpo });
        alCrear(id);
        return true;
      }
      await api(`/sesiones/${sesionId}/enviar`, { cuerpo });
      if (!fuente.current || fuente.current.readyState === EventSource.CLOSED) conectar(sesionId);
      setEstado('trabajando');
      setEnTerminal(false);
      alCambiar();
      return true;
    } catch (e) {
      if (e instanceof ErrorEspacio && e.codigo === 'abierta_en_terminal') {
        return new Promise((ok) => setConfirmar(() => async () => {
          setConfirmar(null);
          ok(await mandar(texto, imagenes, true));
        }));
      }
      setError(e instanceof Error ? e.message : 'No se pudo enviar.');
      return false;
    }
  }

  async function responder(s: Solicitud, r: { permitir: boolean; respuestas?: Record<string, string>; mensaje?: string }) {
    try { await api(`/sesiones/${sesionId}/responder`, { cuerpo: { solicitudId: s.solicitudId, ...r } }); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo responder.'); }
  }

  const ajustar = (c: { modelo?: string; modo?: string }) => {
    if (sesionId && estado && estado !== 'cerrada') api(`/sesiones/${sesionId}/ajustes`, { cuerpo: c }).catch((e) => setError(e.message));
  };

  async function terminal(abrir: boolean) {
    try {
      const j = await api(`/sesiones/${sesionId}/terminal`, { cuerpo: { proyecto: proyecto.id, abrir } });
      if (!abrir) {
        await navigator.clipboard?.writeText(j.comando).catch(() => {});
        setComando(j.comando);
      }
      setEstado(null); alCambiar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir.'); }
  }

  async function guardarTitulo() {
    if (!renombrar?.trim()) return;
    try {
      await api(`/sesiones/${sesionId}/titulo`, { cuerpo: { proyecto: proyecto.id, titulo: renombrar.trim() } });
      setTitulo(renombrar.trim()); setRenombrar(null); alCambiar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }

  const trabajando = estado === 'trabajando' || estado === 'iniciando';
  const lineaEstado = estado && estado !== 'cerrada' ? TEXTO_ESTADO[estado] : null;

  return (
    <section className="flex flex-col min-h-0 min-w-0 h-full">
      <header className="shrink-0 flex items-center gap-2 px-3 min-h-12 border-b border-digi-border">
        {alVolver && <button type="button" onClick={alVolver} aria-label="Volver a la lista" className="destino-tactil -ml-1 w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text"><ChevronLeft className="w-5 h-5" /></button>}
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-semibold text-digi-text truncate" title={titulo}>{sesionId ? titulo || 'Sesión' : 'Sesión nueva'}</h2>
          <p className="text-[11.5px] text-digi-muted truncate" title={carpeta}>
            {proyecto.nombre}{lineaEstado && <> · <span className={lineaEstado.clase}>{lineaEstado.texto}</span></>}{enTerminal && !estado && <> · <span className="text-amber-400">Abierta en una terminal</span></>}
          </p>
        </div>
        {sesionId && (
          <MenuMas items={[
            { label: 'Cambiar nombre', icon: Pencil, onClick: () => setRenombrar(titulo) },
            { label: 'Abrir en Terminal', icon: SquareTerminal, onClick: () => terminal(true), disabled: trabajando, hint: 'Primero detén la sesión' },
            { label: 'Copiar comando de terminal', icon: Copy, onClick: () => terminal(false), disabled: trabajando, hint: 'Primero detén la sesión' },
            { label: 'Cerrar el proceso', icon: Power, onClick: () => { api(`/sesiones/${sesionId}/cerrar`, { cuerpo: {} }).then(() => { setEstado(null); alCambiar(); }); }, disabled: !estado },
          ]} />
        )}
      </header>

      <div className="relative flex-1 min-h-0">
        <div ref={caja} className="absolute inset-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3"
          onScroll={(e) => { const c = e.currentTarget; const distancia = c.scrollHeight - c.scrollTop - c.clientHeight; pegado.current = distancia < 80; setLejos(distancia > 400); }}>
          <div className="max-w-3xl mx-auto space-y-3 min-w-0">
            {anteriores !== null && <div className="flex justify-center"><button type="button" onClick={verAnteriores} className={BTN_SECONDARY}>Ver mensajes anteriores</button></div>}
            {cargando && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>}
            {!cargando && !sesionId && <p className="text-center text-[13px] text-digi-muted py-16 truncate" title={proyecto.ruta}>{proyecto.ruta}</p>}
            <ListaMensajes mensajes={mensajes} parcial={parcial} />
            {solicitudes.map((s) => <TarjetaSolicitud key={s.solicitudId} s={s} responder={responder} />)}
            {trabajando && !parcial && !solicitudes.length && <p className="flex items-center gap-2 text-[12.5px] text-accent"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Trabajando</p>}
            {fin && !trabajando && <p className={`text-[11.5px] tabular-nums ${fin.ok ? 'text-digi-muted' : 'text-red-400'}`}>{fin.ok ? `Terminó en ${segundos(fin.duracion)}` : `Terminó con error: ${fin.error || 'sin detalle'}`}</p>}
            {error && <p className={`rounded-lg border p-3 text-[13px] ${TONO.error.caja} ${TONO.error.texto}`}>{error}</p>}
          </div>
        </div>
        {lejos && <button type="button" onClick={() => { pegado.current = true; bajar(true); }} aria-label="Ir al final" title="Ir al final" className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-digi-card border border-digi-border shadow flex items-center justify-center text-digi-muted hover:text-digi-text"><ArrowDown className="w-4 h-4" /></button>}
      </div>

      <div className="max-lg:pb-[var(--seguro-abajo)] bg-digi-card">
        <Compositor trabajando={trabajando} sesionId={sesionId} modelo={modelo} modo={modo}
          alCambiarModelo={(m) => { setModelo(m); ajustar({ modelo: m }); }}
          alCambiarModo={(m) => { setModo(m); ajustar({ modo: m }); }}
          alEnviar={mandar}
          alDetener={() => { if (sesionId) api(`/sesiones/${sesionId}/detener`, { cuerpo: {} }).catch((e) => setError(e.message)); }}
          alLimpiar={alNueva} />
      </div>

      <PixelConfirm open={!!confirmar} title="Abierta en una terminal"
        message="Esta sesión sigue abierta en una terminal. Si escribes aquí también, cada parte dejará de ver lo que hace la otra. Lo seguro es cerrarla allí primero."
        confirmLabel="Enviar de todos modos" cancelLabel="Cancelar" danger onConfirm={() => confirmar?.()} onCancel={() => setConfirmar(null)} />
      <PixelModal open={renombrar !== null} onClose={() => setRenombrar(null)} title="Cambiar nombre" size="sm"
        pie={<PieAcciones><button type="button" className={BTN_SECONDARY} onClick={() => setRenombrar(null)}>Cancelar</button><button type="button" className={BTN_PRIMARY} onClick={guardarTitulo}>Guardar</button></PieAcciones>}>
        <PixelInput label="Nombre" value={renombrar || ''} autoFocus onChange={(e) => setRenombrar(e.target.value)} />
      </PixelModal>
      <PixelModal open={!!comando} onClose={() => setComando('')} title="Comando copiado" size="sm">
        <pre className="text-[12px] font-mono whitespace-pre-wrap break-all rounded-md bg-digi-darker p-2.5 text-digi-text">{comando}</pre>
      </PixelModal>
    </section>
  );
}
