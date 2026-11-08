'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Hand, Search, Wrench, AlertCircle, Bot, Tag, SendHorizontal, Plus, Check } from 'lucide-react';
import { Boton, BotonIcono, Insignia, Selector, Ventanita, Entrada } from '@/componentes/ui';
import { cambiarBot, etiquetarContacto, responder } from '@/acciones/conversaciones';
import { costoEnDolares, costoLegible } from '@/lib/ia/precios';
import { cn } from '@/lib/utils';
import { fechaHora, miles } from '@/lib/formato';

export type ConversacionLista = {
  id: number;
  nombre: string;
  numero: string;
  ultimo: string | null;
  botActivo: boolean;
  tomadaPor: string | null;
  etiquetas: string[];
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

/** Las etiquetas de un contacto: texto de color, sin cápsula (regla «sin etiquetas con relleno»). */
function Etiquetas({ nombres, className }: { nombres: string[]; className?: string }) {
  if (!nombres.length) return null;
  return (
    <p className={cn('flex min-w-0 items-center gap-1 text-[11px] font-medium text-acento', className)}>
      <Tag className="h-3 w-3 shrink-0" />
      <span className="truncate">{nombres.join(' · ')}</span>
    </p>
  );
}

/**
 * ⭐ UNA BANDEJA EN UN TELÉFONO ES UNA PANTALLA, NO DOS (Diseño.md, 2026-09-23).
 *
 * En la plataforma esto era `lista de 320 px + hilo` siempre. En 390 px de ancho al
 * hilo le quedaban 50 y la conversación se salía de la pantalla. Aquí la lista ocupa
 * el ancho y, al tocar una conversación, **el hilo la sustituye**, con un «‹» de 44 px
 * para volver: el patrón de cualquier aplicación de mensajería.
 *
 * Desde `lg` vuelven a convivir, porque ahí sí hay sitio para las dos.
 */
export default function Bandeja({
  slug,
  lista,
  busca,
  etiquetas,
  etiquetaId,
  abierta,
  mensajes,
  gasto,
  puedeOperar,
}: {
  slug: string;
  lista: ConversacionLista[];
  busca: string;
  etiquetas: { id: number; nombre: string }[];
  etiquetaId: number | null;
  abierta: Abierta | null;
  mensajes: MensajeVista[];
  gasto: Gasto | null;
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(busca);
  const [cambiando, arranca] = useTransition();
  const [mensaje, setMensaje] = useState('');
  const [enviando, arrancaEnvio] = useTransition();
  const [editarEtiquetas, setEditarEtiquetas] = useState(false);

  // La dirección lleva el filtro: buscar, etiqueta y conversación abierta.
  const url = (o: { q?: string; e?: number | null; c?: number | null }) => {
    const p = new URLSearchParams();
    const q = o.q ?? busca;
    const e = o.e === undefined ? etiquetaId : o.e;
    if (q) p.set('q', q);
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

  return (
    <div className="flex h-full min-h-0">
      {/* ── La lista. En teléfono desaparece cuando hay una conversación abierta. */}
      <section
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-borde lg:flex lg:w-[320px]',
          abierta && 'hidden lg:flex',
        )}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); router.push(url({ q: texto.trim(), c: null })); }}
          className="flex min-h-[68px] items-center gap-2 border-b border-borde p-2.5"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar"
              aria-label="Buscar por nombre o número"
              className="campo h-11 pl-8"
            />
          </div>
        </form>
        {/* El filtro por etiqueta, debajo del buscador (regla de la barra de una lista). */}
        {etiquetas.length > 0 && (
          <div className="border-b border-borde p-2.5">
            <Selector
              aria-label="Filtrar por etiqueta"
              value={etiquetaId ?? ''}
              onChange={(e) => router.push(url({ e: Number(e.target.value) || null, c: null }))}
            >
              <option value="">Todas las etiquetas</option>
              {etiquetas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </Selector>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {lista.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-tenue">
              {busca || etiquetaId ? 'Sin resultados' : 'Sin conversaciones'}
            </p>
          )}
          {lista.map((c) => (
            <Link
              key={c.id}
              href={url({ c: c.id })}
              className={cn(
                'flex min-h-[60px] flex-col justify-center gap-0.5 border-b border-borde px-3 py-2',
                abierta?.id === c.id ? 'bg-acento-suave' : 'hover:bg-realce',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13.5px] font-medium text-texto">{c.nombre}</p>
                {!c.botActivo && <Hand className="h-3.5 w-3.5 shrink-0 text-aviso" aria-label="Tomada" />}
              </div>
              <Etiquetas nombres={c.etiquetas} />
              <p className="truncate text-[11.5px] text-tenue">
                {c.ultimo ? fechaHora(c.ultimo) : 'Sin mensajes'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── El hilo. En teléfono ocupa la pantalla entera. */}
      <section className={cn('flex min-w-0 flex-1 flex-col', !abierta && 'hidden lg:flex')}>
        {!abierta ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-center text-[13px] text-tenue">Elige una conversación.</p>
          </div>
        ) : (
          <>
            <header className="flex min-h-[68px] items-center gap-2 border-b border-borde p-2.5">
              <Link
                href={url({ c: null })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-tenue hover:bg-realce lg:hidden"
                aria-label="Volver a la lista"
              >
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-texto">{abierta.nombre}</p>
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-[11.5px] text-tenue">
                  <span className="truncate">{abierta.numero}</span>
                  {/* El consumo de IA de esta conversación: solo texto de color, sin relleno. */}
                  {gasto && gasto.corridas > 0 && (
                    <span
                      className="font-medium text-acento"
                      title={`${gasto.corridas} corrida(s) del modelo · ${miles(gasto.entrada)} tokens de entrada (${miles(gasto.cache_lectura)} leídos de caché) · ${miles(gasto.salida)} de salida`}
                    >
                      {costoLegible(costoEnDolares({ tokensEntrada: gasto.entrada, tokensSalida: gasto.salida, tokensCacheLectura: gasto.cache_lectura }))} en IA
                    </span>
                  )}
                  <Etiquetas nombres={abierta.etiquetas} />
                </p>
              </div>
              {/* Quién la lleva: en el teléfono basta el icono de al lado (mano / agente). */}
              <span className="hidden sm:inline-flex" title={abierta.botActivo ? 'La lleva el agente' : `La lleva ${abierta.tomadaPor ?? 'el equipo'}`}>
                <Insignia tono={abierta.botActivo ? 'exito' : 'aviso'}>
                  {abierta.botActivo ? 'Agente' : abierta.tomadaPor?.split(' ')[0] ?? 'Equipo'}
                </Insignia>
              </span>
              {puedeOperar && (
                <>
                  <BotonIcono icono={Tag} titulo="Etiquetas" onClick={() => setEditarEtiquetas(true)} />
                  {/* Tomar / devolver: un ICONO (Fernando, 2026-11-08), con su nombre en `title`. */}
                  <BotonIcono
                    icono={abierta.botActivo ? Hand : Bot}
                    titulo={abierta.botActivo ? 'Tomar la conversación' : 'Devolvérsela al agente'}
                    onClick={alternarBot}
                    disabled={cambiando}
                    className={cn('border border-borde', !abierta.botActivo && 'text-acento')}
                  />
                </>
              )}
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto bg-fondo p-3">
              {mensajes.length === 0 && (
                <p className="py-8 text-center text-[13px] text-tenue">Sin mensajes.</p>
              )}
              {mensajes.map((m) => (
                <div key={m.id} className={cn('flex', m.direccion === 'SALIENTE' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed sm:max-w-[70%]',
                      m.direccion === 'SALIENTE' ? 'bg-acento text-acento-contraste' : 'border border-borde bg-tarjeta text-texto',
                    )}
                  >
                    {m.herramienta && (
                      <p className="mb-1 flex items-center gap-1 text-[10.5px] opacity-80">
                        <Wrench className="h-3 w-3" />
                        {m.herramienta}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">
                      {m.texto || <span className="opacity-70">[{m.tipo}]</span>}
                    </p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {fechaHora(m.creado)}
                      {m.enviadoOk === false && (
                        <span className="ml-1 inline-flex items-center gap-0.5" title={m.errorEnvio ?? undefined}>
                          <AlertCircle className="h-3 w-3" /> no salió
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* CONTESTAR DESDE LA APP: solo con la conversación tomada y dentro de las 24 h. */}
            {puedeOperar && !abierta.botActivo && (
              <div className="shrink-0 border-t border-borde bg-tarjeta p-2.5">
                {abierta.ventanaAbierta ? (
                  <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2">
                    <textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      placeholder="Escribe un mensaje"
                      aria-label="Mensaje"
                      rows={Math.min(5, Math.max(1, mensaje.split('\n').length))}
                      className="campo flex-1 resize-none"
                      disabled={enviando}
                    />
                    <button
                      type="submit"
                      disabled={enviando || !mensaje.trim()}
                      title="Enviar"
                      aria-label="Enviar"
                      className="foco-visible flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded bg-acento text-acento-contraste transition-colors hover:bg-acento-fuerte disabled:opacity-45"
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <p className="px-1 py-1.5 text-center text-[12px] text-tenue">
                    Pasaron más de 24 h desde su último mensaje: solo se le puede escribir con una plantilla.
                  </p>
                )}
              </div>
            )}

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
