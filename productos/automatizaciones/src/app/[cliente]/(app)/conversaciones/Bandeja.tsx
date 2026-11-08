'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, Hand, Search, AlertCircle, Bot, Tag, SendHorizontal, Plus, Check, CheckCheck,
  Camera, Mic, Video, FileText, MapPin, Sticker, Info, Phone, Coins, MessagesSquare, MessageCircleMore,
  ListChecks, X, UserRound, CircleDot, Clock, CircleCheck, Eraser, Trash2, SlidersHorizontal, Users, Settings2,
} from 'lucide-react';
import { Boton, BotonIcono, Insignia, Ventanita, Entrada, PanelLateral, Confirmar } from '@/componentes/ui';
import { MenuFila, MenuBoton, type AccionMenu } from '@/componentes/Navegacion';
import { cambiarBot, etiquetarContacto, responder, marcarVista, accionMasiva, type AccionMasiva } from '@/acciones/conversaciones';
import { costoEnDolares, costoLegible } from '@/lib/ia/precios';
import { cn } from '@/lib/utils';
import { miles, horaCorta, cuandoEnLista, separadorDia, claveDia } from '@/lib/formato';

type Estado = 'ABIERTO' | 'EN_PROCESO' | 'CERRADO';

export type ConversacionLista = {
  id: number;
  nombre: string;
  numero: string;
  ultimo: string | null;
  botActivo: boolean;
  tomadaPor: string | null;
  etiquetas: string[];
  /** La persona responsable (2026-11-08). */
  asignadaA: string | null;
  estado: Estado;
  /** El último mensaje, para la vista previa de la fila (como WhatsApp). */
  vistaPrevia: { nuestro: boolean; texto: string | null; tipo: string; estado: string | null } | null;
  /** Mensajes del contacto que el equipo aún no ha visto. */
  sinLeer: number;
};

export type MensajeVista = {
  id: number;
  direccion: 'ENTRANTE' | 'SALIENTE';
  texto: string | null;
  tipo: string;
  herramienta: string | null;
  enviadoOk: boolean | null;
  errorEnvio: string | null;
  creado: string;
  /** Acuse de Meta: sent / delivered / read / failed. */
  estado: string | null;
};

export type Gasto = { corridas: number; entrada: number; salida: number; cache_lectura: number };

type Abierta = {
  id: number;
  nombre: string;
  numero: string;
  botActivo: boolean;
  tomadaPor: string | null;
  contactoId: number;
  asignadaA: { id: number; nombre: string } | null;
  estado: Estado;
  etiquetas: string[];
  /** ¿Sigue abierta la ventana de 24 h de WhatsApp para escribir libremente? */
  ventanaAbierta: boolean;
};

const NOMBRE_ESTADO: Record<Estado, string> = { ABIERTO: 'Abierto', EN_PROCESO: 'En proceso', CERRADO: 'Cerrado' };
const PARAM_ESTADO: Record<Estado, string> = { ABIERTO: 'abierto', EN_PROCESO: 'enproceso', CERRADO: 'cerrado' };

/*
  LA BANDEJA, COMO WHATSAPP DE ESCRITORIO (Fernando, 2026-11-08).

  · Tres columnas: el PANEL DE FILTROS (Bandeja · Estado · Etiquetas · Usuarios, cada grupo en su
    sitio; Etiquetas y Usuarios con su buscador y su desplazamiento propio, porque crecen sin
    límite), la lista de chats y el chat.
  · Selección múltiple con «Opciones»: etiquetas, usuario, estado, borrar mensajes, eliminar.
  · Colores de WhatsApp oscuro (`.tema-wa`).

  ⚠️ La Cloud API NO da la foto de perfil del contacto: el avatar es su inicial sobre un color fijo.
  ⚠️ En el teléfono la lista y el chat se ALTERNAN; el panel de filtros se abre con «Filtros».
*/

/** Las etiquetas de un contacto: texto de color, sin cápsula. `<span>` porque va dentro de un `<p>`. */
function Etiquetas({ nombres, className }: { nombres: string[]; className?: string }) {
  if (!nombres.length) return null;
  return (
    <span className={cn('flex min-w-0 items-center gap-1 text-[11px] font-medium text-acento', className)}>
      <Tag className="h-3 w-3 shrink-0" />
      <span className="truncate">{nombres.join(' · ')}</span>
    </span>
  );
}

/** El avatar: inicial blanca sobre un color fijo por número (la API no da la foto). */
const COLORES = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6'];
function Avatar({ nombre, semilla, tamano = 48 }: { nombre: string; semilla: string; tamano?: number }) {
  let h = 0;
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const letra = (nombre.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0) || '#').toUpperCase();
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', COLORES[h % COLORES.length])}
      style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.4) }}
    >
      {letra}
    </span>
  );
}

/** ✓ enviado · ✓✓ entregado · ✓✓ azul leído · ⚠ no salió. */
function Acuse({ estado, className }: { estado: string | null; className?: string }) {
  if (estado === 'failed') return <AlertCircle className={cn('h-3.5 w-3.5 text-error', className)} aria-label="No salió" />;
  if (estado === 'read') return <CheckCheck className={cn('h-4 w-4 text-leido', className)} aria-label="Leído" />;
  if (estado === 'delivered') return <CheckCheck className={cn('h-4 w-4', className)} aria-label="Entregado" />;
  return <Check className={cn('h-4 w-4', className)} aria-label="Enviado" />;
}

/** Lo que no es texto, como lo resume WhatsApp: icono + palabra. */
const TIPOS: Record<string, { icono: React.ComponentType<{ className?: string }>; nombre: string }> = {
  image: { icono: Camera, nombre: 'Foto' },
  audio: { icono: Mic, nombre: 'Audio' },
  voice: { icono: Mic, nombre: 'Audio' },
  video: { icono: Video, nombre: 'Video' },
  document: { icono: FileText, nombre: 'Documento' },
  location: { icono: MapPin, nombre: 'Ubicación' },
  sticker: { icono: Sticker, nombre: 'Sticker' },
};
function Contenido({ texto, tipo }: { texto: string | null; tipo: string }) {
  const t = TIPOS[tipo];
  if (!t) return <>{texto || `[${tipo}]`}</>;
  const Icono = t.icono;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Icono className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{texto || t.nombre}</span>
    </span>
  );
}

/** Un botón de filtro redondo (teléfono), como WhatsApp en el móvil. */
function Filtro({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'true' : undefined}
      className={cn(
        'foco-visible inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors',
        activo ? 'bg-acento-suave font-semibold text-acento' : 'bg-realce text-tenue hover:text-texto',
      )}
    >
      {children}
    </Link>
  );
}

type ItemFiltro = { clave: string; nombre: string; icono: React.ComponentType<{ className?: string }>; n: number; href: string; activo: boolean };

/** Una fila del panel de filtros: icono, nombre y su cuenta a la derecha (como «Chats 10»). */
function FiltroPanel({ nombre, icono: Icono, n, href, activo, alElegir }: ItemFiltro & { alElegir?: () => void }) {
  return (
    <Link
      href={href}
      onClick={alElegir}
      aria-current={activo ? 'page' : undefined}
      className={cn(
        'foco-visible flex h-9 shrink-0 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors',
        activo ? 'bg-realce font-semibold text-texto' : 'text-texto hover:bg-realce/60',
      )}
    >
      <Icono className="h-[18px] w-[18px] shrink-0 text-tenue" />
      <span className="min-w-0 flex-1 truncate">{nombre}</span>
      {n > 0 && <span className="text-[12px] tabular-nums text-tenue">{n}</span>}
    </Link>
  );
}

/**
 * Un grupo que crece sin límite (Etiquetas, Usuarios): su título, su buscador y su lista con
 * desplazamiento PROPIO, en el espacio que le toca del panel (Fernando, 2026-11-08: «no podemos
 * dejar que etiquetas se expanda hasta el infinito ni tampoco usuarios»).
 */
function GrupoBuscable({ titulo, items, alElegir, vacio }: { titulo: string; items: ItemFiltro[]; alElegir?: () => void; vacio: string }) {
  const [busca, setBusca] = useState('');
  const t = busca.trim().toLowerCase();
  const vistos = t ? items.filter((x) => x.nombre.toLowerCase().includes(t)) : items;
  return (
    <section className="flex min-h-[150px] flex-1 flex-col border-t border-borde pt-2">
      <p className="px-3 pb-1.5 text-[12px] font-medium text-tenue">{titulo}</p>
      <div className="relative mx-1 mb-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tenue" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar ${titulo.toLowerCase()}`}
          aria-label={`Buscar ${titulo.toLowerCase()}`}
          className="campo h-8 rounded-full border-transparent bg-realce pl-8 text-[12.5px] focus:border-transparent"
        />
      </div>
      <div className="desplaza flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {vistos.length ? vistos.map((x) => <FiltroPanel key={x.clave} {...x} alElegir={alElegir} />)
          : <p className="px-3 py-2 text-[12.5px] text-tenue">{t ? 'Sin resultados' : vacio}</p>}
      </div>
    </section>
  );
}

/** El panel de filtros entero: el mismo en la columna de escritorio y en el panel del teléfono. */
function PanelFiltros({ bandeja, estados, etiquetas, usuarios, alElegir }: {
  bandeja: ItemFiltro[]; estados: ItemFiltro[]; etiquetas: ItemFiltro[]; usuarios: ItemFiltro[]; alElegir?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-0.5">
      <div className="flex shrink-0 flex-col gap-0.5 pb-2">
        {bandeja.map((x) => <FiltroPanel key={x.clave} {...x} alElegir={alElegir} />)}
      </div>
      <section className="flex shrink-0 flex-col gap-0.5 border-t border-borde py-2">
        <p className="px-3 pb-1 text-[12px] font-medium text-tenue">Estado</p>
        {estados.map((x) => <FiltroPanel key={x.clave} {...x} alElegir={alElegir} />)}
      </section>
      <GrupoBuscable titulo="Etiquetas" items={etiquetas} alElegir={alElegir} vacio="Sin etiquetas" />
      <GrupoBuscable titulo="Usuarios" items={usuarios} alElegir={alElegir} vacio="Sin usuarios" />
    </div>
  );
}

type Dialogo =
  | { tipo: 'etiquetas'; ids: number[] }
  | { tipo: 'asignar'; ids: number[]; actual: number | null }
  | { tipo: 'borrar'; ids: number[] }
  | { tipo: 'eliminar'; ids: number[] };

export default function Bandeja({
  slug,
  lista,
  busca,
  etiquetas,
  etiquetaId,
  filtro,
  cuentas,
  estados,
  estadoFiltro,
  usuarios,
  sinAsignar,
  usuarioFiltro,
  esAdmin,
  abierta,
  mensajes,
  gasto,
  zona,
  puedeOperar,
}: {
  slug: string;
  lista: ConversacionLista[];
  busca: string;
  etiquetas: { id: number; nombre: string; n: number }[];
  etiquetaId: number | null;
  /** Filtro de la lista: «No leídos», «Tomadas» o ninguno (Todos). */
  filtro: 'noleidos' | 'tomadas' | null;
  cuentas: { todas: number; noLeidas: number; tomadas: number };
  estados: Record<Estado, number>;
  estadoFiltro: Estado | null;
  usuarios: { id: number; nombre: string; n: number }[];
  sinAsignar: number;
  usuarioFiltro: number | 'ninguno' | null;
  esAdmin: boolean;
  abierta: Abierta | null;
  mensajes: MensajeVista[];
  gasto: Gasto | null;
  zona: string;
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(busca);
  const [cambiando, arranca] = useTransition();
  const [mensaje, setMensaje] = useState('');
  const [enviando, arrancaEnvio] = useTransition();
  const [enMasa, arrancaMasa] = useTransition();
  const [editarEtiquetas, setEditarEtiquetas] = useState(false);
  const [datos, setDatos] = useState(false);
  const [filtrosTel, setFiltrosTel] = useState(false);
  const [seleccionando, setSeleccionando] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);

  // Abrirla la marca como vista: deja de contar como «sin leer».
  useEffect(() => { if (abierta) void marcarVista(slug, abierta.id); }, [slug, abierta?.id]);
  // Como WhatsApp, el chat se abre en el ÚLTIMO mensaje (y baja cuando llega o sale uno nuevo).
  const hilo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = hilo.current;
    if (h) h.scrollTop = h.scrollHeight;
  }, [abierta?.id, mensajes.length]);

  // La dirección lleva los filtros (se combinan): bandeja, estado, etiqueta, usuario, búsqueda.
  type Url = { q?: string; f?: 'noleidos' | 'tomadas' | null; s?: Estado | null; e?: number | null; u?: number | 'ninguno' | null; c?: number | null };
  const url = (o: Url) => {
    const p = new URLSearchParams();
    const q = o.q ?? busca;
    const f = o.f === undefined ? filtro : o.f;
    const s = o.s === undefined ? estadoFiltro : o.s;
    const e = o.e === undefined ? etiquetaId : o.e;
    const u = o.u === undefined ? usuarioFiltro : o.u;
    if (q) p.set('q', q);
    if (f) p.set('f', f);
    if (s) p.set('s', PARAM_ESTADO[s]);
    if (e) p.set('e', String(e));
    if (u) p.set('u', String(u));
    if (o.c) p.set('c', String(o.c));
    const t = p.toString();
    return `/${slug}/conversaciones${t ? `?${t}` : ''}`;
  };

  // Los grupos del panel. Tocar el elegido otra vez lo quita (se pueden combinar grupos).
  const bandeja: ItemFiltro[] = [
    { clave: 'todos', nombre: 'Todos', icono: MessagesSquare, n: cuentas.todas, href: url({ f: null, s: null, e: null, u: null, c: null }), activo: !filtro && !estadoFiltro && !etiquetaId && !usuarioFiltro },
    { clave: 'noleidos', nombre: 'No leídos', icono: MessageCircleMore, n: cuentas.noLeidas, href: url({ f: filtro === 'noleidos' ? null : 'noleidos', c: null }), activo: filtro === 'noleidos' },
    { clave: 'tomadas', nombre: 'Tomadas', icono: Hand, n: cuentas.tomadas, href: url({ f: filtro === 'tomadas' ? null : 'tomadas', c: null }), activo: filtro === 'tomadas' },
  ];
  const ICONO_ESTADO: Record<Estado, React.ComponentType<{ className?: string }>> = { ABIERTO: CircleDot, EN_PROCESO: Clock, CERRADO: CircleCheck };
  const itemsEstado: ItemFiltro[] = (['ABIERTO', 'EN_PROCESO', 'CERRADO'] as Estado[]).map((s) => ({
    clave: s, nombre: NOMBRE_ESTADO[s], icono: ICONO_ESTADO[s], n: estados[s], href: url({ s: estadoFiltro === s ? null : s, c: null }), activo: estadoFiltro === s,
  }));
  const itemsEtiqueta: ItemFiltro[] = etiquetas.map((t) => ({
    clave: `e${t.id}`, nombre: t.nombre, icono: Tag, n: t.n, href: url({ e: etiquetaId === t.id ? null : t.id, c: null }), activo: etiquetaId === t.id,
  }));
  const itemsUsuario: ItemFiltro[] = [
    { clave: 'sin', nombre: 'Sin asignar', icono: UserRound, n: sinAsignar, href: url({ u: usuarioFiltro === 'ninguno' ? null : 'ninguno', c: null }), activo: usuarioFiltro === 'ninguno' },
    ...usuarios.map((x) => ({
      clave: `u${x.id}`, nombre: x.nombre, icono: UserRound, n: x.n, href: url({ u: usuarioFiltro === x.id ? null : x.id, c: null }), activo: usuarioFiltro === x.id,
    })),
  ];
  const activos = [...bandeja.slice(1), ...itemsEstado, ...itemsEtiqueta, ...itemsUsuario].filter((x) => x.activo).map((x) => x.nombre);
  const titulo = activos.length ? activos.join(' · ') : 'Todos';

  function alternarBot() {
    if (!abierta) return;
    arranca(async () => {
      const r = await cambiarBot(slug, abierta.id, !abierta.botActivo);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  }

  function enviar() {
    if (!abierta || !mensaje.trim()) return;
    arrancaEnvio(async () => {
      const r = await responder(slug, abierta.id, mensaje);
      if (!r.ok) { toast.error(r.error, { duration: 10000 }); return; }
      setMensaje('');
      router.refresh();
    });
  }

  /** Ejecuta una acción sobre varias conversaciones (o una) y deja la pantalla al día. */
  function ejecutar(ids: number[], accion: AccionMasiva, hecho: string) {
    arrancaMasa(async () => {
      const r = await accionMasiva(slug, ids, accion);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(hecho);
      setDialogo(null);
      setSel(new Set());
      setSeleccionando(false);
      // Si se eliminó la conversación abierta, se vuelve a la lista.
      if (accion.tipo === 'eliminar' && abierta && ids.includes(abierta.id)) router.push(url({ c: null }));
      else router.refresh();
    });
  }

  /** Las opciones para unas conversaciones: las mismas en «Opciones» (varias) y en el «⋯» (una). */
  function opciones(ids: number[], actual?: { estado: Estado; asignada: number | null }): AccionMenu[] {
    if (!puedeOperar || !ids.length) return [];
    const estadosOp: AccionMenu[] = (['ABIERTO', 'EN_PROCESO', 'CERRADO'] as Estado[])
      .filter((s) => s !== actual?.estado)
      .map((s) => ({
        etiqueta: `Marcar ${NOMBRE_ESTADO[s].toLowerCase()}`,
        icono: ICONO_ESTADO[s],
        deshabilitado: enMasa,
        alPulsar: () => ejecutar(ids, { tipo: 'estado', estado: s }, 'Estado cambiado.'),
      }));
    return [
      { etiqueta: 'Asignar etiquetas', icono: Tag, alPulsar: () => setDialogo({ tipo: 'etiquetas', ids }) },
      { etiqueta: 'Asignar usuario', icono: UserRound, alPulsar: () => setDialogo({ tipo: 'asignar', ids, actual: actual?.asignada ?? null }) },
      ...estadosOp,
      ...(esAdmin
        ? [
            { etiqueta: 'Borrar mensajes', icono: Eraser, peligro: true, alPulsar: () => setDialogo({ tipo: 'borrar', ids }) },
            { etiqueta: ids.length > 1 ? 'Eliminar contactos' : 'Eliminar contacto', icono: Trash2, peligro: true, alPulsar: () => setDialogo({ tipo: 'eliminar', ids }) },
          ]
        : []),
    ];
  }

  const idsSel = [...sel];
  const alternarSel = (id: number) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todosSel = lista.length > 0 && lista.every((c) => sel.has(c.id));

  const quienAtiende = abierta ? (abierta.botActivo ? 'Lo atiende el agente' : `Lo atiende ${abierta.tomadaPor ?? 'el equipo'}`) : '';
  const costo = gasto && gasto.corridas > 0
    ? costoLegible(costoEnDolares({ tokensEntrada: gasto.entrada, tokensSalida: gasto.salida, tokensCacheLectura: gasto.cache_lectura }))
    : null;

  return (
    <div className="tema-wa flex h-full min-h-0 bg-tarjeta">
      {/* ── EL PANEL DE FILTROS (escritorio): cada grupo en su sitio, con desplazamiento propio. */}
      <nav aria-label="Filtros" className="hidden w-[240px] shrink-0 border-r border-borde bg-wa-panel px-2 py-3 lg:block">
        <PanelFiltros bandeja={bandeja} estados={itemsEstado} etiquetas={itemsEtiqueta} usuarios={itemsUsuario} />
      </nav>

      {/* ── LOS CHATS. En el teléfono desaparecen cuando hay uno abierto. */}
      <section
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-borde lg:flex lg:w-[380px]',
          abierta && 'hidden lg:flex',
        )}
      >
        {seleccionando ? (
          /* La barra de selección: cuántos, «Opciones» y salir. */
          <div className="flex min-h-[68px] items-center gap-2 px-3">
            <BotonIcono icono={X} titulo="Salir de la selección" onClick={() => { setSeleccionando(false); setSel(new Set()); }} />
            <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold text-texto">
              <input
                type="checkbox"
                checked={todosSel}
                onChange={() => setSel(todosSel ? new Set() : new Set(lista.map((c) => c.id)))}
                className="h-4 w-4 accent-[var(--color-acento)]"
                aria-label="Seleccionar todos"
              />
              {sel.size} {sel.size === 1 ? 'seleccionado' : 'seleccionados'}
            </label>
            <span className="ml-auto">
              {sel.size > 0 && <MenuBoton texto="Opciones" icono={Settings2} acciones={opciones(idsSel)} />}
            </span>
          </div>
        ) : (
          <div className="flex min-h-[68px] items-center gap-2 px-4">
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-texto">{titulo}</h1>
            {puedeOperar && lista.length > 0 && (
              <BotonIcono icono={ListChecks} titulo="Seleccionar" onClick={() => setSeleccionando(true)} />
            )}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); router.push(url({ q: texto.trim(), c: null })); }}
          className="px-3 pb-2"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar por nombre o número"
              className="campo h-9 rounded-full border-transparent bg-realce pl-10 focus:border-transparent"
            />
          </div>
        </form>
        {/* En el teléfono: los de la bandeja en botones y el resto en el panel «Filtros». */}
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 lg:hidden">
          {bandeja.map((x) => <Filtro key={x.clave} href={x.href} activo={x.activo}>{x.nombre}</Filtro>)}
          <button
            type="button"
            onClick={() => setFiltrosTel(true)}
            className={cn(
              'foco-visible inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors',
              estadoFiltro || etiquetaId || usuarioFiltro ? 'bg-acento-suave font-semibold text-acento' : 'bg-realce text-tenue hover:text-texto',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {lista.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-tenue">
              {activos.length || busca ? 'Sin resultados' : 'Sin conversaciones'}
            </p>
          )}
          {lista.map((c) => {
            const marcado = sel.has(c.id);
            const fila = (
              <>
                {seleccionando && (
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', marcado ? 'border-acento bg-acento text-acento-contraste' : 'border-tenue')}>
                    {marcado && <Check className="h-3.5 w-3.5" />}
                  </span>
                )}
                <Avatar nombre={c.nombre} semilla={c.numero} />
                <div className="min-w-0 flex-1 border-b border-borde py-3 text-left">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn('truncate text-[15px] text-texto', c.sinLeer > 0 ? 'font-semibold' : 'font-medium')}>{c.nombre}</p>
                    <span className={cn('shrink-0 text-[12px]', c.sinLeer > 0 ? 'font-semibold text-wa' : 'text-tenue')}>
                      {c.ultimo ? cuandoEnLista(c.ultimo, zona) : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 text-[13px] text-tenue">
                      {c.vistaPrevia?.nuestro && <Acuse estado={c.vistaPrevia.estado} className="shrink-0" />}
                      {c.vistaPrevia
                        ? <span className="min-w-0 truncate"><Contenido texto={c.vistaPrevia.texto} tipo={c.vistaPrevia.tipo} /></span>
                        : 'Sin mensajes'}
                    </p>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {!c.botActivo && <Hand className="h-4 w-4 text-tenue" aria-label="La atiende una persona" />}
                      {c.sinLeer > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-wa px-1.5 text-[11px] font-semibold text-white" aria-label={`${c.sinLeer} sin leer`}>
                          {c.sinLeer}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Estado (si no es «Abierto»), responsable y etiquetas: texto de color, sin cápsulas. */}
                  {(c.estado !== 'ABIERTO' || c.asignadaA || c.etiquetas.length > 0) && (
                    <span className="mt-0.5 flex min-w-0 items-center gap-2.5 text-[11px]">
                      {c.estado !== 'ABIERTO' && (
                        <span className={cn('shrink-0 font-medium', c.estado === 'CERRADO' ? 'text-tenue' : 'text-aviso')}>{NOMBRE_ESTADO[c.estado]}</span>
                      )}
                      {c.asignadaA && (
                        <span className="flex shrink-0 items-center gap-1 text-tenue"><UserRound className="h-3 w-3" />{c.asignadaA.split(' ')[0]}</span>
                      )}
                      <Etiquetas nombres={c.etiquetas} />
                    </span>
                  )}
                </div>
              </>
            );
            const clases = cn(
              'flex w-full items-center gap-3 rounded-lg px-2 transition-colors',
              abierta?.id === c.id || marcado ? 'bg-realce' : 'hover:bg-realce/60',
            );
            return seleccionando ? (
              <button key={c.id} type="button" onClick={() => alternarSel(c.id)} aria-pressed={marcado} className={cn(clases, 'foco-visible')}>{fila}</button>
            ) : (
              <Link key={c.id} href={url({ c: c.id })} className={clases}>{fila}</Link>
            );
          })}
        </div>
      </section>

      {/* ── EL CHAT. En el teléfono ocupa la pantalla entera. */}
      <section className={cn('flex min-w-0 flex-1 flex-col', !abierta && 'hidden lg:flex')}>
        {!abierta ? (
          <div className="fondo-chat flex flex-1 items-center justify-center px-6">
            <p className="rounded-md bg-burbuja-otra px-3 py-1.5 text-center text-[13px] text-tenue shadow-sm">Elige una conversación.</p>
          </div>
        ) : (
          <>
            <header className="flex min-h-[68px] items-center gap-2 border-b border-borde bg-tarjeta px-3">
              <Link
                href={url({ c: null })}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-tenue hover:bg-realce lg:hidden"
                aria-label="Volver a la lista"
              >
                <ChevronLeft className="h-6 w-6" />
              </Link>
              {/* Tocar la cabecera abre «Datos del contacto», como en WhatsApp. */}
              <button type="button" onClick={() => setDatos(true)} className="foco-visible flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left">
                <Avatar nombre={abierta.nombre} semilla={abierta.numero} tamano={40} />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-texto">{abierta.nombre}</span>
                  <span className="block truncate text-[12px] text-tenue">
                    <span className={abierta.botActivo ? undefined : 'text-aviso'}>{quienAtiende}</span>
                    {abierta.estado !== 'ABIERTO' && ` · ${NOMBRE_ESTADO[abierta.estado]}`}
                    {abierta.asignadaA && ` · ${abierta.asignadaA.nombre.split(' ')[0]}`}
                  </span>
                </span>
              </button>
              {/* «Opciones» de lo seleccionado, a la izquierda de «Tomar» (Fernando, 2026-11-08). */}
              {sel.size > 0 && <span className="hidden sm:inline-flex"><MenuBoton texto={`Opciones (${sel.size})`} icono={Settings2} acciones={opciones(idsSel)} /></span>}
              {/* Las acciones de ESTA conversación, agrupadas como los iconos de WhatsApp. */}
              <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-borde p-0.5">
                {puedeOperar && (
                  <BotonIcono
                    icono={abierta.botActivo ? Hand : Bot}
                    titulo={abierta.botActivo ? 'Tomar la conversación' : 'Devolvérsela al agente'}
                    onClick={alternarBot}
                    disabled={cambiando}
                    className={cn('rounded-full', !abierta.botActivo && 'text-acento')}
                  />
                )}
                <MenuFila
                  acciones={[
                    { etiqueta: 'Datos del contacto', icono: Info, alPulsar: () => setDatos(true) },
                    ...opciones([abierta.id], { estado: abierta.estado, asignada: abierta.asignadaA?.id ?? null }),
                  ]}
                />
              </div>
            </header>

            <div ref={hilo} className="fondo-chat flex-1 overflow-y-auto px-3 py-2 sm:px-[6%]">
              {mensajes.length === 0 && (
                <p className="py-8 text-center text-[13px] text-tenue">Sin mensajes.</p>
              )}
              {mensajes.map((m, n) => {
                const nuevoDia = n === 0 || claveDia(mensajes[n - 1].creado, zona) !== claveDia(m.creado, zona);
                const nuestro = m.direccion === 'SALIENTE';
                const delAgente = nuestro && !!m.herramienta && m.herramienta !== 'equipo';
                const primeraDeTanda = n === 0 || nuevoDia || mensajes[n - 1].direccion !== m.direccion;
                return (
                  <Fragment key={m.id}>
                    {nuevoDia && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-lg bg-burbuja-otra px-3 py-1 text-[12px] text-tenue shadow-sm">
                          {separadorDia(m.creado, zona)}
                        </span>
                      </div>
                    )}
                    <div className={cn('flex', nuestro ? 'justify-end' : 'justify-start', primeraDeTanda ? 'mt-2.5' : 'mt-0.5')}>
                      <div
                        className={cn(
                          'max-w-[85%] rounded-lg px-2.5 pb-1 pt-1.5 text-[14px] leading-snug text-texto shadow-sm sm:max-w-[65%]',
                          nuestro ? 'bg-burbuja-mia' : 'bg-burbuja-otra',
                          primeraDeTanda && (nuestro ? 'burbuja-cola-der rounded-tr-none' : 'burbuja-cola-izq rounded-tl-none'),
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          <Contenido texto={m.texto} tipo={m.tipo} />
                          {/* La hora y los ✓ dentro de la burbuja, abajo a la derecha. */}
                          <span className="float-right ml-3 mt-2 flex items-center gap-1 text-[11px] leading-none text-tenue">
                            {delAgente && <Bot className="h-3 w-3" aria-label="Agente" />}
                            <span title={m.herramienta ?? undefined}>{horaCorta(m.creado, zona)}</span>
                            {nuestro && (
                              <span title={m.enviadoOk === false ? m.errorEnvio ?? 'No salió' : undefined}>
                                <Acuse estado={m.enviadoOk === false ? 'failed' : m.estado} />
                              </span>
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>

            {/* ── LA BARRA DE ABAJO: escribir si la lleva una persona; «Tomar» si la lleva el agente. */}
            {puedeOperar && (
              <div className="shrink-0 border-t border-borde bg-realce px-3 py-2">
                {abierta.botActivo ? (
                  <div className="flex items-center justify-center gap-3 py-0.5">
                    <span className="flex items-center gap-1.5 text-[13px] text-tenue"><Bot className="h-4 w-4" /> Lo atiende el agente</span>
                    <Boton variante="secundario" icono={Hand} onClick={alternarBot} disabled={cambiando}>Tomar</Boton>
                  </div>
                ) : abierta.ventanaAbierta ? (
                  <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2">
                    <textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      placeholder="Escribe un mensaje"
                      aria-label="Mensaje"
                      rows={Math.min(5, Math.max(1, mensaje.split('\n').length))}
                      style={{ borderRadius: 22 }}
                      className="campo min-h-[42px] flex-1 resize-none border-transparent px-4 py-2.5 focus:border-transparent"
                      disabled={enviando}
                    />
                    <button
                      type="submit"
                      disabled={enviando || !mensaje.trim()}
                      title="Enviar"
                      aria-label="Enviar"
                      className="foco-visible flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-wa text-white transition-colors hover:bg-wa-fuerte disabled:opacity-45"
                    >
                      <SendHorizontal className="h-5 w-5" />
                    </button>
                  </form>
                ) : (
                  <p className="px-1 py-2 text-center text-[12.5px] text-tenue">
                    Pasaron más de 24 h desde su último mensaje: solo se le puede escribir con una plantilla.
                  </p>
                )}
              </div>
            )}

            {/* ── DATOS DEL CONTACTO, como el panel de info de WhatsApp. */}
            <PanelLateral abierto={datos} alCerrar={() => setDatos(false)} titulo="Datos del contacto">
              <div className="flex flex-col items-center gap-2 pb-4 text-center">
                <Avatar nombre={abierta.nombre} semilla={abierta.numero} tamano={96} />
                <p className="text-[18px] font-semibold text-texto">{abierta.nombre}</p>
                <a href={`tel:+${abierta.numero}`} className="flex items-center gap-1.5 text-[14px] text-tenue hover:text-texto">
                  <Phone className="h-4 w-4" /> +{abierta.numero}
                </a>
              </div>
              <dl className="divide-y divide-borde border-t border-borde">
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-[13px] text-tenue">Lo atiende</dt>
                  <dd><Insignia tono={abierta.botActivo ? 'exito' : 'aviso'}>{abierta.botActivo ? 'Agente' : abierta.tomadaPor ?? 'Equipo'}</Insignia></dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-[13px] text-tenue">Estado</dt>
                  <dd className="text-[13px] font-medium text-texto">{NOMBRE_ESTADO[abierta.estado]}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-[13px] text-tenue">Asignado a</dt>
                  <dd className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] text-texto">{abierta.asignadaA?.nombre ?? '—'}</span>
                    {puedeOperar && <BotonIcono icono={UserRound} titulo="Asignar usuario" onClick={() => setDialogo({ tipo: 'asignar', ids: [abierta.id], actual: abierta.asignadaA?.id ?? null })} />}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-[13px] text-tenue">Etiquetas</dt>
                  <dd className="flex min-w-0 items-center gap-2">
                    {abierta.etiquetas.length ? <Etiquetas nombres={abierta.etiquetas} /> : <span className="text-[13px] text-tenue">—</span>}
                    {puedeOperar && <BotonIcono icono={Tag} titulo="Editar etiquetas" onClick={() => setEditarEtiquetas(true)} />}
                  </dd>
                </div>
                {costo && (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="flex items-center gap-1.5 text-[13px] text-tenue"><Coins className="h-4 w-4" /> Consumo de IA</dt>
                    <dd
                      className="text-[13px] font-medium text-acento"
                      title={`${gasto!.corridas} corrida(s) del modelo · ${miles(gasto!.entrada)} tokens de entrada (${miles(gasto!.cache_lectura)} leídos de caché) · ${miles(gasto!.salida)} de salida`}
                    >
                      {costo}
                    </dd>
                  </div>
                )}
              </dl>
            </PanelLateral>

            {puedeOperar && (
              <DialogoEtiquetas
                titulo="Etiquetas"
                abierto={editarEtiquetas}
                alCerrar={() => setEditarEtiquetas(false)}
                actuales={abierta.etiquetas}
                todas={etiquetas.map((t) => t.nombre)}
                alGuardar={(nombres) => etiquetarContacto(slug, abierta.contactoId, nombres)}
              />
            )}
          </>
        )}
      </section>

      {/* ── FILTROS EN EL TELÉFONO: el mismo panel, encima. */}
      <PanelLateral abierto={filtrosTel} alCerrar={() => setFiltrosTel(false)} titulo="Filtros" lleno>
        <PanelFiltros bandeja={bandeja} estados={itemsEstado} etiquetas={itemsEtiqueta} usuarios={itemsUsuario} alElegir={() => setFiltrosTel(false)} />
      </PanelLateral>

      {/* ── LOS DIÁLOGOS DE LAS OPCIONES ── */}
      <DialogoEtiquetas
        titulo={dialogo?.tipo === 'etiquetas' && dialogo.ids.length > 1 ? `Añadir etiquetas a ${dialogo.ids.length}` : 'Añadir etiquetas'}
        abierto={dialogo?.tipo === 'etiquetas'}
        alCerrar={() => setDialogo(null)}
        actuales={[]}
        todas={etiquetas.map((t) => t.nombre)}
        alGuardar={async (nombres) => {
          if (dialogo?.tipo !== 'etiquetas') return { ok: false, error: '' };
          const r = await accionMasiva(slug, dialogo.ids, { tipo: 'etiquetas', nombres });
          if (r.ok) { setSel(new Set()); setSeleccionando(false); }
          return r;
        }}
      />
      <DialogoAsignar
        abierto={dialogo?.tipo === 'asignar'}
        alCerrar={() => setDialogo(null)}
        usuarios={usuarios}
        actual={dialogo?.tipo === 'asignar' ? dialogo.actual : null}
        ocupado={enMasa}
        alElegir={(usuarioId) => dialogo && ejecutar(dialogo.ids, { tipo: 'asignar', usuarioId }, usuarioId ? 'Asignado.' : 'Sin asignar.')}
      />
      <Confirmar
        abierto={dialogo?.tipo === 'borrar'}
        titulo={dialogo && dialogo.ids.length > 1 ? `¿Borrar los mensajes de ${dialogo.ids.length} conversaciones?` : '¿Borrar los mensajes?'}
        mensaje="Se borran todos sus mensajes de esta app (no del teléfono del contacto). No se puede deshacer."
        textoAceptar="Borrar"
        ocupado={enMasa}
        alCerrar={() => setDialogo(null)}
        alAceptar={() => dialogo && ejecutar(dialogo.ids, { tipo: 'borrarMensajes' }, 'Mensajes borrados.')}
      />
      <Confirmar
        abierto={dialogo?.tipo === 'eliminar'}
        titulo={dialogo && dialogo.ids.length > 1 ? `¿Eliminar ${dialogo.ids.length} contactos?` : '¿Eliminar el contacto?'}
        mensaje="Se borran el contacto, su conversación, sus mensajes y sus etiquetas. Si vuelve a escribir, entra como nuevo. No se puede deshacer."
        textoAceptar="Eliminar"
        ocupado={enMasa}
        alCerrar={() => setDialogo(null)}
        alAceptar={() => dialogo && ejecutar(dialogo.ids, { tipo: 'eliminar' }, 'Eliminado.')}
      />
    </div>
  );
}

/** Elegir el responsable: «Sin asignar» o un usuario activo del negocio. */
function DialogoAsignar({ abierto, alCerrar, usuarios, actual, ocupado, alElegir }: {
  abierto: boolean; alCerrar: () => void; usuarios: { id: number; nombre: string }[]; actual: number | null; ocupado: boolean;
  alElegir: (usuarioId: number | null) => void;
}) {
  const [busca, setBusca] = useState('');
  const t = busca.trim().toLowerCase();
  const opciones = [{ id: null as number | null, nombre: 'Sin asignar' }, ...usuarios.filter((u) => !t || u.nombre.toLowerCase().includes(t))];
  return (
    <Ventanita abierto={abierto} alCerrar={alCerrar} titulo="Asignar usuario">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar usuario" className="campo pl-8" />
        </div>
        <ul className="max-h-[45vh] divide-y divide-borde overflow-y-auto">
          {opciones.map((u) => (
            <li key={u.id ?? 'ninguno'}>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => alElegir(u.id)}
                className="foco-visible flex w-full items-center gap-2.5 px-1 py-2.5 text-left text-[13px] transition-colors hover:bg-realce disabled:opacity-50"
              >
                <UserRound className="h-4 w-4 shrink-0 text-tenue" />
                <span className="min-w-0 flex-1 truncate text-texto">{u.nombre}</span>
                {u.id === actual && <Check className="h-4 w-4 shrink-0 text-acento" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Ventanita>
  );
}

/** Etiquetas: marcar las del negocio o escribir una nueva. Sirve para uno (fija) o varios (añade). */
function DialogoEtiquetas({
  titulo, abierto, alCerrar, actuales, todas, alGuardar,
}: {
  titulo: string; abierto: boolean; alCerrar: () => void; actuales: string[]; todas: string[];
  alGuardar: (nombres: string[]) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<string[]>(actuales);
  const [nueva, setNueva] = useState('');
  const [enCurso, arranca] = useTransition();
  const [abiertoAntes, setAbiertoAntes] = useState(false);
  // Al abrir, se parte de las que tiene ahora.
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto);
    if (abierto) { setElegidas(actuales); setNueva(''); }
  }
  const opciones = [...new Set([...todas, ...elegidas])].sort((a, b) => a.localeCompare(b, 'es'));
  const alternar = (n: string) => setElegidas((x) => (x.includes(n) ? x.filter((y) => y !== n) : [...x, n]));
  const anadir = () => {
    const n = nueva.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!n) return;
    if (!elegidas.some((x) => x.toLowerCase() === n.toLowerCase())) setElegidas((x) => [...x, n]);
    setNueva('');
  };

  return (
    <Ventanita
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={enCurso}>Cancelar</Boton>
          <Boton
            disabled={enCurso}
            onClick={() =>
              arranca(async () => {
                const r = await alGuardar(elegidas);
                if (!r.ok) { toast.error(r.error); return; }
                alCerrar();
                router.refresh();
              })
            }
          >
            {enCurso ? 'Guardando…' : 'Guardar'}
          </Boton>
        </>
      }
    >
      <div className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); anadir(); }} className="flex gap-2">
          <Entrada value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva etiqueta" maxLength={40} aria-label="Nueva etiqueta" />
          <BotonIcono icono={Plus} titulo="Añadir" type="submit" className="border border-borde" />
        </form>
        {opciones.length > 0 && (
          <ul className="max-h-[45vh] divide-y divide-borde overflow-y-auto">
            {opciones.map((n) => {
              const sel = elegidas.includes(n);
              return (
                <li key={n}>
                  <button
                    type="button"
                    onClick={() => alternar(n)}
                    aria-pressed={sel}
                    className="foco-visible flex w-full items-center gap-2.5 px-1 py-2 text-left text-[13px] transition-colors hover:bg-realce"
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', sel ? 'border-acento bg-acento text-acento-contraste' : 'border-borde')}>
                      {sel && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate text-texto">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Ventanita>
  );
}
