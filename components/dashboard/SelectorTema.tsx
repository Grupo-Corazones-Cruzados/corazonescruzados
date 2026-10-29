'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { usarBurbuja, Burbuja } from '@/components/ui/burbuja';
import { useTemaPanel } from '@/components/providers/TemaPanel';
import { TEMAS, definicionTema, type DefinicionTema } from '@/lib/temas';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * EL BOTÓN «TEMA» DEL MENÚ DE MÓDULOS (Fernando, 2026-10-29: «cuando se le haga clic poder ver
 * una burbuja con los diferentes temas disponibles y poder cambiar de tema»). Sustituye al
 * interruptor claro/oscuro. El tema se aplica al tocarlo, sin cerrar la burbuja: así se
 * comparan unos con otros sin volver a abrirla.
 *
 * `alCambiarAbierto` avisa al menú para que no se repliegue mientras la burbuja está abierta:
 * la burbuja vive fuera del `<aside>` y, al llevar el puntero a ella, el menú creería que lo
 * han dejado.
 */
export default function SelectorTema({ collapsed, alCambiarAbierto }: {
  collapsed: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  const { tema, poner } = useTemaPanel();
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement | null>(null);
  const cerrar = useCallback(() => setAbierto(false), []);
  const { burbujaRef, caja } = usarBurbuja(abierto, cerrar, botonRef, 'derecha');

  useEffect(() => { alCambiarAbierto(abierto); }, [abierto, alCambiarAbierto]);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Elegir tema"
        aria-expanded={abierto}
        title={`Tema: ${definicionTema(tema)?.nombre ?? ''}`}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium text-accent
                   transition-[filter] duration-150 hover:brightness-125 focus-visible:brightness-125"
        style={{ ...mf, background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
      >
        <Palette className="w-4 h-4" />
        {!collapsed && 'Tema'}
      </button>

      {abierto && caja && (
        <Burbuja caja={caja} burbujaRef={burbujaRef} lado="derecha" etiqueta="Tema" ancho={232}>
          <div className="px-3 py-2 border-b border-digi-border">
            <span className="text-[12px] font-semibold text-digi-text" style={mf}>Tema</span>
          </div>
          <div role="radiogroup" aria-label="Tema" className="p-1.5 space-y-0.5">
            {TEMAS.map((t) => {
              const elegido = t.id === tema;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={elegido}
                  onClick={() => poner(t.id)}
                  className={`w-full flex items-center gap-2.5 min-h-11 sm:min-h-10 px-2 rounded-md text-left transition-colors ${
                    elegido ? 'bg-accent-light' : 'hover:bg-black/[0.04]'
                  }`}
                >
                  <Muestra t={t} />
                  <span className={`flex-1 text-[13px] ${elegido ? 'font-semibold text-digi-text' : 'text-digi-text'}`} style={mf}>{t.nombre}</span>
                  {elegido && <Check className="w-4 h-4 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </Burbuja>
      )}
    </>
  );
}

/** Miniatura del tema: el fondo, una tarjeta (o la ventana oscura del Mixto) y el acento. */
function Muestra({ t }: { t: DefinicionTema }) {
  const m = t.muestra;
  return (
    <span aria-hidden className="relative w-10 h-7 rounded-md overflow-hidden shrink-0 ring-1 ring-black/10" style={{ background: m.fondo }}>
      <span className="absolute left-1 top-1 w-4 h-3 rounded-[3px]" style={{ background: m.tarjeta }} />
      {m.ventana && <span className="absolute right-0 top-0 bottom-0 w-[13px]" style={{ background: m.ventana }} />}
      <span className="absolute left-1 bottom-1 w-5 h-1.5 rounded-full" style={{ background: m.acento }} />
    </span>
  );
}
