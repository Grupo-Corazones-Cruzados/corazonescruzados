'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Settings, Sparkles, Pencil, Trash2, RefreshCw, Image as ImageIcon,
  ClipboardList, Info, FileVideo, Wand2, Check, X,
} from 'lucide-react';
import Button, { BTN_SECONDARY } from '@/components/ui/Button';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelConfirm from '@/components/ui/PixelConfirm';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import ActionsMenu from '@/components/centralized/ActionsMenu';
import SelectorFuentes, { type FuenteElegida } from '@/components/centralized/generacion-contenido/SelectorFuentes';
import SelectorReferencias, { type ReferenciaElegida } from '@/components/centralized/generacion-contenido/SelectorReferencias';
import PanelPrompts from '@/components/centralized/generacion-contenido/PanelPrompts';
import {
  ENTREGABLES, ENTREGABLE_META, ESTADOS, ESTADO_LABEL, ESTADO_VARIANT,
  LAMINA_ROL_LABEL, ORDEN_GENERACION,
  type ContenidoEstado, type EntregableTipo, type LaminaRol,
} from '@/lib/centralized/generacion-contenido';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const API = '/api/centralized/generacion-contenido';
const CENTRO = ENTREGABLES.filter((e) => e.panel === 'centro');

interface ContenidoLista {
  id: number; titulo: string | null; tema: string; estado: ContenidoEstado;
  talento: string | null; created_at: string; entregables_count: number;
  laminas_count: number; laminas_con_imagen: number;
}
interface Entregable { id: number; tipo: EntregableTipo; texto: string; datos: any; editado: boolean; generado_en: string }
interface Lamina { id: number; orden: number; rol: LaminaRol; titulo: string; texto: string; prompt_visual: string; imagen_url: string | null; error: string | null }

const vacio = {
  tema: '', proposito_social: '', proposito_monetario: '', desarrollo: '',
  talento: '', tonos: [] as string[],
  referencias: [] as ReferenciaElegida[], fuentes: [] as FuenteElegida[],
};

/**
 * SISTEMA «GENERACIÓN DE CONTENIDO» (Centralizado · colaborador · gestión, celda «Líder»).
 *
 * Tres paneles, y el reparto no es decorativo (Fernando, 2026-09-06):
 *  · IZQUIERDA — lo generado hasta ahora: fecha y título. Es por donde se navega.
 *  · CENTRO    — el entregable que se quiera leer: los dos guiones, el short y el carrusel.
 *                Los requerimientos NO aparecen aquí.
 *  · DERECHA   — los requerimientos del contenido, los metadatos del video, y el estado.
 *
 * Los guiones se pueden corregir a mano «por encima» de lo que escribió el agente.
 */
// El alcance (quién ve qué) lo decide el SERVIDOR: las rutas filtran por dueño y el admin
// las ve todas. La pantalla no recibe permisos que decidir, y por eso no usa `isAdmin`.
export default function GeneracionDeContenidoSystem(_props: { system?: any; isAdmin?: boolean }) {
  const [lista, setLista] = useState<ContenidoLista[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<any | null>(null);
  const [cargando, setCargando] = useState(false);

  const [tab, setTab] = useState<EntregableTipo>('guion_largo');
  const [generando, setGenerando] = useState<EntregableTipo | null>(null);
  const [generandoLamina, setGenerandoLamina] = useState<number | null>(null);
  const [enTanda, setEnTanda] = useState(false);

  const [ideaOpen, setIdeaOpen] = useState(false);
  const [editandoIdea, setEditandoIdea] = useState(false);
  const [form, setForm] = useState({ ...vacio });
  const [guardando, setGuardando] = useState(false);

  const [refsOpen, setRefsOpen] = useState(false);
  const [fuentesOpen, setFuentesOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [borrar, setBorrar] = useState<ContenidoLista | null>(null);

  const [talentos, setTalentos] = useState<string[]>([]);
  const [tonos, setTonos] = useState<string[]>([]);

  const [editandoTexto, setEditandoTexto] = useState<EntregableTipo | null>(null);
  const [borrador, setBorrador] = useState('');

  /* ── Carga ────────────────────────────────────────────────────────────────── */
  const cargarLista = useCallback(async () => {
    try {
      const r = await fetch(API);
      const d = await r.json();
      setLista(d.data || []);
      return d.data as ContenidoLista[];
    } catch { return []; }
  }, []);

  const cargarDetalle = useCallback(async (id: number) => {
    setCargando(true);
    try {
      const r = await fetch(`${API}/${id}`);
      const d = await r.json();
      setDetalle(d.data || null);
    } catch { setDetalle(null); } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargarLista(); }, [cargarLista]);
  useEffect(() => { if (selId) cargarDetalle(selId); else setDetalle(null); }, [selId, cargarDetalle]);

  // Las dos listas globales que alimentan el formulario. Viven en Encuadre Condiciológico,
  // que es donde se editan: aquí solo se leen.
  useEffect(() => {
    const leer = async (lista: string, set: (v: string[]) => void) => {
      try {
        const r = await fetch(`/api/centralized/encuadre/listas?list=${lista}`);
        const d = await r.json();
        set((d.data || []).map((o: any) => o.label));
      } catch { set([]); }
    };
    leer('talentos', setTalentos);
    leer('tonos', setTonos);
  }, []);

  const entregables: Record<string, Entregable> = useMemo(() => {
    const out: Record<string, Entregable> = {};
    for (const e of detalle?.entregables || []) out[e.tipo] = e;
    return out;
  }, [detalle]);
  const laminas: Lamina[] = detalle?.laminas || [];

  /* ── La idea ──────────────────────────────────────────────────────────────── */
  const abrirNueva = () => { setForm({ ...vacio }); setEditandoIdea(false); setIdeaOpen(true); };

  const abrirEdicion = () => {
    if (!detalle) return;
    setForm({
      tema: detalle.tema ?? '',
      proposito_social: detalle.proposito_social ?? '',
      proposito_monetario: detalle.proposito_monetario ?? '',
      desarrollo: detalle.desarrollo ?? '',
      talento: detalle.talento ?? '',
      tonos: detalle.tonos ?? [],
      referencias: detalle.referencias ?? [],
      fuentes: detalle.fuentes ?? [],
    });
    setEditandoIdea(true);
    setIdeaOpen(true);
  };

  const guardarIdea = async () => {
    if (!form.tema.trim()) { toast.error('El tema es obligatorio.'); return; }
    setGuardando(true);
    try {
      const url = editandoIdea && selId ? `${API}/${selId}` : API;
      const r = await fetch(url, {
        method: editandoIdea ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, talento: form.talento || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar');
      setIdeaOpen(false);
      const nueva = await cargarLista();
      if (!editandoIdea) {
        const id = d.data?.id ?? nueva[0]?.id;
        setSelId(id);
        toast.success('Idea creada. Ya se le puede pedir el guion largo.');
      } else {
        await cargarDetalle(selId!);
        toast.success('Idea actualizada.');
      }
    } catch (e: any) { toast.error(e.message); } finally { setGuardando(false); }
  };

  const cambiarEstado = async (estado: ContenidoEstado) => {
    if (!selId) return;
    try {
      const r = await fetch(`${API}/${selId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cambiar el estado');
      setDetalle(d.data);
      setLista((prev) => prev.map((c) => (c.id === selId ? { ...c, estado } : c)));
    } catch (e: any) { toast.error(e.message); }
  };

  const confirmarBorrado = async () => {
    if (!borrar) return;
    try {
      const r = await fetch(`${API}/${borrar.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error || 'No se pudo eliminar');
      if (selId === borrar.id) { setSelId(null); setDetalle(null); }
      setBorrar(null);
      await cargarLista();
      toast.success('Contenido eliminado.');
    } catch (e: any) { toast.error(e.message); }
  };

  /* ── Generación ───────────────────────────────────────────────────────────── */
  const generar = useCallback(async (tipo: EntregableTipo): Promise<boolean> => {
    if (!selId) return false;
    setGenerando(tipo);
    try {
      const r = await fetch(`${API}/${selId}/generar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'El agente no pudo generarlo');
      await cargarDetalle(selId);
      await cargarLista();
      return true;
    } catch (e: any) {
      toast.error(`${ENTREGABLE_META[tipo].label}: ${e.message}`);
      return false;
    } finally { setGenerando(null); }
  }, [selId, cargarDetalle, cargarLista]);

  /**
   * La tanda completa va **de uno en uno, en orden y en peticiones separadas**. No es una
   * elección de estilo: cada entregable se apoya en el anterior, y una sola llamada que lo
   * hiciera todo se caería entera al primer tropiezo llevándose lo que ya estaba bien.
   * Si uno falla, se para ahí y se conserva lo generado hasta ese punto.
   */
  const generarTodo = async () => {
    if (!selId) return;
    setEnTanda(true);
    try {
      for (const tipo of ORDEN_GENERACION) {
        const ok = await generar(tipo);
        if (!ok) { toast.error('La tanda se detuvo; lo generado hasta aquí se conserva.'); return; }
      }
      toast.success('Todos los entregables están generados. Faltan las imágenes del carrusel.');
    } finally { setEnTanda(false); }
  };

  const generarImagen = useCallback(async (laminaId: number): Promise<boolean> => {
    if (!selId) return false;
    setGenerandoLamina(laminaId);
    try {
      const r = await fetch(`${API}/${selId}/imagen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lamina_id: laminaId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo generar la imagen');
      await cargarDetalle(selId);
      return true;
    } catch (e: any) { toast.error(e.message); return false; } finally { setGenerandoLamina(null); }
  }, [selId, cargarDetalle]);

  const generarTodasLasImagenes = async () => {
    for (const l of laminas) {
      if (l.imagen_url) continue;
      const ok = await generarImagen(l.id);
      if (!ok) return;
    }
  };

  /* ── Edición a mano de un guion ───────────────────────────────────────────── */
  const abrirEditorTexto = (tipo: EntregableTipo) => {
    setBorrador(entregables[tipo]?.texto ?? '');
    setEditandoTexto(tipo);
  };

  const guardarTexto = async () => {
    if (!editandoTexto) return;
    const e = entregables[editandoTexto];
    if (!e) return;
    try {
      const r = await fetch(`${API}/entregables/${e.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: borrador }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar');
      setEditandoTexto(null);
      await cargarDetalle(selId!);
      toast.success('Guion actualizado.');
    } catch (err: any) { toast.error(err.message); }
  };

  /* ── Pintado ──────────────────────────────────────────────────────────────── */
  const ocupado = Boolean(generando) || enTanda || generandoLamina !== null;
  const estado: ContenidoEstado = (detalle?.estado as ContenidoEstado) || 'en_desarrollo';

  const cuerpoCentral = () => {
    if (!detalle) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center py-12">
          <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mb-3">
            <FileVideo className="w-6 h-6 text-accent" />
          </div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Elige un contenido</p>
          <p className="text-[12px] text-digi-muted mt-1 max-w-xs" style={mf}>
            O crea una idea de video nueva y pídele al agente los entregables.
          </p>
        </div>
      );
    }

    if (tab === 'carrusel') return vistaCarrusel();

    const e = entregables[tab];
    if (!e) return vistaSinGenerar(tab);

    if (editandoTexto === tab) {
      return (
        <div className="flex flex-col gap-2 h-full">
          <textarea
            value={borrador}
            onChange={(ev) => setBorrador(ev.target.value)}
            className="field-control flex-1 min-h-[320px] w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-[13px] leading-relaxed text-digi-text focus:border-accent focus:outline-none"
            style={mf}
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setEditandoTexto(null)} className={BTN_SECONDARY}>
              <X className="w-4 h-4" /> Cancelar
            </button>
            <Button onClick={guardarTexto} icon={<Check className="w-4 h-4" />}>Guardar guion</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="prose-sm max-w-none text-[13px] text-digi-text" style={mf}>
        <MarkdownRenderer content={e.texto || '_El agente no devolvió texto para este entregable._'} />
      </div>
    );
  };

  const vistaSinGenerar = (tipo: EntregableTipo) => {
    const meta = ENTREGABLE_META[tipo];
    const faltan = meta.depende.filter((d) => !entregables[d]);
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-12">
        <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mb-3">
          <Sparkles className="w-6 h-6 text-accent" />
        </div>
        <p className="text-[13px] font-medium text-digi-text" style={mf}>{meta.label}</p>
        <p className="text-[12px] text-digi-muted mt-1 mb-4 max-w-md" style={mf}>{meta.descripcion}</p>
        {faltan.length > 0 ? (
          <p className="text-[12px] text-amber-600" style={mf}>
            Antes hace falta: {faltan.map((f) => ENTREGABLE_META[f].label).join(', ')}.
          </p>
        ) : (
          <Button onClick={() => generar(tipo)} disabled={ocupado} icon={<Wand2 className="w-4 h-4" />}>
            {generando === tipo ? 'Generando…' : 'Generar'}
          </Button>
        )}
      </div>
    );
  };

  const vistaCarrusel = () => {
    if (!entregables.carrusel) return vistaSinGenerar('carrusel');
    const pendientes = laminas.filter((l) => !l.imagen_url).length;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-digi-muted" style={mf}>
            {laminas.length} lámina{laminas.length === 1 ? '' : 's'} · {laminas.length - pendientes} con imagen
          </span>
          {pendientes > 0 && (
            <button
              type="button"
              onClick={generarTodasLasImagenes}
              disabled={ocupado}
              className={`${BTN_SECONDARY} ml-auto`}
            >
              <ImageIcon className="w-4 h-4" />
              {generandoLamina !== null ? 'Generando imágenes…' : `Generar las ${pendientes} imágenes que faltan`}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          {laminas.map((l) => (
            <div key={l.id} className="rounded-xl border border-digi-border overflow-hidden bg-digi-card flex flex-col">
              <div className="relative aspect-square bg-black/[0.04] flex items-center justify-center">
                {l.imagen_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imagen_url} alt={l.titulo} className="w-full h-full object-cover" />
                ) : (
                  <button
                    type="button"
                    onClick={() => generarImagen(l.id)}
                    disabled={ocupado}
                    className="flex flex-col items-center gap-1.5 text-digi-muted hover:text-accent disabled:opacity-40"
                    style={mf}
                  >
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[11.5px]">
                      {generandoLamina === l.id ? 'Generando…' : 'Generar imagen'}
                    </span>
                  </button>
                )}
                <span className="absolute top-2 left-2">
                  <PixelBadge variant={l.rol === 'intro' ? 'info' : l.rol === 'cierre' ? 'success' : 'default'}>
                    {l.orden + 1}. {LAMINA_ROL_LABEL[l.rol]}
                  </PixelBadge>
                </span>
              </div>
              <div className="p-2.5 flex flex-col gap-1">
                <p className="text-[12.5px] font-semibold text-digi-text" style={mf}>{l.titulo}</p>
                <p className="text-[12px] text-digi-muted leading-snug" style={mf}>{l.texto}</p>
                {l.error && <p className="text-[11.5px] text-red-600" style={mf}>{l.error}</p>}
                {l.imagen_url && (
                  <button
                    type="button"
                    onClick={() => generarImagen(l.id)}
                    disabled={ocupado}
                    className="self-start text-[11.5px] text-digi-muted hover:text-accent inline-flex items-center gap-1 disabled:opacity-40"
                    style={mf}
                  >
                    <RefreshCw className="w-3 h-3" /> Rehacer imagen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const bloqueRequerimientos = () => {
    const e = entregables.requerimientos;
    if (!e) {
      return (
        <p className="text-[12px] text-digi-muted" style={mf}>
          Todavía no se han generado. Salen del guion largo.
        </p>
      );
    }
    const grupos = e.datos?.grupos || [];
    return (
      <div className="flex flex-col gap-2.5">
        {grupos.map((g: any, i: number) => (
          <div key={i}>
            <p className="text-[11.5px] font-semibold text-digi-text uppercase tracking-wide" style={df}>{g.titulo}</p>
            <ul className="mt-1 space-y-1">
              {(g.items || []).map((it: any, j: number) => (
                <li key={j} className="text-[12px] text-digi-text leading-snug flex gap-1.5" style={mf}>
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${it.imprescindible === false ? 'bg-digi-muted' : 'bg-accent'}`} />
                  <span>
                    {it.accion}
                    {it.detalle && <span className="text-digi-muted"> — {it.detalle}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  const bloqueMetadatos = () => {
    const e = entregables.metadatos;
    if (!e) {
      return <p className="text-[12px] text-digi-muted" style={mf}>Todavía no se han generado.</p>;
    }
    const d = e.datos || {};
    const fila = (k: string, v: any) => (
      v ? (
        <div key={k} className="flex gap-2 text-[12px]" style={mf}>
          <span className="text-digi-muted shrink-0 w-24">{k}</span>
          <span className="text-digi-text">{v}</span>
        </div>
      ) : null
    );
    return (
      <div className="flex flex-col gap-2">
        {fila('Tema', d.tema)}
        {fila('Público', d.publico)}
        {fila('Duración', d.duracion_total)}
        {(d.por_concepto || []).length > 0 && (
          <div>
            <p className="text-[11.5px] font-semibold text-digi-text uppercase tracking-wide mt-1" style={df}>Por concepto</p>
            {d.por_concepto.map((c: any, i: number) => (
              <div key={i} className="flex gap-2 text-[12px]" style={mf}>
                <span className="text-digi-text flex-1">{c.concepto}</span>
                <span className="text-digi-muted">{c.duracion}</span>
              </div>
            ))}
          </div>
        )}
        {(d.fuentes || []).length > 0 && (
          <div>
            <p className="text-[11.5px] font-semibold text-digi-text uppercase tracking-wide mt-1" style={df}>Fuentes</p>
            <ul className="space-y-0.5">
              {d.fuentes.map((f: string, i: number) => (
                <li key={i} className="text-[12px] text-digi-muted leading-snug" style={mf}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {(d.referencias || []).length > 0 && (
          <div>
            <p className="text-[11.5px] font-semibold text-digi-text uppercase tracking-wide mt-1" style={df}>Referencias</p>
            <ul className="space-y-0.5">
              {d.referencias.map((f: string, i: number) => (
                <li key={i} className="text-[12px] text-digi-muted leading-snug" style={mf}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {(d.palabras_clave || []).length > 0 && (
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>{d.palabras_clave.join(' · ')}</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-4 xl:h-[calc(100dvh-150px)]">
      {/* ── IZQUIERDA: lo generado ── */}
      <aside className="w-full xl:w-[250px] shrink-0 flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-2">
          <button onClick={abrirNueva} className={`${BTN_SECONDARY} flex-1 bg-accent text-white border-accent hover:bg-accent-hover hover:text-white`}>
            <Plus className="w-4 h-4" /> Nueva idea
          </button>
          <button
            onClick={() => setPromptsOpen(true)}
            title="Configuración del agente"
            className="w-9 h-9 flex items-center justify-center rounded border border-digi-border text-digi-muted hover:border-accent hover:text-accent transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 bg-digi-card border border-digi-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-1.5">
            <FileVideo className="w-4 h-4 text-accent" />
            <span className="text-[12px] font-semibold text-digi-text" style={df}>Contenidos</span>
            <span className="ml-auto text-[11px] text-digi-muted" style={mf}>{lista.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-digi-border/60">
            {lista.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>Todavía no hay ideas de video.</p>
            ) : lista.map((c) => {
              const activo = c.id === selId;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelId(c.id); setTab('guion_largo'); setEditandoTexto(null); }}
                  className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors
                    ${activo ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.03]'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      c.estado === 'publicado' ? 'bg-green-500'
                      : c.estado === 'cancelado' ? 'bg-red-500'
                      : c.estado === 'desarrollado' ? 'bg-accent' : 'bg-amber-500'}`}
                      title={ESTADO_LABEL[c.estado]} />
                    <span className="text-[11px] text-digi-muted" style={mf}>
                      {new Date(c.created_at).toLocaleDateString('es-ES')}
                    </span>
                    <span className="ml-auto text-[10.5px] text-digi-muted" style={mf}>
                      {c.entregables_count}/{ENTREGABLES.length}
                    </span>
                  </div>
                  <p className="text-[12.5px] font-medium text-digi-text leading-snug mt-0.5 line-clamp-2" style={mf}>
                    {c.titulo || c.tema}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── CENTRO: el entregable elegido ── */}
      <section className="flex-1 min-w-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-digi-text truncate max-w-[40%]" style={df}>
            {detalle ? (detalle.titulo || detalle.tema) : 'Generación de Contenido'}
          </span>
          {detalle && <PixelBadge variant={ESTADO_VARIANT[estado]}>{ESTADO_LABEL[estado]}</PixelBadge>}
          {detalle && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                onClick={generarTodo}
                disabled={ocupado}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {enTanda ? `Generando ${generando ? ENTREGABLE_META[generando].label : ''}…` : 'Generar todo'}
              </Button>
              <ActionsMenu
                items={[
                  { label: 'Editar idea', icon: <Pencil className="w-3.5 h-3.5" />, onClick: abrirEdicion },
                  {
                    label: 'Eliminar contenido', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true,
                    onClick: () => setBorrar(lista.find((c) => c.id === selId) || null),
                  },
                ]}
              />
            </div>
          )}
        </div>

        {detalle && (
          <div className="px-3 pt-2 flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <PixelTabs
                tabs={CENTRO.map((e) => ({
                  value: e.tipo,
                  label: e.label,
                  count: e.tipo === 'carrusel' && laminas.length ? laminas.length : undefined,
                }))}
                active={tab}
                onChange={(v) => { setTab(v as EntregableTipo); setEditandoTexto(null); }}
                flush
              />
            </div>
            {entregables[tab] && (
              <div className="flex items-center gap-1.5">
                {ENTREGABLE_META[tab].editable && editandoTexto !== tab && (
                  <button
                    type="button"
                    onClick={() => abrirEditorTexto(tab)}
                    className="inline-flex items-center gap-1 text-[11.5px] text-digi-muted hover:text-accent"
                    style={mf}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => generar(tab)}
                  disabled={ocupado}
                  className="inline-flex items-center gap-1 text-[11.5px] text-digi-muted hover:text-accent disabled:opacity-40"
                  style={mf}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {generando === tab ? 'Generando…' : 'Regenerar'}
                </button>
                {entregables[tab].editado && <PixelBadge variant="warning">Editado a mano</PixelBadge>}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 min-h-[40vh]">
          {cargando ? (
            <div className="py-16 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>
          ) : cuerpoCentral()}
        </div>
      </section>

      {/* ── DERECHA: requerimientos, metadatos y estado ── */}
      <aside className="w-full xl:w-[330px] shrink-0 flex flex-col gap-3 min-h-0 overflow-y-auto">
        <div className="bg-digi-card border border-digi-border rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-accent" />
            <span className="text-[12px] font-semibold text-digi-text" style={df}>Requerimientos del contenido</span>
            {detalle && entregables.requerimientos && (
              <button
                type="button"
                onClick={() => generar('requerimientos')}
                disabled={ocupado}
                title="Regenerar"
                className="ml-auto text-digi-muted hover:text-accent disabled:opacity-40"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="p-3">
            {detalle ? bloqueRequerimientos() : (
              <p className="text-[12px] text-digi-muted" style={mf}>Elige un contenido.</p>
            )}
          </div>
        </div>

        <div className="bg-digi-card border border-digi-border rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-1.5">
            <Info className="w-4 h-4 text-accent" />
            <span className="text-[12px] font-semibold text-digi-text" style={df}>Metadatos del video</span>
            {detalle && entregables.metadatos && (
              <button
                type="button"
                onClick={() => generar('metadatos')}
                disabled={ocupado}
                title="Regenerar"
                className="ml-auto text-digi-muted hover:text-accent disabled:opacity-40"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="p-3">
            {detalle ? bloqueMetadatos() : (
              <p className="text-[12px] text-digi-muted" style={mf}>Elige un contenido.</p>
            )}
          </div>
        </div>

        {detalle && (
          <div className="bg-digi-card border border-digi-border rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-digi-border">
              <span className="text-[12px] font-semibold text-digi-text" style={df}>Estado del contenido</span>
            </div>
            <div className="p-1.5">
              {ESTADOS.map((e) => (
                <button
                  key={e}
                  onClick={() => cambiarEstado(e)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[12.5px] transition-colors
                    ${estado === e ? 'bg-accent-light text-accent font-medium' : 'text-digi-text hover:bg-black/[0.03]'}`}
                  style={mf}
                >
                  {ESTADO_LABEL[e]}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ── Formulario de la idea ── */}
      <EditPanel
        open={ideaOpen}
        onClose={() => setIdeaOpen(false)}
        title={editandoIdea ? 'Editar idea de video' : 'Nueva idea de video'}
        onSave={guardarIdea}
        saving={guardando}
        canSave={Boolean(form.tema.trim())}
        saveLabel={editandoIdea ? 'Guardar' : 'Crear idea'}
      >
        <EditField label="Tema">
          <input
            value={form.tema}
            onChange={(e) => setForm({ ...form, tema: e.target.value })}
            className={EDIT_INPUT}
            placeholder="De qué trata el video"
          />
        </EditField>
        <EditField label="Propósito social" hint="Qué cambio busca provocar el video en quien lo ve.">
          <textarea
            value={form.proposito_social}
            onChange={(e) => setForm({ ...form, proposito_social: e.target.value })}
            rows={2}
            className={EDIT_INPUT}
          />
        </EditField>
        <EditField label="Propósito monetario" hint="Cómo se convierte este contenido en ingreso: qué se vende, a quién y en qué momento.">
          <textarea
            value={form.proposito_monetario}
            onChange={(e) => setForm({ ...form, proposito_monetario: e.target.value })}
            rows={2}
            className={EDIT_INPUT}
          />
        </EditField>
        <EditField label="Desarrollo del contenido" hint="Por dónde debe ir el video: el hilo, los puntos que no pueden faltar, el final.">
          <textarea
            value={form.desarrollo}
            onChange={(e) => setForm({ ...form, desarrollo: e.target.value })}
            rows={4}
            className={EDIT_INPUT}
          />
        </EditField>

        <EditField label="Referencia histórica" hint="Trabajos reales del grupo —productos, proyectos o tickets— que el video puede citar como ejemplo. Se pueden elegir varios.">
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setRefsOpen(true)} className={BTN_SECONDARY}>
              {form.referencias.length ? `${form.referencias.length} elegida(s) · cambiar` : 'Buscar trabajos del grupo'}
            </button>
            {form.referencias.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.referencias.map((r) => (
                  <PixelBadge key={`${r.tipo}-${r.ref_id}`} variant="info">{r.titulo}</PixelBadge>
                ))}
              </div>
            )}
          </div>
        </EditField>

        <EditField label="Fuente de conocimiento" hint="Lo ya clasificado en Gestión de Datos: códigos, categorías, piezas, rompecabezas, subtemas y temas. Es de donde sale lo que el video afirma.">
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => setFuentesOpen(true)} className={BTN_SECONDARY}>
              {form.fuentes.length ? `${form.fuentes.length} elegida(s) · cambiar` : 'Abrir Gestión de Datos'}
            </button>
            {form.fuentes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.fuentes.map((f) => (
                  <PixelBadge key={`${f.tipo}-${f.ref_id}`}>{f.etiqueta}</PixelBadge>
                ))}
              </div>
            )}
          </div>
        </EditField>

        <EditField label="Talento">
          <select
            value={form.talento}
            onChange={(e) => setForm({ ...form, talento: e.target.value })}
            className={EDIT_INPUT}
          >
            <option value="">Sin talento</option>
            {talentos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </EditField>

        <EditField label="Tonos de expresión" hint="Se pueden elegir varios: el agente busca cómo integrarlos —por ejemplo, abrir en triste y resolver en alegre— para captar la atención. La lista se edita en Encuadre Condiciológico.">
          <MultiSelectSearch
            options={tonos.map((t) => ({ value: t, label: t }))}
            selected={form.tonos}
            onChange={(tonosSel) => setForm({ ...form, tonos: tonosSel })}
            placeholder="Buscar tono…"
          />
        </EditField>
      </EditPanel>

      <SelectorReferencias
        open={refsOpen}
        onClose={() => setRefsOpen(false)}
        elegidas={form.referencias}
        onGuardar={(refs) => setForm((f) => ({ ...f, referencias: refs }))}
      />
      <SelectorFuentes
        open={fuentesOpen}
        onClose={() => setFuentesOpen(false)}
        elegidas={form.fuentes}
        onGuardar={(fs) => setForm((f) => ({ ...f, fuentes: fs }))}
      />
      <PanelPrompts open={promptsOpen} onClose={() => setPromptsOpen(false)} />

      <PixelConfirm
        open={Boolean(borrar)}
        title="Eliminar contenido"
        message={`Se eliminan la idea «${borrar?.titulo || borrar?.tema || ''}» y todos sus entregables, incluidas las láminas del carrusel. No se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={confirmarBorrado}
        onCancel={() => setBorrar(null)}
      />
    </div>
  );
}
