'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, BellRing } from 'lucide-react';
import { ICONO_SISTEMA } from '@/components/centralized/iconos4P';
import { Cifra, RejillaCifras } from '@/components/ui/Cifra';
import Saludo from '@/components/dashboard/Saludo';

type SistemaResumen = {
  id: number; nombre: string; slug: string; piso: string; paso: string; celda: string; activo: boolean;
  ruta: string; etiqueta: string | null; valor: number | null; atender: boolean;
};

const ICONO = ICONO_SISTEMA;

/** Los sistemas que viven en el servidor local de la Mac: se entra con la contraseña, por Tailscale. */
const EN_SERVIDOR_LOCAL: Record<string, string> = {
  'generacion-de-contenido': 'Pide la contraseña del servidor local (Tailscale)',
};

/**
 * LA PORTADA DE CENTRALIZADO EN LAS APPS (Fernando, 2026-11-08). Con el mismo diseño que el Inicio de
 * Progreso —su saludo (`Saludo`), sus cifras (`Cifra`) y sus títulos (`titulo-progreso`)—, porque el
 * diseño no se cambia entre secciones. Un indicador por sistema; el mapa 4P se abre con el icono de
 * tabla de la cabecera. Datos: `/api/centralized/resumen`, con los mismos accesos que la lista.
 */
export default function DashboardCentralizado() {
  const [datos, setDatos] = useState<{ activos: number; sistemas: SistemaResumen[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/centralized/resumen')
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'No se pudo cargar.'); return j; })
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, []);

  const sistemas = datos?.sistemas;
  const porAtender = (sistemas ?? []).reduce((t, s) => t + (s.atender && s.valor ? s.valor : 0), 0);
  // Lo que espera a alguien, primero.
  const conIndicador = (sistemas ?? []).filter((s) => s.etiqueta)
    .sort((a, b) => Number(b.atender && (b.valor ?? 0) > 0) - Number(a.atender && (a.valor ?? 0) > 0));

  return (
    <div>
      <Saludo />

      <RejillaCifras className="mb-5">
        <Cifra Icon={Boxes} label="Sistemas" value={sistemas ? `${sistemas.length} de ${datos!.activos}` : undefined} />
        <Cifra Icon={BellRing} label="Por atender" value={sistemas ? porAtender : undefined} tone={porAtender > 0 ? 'red' : 'accent'} />
      </RejillaCifras>

      <h2 className="titulo-progreso text-[18px] text-digi-text mb-3">Indicadores de tus sistemas</h2>
      {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}
      {!sistemas ? (
        <RejillaCifras>{[0, 1, 2, 3].map((i) => <Cifra key={i} Icon={Boxes} label="Cargando" />)}</RejillaCifras>
      ) : !conIndicador.length ? (
        <p className="text-[13px] text-digi-muted py-4 text-center">{sistemas.length ? 'Tus sistemas aún no tienen indicadores.' : 'Aún no tienes acceso a ningún sistema.'}</p>
      ) : (
        <RejillaCifras>
          {conIndicador.map((s) => (
            <Link key={s.id} href={s.ruta} title={s.nombre} className="block min-w-0 rounded-lg">
              <Cifra Icon={ICONO[s.slug] ?? Boxes} label={s.etiqueta!} value={s.valor ?? '—'}
                tone={s.atender && (s.valor ?? 0) > 0 ? 'red' : 'accent'} candado={EN_SERVIDOR_LOCAL[s.slug]} />
            </Link>
          ))}
        </RejillaCifras>
      )}
    </div>
  );
}
