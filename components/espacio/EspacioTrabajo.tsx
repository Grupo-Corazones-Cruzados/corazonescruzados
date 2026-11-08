'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FolderOpen, Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import Segmentado from '@/components/ui/Segmentado';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import { TONO } from '@/components/ui/tonos';
import RailProyectos from './RailProyectos';
import Conversacion from './Conversacion';
import Incidencias from './Incidencias';
import PanelProyecto from './PanelProyecto';
import PanelServidores from './PanelServidores';
import PanelFlujo from './flujo/PanelFlujo';
import PanelRecordatorios from './PanelRecordatorios';
import { api, EVENTO_ELIMINADA, type Proyecto, type Viva } from './api';

type Vista = 'sesiones' | 'incidencias' | 'servidores';

function Espacio() {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const enTelefono = !useConsultaMedia(PANTALLA_LG);
  const proyectoId = params.get('p');
  const sesionUrl = params.get('s');
  const desdeActivas = params.get('a') === '1';
  const v = params.get('v');
  const vista: Vista = v === 'incidencias' || (v === 'servidores' && enTelefono) ? v : 'sesiones';

  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [vivas, setVivas] = useState<Viva[]>([]);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [editar, setEditar] = useState<{ abierto: boolean; proyecto: Proyecto | null }>({ abierto: false, proyecto: null });

  const ir = useCallback((q: { p?: string; s?: string; v?: Vista; a?: boolean }, sustituir = false) => {
    const u = new URLSearchParams();
    if (q.v && q.v !== 'sesiones') u.set('v', q.v);
    if (q.p) u.set('p', q.p);
    if (q.s) u.set('s', q.s);
    if (q.a) u.set('a', '1');
    const destino = `${ruta}${u.size ? `?${u}` : ''}`;
    if (sustituir) router.replace(destino, { scroll: false }); else router.push(destino, { scroll: false });
  }, [router, ruta]);

  const cargarProyectos = useCallback(() => api('/proyectos').then((j) => { setProyectos(j.proyectos); setError(''); }).catch((e) => { setError(e.message); setProyectos((p) => p ?? []); }), []);
  useEffect(() => { cargarProyectos(); }, [cargarProyectos]);

  useEffect(() => {
    let vivo = true;
    const traer = () => api('/vivas').then((j) => { if (vivo) { setVivas(j.vivas); setError(''); } }).catch((e) => { if (vivo) setError(e.message); });
    traer();
    const t = setInterval(traer, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const refrescar = useCallback(() => setVersion((v) => v + 1), []);

  const proyecto = proyectos?.find((p) => p.id === proyectoId) || null;

  /* El diagrama se pide al abrirlo: uno de 360 nodos cuesta colocarlo y no hay por qué pagarlo al entrar a una sesión. */
  const [flujoId, setFlujoId] = useState<string | null>(null);
  const [flujoAbierto, setFlujoAbierto] = useState(false);
  const verFlujo = useCallback((p: string) => { setFlujoId(p); setFlujoAbierto(true); }, []);
  const [errorFlujo, setErrorFlujo] = useState('');
  useEffect(() => {
    if (!errorFlujo) return;
    const t = setTimeout(() => setErrorFlujo(''), 8000);
    return () => clearTimeout(t);
  }, [errorFlujo]);
  const proyectoFlujo = proyectos?.find((p) => p.id === flujoId) || null;
  const verSesion = useCallback((p: string, s: string) => { setFlujoAbierto(false); ir({ p, s }); }, [ir]);
  const actualizarFlujo = useCallback((p: string) => {
    setErrorFlujo('');
    api<{ id: string }>(`/proyectos/${p}/flujo`, { cuerpo: {} })
      .then((j) => { setFlujoId(p); verSesion(p, j.id); refrescar(); })
      .catch((e) => setErrorFlujo(e.message));
  }, [verSesion, refrescar]);
  const recordatorios = (plegado: boolean) => <PanelRecordatorios plegado={plegado} />;

  const espera = vivas.filter((v) => v.estado === 'espera').length;
  /* La que se está viendo y se elimina: en el teléfono se vuelve a la lista; en la Mac se queda en su proyecto. */
  useEffect(() => {
    const alEliminar = (e: Event) => { if ((e as CustomEvent).detail.id === sesionUrl) ir(enTelefono ? {} : { p: proyectoId || undefined, a: desdeActivas }, true); };
    window.addEventListener(EVENTO_ELIMINADA, alEliminar);
    return () => window.removeEventListener(EVENTO_ELIMINADA, alEliminar);
  }, [sesionUrl, proyectoId, desdeActivas, enTelefono, ir]);

  useEffect(() => { document.title = espera ? `(${espera}) Espacio de trabajo` : 'Espacio de trabajo'; }, [espera]);

  const pestanas = (
    <div className="shrink-0 px-2 py-1.5 lg:p-2 border-b border-digi-border">
      <Segmentado<Vista> etiqueta="Vista" className="w-full" valor={vista} onChange={(v) => ir({ v })} opciones={[
        { valor: 'sesiones', texto: 'Sesiones' }, { valor: 'incidencias', texto: 'Incidencias' },
        ...(enTelefono ? [{ valor: 'servidores' as const, texto: 'Servidores' }] : []),
      ]} />
    </div>
  );

  const rail = (
    <RailProyectos proyectos={proyectos || []} vivas={vivas} proyectoId={proyectoId} sesionId={sesionUrl} desdeActivas={desdeActivas} version={version}
      alElegir={(p, s) => ir({ p, s })} alElegirActiva={(p, s) => ir({ p, s, a: true })} alCerrada={(s) => { if (s === sesionUrl) ir({}); }} alNueva={(p) => ir({ p })} alEditar={(p) => setEditar({ abierto: true, proyecto: p })} alAgregar={() => setEditar({ abierto: true, proyecto: null })}
      alActualizarFlujo={actualizarFlujo} alVerFlujo={enTelefono ? verFlujo : undefined} />
  );

  const conversacion = proyecto ? (
    <Conversacion key={proyecto.id} proyecto={proyecto} sesionId={sesionUrl}
      alVolver={enTelefono ? () => ir({}) : undefined}
      alVerFlujo={() => verFlujo(proyecto.id)}
      alCrear={(id) => { ir({ p: proyecto.id, s: id, a: desdeActivas }, true); refrescar(); }}
      alNueva={() => ir({ p: proyecto.id, a: desdeActivas })}
      alCambiar={refrescar} />
  ) : null;

  const incidencias = <Incidencias cabecera={pestanas} proyectos={proyectos || []} enTelefono={enTelefono} alAbrirSesion={(p, s) => ir({ p, s })} />;

  let contenido;
  if (proyectos === null) contenido = <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>;
  else if (enTelefono) {
    /* Teléfono: lista → detalle. Se decide qué se MONTA, no se esconde con clases. */
    contenido = vista === 'sesiones' && conversacion ? conversacion : (
      vista === 'incidencias' ? incidencias : vista === 'servidores' ? <PanelServidores proyectoId={proyectoId} plegable={false} cabecera={pestanas} debajo={recordatorios} /> : <div className="flex flex-col h-full min-h-0">{pestanas}<div className="flex-1 min-h-0">{rail}</div></div>
    );
  } else {
    /* El panel de servidores se queda igual en Sesiones y en Incidencias. */
    contenido = (
      <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 min-h-0">
      {vista === 'incidencias' ? incidencias : (
      <div className="grid grid-cols-[300px_minmax(0,1fr)] h-full min-h-0">
        <div className="flex flex-col min-h-0 border-r border-digi-border">{pestanas}<div className="flex-1 min-h-0">{rail}</div></div>
        <div className="min-h-0 min-w-0">
          {conversacion || (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-digi-muted">
              <FolderOpen className="w-6 h-6" /><p className="text-[13px]">Elige una sesión o abre una nueva</p>
            </div>
          )}
        </div>
      </div>
      )}
      </div>
      <PanelServidores proyectoId={proyectoId} plegable debajo={recordatorios} />
      </div>
    );
  }

  return (
    <>
      {(error || errorFlujo) && <p className={`mb-2 rounded-lg border p-2.5 text-[13px] ${TONO.error.caja} ${TONO.error.texto}`}>{error || errorFlujo}</p>}
      <PanelHastaElPie desdeAncho={0} minimo={320} desplazar={false} respiro={enTelefono ? 0 : 12} className="bg-digi-card lg:border lg:border-digi-border lg:rounded-lg overflow-hidden">
        {contenido}
      </PanelHastaElPie>
      <PanelFlujo proyecto={proyectoFlujo} abierta={flujoAbierto} alCerrar={() => setFlujoAbierto(false)} alActualizar={actualizarFlujo} alVerSesion={verSesion} />
      <PanelProyecto abierto={editar.abierto} proyecto={editar.proyecto} alCerrar={() => setEditar((x) => ({ ...x, abierto: false }))} alCambiar={() => { cargarProyectos(); refrescar(); }} />
    </>
  );
}

export default function EspacioTrabajo() {
  return <Suspense fallback={null}><Espacio /></Suspense>;
}
