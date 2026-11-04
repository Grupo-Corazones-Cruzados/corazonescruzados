'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, MapPin, Mic, Phone, ShieldAlert, Siren } from 'lucide-react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import Interruptor from '@/components/ui/Interruptor';
import PanelDetalle from '@/components/ui/PanelDetalle';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PieAcciones from '@/components/ui/PieAcciones';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
import MapaMiembros from '@/components/centralized/control-psicosocial/MapaMiembros';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import { useSondeo } from '@/lib/hooks/useSondeo';
import { fmtInt } from '@/lib/format';
import {
  CONSENTIMIENTO, estadoSenal, type EstadoSenal, type FilaRastreo, type FuncionCp,
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
  voz_activa: boolean;
  mi_alerta_id: number | null;
  filas: FilaRastreo[];
  accesos: { nombre: string; creado_en: string }[];
};
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
  const conColumna = useConsultaMedia(PANTALLA_XL);

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

  const columnas = useMemo(() => [
    {
      key: 'miembro', header: 'Miembro', width: '28%',
      render: (f: FilaRastreo) => <span className="block truncate font-medium text-digi-text" title={f.nombre}>{f.nombre}</span>,
    },
    {
      key: 'estado', header: 'Estado', width: '18%',
      render: (f: FilaRastreo) => { const s = SENAL[estadoSenal(f)]; return <span className={s.clase}>{s.texto}</span>; },
    },
    { key: 'senal', header: 'Última señal', width: '28%', render: (f: FilaRastreo) => fecha(f.registrada_en) },
    {
      key: 'precision', header: 'Precisión', width: '13%',
      render: (f: FilaRastreo) => (f.precision_m == null ? '—' : `${fmtInt(f.precision_m)} m`),
    },
    {
      key: 'bateria', header: 'Batería', width: '13%',
      render: (f: FilaRastreo) => (f.bateria == null ? '—' : `${fmtInt(f.bateria)} %`),
    },
  ], []);

  if (error && !estado) {
    return <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center text-[13px] text-digi-muted" style={mf}>{error}</div>;
  }
  if (!estado) return <div className="py-12 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>;

  const puedeCerrar = detalle?.alerta && (estado.es_admin || detalle.user_id === estado.user_id);
  const punto = detalle
    ? (detalle.lat != null && detalle.lng != null ? { lat: detalle.lat, lng: detalle.lng }
      : detalle.alerta?.lat != null && detalle.alerta?.lng != null ? { lat: detalle.alerta.lat, lng: detalle.alerta.lng } : null)
    : null;

  const cuerpoDetalle = detalle && (
    <div className="space-y-3 text-[13px]" style={mf}>
      <p className={SENAL[estadoSenal(detalle)].clase}>{SENAL[estadoSenal(detalle)].texto}</p>
      {punto ? (
        <>
          {!conColumna && <MapaMiembros filas={[{ ...detalle, lat: punto.lat, lng: punto.lng }]} elegido={detalle.user_id} className="h-64" />}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${punto.lat},${punto.lng}`}
            target="_blank" rel="noreferrer"
            className={`${BTN_SECONDARY} w-full`}
          >
            <ExternalLink className="w-4 h-4" /> Abrir en Google Maps
          </a>
        </>
      ) : <p className="text-digi-muted">Sin ubicación registrada.</p>}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div><dt className="text-[11px] text-digi-muted">Última señal</dt><dd className="text-digi-text">{fecha(detalle.registrada_en)}</dd></div>
        <div><dt className="text-[11px] text-digi-muted">Precisión</dt><dd className="text-digi-text">{detalle.precision_m == null ? '—' : `${fmtInt(detalle.precision_m)} m`}</dd></div>
        <div><dt className="text-[11px] text-digi-muted">Batería</dt><dd className="text-digi-text">{detalle.bateria == null ? '—' : `${fmtInt(detalle.bateria)} %`}</dd></div>
        {detalle.alerta && (
          <div><dt className="text-[11px] text-digi-muted">Auxilio desde</dt><dd className="text-digi-text">{fecha(detalle.alerta.creada_en)} · {detalle.alerta.origen === 'voz' ? 'voz' : 'botón'}</dd></div>
        )}
      </dl>
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
  );
  const pieDetalle = detalle && puedeCerrar ? (
    <PieAcciones>
      <button className={BTN_SECONDARY} disabled={ocupado} onClick={() => cerrarAuxilio(detalle.alerta!.id, 'falsa')}>Falsa alarma</button>
      <button className={BTN_PRIMARY} disabled={ocupado} onClick={() => cerrarAuxilio(detalle.alerta!.id, 'resuelta')}>Resuelta</button>
    </PieAcciones>
  ) : undefined;

  return (
    <div className={`grid gap-4 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] ${conColumna && detalle ? 'xl:grid-cols-[300px_minmax(0,1fr)_340px]' : ''}`}>
      <PanelHastaElPie desdeAncho={1024} className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4 space-y-4" >
        <div style={mf}>
          <h2 className="text-[14px] font-semibold text-digi-text mb-3">Rastreo</h2>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            <button
              className={`${BTN_DANGER} w-full min-h-12 font-semibold`}
              disabled={ocupado || !!estado.mi_alerta_id}
              onClick={() => setConfirmarAuxilio(true)}
            >
              <Siren className="w-4 h-4" /> Pedir auxilio
            </button>
            <a href="tel:911" className={`${BTN_SECONDARY} w-full min-h-12 font-semibold`}>
              <Phone className="w-4 h-4" /> Llamar al 911
            </a>
          </div>

          {estado.mi_alerta_id && (
            <div className="mt-3 rounded-md border border-red-400/40 p-3">
              <p className="text-[13px] font-semibold text-red-400 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Tu auxilio está activo</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button className={BTN_SECONDARY} disabled={ocupado} onClick={() => cerrarAuxilio(estado.mi_alerta_id!, 'falsa')}>Falsa alarma</button>
                <button className={BTN_PRIMARY} disabled={ocupado} onClick={() => cerrarAuxilio(estado.mi_alerta_id!, 'resuelta')}>Resuelta</button>
              </div>
            </div>
          )}
        </div>

        {plataforma ? (
          <div className="divide-y divide-digi-border border-y border-digi-border" style={mf}>
            {([['ubicacion', MapPin, estado.ubicacion_activa], ['voz', Mic, estado.voz_activa]] as const).map(([f, Icono, activo]) => (
              <div key={f} className="flex items-center gap-2.5 py-2.5">
                <Icono className="w-4 h-4 text-digi-muted shrink-0" />
                <span className="flex-1 min-w-0 text-[13px] text-digi-text">{CONSENTIMIENTO[f].titulo}</span>
                <Interruptor
                  activo={activo}
                  disabled={ocupado}
                  etiqueta={CONSENTIMIENTO[f].titulo}
                  onChange={(v) => (v ? setConsentir(f) : apagar(f))}
                />
              </div>
            ))}
            {estado.voz_activa && nativo?.problemaVoz && (
              <p className="py-2 text-[12px] text-amber-400">{nativo.problemaVoz}</p>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-digi-muted flex items-center gap-1.5" style={mf}>
            {sinRastreo ? 'Esta instalación de la app no trae el rastreo. Hay que actualizarla.' : 'La ubicación y la voz se activan desde la app del teléfono.'}
          </p>
        )}

        <div style={mf}>
          <h3 className="text-[11px] uppercase tracking-wide text-digi-muted mb-1">Quién vio mi ubicación</h3>
          {estado.accesos.length === 0 ? (
            <p className="text-[12px] text-digi-muted">Nadie todavía.</p>
          ) : (
            <ul className="divide-y divide-digi-border max-h-36 overflow-y-auto">
              {estado.accesos.map((a) => (
                <li key={`${a.nombre}-${a.creado_en}`} className="flex items-center justify-between gap-2 py-1.5 text-[12px]">
                  <span className="truncate min-w-0 text-digi-text" title={a.nombre}>{a.nombre}</span>
                  <span className="shrink-0 text-digi-muted">{fecha(a.creado_en)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PanelHastaElPie>

      <div className="min-w-0 space-y-4">
        <MapaMiembros
          filas={estado.filas}
          elegido={elegido}
          onElegir={setElegido}
          className="h-80 lg:h-[46dvh]"
        />
        <PixelDataTable
          columns={columnas}
          data={estado.filas}
          singleLine
          onRowClick={(f: FilaRastreo) => setElegido(f.user_id)}
          rowClassName={(f: FilaRastreo) => (f.user_id === elegido ? 'bg-accent-light' : '')}
          emptyTitle="Sin miembros"
          unidad={['miembro', 'miembros']}
        />
      </div>

      {detalle && conColumna && (
        <PanelDetalle
          titulo={detalle.nombre}
          icono={MapPin}
          subtitulo="Ubicación"
          onCerrar={() => setElegido(null)}
          pie={pieDetalle}
        >
          {cuerpoDetalle}
        </PanelDetalle>
      )}
      {!conColumna && (
        <PixelModal open={!!detalle} onClose={() => setElegido(null)} title={detalle?.nombre || 'Ubicación'} size="md" pie={pieDetalle}>
          {cuerpoDetalle}
        </PixelModal>
      )}

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
