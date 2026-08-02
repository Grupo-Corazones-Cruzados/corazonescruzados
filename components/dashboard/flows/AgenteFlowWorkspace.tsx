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

import { useCallback, useEffect, useState } from 'react';
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
import {
  BookText, ScrollText, SlidersHorizontal, Plug, Inbox, Pencil, Trash2, Plus,
  AlertTriangle, KeyRound, Sparkles,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Seccion = 'bandeja' | 'conocimiento' | 'prompts' | 'parametros' | 'conexion';

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
}

const NOMBRE_PROMPT: Record<string, { titulo: string; para: string }> = {
  perfil_agente: { titulo: 'Perfil del agente', para: 'Quién es, qué hace la empresa, cómo habla y qué no hace nunca.' },
  reglas_negocio: { titulo: 'Reglas de negocio', para: 'Cuándo usa cada herramienta. Es el que gobierna la decisión.' },
  resumen_conversacion: { titulo: 'Resumen de conversación', para: 'Cómo comprime la conversación en la memoria larga.' },
};

export default function AgenteFlowWorkspace({ flow }: { flow: { id: number; name: string } }) {
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

  if (cargando) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando el estudio…" /></div>;
  if (!estudio) return <PanelEmpty Icon={AlertTriangle} title="No se pudo cargar el estudio" desc="Vuelve a intentarlo en un momento." />;

  const rail = [
    { value: 'bandeja' as const, label: 'Bandeja', Icon: Inbox },
    { value: 'conocimiento' as const, label: 'Conocimiento', Icon: BookText, count: bloques.length,
      hint: estudio.pendientes.length ? `${estudio.pendientes.length} sin rellenar` : undefined },
    { value: 'prompts' as const, label: 'Prompts', Icon: ScrollText, count: prompts.filter((p) => p.caracteres > 0).length },
    { value: 'parametros' as const, label: 'Parámetros', Icon: SlidersHorizontal },
    { value: 'conexion' as const, label: 'Conexión y estado', Icon: Plug },
  ];

  return (
    <div className="flex gap-4 items-start">
      <div className="w-[240px] shrink-0">
        <FilterRail title="Estudio" items={rail} value={seccion} onChange={(v) => setSeccion(v as Seccion)} wrapLabels />
      </div>
      <div className="flex-1 min-w-0 space-y-4">
        <Avisos estudio={estudio} />
        {seccion === 'bandeja' && <AgenteBandeja flowId={flow.id} />}
        {seccion === 'conocimiento' && <Conocimiento flowId={flow.id} bloques={bloques} recargar={cargar} />}
        {seccion === 'prompts' && <Prompts flowId={flow.id} prompts={prompts} pendientes={estudio.pendientes} recargar={cargar} />}
        {seccion === 'parametros' && <Parametros flowId={flow.id} estudio={estudio} recargar={cargar} />}
        {seccion === 'conexion' && <Conexion estudio={estudio} />}
      </div>
    </div>
  );
}

/* ── Avisos que valen dinero o silencio ─────────────────────────────────────── */

function Avisos({ estudio }: { estudio: Estudio }) {
  const { canal, cache, cifradoListo } = estudio;
  const avisos: { tono: 'error' | 'aviso'; texto: string }[] = [];

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
    // Este es el aviso que evita pagar de más sin enterarse.
    avisos.push({
      tono: 'aviso',
      texto: `El prompt no llega al mínimo de caché de este modelo (~${cache.tokensEstimados} de ${cache.minimo} tokens), así que se paga entero en cada mensaje. Faltan unos ${cache.faltanCaracteres.toLocaleString('es-ES')} caracteres de conocimiento — o usa un modelo con mínimo más bajo.`,
    });
  }
  if (!canal.bot_activo) {
    avisos.push({ tono: 'aviso', texto: 'El agente está apagado: recibe y guarda los mensajes, pero no responde. Se enciende en Parámetros.' });
  }

  if (!avisos.length) return null;
  return (
    <div className="space-y-2">
      {avisos.map((a, i) => (
        <div key={i} className={`flex gap-2 items-start rounded-md border px-3 py-2 text-[12.5px] ${
          a.tono === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`} style={mf}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-[1px]" />
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
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
        <button onClick={() => setEditando({ titulo: '', clave: '', contenido: '', orden: bloques.length + 1 })} className={BTN_PRIMARY}>
          <Plus className="w-4 h-4" /> Nuevo bloque
        </button>
      </SectionBar>

      <p className="text-[12.5px] text-digi-muted mb-3 max-w-3xl leading-relaxed" style={mf}>
        Entran <strong>completos</strong> en cada consulta: el agente no busca, lo lee todo. Escríbelos
        de forma descriptiva («Si te preguntan por los horarios, responde: …»), no como una lista de
        preguntas y respuestas. Un bloque a medias se marca con <code>[PENDIENTE]</code> y el agente
        pasará esas preguntas a una persona.
      </p>

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

function Prompts({ flowId, prompts, pendientes, recargar }: {
  flowId: number; prompts: Prompt[]; pendientes: string[]; recargar: () => void;
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
      <SectionBar title="Prompts del agente" hint="Al guardar se conserva la versión anterior" />

      {pendientes.length > 0 && (
        <div className="rounded-md border border-digi-border bg-digi-bg px-3 py-2 text-[12.5px] text-digi-muted mb-3" style={mf}>
          <strong className="text-digi-text">No escribas aquí qué bloques faltan.</strong> Los que están
          sin rellenar hoy — <code>{pendientes.join('</code>, <code>')}</code> — se añaden solos a las
          reglas al hablar con el modelo. Si mañana los rellenas, la instrucción de escalar desaparece
          sola.
        </div>
      )}

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
      <SectionBar title="Parámetros de ejecución" hint="Los valores por defecto son los medidos en producción">
        <button className={BTN_PRIMARY} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </SectionBar>

      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        <Campo label="Modelo" hint={modeloElegido?.nota}>
          <PixelSelect
            value={form.modelo}
            onChange={(e: any) => setForm({ ...form, modelo: e.target.value })}
            options={estudio.modelos.map((m) => ({ value: m.id, label: m.nombre }))}
          />
          <p className="text-[11px] text-digi-muted mt-1" style={mf}>
            Mínimo de caché: {estudio.capacidades.minimoCache.toLocaleString('es-ES')} tokens.
            Por debajo de eso el prompt se paga entero en cada mensaje.
          </p>
        </Campo>

        <Campo label="Espera antes de responder" hint="Agrupa una ráfaga de mensajes en una sola respuesta.">
          <PixelInput type="number" value={String(form.debounce_segundos)}
            onChange={(e: any) => setForm({ ...form, debounce_segundos: Number(e.target.value) })} />
          <p className="text-[11px] text-digi-muted mt-1" style={mf}>Segundos, de 0 a 120. Recomendado: 8.</p>
        </Campo>

        <Campo label="Mensajes de contexto" hint="Cuántos mensajes anteriores ve el agente, además del resumen.">
          <PixelInput type="number" value={String(form.ventana_mensajes)}
            onChange={(e: any) => setForm({ ...form, ventana_mensajes: Number(e.target.value) })} />
          <p className="text-[11px] text-digi-muted mt-1" style={mf}>De 2 a 400. Recomendado: 40.</p>
        </Campo>

        <Campo label="Tokens máximos de respuesta">
          <PixelInput type="number" value={String(form.max_tokens)}
            onChange={(e: any) => setForm({ ...form, max_tokens: Number(e.target.value) })} />
          <p className="text-[11px] text-digi-muted mt-1" style={mf}>
            Acota razonamiento y respuesta juntos. Tope de este modelo: {estudio.capacidades.maxSalida.toLocaleString('es-ES')}.
          </p>
        </Campo>

        <Campo label="Clave de IA del cliente" hint="La pone el cliente y se guarda cifrada. No se puede volver a leer.">
          <PixelInput type="password" placeholder={c.tiene_ia_api_key ? '•••••••• (ya guardada)' : 'sk-ant-…'}
            value={clave} onChange={(e: any) => setClave(e.target.value)} />
          <p className="text-[11px] text-digi-muted mt-1 flex items-center gap-1" style={mf}>
            <KeyRound className="w-3 h-3" />
            {c.tiene_ia_api_key ? 'Hay una clave guardada. Escribe otra para reemplazarla.' : 'Sin clave, el agente no puede decidir.'}
          </p>
        </Campo>

        <Campo label="Agente encendido" hint="No se enciende solo: es una decisión consciente.">
          <label className="flex items-center gap-2 text-[13px] text-digi-text cursor-pointer" style={mf}>
            <input type="checkbox" checked={form.bot_activo}
              onChange={(e) => setForm({ ...form, bot_activo: e.target.checked })} />
            {form.bot_activo ? 'Responde automáticamente' : 'Apagado: guarda los mensajes pero no responde'}
          </label>
        </Campo>
      </div>
    </div>
  );
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-digi-text mb-1" style={mf}>{label}</label>
      {hint && <p className="text-[11.5px] text-digi-muted mb-1.5" style={mf}>{hint}</p>}
      {children}
    </div>
  );
}

/* ── Conexión ───────────────────────────────────────────────────────────────── */

const ESTADO_L: Record<string, { texto: string; variante: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  sin_conectar: { texto: 'Sin conectar', variante: 'default' },
  conectando: { texto: 'Conectando…', variante: 'info' },
  conectado: { texto: 'Conectado', variante: 'success' },
  error: { texto: 'Con error', variante: 'error' },
  desconectado: { texto: 'Desconectado', variante: 'warning' },
};

function Conexion({ estudio }: { estudio: Estudio }) {
  const c = estudio.canal;
  const estado = ESTADO_L[c.estado] ?? ESTADO_L.sin_conectar;

  return (
    <div>
      <SectionBar title="Conexión con WhatsApp" />
      {c.estado === 'sin_conectar' ? (
        <PanelEmpty Icon={Sparkles} title="Este agente aún no tiene número"
          desc="La pantalla de conexión del cliente llega en el siguiente paso. Mientras, ya puedes dejar listos el conocimiento y los prompts." />
      ) : null}

      <dl className="grid sm:grid-cols-2 gap-3 mt-3 max-w-3xl">
        <Dato titulo="Estado"><PixelBadge variant={estado.variante}>{estado.texto}</PixelBadge></Dato>
        <Dato titulo="Coexistencia verificada">
          {c.coexistencia_verificada
            ? <PixelBadge variant="success">Sí — el equipo conserva WhatsApp Web</PixelBadge>
            : <PixelBadge variant="default">Sin comprobar</PixelBadge>}
        </Dato>
        <Dato titulo="Número">{c.numero_visible ?? '—'}</Dato>
        <Dato titulo="Nombre verificado">{c.nombre_verificado ?? '—'}</Dato>
        <Dato titulo="Cuenta de WhatsApp (WABA)"><code className="text-[12px]">{c.waba_id ?? '—'}</code></Dato>
        <Dato titulo="Identificador del número"><code className="text-[12px]">{c.phone_number_id ?? '—'}</code></Dato>
        <Dato titulo="Token del cliente">
          {c.tiene_wa_token ? <PixelBadge variant="success">Guardado y cifrado</PixelBadge> : <PixelBadge variant="default">Sin token</PixelBadge>}
        </Dato>
        <Dato titulo="Clave de IA">
          {c.tiene_ia_api_key ? <PixelBadge variant="success">Guardada y cifrada</PixelBadge> : <PixelBadge variant="error">Falta</PixelBadge>}
        </Dato>
      </dl>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-digi-border bg-digi-card px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-digi-muted mb-1" style={mf}>{titulo}</dt>
      <dd className="text-[13px] text-digi-text" style={mf}>{children}</dd>
    </div>
  );
}
