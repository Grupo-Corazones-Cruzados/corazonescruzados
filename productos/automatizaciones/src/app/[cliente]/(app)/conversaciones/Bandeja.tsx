'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ChevronLeft, Bot, Hand, Search, Wrench, AlertCircle } from 'lucide-react';
import { Boton, Insignia, Tarjeta } from '@/componentes/ui';
import { cambiarBot } from '@/acciones/conversaciones';
import { cn } from '@/lib/utils';

export type ConversacionLista = {
  id: number;
  nombre: string;
  numero: string;
  ultimo: string | null;
  botActivo: boolean;
  tomadaPor: string | null;
};

export type MensajeVista = {
  id: number;
  direccion: 'ENTRANTE' | 'SALIENTE';
  texto: string | null;
  tipo: string;
  herramienta: string | null;
  enviadoOk: boolean | null;
  creado: string;
};

type Abierta = {
  id: number;
  nombre: string;
  numero: string;
  botActivo: boolean;
  tomadaPor: string | null;
};

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
  abierta,
  mensajes,
  puedeOperar,
}: {
  slug: string;
  lista: ConversacionLista[];
  busca: string;
  abierta: Abierta | null;
  mensajes: MensajeVista[];
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(busca);
  const [cambiando, arranca] = useTransition();

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = texto.trim();
    router.push(`/${slug}/conversaciones${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] lg:h-dvh">
      {/* ── La lista. En teléfono desaparece cuando hay una conversación abierta. */}
      <section
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-borde lg:flex lg:w-[320px]',
          abierta && 'hidden lg:flex',
        )}
      >
        <form onSubmit={buscar} className="flex items-center gap-2 border-b border-borde p-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue" />
            {/* Ancho completo, no `w-56`: una casilla de ancho fijo se corta contra el
                borde en un teléfono. */}
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por nombre o número"
              className="h-11 w-full rounded border border-borde bg-tarjeta pl-8 pr-2 text-[13px] text-texto outline-none placeholder:text-tenue focus:border-acento"
            />
          </div>
        </form>

        <div className="flex-1 overflow-y-auto">
          {lista.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-tenue">
              {busca ? 'Ninguna conversación coincide.' : 'Todavía no hay conversaciones.'}
            </p>
          )}
          {lista.map((c) => (
            <Link
              key={c.id}
              href={`/${slug}/conversaciones?c=${c.id}${busca ? `&q=${encodeURIComponent(busca)}` : ''}`}
              className={cn(
                'flex min-h-[60px] flex-col justify-center gap-0.5 border-b border-borde px-3 py-2',
                abierta?.id === c.id ? 'bg-acento-suave' : 'hover:bg-realce',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[13.5px] font-medium text-texto">{c.nombre}</p>
                {!c.botActivo && <Hand className="h-3.5 w-3.5 shrink-0 text-aviso" />}
              </div>
              <p className="truncate text-[11.5px] text-tenue">
                {c.ultimo ? new Date(c.ultimo).toLocaleString('es-EC') : 'Sin mensajes'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── El hilo. En teléfono ocupa la pantalla entera. */}
      <section className={cn('flex min-w-0 flex-1 flex-col', !abierta && 'hidden lg:flex')}>
        {!abierta ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-center text-[13px] text-tenue">
              Elige una conversación para ver el hilo.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-borde p-2.5">
              {/* 44 px de alto y de ancho: es un destino táctil, no un adorno. */}
              <Link
                href={`/${slug}/conversaciones${busca ? `?q=${encodeURIComponent(busca)}` : ''}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-tenue hover:bg-realce lg:hidden"
                aria-label="Volver a la lista"
              >
                <ChevronLeft className="h-6 w-6" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-texto">{abierta.nombre}</p>
                <p className="truncate text-[11.5px] text-tenue">{abierta.numero}</p>
              </div>
              {abierta.botActivo ? (
                <Insignia tono="exito">
                  <Bot className="mr-1 inline h-3 w-3" />
                  Contesta el agente
                </Insignia>
              ) : (
                <Insignia tono="aviso">
                  <Hand className="mr-1 inline h-3 w-3" />
                  {abierta.tomadaPor ? `La lleva ${abierta.tomadaPor}` : 'A mano'}
                </Insignia>
              )}
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto bg-fondo p-3">
              {mensajes.length === 0 && (
                <p className="py-8 text-center text-[13px] text-tenue">Sin mensajes.</p>
              )}
              {mensajes.map((m) => (
                <div
                  key={m.id}
                  className={cn('flex', m.direccion === 'SALIENTE' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed sm:max-w-[70%]',
                      m.direccion === 'SALIENTE'
                        ? 'bg-acento text-acento-contraste'
                        : 'border border-borde bg-tarjeta text-texto',
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
                      {new Date(m.creado).toLocaleString('es-EC')}
                      {m.enviadoOk === false && (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          <AlertCircle className="h-3 w-3" /> no salió
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {puedeOperar && (
              <footer className="border-t border-borde p-2.5">
                {/*
                  Apagar el bot es LA acción de esta pantalla: es lo que hace una
                  persona cuando la conversación se le tuerce al agente. Por eso está
                  siempre visible y no escondida en un menú.
                */}
                <Boton
                  variante={abierta.botActivo ? 'secundario' : 'primario'}
                  tamano="lg"
                  className="w-full"
                  disabled={cambiando}
                  onClick={() =>
                    arranca(async () => {
                      await cambiarBot(slug, abierta.id, !abierta.botActivo);
                      router.refresh();
                    })
                  }
                >
                  {cambiando
                    ? 'Cambiando…'
                    : abierta.botActivo
                      ? 'Tomar la conversación (apagar el agente)'
                      : 'Devolvérsela al agente'}
                </Boton>
              </footer>
            )}
          </>
        )}
      </section>
    </div>
  );
}
