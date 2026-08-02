'use client';

/**
 * EL ESTUDIO del agente IA — espacio de trabajo del flujo de tipo `ai_agent`.
 *
 * Patrón "Explorador Azure" de `Diseño.md`: rail de secciones a la izquierda, contenido
 * a la derecha. Se monta a página completa desde `FlowDetail`, así que no trae cabecera
 * propia: la de la página ya lleva el nombre, el estado y las acciones.
 *
 * REGLA DEL SISTEMA: **nunca se edita por encima**. Todo formulario va en `EditPanel`
 * (panel lateral derecho); lo de uno o dos campos, en `QuickEditDialog`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import FilterRail from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { SectionBar, PanelEmpty, BTN_ROW, BTN_ROW_DANGER } from '@/components/dashboard/flows/FlowPanelUI';
import AgenteBandeja from '@/components/dashboard/flows/AgenteBandeja';
import AgenteConexion from '@/components/dashboard/flows/AgenteConexion';
import type { Aviso } from '@/components/ui/BotonAvisos';
import BotonAyuda from '@/components/ui/BotonAyuda';
import AgenteEstudio from '@/components/dashboard/flows/estudio/AgenteEstudio';
import {
  BookText, ScrollText, SlidersHorizontal, Plug, Inbox, Pencil, Trash2, Plus,
  AlertTriangle, Workflow,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Seccion = 'bandeja' | 'conocimiento' | 'prompts' | 'estudio';

interface Bloque {
  id: number; clave: string; titulo: string; contenido: string;
  orden: number; activo: boolean; caracteres: number; pendiente: boolean;
}
interface Prompt {
  tipo: string; version: number; contenido: string; caracteres: number; versiones: number;
}
interface Estudio {
  canal: any;
  capacidades: { effort: boolean; minimoCache: number; maxSalida: number };
  cache: { cachea: boolean; tokensEstimados: number; minimo: number; faltanCaracteres: number };
  pendientes: string[];
  modelos: readonly { id: string; nombre: string; nota: string }[];
  cifradoListo: boolean;
  appId: string | null;
  configId: string | null;
}

const NOMBRE_PROMPT: Record<string, { titulo: string; para: string }> = {
  perfil_agente: { titulo: 'Perfil del agente', para: 'Quién es, qué hace la empresa, cómo habla y qué no hace nunca.' },
  reglas_negocio: { titulo: 'Reglas de negocio', para: 'Cuándo usa cada herramienta. Es el que gobierna la decisión.' },
  resumen_conversacion: { titulo: 'Resumen de conversación', para: 'Cómo comprime la conversación en la memoria larga.' },
};

export default function AgenteFlowWorkspace({ flow, onAvisos }: {
  flow: { id: number; name: string };
  /** Los avisos suben a la cabecera de la página: allí viven junto a «Activar». */
  onAvisos?: (avisos: Aviso[]) => void;
}) {
  const [seccion, setSeccion] = useState<Seccion>('bandeja');
  const [estudio, setEstudio] = useState<Estudio | null>(null);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const [e, c, p] = await Promise.all([
        fetch(`/api/admin/flows/${flow.id}/agente`).then((r) => r.json()),
        fetch(`/api/admin/flows/${flow.id}/agente/conocimiento`).then((r) => r.json()),
        fetch(`/api/admin/flows/${flow.id}/agente/prompts`).then((r) => r.json()),
      ]);
      if (e.data) setEstudio(e.data);
      setBloques(c.data ?? []);
      setPrompts(p.data ?? []);
    } catch { toast.error('No se pudo cargar el estudio'); }
    finally { setCargando(false); }
  }, [flow.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const avisos = useMemo(() => calcularAvisos(estudio), [estudio]);
  // Se reportan a la página, que los pinta junto a «Activar». Depende de `avisos`, que
  // es memoizado, así que esto no entra en bucle.
  useEffect(() => { onAvisos?.(avisos); }, [avisos, onAvisos]);

  if (cargando) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando el estudio…" /></div>;
  if (!estudio) return <PanelEmpty Icon={AlertTriangle} title="No se pudo cargar el estudio" desc="Vuelve a intentarlo en un momento." />;

  const rail = [
    { value: 'bandeja' as const, label: 'Bandeja', Icon: Inbox },
    { value: 'conocimiento' as const, label: 'Conocimiento', Icon: BookText, count: bloques.length,
      hint: estudio.pendientes.length ? `${estudio.pendientes.length} sin rellenar` : undefined },
    { value: 'prompts' as const, label: 'Prompts', Icon: ScrollText, count: prompts.filter((p) => p.caracteres > 0).length },
    // Parámetros y Conexión YA NO son secciones: viven dentro del Estudio como fuentes
    // del propio grafo, en el paso donde intervienen. Ver AgenteEstudio.
    { value: 'estudio' as const, label: 'Estudio del agente', Icon: Workflow },
  ];

  return (
    <div className="flex gap-4 items-start">
      <div className="w-[240px] shrink-0">
        <FilterRail title="Estudio" items={rail} value={seccion} onChange={(v) => setSeccion(v as Seccion)} wrapLabels />
      </div>
      <div className="flex-1 min-w-0 space-y-4">
        {seccion === 'bandeja' && <AgenteBandeja flowId={flow.id} />}
        {seccion === 'conocimiento' && <Conocimiento flowId={flow.id} bloques={bloques} recargar={cargar} />}
        {seccion === 'prompts' && <Prompts flowId={flow.id} prompts={prompts} recargar={cargar} />}
        {seccion === 'estudio' && (
          <AgenteEstudio
            flowId={flow.id}
            recargar={cargar}
            editores={{
              parametros: () => <Parametros flowId={flow.id} estudio={estudio} recargar={cargar} />,
              conexion: () => (
                <AgenteConexion flowId={flow.id} canal={estudio.canal}
                  appId={estudio.appId} configId={estudio.configId} recargar={cargar} />
              ),
              conocimiento: () => <Conocimiento flowId={flow.id} bloques={bloques} recargar={cargar} />,
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Los avisos: lo que cuesta dinero o silencio ────────────────────────────── */

/**
 * Se calculan de los datos, no se guardan. Suben a la cabecera y se ven al pulsar el
 * icono de advertencia, en vez de ocupar la pantalla mientras se trabaja.
 */
function calcularAvisos(estudio: Estudio | null): Aviso[] {
  if (!estudio) return [];
  const { canal, cache, cifradoListo } = estudio;
  const avisos: Aviso[] = [];

  if (!cifradoListo) {
    avisos.push({ tono: 'error', texto: 'Falta AGENTE_CLAVE_MAESTRA en el servidor: sin ella no se puede guardar ningún secreto.' });
  }
  if (!canal.tiene_ia_api_key) {
    avisos.push({ tono: 'error', texto: 'Sin clave de IA, el agente no puede decidir: cada conversación pasará directamente a una persona.' });
  }
  if (canal.ultimo_error) {
    avisos.push({ tono: 'error', texto: `Último fallo del canal: ${canal.ultimo_error}` });
  }
  if (!cache.cachea) {
    // Este es el que evita pagar de más sin enterarse.
    avisos.push({
      tono: 'aviso',
      texto: `El prompt no llega al mínimo de caché de este modelo (~${cache.tokensEstimados} de ${cache.minimo} tokens), así que se paga entero en cada mensaje. Faltan unos ${cache.faltanCaracteres.toLocaleString('es-ES')} caracteres de conocimiento — o usa un modelo con mínimo más bajo.`,
    });
  }
  if (!canal.bot_activo) {
    avisos.push({ tono: 'aviso', texto: 'El agente está apagado: recibe y guarda los mensajes, pero no responde. Se enciende en Parámetros.' });
  }
  return avisos;
}

/* ── Conocimiento ───────────────────────────────────────────────────────────── */

function Conocimiento({ flowId, bloques, recargar }: { flowId: number; bloques: Bloque[]; recargar: () => void }) {
  const [editando, setEditando] = useState<Partial<Bloque> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState<Bloque | null>(null);

  const total = bloques.reduce((s, b) => s + b.caracteres, 0);

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    try {
      const esNuevo = !editando.id;
      const res = await fetch(
        esNuevo ? `/api/admin/flows/${flowId}/agente/conocimiento`
                : `/api/admin/flows/${flowId}/agente/conocimiento/${editando.id}`,
        { method: esNuevo ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editando) },
      );
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'No se pudo guardar'); return; }
      setEditando(null); recargar();
    } finally { setGuardando(false); }
  };

  const eliminar = async () => {
    if (!borrar) return;
    await fetch(`/api/admin/flows/${flowId}/agente/conocimiento/${borrar.id}`, { method: 'DELETE' });
    setBorrar(null); recargar();
  };

  return (
    <div>
      <SectionBar
        title="Bloques de conocimiento"
        hint={`${bloques.length} bloque(s) · ${total.toLocaleString('es-ES')} caracteres`}
      >
        <BotonAyuda titulo="Cómo escribir los bloques">
          Entran <strong>completos</strong> en cada consulta: el agente no busca, lo lee todo. Escríbelos
          de forma descriptiva («Si te preguntan por los horarios, responde: …»), no como una lista de
          preguntas y respuestas. Un bloque a medias se marca con <code>[PENDIENTE]</code> y el agente
          pasará esas preguntas a una persona.
        </BotonAyuda>
        <button onClick={() => setEditando({ titulo: '', clave: '', contenido: '', orden: bloques.length + 1 })} className={BTN_PRIMARY}>
          <Plus className="w-4 h-4" /> Nuevo bloque
        </button>
      </SectionBar>

      {bloques.length === 0 ? (
        <PanelEmpty Icon={BookText} title="El agente todavía no sabe nada"
          desc="Añade un primer bloque: qué hace el negocio, qué ofrece y cómo debe responder." />
      ) : (
        <PixelDataTable
          columns={[
            { key: 'titulo', header: 'Bloque', render: (b: Bloque) => (
              <div>
                <div className="font-medium text-digi-text">{b.titulo}</div>
                <code className="text-[11px] text-digi-muted">{b.clave}</code>
              </div>
            ) },
            { key: 'estado', header: 'Estado', render: (b: Bloque) =>
              !b.activo ? <PixelBadge variant="default">Desactivado</PixelBadge>
              : b.pendiente ? <PixelBadge variant="warning">Sin rellenar</PixelBadge>
              : <PixelBadge variant="success">Listo</PixelBadge> },
            { key: 'caracteres', header: 'Tamaño', render: (b: Bloque) =>
              <span className="text-digi-muted">{b.caracteres.toLocaleString('es-ES')} car.</span> },
            { key: 'acciones', header: '', render: (b: Bloque) => (
              <div className="flex gap-1 justify-end">
                <button className={BTN_ROW} onClick={() => setEditando(b)}><Pencil className="w-3.5 h-3.5" /> Editar</button>
                <button className={BTN_ROW_DANGER} onClick={() => setBorrar(b)}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ) },
          ]}
          data={bloques}
        />
      )}

      <EditPanel
        open={!!editando}
        title={editando?.id ? 'Editar bloque' : 'Nuevo bloque de conocimiento'}
        onClose={() => setEditando(null)}
        onSave={guardar}
        saving={guardando}
        canSave={!!editando?.titulo?.trim() && !!editando?.clave?.trim()}
      >
        <EditField label="Título" hint="Lo que se ve en esta tabla.">
          <PixelInput value={editando?.titulo ?? ''} onChange={(e: any) => setEditando({ ...editando, titulo: e.target.value })} />
        </EditField>
        <EditField label="Clave" hint="Identificador corto y estable, en minúsculas: empresa, pagos, horario_atencion.">
          <PixelInput value={editando?.clave ?? ''} disabled={!!editando?.id}
            onChange={(e: any) => setEditando({ ...editando, clave: e.target.value })} />
        </EditField>
        <EditField label="Contenido" hint="Descriptivo, no pares pregunta→respuesta. Usa [PENDIENTE] si aún falta el dato.">
          <textarea className={EDIT_INPUT} rows={14} value={editando?.contenido ?? ''}
            onChange={(e) => setEditando({ ...editando, contenido: e.target.value })} />
        </EditField>
        <EditField label="Orden" hint="El orden fija el prefijo cacheado; cambiarlo hace que se vuelva a cachear una vez.">
          <PixelInput type="number" value={String(editando?.orden ?? 0)}
            onChange={(e: any) => setEditando({ ...editando, orden: Number(e.target.value) })} />
        </EditField>
      </EditPanel>

      <PixelConfirm
        open={!!borrar}
        title="Eliminar bloque"
        message={`¿Eliminar «${borrar?.titulo}»? El agente dejará de saber esto.`}
        confirmLabel="Sí, eliminar" danger
        onConfirm={eliminar} onCancel={() => setBorrar(null)}
      />
    </div>
  );
}

/* ── Prompts ────────────────────────────────────────────────────────────────── */

function Prompts({ flowId, prompts, recargar }: {
  flowId: number; prompts: Prompt[]; recargar: () => void;
}) {
  const [editando, setEditando] = useState<Prompt | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/agente/prompts`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: editando.tipo, contenido: editando.contenido }),
      });
      if (!res.ok) { toast.error('No se pudo guardar el prompt'); return; }
      setEditando(null); recargar();
    } finally { setGuardando(false); }
  };

  return (
    <div>
      <SectionBar title="Prompts del agente">
        <BotonAyuda titulo="Prompts del agente">
          <p className="mb-2">Al guardar <strong>se conserva la versión anterior</strong>: nada se pierde al editar.</p>
          <p>Los bloques de conocimiento sin rellenar se añaden solos a las reglas al hablar con el
          modelo. <strong>No hace falta escribir aquí cuáles faltan</strong> — se calcula.</p>
        </BotonAyuda>
      </SectionBar>

      <div className="grid gap-3">
        {prompts.map((p) => {
          const meta = NOMBRE_PROMPT[p.tipo];
          return (
            <div key={p.tipo} className="rounded-lg border border-digi-border bg-digi-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-digi-text" style={mf}>{meta.titulo}</span>
                    {p.version > 0
                      ? <PixelBadge variant="info">v{p.version}</PixelBadge>
                      : <PixelBadge variant="warning">Sin escribir</PixelBadge>}
                  </div>
                  <p className="text-[12.5px] text-digi-muted mt-0.5" style={mf}>{meta.para}</p>
                </div>
                <button className={BTN_ROW} onClick={() => setEditando(p)}>
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              </div>
              {p.caracteres > 0 && (
                <p className="text-[12px] text-digi-muted mt-2 line-clamp-2" style={mf}>{p.contenido}</p>
              )}
              <p className="text-[11px] text-digi-muted mt-2" style={mf}>
                {p.caracteres.toLocaleString('es-ES')} caracteres · {p.versiones} versión(es) guardada(s)
              </p>
            </div>
          );
        })}
      </div>

      <EditPanel
        open={!!editando}
        title={editando ? NOMBRE_PROMPT[editando.tipo].titulo : ''}
        onClose={() => setEditando(null)} onSave={guardar} saving={guardando}
        saveLabel="Guardar nueva versión"
      >
        <EditField label="Contenido" hint={editando ? NOMBRE_PROMPT[editando.tipo].para : ''}>
          <textarea className={EDIT_INPUT} rows={20} value={editando?.contenido ?? ''}
            onChange={(e) => setEditando(editando ? { ...editando, contenido: e.target.value } : null)} />
        </EditField>
      </EditPanel>
    </div>
  );
}

/* ── Parámetros ─────────────────────────────────────────────────────────────── */

function Parametros({ flowId, estudio, recargar }: { flowId: number; estudio: Estudio; recargar: () => void }) {
  const c = estudio.canal;
  const [form, setForm] = useState({
    modelo: c.modelo, max_tokens: c.max_tokens, debounce_segundos: c.debounce_segundos,
    ventana_mensajes: c.ventana_mensajes, bot_activo: c.bot_activo,
  });
  const [clave, setClave] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/agente`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(clave.trim() ? { ia_api_key: clave.trim() } : {}) }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'No se pudo guardar'); return; }
      setClave(''); toast.success('Parámetros guardados'); recargar();
    } finally { setGuardando(false); }
  };

  const modeloElegido = estudio.modelos.find((m) => m.id === form.modelo);

  return (
    <div>
      <SectionBar title="Parámetros de ejecución">
        <BotonAyuda titulo="Parámetros de ejecución">
          Los valores por defecto son los <strong>medidos en producción</strong>, no estimaciones.
          Cada campo tiene su propia ayuda: pulsa el (?) que hay junto a su nombre.
        </BotonAyuda>
        <button className={BTN_PRIMARY} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </SectionBar>

      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        <Campo
          label="Modelo"
          ayuda={<>
            {modeloElegido?.nota && <p className="mb-2">{modeloElegido.nota}</p>}
            <p>
              <strong>Mínimo de caché: {estudio.capacidades.minimoCache.toLocaleString('es-ES')} tokens.</strong>{' '}
              Por debajo de eso el prompt se paga entero en cada mensaje.
            </p>
          </>}
        >
          <PixelSelect
            value={form.modelo}
            onChange={(e: any) => setForm({ ...form, modelo: e.target.value })}
            options={estudio.modelos.map((m) => ({ value: m.id, label: m.nombre }))}
          />
        </Campo>

        <Campo
          label="Espera antes de responder"
          ayuda={<>
            <p className="mb-2">Agrupa una ráfaga de mensajes en una sola respuesta, en vez de contestar a cada línea suelta.</p>
            <p><strong>Segundos, de 0 a 120.</strong> Recomendado: 8.</p>
          </>}
        >
          <PixelInput type="number" value={String(form.debounce_segundos)}
            onChange={(e: any) => setForm({ ...form, debounce_segundos: Number(e.target.value) })} />
        </Campo>

        <Campo
          label="Mensajes de contexto"
          ayuda={<>
            <p className="mb-2">Cuántos mensajes anteriores ve el agente, además del resumen acumulado de la conversación.</p>
            <p><strong>De 2 a 400.</strong> Recomendado: 40.</p>
          </>}
        >
          <PixelInput type="number" value={String(form.ventana_mensajes)}
            onChange={(e: any) => setForm({ ...form, ventana_mensajes: Number(e.target.value) })} />
        </Campo>

        <Campo
          label="Tokens máximos de respuesta"
          ayuda={<>
            <p className="mb-2">Acota el razonamiento y la respuesta <strong>juntos</strong>, no solo lo que se escribe.</p>
            <p>Tope de este modelo: <strong>{estudio.capacidades.maxSalida.toLocaleString('es-ES')}</strong>.</p>
          </>}
        >
          <PixelInput type="number" value={String(form.max_tokens)}
            onChange={(e: any) => setForm({ ...form, max_tokens: Number(e.target.value) })} />
        </Campo>

        <Campo
          label="Clave de IA del cliente"
          ayuda={<>
            <p className="mb-2">La pone el cliente y se guarda <strong>cifrada</strong>. No se puede volver a leer: para cambiarla se escribe una nueva encima.</p>
            <p>Sin clave, el agente no puede decidir y cada conversación pasa directamente a una persona.</p>
          </>}
        >
          {/* El marcador de posición YA dice si hay clave guardada: repetirlo debajo en un
              párrafo era decir dos veces lo mismo. Y el aviso de «sin clave» vive en el
              botón de advertencias de la cabecera, que es donde se mira. */}
          <PixelInput type="password" placeholder={c.tiene_ia_api_key ? '•••••••• (ya guardada)' : 'sk-ant-…'}
            value={clave} onChange={(e: any) => setClave(e.target.value)} />
        </Campo>

        <Campo
          label="Agente encendido"
          ayuda={<>
            <p className="mb-2"><strong>No se enciende solo, a propósito:</strong> es una decisión consciente, después de probar.</p>
            <p>Apagado, el agente sigue recibiendo y guardando los mensajes en la bandeja — simplemente no responde.</p>
          </>}
        >
          <label className="flex items-center gap-2 text-[13px] text-digi-text cursor-pointer" style={mf}>
            <input type="checkbox" checked={form.bot_activo}
              onChange={(e) => setForm({ ...form, bot_activo: e.target.checked })} />
            {form.bot_activo ? 'Responde automáticamente' : 'Apagado'}
          </label>
        </Campo>
      </div>
    </div>
  );
}

function Campo({ label, ayuda, children }: {
  label: string; ayuda?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      {/* El (?) va a la IZQUIERDA de la etiqueta, en flujo normal.
          ⚠️ El primer intento lo sacaba fuera con `-ml-[26px]` para que la etiqueta siguiera
          alineada con su campo. Medido en el navegador, eso deja el botón 2px FUERA de su
          columna — invisible aquí, pero recortado en cuanto el panel tenga menos margen.
          Se prefiere que la etiqueta con ayuda quede algo indentada respecto a su campo:
          se lee como intencional y no puede recortarse. Lo que NO se toca es el campo, que
          sigue alineado con los demás de la rejilla. */}
      <div className="flex items-center gap-1 mb-1 min-h-6">
        {ayuda && <BotonAyuda titulo={label} lado="derecha">{ayuda}</BotonAyuda>}
        <label className="block text-[12px] font-semibold text-digi-text" style={mf}>{label}</label>
      </div>
      {children}
    </div>
  );
}

