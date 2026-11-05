'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, Eye, ExternalLink, Flag, LocateFixed, MapPin, Menu, Mic, Phone, Shield, ShieldAlert, Siren, Users } from 'lucide-react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import Interruptor from '@/components/ui/Interruptor';
import PieAcciones from '@/components/ui/PieAcciones';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelModal from '@/components/ui/PixelModal';
import MenuMas from '@/components/ui/MenuMas';
import PanelMapa from '@/components/centralized/control-psicosocial/PanelMapa';
import MapaMiembros from '@/components/centralized/control-psicosocial/MapaMiembros';
import MapaElegirPunto from '@/components/centralized/control-psicosocial/MapaElegirPunto';
import BotonEditar from '@/components/ui/BotonEditar';
import { EDIT_INPUT, EditField } from '@/components/ui/EditDialog';
import { useSondeo } from '@/lib/hooks/useSondeo';
import { fmtInt } from '@/lib/format';
import {
  CONSENTIMIENTO, ZONA_HORARIA, diasConHistorial, estadoSenal, type EstadoSenal, type FilaRastreo, type FuncionCp,
  type Lugar, type RecorridoMiembro,
} from '@/lib/centralized/control-psicosocial';
import {
  apagarProteccionNativa, appSinRastreo, configurarNativo, enviarPosicionAhora, estadoNativo, pedirPermisosNativos,
  plataformaNativa, type EstadoNativo,
} from '@/lib/movil/control-psicosocial';

const mf = { fontFamily: 'var(--font-body)' } as const;
const API = '/api/centralized/control-psicosocial';

type Estado = {
  user_id: string;
  es_admin: boolean;
  ubicacion_activa: boolean;
  ubicacion_al_dia: boolean;
  voz_activa: boolean;
  mi_alerta_id: number | null;
  filas: FilaRastreo[];
  accesos: { nombre: string; creado_en: string }[];
  lugares: Lugar[];
};
type Vista = 'miembros' | 'recorrido' | 'lugares' | 'proteccion' | 'accesos';
type FormLugar = { id: number | null; nombre: string; radio: string; lat: number | null; lng: number | null };
type Detalle = FilaRastreo & {
  alerta: { id: number; origen: 'boton' | 'voz'; lat: number | null; lng: number | null; creada_en: string } | null;
  recorrido: { lat: number; lng: number; precision_m: number | null; registrada_en: string }[];
};

const SENAL: Record<EstadoSenal, { texto: string; clase: string }> = {
  auxilio: { texto: 'Pide auxilio', clase: 'text-red-400 font-semibold' },
  activa: { texto: 'Señal activa', clase: 'text-green-400' },
  sin_senal: { texto: 'Sin señal', clase: 'text-amber-400' },
  no_comparte: { texto: 'No comparte', clase: 'text-digi-muted' },
};

const fecha = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—');

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-EC', { timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit' });

function etiquetaDia(dia: string, i: number) {
  if (i === 0) return 'Hoy';
  if (i === 1) return 'Ayer';
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' });
}

/** Pedir la posición no puede retrasar un auxilio: pasados 3 s, se envía sin ella. */
function posicionRapida(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return; }
    const corte = setTimeout(() => resolve(null), 3000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(corte); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(corte); resolve(null); },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 60_000 },
    );
  });
}

export default function ControlPsicosocialSystem() {
  const params = useSearchParams();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState('');
  const [plataforma, setPlataforma] = useState<'android' | 'ios' | null>(null);
  const [nativo, setNativo] = useState<EstadoNativo | null>(null);
  const [sinRastreo, setSinRastreo] = useState(false);
  const [consentir, setConsentir] = useState<FuncionCp | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarAuxilio, setConfirmarAuxilio] = useState(false);
  const [elegido, setElegido] = useState<string | null>(params.get('miembro'));
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  // El mapa llega justo hasta el pie, en cualquier ancho. Se mide en vez de usar `useAltoHastaElPie`
  // porque aquel descuenta el relleno de `main`, y aquí ese relleno se anula para ir de borde a borde.
  const [alto, setAlto] = useState<number | null>(null);
  const nodoMapa = useRef<HTMLDivElement | null>(null);
  const medirAlto = useCallback(() => {
    if (!nodoMapa.current) return;
    const pie = document.querySelector('[data-app-footer]')?.getBoundingClientRect().top ?? window.innerHeight;
    setAlto(Math.floor(pie - nodoMapa.current.getBoundingClientRect().top));
  }, []);
  // Se repite al acabar la animación de entrada de la página: durante ella, todo está desplazado.
  const refAlto = useCallback((n: HTMLDivElement | null) => {
    nodoMapa.current = n;
    medirAlto();
    if (n) window.setTimeout(medirAlto, 400);
  }, [medirAlto]);
  useEffect(() => {
    window.addEventListener('resize', medirAlto);
    return () => window.removeEventListener('resize', medirAlto);
  }, [medirAlto]);
  const dias = useMemo(() => diasConHistorial(), []);
  const [dia, setDia] = useState(dias[0]);
  const [recorridos, setRecorridos] = useState<RecorridoMiembro[]>([]);
  // La opción abierta desde «Más». Un miembro elegido se abre encima y la flecha vuelve a ella.
  const [vista, setVista] = useState<Vista | null>(null);
  const [enfocar, setEnfocar] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const [formLugar, setFormLugar] = useState<FormLugar | null>(null);
  const [borrarLugar, setBorrarLugar] = useState<Lugar | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch(API, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || 'No se pudo cargar el rastreo'); return; }
    setError('');
    setEstado(j.data);
    setNativo(await estadoNativo().catch(() => null));
  }, []);

  const cargarDetalle = useCallback(async () => {
    if (!elegido) { setDetalle(null); return; }
    const r = await fetch(`${API}/miembros/${elegido}`, { cache: 'no-store' });
    if (r.status === 404 || r.status === 403) { setElegido(null); setDetalle(null); return; }
    if (r.ok) setDetalle((await r.json()).data);
  }, [elegido]);

  const cargarRecorridos = useCallback(async () => {
    const r = await fetch(`${API}/recorridos?dia=${dia}`, { cache: 'no-store' });
    if (r.ok) setRecorridos((await r.json()).data);
  }, [dia]);

  useEffect(() => { cargarRecorridos(); }, [cargarRecorridos]);
  useSondeo(cargarRecorridos, 60_000);

  useEffect(() => { cargar(); plataformaNativa().then(setPlataforma); appSinRastreo().then(setSinRastreo); }, [cargar]);
  useEffect(() => { setDetalle(null); cargarDetalle(); }, [cargarDetalle]);
  useSondeo(cargar, 15_000);
  useSondeo(cargarDetalle, 15_000, !!elegido);

  /** Aplica en el teléfono lo que ya se aceptó, con la llave si aún no la tiene. */
  const aplicarEnTelefono = useCallback(async (ubicacion: boolean, voz: boolean) => {
    if (!estado || !plataforma) return;
    const n = await estadoNativo();
    let token: string | undefined;
    if (!n?.tieneLlave) {
      const r = await fetch(`${API}/dispositivo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plataforma }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo registrar este teléfono');
      token = (await r.json()).token;
    }
    await configurarNativo(estado.user_id, ubicacion, voz, token);
  }, [estado, plataforma]);

  const guardarConsentimiento = async (funcion: FuncionCp, activo: boolean) => {
    const r = await fetch(`${API}/consentimiento`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funcion, activo, plataforma }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo guardar');
  };

  const aceptar = async () => {
    if (!consentir || !estado) return;
    setOcupado(true);
    try {
      const permisos = await pedirPermisosNativos(consentir === 'ubicacion', consentir === 'voz');
      if (consentir === 'ubicacion' && permisos?.ubicacion === 'denegado') throw new Error('El teléfono no dio permiso de ubicación.');
      if (consentir === 'voz' && permisos?.voz === 'denegado') throw new Error('El teléfono no dio permiso de micrófono.');
      await guardarConsentimiento(consentir, true);
      await aplicarEnTelefono(
        consentir === 'ubicacion' || estado.ubicacion_activa,
        consentir === 'voz' || estado.voz_activa,
      );
      if (consentir === 'ubicacion' && permisos?.ubicacion === 'en_uso') {
        toast.warning('Elige «Permitir siempre» en los ajustes del teléfono, o se detendrá al cerrar la app.');
      }
      setConsentir(null);
      await cargar();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo activar');
    } finally {
      setOcupado(false);
    }
  };

  const apagar = async (funcion: FuncionCp) => {
    if (!estado) return;
    setOcupado(true);
    try {
      await guardarConsentimiento(funcion, false);
      const ubicacion = funcion === 'ubicacion' ? false : estado.ubicacion_activa;
      const voz = funcion === 'voz' ? false : estado.voz_activa;
      if (ubicacion || voz) await aplicarEnTelefono(ubicacion, voz);
      else await apagarProteccionNativa();
      await cargar();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo apagar');
    } finally {
      setOcupado(false);
    }
  };

  const guardarLugar = async () => {
    if (!formLugar) return;
    if (!formLugar.nombre.trim()) { toast.error('Escribe el nombre del lugar.'); return; }
    if (formLugar.lat == null || formLugar.lng == null) { toast.error('Toca el mapa para marcar el punto.'); return; }
    setOcupado(true);
    try {
      const r = await fetch(formLugar.id ? `${API}/lugares/${formLugar.id}` : `${API}/lugares`, {
        method: formLugar.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: formLugar.nombre, lat: formLugar.lat, lng: formLugar.lng, radio_m: Number(formLugar.radio) }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo guardar');
      setFormLugar(null);
      await cargar();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const confirmarBorrarLugar = async () => {
    if (!borrarLugar) return;
    const id = borrarLugar.id;
    setBorrarLugar(null);
    setOcupado(true);
    try {
      const r = await fetch(`${API}/lugares/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo borrar');
      setFormLugar(null);
      await Promise.all([cargar(), cargarRecorridos()]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const pedirAuxilio = async () => {
    setConfirmarAuxilio(false);
    setOcupado(true);
    try {
      const punto = await posicionRapida();
      const r = await fetch(`${API}/alertas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen: 'boton', lat: punto?.lat ?? null, lng: punto?.lng ?? null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar');
      if (j.repetida) toast.info('Tu auxilio ya está activo.');
      else if (!j.con_telefono) toast.warning('Ningún otro miembro tiene un teléfono registrado. Llama al 911.');
      else toast.success(`Auxilio enviado a ${fmtInt(j.con_telefono)} de ${fmtInt(j.destinatarios)} miembros.`);
      await enviarPosicionAhora().catch(() => {});
      await cargar();
    } catch (e: any) {
      toast.error(`${e.message || 'No se pudo enviar el auxilio'}. Llama al 911.`);
    } finally {
      setOcupado(false);
    }
  };

  const cerrarAuxilio = async (id: number, motivo: 'resuelta' | 'falsa') => {
    setOcupado(true);
    try {
      const r = await fetch(`${API}/alertas/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo cerrar');
      await Promise.all([cargar(), cargarDetalle()]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setOcupado(false);
    }
  };


  if (error && !estado) {
    return <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center text-[13px] text-digi-muted" style={mf}>{error}</div>;
  }
  if (!estado) return <div className="py-12 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>;

  const puedeCerrar = detalle?.alerta && (estado.es_admin || detalle.user_id === estado.user_id);
  const punto = detalle
    ? (detalle.lat != null && detalle.lng != null ? { lat: detalle.lat, lng: detalle.lng }
      : detalle.alerta?.lat != null && detalle.alerta?.lng != null ? { lat: detalle.alerta.lat, lng: detalle.alerta.lng } : null)
    : null;
  const miRecorrido = detalle ? recorridos.find((r) => r.user_id === detalle.user_id) : undefined;
  const miPunto = estado.filas.find((f) => f.user_id === estado.user_id && f.lat != null);
  const inicioMapa: [number, number] = miPunto
    ? [miPunto.lat!, miPunto.lng!]
    : estado.lugares[0] ? [estado.lugares[0].lat, estado.lugares[0].lng] : [-2.17, -79.92];
  const nombreDia = etiquetaDia(dia, dias.indexOf(dia));
  const hayAuxilioAjeno = estado.filas.filter((f) => f.alerta_id && f.user_id !== estado.user_id).length;

  const panelDetalle = detalle && {
    titulo: detalle.nombre,
    subtitulo: <span className={SENAL[estadoSenal(detalle)].clase}>{SENAL[estadoSenal(detalle)].texto}</span>,
    pie: puedeCerrar ? (
      <PieAcciones>
        <button className={BTN_SECONDARY} disabled={ocupado} onClick={() => cerrarAuxilio(detalle.alerta!.id, 'falsa')}>Falsa alarma</button>
        <button className={BTN_PRIMARY} disabled={ocupado} onClick={() => cerrarAuxilio(detalle.alerta!.id, 'resuelta')}>Resuelta</button>
      </PieAcciones>
    ) : undefined,
    cuerpo: (
      <div className="space-y-3 text-[13px]">
        {punto ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${punto.lat},${punto.lng}`}
            target="_blank" rel="noreferrer"
            className={`${BTN_SECONDARY} w-full`}
          >
            <ExternalLink className="w-4 h-4" /> Abrir en Google Maps
          </a>
        ) : <p className="text-digi-muted">Sin ubicación registrada.</p>}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div><dt className="text-[11px] text-digi-muted">Última señal</dt><dd className="text-digi-text">{fecha(detalle.registrada_en)}</dd></div>
          <div><dt className="text-[11px] text-digi-muted">Lugar</dt><dd className="text-digi-text truncate">{detalle.lugar_actual || '—'}</dd></div>
          <div><dt className="text-[11px] text-digi-muted">Precisión</dt><dd className="text-digi-text">{detalle.precision_m == null ? '—' : `${fmtInt(detalle.precision_m)} m`}</dd></div>
          <div><dt className="text-[11px] text-digi-muted">Batería</dt><dd className="text-digi-text">{detalle.bateria == null ? '—' : `${fmtInt(detalle.bateria)} %`}</dd></div>
          {detalle.alerta && (
            <div className="col-span-2"><dt className="text-[11px] text-digi-muted">Auxilio desde</dt><dd className="text-digi-text">{fecha(detalle.alerta.creada_en)} · {detalle.alerta.origen === 'voz' ? 'voz' : 'botón'}</dd></div>
          )}
        </dl>
        {miRecorrido && miRecorrido.visitas.length > 0 && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wide text-digi-muted mb-1">Llegadas y salidas · {nombreDia}</h4>
            <ul className="divide-y divide-digi-border">
              {miRecorrido.visitas.map((v) => (
                <li key={`${v.lugar}-${v.llegada_en}`} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate min-w-0 text-digi-text" title={v.lugar}>{v.lugar}</span>
                  <span className="shrink-0 text-[12px] text-digi-muted">{hora(v.llegada_en)} – {v.salida_en ? hora(v.salida_en) : 'sigue allí'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {detalle.recorrido.length > 0 && (
          <div>
            <h4 className="text-[11px] uppercase tracking-wide text-digi-muted mb-1">Recorrido del auxilio</h4>
            <ul className="divide-y divide-digi-border">
              {detalle.recorrido.slice(0, 20).map((p) => (
                <li key={p.registrada_en}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-between gap-2 py-1.5 text-digi-text hover:text-accent"
                  >
                    <span>{fecha(p.registrada_en)}</span>
                    <span className="text-[11px] text-digi-muted">{p.precision_m == null ? '' : `${fmtInt(p.precision_m)} m`}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    ),
  };

  const paneles: Record<Vista, { titulo: string; subtitulo?: string; pie?: React.ReactNode; cuerpo: React.ReactNode }> = {
    miembros: {
      titulo: 'Miembros',
      subtitulo: `${fmtInt(estado.filas.length)} ${estado.filas.length === 1 ? 'miembro' : 'miembros'}`,
      cuerpo: (
        <ul className="-my-1 divide-y divide-digi-border">
          {estado.filas.map((f) => {
            const e = estadoSenal(f);
            const lugar = e === 'activa' || e === 'auxilio' ? f.lugar_actual : null;
            return (
              <li key={f.user_id}>
                <button onClick={() => setElegido(f.user_id)} className="w-full min-h-12 py-2 text-left hover:text-accent">
                  <span className="block truncate text-[13px] font-medium text-digi-text" title={f.nombre}>{f.nombre}</span>
                  <span className="flex items-center justify-between gap-2 text-[12px]">
                    <span className={`truncate ${SENAL[e].clase}`}>{SENAL[e].texto}{lugar ? ` · ${lugar}` : ''}</span>
                    <span className="shrink-0 text-digi-muted">{fecha(f.registrada_en)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ),
    },
    recorrido: {
      titulo: 'Recorrido',
      cuerpo: (
        <ul className="-my-1 divide-y divide-digi-border" role="radiogroup" aria-label="Día del recorrido">
          {dias.map((d, i) => (
            <li key={d}>
              <button
                role="radio" aria-checked={d === dia}
                onClick={() => { setDia(d); setVista(null); }}
                className={`w-full min-h-11 text-left text-[13px] ${d === dia ? 'font-semibold text-accent' : 'text-digi-text hover:text-accent'}`}
              >
                {etiquetaDia(d, i)}
              </button>
            </li>
          ))}
        </ul>
      ),
    },
    lugares: {
      titulo: 'Lugares',
      pie: estado.es_admin ? (
        <PieAcciones>
          <button className={BTN_PRIMARY} onClick={() => setFormLugar({ id: null, nombre: '', radio: '150', lat: null, lng: null })}>Nuevo lugar</button>
        </PieAcciones>
      ) : undefined,
      cuerpo: estado.lugares.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-digi-muted">Todavía no hay puntos de reunión.</p>
      ) : (
        <ul className="-my-1 divide-y divide-digi-border">
          {estado.lugares.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <button
                onClick={() => { setEnfocar({ lat: l.lat, lng: l.lng, n: Date.now() }); setVista(null); }}
                className="flex-1 min-w-0 min-h-12 py-2 text-left hover:text-accent"
              >
                <span className="block truncate text-[13px] font-medium text-digi-text" title={l.nombre}>{l.nombre}</span>
                <span className="block text-[12px] text-digi-muted">Radio de {fmtInt(l.radio_m)} m</span>
              </button>
              {estado.es_admin && (
                <BotonEditar
                  etiqueta={`Editar ${l.nombre}`}
                  onClick={() => setFormLugar({ id: l.id, nombre: l.nombre, radio: String(l.radio_m), lat: l.lat, lng: l.lng })}
                />
              )}
            </li>
          ))}
        </ul>
      ),
    },
    proteccion: {
      titulo: 'Mi protección',
      cuerpo: (
        <div className="space-y-3">
          {plataforma ? (
            <div className="-my-1 divide-y divide-digi-border">
              {([['ubicacion', MapPin, estado.ubicacion_activa], ['voz', Mic, estado.voz_activa]] as const).map(([f, Icono, activo]) => (
                <div key={f} className="flex items-center gap-2.5 min-h-12">
                  <Icono className="w-4 h-4 text-digi-muted shrink-0" />
                  <span className="flex-1 min-w-0 text-[13px] text-digi-text">{CONSENTIMIENTO[f].titulo}</span>
                  <Interruptor activo={activo} disabled={ocupado} etiqueta={CONSENTIMIENTO[f].titulo} onChange={(v) => (v ? setConsentir(f) : apagar(f))} />
                </div>
              ))}
              {estado.voz_activa && nativo?.problemaVoz && <p className="py-2 text-[12px] text-amber-400">{nativo.problemaVoz}</p>}
            </div>
          ) : (
            <p className="text-[13px] text-digi-muted">
              {sinRastreo ? 'Esta instalación de la app no trae el rastreo. Hay que actualizarla.' : 'La ubicación y la voz se activan desde la app del teléfono.'}
            </p>
          )}
        </div>
      ),
    },
    accesos: {
      titulo: 'Quién vio mi ubicación',
      cuerpo: estado.accesos.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-digi-muted">Nadie todavía.</p>
      ) : (
        <ul className="-my-1 divide-y divide-digi-border">
          {estado.accesos.map((a) => (
            <li key={`${a.nombre}-${a.creado_en}`} className="flex items-center justify-between gap-2 py-2 text-[13px]">
              <span className="truncate min-w-0 text-digi-text" title={a.nombre}>{a.nombre}</span>
              <span className="shrink-0 text-[12px] text-digi-muted">{fecha(a.creado_en)}</span>
            </li>
          ))}
        </ul>
      ),
    },
  };

  const panelAbierto = panelDetalle || (vista ? paneles[vista] : null);
  const FLOTANTE = 'cp-opaco shadow-md';

  return (
    // De borde a borde: los márgenes negativos anulan el relleno de `main`, también el de abajo.
    <div
      ref={refAlto}
      style={{ height: alto ?? undefined, marginBottom: 'calc(-1 * (var(--pie-panel) + 1.25rem))' }}
      className="relative overflow-hidden -mx-4 -mt-4 md:-mx-6 md:-mt-6"
    >
      <MapaMiembros
        filas={estado.filas}
        lugares={estado.lugares}
        recorridos={recorridos}
        elegido={elegido}
        onElegir={setElegido}
        panelAbierto={!!panelAbierto}
        enfocar={enfocar}
        className="absolute inset-0"
      />

      {/* Arriba: el día que se está viendo y solo los avisos que piden algo. */}
      <div className="absolute z-10 left-2 right-2 top-2 md:right-auto md:w-80 space-y-2 pointer-events-none" style={mf}>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/centralized"
            aria-label="Volver a Centralizado"
            title="Volver a Centralizado"
            className={`pointer-events-auto w-9 h-9 inline-flex items-center justify-center rounded-md border border-digi-border text-digi-text hover:text-accent ${FLOTANTE}`}
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <button
            onClick={() => { setElegido(null); setVista('recorrido'); }}
            className={`pointer-events-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-digi-border text-[13px] font-medium text-digi-text ${FLOTANTE}`}
          >
            <CalendarDays className="w-4 h-4 text-digi-muted" /> Recorrido: {nombreDia}
          </button>
        </div>
        {estado.mi_alerta_id && (
          <div className={`pointer-events-auto rounded-md border border-red-400/60 p-3 ${FLOTANTE}`}>
            <p className="text-[13px] font-semibold text-red-400 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Tu auxilio está activo</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button className={BTN_SECONDARY} disabled={ocupado} onClick={() => cerrarAuxilio(estado.mi_alerta_id!, 'falsa')}>Falsa alarma</button>
              <button className={BTN_PRIMARY} disabled={ocupado} onClick={() => cerrarAuxilio(estado.mi_alerta_id!, 'resuelta')}>Resuelta</button>
            </div>
          </div>
        )}
        {hayAuxilioAjeno > 0 && !elegido && (
          <button
            onClick={() => setElegido(estado.filas.find((f) => f.alerta_id && f.user_id !== estado.user_id)!.user_id)}
            className={`pointer-events-auto w-full flex items-center gap-1.5 rounded-md border border-red-400/60 p-3 text-left text-[13px] font-semibold text-red-400 ${FLOTANTE}`}
          >
            <Siren className="w-4 h-4 shrink-0" />
            <span className="truncate">{estado.filas.find((f) => f.alerta_id && f.user_id !== estado.user_id)!.nombre} pide auxilio</span>
          </button>
        )}
        {estado.ubicacion_activa && !estado.ubicacion_al_dia && (
          <div className={`pointer-events-auto flex items-center gap-2 rounded-md border border-amber-400/60 py-1.5 pl-3 pr-1.5 ${FLOTANTE}`}>
            <p className="flex-1 min-w-0 text-[13px] text-digi-text">Cambió lo que se comparte</p>
            <button className={`${BTN_SECONDARY} shrink-0 !min-h-9 !py-1`} disabled={ocupado} onClick={() => setConsentir('ubicacion')}>Revisar</button>
          </div>
        )}
      </div>

      {/* Abajo: la emergencia siempre a un toque; todo lo demás, dentro de «Más». */}
      <div className="absolute z-10 left-2 right-2 bottom-2 md:right-auto flex items-center gap-2" style={mf}>
        <button
          className={`${BTN_DANGER} ${FLOTANTE} flex-1 md:flex-none min-h-[52px] md:min-h-11 font-semibold`}
          disabled={ocupado || !!estado.mi_alerta_id}
          onClick={() => setConfirmarAuxilio(true)}
        >
          <Siren className="w-4 h-4" /> Pedir auxilio
        </button>
        <a href="tel:911" className={`${BTN_SECONDARY} ${FLOTANTE} min-h-[52px] md:min-h-11 font-semibold`}>
          <Phone className="w-4 h-4" /> 911
        </a>
        <MenuMas
          label="Más opciones"
          boton={{ texto: 'Más', icon: Menu, className: `${BTN_SECONDARY} ${FLOTANTE} min-h-[52px] md:min-h-11 font-semibold` }}
          items={[
            { label: 'Miembros', icon: Users, onClick: () => { setElegido(null); setVista('miembros'); } },
            { label: 'Recorrido', icon: CalendarDays, onClick: () => { setElegido(null); setVista('recorrido'); } },
            { label: 'Lugares', icon: Flag, onClick: () => { setElegido(null); setVista('lugares'); } },
            { label: 'Mi protección', icon: Shield, onClick: () => { setElegido(null); setVista('proteccion'); } },
            { label: 'Quién vio mi ubicación', icon: Eye, onClick: () => { setElegido(null); setVista('accesos'); } },
          ]}
        />
      </div>

      <PanelMapa
        contenido={panelAbierto || null}
        onCerrar={() => { setElegido(null); setVista(null); }}
        onVolver={panelDetalle && vista === 'miembros' ? () => setElegido(null) : undefined}
      />

      <PixelModal
        open={!!consentir}
        onClose={() => setConsentir(null)}
        busy={ocupado}
        title={consentir ? CONSENTIMIENTO[consentir].titulo : ''}
        size="md"
        pie={consentir ? (
          <PieAcciones>
            <button className={BTN_SECONDARY} disabled={ocupado} onClick={() => setConsentir(null)}>No acepto</button>
            <button className={BTN_PRIMARY} disabled={ocupado} onClick={aceptar}>{CONSENTIMIENTO[consentir].aceptar}</button>
          </PieAcciones>
        ) : undefined}
      >
        {consentir && (
          <ul className="list-disc pl-5 space-y-2 text-[13px] text-digi-text" style={mf}>
            {CONSENTIMIENTO[consentir].puntos.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </PixelModal>

      <PixelModal
        open={!!formLugar}
        onClose={() => setFormLugar(null)}
        busy={ocupado}
        title={formLugar?.id ? 'Editar lugar' : 'Nuevo lugar'}
        size="md"
        pie={formLugar ? (
          <PieAcciones
            onEliminar={formLugar.id ? () => setBorrarLugar(estado.lugares.find((l) => l.id === formLugar.id) ?? null) : undefined}
            etiquetaEliminar="Eliminar lugar"
          >
            <button className={BTN_SECONDARY} disabled={ocupado} onClick={() => setFormLugar(null)}>Cancelar</button>
            <button className={BTN_PRIMARY} disabled={ocupado} onClick={guardarLugar}>Guardar</button>
          </PieAcciones>
        ) : undefined}
      >
        {formLugar && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_140px] gap-3">
              <EditField label="Nombre">
                <input className={EDIT_INPUT} maxLength={80} value={formLugar.nombre} onChange={(e) => setFormLugar({ ...formLugar, nombre: e.target.value })} />
              </EditField>
              <EditField label="Radio en metros">
                <input className={EDIT_INPUT} type="number" inputMode="numeric" min={30} max={5000} step={10} value={formLugar.radio} onChange={(e) => setFormLugar({ ...formLugar, radio: e.target.value })} />
              </EditField>
            </div>
            <div className="flex items-center justify-between gap-2" style={mf}>
              <span className="text-[12px] font-semibold text-digi-text opacity-70">Punto en el mapa</span>
              {miPunto && (
                <button className={BTN_SECONDARY} onClick={() => setFormLugar({ ...formLugar, lat: miPunto.lat, lng: miPunto.lng })}>
                  <LocateFixed className="w-4 h-4" /> Mi ubicación
                </button>
              )}
            </div>
            <MapaElegirPunto
              lat={formLugar.lat}
              lng={formLugar.lng}
              radio={Number(formLugar.radio) || 0}
              inicio={inicioMapa}
              onCambiar={(lat, lng) => setFormLugar((f) => (f ? { ...f, lat, lng } : f))}
            />
          </div>
        )}
      </PixelModal>

      <PixelConfirm
        open={!!borrarLugar}
        title="Eliminar lugar"
        message={`Se borrará «${borrarLugar?.nombre ?? ''}» y sus llegadas y salidas registradas.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmarBorrarLugar}
        onCancel={() => setBorrarLugar(null)}
      />

      <PixelConfirm
        open={confirmarAuxilio}
        title="Pedir auxilio"
        message="Todos los miembros recibirán una alerta con tu ubicación."
        confirmLabel="Enviar auxilio"
        danger
        onConfirm={pedirAuxilio}
        onCancel={() => setConfirmarAuxilio(false)}
      />
    </div>
  );
}
