'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, Hand, Search, AlertCircle, Bot, Tag, SendHorizontal, Plus, Check, CheckCheck,
  Camera, Mic, Video, FileText, MapPin, Sticker, Info, Phone, Coins, MessagesSquare, MessageCircleMore,
} from 'lucide-react';
import { Boton, BotonIcono, Insignia, Ventanita, Entrada, PanelLateral } from '@/componentes/ui';
import { MenuFila } from '@/componentes/Navegacion';
import { cambiarBot, etiquetarContacto, responder, marcarVista } from '@/acciones/conversaciones';
import { costoEnDolares, costoLegible } from '@/lib/ia/precios';
import { cn } from '@/lib/utils';
import { miles, horaCorta, cuandoEnLista, separadorDia, claveDia } from '@/lib/formato';

export type ConversacionLista = {
  id: number;
  nombre: string;
  numero: string;
  ultimo: string | null;
  botActivo: boolean;
  tomadaPor: string | null;
  etiquetas: string[];
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
  etiquetas: string[];
  /** ¿Sigue abierta la ventana de 24 h de WhatsApp para escribir libremente? */
  ventanaAbierta: boolean;
};

/*
  LA BANDEJA, COMO WHATSAPP (Fernando, 2026-11-08: «quiero una interfaz igualita a la de WhatsApp»).

  · Columna de chats: título, buscador en píldora gris, filtros en botones (Todos · No leídos ·
    etiquetas), y filas con avatar, nombre, hora, vista previa con ✓ y el círculo verde.
  · Chat: cabecera con avatar, nombre y una línea de estado; los iconos agrupados a la derecha.
    El número, las etiquetas y el consumo de IA van en «Datos del contacto» (al tocar la cabecera).
  · Fondo beige con dibujo, mis burbujas en verde claro, piquito en la primera de cada tanda, hora
    y ✓ dentro de la burbuja, separador de día con sombra.
  · Barra de escribir abajo; si lo atiende el agente, en su lugar va «Tomar».

  ⚠️ La Cloud API NO da la foto de perfil del contacto: el avatar es su inicial sobre un color fijo.
  ⚠️ En el teléfono la lista y el chat se ALTERNAN (Diseño.md, 2026-09-23).
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

/** Un botón de filtro de la lista, como «Todos» / «No leídos» de WhatsApp. */
function Filtro({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'true' : undefined}
      className={cn(
        'foco-visible inline-flex h-8 items-center rounded-full px-3 text-[13px] transition-colors',
        activo ? 'bg-acento-suave font-semibold text-acento' : 'bg-realce text-tenue hover:text-texto',
      )}
    >
      {children}
    </Link>
  );
}

/** Una fila del panel de filtros: icono, nombre y su cuenta a la derecha (como «Chats 10»). */
function FiltroPanel({ nombre, icono: Icono, n, href, activo }: {
  nombre: string; icono: React.ComponentType<{ className?: string }>; n: number; href: string; activo: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className={cn(
        'foco-visible flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors',
        activo ? 'bg-realce font-semibold text-texto' : 'text-texto hover:bg-realce/60',
      )}
    >
      <Icono className="h-[18px] w-[18px] shrink-0 text-tenue" />
      <span className="min-w-0 flex-1 truncate">{nombre}</span>
      {n > 0 && <span className="text-[12px] tabular-nums text-tenue">{n}</span>}
    </Link>
  );
}

export default function Bandeja({
  slug,
  lista,
  busca,
  etiquetas,
  etiquetaId,
  filtro,
  cuentas,
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
  const [editarEtiquetas, setEditarEtiquetas] = useState(false);
  const [datos, setDatos] = useState(false);

  // Abrirla la marca como vista: deja de contar como «sin leer».
  useEffect(() => { if (abierta) void marcarVista(slug, abierta.id); }, [slug, abierta?.id]);
  // Como WhatsApp, el chat se abre en el ÚLTIMO mensaje (y baja cuando llega o sale uno nuevo).
  const hilo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = hilo.current;
    if (h) h.scrollTop = h.scrollHeight;
  }, [abierta?.id, mensajes.length]);

  // La dirección lleva el filtro: buscar, «No leídos», etiqueta y conversación abierta.
  const url = (o: { q?: string; e?: number | null; f?: 'noleidos' | 'tomadas' | null; c?: number | null }) => {
    const p = new URLSearchParams();
    const q = o.q ?? busca;
    const e = o.e === undefined ? etiquetaId : o.e;
    const f = o.f === undefined ? filtro : o.f;
    if (q) p.set('q', q);
    if (f) p.set('f', f);
    if (e) p.set('e', String(e));
    if (o.c) p.set('c', String(o.c));
    const t = p.toString();
    return `/${slug}/conversaciones${t ? `?${t}` : ''}`;
  };

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

  // Los filtros, una sola lista: la pinta el panel de la izquierda (escritorio) y los botones (teléfono).
  const filtros = [
    { clave: 'todos', nombre: 'Todos', icono: MessagesSquare, n: cuentas.todas, href: url({ f: null, e: null, c: null }), activo: !filtro && !etiquetaId },
    { clave: 'noleidos', nombre: 'No leídos', icono: MessageCircleMore, n: cuentas.noLeidas, href: url({ f: 'noleidos', e: null, c: null }), activo: filtro === 'noleidos' },
    { clave: 'tomadas', nombre: 'Tomadas', icono: Hand, n: cuentas.tomadas, href: url({ f: 'tomadas', e: null, c: null }), activo: filtro === 'tomadas' },
  ];
  const filtrosEtiqueta = etiquetas.map((t) => ({
    clave: `e${t.id}`, nombre: t.nombre, icono: Tag, n: t.n, href: url({ f: null, e: t.id, c: null }), activo: etiquetaId === t.id,
  }));
  const titulo = [...filtros, ...filtrosEtiqueta].find((x) => x.activo)?.nombre ?? 'Todos';

  const quienAtiende = abierta ? (abierta.botActivo ? 'Lo atiende el agente' : `Lo atiende ${abierta.tomadaPor ?? 'el equipo'}`) : '';
  const costo = gasto && gasto.corridas > 0
    ? costoLegible(costoEnDolares({ tokensEntrada: gasto.entrada, tokensSalida: gasto.salida, tokensCacheLectura: gasto.cache_lectura }))
    : null;

  return (
    <div className="tema-wa flex h-full min-h-0 bg-tarjeta">
      {/* ── EL PANEL DE FILTROS, como el de la izquierda de WhatsApp (solo escritorio). */}
      <nav aria-label="Filtros" className="hidden w-[230px] shrink-0 flex-col gap-0.5 border-r border-borde bg-wa-panel px-2 py-3 lg:flex">
        {filtros.map((x) => <FiltroPanel key={x.clave} {...x} />)}
        {filtrosEtiqueta.length > 0 && (
          <>
            <p className="mt-4 mb-1 px-3 text-[12px] font-medium text-tenue">Etiquetas</p>
            {filtrosEtiqueta.map((x) => <FiltroPanel key={x.clave} {...x} />)}
          </>
        )}
      </nav>

      {/* ── LOS CHATS. En el teléfono desaparecen cuando hay uno abierto. */}
      <section
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-borde lg:flex lg:w-[380px]',
          abierta && 'hidden lg:flex',
        )}
      >
        <div className="flex min-h-[68px] items-center px-4">
          <h1 className="truncate text-[17px] font-semibold text-texto">{titulo}</h1>
        </div>
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
        {/* Los filtros, como los de WhatsApp: se envuelven si no caben (nada se desliza de lado). */}
        {/* En el teléfono, los filtros en botones, como WhatsApp en el móvil (se envuelven). */}
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 lg:hidden">
          {[...filtros, ...filtrosEtiqueta].map((x) => <Filtro key={x.clave} href={x.href} activo={x.activo}>{x.nombre}</Filtro>)}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {lista.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-tenue">
              {busca || etiquetaId || filtro ? 'Sin resultados' : 'Sin conversaciones'}
            </p>
          )}
          {lista.map((c) => (
            <Link
              key={c.id}
              href={url({ c: c.id })}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 transition-colors',
                abierta?.id === c.id ? 'bg-realce' : 'hover:bg-realce/60',
              )}
            >
              <Avatar nombre={c.nombre} semilla={c.numero} />
              <div className="min-w-0 flex-1 border-b border-borde py-3">
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
                <Etiquetas nombres={c.etiquetas} className="mt-0.5" />
              </div>
            </Link>
          ))}
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
                  <span className={cn('block truncate text-[12px]', abierta.botActivo ? 'text-tenue' : 'text-aviso')}>{quienAtiende}</span>
                </span>
              </button>
              {/* Las acciones, agrupadas como los iconos de WhatsApp. */}
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
                    ...(puedeOperar ? [{ etiqueta: 'Etiquetas', icono: Tag, alPulsar: () => setEditarEtiquetas(true) }] : []),
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
                slug={slug}
                abierto={editarEtiquetas}
                alCerrar={() => setEditarEtiquetas(false)}
                contactoId={abierta.contactoId}
                actuales={abierta.etiquetas}
                todas={etiquetas.map((t) => t.nombre)}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Las etiquetas de un contacto: marcar las del negocio o escribir una nueva. */
function DialogoEtiquetas({
  slug, abierto, alCerrar, contactoId, actuales, todas,
}: {
  slug: string; abierto: boolean; alCerrar: () => void; contactoId: number; actuales: string[]; todas: string[];
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
      titulo="Etiquetas"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={enCurso}>Cancelar</Boton>
          <Boton
            disabled={enCurso}
            onClick={() =>
              arranca(async () => {
                const r = await etiquetarContacto(slug, contactoId, elegidas);
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
