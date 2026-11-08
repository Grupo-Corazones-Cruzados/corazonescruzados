'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Power, PowerOff, Phone, BookOpen, ScrollText, Plus, Trash2, AlertTriangle, Save, BadgeCheck, KeyRound,
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
 * EL ESTUDIO DEL AGENTE: Comportamiento · Conocimiento · Instrucciones (nombres de Fernando,
 * 2026-11-08). La CONEXIÓN con WhatsApp vive en Configuración ▸ WhatsApp; aquí, el agente.
 *
 * ⭐ POCO TEXTO (Fernando, 2026-11-08: «tienes todo muy descriptivo»). Etiquetas de una o dos
 * palabras, estados de una («Activo»), sin títulos de tarjeta que repiten la sección y sin
 * frases que expliquen lo obvio. Conocimiento e Instrucciones se navegan IGUAL: una tabla y,
 * al tocar una fila, su editor en el panel lateral.
 */

const INSTRUCCIONES: { tipo: string; nombre: string; pista: string }[] = [
  { tipo: 'perfil_agente', nombre: 'Perfil', pista: 'Quién es el agente y cómo habla.' },
  { tipo: 'reglas_negocio', nombre: 'Reglas', pista: 'Lo que puede y no puede hacer.' },
  { tipo: 'resumen_conversacion', nombre: 'Resumen', pista: 'Qué conserva al resumir una conversación larga.' },
];

const SECCIONES: OpcionRail[] = [
  { valor: 'agente', etiqueta: 'Comportamiento', icono: SlidersHorizontal },
  { valor: 'conocimiento', etiqueta: 'Conocimiento', icono: BookOpen },
  { valor: 'instrucciones', etiqueta: 'Instrucciones', icono: ScrollText },
];

const ESTADO = (activo: boolean) => <Insignia tono={activo ? 'exito' : 'neutro'}>{activo ? 'Activo' : 'Inactivo'}</Insignia>;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

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
  const [instruccion, setInstruccion] = useState<{ tipo: string; texto: string } | null>(null);
  const s = useSeccion(SECCIONES);
  const seccion = s.activo;
  const panelAbierto = nuevo || editando !== null;
  const cerrarPanel = () => { setNuevo(false); setEditando(null); };
  const falloIA = esFalloDeIA(canal.ultimoError) ? canal.ultimoError : null;
  const activos = bloques.filter((b) => b.activo).length;
  const filasInstrucciones = INSTRUCCIONES.map((i) => ({ ...i, actual: instrucciones.find((x) => x.tipo === i.tipo) ?? null }));
  const metaInstruccion = INSTRUCCIONES.find((i) => i.tipo === instruccion?.tipo);
  const actualInstruccion = instrucciones.find((i) => i.tipo === instruccion?.tipo);

  function guardarAjustesForm(datos: FormData) {
    arranca(async () => {
      const r = await guardarAjustes(slug, datos);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(r.mensaje ?? 'Guardado.');
      router.refresh();
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CabeceraPagina
        titulo="Estudio"
        descripcion="El comportamiento, el conocimiento y las instrucciones del agente."
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver al Estudio' } : undefined}
        detalles={[
          ...(canal.numero ? [{ icono: Phone, etiqueta: 'Número', valor: canal.numero, href: `tel:${canal.numero.replace(/[^\d+]/g, '')}` }] : []),
          ...(canal.nombreVerificado ? [{ icono: BadgeCheck, etiqueta: 'Nombre verificado', valor: canal.nombreVerificado }] : []),
        ]}
        extra={
          <Insignia tono={canal.botActivo ? 'exito' : 'aviso'} icono={canal.botActivo ? Power : PowerOff}>
            {canal.botActivo ? 'Agente activo' : 'Agente inactivo'}
          </Insignia>
        }
        menu={[{ etiqueta: 'Conexión con WhatsApp', icono: Plug, href: `/${slug}/configuracion?seccion=whatsapp` }]}
        acciones={
          seccion === 'conocimiento' && (
            <Boton icono={Plus} onClick={() => { setNuevo(true); setEditando(null); }}>Nuevo bloque</Boton>
          )
        }
        accionesTelefono={
          s.enUrl && seccion === 'agente'
            ? <Boton form="form-agente" type="submit" icono={Save}>Guardar</Boton>
            : undefined
        }
      />

      <Secciones opciones={SECCIONES} seccion={s}>
        {seccion === 'agente' && (
          <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
            {falloIA && (
              <p className="mb-4 flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] leading-relaxed text-error">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                <span>
                  <strong>Último fallo{canal.ultimoErrorEn ? ` (${fechaHora(canal.ultimoErrorEn)})` : ''}</strong>: {falloIA}
                </span>
              </p>
            )}

            <form id="form-agente" action={guardarAjustesForm} className="flex min-h-0 flex-1 flex-col gap-4">
              <label
                className="flex cursor-pointer items-center gap-2.5 rounded border border-borde bg-realce px-3 py-2.5"
                title="Apagado, el agente no contesta en ninguna conversación."
              >
                <input type="checkbox" name="botActivo" defaultChecked={canal.botActivo} className="h-4 w-4 shrink-0" />
                <span className="text-[13px] font-medium text-texto">Agente activo</span>
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
                <Campo etiqueta="Razonamiento">
                  <Selector name="razonamiento" defaultValue={canal.razonamiento}>
                    <option value="minimal">Mínimo</option>
                    <option value="low">Bajo</option>
                    <option value="medium">Medio</option>
                    <option value="high">Alto</option>
                  </Selector>
                </Campo>
                <Campo etiqueta="Espera (segundos)">
                  <Entrada type="number" name="debounce" min={0} max={120} defaultValue={canal.debounce}
                    title="Si el contacto sigue escribiendo, espera antes de contestar." />
                </Campo>
                <Campo etiqueta="Memoria (mensajes)">
                  <Entrada type="number" name="ventana" min={5} max={200} defaultValue={canal.ventana} />
                </Campo>
              </div>

              <div className="mt-auto hidden justify-end pt-2 lg:flex">
                <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>
                  {enCurso ? 'Guardando…' : 'Guardar'}
                </Boton>
              </div>
            </form>
          </Tarjeta>
        )}

        {seccion === 'conocimiento' && (
          <Tarjeta className="overflow-hidden">
            <Tabla
              filas={bloques}
              claveFila={(b) => b.clave}
              alPulsarFila={(b) => { setEditando(b); setNuevo(false); }}
              filaActiva={(b) => editando?.clave === b.clave}
              recuento={`${plural(bloques.length, 'bloque', 'bloques')} · ${plural(activos, 'activo', 'activos')}`}
              vacio={<EstadoVacio icono={BookOpen} titulo="Sin bloques" />}
              columnas={[
                { clave: 'titulo', titulo: 'Título', ancho: '28%', render: (b) => (
                  <span className={b.activo ? 'font-medium text-texto' : 'text-tenue'}>{b.titulo}</span>
                ) },
                { clave: 'contenido', titulo: 'Contenido', render: (b) => (
                  <span className="block truncate text-tenue" title={b.contenido}>{b.contenido || '—'}</span>
                ) },
                { clave: 'estado', titulo: 'Estado', ancho: '12%', render: (b) => ESTADO(b.activo) },
                { clave: 'acciones', titulo: '', ancho: '52px', alinear: 'der', render: (b) => (
                  <BotonIcono icono={Trash2} titulo={`Eliminar «${b.titulo}»`} onClick={() => setBorrar(b)} />
                ) },
              ]}
            />
          </Tarjeta>
        )}

        {seccion === 'instrucciones' && (
          <Tarjeta className="overflow-hidden">
            <Tabla
              filas={filasInstrucciones}
              claveFila={(i) => i.tipo}
              alPulsarFila={(i) => setInstruccion({ tipo: i.tipo, texto: i.actual?.contenido ?? '' })}
              filaActiva={(i) => instruccion?.tipo === i.tipo}
              recuento={plural(filasInstrucciones.length, 'instrucción', 'instrucciones')}
              columnas={[
                { clave: 'nombre', titulo: 'Instrucción', ancho: '20%', render: (i) => (
                  <span className="font-medium text-texto" title={i.pista}>{i.nombre}</span>
                ) },
                { clave: 'contenido', titulo: 'Contenido', render: (i) => (
                  <span className="block truncate text-tenue" title={i.actual?.contenido}>{i.actual?.contenido || '—'}</span>
                ) },
                { clave: 'version', titulo: 'Versión', ancho: '12%', alinear: 'der', render: (i) => (
                  <span className="tabular-nums text-tenue">{i.actual ? i.actual.version : '—'}</span>
                ) },
              ]}
            />
          </Tarjeta>
        )}
      </Secciones>

      {/* ── Un bloque de conocimiento ── */}
      <PanelLateral
        abierto={panelAbierto}
        alCerrar={cerrarPanel}
        titulo={editando ? editando.titulo : 'Nuevo bloque'}
        ancho="lg"
        pie={
          <PieAcciones
            eliminar={editando ? (
              <BotonEliminar titulo={`Eliminar «${editando.titulo}»`} disabled={enCurso} onClick={() => setBorrar(editando)} />
            ) : undefined}
          >
            <Boton variante="secundario" type="button" onClick={cerrarPanel} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-bloque" type="submit" icono={Save} disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
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
                title="No cambia: identifica el bloque."
                required
              />
            </Campo>
          </div>
          <Campo etiqueta="Contenido">
            <AreaTexto name="contenido" rows={16} defaultValue={editando?.contenido ?? ''} className="font-mono text-[12px]" />
          </Campo>
          <label className="flex items-center gap-2 text-[13px] text-texto">
            <input type="checkbox" name="activo" defaultChecked={editando ? editando.activo : true} className="h-4 w-4" />
            Activo
          </label>
        </form>
      </PanelLateral>

      {/* ── Una instrucción: cada guardado deja versión ── */}
      <PanelLateral
        abierto={instruccion !== null}
        alCerrar={() => setInstruccion(null)}
        titulo={metaInstruccion ? `${metaInstruccion.nombre}${actualInstruccion ? ` · versión ${actualInstruccion.version}` : ''}` : ''}
        ancho="lg"
        pie={
          <PieAcciones>
            <Boton variante="secundario" type="button" onClick={() => setInstruccion(null)} disabled={enCurso}>Cancelar</Boton>
            <Boton icono={Save}
              disabled={enCurso || !instruccion || instruccion.texto === (actualInstruccion?.contenido ?? '')}
              onClick={() => arranca(async () => {
                if (!instruccion) return;
                const r = await guardarInstruccion(slug, instruccion.tipo as never, instruccion.texto);
                if (!r.ok) { toast.error(r.error); return; }
                toast.success(r.mensaje ?? 'Guardado.');
                setInstruccion(null);
                router.refresh();
              })}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </PieAcciones>
        }
      >
        {/* El texto ocupa todo el alto del panel: es lo único que hay que editar. */}
        <AreaTexto
          value={instruccion?.texto ?? ''}
          placeholder={metaInstruccion?.pista}
          onChange={(e) => setInstruccion((x) => (x ? { ...x, texto: e.target.value } : x))}
          className="h-full min-h-[320px] resize-none font-mono text-[12px]"
        />
      </PanelLateral>

      <Ventanita
        abierto={clave.abierta}
        alCerrar={() => setClave({ abierta: false, valor: '' })}
        titulo="Clave de OpenAI"
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
              {enCurso ? 'Comprobando…' : 'Guardar'}
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
        titulo={`¿Eliminar «${borrar?.titulo}»?`}
        mensaje="Para dejar de usarlo sin perderlo, márcalo como inactivo."
        textoAceptar="Eliminar"
        peligro
        alAceptar={() =>
          arranca(async () => {
            if (!borrar) return;
            const r = await borrarConocimiento(slug, borrar.clave);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(r.mensaje ?? 'Eliminado.');
            if (editando?.clave === borrar.clave) cerrarPanel();
            setBorrar(null);
            router.refresh();
          })
        }
      />
    </div>
  );
}
