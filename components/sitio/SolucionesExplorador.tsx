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

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FolderOpen, Mail, Phone, Search } from 'lucide-react';
import type {
  Solucion, ContenidoDeTalento, MiembroConTalento, Producto, Trabajo, Concepto,
} from '@/lib/soluciones';
import TarjetaTrabajo from './TarjetaTrabajo';
import PuertasBloques from './PuertasBloques';
import { ICONOS } from './piezas';

export interface SolucionConContenido extends Solucion {
  /** El contenido de cada talento, ya consultado en el servidor. */
  contenido: Record<string, ContenidoDeTalento>;
  /**
   * Los conceptos de CADA TALENTO, para la tira vertical del panel derecho.
   *
   * Cuelgan del talento desde la migración 051 (Fernando, 2026-08-21): los once de
   * Tecnología son formas de ejercer «Automatización de procesos», no cosas que sepa hacer
   * la solución entera. Con un segundo talento en el mismo cajón, la tira le habría
   * enseñado once conceptos que no son suyos.
   */
  conceptos: Record<string, Concepto[]>;
}

type Pestana = 'talentos' | 'productos' | 'tickets' | 'proyectos';

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: 'talentos', label: 'Talentos' },
  { id: 'productos', label: 'Productos' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'proyectos', label: 'Proyectos' },
];

/** El orden en pantalla: lo terminado primero, las personas al final. */
const ORDEN_PESTANAS: Pestana[] = ['proyectos', 'tickets', 'productos', 'talentos'];

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
          {/* Igual que en el marketplace: la captura llega ya desenfocada del servidor y
              esto es el acabado. La foto del miembro, arriba, NO se toca: es una persona
              del equipo, no una pantalla con datos de nadie. */}
          <img src={producto.imagen} alt="" loading="lazy" className="w-full h-full object-cover blur-[1px]" />
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

  const [pestana, setPestana] = useState<Pestana>('proyectos');
  const [busca, setBusca] = useState('');

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
   * Los conceptos que se enseñan: los del TALENTO abierto (migración 051).
   *
   * Se busca por todas las soluciones porque un talento pertenece a una sola (migración
   * 042): la primera que lo tenga es la única que puede tenerlo.
   */
  const conceptosActivos: Concepto[] = elegido
    ? soluciones.find((a) => a.conceptos[elegido]?.length)?.conceptos[elegido] ?? []
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

  // Todos los talentos, con su solución, para el selector de arriba.
  const todosLosTalentos = soluciones.flatMap((a) =>
    a.talentos.map((t) => ({ ...t, solucion: a.nombre, total: totalDe(a.contenido[t.talento] ?? VACIO_TOTAL) })),
  );
  const solucionDelElegido = soluciones.find((a) => a.talentos.some((t) => t.talento === elegido))?.nombre;

  return (
    <div className="soluciones-sitio">
      {/* ── LOS TALENTOS, COMO PUERTAS (Fernando, 2026-10-29: «el diseño está muy mal para mostrar
          el contenido… usa tu reformulación») ──────────────────────────────────────────────
          Sustituye a las carpetas del panel izquierdo. Desde el 2026-10-30, `PuertasBloques` como en
          Clientes y Desarrollo Humano: un bloque por SOLUCIÓN con sus talentos en filas y la cuenta
          de trabajos, para que crezca sin encogerse («a futuro se va a llegar a crear más
          soluciones», Fernando). Cada talento sigue siendo una URL. Para la versión con carpetas y tres
          paneles: `git show 8d23d58e:components/sitio/SolucionesExplorador.tsx`. */}
      <PuertasBloques
        etiquetaNav="Talentos"
        activa={elegido}
        puertas={todosLosTalentos.map((t) => ({
          id: t.talento,
          href: `/soluciones/${t.slug}`,
          titulo: t.talento,
          texto: `${t.total} ${t.total === 1 ? 'trabajo' : 'trabajos'}`,
          grupo: t.solucion,
          icono: <FolderOpen />,
        }))}
      />

      <div className="mt-[clamp(36px,5vw,64px)]">
        {solucionDelElegido && (
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--violeta-txt)]">
            {solucionDelElegido}
          </p>
        )}
        {elegido && (
          <h1 className="mt-2 text-[32px] sm:text-[44px] tracking-tight text-[var(--texto)] leading-[1.05]">
            {elegido}
          </h1>
        )}
        {/* La descripción, si la hay. Sin ella no se pinta nada: ni recuadro ni relleno. */}
        {descripcion && (
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--suave)] max-w-3xl">{descripcion}</p>
        )}
      </div>

      {/* ── LO QUE SABEMOS HACER, EN REJILLA ──────────────────────────────────────────────
          Era una tira que se movía sola en una columna a la derecha y robaba ancho a los
          trabajos. Ahora es una rejilla quieta (4/3/2/1 columnas), entera y sin deslizar. */}
      {conceptosActivos.length > 0 && (
        <section aria-label="Productos y Servicios asociados" className="mt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--violeta-txt)]">
            Productos y Servicios asociados
          </p>
          <ul className="conceptos-rejilla mt-4">
            {conceptosActivos.map((c) => {
              const Icono = ICONOS[c.icono] ?? ICONOS.capas;
              return (
                <li key={c.id} className="concepto-celda">
                  <span className="puerta-icono" aria-hidden><Icono /></span>
                  <span className="min-w-0">
                    <span className="concepto-titulo">{c.titulo}</span>
                    {c.descripcion && <span className="concepto-texto">{c.descripcion}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── LO HECHO: SELECTOR SEGMENTADO + BUSCADOR ─────────────────────────────────────
          Las cuatro pestañas siguen siendo siempre cuatro (es la navegación), ahora como un
          control segmentado con cápsula que se desliza y la cuenta al lado; en el teléfono, un
          selector nativo a todo el ancho (regla de `/diseno` §4-ter). El buscador, en la misma
          fila, busca dentro de la pestaña abierta. */}
      <section aria-label="Trabajo terminado" className="mt-12">
        <div className="barra-trabajos">
          <SelectorPestanas pestana={pestana} cuantos={cuantos} onCambiar={setPestana} />
          <div className="relative w-full sm:w-[320px] sm:shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--apagado)] pointer-events-none" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar en ${PESTANAS.find((p) => p.id === pestana)?.label.toLowerCase()}…`}
              aria-label={`Buscar en ${PESTANAS.find((p) => p.id === pestana)?.label}`}
              className="w-full h-11 pl-10 pr-4 rounded-full border border-[var(--linea-fuerte)] bg-white/85
                         text-[14.5px] text-[var(--texto)] placeholder:text-[var(--apagado)]
                         focus:border-[#7b5fbf]/60 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div role="tabpanel" className="mt-6">
          {pestana === 'talentos' && (
            miembros.length === 0
              ? vacio(q ? 'Ningún miembro coincide con la búsqueda.' : 'Todavía no hay miembros con este talento.')
              : <div className="rejilla-trabajos">{miembros.map((m) => <TarjetaMiembro key={m.memberId} miembro={m} />)}</div>
          )}
          {pestana === 'productos' && (
            productos.length === 0
              ? vacio(q ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos en este talento.')
              : <div className="rejilla-trabajos">{productos.map((p) => <TarjetaProducto key={p.id} producto={p} />)}</div>
          )}
          {pestana === 'tickets' && (
            tickets.length === 0
              ? vacio(q ? 'Ningún ticket coincide con la búsqueda.' : 'Todavía no hay tickets terminados con este talento.')
              : <div className="rejilla-trabajos">{tickets.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}</div>
          )}
          {pestana === 'proyectos' && (
            proyectos.length === 0
              ? vacio(q ? 'Ningún proyecto coincide con la búsqueda.' : 'Todavía no hay proyectos terminados con este talento.')
              : <div className="rejilla-trabajos">{proyectos.map((t) => <TarjetaTrabajo key={t.id} trabajo={t} />)}</div>
          )}
        </div>
      </section>

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
    </div>
  );
}

/**
 * EL SELECTOR DE PESTAÑAS — control segmentado con cápsula que se desliza (escritorio) y
 * `<select>` nativo (teléfono). Orden: lo que más se busca primero.
 */
function SelectorPestanas({
  pestana, cuantos, onCambiar,
}: {
  pestana: Pestana;
  cuantos: Record<Pestana, number>;
  onCambiar: (p: Pestana) => void;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const capsulaRef = useRef<HTMLSpanElement>(null);
  const [lista, setLista] = useState(false);
  useLayoutEffect(() => {
    const marco = marcoRef.current;
    const capsula = capsulaRef.current;
    if (!marco || !capsula) return;
    const colocar = () => {
      const b = marco.querySelector<HTMLElement>(`[data-pestana="${pestana}"]`);
      if (!b) return;
      capsula.style.transform = `translateX(${b.offsetLeft}px)`;
      capsula.style.width = `${b.offsetWidth}px`;
    };
    colocar();
    setLista(true);
    const ro = new ResizeObserver(colocar);
    ro.observe(marco);
    return () => ro.disconnect();
  }, [pestana]);

  return (
    <>
      <div ref={marcoRef} role="tablist" aria-label="Contenido del talento" className="segmentado-trabajos">
        <span ref={capsulaRef} className={`segmentado-capsula ${lista ? 'es-lista' : ''}`} aria-hidden />
        {ORDEN_PESTANAS.map((id) => {
          const p = PESTANAS.find((x) => x.id === id)!;
          const activa = id === pestana;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              data-pestana={id}
              aria-selected={activa}
              onClick={() => onCambiar(id)}
              className={`segmentado-opcion ${activa ? 'es-activa' : ''}`}
            >
              {p.label}
              <span className="segmentado-cuenta">{cuantos[id]}</span>
            </button>
          );
        })}
      </div>
      <label className="segmentado-movil">
        <span className="sr-only">Ver</span>
        <select value={pestana} onChange={(e) => onCambiar(e.target.value as Pestana)}>
          {ORDEN_PESTANAS.map((id) => (
            <option key={id} value={id}>
              Ver: {PESTANAS.find((x) => x.id === id)!.label} · {cuantos[id]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

