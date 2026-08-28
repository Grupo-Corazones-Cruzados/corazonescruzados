'use client';

/**
 * PLANTILLAS del agente: verlas, crearlas, editarlas y enviarlas a una lista.
 *
 * ── QUÉ ES UNA PLANTILLA, Y POR QUÉ ESTA PANTALLA ES DISTINTA ─────────────────
 * Fuera de la ventana de 24 horas que abre cada mensaje entrante, WhatsApp **no deja**
 * escribir libremente: solo pasa una plantilla que Meta haya aprobado. O sea que esta es
 * la única forma de iniciar una conversación, y por eso hace falta.
 *
 * Lo que cambia respecto al resto de la app: **aquí no mandamos nosotros**. El estado de
 * una plantilla lo decide Meta y cambia solo —una aprobada puede caerse a `PAUSED` por
 * baja calidad—. Por eso hay un botón de actualizar y por eso la tabla enseña el estado
 * en grande: es el dato que decide si se puede enviar o no.
 *
 * ── LO QUE SE APRENDE DEL CORREO MASIVO ───────────────────────────────────────
 * La forma de enviar es la misma que ya conoce quien usa el flujo de correo: se elige una
 * lista de contactos y se manda. Se reutilizan sus tablas (`flow_contact_lists` y
 * `flow_contacts`) y sus rutas, así que las listas se crean y se editan donde siempre.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { SectionBar, LABEL, BTN_ROW, BTN_ROW_DANGER } from '@/components/dashboard/flows/FlowPanelUI';
import BotonAyuda from '@/components/ui/BotonAyuda';
import FilterRail from '@/components/ui/FilterRail';
import {
  ColumnaListas, TablaContactos, DialogoNuevaLista, DialogoRenombrarLista,
  DialogoCompartirLista, type Lista,
} from '@/components/dashboard/flows/PanelListasContactos';
import {
  RefreshCw, Plus, Send, Pencil, Trash2, AlertTriangle, Eye, FileText, CheckCircle2,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Columna { clave: string; etiqueta: string }
interface Plantilla {
  id: number; meta_id: string | null; nombre: string; idioma: string; categoria: string;
  estado: string; motivo_rechazo: string | null; cuerpo: string; pie: string | null;
  variables: string[]; envios: number; sincronizado_en: string | null;
  /** Las listas marcadas para esta plantilla, y a cuánta gente con teléfono llegan. */
  listas: number[]; destinatarios: number;
}

/**
 * Cómo se pinta cada estado de Meta.
 *
 * `APPROVED` es el único que permite enviar; el resto son grados de «todavía no». Se
 * traducen porque `PAUSED` o `REJECTED` en medio de una pantalla en español no dicen nada
 * a quien no vive en la documentación de Meta.
 */
const ESTADOS: Record<string, { texto: string; variante: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  APPROVED: { texto: 'Aprobada', variante: 'success' },
  PENDING:  { texto: 'En revisión', variante: 'info' },
  REJECTED: { texto: 'Rechazada', variante: 'error' },
  PAUSED:   { texto: 'Pausada por calidad', variante: 'warning' },
  DISABLED: { texto: 'Deshabilitada', variante: 'error' },
  ausente:  { texto: 'Ya no está en Meta', variante: 'warning' },
  local:    { texto: 'Sin enviar a Meta', variante: 'default' },
};
const pinta = (e: string) => ESTADOS[e] ?? { texto: e, variante: 'default' as const };

export default function AgentePlantillas({ flowId, acciones }: { flowId: number; acciones?: React.ReactNode }) {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [conectado, setConectado] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const [editando, setEditando] = useState<Plantilla | 'nueva' | null>(null);
  const [enviando, setEnviando] = useState<Plantilla | null>(null);
  const [borrando, setBorrando] = useState<Plantilla | null>(null);

  /** La plantilla elegida en la columna izquierda, y la lista elegida en la de al lado. */
  const [sel, setSel] = useState<number | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [listaId, setListaId] = useState<number | null>(null);
  const [nuevaLista, setNuevaLista] = useState(false);
  const [renombrando, setRenombrando] = useState<Lista | null>(null);
  const [compartiendo, setCompartiendo] = useState<Lista | null>(null);
  const [borrandoLista, setBorrandoLista] = useState<Lista | null>(null);

  const plantilla = plantillas.find((p) => p.id === sel) ?? null;

  const cargarListas = useCallback(async () => {
    try {
      const d = await fetch(`/api/admin/flows/${flowId}/contact-lists`).then((r) => r.json());
      setListas(d.data ?? []);
    } catch { /* sin listas se puede seguir viendo y creando plantillas */ }
  }, [flowId]);

  useEffect(() => { cargarListas(); }, [cargarListas]);

  /** La casilla de una lista: la asocia o la desasocia de la plantilla seleccionada. */
  const marcarLista = async (l: Lista, marcar: boolean) => {
    if (!plantilla) return;
    const r = await fetch(`/api/admin/flows/${flowId}/agente/plantillas/${plantilla.id}/listas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lista_id: l.id, asociar: marcar }),
    });
    if (!r.ok) { toast.error('No se pudo cambiar'); return; }
    cargar();
  };

  const borrarLista = async () => {
    if (!borrandoLista) return;
    const r = await fetch(`/api/admin/flows/${flowId}/contact-lists/${borrandoLista.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('No se pudo borrar la lista'); return; }
    if (listaId === borrandoLista.id) setListaId(null);
    setBorrandoLista(null); cargarListas();
  };

  const cargar = useCallback(async (sincronizar = false) => {
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/agente/plantillas${sincronizar ? '?sincronizar=1' : ''}`);
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'No se pudieron cargar las plantillas'); return; }
      setPlantillas(d.data ?? []);
      setColumnas(d.columnas ?? []);
      setConectado(!!d.conectado);
      // Un fallo al consultar a Meta no vacía la pantalla: se enseña lo guardado y se dice
      // por qué está viejo.
      if (d.aviso) toast.warning(`No se pudo consultar a Meta: ${d.aviso}. Se muestra lo último guardado.`);
      else if (sincronizar) toast.success('Estados actualizados desde Meta');
    } finally { setCargando(false); }
  }, [flowId]);

  useEffect(() => { cargar(); }, [cargar]);

  const sincronizar = async () => { setOcupado(true); try { await cargar(true); } finally { setOcupado(false); } };

  const borrar = async () => {
    if (!borrando) return;
    setOcupado(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/agente/plantillas/${borrando.id}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error ?? 'No se pudo borrar'); return; }
      toast.success('Plantilla borrada, también en Meta');
      setBorrando(null); await cargar();
    } finally { setOcupado(false); }
  };

  if (cargando) return <div className="flex justify-center py-20"><BrandLoader label="Cargando las plantillas…" /></div>;

  const lista = listas.find((l) => l.id === listaId) ?? null;

  return (
    <div>
      {/* Sin título ni recuento: «Plantillas» ya lo dice la pestaña encendida, y
          «0 plantilla(s) · 0 aprobada(s)» lo dice la propia lista de al lado. Una fila
          de adorno menos.

          ⇒ EL TRABAJO A LA IZQUIERDA, LA NAVEGACIÓN A LA DERECHA. Crear una plantilla es
          lo que se viene a hacer aquí, así que abre la fila, pegado al borde: es donde
          empieza a leer la vista y donde cae la mano. Después «Actualizar» —que se pulsa
          antes de un envío importante— y su ayuda. Las pestañas se van al extremo opuesto,
          porque cambiar de pestaña se hace una vez y no compite con lo demás. */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button className={BTN_SECONDARY} onClick={() => setEditando('nueva')} disabled={!conectado}>
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
        <button className={BTN_SECONDARY} onClick={sincronizar} disabled={ocupado || !conectado}>
          <RefreshCw className={`w-4 h-4 ${ocupado ? 'animate-spin' : ''}`} /> Actualizar
        </button>
        <BotonAyuda titulo="Para qué sirven las plantillas" lado="derecha">
          <p className="mb-2">Fuera de las <strong>24 horas</strong> siguientes al último mensaje de una persona, WhatsApp no deja escribirle libremente. Solo pasa una plantilla <strong>aprobada por Meta</strong>.</p>
          <p className="mb-2">Por eso son la única forma de <strong>iniciar</strong> una conversación: un aviso, un recordatorio, una confirmación.</p>
          <p>El estado lo decide Meta y puede cambiar solo. Pulsa «Actualizar» antes de un envío importante.</p>
        </BotonAyuda>

        <span className="flex-1" />

        {/* El envío va aquí arriba y no junto a la lista: es la acción principal de la
            pantalla y depende de la plantilla seleccionada, no de la lista abierta. El
            propio botón dice a cuánta gente va, que es el dato que hace dudar o seguir.
            Queda junto a las pestañas —y no con los otros tres— para que no se pulse por
            estar al lado de «Actualizar»: manda un mensaje a mucha gente de golpe. */}
        {plantilla && (
          <button
            className={BTN_PRIMARY} onClick={() => setEnviando(plantilla)}
            disabled={plantilla.estado !== 'APPROVED' || !plantilla.destinatarios}
            title={
              plantilla.estado !== 'APPROVED' ? 'Solo se puede enviar una plantilla aprobada por Meta'
              : !plantilla.destinatarios ? 'Marca con la casilla al menos una lista con contactos que tengan teléfono'
              : `Enviar «${plantilla.nombre}»`
            }
          >
            <Send className="w-4 h-4" />
            Enviar{plantilla.destinatarios ? ` a ${plantilla.destinatarios}` : ''}
          </button>
        )}
        {acciones}
      </div>

      {!conectado && (
        <div className={`rounded-lg border ${TONO.aviso.caja} p-4 mb-3 flex gap-2 items-start`}>
          <AlertTriangle className={`w-5 h-5 ${TONO.aviso.icono} shrink-0 mt-0.5`} />
          <p className={`text-[12.5px] ${TONO.aviso.texto} leading-relaxed`} style={mf}>
            Este agente todavía no tiene un número conectado. Las plantillas viven en la cuenta de
            WhatsApp del cliente, así que hasta conectarla no hay dónde crearlas.
          </p>
        </div>
      )}

      {/* ── Tres columnas, como en el correo masivo: qué se manda · a quién · el detalle ── */}
      <div className="flex flex-col lg:flex-row gap-3 items-start">

        {/* 1. Las plantillas.
             ⚠️ Va con `FilterRail`, el MISMO control que el rail de campañas del correo
             masivo, y no con un marcado propio. El primer intento se escribió a mano y
             quedó parecido pero distinto —los botones siempre visibles, con borde, en otro
             color— y se notó en cuanto Fernando puso las dos pantallas juntas. Un rail
             nuevo se hace con este componente, no copiando su aspecto. */}
        <FilterRail
          className="lg:w-[240px]"
          title={`Plantillas (${plantillas.length})`}
          value={String(sel ?? '')}
          onChange={(v) => setSel(Number(v) || null)}
          items={plantillas.map((p) => ({
            value: String(p.id),
            label: p.nombre,
            Icon: ESTADOS[p.estado]?.variante === 'success' ? CheckCircle2 : FileText,
            hint: [
              pinta(p.estado).texto,
              p.listas?.length ? `${p.listas.length} lista(s)` : null,
            ].filter(Boolean).join(' · '),
            actions: (
              <>
                <button onClick={() => setEditando(p)} title="Editar la plantilla"
                  className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setBorrando(p)} title="Eliminar la plantilla"
                  className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            ),
          }))}
          wrapLabels
        />

        {/* 2. Las listas de contactos */}
        <ColumnaListas
          listas={listas} seleccionada={listaId} marcadas={plantilla ? plantilla.listas : null}
          alSeleccionar={setListaId} alMarcar={marcarLista}
          alCrear={() => setNuevaLista(true)} alRenombrar={setRenombrando}
          alCompartir={setCompartiendo} alBorrar={setBorrandoLista}
        />

        {/* 3. Solo los contactos de la lista abierta. El contenido de la plantilla se ve
               al editarla, como la campaña en el correo masivo — no ocupando esta zona. */}
        <div className="flex-1 min-w-0 w-full">
          <TablaContactos flowId={flowId} lista={lista} alCambiar={() => { cargarListas(); cargar(); }} />
        </div>
      </div>

      {editando && (
        <PanelPlantilla
          flowId={flowId} columnas={columnas}
          plantilla={editando === 'nueva' ? null : editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => { setEditando(null); cargar(); }}
        />
      )}

      {enviando && (
        <PanelEnvio
          flowId={flowId} plantilla={enviando} listas={listas}
          alCerrar={() => setEnviando(null)}
          alEnviado={() => { setEnviando(null); cargar(); }}
        />
      )}

      <DialogoNuevaLista
        flowId={flowId} abierto={nuevaLista}
        alCerrar={() => setNuevaLista(false)}
        alCreada={() => { setNuevaLista(false); cargarListas(); }}
      />

      <DialogoRenombrarLista
        flowId={flowId} lista={renombrando}
        alCerrar={() => setRenombrando(null)}
        alGuardado={() => { setRenombrando(null); cargarListas(); }}
      />

      <DialogoCompartirLista
        flowId={flowId} lista={compartiendo}
        alCerrar={() => setCompartiendo(null)}
        alCambiado={cargarListas}
      />

      <PixelConfirm
        open={!!borrando}
        title="Borrar plantilla"
        message={`¿Borrar «${borrando?.nombre}»? Se borra también de la cuenta de WhatsApp en Meta y no se puede deshacer.`}
        confirmLabel="Sí, borrar"
        onConfirm={borrar}
        onCancel={() => setBorrando(null)}
      />

      <PixelConfirm
        open={!!borrandoLista}
        title="Borrar lista"
        message={`¿Borrar la lista «${borrandoLista?.name}» y todos sus contactos? No se puede deshacer.`}
        confirmLabel="Sí, borrar"
        onConfirm={borrarLista}
        onCancel={() => setBorrandoLista(null)}
      />
    </div>
  );
}

/* ── Crear o editar, con previsualización ───────────────────────────────────── */

/** Valores de muestra para la previsualización. No viajan a Meta salvo como `example`. */
const MUESTRA: Record<string, string> = {
  name: 'María Pérez', position: 'Gerente de Operaciones',
  email: 'maria@ejemplo.com', phone: '+593 99 123 4567',
};

function PanelPlantilla({ flowId, plantilla, columnas, alCerrar, alGuardar }: {
  flowId: number; plantilla: Plantilla | null; columnas: Columna[];
  alCerrar: () => void; alGuardar: () => void;
}) {
  const nueva = !plantilla;
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '');
  const [idioma, setIdioma] = useState(plantilla?.idioma ?? 'es');
  const [categoria, setCategoria] = useState(plantilla?.categoria ?? 'UTILITY');
  const [cuerpo, setCuerpo] = useState(plantilla?.cuerpo ?? '');
  const [pie, setPie] = useState(plantilla?.pie ?? '');
  const [variables, setVariables] = useState<string[]>(plantilla?.variables ?? []);
  const [guardando, setGuardando] = useState(false);

  /** El mayor {{n}} del cuerpo: cuántas variables hay que asignar. */
  const cuantas = useMemo(() => {
    let max = 0;
    for (const m of cuerpo.matchAll(/\{\{(\d+)\}\}/g)) max = Math.max(max, Number(m[1]));
    return max;
  }, [cuerpo]);

  // Si el cuerpo gana o pierde variables, la lista de asignaciones se ajusta sola: dejarla
  // desincronizada sería guardar un mapeo que no corresponde a nada.
  useEffect(() => {
    setVariables((v) => {
      const siguiente = v.slice(0, cuantas);
      while (siguiente.length < cuantas) siguiente.push('name');
      return siguiente;
    });
  }, [cuantas]);

  const insertarVariable = () => setCuerpo((c) => `${c}{{${cuantas + 1}}}`);

  const valoresMuestra = variables.map((v) => MUESTRA[v] ?? 'Ejemplo');
  const vistaPrevia = cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => valoresMuestra[Number(n) - 1] ?? `{{${n}}}`);

  const guardar = async () => {
    setGuardando(true);
    try {
      const url = nueva
        ? `/api/admin/flows/${flowId}/agente/plantillas`
        : `/api/admin/flows/${flowId}/agente/plantillas/${plantilla!.id}`;
      const r = await fetch(url, {
        method: nueva ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(), idioma, categoria,
          cuerpo: cuerpo.trim(), pie: pie.trim() || null,
          variables, ejemplos: valoresMuestra,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'No se pudo guardar'); return; }
      toast.success(nueva
        ? 'Plantilla enviada a Meta. Queda en revisión hasta que la aprueben.'
        : 'Cambios enviados a Meta. Vuelve a revisión hasta que la aprueben.');
      alGuardar();
    } finally { setGuardando(false); }
  };

  const listo = !!cuerpo.trim() && (!nueva || /^[a-z0-9_]+$/.test(nombre.trim()));

  return (
    <EditPanel
      open title={nueva ? 'Nueva plantilla' : `Editar «${plantilla!.nombre}»`}
      onClose={alCerrar} onSave={guardar} saving={guardando} canSave={listo}
      saveLabel={nueva ? 'Crear y enviar a Meta' : 'Guardar y reenviar a revisión'}
    >
      <div className="space-y-4">
        {!nueva && (
          <div className={`rounded-md border ${TONO.aviso.caja} px-3 py-2.5`}>
            <p className={`text-[12px] ${TONO.aviso.texto} leading-relaxed`} style={mf}>
              Editar una plantilla la devuelve a revisión: <strong>deja de poder enviarse</strong> hasta
              que Meta la vuelva a aprobar. El nombre y el idioma no se pueden cambiar — eso sería otra plantilla.
            </p>
          </div>
        )}

        {nueva && (
          <EditField
            label="Nombre"
            hint="Solo minúsculas, números y guion bajo. Es el identificador en Meta y no se puede cambiar después."
          >
            <input
              className={EDIT_INPUT} value={nombre} placeholder="confirmacion_atencion"
              onChange={(e) => setNombre(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            />
          </EditField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <EditField label="Idioma">
            <select className={EDIT_INPUT} value={idioma} disabled={!nueva}
              onChange={(e) => setIdioma(e.target.value)}>
              <option value="es">Español</option>
              <option value="es_MX">Español (México)</option>
              <option value="en_US">Inglés (EE. UU.)</option>
            </select>
          </EditField>
          <EditField
            label="Categoría"
            hint={categoria === 'MARKETING'
              ? 'Marketing tarda más en aprobarse y exige consentimiento explícito.'
              : 'Utilidad: confirmaciones, avisos y recordatorios. Se aprueba más rápido.'}
          >
            <select className={EDIT_INPUT} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="UTILITY">Utilidad</option>
              <option value="MARKETING">Marketing</option>
            </select>
          </EditField>
        </div>

        <EditField
          label="Mensaje"
          hint={<>Usa <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… donde vaya un dato del contacto.</>}
        >
          <textarea
            className={`${EDIT_INPUT} min-h-[110px] resize-y`} value={cuerpo}
            placeholder="Hola {{1}}, gracias por escribirnos. Le responderemos a la brevedad."
            onChange={(e) => setCuerpo(e.target.value)}
          />
          <button type="button" onClick={insertarVariable}
            className="mt-1.5 text-[12px] text-accent hover:underline" style={mf}>
            + Añadir variable {`{{${cuantas + 1}}}`}
          </button>
        </EditField>

        {cuantas > 0 && (
          <div>
            <label className={LABEL}>De dónde sale cada variable</label>
            <div className="space-y-2">
              {Array.from({ length: cuantas }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="text-[12px] text-accent bg-accent-light px-1.5 py-0.5 rounded border border-accent/20 shrink-0">
                    {`{{${i + 1}}}`}
                  </code>
                  <select
                    className={`${EDIT_INPUT} flex-1`} value={variables[i] ?? 'name'}
                    onChange={(e) => setVariables((v) => { const n = [...v]; n[i] = e.target.value; return n; })}
                  >
                    {columnas.map((c) => <option key={c.clave} value={c.clave}>{c.etiqueta}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11.5px] text-digi-muted" style={mf}>
              Los datos salen de la lista de contactos que elijas al enviar.
            </p>
          </div>
        )}

        <EditField label="Pie (opcional)" hint="Una línea corta al final, en gris. Máximo 60 caracteres.">
          <input className={EDIT_INPUT} value={pie} maxLength={60}
            onChange={(e) => setPie(e.target.value)} placeholder="Grupo Corazones Cruzados" />
        </EditField>

        {/* ── PREVISUALIZACIÓN ──────────────────────────────────────────────────
            Con datos de muestra, no con `{{1}}`. Ver los huecos rellenos es lo único
            que descubre a tiempo un «Hola {{1}}, ¿cómo está {{1}}?» o una frase que en
            plantilla parecía correcta y con datos reales queda rara. */}
        <div>
          <label className={LABEL}>Así lo recibirá el contacto</label>
          <div className="rounded-lg bg-digi-darker border border-digi-border p-3">
            <div className="max-w-[85%] rounded-lg bg-accent-light border border-accent/20 px-3 py-2">
              <p className="text-[13px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>
                {vistaPrevia || <span className="text-digi-muted">Escribe el mensaje para verlo aquí…</span>}
              </p>
              {pie && <p className="text-[11px] text-digi-muted mt-1.5" style={mf}>{pie}</p>}
            </div>
            {cuantas > 0 && (
              <p className="text-[11px] text-digi-muted mt-2 flex items-center gap-1" style={mf}>
                <Eye className="w-3 h-3" /> Con datos de ejemplo. Cada contacto verá los suyos.
              </p>
            )}
          </div>
        </div>
      </div>
    </EditPanel>
  );
}

/* ── Enviar a una lista ─────────────────────────────────────────────────────── */

function PanelEnvio({ flowId, plantilla, listas, alCerrar, alEnviado }: {
  flowId: number; plantilla: Plantilla; listas: Lista[];
  alCerrar: () => void; alEnviado: () => void;
}) {
  const [contactos, setContactos] = useState<any[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const marcadas = listas.filter((l) => plantilla.listas?.includes(l.id));

  /**
   * Los contactos de TODAS las listas marcadas, para poder enseñar a cuántos se va a
   * escribir y con qué datos. Un envío masivo a ciegas es la clase de acción que nadie
   * debería confirmar.
   *
   * Se quitan los repetidos por teléfono: una persona que esté en dos listas marcadas
   * recibiría el mismo mensaje dos veces, y eso al otro lado se lee como spam.
   */
  useEffect(() => {
    let vivo = true;
    Promise.all(marcadas.map((l) =>
      fetch(`/api/admin/flows/${flowId}/contact-lists/${l.id}/contacts`)
        .then((r) => r.json()).then((d) => d.data ?? []).catch(() => []),
    )).then((todas) => {
      if (!vivo) return;
      const vistos = new Set<string>();
      const unicos: any[] = [];
      for (const c of todas.flat()) {
        const tel = String(c.phone ?? '').replace(/[^\d]/g, '');
        if (!tel || vistos.has(tel)) continue;
        vistos.add(tel); unicos.push(c);
      }
      setContactos(unicos);
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, plantilla.id]);

  const enviar = async () => {
    setConfirmar(false);
    setEnviando(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/agente/plantillas/${plantilla.id}/enviar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'No se pudo enviar'); return; }
      toast.success(d.mensaje);
      alEnviado();
    } finally { setEnviando(false); }
  };

  const rellena = (c: any) =>
    plantilla.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const col = plantilla.variables[Number(n) - 1];
      return String(c?.[col] ?? '').trim() || '—';
    });

  return (
    <>
      <EditPanel
        open title={`Enviar «${plantilla.nombre}»`}
        onClose={alCerrar} onSave={() => setConfirmar(true)}
        saving={enviando} canSave={contactos.length > 0}
        saveLabel={contactos.length ? `Enviar a ${contactos.length} contacto(s)` : 'Enviar'}
      >
        <div className="space-y-4">
          <div>
            <label className={LABEL}>Listas marcadas</label>
            {marcadas.length === 0 ? (
              <p className="text-[12.5px] text-digi-muted leading-relaxed" style={mf}>
                Esta plantilla no tiene ninguna lista marcada. Marca al menos una con su casilla, en
                la columna de listas de contactos.
              </p>
            ) : (
              <ul className="text-[12.5px] text-digi-text space-y-0.5" style={mf}>
                {marcadas.map((l) => (
                  <li key={l.id}>· {l.name} <span className="text-digi-muted">({l.contact_count ?? 0} contacto(s))</span></li>
                ))}
              </ul>
            )}
          </div>

          {contactos.length > 0 && (
            <div>
              <label className={LABEL}>Así lo va a recibir cada uno</label>
              <div className="space-y-2">
                {contactos.slice(0, 3).map((c) => (
                  <div key={c.id} className="rounded-lg bg-digi-darker border border-digi-border p-2.5">
                    <p className="text-[11px] text-digi-muted mb-1" style={mf}>
                      {c.name || 'Sin nombre'} · {c.phone}
                    </p>
                    <p className="text-[12.5px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>
                      {rellena(c)}
                    </p>
                  </div>
                ))}
              </div>
              {contactos.length > 3 && (
                <p className="mt-1.5 text-[11.5px] text-digi-muted" style={mf}>
                  …y {contactos.length - 3} más.
                </p>
              )}
            </div>
          )}

          <p className="text-[11.5px] text-digi-muted leading-relaxed flex items-start gap-1.5" style={mf}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            Se saltan los contactos sin teléfono y los repetidos entre listas. Los mensajes salen de
            uno en uno para no agotar el límite del número; al terminar los verás en la bandeja
            etiquetados «plantilla», cada uno en su conversación.
          </p>
        </div>
      </EditPanel>

      <PixelConfirm
        open={confirmar}
        title="Confirmar el envío"
        message={`Se van a enviar ${contactos.length} mensajes de WhatsApp reales, ahora mismo. No se pueden retirar una vez enviados. ¿Continuamos?`}
        confirmLabel="Sí, enviar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      />
    </>
  );
}
