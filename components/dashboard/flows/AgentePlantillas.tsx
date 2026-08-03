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
import PixelBadge from '@/components/ui/PixelBadge';
import PixelInput from '@/components/ui/PixelInput';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { SectionBar, PanelEmpty, LABEL } from '@/components/dashboard/flows/FlowPanelUI';
import BotonAyuda from '@/components/ui/BotonAyuda';
import {
  FileText, RefreshCw, Plus, Send, Pencil, Trash2, AlertTriangle, Eye,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Columna { clave: string; etiqueta: string }
interface Plantilla {
  id: number; meta_id: string | null; nombre: string; idioma: string; categoria: string;
  estado: string; motivo_rechazo: string | null; cuerpo: string; pie: string | null;
  variables: string[]; envios: number; sincronizado_en: string | null;
}
interface Lista { id: number; name: string; contact_count?: number }

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

  return (
    <div>
      <SectionBar
        title="Plantillas"
        hint={`${plantillas.length} plantilla(s) · ${plantillas.filter((p) => p.estado === 'APPROVED').length} aprobada(s)`}
      >
        {acciones}
      </SectionBar>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <button className={BTN_SECONDARY} onClick={sincronizar} disabled={ocupado || !conectado}>
          <RefreshCw className={`w-4 h-4 ${ocupado ? 'animate-spin' : ''}`} /> Actualizar desde Meta
        </button>
        <button className={BTN_PRIMARY} onClick={() => setEditando('nueva')} disabled={!conectado}>
          <Plus className="w-4 h-4" /> Nueva plantilla
        </button>
        <BotonAyuda titulo="Para qué sirven las plantillas" lado="derecha">
          <p className="mb-2">Fuera de las <strong>24 horas</strong> siguientes al último mensaje de una persona, WhatsApp no deja escribirle libremente. Solo pasa una plantilla <strong>aprobada por Meta</strong>.</p>
          <p className="mb-2">Por eso son la única forma de <strong>iniciar</strong> una conversación: un aviso, un recordatorio, una confirmación.</p>
          <p>El estado lo decide Meta y puede cambiar solo. Pulsa «Actualizar desde Meta» antes de un envío importante.</p>
        </BotonAyuda>
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

      {plantillas.length === 0 ? (
        <PanelEmpty
          Icon={FileText}
          title="Todavía no hay plantillas"
          desc="Crea una, o pulsa «Actualizar desde Meta» si ya existen en la cuenta de WhatsApp del cliente."
        />
      ) : (
        <div className="rounded-lg border border-digi-border bg-digi-card overflow-hidden">
          {plantillas.map((p) => (
            <Fila
              key={p.id} p={p} columnas={columnas}
              alEditar={() => setEditando(p)}
              alEnviar={() => setEnviando(p)}
              alBorrar={() => setBorrando(p)}
            />
          ))}
        </div>
      )}

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
          flowId={flowId} plantilla={enviando} columnas={columnas}
          alCerrar={() => setEnviando(null)}
          alEnviado={() => { setEnviando(null); cargar(); }}
        />
      )}

      <PixelConfirm
        open={!!borrando}
        title="Borrar plantilla"
        message={`¿Borrar «${borrando?.nombre}»? Se borra también de la cuenta de WhatsApp en Meta y no se puede deshacer.`}
        confirmLabel="Sí, borrar"
        onConfirm={borrar}
        onCancel={() => setBorrando(null)}
      />
    </div>
  );
}

/* ── Una fila de la tabla ───────────────────────────────────────────────────── */

function Fila({ p, columnas, alEditar, alEnviar, alBorrar }: {
  p: Plantilla; columnas: Columna[];
  alEditar: () => void; alEnviar: () => void; alBorrar: () => void;
}) {
  const est = pinta(p.estado);
  const aprobada = p.estado === 'APPROVED';

  return (
    <div className="px-4 py-3 border-b border-digi-border last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-digi-text" style={mf}>{p.nombre}</span>
            <PixelBadge variant={est.variante}>{est.texto}</PixelBadge>
            <span className="text-[11.5px] text-digi-muted" style={mf}>
              {p.idioma} · {p.categoria}
              {p.envios > 0 && ` · ${p.envios} envío(s)`}
            </span>
          </div>

          <p className="text-[12.5px] text-digi-text mt-1 leading-relaxed whitespace-pre-wrap" style={mf}>
            {p.cuerpo}
          </p>

          {p.variables?.length > 0 && (
            <p className="text-[11.5px] text-digi-muted mt-1" style={mf}>
              {p.variables.map((v, i) => (
                <span key={i} className="mr-2">
                  {`{{${i + 1}}}`} → {columnas.find((c) => c.clave === v)?.etiqueta ?? v}
                </span>
              ))}
            </p>
          )}

          {/* El motivo del rechazo es lo único que dice qué corregir. Sin él, «Rechazada»
              es un callejón sin salida. */}
          {p.motivo_rechazo && (
            <p className={`text-[12px] ${TONO.error.texto} mt-1.5`} style={mf}>
              Meta la rechazó: {p.motivo_rechazo}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            className={BTN_PRIMARY} onClick={alEnviar} disabled={!aprobada}
            title={aprobada ? 'Enviar a una lista de contactos' : 'Solo se puede enviar una plantilla aprobada por Meta'}
          >
            <Send className="w-4 h-4" /> Enviar
          </button>
          <button className={BTN_SECONDARY} onClick={alEditar}><Pencil className="w-4 h-4" /></button>
          <button
            onClick={alBorrar} title="Borrar"
            className="inline-flex items-center justify-center px-2.5 py-2 rounded border border-digi-border
                       text-digi-muted hover:text-red-400 hover:border-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
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

function PanelEnvio({ flowId, plantilla, columnas, alCerrar, alEnviado }: {
  flowId: number; plantilla: Plantilla; columnas: Columna[];
  alCerrar: () => void; alEnviado: () => void;
}) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [listaId, setListaId] = useState<number | null>(null);
  const [contactos, setContactos] = useState<any[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/flows/${flowId}/contact-lists`)
      .then((r) => r.json())
      .then((d) => setListas(d.data ?? []))
      .catch(() => toast.error('No se pudieron cargar las listas de contactos'));
  }, [flowId]);

  // Los contactos de la lista elegida, para poder enseñar a cuántos se va a escribir y con
  // qué datos. Un envío masivo a ciegas es la clase de acción que nadie debería confirmar.
  useEffect(() => {
    if (!listaId) { setContactos([]); return; }
    fetch(`/api/admin/flows/${flowId}/contact-lists/${listaId}/contacts`)
      .then((r) => r.json())
      .then((d) => setContactos(d.data ?? []))
      .catch(() => setContactos([]));
  }, [flowId, listaId]);

  const conTelefono = contactos.filter((c) => c.phone?.trim());
  const sinTelefono = contactos.length - conTelefono.length;

  const enviar = async () => {
    setConfirmar(false);
    setEnviando(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/agente/plantillas/${plantilla.id}/enviar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lista_id: listaId }),
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
        saving={enviando} canSave={!!listaId && conTelefono.length > 0}
        saveLabel={conTelefono.length ? `Enviar a ${conTelefono.length} contacto(s)` : 'Enviar'}
      >
        <div className="space-y-4">
          <EditField label="Lista de contactos" hint="Las listas de este flujo. Se crean y se editan igual que en el correo masivo.">
            <select className={EDIT_INPUT} value={listaId ?? ''} onChange={(e) => setListaId(Number(e.target.value) || null)}>
              <option value="">Elige una lista…</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </EditField>

          {listas.length === 0 && (
            <p className="text-[12.5px] text-digi-muted leading-relaxed" style={mf}>
              Este flujo todavía no tiene listas de contactos. Se crean en la pestaña de listas del
              flujo, igual que las del correo masivo.
            </p>
          )}

          {listaId && (
            <>
              {sinTelefono > 0 && (
                <div className={`rounded-md border ${TONO.aviso.caja} px-3 py-2.5`}>
                  <p className={`text-[12px] ${TONO.aviso.texto} leading-relaxed`} style={mf}>
                    {sinTelefono} contacto(s) de esta lista <strong>no tienen teléfono</strong> y se van a
                    saltar. WhatsApp necesita el número; el correo no sirve aquí.
                  </p>
                </div>
              )}

              {/* Los tres primeros, ya rellenos. Es la última oportunidad de ver un «Hola —»
                  antes de que salga a cien personas. */}
              {conTelefono.length > 0 && (
                <div>
                  <label className={LABEL}>Así lo va a recibir cada uno</label>
                  <div className="space-y-2">
                    {conTelefono.slice(0, 3).map((c) => (
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
                  {conTelefono.length > 3 && (
                    <p className="mt-1.5 text-[11.5px] text-digi-muted" style={mf}>
                      …y {conTelefono.length - 3} más.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <p className="text-[11.5px] text-digi-muted leading-relaxed flex items-start gap-1.5" style={mf}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            Los mensajes salen de uno en uno para no agotar el límite del número. Cuando termine, los
            verás en la bandeja etiquetados como «plantilla», cada uno en su conversación.
          </p>
        </div>
      </EditPanel>

      <PixelConfirm
        open={confirmar}
        title="Confirmar el envío"
        message={`Se van a enviar ${conTelefono.length} mensajes de WhatsApp reales, ahora mismo. No se pueden retirar una vez enviados. ¿Continuamos?`}
        confirmLabel="Sí, enviar"
        onConfirm={enviar}
        onCancel={() => setConfirmar(false)}
      />
    </>
  );
}
