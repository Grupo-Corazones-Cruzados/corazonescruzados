'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PISOS, PASOS, cellName, systemPath } from '@/lib/centralized/systems';
import { ICONO_CELDA, ICONO_PASO, ICONO_PISO } from './iconos4P';

const mf = { fontFamily: 'var(--font-body)' } as const;

export type SistemaMapa = { id: number; name: string; piso: string; paso: string; slug: string };

/**
 * EL MAPA 4P — cómo se navega Centralizado en las apps (Fernando, 2026-11-08: «en vez de usar el
 * diseño de hamburguesa para navegar, usa la tabla de 4P para posicionar los sistemas»).
 *
 * La tabla del Modelo 4P: los pisos en filas (Global → Colaborador), los pasos en columnas
 * (Fundamentación → Gestión). Cada celda lleva su nombre (`CELL_MAP`) y cuántos sistemas de esa
 * celda puede abrir la cuenta; las que no tienen ninguno se ven apagadas. Al tocar una celda, sus
 * sistemas aparecen debajo. Es la portada de Centralizado y lo que abre el botón de la cabecera
 * dentro de un sistema (`MenuCentralizado`).
 */
/** `sistemas` es `null` mientras se cargan: así no se dice «no tienes acceso» antes de saberlo. */
export default function Mapa4P({ sistemas: cargados, rutaActual }: { sistemas: SistemaMapa[] | null; rutaActual?: string }) {
  const sistemas = useMemo(() => cargados ?? [], [cargados]);
  const celdas = useMemo(() => {
    const m: Record<string, SistemaMapa[]> = {};
    for (const s of sistemas) (m[`${s.piso}/${s.paso}`] ??= []).push(s);
    return m;
  }, [sistemas]);

  // Empieza en la celda del sistema abierto; si no, en la primera que tenga algo.
  const [elegida, setElegida] = useState<string | null>(null);
  useEffect(() => {
    if (elegida && celdas[elegida]) return;
    const actual = sistemas.find((s) => rutaActual && (rutaActual === systemPath(s) || rutaActual.startsWith(systemPath(s) + '/')));
    const primera = PISOS.flatMap((p) => PASOS.map((q) => `${p.key}/${q.key}`)).find((k) => celdas[k]);
    setElegida(actual ? `${actual.piso}/${actual.paso}` : primera ?? null);
  }, [celdas, sistemas, rutaActual, elegida]);

  const [pisoElegido, pasoElegido] = (elegida ?? '/').split('/');
  const lista = elegida ? celdas[elegida] ?? [] : [];

  return (
    <div className="flex flex-col gap-4" style={mf}>
      {/* Iconos y no textos (Fernando, 2026-11-08): celdas cuadradas que no ocupan alto ni ancho. El
          nombre va en `aria-label`/`title` y en la cabecera de la lista de la celda elegida. */}
      <div className="grid grid-cols-[1.75rem_repeat(4,minmax(0,1fr))] gap-1.5">
        <span />
        {PASOS.map((p) => {
          const Icono = ICONO_PASO[p.key];
          return (
            <span key={p.key} title={p.label} aria-label={p.label} className="h-7 flex items-center justify-center text-digi-muted">
              <Icono className="w-4 h-4" strokeWidth={2} />
            </span>
          );
        })}
        {PISOS.map((piso) => (
          <Fila key={piso.key}>
            <span title={piso.label} aria-label={piso.label} className="flex items-center justify-center text-digi-muted">
              {(() => { const Icono = ICONO_PISO[piso.key]; return <Icono className="w-4 h-4" strokeWidth={2} />; })()}
            </span>
            {PASOS.map((paso) => {
              const clave = `${piso.key}/${paso.key}`;
              const n = celdas[clave]?.length ?? 0;
              const activa = clave === elegida;
              const Icono = ICONO_CELDA[piso.key][paso.key];
              const nombre = `${cellName(piso.key, paso.key)} · ${piso.label} · ${paso.label}`;
              return (
                <button key={clave} type="button" disabled={n === 0} onClick={() => setElegida(clave)}
                  title={nombre} aria-label={`${nombre}${n ? `: ${n} sistema${n === 1 ? '' : 's'}` : ''}`} aria-pressed={activa}
                  // La elegida, con el degradado de las fichas de `Cifra`: dentro del raíl del cajón el
                  // acento es un rosa claro y el blanco encima no se leía.
                  style={activa ? { backgroundImage: 'var(--degradado-icono)' } : undefined}
                  className={`relative aspect-square rounded-xl border flex items-center justify-center transition-colors ${
                    activa ? 'bg-accent border-transparent text-white shadow-md'
                      : n > 0 ? 'bg-digi-card border-accent/40 text-digi-text hover:border-accent'
                        : 'bg-transparent border-digi-border/60 text-digi-muted opacity-40'}`}>
                  <Icono className="w-5 h-5" strokeWidth={1.9} />
                  {n > 0 && (
                    <span className={`absolute top-1 right-1.5 text-[10px] font-bold leading-none tabular-nums ${activa ? 'text-white' : 'text-accent'}`}>{n}</span>
                  )}
                </button>
              );
            })}
          </Fila>
        ))}
      </div>

      {elegida && lista.length > 0 && (
        <div className="rounded-xl border border-digi-border bg-digi-card overflow-hidden">
          {/* El nombre de la celda en su línea y, debajo, «Piso:» y «Paso:» con el valor a la derecha, como
              las filas del detalle de un sistema (Fernando, 2026-11-08). */}
          <div className="px-4 pt-3 pb-2.5 space-y-1">
            <p className="text-[13.5px] font-semibold text-digi-text">{cellName(pisoElegido, pasoElegido)}</p>
            {([['Piso', PISOS.find((p) => p.key === pisoElegido)?.label], ['Paso', PASOS.find((p) => p.key === pasoElegido)?.label]] as const).map(([k, v]) => (
              <p key={k} className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-digi-muted">{k}:</span>
                <span className="text-digi-text">{v}</span>
              </p>
            ))}
          </div>
          {lista.map((s) => {
            const ruta = systemPath(s);
            const abierto = !!rutaActual && (rutaActual === ruta || rutaActual.startsWith(ruta + '/'));
            return (
              <Link key={s.id} href={ruta}
                className={`flex items-center gap-2 px-4 h-12 border-t border-digi-border text-[13.5px] ${abierto ? 'text-accent font-semibold' : 'text-digi-text'}`}>
                <span className="flex-1 truncate">{s.name}</span>
                <ChevronRight className="w-4 h-4 text-digi-muted shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
      {cargados === null && <p className="text-center text-[13px] text-digi-muted py-6">Cargando…</p>}
      {cargados !== null && sistemas.length === 0 && (
        <p className="text-center text-[13px] text-digi-muted py-6">Aún no tienes acceso a ningún sistema.</p>
      )}
    </div>
  );
}

/** Una fila de la tabla: sus hijos van directo a la rejilla de 5 columnas. */
function Fila({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
