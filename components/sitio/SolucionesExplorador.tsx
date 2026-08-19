'use client';

/**
 * EL EXPLORADOR DE `/soluciones` — carpetas a la izquierda, contenido a la derecha.
 *
 * Fernando lo pidió «al estilo de legal y privacidad». Cada **solución** es una carpeta que se
 * despliega y enseña sus **talentos**; al elegir uno, a la derecha salen su nombre, su
 * descripción, un buscador y **cuatro pestañas fijas**: Talentos · Productos · Tickets ·
 * Proyectos.
 *
 * ── LAS CUATRO PESTAÑAS SON SIEMPRE CUATRO ─────────────────────────────────────
 * También cuando están vacías, y es deliberado: son la promesa de qué se puede encontrar
 * aquí. Una pestaña que aparece y desaparece según los datos hace que la página cambie de
 * forma entre un talento y otro, y que nadie llegue a aprenderse dónde está cada cosa. Lo
 * que sí se adapta es su contenido, que dice con todas las letras que no hay nada todavía.
 *
 * ⚠️ Esto es lo contrario de la regla del resto del sitio —«una lista vacía no deja hueco»—,
 * y la diferencia está en qué es cada cosa: allí se trataba de SECCIONES de contenido, aquí
 * de la NAVEGACIÓN. La navegación tiene que ser estable para poder confiar en ella.
 *
 * ── EL TITULAR DEL TALENTO ES EL `<h1>` DE LA PÁGINA ───────────────────────────
 * La página tenía un encabezado propio («Soluciones») y Fernando lo quitó el 2026-08-18. Sin
 * él la página se quedaría sin `<h1>`, así que lo hereda el nombre del talento abierto, que
 * además es de lo que trata lo que se está mirando.
 *
 * ── ⭐ TODO EL CONTENIDO ESTÁ EN EL HTML, TAMBIÉN LO QUE NO SE VE ──────────────
 * Los talentos no elegidos y las pestañas no abiertas se pintan igualmente en un bloque
 * `hidden`. Es el remedio que ya se usó en las preguntas frecuentes y en `VentanaTarjeta`,
 * donde se midió que **lo que solo viaja como prop a un componente de cliente no existe
 * para el buscador**. Sin esto, de treinta trabajos Google vería los de una pestaña.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Folder, FolderOpen, Mail, Phone, Search } from 'lucide-react';
import type {
  Solucion, ContenidoDeTalento, MiembroConTalento, Producto, Trabajo, Concepto,
} from '@/lib/soluciones';
import TarjetaTrabajo from './TarjetaTrabajo';
import TiraConceptos from './TiraConceptos';
import { ExploradorTresPaneles } from './piezas';

export interface SolucionConContenido extends Solucion {
  /** El contenido de cada talento, ya consultado en el servidor. */
  contenido: Record<string, ContenidoDeTalento>;
  /** Los conceptos de esta solución, para la tira vertical del panel derecho. */
  conceptos: Concepto[];
}

type Pestana = 'talentos' | 'productos' | 'tickets' | 'proyectos';

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'talentos', label: 'Talentos' },
  { id: 'productos', label: 'Productos' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'proyectos', label: 'Proyectos' },
];

const VACIO_TOTAL: ContenidoDeTalento = { miembros: [], productos: [], proyectos: [], tickets: [] };

/** Iniciales para quien no tiene foto. Nunca un hueco gris vacío. */
function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

/**
 * La tarjeta de un miembro en la pestaña «Talentos».
 *
 * «Una tarjeta grande de ese usuario con sus datos de contacto nada más» (Fernando). Así
 * que: foto, nombre, correo y teléfono. Lo que esté vacío no se pinta.
 */
function TarjetaMiembro({ miembro }: { miembro: MiembroConTalento }) {
  return (
    <article className="tarjeta-portafolio p-5 flex items-center gap-4">
      <span className="w-16 h-16 shrink-0 rounded-full overflow-hidden border border-[var(--linea)]">
        {miembro.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={miembro.foto} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-[#7b5fbf]/[0.12] text-[15px] font-semibold text-[var(--violeta-txt)]">
            {iniciales(miembro.nombre)}
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className="text-[16px] font-semibold text-[var(--texto)] leading-snug">{miembro.nombre}</p>
        {miembro.correo && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[var(--suave)] break-all">
            <Mail className="w-3.5 h-3.5 shrink-0 text-[var(--violeta-txt)]" /> {miembro.correo}
          </p>
        )}
        {miembro.telefono && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--suave)]">
            <Phone className="w-3.5 h-3.5 shrink-0 text-[var(--violeta-txt)]" /> {miembro.telefono}
          </p>
        )}
      </div>
    </article>
  );
}

function TarjetaProducto({ producto }: { producto: Producto }) {
  return (
    <article className="tarjeta-portafolio flex flex-col">
      {producto.imagen && (
        <div className="w-full aspect-[16/10] overflow-hidden rounded-t-xl bg-[#f2f0f7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={producto.imagen} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5 flex flex-col gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--violeta-txt)]">Producto</span>
        <h3 className="text-[17px] font-semibold text-[var(--texto)] leading-snug">{producto.nombre}</h3>
        {producto.descripcion && (
          <p className="text-[13.5px] text-[var(--suave)] leading-relaxed">{producto.descripcion}</p>
        )}
        {producto.precio !== null && (
          <p className="text-[15px] font-semibold text-[var(--violeta)]">
            {producto.precio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * ⭐ EL TALENTO ELEGIDO VIENE DE LA RUTA, NO DE UN `useState` (Fernando, 2026-08-18).
 *
 * `/soluciones/automatizacion-de-procesos`. Cada talento es una URL: se comparte, se guarda en
 * marcadores y **Google indexa una página por talento** en vez de una sola con todo lo demás
 * detrás de un panel, que es lo que más pesa de este cambio.
 *
 * Por eso los talentos del panel izquierdo son `<Link>` y no botones: un enlace se abre en
 * otra pestaña, se copia con el botón derecho y el navegador enseña a dónde lleva. Un botón
 * que navega no hace nada de eso.
 */
export default function SolucionesExplorador({
  soluciones, slugActivo,
}: {
  soluciones: SolucionConContenido[];
  /** El talento de la URL. Sin él —en `/soluciones`— se elige el primero que haya. */
  slugActivo?: string;
}) {
  /**
   * AL ENTRAR: TODO CERRADO MENOS LA PRIMERA CARPETA, CON SU PRIMER TALENTO ELEGIDO.
   *
   * Fernando, 2026-08-18. Una página que arranca con todo desplegado obliga a leer la lista
   * entera antes de saber por dónde empezar; una que arranca con todo cerrado obliga a
   * adivinar que hay que pulsar algo. Abrir solo la primera resuelve las dos cosas.
   *
   * ⚠️ **Se abre la primera carpeta QUE TENGA TALENTOS, no la primera a secas.** Una solución
   * recién creada y todavía sin talentos dejaría la derecha vacía y —peor— la página sin
   * `<h1>`, porque el titular ES el nombre del talento abierto. Saltárselo cuesta una línea
   * y evita que crear una solución en el admin descoloque la web hasta que se le asocie algo.
   */
  const primero = soluciones.find((a) => a.talentos.length > 0) ?? soluciones[0];

  /** El solución y el talento que pide la URL; si no la hay, el primero con contenido. */
  const activo = useMemo(() => {
    if (slugActivo) {
      for (const a of soluciones) {
        const t = a.talentos.find((x) => x.slug === slugActivo);
        if (t) return { solucionId: a.id, talento: t.talento };
      }
    }
    return primero?.talentos[0]
      ? { solucionId: primero.id, talento: primero.talentos[0].talento }
      : null;
  }, [soluciones, slugActivo, primero]);

  const elegido = activo?.talento ?? null;

  // La carpeta del talento abierto empieza desplegada; las demás, cerradas. Sigue siendo
  // estado porque desplegar y plegar es del visitante, no de la dirección.
  const [abiertos, setAbiertos] = useState<Set<number>>(
    new Set(activo ? [activo.solucionId] : []),
  );
  const [pestana, setPestana] = useState<Pestana>('proyectos');
  const [busca, setBusca] = useState('');

  const alternar = (id: number) =>
    setAbiertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  /**
   * La descripción del talento abierto.
   *
   * Se busca por todos los soluciones y se coge la primera, y es correcto: **un talento
   * pertenece a UN solo solución** (Fernando, 2026-08-18; índice único en la migración 042),
   * así que no hay una segunda que pudiera competir.
   */
  const descripcion = useMemo(() => {
    if (!elegido) return null;
    for (const a of soluciones) {
      const t = a.talentos.find((x) => x.talento === elegido);
      if (t) return t.descripcion;
    }
    return null;
  }, [soluciones, elegido]);

  const contenido: ContenidoDeTalento = (elegido && soluciones.find((a) => a.contenido[elegido])?.contenido[elegido]) || VACIO_TOTAL;

  /**
   * Los conceptos que se enseñan: los de la SOLUCIÓN que contiene el talento abierto.
   *
   * Cuelgan de la solución y no del talento a propósito —así los pidió Fernando—: describen
   * lo que sabe hacer la solución entera, no una de sus especialidades.
   */
  const conceptosActivos: Concepto[] = activo
    ? soluciones.find((a) => a.id === activo.solucionId)?.conceptos ?? []
    : [];

  /** El buscador filtra DENTRO de la pestaña abierta, que es lo que se está mirando. */
  const q = busca.trim().toLowerCase();
  const casa = (...campos: (string | null | undefined)[]) =>
    !q || campos.some((c) => (c ?? '').toLowerCase().includes(q));

  const miembros = contenido.miembros.filter((m) => casa(m.nombre, m.correo, m.telefono));
  const productos = contenido.productos.filter((p) => casa(p.nombre, p.descripcion));
  const filtraTrabajo = (l: Trabajo[]) => l.filter((t) => casa(t.titulo, t.descripcion, t.etiquetas.join(' ')));
  const tickets = filtraTrabajo(contenido.tickets);
  const proyectos = filtraTrabajo(contenido.proyectos);

  const cuantos: Record<Pestana, number> = {
    talentos: contenido.miembros.length,
    productos: contenido.productos.length,
    tickets: contenido.tickets.length,
    proyectos: contenido.proyectos.length,
  };

  const totalDe = (c: ContenidoDeTalento) =>
    c.miembros.length + c.productos.length + c.tickets.length + c.proyectos.length;

  if (soluciones.length === 0) return null;

  const vacio = (texto: string) => (
    <p className="text-[14px] text-[var(--tenue)] py-6">{texto}</p>
  );

  return (
    /* Tres paneles: carpetas · contenido · conceptos. La rejilla, el `min-w-0` de las
       columnas y el pegado de los laterales los pone `ExploradorTresPaneles`, que es la
       MISMA pieza que usa `/clientes` — se extrajo el 2026-08-18, al pedir Fernando esa
       forma para las dos páginas.

       La tercera columna **solo se reserva si la solución abierta tiene conceptos**: pasar
       `derecha` a `undefined` devuelve la rejilla a dos columnas en vez de dejar un hueco. */
    <ExploradorTresPaneles
      etiquetaIzquierda="Soluciones"
      anchoIzquierda="240px"
      anchoDerecha="280px"
      /* ── LA TIRA DE CONCEPTOS, VERSIÓN ANCHA ─────────────────────────────────
         Se pinta sola solo si hay conceptos: el propio componente devuelve `null` con la
         lista vacía. Su gemela horizontal vive en el centro, bajo la descripción; el corte
         de `lg` que oculta esta es el mismo que enseña aquella, así que nunca se ven las
         dos ni se queda la pantalla sin ninguna. */
      derecha={conceptosActivos.length > 0
        ? <TiraConceptos conceptos={conceptosActivos} />
        : undefined}
      izquierda={<>
        <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--tenue)] mb-3">
          Soluciones
        </p>
        <ul className="space-y-0.5">
          {soluciones.map((a) => {
            const abierto = abiertos.has(a.id);
            return (
              <li key={a.id} id={a.slug} className="scroll-mt-24">
                <button
                  type="button"
                  onClick={() => alternar(a.id)}
                  aria-expanded={abierto}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left transition-colors
                             hover:bg-[#7b5fbf]/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50"
                >
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 text-[var(--tenue)] transition-transform ${abierto ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  {abierto
                    ? <FolderOpen className="w-4 h-4 shrink-0 text-[var(--violeta-txt)]" aria-hidden />
                    : <Folder className="w-4 h-4 shrink-0 text-[var(--tenue)]" aria-hidden />}
                  <span className="text-[14px] font-medium text-[var(--texto)] leading-snug">{a.nombre}</span>
                </button>

                {abierto && (
                  <ul className="ml-[26px] border-l border-[var(--linea)] pl-2.5 py-0.5 space-y-0.5">
                    {a.talentos.map((t) => {
                      const esteActivo = t.talento === elegido;
                      return (
                        <li key={t.talento}>
                          <Link
                            href={`/soluciones/${t.slug}`}
                            aria-current={esteActivo ? 'true' : undefined}
                            className={`w-full flex items-baseline gap-2 rounded-md px-2 py-1.5 text-left transition-colors
                                        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50
                              ${esteActivo
                                ? 'bg-[#7b5fbf]/[0.09] text-[var(--violeta-txt)] font-medium'
                                : 'text-[var(--suave)] hover:bg-[#7b5fbf]/[0.05] hover:text-[var(--texto)]'}`}
                          >
                            <span className="text-[13px] leading-snug flex-1">{t.talento}</span>
                            <span className="text-[11px] text-[var(--apagado)] tabular-nums">
                              {totalDe(a.contenido[t.talento] ?? VACIO_TOTAL)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                    {a.talentos.length === 0 && (
                      <li className="px-2 py-1.5 text-[12.5px] text-[var(--apagado)]">Sin talentos todavía.</li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </>}
      centro={<>
        {elegido && (
          <h1 className="text-[30px] sm:text-[40px] font-semibold tracking-tight text-[var(--texto)] leading-tight">
            {elegido}
          </h1>
        )}
        {/* La descripción, si la hay. Sin ella no se pinta nada: ni recuadro ni relleno. */}
        {descripcion && (
          <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--suave)] max-w-3xl">{descripcion}</p>
        )}

        {/* ── LA TIRA DE CONCEPTOS, VERSIÓN ESTRECHA ────────────────────────────
            Bajo el ancho de `lg` no hay sitio para la tercera columna, así que la tira baja
            aquí —debajo de la descripción—, en horizontal y sin rótulo (Fernando, 2026-08-18).
            Es la MISMA instancia lógica, solo que girada: las dos se pintan siempre y es el
            CSS quien enseña una u otra. Se puede porque la oculta mide 0 y su propia regla
            («solo se mueve si no cabe») decide entonces que no cabe nada que mover: no anima
            de fondo ni gasta cuadros. */}
        <div className="alternativa-estrecha mt-5 min-w-0">
          <TiraConceptos conceptos={conceptosActivos} orientacion="horizontal" />
        </div>

        {/* El buscador, ENCIMA de las pestañas: busca dentro de la que esté abierta, y por
            eso su texto de ayuda dice cuál es — si no, no se sabe dónde está buscando. */}
        <div className="relative mt-6 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apagado)] pointer-events-none" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar en ${PESTANAS.find((p) => p.id === pestana)?.label.toLowerCase()}…`}
            aria-label={`Buscar en ${PESTANAS.find((p) => p.id === pestana)?.label}`}
            className="w-full h-11 pl-10 pr-4 rounded-lg border border-[var(--linea-fuerte)] bg-[var(--tarjeta)]
                       text-[14.5px] text-[var(--texto)] placeholder:text-[var(--apagado)]
                       focus:border-[#7b5fbf]/60 focus:outline-none transition-colors"
          />
        </div>

        {/* Las cuatro pestañas. Siempre las cuatro. */}
        <div role="tablist" aria-label="Contenido del talento" className="mt-5 flex flex-wrap gap-1.5 border-b border-[var(--linea)] pb-3">
          {PESTANAS.map((p) => {
            const activa = p.id === pestana;
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={activa}
                type="button"
                onClick={() => setPestana(p.id)}
                className={`inline-flex items-baseline gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7b5fbf]/50
                  ${activa
                    ? 'border-[#7b5fbf]/55 bg-[#7b5fbf]/[0.1] text-[var(--violeta-txt)] font-medium'
                    : 'border-[var(--linea)] text-[var(--suave)] hover:border-[var(--linea-fuerte)] hover:text-[var(--texto)]'}`}
              >
                {p.label}
                <span className="text-[11px] text-[var(--apagado)] tabular-nums">{cuantos[p.id]}</span>
              </button>
            );
          })}
        </div>

        <div role="tabpanel" className="mt-6">
          {pestana === 'talentos' && (
            miembros.length === 0
              ? vacio(q ? 'Ningún miembro coincide con la búsqueda.' : 'Todavía no hay miembros con este talento.')
              : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {miembros.map((m) => <TarjetaMiembro key={m.memberId} miembro={m} />)}
                </div>
              )
          )}

          {pestana === 'productos' && (
            productos.length === 0
              ? vacio(q ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos en este talento.')
              : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {productos.map((p) => <TarjetaProducto key={p.id} producto={p} />)}
                </div>
              )
          )}

          {pestana === 'tickets' && (
            tickets.length === 0
              ? vacio(q ? 'Ningún ticket coincide con la búsqueda.' : 'Todavía no hay tickets terminados con este talento.')
              : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {tickets.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}
                </div>
              )
          )}

          {pestana === 'proyectos' && (
            proyectos.length === 0
              ? vacio(q ? 'Ningún proyecto coincide con la búsqueda.' : 'Todavía no hay proyectos terminados con este talento.')
              : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {proyectos.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}
                </div>
              )
          )}
        </div>

        {/* ⭐ TODO LO DEMÁS, PARA QUIEN NO PULSA NADA — un buscador, sobre todo.
            Se pinta como nodos de verdad y se oculta con `hidden`, que NO lo saca del HTML.
            Sin esto Google vería una pestaña de un talento, y se perdería el resto. */}
        <div hidden aria-hidden="true">
          {soluciones.map((a) =>
            a.talentos.map((t) => {
              const c = a.contenido[t.talento] ?? VACIO_TOTAL;
              return (
                <section key={`${a.id}-${t.talento}`}>
                  <h2>{a.nombre} · {t.talento}</h2>
                  {t.descripcion && <p>{t.descripcion}</p>}
                  {[...c.proyectos, ...c.tickets].map((w) => (
                    <article key={`${w.tipo}-${w.id}`}>
                      <h3>{w.titulo}</h3>
                      {w.descripcion && <p>{w.descripcion}</p>}
                      {w.etiquetas.length > 0 && <p>{w.etiquetas.join(', ')}</p>}
                    </article>
                  ))}
                  {c.productos.map((pr) => (
                    <article key={`prod-${pr.id}`}>
                      <h3>{pr.nombre}</h3>
                      {pr.descripcion && <p>{pr.descripcion}</p>}
                    </article>
                  ))}
                </section>
              );
            }),
          )}
        </div>
      </>}
    />
  );
}
