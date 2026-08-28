'use client';

/**
 * ESTUDIO DEL AGENTE — la pantalla.
 *
 * Sustituye a las antiguas pestañas «Parámetros» y «Conexión»: ya no son secciones del
 * rail, son **fuentes del propio grafo**. Se llega a ellas desde el paso donde intervienen
 * —los parámetros cuelgan de «¿de qué cliente es?», la conexión también— o desde los
 * atajos anclados abajo a la izquierda.
 *
 * Tres zonas:
 *   · Barra de control arriba: estado real del canal.
 *   · Panel izquierdo: el paso seleccionado, con sus esquemas de entrada y salida.
 *   · Panel derecho: la fuente seleccionada, con su contenido y el botón de editar.
 *
 * Los tres modos de navegar, por orden de uso:
 *   1. **Por los chips** — dentro de un esquema, `"@fuenteId"` se pinta como chip y abre
 *      esa fuente. Es la navegación principal: se llega al recurso desde el campo donde
 *      interviene, sin explicarlo con prosa.
 *   2. **Por el grafo** — pulsar una tarjeta abre sus bloques (y la vista viaja hasta ella).
 *   3. **Por intención** — los atajos, para quien viene a editar algo concreto.
 *
 * Editar NO ocurre en el panel derecho: abre el **panel lateral con overlay**, que es la
 * superficie de edición estándar del proyecto (ver `Diseño.md` → «Dónde se edita»). El
 * panel derecho muestra; no pide datos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { FlowPanelShell, PanelEmpty } from '@/components/dashboard/flows/FlowPanelUI';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';
import { RanuraAccionesCtx } from '@/components/dashboard/flows/estudio/RanuraAcciones';
import { LongTextDialog } from '@/components/ui/EditDialog';
import { TONO } from '@/components/ui/tonos';
import BotonAyuda from '@/components/ui/BotonAyuda';
import {
  Workflow, FileText, Database, Code2, Radio, AlertTriangle, Pencil, X, ArrowRight,
} from 'lucide-react';
import type { Pipeline, NodoPipeline, ContenidoFuente } from '@/lib/agente/estudio/tipos';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * ⚠️ Importación dinámica y SIN SSR. ELK usa APIs de navegador y pesa medio mega; el
 * lienzo tiene que ir en su propio trozo o la pantalla entera tarda en abrir.
 */
const PipelineFlow = dynamic(
  () => import('./PipelineFlow').then((m) => m.PipelineFlow),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-[12.5px] text-digi-muted" style={mf}>Dibujando el flujo…</div> },
);

const ICONO_ORIGEN = { bd: Database, codigo: Code2, runtime: Radio } as const;

interface Props {
  flowId: number;
  /** El conmutador Bandeja/Estudio, que se pinta a la altura del título. */
  acciones?: React.ReactNode;
  /** Se llama al guardar algo, para que el resto de la pantalla se entere. */
  recargar: () => void;
  /** Formularios reales que se abren en el panel lateral. */
  editores: {
    parametros: (cerrar: () => void) => React.ReactNode;
    conexion: (cerrar: () => void) => React.ReactNode;
    conocimiento: (cerrar: () => void) => React.ReactNode;
  };
}

export default function AgenteEstudio({ flowId, recargar, editores, acciones }: Props) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [cargando, setCargando] = useState(true);
  // Solo dos piezas de estado. Todo lo demás se deriva.
  const [nodoSel, setNodoSel] = useState<string | null>(null);
  const [fuenteSel, setFuenteSel] = useState<string | null>(null);
  const [contenido, setContenido] = useState<ContenidoFuente | null>(null);
  const [editando, setEditando] = useState<ContenidoFuente['editable'] | null>(null);
  /** El lienzo y sus paneles llegan hasta el pie de la app, sin meterse debajo. */
  const altoLienzo = useAltoHastaElPie({ minimo: 480 });

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/agente/estudio`).then((x) => x.json());
      if (r.data?.pipeline) setPipeline(r.data.pipeline);
    } finally { setCargando(false); }
  }, [flowId]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirFuente = useCallback(async (id: string) => {
    setFuenteSel(id);
    setContenido(null);
    const r = await fetch(`/api/admin/flows/${flowId}/agente/estudio?fuente=${encodeURIComponent(id)}`).then((x) => x.json());
    if (r.data) setContenido(r.data);
    else toast.error(r.error ?? 'No se pudo abrir la fuente');
  }, [flowId]);

  const nodo = useMemo(
    () => pipeline?.nodos.find((n) => n.id === nodoSel) ?? null,
    [pipeline, nodoSel],
  );

  if (cargando) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando el estudio…" /></div>;
  if (!pipeline) return <PanelEmpty Icon={AlertTriangle} title="No se pudo cargar el estudio" desc="Vuelve a intentarlo en un momento." />;

  const cerrarEditor = () => { setEditando(null); cargar(); recargar(); if (fuenteSel) abrirFuente(fuenteSel); };

  return (
    <div className="space-y-3">
      {/* Sin título ni recuento: «Estudio del agente» ya lo dice la pestaña encendida, y
          los pasos y recursos se cuentan solos mirando el lienzo, que es lo que hay
          justo debajo. */}
      <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
        {acciones}
      </div>

      <BarraDeControl estado={pipeline.estado} />

      {/* Tres columnas. El lienzo manda: los paneles no crecen.
          El alto se MIDE hasta el pie de la app; ver `useAltoHastaElPie`. */}
      <div ref={altoLienzo.ref} className="flex gap-3 items-stretch" style={altoLienzo.style}>
        <PanelNodo nodo={nodo} fuentes={pipeline.fuentes} alAbrirFuente={abrirFuente} />

        <div className="flex-1 min-w-0 rounded-lg border border-digi-border bg-digi-darker/40 overflow-hidden">
          <PipelineFlow
            pipeline={pipeline}
            nodoSel={nodoSel}
            alSeleccionarNodo={setNodoSel}
            alSeleccionarFuente={abrirFuente}
            atajos={<Atajos pipeline={pipeline} alAbrirFuente={abrirFuente} activa={fuenteSel} />}
          />
        </div>

        <PanelFuente
          contenido={contenido}
          cargando={!!fuenteSel && !contenido}
          alCerrar={() => { setFuenteSel(null); setContenido(null); }}
          alEditar={() => setEditando(contenido?.editable ?? null)}
          editores={editores}
          alGuardar={() => { cargar(); recargar(); if (fuenteSel) abrirFuente(fuenteSel); }}
        />
      </div>

      {/* Conocimiento va al PANEL LATERAL: es un formulario con lista, y esa es la
          superficie estándar para formularios (Diseño.md → «Dónde se edita»).
          Parámetros y Conexión no llegan aquí: se editan en el propio panel derecho. */}
      {editando?.tipo === 'conocimiento' && (
        <FlowPanelShell
          Icon={Pencil}
          title={contenido?.meta.label ?? 'Editar'}
          subtitle=""   // misma razón: el editor no necesita anunciar su tabla.
          onClose={cerrarEditor}
        >
          <div className="p-6">{editores.conocimiento(cerrarEditor)}</div>
        </FlowPanelShell>
      )}

      {/* Un prompt es UN campo —un texto largo—, no un formulario. Por eso va en
          VENTANITA CENTRADA y no en el panel lateral: la regla del proyecto reserva la
          centrada justo para uno o dos campos sueltos. Y centrada se lee mejor un texto
          largo que en una columna estrecha. */}
      {editando?.tipo === 'prompt' && (
        <EditorPrompt
          flowId={flowId}
          clave={editando.clave}
          titulo={contenido?.meta.label ?? 'Prompt'}
          inicial={contenido?.texto ?? ''}
          alCerrar={cerrarEditor}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ BARRA DE CONTROL ═══════════════════════ */

function BarraDeControl({ estado }: { estado: Pipeline['estado'] }) {
  const chips: { label: string; valor: string; tono?: 'error' | 'aviso' | 'exito' }[] = [
    { label: 'Agente', valor: estado.botActivo ? 'encendido' : 'apagado', tono: estado.botActivo ? 'exito' : 'aviso' },
    { label: 'Modelo', valor: estado.modelo },
    { label: 'Número', valor: estado.numero ?? 'sin conectar', tono: estado.numero ? undefined : 'aviso' },
    { label: 'Clave de IA', valor: estado.tieneClaveIA ? 'guardada' : 'falta', tono: estado.tieneClaveIA ? undefined : 'error' },
    { label: 'En cola', valor: String(estado.enCola) },
  ];
  return (
    <div className="flex items-center flex-wrap gap-2 rounded-lg border border-digi-border bg-digi-card px-3 py-2">
      <Workflow className="w-4 h-4 text-accent shrink-0" />
      <span className="text-[12px] font-semibold text-digi-text mr-1" style={mf}>Pipeline real del agente</span>
      <BotonAyuda titulo="Qué es esto" lado="derecha">
        <p className="mb-2">Cada tarjeta es <strong>un paso que el código ejecuta de verdad</strong>, y lleva anotado el archivo donde vive. Esto no es un editor de flujos: el flujo lo cambia el código.</p>
        <p className="mb-2">Los recursos que usa cada paso —prompts, conocimiento, parámetros, conexión— cuelgan al costado con línea discontinua. <strong>Pulsa uno para verlo y editarlo.</strong></p>
        <p>La rueda del ratón <strong>recorre</strong> el diagrama; el zoom está en los botones de abajo.</p>
      </BotonAyuda>
      <span className="flex-1" />
      {chips.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1.5 text-[11.5px]" style={mf}>
          <span className="text-digi-muted">{c.label}</span>
          <span className={`font-semibold ${c.tono ? TONO[c.tono].texto : 'text-digi-text'}`}>{c.valor}</span>
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════ PANEL IZQUIERDO: EL PASO ═══════════════════════ */

function PanelNodo({ nodo, fuentes, alAbrirFuente }: {
  nodo: NodoPipeline | null;
  fuentes: Pipeline['fuentes'];
  alAbrirFuente: (id: string) => void;
}) {
  return (
    // ⚠️ `height: 100%` + `min-height: 0` en el cuerpo. Sin altura definida el navegador
    // reparte con el alto del CONTENIDO y luego recorta: el cuerpo nunca se encoge y no
    // aparece la barra de desplazamiento.
    <div className="w-[300px] shrink-0 h-full flex flex-col rounded-lg border border-digi-border bg-digi-card overflow-hidden">
      <div className="px-3 py-2 border-b border-digi-border shrink-0">
        <span className="text-[12px] font-semibold text-digi-text" style={mf}>Paso seleccionado</span>
      </div>
      {!nodo ? (
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Pulsa un paso del diagrama para ver qué recibe y qué produce.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <div className="[&>*]:shrink-0">
            <p className="text-[13px] font-semibold text-digi-text" style={mf}>{nodo.label}</p>
            {nodo.sublabel && <p className="text-[11.5px] text-digi-muted mt-0.5" style={mf}>{nodo.sublabel}</p>}
            {nodo.archivo && (
              <code className="inline-block mt-1.5 text-[10.5px] text-accent bg-accent-light px-1.5 py-0.5 rounded border border-accent/20 break-all">
                {nodo.archivo}
              </code>
            )}
          </div>
          {nodo.bloques.map((b) => (
            <div key={b.id} className="shrink-0 rounded-md border border-digi-border bg-digi-darker/40 overflow-hidden">
              <div className="px-2.5 py-1.5 border-b border-digi-border">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-digi-muted" style={mf}>{b.titulo}</span>
              </div>
              <div className="p-2.5">
                <Esquema valor={b.esquema} fuentes={fuentes} alAbrirFuente={alAbrirFuente} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pinta un esquema. **Cualquier cadena `"@fuenteId"` se convierte en chip navegable.**
 * Eso es lo que permite nombrar el recurso dentro del campo donde interviene, en vez de
 * explicarlo aparte con prosa.
 */
function Esquema({ valor, fuentes, alAbrirFuente, nivel = 0 }: {
  valor: unknown;
  fuentes: Pipeline['fuentes'];
  alAbrirFuente: (id: string) => void;
  nivel?: number;
}) {
  if (valor == null) return <span className="text-[11px] text-digi-muted/70" style={mf}>—</span>;

  if (typeof valor === 'string') {
    if (valor.startsWith('@')) {
      const id = valor.slice(1);
      const f = fuentes[id];
      const Icono = f ? ICONO_ORIGEN[f.origen] : FileText;
      return (
        <button type="button" onClick={() => alAbrirFuente(id)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-accent/30 bg-accent-light text-accent text-[11px] font-medium hover:border-accent transition-colors align-middle">
          <Icono className="w-3 h-3" />{f?.label ?? id}
        </button>
      );
    }
    return <span className="text-[11px] text-digi-text" style={mf}>{valor}</span>;
  }

  if (Array.isArray(valor)) {
    return (
      <span className="inline-flex flex-wrap gap-1 items-center">
        {valor.map((v, i) => <Esquema key={i} valor={v} fuentes={fuentes} alAbrirFuente={alAbrirFuente} nivel={nivel + 1} />)}
      </span>
    );
  }

  if (typeof valor === 'object') {
    return (
      <div className={nivel > 0 ? 'pl-2 border-l border-digi-border space-y-1' : 'space-y-1'}>
        {Object.entries(valor as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex gap-1.5 items-baseline flex-wrap">
            <span className="text-[10.5px] font-mono text-digi-muted shrink-0">{k}:</span>
            <Esquema valor={v} fuentes={fuentes} alAbrirFuente={alAbrirFuente} nivel={nivel + 1} />
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-[11px] text-digi-text" style={mf}>{String(valor)}</span>;
}

/* ═══════════════════════ PANEL DERECHO: LA FUENTE ═══════════════════════ */

function PanelFuente({ contenido, cargando, alCerrar, alEditar, editores, alGuardar }: {
  contenido: ContenidoFuente | null;
  cargando: boolean;
  alCerrar: () => void;
  alEditar: () => void;
  editores: Props['editores'];
  alGuardar: () => void;
}) {
  /**
   * Parámetros y Conexión se editan AQUÍ MISMO, no en un overlay.
   *
   * Decisión de Fernando (2026-08-02): para esos dos, ver el JSON y tener que pulsar
   * «Editar» para que se abra un panel encima es un paso de más — lo que se quiere es
   * cambiar el modelo o conectar el número, y punto. El overlay se reserva para lo que
   * necesita sitio de verdad: los prompts largos y el conocimiento.
   */
  const enSitio = contenido?.editable?.tipo === 'parametros' || contenido?.editable?.tipo === 'conexion';
  // El formulario necesita más ancho que un visor de JSON.
  const ancho = enSitio ? 'w-[460px]' : 'w-[320px]';

  if (!contenido && !cargando) {
    return (
      <div className="w-[320px] shrink-0 h-full flex items-center justify-center rounded-lg border border-dashed border-digi-border px-4 text-center">
        <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
          Pulsa un recurso —los que cuelgan de los pasos con línea discontinua— para ver su contenido.
        </p>
      </div>
    );
  }

  const Icono = contenido ? ICONO_ORIGEN[contenido.meta.origen] : FileText;

  /**
   * ⚠️ Referencia como ESTADO, no como `useRef`. Un `ref` no vuelve a renderizar cuando se
   * rellena, así que el portal se dibujaría contra `null` en la primera pasada y ya no lo
   * volvería a intentar: el botón no aparecería nunca. Con estado, el nodo llega y el
   * componente se repinta con la ranura ya montada.
   */
  const [ranura, setRanura] = useState<HTMLElement | null>(null);

  return (
    <div className={`${ancho} shrink-0 h-full flex flex-col rounded-lg border border-digi-border bg-digi-card overflow-hidden transition-[width] duration-200`}>
      <div className="px-3 py-2 border-b border-digi-border flex items-start gap-2 shrink-0">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <Icono className="w-3.5 h-3.5 text-digi-muted shrink-0" />
            <span className="text-[12px] font-semibold text-digi-text truncate" style={mf}>{contenido?.meta.label ?? '…'}</span>
          </span>
          {/* Fuera la línea de procedencia («Base de datos · agente_conocimiento · entra
              COMPLETO en cada consulta…»). Es la fontanería contada en voz alta: nombres
              de tabla y rutas de archivo delante de quien solo quiere editar el
              conocimiento de su negocio. Sigue toda escrita en `lib/agente/estudio/
              pipeline.ts`, que es donde le sirve a quien programa. */}
        </span>
        {/* La acción principal del editor aterriza aquí, junto al nombre del panel. La
            declara el editor —que es quien sabe cuándo se puede pulsar— y solo se pinta
            aquí. Ver `RanuraAcciones.tsx`. */}
        <span ref={setRanura} className="flex items-center gap-2 shrink-0" />
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="text-digi-muted hover:text-digi-text shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ⚠️ `min-h-0` NO es opcional: por defecto vale `auto` = «no me encojas por debajo de
          mi contenido», y entonces nunca aparece la barra. Y los hijos con `shrink-0`,
          porque en una columna flex que desplaza SE ENCOGEN por defecto y recortan el texto
          en silencio. */}
      <RanuraAccionesCtx.Provider value={ranura}>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 [&>*]:shrink-0">
        {cargando && <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p>}

        {/* El formulario de verdad, montado aquí dentro. Los mismos componentes que había
            en las pestañas de antes — no una copia.
            La clase `estudio-en-sitio` los adapta a una columna: vienen de una pestaña a
            ancho completo, con rejilla de dos columnas y `max-w-3xl`, y aquí tienen 460 px.
            Ver la regla en globals.css. */}
        {enSitio && (
          <div className="estudio-en-sitio">
            {contenido?.editable?.tipo === 'parametros' && editores.parametros(alGuardar)}
            {contenido?.editable?.tipo === 'conexion' && editores.conexion(alGuardar)}
          </div>
        )}

        {contenido?.aviso && (
          <div className={`rounded-md border p-2.5 ${TONO.aviso.caja}`}>
            <p className={`text-[11.5px] leading-relaxed ${TONO.aviso.texto}`} style={mf}>{contenido.aviso}</p>
          </div>
        )}

        {!enSitio && contenido?.texto !== undefined && (
          <pre className="text-[11px] leading-relaxed text-digi-text whitespace-pre-wrap break-words font-mono bg-digi-darker/40 border border-digi-border rounded-md p-2.5">
            {contenido.texto || '(sin escribir)'}
          </pre>
        )}

        {!enSitio && contenido?.json !== undefined && (
          <pre className="text-[11px] leading-relaxed text-digi-text whitespace-pre-wrap break-words font-mono bg-digi-darker/40 border border-digi-border rounded-md p-2.5">
            {JSON.stringify(contenido.json, null, 2)}
          </pre>
        )}

        {!enSitio && contenido?.lista && (
          <ul className="space-y-1">
            {contenido.lista.map((i) => (
              <li key={i.id} className="rounded-md border border-digi-border bg-digi-darker/40 px-2.5 py-1.5">
                <span className="block text-[11.5px] font-medium text-digi-text" style={mf}>{i.label}</span>
                {i.detalle && (
                  <span className={`block text-[10.5px] mt-0.5 ${i.vacio ? TONO.aviso.texto : 'text-digi-muted'}`} style={mf}>{i.detalle}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      </RanuraAccionesCtx.Provider>

      {contenido?.editable && !enSitio && (
        <div className="px-3 py-2 border-t border-digi-border shrink-0">
          <button className={`${BTN_SECONDARY} w-full justify-center`} onClick={alEditar}>
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ ATAJOS ═══════════════════════ */

function Atajos({ pipeline, alAbrirFuente, activa }: {
  pipeline: Pipeline;
  alAbrirFuente: (id: string) => void;
  activa: string | null;
}) {
  return (
    <div className="rounded-lg border border-digi-border bg-digi-card/95 backdrop-blur px-2 py-1.5 shadow-sm">
      {pipeline.atajos.map((g) => (
        <div key={g.titulo}>
          <span className="block text-[9.5px] font-semibold uppercase tracking-wider text-digi-muted px-1 mb-1" style={mf}>{g.titulo}</span>
          <div className="flex flex-wrap gap-1 max-w-[420px]">
            {g.items.map((a) => (
              <button key={a.fuenteId} type="button" onClick={() => alAbrirFuente(a.fuenteId)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors
                  ${activa === a.fuenteId
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-digi-border text-digi-text hover:border-accent hover:text-accent'}`}
                style={mf}>
                {a.label}<ArrowRight className="w-3 h-3 opacity-50" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ EDITOR DE PROMPT ═══════════════════════ */

function EditorPrompt({ flowId, clave, titulo, inicial, alCerrar }: {
  flowId: number; clave: string; titulo: string; inicial: string; alCerrar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/agente/prompts`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: clave, contenido: texto }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'No se pudo guardar'); return; }
      toast.success('Guardado. La versión anterior se conserva.');
      alCerrar();
    } finally { setGuardando(false); }
  };

  return (
    <LongTextDialog
      open
      title={titulo}
      onClose={alCerrar}
      onSave={guardar}
      saving={guardando}
      canSave={texto !== inicial}
      saveLabel="Guardar"
    >
      <div className="space-y-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={22}
          spellCheck={false}
          className="field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded
                     text-[12.5px] font-mono text-digi-text focus:border-accent focus:outline-none leading-relaxed"
        />
        <p className="text-[11.5px] text-digi-muted" style={mf}>
          {texto.length.toLocaleString('es-ES')} caracteres. Al guardar <strong className="text-digi-text">se conserva la versión anterior</strong>.
        </p>
      </div>
    </LongTextDialog>
  );
}
