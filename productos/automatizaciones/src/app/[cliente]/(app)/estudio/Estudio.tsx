'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Bot, Power, PowerOff, Phone, BookOpen, MessageSquareText, Plus, Trash2, AlertTriangle, Save,
} from 'lucide-react';
import { Boton, Campo, Entrada, AreaTexto, Selector, Insignia, Tarjeta, PanelLateral, Confirmar, RailFiltro } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { guardarInstruccion, guardarConocimiento, borrarConocimiento, guardarAjustes } from '@/acciones/estudio';
import { cn } from '@/lib/utils';

export type CanalVista = {
  numero: string | null;
  nombreVerificado: string | null;
  estado: string;
  botActivo: boolean;
  coexistencia: boolean;
  modelo: string;
  razonamiento: string;
  debounce: number;
  ventana: number;
  ultimoError: string | null;
  ultimoErrorEn: string | null;
};

export type Instruccion = { tipo: string; contenido: string; version: number };
export type Bloque = { clave: string; titulo: string; contenido: string; orden: number; activo: boolean };

/**
 * EL ESTUDIO DEL AGENTE, en tres partes y en este orden:
 *
 *  1. **El número** — lo primero que se mira cuando algo va mal, y el interruptor general.
 *  2. **Lo que sabe** (conocimiento) — es lo que más se toca en el día a día: un precio
 *     que cambia, una ruta nueva. Va antes que las instrucciones a propósito.
 *  3. **Cómo habla** (instrucciones) — se toca poco y cada cambio pesa, así que va al
 *     final y cada guardado deja versión.
 */

const NOMBRE_INSTRUCCION: Record<string, { titulo: string; ayuda: string }> = {
  perfil_agente: {
    titulo: 'Quién es el agente',
    ayuda: 'Su forma de hablar, su nombre y de qué se ocupa. Escrito como se lo explicarías a alguien que entra a trabajar hoy.',
  },
  reglas_negocio: {
    titulo: 'Lo que puede y no puede hacer',
    ayuda: 'Las reglas que no puede saltarse: qué no promete, cuándo pasa la conversación a una persona, qué datos pide.',
  },
  resumen_conversacion: {
    titulo: 'Cómo resume una conversación larga',
    ayuda: 'Cuando un chat crece, el agente lo resume para no repetirse. Esto le dice qué merece la pena conservar.',
  },
};

const ORDEN = ['perfil_agente', 'reglas_negocio', 'resumen_conversacion'];

type Seccion = 'numero' | 'sabe' | 'habla';

export default function Estudio({
  slug,
  canal,
  instrucciones,
  bloques,
  versionesGuardadas,
}: {
  slug: string;
  canal: CanalVista;
  instrucciones: Instruccion[];
  bloques: Bloque[];
  versionesGuardadas: number;
}) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [editando, setEditando] = useState<Bloque | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [borrar, setBorrar] = useState<Bloque | null>(null);
  const [seccion, setSeccion] = useState<Seccion>('numero');
  const [textos, setTextos] = useState<Record<string, string>>(
    Object.fromEntries(ORDEN.map((t) => [t, instrucciones.find((i) => i.tipo === t)?.contenido ?? ''])),
  );

  const conectado = canal.estado === 'conectado';

  function guardarAjustesForm(datos: FormData) {
    arranca(async () => {
      const r = await guardarAjustes(slug, datos);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje ?? 'Guardado.');
      router.refresh();
    });
  }

  function guardarTexto(tipo: string) {
    arranca(async () => {
      const r = await guardarInstruccion(slug, tipo as never, textos[tipo] ?? '');
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje ?? 'Guardado.');
      router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <CabeceraPagina
        titulo="Estudio del agente"
        descripcion={canal.numero ? `${canal.numero}${canal.nombreVerificado ? ` · ${canal.nombreVerificado}` : ''}` : undefined}
        acciones={
          <Insignia tono={canal.botActivo ? 'exito' : 'aviso'} icono={canal.botActivo ? Power : PowerOff}>
            {canal.botActivo ? 'Agente encendido' : 'Agente apagado'}
          </Insignia>
        }
      />

      {/*
        SUBMENÚ, COMO EN CONFIGURACIÓN (Fernando, 2026-09-23). El estudio son tres cosas
        que se tocan en momentos distintos —el número cuando algo falla, el conocimiento
        casi a diario, las instrucciones de tarde en tarde—, y apilarlas obligaba a
        desplazarse por las otras dos para llegar a la que interesaba. Es el mismo raíl
        de Configuración: el mismo producto no se navega de dos maneras.
      */}
      {/*
        ⭐ EL CONTENEDOR OCUPA TODO EL ALTO DISPONIBLE (Fernando, 2026-09-23). El raíl y el
        contenido se estiran hasta el borde inferior de la página en vez de terminar donde
        acabe el texto. Una tarjeta que flota a media altura con el resto en blanco hace
        que la pantalla parezca a medio cargar.

        `min-h-0` en el hijo es lo que permite que el interior se desplace en vez de
        empujar la página: sin él, un bloque largo revienta el alto fijo del padre.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'numero', etiqueta: 'El número', icono: Phone },
            { valor: 'sabe', etiqueta: 'Lo que sabe', icono: BookOpen },
            { valor: 'habla', etiqueta: 'Cómo habla', icono: MessageSquareText },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as Seccion)}
        />
        <div className="desplaza min-h-0 min-w-0 flex-1 overflow-y-auto">
          {seccion === 'numero' && (
          <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
            <h2 className="mb-3 text-[14px] font-semibold text-texto">Tu número de WhatsApp</h2>

            <dl className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px]">
              <Dato etiqueta="Estado">
                <Insignia tono={conectado ? 'exito' : 'aviso'}>{canal.estado}</Insignia>
              </Dato>
              <Dato etiqueta="Coexistencia">{canal.coexistencia ? 'verificada' : 'no'}</Dato>
              <Dato etiqueta="Modelo">{canal.modelo}</Dato>
            </dl>

            {canal.ultimoError && (
              <p className="mb-3 flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] leading-relaxed text-error">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                <span>
                  <strong>Último fallo del número</strong>
                  {canal.ultimoErrorEn ? ` (${new Date(canal.ultimoErrorEn).toLocaleString('es-EC')})` : ''}: {canal.ultimoError}
                </span>
              </p>
            )}

            <form action={guardarAjustesForm} className="flex min-h-0 flex-1 flex-col space-y-3">
              {/* El interruptor general va arriba y con su explicación: es lo que se busca
                  cuando el agente está diciendo algo que no debe. */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded border border-borde bg-realce px-3 py-2.5">
                <input type="checkbox" name="botActivo" defaultChecked={canal.botActivo} className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-[12.5px] leading-relaxed text-texto">
                  <strong>El agente contesta solo.</strong>
                  <span className="block text-tenue">
                    Apagarlo lo calla en <em>todo</em> el número, sin tocar conversación por conversación.
                    Lo que ya lleve una persona sigue igual.
                  </span>
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <Campo etiqueta="Cuánto se lo piensa">
                  <Selector name="razonamiento" defaultValue={canal.razonamiento}>
                    <option value="minimal">Mínimo — rápido y barato</option>
                    <option value="low">Bajo — el habitual</option>
                    <option value="medium">Medio — más cuidadoso</option>
                    <option value="high">Alto — lento y caro</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="Espera antes de responder">
                  <Entrada type="number" name="debounce" min={0} max={120} defaultValue={canal.debounce} />
                </Campo>
                <Campo etiqueta="Mensajes que recuerda">
                  <Entrada type="number" name="ventana" min={5} max={200} defaultValue={canal.ventana} />
                </Campo>
              </div>
              <p className="text-[11.5px] leading-relaxed text-tenue">
                La espera es lo que hace que conteste a un bloque de mensajes y no frase por frase:
                si el contacto sigue escribiendo, el reloj vuelve a empezar.
              </p>

              {/* `mt-auto` empuja la acción al fondo del contenedor; `justify-end`, a la
                  derecha. Es el orden de lectura: primero lo que se rellena, al final lo
                  que se pulsa. */}
              <div className="mt-auto flex justify-end pt-3">
                <Boton type="submit" disabled={enCurso}>
                  <Save className="h-4 w-4" /> {enCurso ? 'Guardando…' : 'Guardar ajustes'}
                </Boton>
              </div>
            </form>
          </Tarjeta>
          )}

          {seccion === 'sabe' && (
          <Tarjeta className="p-4 sm:p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-semibold text-texto">Lo que sabe del negocio</h2>
              <Boton variante="secundario" onClick={() => { setNuevo(true); setEditando(null); }}>
                <Plus className="h-4 w-4" /> Añadir
              </Boton>
            </div>
            <p className="mb-3 text-[12px] leading-relaxed text-tenue">
              Cada bloque es un tema. Es lo que más se toca: un precio que cambia, una ruta nueva.
              Los apagados no se le cuentan al agente, pero se conservan.
            </p>

            {bloques.length === 0 ? (
              <p className="rounded border border-borde bg-realce px-3 py-6 text-center text-[13px] text-tenue">
                Todavía no hay nada. Añade el primer bloque.
              </p>
            ) : (
              <ul className="divide-y divide-borde">
                {bloques.map((b) => (
                  <li key={b.clave} className="flex flex-wrap items-center gap-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => { setEditando(b); setNuevo(false); }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className={cn('truncate text-[13.5px] font-medium', b.activo ? 'text-texto' : 'text-tenue line-through')}>
                        {b.titulo}
                      </p>
                      <p className="truncate text-[11.5px] text-tenue">
                        {b.contenido ? `${b.contenido.slice(0, 80)}${b.contenido.length > 80 ? '…' : ''}` : 'vacío'}
                      </p>
                    </button>
                    {!b.activo && <Insignia tono="neutro">apagado</Insignia>}
                    <Boton variante="fantasma" onClick={() => setBorrar(b)} title={`Borrar ${b.titulo}`}>
                      <Trash2 className="h-4 w-4 text-error" />
                    </Boton>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          )}

          {seccion === 'habla' && (
          <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
            <h2 className="mb-1 text-[14px] font-semibold text-texto">Las instrucciones del agente</h2>
            <p className="mb-3 text-[12px] leading-relaxed text-tenue">
              Cada vez que guardas, se archiva la versión anterior en vez de pisarla —hay{' '}
              {versionesGuardadas} guardadas—. Si un cambio empeora al agente, siempre hay a qué volver.
            </p>

            <div className="space-y-4">
              {ORDEN.map((tipo) => {
                const meta = NOMBRE_INSTRUCCION[tipo];
                const actual = instrucciones.find((i) => i.tipo === tipo);
                const cambiado = (textos[tipo] ?? '') !== (actual?.contenido ?? '');
                return (
                  <div key={tipo}>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <label className="text-[13px] font-medium text-texto">{meta.titulo}</label>
                      {actual && <span className="text-[11px] text-tenue">versión {actual.version}</span>}
                    </div>
                    <p className="mb-1.5 text-[11.5px] leading-relaxed text-tenue">{meta.ayuda}</p>
                    <AreaTexto
                      rows={7}
                      value={textos[tipo] ?? ''}
                      onChange={(e) => setTextos((t) => ({ ...t, [tipo]: e.target.value }))}
                      className="font-mono text-[12px]"
                    />
                    <div className="mt-1.5 flex items-center gap-2">
                      <Boton disabled={enCurso || !cambiado} onClick={() => guardarTexto(tipo)}>
                        {enCurso ? 'Guardando…' : 'Guardar como versión nueva'}
                      </Boton>
                      {cambiado && <span className="text-[11.5px] text-aviso">sin guardar</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Tarjeta>
          )}
        </div>
      </div>
      {/* ── El panel de un bloque ────────────────────────────────────────────── */}
      <PanelLateral
        abierto={nuevo || editando !== null}
        alCerrar={() => { setNuevo(false); setEditando(null); }}
        titulo={editando ? editando.titulo : 'Bloque nuevo'}
        ancho="lg"
      >
        <form
          action={(datos) =>
            arranca(async () => {
              const r = await guardarConocimiento(slug, datos);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(r.mensaje ?? 'Guardado.');
              setNuevo(false); setEditando(null);
              router.refresh();
            })
          }
          className="space-y-3"
        >
          <Campo etiqueta="Título">
            <Entrada name="titulo" defaultValue={editando?.titulo ?? ''} required autoFocus />
          </Campo>
          <Campo etiqueta="Clave">
            <Entrada
              name="clave"
              defaultValue={editando?.clave ?? ''}
              readOnly={!!editando}
              placeholder="precios_2026"
              required
            />
          </Campo>
          <p className="text-[11.5px] leading-relaxed text-tenue">
            La clave identifica el bloque y no cambia: así puedes reescribir el contenido cuantas
            veces quieras sin crear duplicados.
          </p>
          <Campo etiqueta="Contenido">
            <AreaTexto name="contenido" rows={16} defaultValue={editando?.contenido ?? ''} className="font-mono text-[12px]" />
          </Campo>
          <label className="flex items-center gap-2 text-[13px] text-texto">
            <input type="checkbox" name="activo" defaultChecked={editando ? editando.activo : true} className="h-4 w-4" />
            Contárselo al agente
          </label>
          <Boton type="submit" tamano="lg" className="w-full" disabled={enCurso}>
            {enCurso ? 'Guardando…' : 'Guardar bloque'}
          </Boton>
        </form>
      </PanelLateral>

      <Confirmar
        abierto={borrar !== null}
        alCerrar={() => setBorrar(null)}
        titulo={`¿Borrar «${borrar?.titulo}»?`}
        mensaje="El agente dejará de saberlo. Si solo quieres que deje de contárselo por un tiempo, apágalo en vez de borrarlo."
        textoAceptar="Borrar"
        peligro
        alAceptar={() =>
          arranca(async () => {
            if (!borrar) return;
            const r = await borrarConocimiento(slug, borrar.clave);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(r.mensaje ?? 'Borrado.');
            setBorrar(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-tenue">{etiqueta}:</dt>
      <dd className="font-medium text-texto">{children}</dd>
    </div>
  );
}
