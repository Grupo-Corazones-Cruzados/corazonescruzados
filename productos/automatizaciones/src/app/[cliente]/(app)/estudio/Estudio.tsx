'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Power, PowerOff, Phone, BookOpen, MessageSquareText, Plus, Trash2, AlertTriangle, Save, BadgeCheck, KeyRound,
  SlidersHorizontal, Plug, CheckCircle2,
} from 'lucide-react';
import {
  Boton, BotonIcono, Campo, Entrada, AreaTexto, Selector, Insignia, Tarjeta, PanelLateral, Confirmar, Ventanita,
  Tabla, EstadoVacio, Secciones, useSeccion, PieAcciones, BotonEliminar, type OpcionRail,
} from '@/componentes/ui';
import { esFalloDeIA } from '@/lib/fallos';
import { fechaHora } from '@/lib/formato';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { guardarInstruccion, guardarConocimiento, borrarConocimiento, guardarAjustes, guardarClaveIA } from '@/acciones/estudio';

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
  /** Los cuatro últimos caracteres de la clave de OpenAI del canal; null si no hay. */
  claveIAFin: string | null;
};

export type Instruccion = { tipo: string; contenido: string; version: number };
export type Bloque = { clave: string; titulo: string; contenido: string; orden: number; activo: boolean };

/**
 * EL ESTUDIO DEL AGENTE, en tres partes y en este orden:
 *
 *  1. **Comportamiento** — el interruptor general, la clave de OpenAI y los ajustes. Lo
 *     primero que se mira cuando el agente no contesta. ⚠️ La CONEXIÓN con WhatsApp (número,
 *     Meta, coexistencia) ya NO está aquí: vive en Configuración ▸ WhatsApp (Fernando,
 *     2026-11-08: «estudio y configuración son lo mismo en la sección de WhatsApp… que la
 *     interfaz no sea confusa»). Aquí, el agente; allí, el número. Cada una enlaza a la otra.
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

const SECCIONES: OpcionRail[] = [
  { valor: 'agente', etiqueta: 'Comportamiento', icono: SlidersHorizontal },
  { valor: 'sabe', etiqueta: 'Lo que sabe', icono: BookOpen },
  { valor: 'habla', etiqueta: 'Cómo habla', icono: MessageSquareText },
];

export default function Estudio({
  slug,
  canal,
  instrucciones,
  bloques,
}: {
  slug: string;
  canal: CanalVista;
  instrucciones: Instruccion[];
  bloques: Bloque[];
}) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [editando, setEditando] = useState<Bloque | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [borrar, setBorrar] = useState<Bloque | null>(null);
  const [clave, setClave] = useState<{ abierta: boolean; valor: string }>({ abierta: false, valor: '' });
  const [textos, setTextos] = useState<Record<string, string>>(
    Object.fromEntries(ORDEN.map((t) => [t, instrucciones.find((i) => i.tipo === t)?.contenido ?? ''])),
  );
  const s = useSeccion(SECCIONES);
  const seccion = s.activo;
  const panelAbierto = nuevo || editando !== null;
  const cerrarPanel = () => { setNuevo(false); setEditando(null); };
  // Solo los fallos del AGENTE; los de la conexión los enseña Configuración ▸ WhatsApp.
  const falloIA = esFalloDeIA(canal.ultimoError) ? canal.ultimoError : null;
  const activos = bloques.filter((b) => b.activo).length;

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
    <div className="flex h-full min-h-0 flex-col">
      {/*
        El encendido del agente es INFORMACIÓN (una línea de estado en `extra`), no un botón.
        El número es un dato: va en la burbuja (i). La conexión es SECUNDARIA y lleva a
        Configuración ▸ WhatsApp. «Añadir bloque» es la principal de «Lo que sabe».
      */}
      <CabeceraPagina
        titulo="Estudio del agente"
        descripcion="Cómo se comporta el agente, lo que sabe del negocio y cómo habla. Cada vez que guardas unas instrucciones, la versión anterior queda archivada."
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver al Estudio' } : undefined}
        detalles={[
          ...(canal.numero ? [{ icono: Phone, etiqueta: 'Número', valor: canal.numero, href: `tel:${canal.numero.replace(/[^\d+]/g, '')}` }] : []),
          ...(canal.nombreVerificado ? [{ icono: BadgeCheck, etiqueta: 'Nombre verificado', valor: canal.nombreVerificado }] : []),
        ]}
        extra={
          <Insignia tono={canal.botActivo ? 'exito' : 'aviso'} icono={canal.botActivo ? Power : PowerOff}>
            {canal.botActivo ? 'Agente encendido' : 'Agente apagado'}
          </Insignia>
        }
        menu={[{ etiqueta: 'Conexión con WhatsApp', icono: Plug, href: `/${slug}/configuracion?seccion=whatsapp` }]}
        acciones={
          seccion === 'sabe' && (
            <Boton icono={Plus} onClick={() => { setNuevo(true); setEditando(null); }}>
              Añadir bloque
            </Boton>
          )
        }
        accionesTelefono={
          s.enUrl && seccion === 'agente'
            ? <Boton form="form-agente" type="submit" icono={Save}>Guardar ajustes</Boton>
            : undefined
        }
      />

      <Secciones opciones={SECCIONES} seccion={s}>
        {seccion === 'agente' && (
          <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
            <h2 className="mb-4 hidden text-[14px] font-semibold text-texto lg:block">Cómo se comporta</h2>

            {falloIA && (
              <p className="mb-4 flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] leading-relaxed text-error">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                <span>
                  <strong>Último fallo del agente</strong>
                  {canal.ultimoErrorEn ? ` (${fechaHora(canal.ultimoErrorEn)})` : ''}: {falloIA}
                </span>
              </p>
            )}

            <form id="form-agente" action={guardarAjustesForm} className="flex min-h-0 flex-1 flex-col gap-4">
              <label
                className="flex cursor-pointer items-center gap-2.5 rounded border border-borde bg-realce px-3 py-2.5"
                title="Apagarlo lo calla en todo el número, sin tocar conversación por conversación. Lo que ya lleve una persona sigue igual."
              >
                <input type="checkbox" name="botActivo" defaultChecked={canal.botActivo} className="h-4 w-4 shrink-0" />
                <span className="text-[13px] font-medium text-texto">El agente contesta solo</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Campo etiqueta="Clave de OpenAI">
                  <div className="flex h-9 items-center justify-between gap-2 rounded border border-borde bg-tarjeta pl-3 pr-1">
                    {canal.claveIAFin
                      ? <span title="Guardada y cifrada" className="min-w-0 truncate"><Insignia tono="exito" icono={CheckCircle2}>…{canal.claveIAFin}</Insignia></span>
                      : <Insignia tono="error">Falta</Insignia>}
                    <Boton variante="fantasma" tamano="sm" icono={KeyRound} type="button"
                      onClick={() => setClave({ abierta: true, valor: '' })}>
                      {canal.claveIAFin ? 'Cambiar' : 'Añadir'}
                    </Boton>
                  </div>
                </Campo>
                <Campo etiqueta="Cuánto se lo piensa">
                  <Selector name="razonamiento" defaultValue={canal.razonamiento}>
                    <option value="minimal">Mínimo — rápido y barato</option>
                    <option value="low">Bajo — el habitual</option>
                    <option value="medium">Medio — más cuidadoso</option>
                    <option value="high">Alto — lento y caro</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="Espera (segundos)">
                  <Entrada type="number" name="debounce" min={0} max={120} defaultValue={canal.debounce}
                    title="Si el contacto sigue escribiendo, el reloj vuelve a empezar: así contesta a un bloque de mensajes y no frase por frase." />
                </Campo>
                <Campo etiqueta="Mensajes que recuerda">
                  <Entrada type="number" name="ventana" min={5} max={200} defaultValue={canal.ventana} />
                </Campo>
              </div>

              {/* Abajo a la derecha, en escritorio; en el teléfono va a la barra de acciones. */}
              <div className="mt-auto hidden justify-end pt-2 lg:flex">
                <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>
                  {enCurso ? 'Guardando…' : 'Guardar ajustes'}
                </Boton>
              </div>
            </form>
          </Tarjeta>
        )}

        {seccion === 'sabe' && (
          <Tarjeta className="overflow-hidden">
            <h2 className="hidden px-4 pt-4 pb-2 text-[14px] font-semibold text-texto lg:block">Lo que sabe del negocio</h2>
            {/* Registros en TABLA, detalle en panel (regla 2026-10-30); galería en el teléfono. */}
            <Tabla
              filas={bloques}
              claveFila={(b) => b.clave}
              alPulsarFila={(b) => { setEditando(b); setNuevo(false); }}
              filaActiva={(b) => editando?.clave === b.clave}
              recuento={`${bloques.length} ${bloques.length === 1 ? 'bloque' : 'bloques'} · ${activos} ${activos === 1 ? 'se le cuenta' : 'se le cuentan'} al agente`}
              vacio={<EstadoVacio icono={BookOpen} titulo="Todavía no sabe nada del negocio" detalle="Añade el primer bloque: un tema por bloque (precios, horarios, rutas…)." />}
              columnas={[
                { clave: 'titulo', titulo: 'Bloque', ancho: '28%', render: (b) => (
                  <span className={b.activo ? 'font-medium text-texto' : 'text-tenue line-through'}>{b.titulo}</span>
                ) },
                { clave: 'contenido', titulo: 'Contenido', render: (b) => (
                  <span className="block truncate text-tenue" title={b.contenido}>{b.contenido || 'vacío'}</span>
                ) },
                { clave: 'estado', titulo: 'Estado', ancho: '14%', render: (b) => (
                  <Insignia tono={b.activo ? 'exito' : 'neutro'}>{b.activo ? 'Se le cuenta' : 'Apagado'}</Insignia>
                ) },
                { clave: 'acciones', titulo: '', ancho: '52px', alinear: 'der', render: (b) => (
                  <BotonIcono icono={Trash2} titulo={`Borrar «${b.titulo}»`} onClick={() => setBorrar(b)} />
                ) },
              ]}
            />
          </Tarjeta>
        )}

        {seccion === 'habla' && (
          <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
            <h2 className="mb-3 hidden text-[14px] font-semibold text-texto lg:block">Las instrucciones del agente</h2>
            <div className="space-y-5">
              {ORDEN.map((tipo) => {
                const meta = NOMBRE_INSTRUCCION[tipo];
                const actual = instrucciones.find((i) => i.tipo === tipo);
                const cambiado = (textos[tipo] ?? '') !== (actual?.contenido ?? '');
                return (
                  <div key={tipo}>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                      <label className="text-[13px] font-medium text-texto" title={meta.ayuda}>{meta.titulo}</label>
                      {actual && <span className="text-[11px] text-tenue">versión {actual.version}</span>}
                    </div>
                    <AreaTexto
                      rows={7}
                      value={textos[tipo] ?? ''}
                      placeholder={meta.ayuda}
                      onChange={(e) => setTextos((t) => ({ ...t, [tipo]: e.target.value }))}
                      className="font-mono text-[12px]"
                    />
                    {/* La acción al final de lo que se rellena; lo que la acompaña, a su izquierda. */}
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      {cambiado && <span className="text-[11.5px] text-aviso">sin guardar</span>}
                      <Boton icono={Save} disabled={enCurso || !cambiado} onClick={() => guardarTexto(tipo)}>
                        {enCurso ? 'Guardando…' : 'Guardar como versión nueva'}
                      </Boton>
                    </div>
                  </div>
                );
              })}
            </div>
          </Tarjeta>
        )}
      </Secciones>

      {/* ── El panel de un bloque: pie fijo en UNA fila, papelera sin texto a la izquierda ── */}
      <PanelLateral
        abierto={panelAbierto}
        alCerrar={cerrarPanel}
        titulo={editando ? editando.titulo : 'Bloque nuevo'}
        ancho="lg"
        pie={
          <PieAcciones
            eliminar={editando ? (
              <BotonEliminar titulo={`Borrar «${editando.titulo}»`} disabled={enCurso} onClick={() => setBorrar(editando)} />
            ) : undefined}
          >
            <Boton variante="secundario" type="button" onClick={cerrarPanel} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-bloque" type="submit" icono={Save} disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar bloque'}
            </Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-bloque"
          key={editando?.clave ?? 'nuevo'}
          action={(datos) =>
            arranca(async () => {
              const r = await guardarConocimiento(slug, datos);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(r.mensaje ?? 'Guardado.');
              cerrarPanel();
              router.refresh();
            })
          }
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Título">
              <Entrada name="titulo" defaultValue={editando?.titulo ?? ''} required autoFocus />
            </Campo>
            <Campo etiqueta="Clave">
              <Entrada
                name="clave"
                defaultValue={editando?.clave ?? ''}
                readOnly={!!editando}
                placeholder="precios_2026"
                title="Identifica el bloque y no cambia: así se reescribe el contenido sin crear duplicados."
                required
              />
            </Campo>
          </div>
          <Campo etiqueta="Contenido">
            <AreaTexto name="contenido" rows={16} defaultValue={editando?.contenido ?? ''} className="font-mono text-[12px]" />
          </Campo>
          <label className="flex items-center gap-2 text-[13px] text-texto">
            <input type="checkbox" name="activo" defaultChecked={editando ? editando.activo : true} className="h-4 w-4" />
            Contárselo al agente
          </label>
        </form>
      </PanelLateral>

      <Ventanita
        abierto={clave.abierta}
        alCerrar={() => setClave({ abierta: false, valor: '' })}
        titulo={canal.claveIAFin ? 'Cambiar la clave de OpenAI' : 'Añadir la clave de OpenAI'}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setClave({ abierta: false, valor: '' })} disabled={enCurso}>Cancelar</Boton>
            <Boton icono={Save} disabled={enCurso || clave.valor.trim().length < 20}
              onClick={() => arranca(async () => {
                const d = new FormData();
                d.set('clave', clave.valor);
                const r = await guardarClaveIA(slug, d);
                if (!r.ok) { toast.error(r.error, { duration: 12000 }); return; }
                toast.success(r.mensaje ?? 'Guardada.');
                setClave({ abierta: false, valor: '' });
                router.refresh();
              })}>
              {enCurso ? 'Comprobando…' : 'Comprobar y guardar'}
            </Boton>
          </>
        }
      >
        <Campo etiqueta="Clave de API">
          <Entrada type="password" autoComplete="off" spellCheck={false} placeholder="sk-…"
            value={clave.valor} onChange={(e) => setClave({ abierta: true, valor: e.target.value })} />
        </Campo>
      </Ventanita>

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
            if (editando?.clave === borrar.clave) cerrarPanel();
            setBorrar(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}
