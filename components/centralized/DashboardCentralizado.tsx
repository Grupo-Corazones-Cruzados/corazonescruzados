'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Boxes, Layers, BellRing, ShieldAlert, Inbox, UserPlus, CalendarDays, Clapperboard, Camera, Database,
  FlaskConical, SlidersHorizontal, Terminal, HeartHandshake, Grid3x3, type LucideIcon,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Cifra, RejillaCifras } from '@/components/ui/Cifra';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { useMenuMovil } from '@/components/dashboard/MenuMovil';
import { PISOS, PASOS } from '@/lib/centralized/systems';

const mf = { fontFamily: 'var(--font-body)' } as const;

type SistemaResumen = {
  id: number; nombre: string; slug: string; piso: string; paso: string; celda: string; activo: boolean;
  ruta: string; etiqueta: string | null; valor: number | null; atender: boolean;
};

const ICONO: Record<string, LucideIcon> = {
  'control-psicosocial': ShieldAlert, 'solicitudes-y-denuncias': Inbox, 'reclutamiento-y-seleccion': UserPlus,
  'gestion-social': CalendarDays, 'generacion-de-contenido': Clapperboard, 'percepcion-social': Camera,
  'gestion-de-datos': Database, 'metodologia-condiciologica': FlaskConical, 'gestion-de-condiciones': SlidersHorizontal,
  'comandos-violeta': Terminal, 'apoyo-y-autoayuda': HeartHandshake,
};

const PASO_CORTO: Record<string, string> = { fundamentacion: 'Fund.', creacion: 'Creac.', implementacion: 'Impl.', gestion: 'Gest.' };

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-digi-muted" style={mf}>{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

/**
 * LA PORTADA DE CENTRALIZADO EN LAS APPS (Fernando, 2026-11-08: «un /dashboard que sea la primera página
 * que se vea al ingresar»). Lo que la cuenta tiene a su alcance en el Modelo 4P y un indicador por
 * sistema; el mapa 4P completo se abre con el icono de tabla de la cabecera o desde aquí.
 * Datos: `/api/centralized/resumen`, con los mismos accesos que la lista de sistemas.
 */
export default function DashboardCentralizado() {
  const { abrir } = useMenuMovil();
  const [datos, setDatos] = useState<{ activos: number; sistemas: SistemaResumen[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/centralized/resumen')
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'No se pudo cargar.'); return j; })
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, []);

  const sistemas = datos?.sistemas;
  const porCelda = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of sistemas ?? []) m[`${s.piso}/${s.paso}`] = (m[`${s.piso}/${s.paso}`] ?? 0) + 1;
    return m;
  }, [sistemas]);
  const pisosCubiertos = useMemo(() => new Set((sistemas ?? []).map((s) => s.piso)).size, [sistemas]);
  const porAtender = useMemo(() => (sistemas ?? []).reduce((t, s) => t + (s.atender && s.valor ? s.valor : 0), 0), [sistemas]);
  const conIndicador = (sistemas ?? []).filter((s) => s.etiqueta);
  const ordenados = [...conIndicador].sort((a, b) => Number(b.atender && (b.valor ?? 0) > 0) - Number(a.atender && (a.valor ?? 0) > 0));

  return (
    <div className="space-y-6" style={mf}>
      <PageHeader title="Centralizado" />

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      <RejillaCifras>
        <Cifra Icon={Boxes} label="Sistemas" value={sistemas ? `${sistemas.length} de ${datos!.activos}` : undefined} />
        <Cifra Icon={Layers} label="Pisos" value={sistemas ? `${pisosCubiertos} de 4` : undefined} />
        <Cifra Icon={BellRing} label="Por atender" value={sistemas ? porAtender : undefined} tone={porAtender > 0 ? 'red' : 'accent'} />
      </RejillaCifras>

      <Seccion titulo="Tu Modelo 4P" accion={
        <button type="button" onClick={abrir} className={`${BTN_SECONDARY} !py-1.5 !px-3 !min-h-0 text-[12.5px]`}>
          <Grid3x3 className="w-4 h-4" /> Abrir el mapa
        </button>
      }>
        <button type="button" onClick={abrir} aria-label="Abrir el mapa 4P"
          className="w-full bg-digi-card border border-digi-border rounded-xl p-3 grid grid-cols-[4.5rem_repeat(4,minmax(0,1fr))] gap-1.5 text-left">
          <span />
          {PASOS.map((p) => <span key={p.key} title={p.label} className="text-center text-[10px] font-semibold uppercase tracking-wide text-digi-muted truncate">{PASO_CORTO[p.key]}</span>)}
          {PISOS.map((piso) => (
            <Fila key={piso.key}>
              <span className="self-center text-[11px] font-semibold text-digi-muted truncate">{piso.label}</span>
              {PASOS.map((paso) => {
                const n = porCelda[`${piso.key}/${paso.key}`] ?? 0;
                return (
                  <span key={paso.key} className={`h-10 rounded-lg flex items-center justify-center text-[14px] font-bold tabular-nums ${
                    n > 0 ? 'bg-accent text-white' : 'border border-dashed border-digi-border text-transparent'}`}>
                    {n || '·'}
                  </span>
                );
              })}
            </Fila>
          ))}
        </button>
      </Seccion>

      <Seccion titulo="Indicadores de tus sistemas">
        {!sistemas ? (
          <RejillaCifras>{[0, 1, 2, 3].map((i) => <Cifra key={i} Icon={Boxes} label="Cargando" />)}</RejillaCifras>
        ) : !conIndicador.length ? (
          <p className="text-[13px] text-digi-muted py-4 text-center">{sistemas.length ? 'Tus sistemas aún no tienen indicadores.' : 'Aún no tienes acceso a ningún sistema.'}</p>
        ) : (
          <RejillaCifras>
            {ordenados.map((s) => (
              <Link key={s.id} href={s.ruta} title={`${s.nombre} · ${s.celda}`} className="block min-w-0 rounded-lg">
                <Cifra Icon={ICONO[s.slug] ?? Boxes} label={s.etiqueta!} value={s.valor ?? '—'}
                  tone={s.atender && (s.valor ?? 0) > 0 ? 'red' : 'accent'} />
              </Link>
            ))}
          </RejillaCifras>
        )}
      </Seccion>
    </div>
  );
}

/** Una fila de la rejilla: sus hijos van directo a las 5 columnas. */
function Fila({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
