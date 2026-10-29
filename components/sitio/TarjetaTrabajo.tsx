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
 *
 * ── ⭐ 2026-10-29: SIN BURBUJAS, CONTACTO AL PIE Y DESCRIPCIÓN RECORTADA ──────────────
 * Fernando: *«el diseño está muy mal para mostrar el contenido de los proyectos»*. Las burbujas
 * se quedaban ABIERTAS a la vez (la clase `acciones-al-pasar` las forzaba a `opacity:1` fuera
 * de un `.group`) y tapaban las tarjetas de al lado. Ahora el pie dice quién lo hizo: los
 * círculos apilados, el nombre del responsable (+N) y su correo y teléfono como botones
 * redondos (`mailto:`/`tel:`). La descripción se recorta a 4 líneas con «Leer más» (entera en el
 * HTML: el recorte es solo visual) y las etiquetas, a una fila. Versión anterior:
 * `git show 8d23d58e:components/sitio/TarjetaTrabajo.tsx`.
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

function Avatar({ persona }: { persona: Persona }) {
  return (
    <span
      title={persona.nombre}
      className={`relative block w-8 h-8 rounded-full overflow-hidden border-2
                  ${persona.rol === 'responsible' ? 'border-[#7c3aed]' : 'border-white'}`}
    >
      {persona.foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={persona.foto} alt="" loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center bg-[#7b5fbf]/[0.12] text-[10.5px] font-semibold text-[var(--violeta-txt)]">
          {iniciales(persona.nombre)}
        </span>
      )}
    </span>
  );
}

export default function TarjetaTrabajo({ trabajo }: { trabajo: Trabajo }) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [entera, setEntera] = useState(false);
  const responsable = trabajo.personas.find((p) => p.rol === 'responsible') ?? trabajo.personas[0];
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
            /* `blur-[1px]` NO es la protección: las capturas ya llegan desenfocadas desde
               Cloudinary (ver `capturaDifuminada` en `lib/soluciones.ts`), que es donde de
               verdad se quitan los datos. Esto solo suaviza el último punto de nitidez y
               cubre alguna imagen antigua que no pase por ahí. */
            className="w-full h-full object-cover blur-[1px] transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {trabajo.imagenes.length > 1 && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
              <Images className="w-3.5 h-3.5" /> {trabajo.imagenes.length}
            </span>
          )}
        </button>
      )}

      <div className="p-5 flex flex-col gap-2 flex-1">
        {/* El tipo a la izquierda y la fecha de creación al otro borde, a la misma altura
            (Fernando, 2026-08-18). `items-baseline` y no `items-center`: las dos son letra, y
            alinearlas por su línea base las deja a la misma altura de verdad aunque midan
            distinto — centrarlas por caja dejaría la fecha un pelo alta.

            La fecha va en `<time>` con la fecha completa en `dateTime`: para quien lee es «02
            ago 2026», y para un buscador o un lector de pantalla es una fecha que se entiende
            sin adivinar el formato. */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--violeta-txt)]">
            {ETIQUETA[trabajo.tipo]}
          </span>
          {trabajo.creadoTexto && (
            <time
              dateTime={trabajo.creado ?? undefined}
              className="shrink-0 text-[11.5px] tabular-nums text-[var(--tenue)]"
            >
              {trabajo.creadoTexto}
            </time>
          )}
        </div>
        <h3 className="text-[17px] font-semibold text-[var(--texto)] leading-snug">{trabajo.titulo}</h3>
        {trabajo.descripcion && (
          <div>
            <p className={`text-[14px] text-[var(--suave)] leading-relaxed ${entera ? '' : 'line-clamp-4'}`}>
              {trabajo.descripcion}
            </p>
            {trabajo.descripcion.length > 180 && (
              <button
                type="button"
                onClick={() => setEntera((v) => !v)}
                aria-expanded={entera}
                className="mt-1.5 text-[13px] font-semibold text-[var(--violeta-txt)] hover:underline underline-offset-4"
              >
                {entera ? 'Leer menos' : 'Leer más'}
              </button>
            )}
          </div>
        )}
        {trabajo.etiquetas.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(entera ? trabajo.etiquetas : trabajo.etiquetas.slice(0, 3)).map((t) => (
              <span key={t} className="rounded-full bg-[#7c3aed]/[0.07] px-2.5 py-0.5 text-[11.5px] text-[var(--violeta-txt)]">
                {t}
              </span>
            ))}
            {!entera && trabajo.etiquetas.length > 3 && (
              <span className="rounded-full px-1.5 py-0.5 text-[11.5px] text-[var(--tenue)]">+{trabajo.etiquetas.length - 3}</span>
            )}
          </div>
        )}

        {/* El pie: quién lo hizo y cómo contactarle, a la vista (sin burbujas). `mt-auto` lo
            alinea abajo aunque las descripciones midan distinto. */}
        {responsable && (
          <div className="mt-auto pt-4 border-t border-[var(--linea)] flex items-center gap-3">
            <span className="flex shrink-0">
              {trabajo.personas.slice(0, 3).map((p, i) => (
                <span key={p.memberId} className={i === 0 ? '' : '-ml-2.5'}><Avatar persona={p} /></span>
              ))}
            </span>
            <span className="min-w-0 flex-1 text-[13px] leading-tight">
              <span className="block truncate font-semibold text-[var(--texto)]">{responsable.nombre}</span>
              {trabajo.personas.length > 1 && (
                <span className="text-[12px] text-[var(--tenue)]">y {trabajo.personas.length - 1} más</span>
              )}
            </span>
            {responsable.correo && (
              <a href={`mailto:${responsable.correo}`} title={responsable.correo} aria-label={`Escribir a ${responsable.nombre}`} className="contacto-redondo">
                <Mail aria-hidden />
              </a>
            )}
            {responsable.telefono && (
              <a href={`tel:${responsable.telefono.replace(/\s+/g, '')}`} title={responsable.telefono} aria-label={`Llamar a ${responsable.nombre}`} className="contacto-redondo">
                <Phone aria-hidden />
              </a>
            )}
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
                /* La galería a pantalla completa usa la MISMA URL que la miniatura, que ya
                   viene desenfocada del servidor. Es lo que evita el atajo obvio: abrir la
                   foto grande para leer lo que la miniatura escondía. */
                className="w-full max-h-[80vh] object-contain bg-[#f2f0f7] blur-[1px]"
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
