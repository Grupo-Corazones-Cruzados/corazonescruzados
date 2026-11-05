'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ChevronLeft, Copy, Loader2, LockOpen, Pencil, Power, SlidersHorizontal, SquareTerminal } from 'lucide-react';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import MenuMas from '@/components/ui/MenuMas';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import ListaMensajes from './Bloques';
import TarjetaSolicitud from './Solicitud';
import Compositor, { SelectoresSesion, type Imagen } from './Compositor';
import RenombrarSesion from './RenombrarSesion';
import { api, ErrorEspacio, escucharEventos, estadoVisible, EVENTO_TITULO, MODOS, TEXTO_ESTADO, type EstadoViva, type Mensaje, type Proyecto, type Solicitud } from './api';

interface Fin { ok: boolean; detenida?: boolean; duracion: number; error: string | null }

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
  const [enCola, setEnCola] = useState<Mensaje[]>([]);
  const [hijos, setHijos] = useState<Record<string, Mensaje[]>>({});
  const [aislada, setAislada] = useState(false);
  const [tareas, setTareas] = useState(0);
  const [quitarAislamiento, setQuitarAislamiento] = useState(false);
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
  const [renombrar, setRenombrar] = useState(false);
  const [comando, setComando] = useState('');
  const [ajustes, setAjustes] = useState(false);
  const enEscritorio = useConsultaMedia(PANTALLA_LG);
  const fuente = useRef<(() => void) | null>(null);
  const ultimoSeq = useRef(0);
  const corte = useRef(0);
  const vistos = useRef(new Set<string>());
  const caja = useRef<HTMLDivElement>(null);
  const pegado = useRef(true);
  const idRef = useRef(sesionId);
  idRef.current = sesionId;

  const bajar = useCallback((suave = false) => {
    const c = caja.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => { if (pegado.current) bajar(); }, [mensajes, enCola, parcial, solicitudes, fin, bajar]);

  const manejar = useCallback((e: any) => {
    if (e.seq <= ultimoSeq.current) return;
    ultimoSeq.current = e.seq;
    switch (e.tipo) {
      case 'delta': setParcial((p) => p + e.texto); setFin(null); break;
      case 'mensaje':
        // Lo que hace un subagente va bajo su herramienta, no en la conversación principal.
        if (e.padre) {
          if (!vistos.current.has(e.uuid)) {
            vistos.current.add(e.uuid);
            setHijos((h) => ({ ...h, [e.padre]: [...(h[e.padre] || []), { uuid: e.uuid, rol: e.rol, bloques: e.bloques }] }));
          }
          break;
        }
        if (e.rol === 'assistant') setParcial('');
        setEnCola((l) => (l.some((m) => m.uuid === e.uuid) ? l.filter((m) => m.uuid !== e.uuid) : l));
        // Por debajo del corte es una repetición de algo que ya está en el archivo, aunque no en esta página.
        if (vistos.current.has(e.uuid) || e.seq <= corte.current) break;
        vistos.current.add(e.uuid);
        setMensajes((l) => [...l, { uuid: e.uuid, rol: e.rol, bloques: e.bloques }]);
        if (e.propio) { setFin(null); setError(''); }
        break;
      case 'cola':
        if (vistos.current.has(e.uuid) || e.seq <= corte.current) break;
        setEnCola((l) => (l.some((m) => m.uuid === e.uuid) ? l : [...l, { uuid: e.uuid, rol: 'user', bloques: e.bloques }]));
        setFin(null); setError('');
        break;
      case 'estado': setEstado(e.estado); break;
      case 'tareas': setTareas(e.activas); break;
      case 'inicio': setModelo((m) => (m === 'default' ? m : e.modelo)); setModo(e.modo); break;
      case 'ajustes': setModo(e.modo); break;
      case 'solicitud': setSolicitudes((l) => (l.some((x) => x.solicitudId === e.solicitudId) ? l : [...l, e])); break;
      case 'solicitud_fin': setSolicitudes((l) => l.filter((x) => x.solicitudId !== e.solicitudId)); break;
      case 'fin':
        setParcial(''); setFin({ ok: e.ok, detenida: e.detenida, duracion: e.duracion, error: e.error }); alCambiar();
        if (idRef.current) api(`/sesiones/${idRef.current}/mensajes?proyecto=${proyecto.id}&antes=0`).then((j) => { if (j.titulo) setTitulo(j.titulo); }).catch(() => {});
        break;
      case 'titulo': setTitulo(e.titulo); break;
      case 'error': setError(e.texto); break;
    }
  }, [alCambiar, proyecto.id]);

  const conectar = useCallback((id: string, desdeCorte = 0) => {
    fuente.current?.();
    // Cada proceso del servicio numera desde cero; lo ya visto lo descarta el `uuid`.
    ultimoSeq.current = 0;
    corte.current = desdeCorte;
    const parar = escucharEventos(id, (e) => {
      manejar(e);
      if (e.tipo === 'estado' && e.estado === 'cerrada') { parar(); fuente.current = null; setSolicitudes([]); }
    });
    fuente.current = parar;
  }, [manejar]);

  const cargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      const j = await api(`/sesiones/${id}/mensajes?proyecto=${proyecto.id}`);
      // Se cambió de sesión mientras llegaba: esto ya no es lo que se está viendo.
      if (idRef.current !== id) return;
      vistos.current = new Set(j.mensajes.map((m: Mensaje) => m.uuid));
      setMensajes(j.mensajes);
      setAnteriores(j.hayAnteriores ? j.inicio : null);
      setTitulo(j.titulo || '');
      setCarpeta(j.carpeta || '');
      setEnTerminal(j.enTerminal);
      setAislada(!!j.aislada);
      if (j.error) setError(`La sesión se detuvo: ${j.error}`);
      if (j.viva) {
        setEstado(j.viva.estado);
        setTareas(j.viva.tareas || 0);
        if (j.viva.modo) setModo(j.viva.modo);
        setSolicitudes(j.viva.solicitudes || []);
        conectar(id, j.corte || 0);
      } else setEstado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la sesión.');
    } finally {
      if (idRef.current === id) {
        setCargando(false);
        pegado.current = true;
        requestAnimationFrame(() => bajar());
      }
    }
  }, [proyecto.id, conectar, bajar]);

  useEffect(() => {
    setMensajes([]); setEnCola([]); setHijos({}); setAislada(false); setTareas(0); setParcial(''); setSolicitudes([]); setEstado(null); setFin(null); setError(''); setTitulo(''); setEnTerminal(false); setAnteriores(null);
    if (sesionId) cargar(sesionId); else { setCargando(false); setCarpeta(proyecto.ruta); }
    return () => { fuente.current?.(); fuente.current = null; };
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

  async function mandar(texto: string, imagenes: Imagen[], adjuntos: string[], forzar = false): Promise<boolean> {
    const cuerpo = {
      proyecto: proyecto.id, texto, forzar, modo, adjuntos,
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
      if (!fuente.current) conectar(sesionId);
      setEstado('trabajando');
      setEnTerminal(false);
      alCambiar();
      return true;
    } catch (e) {
      if (e instanceof ErrorEspacio && e.codigo === 'abierta_en_terminal') {
        return new Promise((ok) => setConfirmar(() => async () => {
          setConfirmar(null);
          ok(await mandar(texto, imagenes, adjuntos, true));
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

  useEffect(() => {
    const alRenombrar = (e: Event) => { const d = (e as CustomEvent).detail; if (d.id === idRef.current) setTitulo(d.titulo); };
    window.addEventListener(EVENTO_TITULO, alRenombrar);
    return () => window.removeEventListener(EVENTO_TITULO, alRenombrar);
  }, []);

  const trabajando = estado === 'trabajando' || estado === 'iniciando';
  const lineaEstado = estado && estado !== 'cerrada' ? TEXTO_ESTADO[estadoVisible(estado, tareas)] : null;

  return (
    <section className="flex flex-col min-h-0 min-w-0 h-full">
      <header className="shrink-0 flex items-center gap-1.5 pl-2 pr-1.5 lg:px-3 min-h-11 lg:min-h-12 border-b border-digi-border">
        {alVolver && <button type="button" onClick={alVolver} aria-label="Volver a la lista" className="destino-tactil -ml-1 w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text"><ChevronLeft className="w-5 h-5" /></button>}
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-semibold text-digi-text truncate" title={titulo}>{sesionId ? titulo || 'Sesión' : 'Sesión nueva'}</h2>
          <p className="text-[11.5px] text-digi-muted truncate" title={carpeta}>
            {proyecto.nombre}{aislada && <> · Aislada</>}{!enEscritorio && modo !== 'bypassPermissions' && <> · {MODOS.find((m) => m.valor === modo)?.texto}</>}{tareas > 0 ? <> · <span className="text-accent">{tareas === 1 ? '1 tarea' : `${tareas} tareas`} en segundo plano</span></> : lineaEstado && <> · <span className={lineaEstado.clase}>{lineaEstado.texto}</span></>}{enTerminal && !estado && <> · <span className="text-amber-400">Abierta en una terminal</span></>}
          </p>
        </div>
        {(sesionId || !enEscritorio) && (
          <MenuMas className="max-lg:!border-0 max-lg:!w-9 max-lg:!h-9 max-lg:!min-w-9 max-lg:!min-h-9" items={[
            ...(enEscritorio ? [] : [{ label: 'Modelo y permisos', icon: SlidersHorizontal, onClick: () => setAjustes(true) }]),
            ...(!sesionId ? [] : [...(aislada ? [{ label: 'Quitar aislamiento', icon: LockOpen, onClick: () => setQuitarAislamiento(true) }] : []),
            { label: 'Cambiar nombre', icon: Pencil, onClick: () => setRenombrar(true) },
            { label: 'Abrir en Terminal', icon: SquareTerminal, onClick: () => terminal(true), disabled: trabajando, hint: 'Primero detén la sesión' },
            { label: 'Copiar comando de terminal', icon: Copy, onClick: () => terminal(false), disabled: trabajando, hint: 'Primero detén la sesión' },
            { label: 'Cerrar el proceso', icon: Power, onClick: () => { api(`/sesiones/${sesionId}/cerrar`, { cuerpo: {} }).then(() => { setEstado(null); alCambiar(); }); }, disabled: !estado }]),
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
            <ListaMensajes mensajes={mensajes} parcial={parcial} hijos={hijos} carpeta={proyecto.ruta} />
            {solicitudes.map((s) => <TarjetaSolicitud key={s.solicitudId} s={s} responder={responder} />)}
            {trabajando && !parcial && !solicitudes.length && <p className="flex items-center gap-2 text-[12.5px] text-accent"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Trabajando</p>}
            {tareas > 0 && !trabajando && <p className="flex items-center gap-2 text-[12.5px] text-accent"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {tareas === 1 ? 'Una tarea sigue' : `${tareas} tareas siguen`} en segundo plano. Claude retomará al terminar.</p>}
            {enCola.length > 0 && (
              <div className="min-w-0">
                <div className="opacity-60"><ListaMensajes mensajes={enCola} parcial="" hijos={{}} carpeta={proyecto.ruta} /></div>
                <p className="text-right text-[11.5px] text-digi-muted mt-1">En cola</p>
              </div>
            )}
            {fin && !trabajando && !tareas && <p className={`text-[11.5px] tabular-nums ${fin.ok || fin.detenida ? 'text-digi-muted' : 'text-red-400'}`}>{fin.detenida ? 'Detenida' : fin.ok ? `Terminó en ${segundos(fin.duracion)}` : `Terminó con error: ${fin.error || 'sin detalle'}`}</p>}
            {error && <p className={`rounded-lg border p-3 text-[13px] ${TONO.error.caja} ${TONO.error.texto}`}>{error}</p>}
          </div>
        </div>
        {lejos && <button type="button" onClick={() => { pegado.current = true; bajar(true); }} aria-label="Ir al final" title="Ir al final" className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-digi-card border border-digi-border shadow flex items-center justify-center text-digi-muted hover:text-digi-text"><ArrowDown className="w-4 h-4" /></button>}
      </div>

      <div className="max-lg:pb-[var(--seguro-abajo)] bg-digi-card">
        <Compositor key={sesionId || 'nueva'} proyectoId={proyecto.id} trabajando={trabajando} detenible={trabajando || estado === 'espera' || tareas > 0} sesionId={sesionId} modelo={modelo} modo={modo} enEscritorio={enEscritorio}
          alCambiarModelo={(m) => { setModelo(m); ajustar({ modelo: m }); }}
          alCambiarModo={(m) => { setModo(m); ajustar({ modo: m }); }}
          alEnviar={mandar}
          alDetener={() => { if (sesionId) api(`/sesiones/${sesionId}/detener`, { cuerpo: {} }).catch((e) => setError(e.message)); }}
          alLimpiar={alNueva} />
      </div>

      <PixelConfirm open={!!confirmar} title="Abierta en una terminal"
        message="Esta sesión sigue abierta en una terminal. Si escribes aquí también, cada parte dejará de ver lo que hace la otra. Lo seguro es cerrarla allí primero."
        confirmLabel="Enviar de todos modos" cancelLabel="Cancelar" danger onConfirm={() => confirmar?.()} onCancel={() => setConfirmar(null)} />
      <PixelConfirm open={quitarAislamiento} title="Quitar aislamiento"
        message="Esta sesión nació de un mensaje de un cliente. Sin aislamiento tendrá acceso completo a tu Mac, y es mejor hacerlo después de revisar lo que escribió ese cliente."
        confirmLabel="Quitar aislamiento" cancelLabel="Cancelar" danger
        onConfirm={() => { setQuitarAislamiento(false); api(`/sesiones/${sesionId}/sin-aislamiento`, { cuerpo: {} }).then(() => { setAislada(false); setEstado(null); fuente.current?.(); fuente.current = null; }).catch((e) => setError(e.message)); }}
        onCancel={() => setQuitarAislamiento(false)} />
      <RenombrarSesion sesion={renombrar && sesionId ? { id: sesionId, proyecto: proyecto.id, titulo } : null} alCerrar={() => setRenombrar(false)} />
      <PixelModal open={ajustes} onClose={() => setAjustes(false)} title="Modelo y permisos" size="sm">
        <SelectoresSesion sesionId={sesionId} modelo={modelo} modo={modo} columna
          alCambiarModelo={(m) => { setModelo(m); ajustar({ modelo: m }); }}
          alCambiarModo={(m) => { setModo(m); ajustar({ modo: m }); }} />
      </PixelModal>
      <PixelModal open={!!comando} onClose={() => setComando('')} title="Comando copiado" size="sm">
        <pre className="text-[12px] font-mono whitespace-pre-wrap break-all rounded-md bg-digi-darker p-2.5 text-digi-text">{comando}</pre>
      </PixelModal>
    </section>
  );
}
