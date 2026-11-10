'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { esAppInstalada, rutaAcceso, RUTA_CONTENIDO } from '@/components/espacio/api';
import EspacioEnApp from '@/components/espacio/EspacioEnApp';
import { useAuth } from '@/components/providers/AuthProvider';
import IdeasDeContenido from '@/components/centralized/generacion-contenido/IdeasDeContenido';

type Puerta = 'cargando' | 'web' | 'clave' | 'sin-servicio' | 'dentro';

/**
 * ⭐ SOLO EN LA MAC (Fernando, 2026-11-04). Los textos los escribe Claude Code con la suscripción y
 * los videos viven en el disco, así que en la web no hay nada que abrir: las rutas responden 404.
 * Va detrás del mismo candado que el Espacio de trabajo.
 */
export default function GeneracionDeContenidoSystem(_props: { system?: any; isAdmin?: boolean }) {
  const { user } = useAuth();
  const [puerta, setPuerta] = useState<Puerta>('cargando');
  const [enApp, setEnApp] = useState(false);
  useEffect(() => { setEnApp(esAppInstalada()); }, []);
  useEffect(() => {
    fetch('/api/espacio-trabajo/estado')
      .then(async (r) => {
        if (!r.ok) { setPuerta('web'); return; }
        const j = await r.json();
        setPuerta(!j.servicio ? 'sin-servicio' : j.autenticado ? 'dentro' : 'clave');
      })
      .catch(() => setPuerta('web'));
  }, []);
  if (puerta === 'dentro') return <SistemaLocal />;
  /* Desde las apps instaladas se usa lo que sirve la Mac por la red privada, como el Espacio de trabajo. */
  if (puerta === 'web' && enApp && user?.role === 'admin') return <EspacioEnApp ruta={RUTA_CONTENIDO} titulo="Generación de Contenido" />;
  if (puerta === 'cargando') return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>;
  const ruta = typeof window === 'undefined' ? '' : window.location.pathname;
  return (
    <div className="bg-digi-card border border-digi-border rounded-xl py-16 px-6 flex flex-col items-center text-center gap-3">
      <Lock className="w-6 h-6 text-digi-muted" />
      <p className="text-[14px] font-medium text-digi-text">
        {puerta === 'web' ? 'Generación de Contenido solo funciona en tu Mac' : puerta === 'clave' ? 'Hace falta la contraseña del Espacio de trabajo' : 'El servicio local no está en marcha'}
      </p>
      {puerta === 'web' && <a className={BTN_PRIMARY} href={`http://localhost:3792${ruta}`}>Abrir en la Mac</a>}
      {puerta === 'clave' && <a className={BTN_PRIMARY} href={rutaAcceso(ruta)}>Escribir la contraseña</a>}
    </div>
  );
}

/**
 * Desde el rediseño del 2026-11-10 cada idea es una sesión con sus piezas (video, miniatura, carrusel e
 * infografía): `IdeasDeContenido`. Los guiones, el short, los requerimientos y los metadatos ya no existen.
 */
export function SistemaLocal({ enMarco = false }: { enMarco?: boolean }) {
  return <IdeasDeContenido enMarco={enMarco} />;
}
