'use client';

/**
 * ⭐ EL MARCO DE LAS PÁGINAS PÚBLICAS POR ENLACE (Fernando, 2026-11-04: cotización, calendario,
 * enlace de archivos, entrega, herramienta, incidentes y documentación «con el diseño de
 * /dashboard […] algo estándar en cuanto a colores y diseño de controles»).
 *
 * Antes cada una se vestía sola con `corp page-dark`: fondo negro forzado con tarjetas claras
 * encima, textos `text-white/60` sobre el fondo y, según la página, piezas pixel antiguas. Ahora
 * todas cuelgan de este marco, que es el MISMO envoltorio que el panel (`corp tema-progreso
 * tema-<id>` + `.dark`): mismos tokens, mismo fondo, mismas tarjetas (`bg-digi-card border
 * rounded-xl`), mismos botones (`BTN_*`) y campos (`field-control`). El tema es el último que se
 * usó en el panel en este equipo, o el del sistema si nunca se abrió (el cliente).
 *
 * Por eso dentro: nada de colores sueltos (`text-white/…`, `#hex`), y los textos que van sobre
 * el fondo usan `text-digi-text` / `text-digi-muted`, que cambian con el tema.
 */

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import PublicHeader from '@/components/public/PublicHeader';
import { TEMA_POR_DEFECTO, type TemaId } from '@/lib/temas';
import { TEMAS_OSCUROS, leerUltimoTema, scriptTema } from '@/lib/tema-ultimo';
import '@/app/tema-progreso.css';
import '@/app/temas.css';

const SCRIPT = scriptTema(true);

const ANCHOS = { estrecho: 'max-w-2xl', medio: 'max-w-4xl', amplio: 'max-w-6xl', completo: '' } as const;

export default function MarcoPublico({ children, ancho = 'estrecho', className = '', sinContenedor = false }: {
  children: React.ReactNode;
  /** El ancho del contenido: `estrecho` (formularios), `medio`, `amplio` (documentos). */
  ancho?: keyof typeof ANCHOS;
  className?: string;
  /** La página monta su propio contenedor (p. ej. un calendario a pantalla completa). */
  sinContenedor?: boolean;
}) {
  const [tema, setTema] = useState<TemaId>(TEMA_POR_DEFECTO);
  useEffect(() => { setTema(leerUltimoTema(true)); }, []);
  const oscuro = TEMAS_OSCUROS.includes(tema);

  return (
    <div className={`corp tema-progreso tema-${tema} ${oscuro ? 'dark' : ''} min-h-screen flex flex-col ${className}`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <Toaster position="top-center" richColors theme={oscuro ? 'dark' : 'light'} />
      <PublicHeader />
      {sinContenedor ? children : (
        <main className={`${ANCHOS[ancho]} w-full mx-auto px-4 py-6 sm:py-10 flex-1`}>{children}</main>
      )}
    </div>
  );
}

/** El aviso de una página que no se puede usar (enlace vencido, cerrado, ya usado…). */
export function AvisoPublico({ icon: Icono, titulo, children, acciones }: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  children?: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="bg-digi-card border border-digi-border rounded-xl p-8 text-center">
      <span className="mx-auto mb-4 w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--degradado-icono)' }}>
        <Icono className="w-5 h-5" />
      </span>
      <p className="titulo-progreso text-[17px] text-digi-text">{titulo}</p>
      {children && <div className="text-[13.5px] text-digi-muted mt-1.5">{children}</div>}
      {acciones && <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">{acciones}</div>}
    </div>
  );
}

/** «Cargando…» sobre el fondo del marco. */
export function CargandoPublico({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-20 text-[13.5px] text-digi-muted">
      <span aria-hidden className="w-4 h-4 rounded-full border-2 border-digi-border border-t-accent animate-spin motion-reduce:animate-none" />
      {texto}
    </div>
  );
}
