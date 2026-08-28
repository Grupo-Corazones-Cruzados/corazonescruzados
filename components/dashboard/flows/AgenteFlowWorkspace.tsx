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
import { AccionesDelPanel } from '@/components/dashboard/flows/estudio/RanuraAcciones';
import type { Aviso } from '@/components/ui/BotonAvisos';
import BotonAyuda from '@/components/ui/BotonAyuda';
import AgenteEstudio from '@/components/dashboard/flows/estudio/AgenteEstudio';
import AgentePlantillas from '@/components/dashboard/flows/AgentePlantillas';
import {
  BookText, Inbox, Pencil, Trash2, Plus, AlertTriangle, Workflow, FileText,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Solo dos vistas. Antes había un rail de cuatro secciones a la izquierda; se quitó
 * (decisión de Fernando, 2026-08-02) porque tres de las cuatro ya se alcanzan desde el
 * Estudio —conocimiento, prompts, parámetros y conexión son recursos del propio grafo— y
 * el rail se había convertido en un índice de cosas que ya estaban dentro.
 */
type Vista = 'bandeja' | 'plantillas' | 'estudio';

interface Estudio {
  canal: any;
  capacidades: { minimoCache: number; maxSalida: number; muestreo: boolean };
  cache: { cachea: boolean; tokensEstimados: number; minimo: number; faltanCaracteres: number };
  pendientes: string[];
  razonamientos: readonly { id: string; nombre: string; nota: string }[];
  cifradoListo: boolean;
  appId: string | null;
  configId: string | null;
}

interface Bloque {
  id: number; clave: string; titulo: string; contenido: string;
  orden: number; activo: boolean; caracteres: number; pendiente: boolean;
}
export default function AgenteFlowWorkspace({ flow, onAvisos }: {
  flow: { id: number; name: string };
  /** Los avisos suben a la cabecera de la página: allí viven junto a «Activar». */
  onAvisos?: (avisos: Aviso[]) => void;
}) {
  // La Bandeja es lo que se ve al abrir: es donde se trabaja a diario.
  const [vista, setVista] = useState<Vista>('bandeja');
  const [estudio, setEstudio] = useState<Estudio | null>(null);
  const [bloques, setBloques] = useState<Bloque[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      // Los prompts ya NO se piden aquí: los carga el Estudio, que es quien los muestra.
      const [e, c] = await Promise.all([
        fetch(`/api/admin/flows/${flow.id}/agente`).then((r) => r.json()),
        fetch(`/api/admin/flows/${flow.id}/agente/conocimiento`).then((r) => r.json()),
      ]);
      if (e.data) setEstudio(e.data);
      setBloques(c.data ?? []);
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

  // El conmutador va a la altura del título de cada vista, no en una barra propia: una
  // franja más solo para dos botones es alto que se le quita al contenido.
  const conmutador = (
    <div className="inline-flex items-center rounded-md border border-digi-border overflow-hidden shrink-0">
      {([
        { v: 'bandeja' as const, label: 'Bandeja', Icon: Inbox },
        // Las plantillas van EN MEDIO a propósito: es lo que se usa para empezar una
        // conversación, y queda entre lo que pasa a diario (la bandeja) y cómo está
        // montado el agente (el estudio), que se toca mucho menos.
        { v: 'plantillas' as const, label: 'Plantillas', Icon: FileText },
        { v: 'estudio' as const, label: 'Estudio del agente', Icon: Workflow },
      ]).map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => setVista(v)}
          aria-pressed={vista === v}
          className={`inline-flex items-center gap-1.5 px-3 h-[30px] text-[12.5px] font-medium transition-colors
            ${vista === v ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-accent hover:bg-black/[0.03]'}`}
          style={mf}
        >
          <Icon className="w-3.5 h-3.5" />{label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {vista === 'bandeja' && <AgenteBandeja flowId={flow.id} acciones={conmutador} />}
      {vista === 'plantillas' && <AgentePlantillas flowId={flow.id} acciones={conmutador} />}
      {vista === 'estudio' && (
        <AgenteEstudio
          flowId={flow.id}
          recargar={cargar}
          acciones={conmutador}
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
      texto: `El prompt no llega al mínimo de caché del modelo (~${cache.tokensEstimados} de ${cache.minimo} tokens), así que se paga entero en cada mensaje. Faltan unos ${cache.faltanCaracteres.toLocaleString('es-ES')} caracteres de conocimiento.`,
    });
  }
  if (!canal.bot_activo) {
    // Los dos sitios encienden lo MISMO desde el 2026-08-28: el flujo «Activo» del panel
    // de Automatizaciones y esta casilla van atados. Se nombran los dos para que nadie
    // vuelva a buscar el interruptor «de verdad».
    avisos.push({ tono: 'aviso', texto: 'El agente está apagado: recibe y guarda los mensajes, pero no responde. Se enciende en Parámetros, o activando el flujo desde Automatizaciones — son el mismo interruptor.' });
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


function Parametros({ flowId, estudio, recargar }: { flowId: number; estudio: Estudio; recargar: () => void }) {
  const c = estudio.canal;
  const [form, setForm] = useState({
    razonamiento: c.razonamiento, max_tokens: c.max_tokens, debounce_segundos: c.debounce_segundos,
    ventana_mensajes: c.ventana_mensajes,
  });
  // ⚠️ `bot_activo` NO está aquí, y es a propósito. Encender el agente es el botón
  // «Activar»/«Pausar» de la cabecera de la página, atado al estado del flujo (ver
  // `sincronizarAgente` en `app/api/admin/flows/[id]/route.ts`). Tenerlo también como
  // casilla dentro de un formulario que se guarda con otro botón era el tercer sitio
  // desde el que se encendía lo mismo — y el que hacía que la pantalla y la realidad
  // dijeran cosas distintas.
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

  const nivelElegido = estudio.razonamientos.find((m) => m.id === form.razonamiento);

  return (
    <div>
      {/* Sin título propio: el panel del Estudio ya se llama «Parámetros del canal». Y
          «Guardar cambios» sube a esa cabecera —donde está el nombre, están sus acciones—,
          que además lo deja SIEMPRE a la vista: antes se quedaba arriba del todo y al
          bajar a editar la clave de IA había que subir a ciegas para guardar. */}
      <AccionesDelPanel>
        <button className={BTN_PRIMARY} onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </AccionesDelPanel>

      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        <Campo
          label="Razonamiento"
          ayuda={<>
            {nivelElegido?.nota && <p className="mb-2">{nivelElegido.nota}</p>}
            <p className="mb-2">
              Cuanto más razona, mejor decide y más cuesta — el razonamiento se paga como
              tokens de salida y sale del mismo tope de <em>Respuesta máxima</em>.
            </p>
            <p>
              <strong>Mínimo de caché: {estudio.capacidades.minimoCache.toLocaleString('es-ES')} tokens.</strong>{' '}
              Por debajo de eso el prompt se paga entero en cada mensaje.
            </p>
          </>}
        >
          <PixelSelect
            value={form.razonamiento}
            onChange={(e: any) => setForm({ ...form, razonamiento: e.target.value })}
            options={estudio.razonamientos.map((m) => ({ value: m.id, label: m.nombre }))}
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
          <PixelInput type="password" placeholder={c.tiene_ia_api_key ? '•••••••• (ya guardada)' : 'sk-…'}
            value={clave} onChange={(e: any) => setClave(e.target.value)} />
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

