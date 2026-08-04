'use client';

/**
 * PESTAÑA «FAQs» DEL ADMIN — las preguntas frecuentes que se publican en `/negocio/<id>`.
 *
 * ── TRES PANELES (Fernando, 2026-08-04) ────────────────────────────────────────
 *   ┌────────────┬──────────────────────────┬─────────────────────┐
 *   │ Las cinco  │ Preguntas de esa sección │ La respuesta        │
 *   │ secciones  │ SIN la respuesta         │ completa           │
 *   └────────────┴──────────────────────────┴─────────────────────┘
 *
 * Es el patrón **«Explorador Azure»** ya documentado en `Diseño.md` (rail + lista + panel de
 * detalle), el mismo de Centralizado y Automatizaciones. **No se ha escrito un rail nuevo**:
 * se usa `FilterRail`, que es su definición única, y `PixelDataTable` para la lista. La regla
 * del proyecto es explícita — un control que ya existe se usa, no se reescribe parecido.
 *
 * ── POR QUÉ LA TABLA NO ENSEÑA LA RESPUESTA ────────────────────────────────────
 * Lo pidió Fernando, y tiene sentido: una respuesta ocupa párrafos. Metida en una celda,
 * cada fila mediría cinco líneas y la lista dejaría de poder recorrerse de un vistazo. La
 * tabla es para **encontrar**; el panel derecho, para **leer**.
 *
 * ── LO QUE SE ESCRIBE AQUÍ SALE PUBLICADO ──────────────────────────────────────
 * No es una tabla interna: aparece en la web pública y alimenta los datos estructurados
 * `FAQPage`, que es lo que Google convierte en respuestas desplegables. Un error de
 * ortografía aquí es un error de ortografía publicado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Plus, Search, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import FilterRail from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { EditPanel, EditField } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { ICONOS } from '@/components/sitio/piezas';
import { ACCESOS } from '@/lib/sitio/contenido';
import type { Faq } from '@/lib/faqs';

const mf = { fontFamily: 'var(--font-body)' } as const;
const CAMPO =
  'field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] ' +
  'text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none transition-colors';

export default function FaqsPanel() {
  const [seccion, setSeccion] = useState(ACCESOS[0].id);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [elegida, setElegida] = useState<Faq | null>(null);

  const [editando, setEditando] = useState<Faq | 'nueva' | null>(null);
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<Faq | null>(null);

  // Mide el hueco hasta la barra de ruta fija del pie, igual que las otras pestañas del
  // admin. Sin esto, los tres paneles se salen por debajo y sus últimas filas quedan
  // tapadas por el pie.
  const cajaRef = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState<number>();
  useEffect(() => {
    const medir = () => {
      const el = cajaRef.current;
      if (!el) return;
      const barra = document.querySelector('nav[aria-label="Ruta"]');
      const altoBarra = barra ? barra.getBoundingClientRect().height : 0;
      const h = Math.max(window.innerHeight - el.getBoundingClientRect().top - altoBarra - 12, 360);
      setAlto((prev) => (prev === undefined || Math.abs(prev - h) > 1 ? h : prev));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const cargarConteos = useCallback(async () => {
    const r = await fetch('/api/admin/faqs');
    if (r.ok) setConteos((await r.json()).conteos ?? {});
  }, []);

  const cargar = useCallback(async (acceso: string) => {
    setCargando(true);
    try {
      const r = await fetch(`/api/admin/faqs?acceso=${encodeURIComponent(acceso)}`);
      const j = await r.json();
      setFaqs(r.ok ? j.data ?? [] : []);
      if (!r.ok) toast.error(j.error || 'No se pudieron cargar las preguntas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarConteos(); }, [cargarConteos]);
  useEffect(() => {
    // Al cambiar de sección se suelta la selección: dejarla apuntando a una pregunta de
    // otra sección mostraría en el panel derecho algo que ya no está en la lista.
    setElegida(null);
    setBusqueda('');
    cargar(seccion);
  }, [seccion, cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return faqs;
    // Se busca también dentro de la respuesta aunque no se vea en la tabla: quien busca
    // «factura» quiere encontrar la pregunta que la menciona en su respuesta.
    return faqs.filter(
      (f) => f.pregunta.toLowerCase().includes(q) || f.respuesta.toLowerCase().includes(q),
    );
  }, [faqs, busqueda]);

  function abrirNueva() {
    setEditando('nueva');
    setPregunta('');
    setRespuesta('');
  }
  function abrirEdicion(f: Faq) {
    setEditando(f);
    setPregunta(f.pregunta);
    setRespuesta(f.respuesta);
  }

  async function guardar() {
    setGuardando(true);
    try {
      const esNueva = editando === 'nueva';
      const r = await fetch(
        esNueva ? '/api/admin/faqs' : `/api/admin/faqs/${(editando as Faq).id}`,
        {
          method: esNueva ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            esNueva ? { acceso: seccion, pregunta, respuesta } : { pregunta, respuesta },
          ),
        },
      );
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'No se pudo guardar'); return; }

      setEditando(null);
      await cargar(seccion);
      await cargarConteos();
      // Deja seleccionada la que se acaba de tocar: es lo que se quiere leer después.
      setElegida(j.data);
      toast.success(esNueva ? 'Pregunta creada' : 'Pregunta actualizada');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!porBorrar) return;
    const r = await fetch(`/api/admin/faqs/${porBorrar.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('No se pudo eliminar'); return; }
    if (elegida?.id === porBorrar.id) setElegida(null);
    setPorBorrar(null);
    await cargar(seccion);
    await cargarConteos();
    toast.success('Pregunta eliminada');
  }

  /** Mueve una pregunta y manda la lista COMPLETA reordenada. Ver el endpoint. */
  async function mover(f: Faq, direccion: -1 | 1) {
    const orden = [...faqs];
    const i = orden.findIndex((x) => x.id === f.id);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];

    // Se pinta ya, sin esperar al servidor: mover una fila y que tarde medio segundo en
    // reaccionar hace dudar de si se pulsó bien.
    setFaqs(orden);
    const r = await fetch('/api/admin/faqs/reordenar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acceso: seccion, ids: orden.map((x) => x.id) }),
    });
    if (!r.ok) { toast.error('No se pudo reordenar'); await cargar(seccion); return; }
    setFaqs((await r.json()).data ?? orden);
  }

  const seccionActual = ACCESOS.find((a) => a.id === seccion);

  return (
    <div ref={cajaRef} style={{ height: alto }} className="flex flex-col">
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_340px] flex-1 min-h-0">

        {/* ── 1. LAS CINCO SECCIONES ─────────────────────────────────────────── */}
        <FilterRail
          title="Secciones"
          value={seccion}
          onChange={setSeccion}
          items={ACCESOS.map((a) => ({
            value: a.id,
            label: a.titulo,
            Icon: ICONOS[a.icono] ?? HelpCircle,
            count: conteos[a.id] ?? 0,
            hint: `/negocio/${a.id}`,
          }))}
        />

        {/* ── 2. LAS PREGUNTAS, SIN RESPUESTA ────────────────────────────────── */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en preguntas y respuestas"
                className={`${CAMPO} pl-9`}
                style={mf}
              />
            </div>
            <button onClick={abrirNueva} className={BTN_PRIMARY} style={mf}>
              <Plus className="w-4 h-4" /> Nueva
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <PixelDataTable
              columns={[
                {
                  key: 'orden', header: '#', width: '52px',
                  render: (f: Faq) => (
                    <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>
                      {faqs.findIndex((x) => x.id === f.id) + 1}
                    </span>
                  ),
                },
                {
                  key: 'pregunta', header: 'Pregunta',
                  render: (f: Faq) => (
                    <span className="text-[13px] text-digi-text" style={mf}>{f.pregunta}</span>
                  ),
                },
                {
                  key: 'acciones', header: '', width: '104px',
                  render: (f: Faq) => (
                    // `stopPropagation`: sin esto, mover una fila también la selecciona y el
                    // panel derecho salta a otra pregunta a mitad de la reordenación.
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => mover(f, -1)} title="Subir"
                        className="p-1 rounded hover:bg-digi-hover text-digi-muted hover:text-digi-text">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => mover(f, 1)} title="Bajar"
                        className="p-1 rounded hover:bg-digi-hover text-digi-muted hover:text-digi-text">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => abrirEdicion(f)} title="Editar"
                        className="p-1 rounded hover:bg-digi-hover text-digi-muted hover:text-digi-text">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={visibles}
              onRowClick={setElegida}
              rowClassName={(f: Faq) => (elegida?.id === f.id ? 'bg-accent-light' : '')}
              emptyTitle={cargando ? 'Cargando…' : busqueda ? 'Sin coincidencias' : 'Todavía no hay preguntas'}
              emptyDesc={
                cargando ? '' :
                busqueda ? 'Prueba con otras palabras.' :
                `Las que crees aquí se publican en grupocc.org/negocio/${seccion}.`
              }
              singleLine
            />
          </div>
        </div>

        {/* ── 3. LA RESPUESTA COMPLETA ───────────────────────────────────────── */}
        <div className="bg-digi-card border border-digi-border rounded-lg p-4 overflow-y-auto">
          {elegida ? (
            <>
              <p className="text-[11px] uppercase tracking-[0.12em] text-digi-muted" style={mf}>
                {seccionActual?.titulo}
              </p>
              <h3 className="mt-2 text-[15px] font-semibold text-digi-text leading-snug" style={mf}>
                {elegida.pregunta}
              </h3>
              {/* `whitespace-pre-wrap`: la respuesta se escribe con saltos de línea y hay que
                  verlos aquí igual que se verán en la web. */}
              <p className="mt-4 text-[13px] leading-relaxed text-digi-muted whitespace-pre-wrap" style={mf}>
                {elegida.respuesta}
              </p>
              <div className="mt-6 pt-4 border-t border-digi-border flex items-center gap-2">
                <button onClick={() => abrirEdicion(elegida)} className={BTN_SECONDARY} style={mf}>
                  <Pencil className="w-4 h-4" /> Editar
                </button>
                <button onClick={() => setPorBorrar(elegida)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] rounded text-red-600 hover:bg-red-50 transition-colors"
                  style={mf}>
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mb-3">
                <HelpCircle className="w-5 h-5 text-accent" />
              </div>
              <p className="text-[13px] font-medium text-digi-text" style={mf}>
                Elige una pregunta
              </p>
              <p className="text-[12px] text-digi-muted mt-1" style={mf}>
                Su respuesta completa aparece aquí.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* La edición nunca es «por encima»: panel lateral derecho sobre overlay, que es la
          superficie que manda el sistema para un formulario con un campo largo. */}
      <EditPanel
        open={editando !== null}
        title={editando === 'nueva' ? 'Nueva pregunta' : 'Editar pregunta'}
        onClose={() => setEditando(null)}
        onSave={guardar}
        saving={guardando}
        canSave={!!pregunta.trim() && !!respuesta.trim()}
      >
        <EditField label="Pregunta">
          <input value={pregunta} onChange={(e) => setPregunta(e.target.value)}
            className={CAMPO} style={mf} autoFocus />
        </EditField>
        <EditField label="Respuesta">
          <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)}
            rows={10} className={`${CAMPO} resize-y`} style={mf} />
        </EditField>
      </EditPanel>

      <PixelConfirm
        open={!!porBorrar}
        title="Eliminar pregunta"
        message={`«${porBorrar?.pregunta ?? ''}» dejará de verse en la web. No se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={borrar}
        onCancel={() => setPorBorrar(null)}
      />
    </div>
  );
}
