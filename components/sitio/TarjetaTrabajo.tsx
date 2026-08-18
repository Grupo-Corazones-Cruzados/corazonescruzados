'use client';

/**
 * UNA TARJETA DE `/soluciones` — un proyecto o un ticket terminado.
 *
 * Fernando la pidió «al mismo estilo que el portafolio del CV público», con un añadido: los
 * **círculos de quienes participaron**, y al pasar el puntero, sus datos de contacto.
 *
 * Por eso la clase de la tarjeta es `.tarjeta-portafolio`, **la misma** que usa el CV: se
 * mudó de `app/cv/cv-publico.css` a `app/globals.css` para que las dos páginas compartan una
 * sola definición en vez de dos que se parecen.
 *
 * ── LA BURBUJA LLEVA SOLO CONTACTO ─────────────────────────────────────────────
 * Foto, nombre, correo y teléfono. Nada de talento, CV ni enlaces.
 *
 * **El talento sobra por deducción, no por gusto** (Fernando, 2026-08-18): si alguien
 * participó en este proyecto, y el proyecto cuelga de un talento, y ese talento cuelga del
 * solución que el visitante tiene abierto, entonces **ya se sabe que tiene ese talento** —
 * nadie sin él puede participar. Repetirlo en la burbuja es gastar una línea en decir lo que
 * el sitio donde está la tarjeta ya dijo.
 *
 * **Lo que esté vacío no se pinta**, que es la regla que él fijó el 2026-08-14 al quitar los
 * interruptores de compartir: *el campo vacío YA es el interruptor*.
 *
 * ── LA BURBUJA NO DEPENDE DE JAVASCRIPT NI DE TENER RATÓN ──────────────────────
 * Se abre con `group-hover` **y** con `group-focus-within`, y el avatar es un `<button>`: así
 * sale al pasar el puntero, al llegar con el tabulador y al tocarla en un móvil, sin un solo
 * `useState`. Y su contenido está en el HTML crudo, que es lo que lee un buscador.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Images, Mail, Phone, X } from 'lucide-react';
import type { Trabajo, Persona } from '@/lib/soluciones';

const ETIQUETA: Record<Trabajo['tipo'], string> = {
  proyecto: 'Proyecto',
  ticket: 'Ticket',
};

/** Iniciales para quien no tiene foto. Nunca un hueco gris vacío. */
function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function Circulo({ persona }: { persona: Persona }) {
  const esResponsable = persona.rol === 'responsible';
  return (
    <div className="group/p relative">
      <button
        type="button"
        // `-ml-2` en todos menos el primero: los círculos se solapan como en un reparto.
        className={`relative block w-9 h-9 rounded-full overflow-hidden border-2 transition-transform
                    hover:z-10 hover:scale-110 focus:outline-none focus-visible:ring-2
                    focus-visible:ring-[#7b5fbf]/60 focus-visible:z-10
                    ${esResponsable ? 'border-[var(--violeta)]' : 'border-[var(--tarjeta)]'}`}
        aria-label={`Datos de contacto de ${persona.nombre}`}
      >
        {persona.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={persona.foto} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-[#7b5fbf]/[0.12] text-[11px] font-semibold text-[var(--violeta-txt)]">
            {iniciales(persona.nombre)}
          </span>
        )}
      </button>

      {/* La burbuja. `pointer-events-none` mientras está oculta para que no atrape clics de
          la tarjeta que hay debajo. */}
      <div
        role="tooltip"
        /* `left-0` y no centrada: los círculos viven en el borde IZQUIERDO de la tarjeta, y
           una burbuja centrada sobre el primero se sale por la izquierda de la pantalla.
           Anclada a la izquierda, crece hacia dentro, que es donde hay sitio. */
        className="pointer-events-none absolute left-0 bottom-full z-30 mb-2 w-max max-w-[260px]
                   rounded-lg border border-[var(--linea)] bg-[var(--tarjeta)]
                   px-3 py-2.5 opacity-0 shadow-[0_8px_24px_rgba(28,27,34,0.14)] transition-opacity
                   group-hover/p:opacity-100 group-focus-within/p:opacity-100"
      >
        <p className="text-[13px] font-semibold leading-snug text-[var(--texto)]">{persona.nombre}</p>
        {persona.correo && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--suave)] break-all">
            <Mail className="w-3.5 h-3.5 shrink-0 text-[var(--violeta-txt)]" />
            {persona.correo}
          </p>
        )}
        {persona.telefono && (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--suave)]">
            <Phone className="w-3.5 h-3.5 shrink-0 text-[var(--violeta-txt)]" />
            {persona.telefono}
          </p>
        )}
      </div>
    </div>
  );
}

export default function TarjetaTrabajo({ trabajo }: { trabajo: Trabajo }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (abierta !== null && !d.open) d.showModal();
    if (abierta === null && d.open) d.close();
  }, [abierta]);

  const mover = useCallback((paso: number) => {
    setAbierta((i) => (i === null ? i : (i + paso + trabajo.imagenes.length) % trabajo.imagenes.length));
  }, [trabajo.imagenes.length]);

  useEffect(() => {
    if (abierta === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierta, mover]);

  return (
    /**
     * ⚠️ **SIN `overflow-hidden` AQUÍ, Y ESE ERA EL FALLO.**
     *
     * La tarjeta lo llevaba para redondear la esquina de la imagen, y de paso **recortaba la
     * burbuja de contacto**: al pasar el puntero por un círculo, la burbuja se cortaba contra
     * el borde de la tarjeta (lo vio Fernando). Un contenedor que recorta no distingue entre
     * la imagen que quería recortar y lo que se sale a propósito.
     *
     * El recorte se movió al botón de la imagen, que es el único que lo necesitaba.
     */
    <article className="tarjeta-portafolio flex flex-col">
      {/* ⚠️ Sin imagen NO se pinta un recuadro gris de relleno. Con seis de once proyectos
          sin foto, esos marcos vacíos ocuparían media rejilla y la página parecería rota. Es
          la misma regla del resto del sitio: lo que no hay, no deja hueco. */}
      {trabajo.imagenes.length > 0 && (
        <button
          type="button"
          onClick={() => setAbierta(0)}
          className="relative block w-full aspect-[16/10] overflow-hidden rounded-t-xl bg-[#f2f0f7] group"
          aria-label={`Ver las ${trabajo.imagenes.length} imágenes de ${trabajo.titulo}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trabajo.imagenes[0]}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {trabajo.imagenes.length > 1 && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
              <Images className="w-3.5 h-3.5" /> {trabajo.imagenes.length}
            </span>
          )}
        </button>
      )}

      <div className="p-5 flex flex-col gap-2 flex-1">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--violeta-txt)]">
          {ETIQUETA[trabajo.tipo]}
        </span>
        <h3 className="text-[17px] font-semibold text-[var(--texto)] leading-snug">{trabajo.titulo}</h3>
        {trabajo.descripcion && (
          <p className="text-[13.5px] text-[var(--suave)] leading-relaxed">{trabajo.descripcion}</p>
        )}
        {trabajo.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {trabajo.etiquetas.map((t) => (
              <span key={t} className="rounded-full border border-[var(--linea)] px-2.5 py-0.5 text-[11px] text-[var(--tenue)]">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Los círculos, al pie. `mt-auto` los alinea abajo aunque las descripciones midan
            distinto: sin esto, cada fila de la rejilla queda descuadrada. */}
        {trabajo.personas.length > 0 && (
          <div className="mt-auto pt-4 flex items-center">
            {trabajo.personas.map((p, i) => (
              <div key={p.memberId} className={i === 0 ? '' : '-ml-2'}>
                <Circulo persona={p} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* El visor: `<dialog>` NATIVO. Trae hecho lo que un diálogo casero olvida —atrapa el
          foco, cierra con Escape, vive en la capa superior del navegador—.
          ⚠️ `m-auto` para centrarlo: el reajuste de Tailwind le pone `margin: 0`. */}
      {trabajo.imagenes.length > 0 && (
        <dialog
          ref={dialogRef}
          onClose={() => setAbierta(null)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const fuera = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
            if (fuera) setAbierta(null);
          }}
          className="m-auto w-[min(92vw,1100px)] max-h-[88vh] rounded-xl bg-[var(--tarjeta)] p-0
                     backdrop:bg-[#1c1b22]/70 backdrop:backdrop-blur-sm"
        >
          {abierta !== null && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={trabajo.imagenes[abierta]}
                alt={`${trabajo.titulo} — imagen ${abierta + 1}`}
                className="w-full max-h-[80vh] object-contain bg-[#f2f0f7]"
              />
              <button
                type="button"
                onClick={() => setAbierta(null)}
                aria-label="Cerrar"
                className="absolute top-2 right-2 w-9 h-9 inline-flex items-center justify-center rounded-full
                           bg-black/55 text-white hover:bg-black/75 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {trabajo.imagenes.length > 1 && (
                <>
                  <button type="button" onClick={() => mover(-1)} aria-label="Anterior"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => mover(1)} aria-label="Siguiente"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
                    {abierta + 1} / {trabajo.imagenes.length}
                  </span>
                </>
              )}
            </div>
          )}
        </dialog>
      )}
    </article>
  );
}
