'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Link2Off } from 'lucide-react';
import MarcoPublico, { AvisoPublico, CargandoPublico } from '@/components/public/MarcoPublico';
import { colocar, type Colocacion } from '@/components/espacio/flujo/colocar';
import { BotonQuitarFiltro, Leyenda, SelectorRol, useFiltroFlujo } from '@/components/espacio/flujo/controles';
import type { FlujoCompartido } from '@/lib/espacio-trabajo/flujo-compartido';

const Lienzo = dynamic(() => import('@/components/espacio/flujo/Lienzo'), { ssr: false, loading: () => <CargandoPublico /> });

const nada = () => {};

function Visor({ compartido }: { compartido: FlujoCompartido }) {
  const { doc, nombre, vence } = compartido;
  const [colocacion, setColocacion] = useState<Colocacion | null>(null);
  const [error, setError] = useState('');
  const f = useFiltroFlujo();

  useEffect(() => {
    let vivo = true;
    colocar(doc).then((c) => { if (vivo) setColocacion(c); }).catch(() => { if (vivo) setError('No se pudo dibujar el diagrama.'); });
    return () => { vivo = false; };
  }, [doc]);

  return (
    <main className="flex-1 min-h-0 flex flex-col bg-digi-card">
      <div className="shrink-0 flex items-center gap-2 px-3 lg:px-4 h-12 border-b border-digi-border">
        <div className="flex-1 min-w-0">
          <h1 className="text-[14px] font-semibold text-digi-text truncate" title={doc.resumen}>{nombre}</h1>
          <p className="hidden lg:block text-[11px] leading-[14px] text-digi-muted truncate">Disponible hasta el {new Date(vence).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <SelectorRol doc={doc} rol={f.rol} alCambiar={f.cambiarRol} className="max-w-[50%] lg:max-w-[220px]" />
        <BotonQuitarFiltro activo={f.hayFiltro} alPulsar={f.quitarFiltro} />
      </div>
      <div className="flex-1 min-h-0">
        {error ? <p className="p-4 text-[13px] text-red-400">{error}</p>
          : colocacion ? <Lienzo doc={doc} colocacion={colocacion} elegido={f.elegido} alElegir={f.setElegido} rol={f.rol} sinMover={f.sinMover} vista={null} alMover={nada} amplio />
          : <CargandoPublico />}
      </div>
      {colocacion && <Leyenda />}
    </main>
  );
}

/** El diagrama que alguien comparte por enlace: se recorre y se consulta, pero no se cambia. */
export default function FlujoPortal({ compartido }: { compartido: FlujoCompartido | null }) {
  if (!compartido) {
    return (
      <MarcoPublico>
        <AvisoPublico icon={Link2Off} titulo="Este enlace ya no está disponible">Pide uno nuevo a quien te lo envió.</AvisoPublico>
      </MarcoPublico>
    );
  }
  return (
    <MarcoPublico sinContenedor className="!min-h-0 h-dvh overflow-hidden">
      <Visor compartido={compartido} />
    </MarcoPublico>
  );
}
