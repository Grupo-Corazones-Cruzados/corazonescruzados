'use client';

/**
 * PESTAÑA «ÁMBITOS» DEL ADMIN — los tipos de proyecto que el grupo maneja.
 *
 * Se publican en `/soluciones`, donde el visitante ve cada solución como una carpeta, la
 * despliega y elige un talento para ver el trabajo hecho con él.
 *
 * ── TRES PANELES ───────────────────────────────────────────────────────────────
 *   ┌────────────┬──────────────────────────┬──────────────────────┐
 *   │ Los        │ Talentos de la solución, con │ Catálogo de talentos │
 *   │ soluciones    │ su respaldo real         │ para añadir          │
 *   └────────────┴──────────────────────────┴──────────────────────┘
 *
 * Es el patrón **«Explorador Azure»** ya documentado en `Diseño.md`, el mismo de FAQs,
 * Centralizado y Automatizaciones. **No se ha escrito un rail nuevo**: se usa `FilterRail`,
 * que es su definición única, y `PixelDataTable` para la lista. La regla del proyecto es
 * explícita — un control que ya existe se usa, no se reescribe parecido.
 *
 * ── ⭐ POR QUÉ EL PANEL DEL MEDIO ENSEÑA CUÁNTO RESPALDA A CADA TALENTO ─────────
 * Porque es lo único que evita publicar una carpeta vacía. Una solución se monta eligiendo
 * talentos del catálogo del grupo —que tiene cientos, incluidos «Jugar fútbol» o
 * «Repostería»—, y nada impide asociar uno con el que jamás se ha hecho un proyecto. En la
 * web eso es un visitante que despliega una carpeta y no encuentra nada.
 *
 * Las columnas «Proyectos» y «Tickets» cuentan **solo lo terminado**, que es lo único que
 * se publica (decisión de Fernando, 2026-08-18). Un 0 no impide guardar: avisa.
 *
 * ── LO QUE SE ESCRIBE AQUÍ SALE PUBLICADO ──────────────────────────────────────
 * No es una tabla interna. Un error de ortografía en el nombre de una solución es un error de
 * ortografía publicado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Plus, Search, Pencil, Trash2, ArrowUp, ArrowDown, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import FilterRail from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { EditPanel, EditField } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TALENTOS_BY_CATEGORY } from '@/lib/centralized/talentos';
import type { Solucion, CoberturaTalento, TalentoDeSolucion } from '@/lib/soluciones';

const mf = { fontFamily: 'var(--font-body)' } as const;
const CAMPO =
  'field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] ' +
  'text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none transition-colors';

/** Una fila del panel del medio: el talento, su descripción y lo que lo respalda. */
interface FilaTalento {
  talento: string;
  descripcion: string | null;
  proyectos: number;
  tickets: number;
}

export default function SolucionesPanel() {
  const [soluciones, setSoluciones] = useState<Solucion[]>([]);
  const [cobertura, setCobertura] = useState<Record<string, CoberturaTalento>>({});
  // Talento → nombre de la solución que ya lo tiene. Un talento pertenece a UNO solo.
  const [ocupados, setOcupados] = useState<Record<string, string>>({});
  const [elegido, setElegido] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [editando, setEditando] = useState<Solucion | 'nuevo' | null>(null);
  const [nombre, setNombre] = useState('');
  // El talento que se está asociando (o cuya descripción se edita). La descripción se pide
  // AL ASOCIAR, que es lo que pidió Fernando: no se añade y luego se rellena.
  const [talentoEnEdicion, setTalentoEnEdicion] = useState<{ talento: string; nuevo: boolean } | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<Solucion | null>(null);

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

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/admin/soluciones?cobertura=1');
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'No se pudieron cargar los soluciones'); return; }
      const lista: Solucion[] = j.data ?? [];
      setSoluciones(lista);
      setCobertura(Object.fromEntries((j.cobertura ?? []).map((c: CoberturaTalento) => [c.talento, c])));
      setOcupados(j.ocupados ?? {});
      // Se elige el primero solo si no había nada elegido, para no saltar de solución
      // después de guardar.
      setElegido((prev) => (prev && lista.some((a) => a.id === prev) ? prev : lista[0]?.id ?? null));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const solucion = soluciones.find((a) => a.id === elegido) ?? null;

  const filas: FilaTalento[] = useMemo(
    () => (solucion?.talentos ?? []).map((t) => ({
      talento: t.talento,
      descripcion: t.descripcion,
      proyectos: cobertura[t.talento]?.proyectos ?? 0,
      tickets: cobertura[t.talento]?.tickets ?? 0,
    })),
    [solucion, cobertura],
  );

  /* ── Guardar la lista de talentos ───────────────────────────────────────────
     Siempre se manda la lista COMPLETA: la pantalla edita el estado final. */
  async function guardarTalentos(id: number, talentos: TalentoDeSolucion[]) {
    const r = await fetch(`/api/admin/soluciones/${id}/talentos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talentos }),
    });
    if (!r.ok) {
      // La API explica el choque con «un talento, una solución» nombrando a la solución que lo
      // tiene. Tragarse ese texto y poner uno genérico sería desperdiciarlo.
      const j = await r.json().catch(() => ({}));
      toast.error(j.error || 'No se pudieron guardar los talentos');
      return;
    }
    await cargar();
  }

  async function guardarNombre() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setGuardando(true);
    try {
      const esNuevo = editando === 'nuevo';
      const r = await fetch(esNuevo ? '/api/admin/soluciones' : `/api/admin/soluciones/${(editando as Solucion).id}`, {
        method: esNuevo ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'No se pudo guardar'); return; }
      if (esNuevo && j.data?.id) setElegido(j.data.id);
      setEditando(null);
      await cargar();
      toast.success(esNuevo ? 'Solución creada' : 'Solución renombrada');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(a: Solucion) {
    const r = await fetch(`/api/admin/soluciones/${a.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('No se pudo eliminar'); return; }
    setPorBorrar(null);
    setElegido(null);
    await cargar();
    toast.success('Solución eliminada');
  }

  async function mover(dir: -1 | 1) {
    const i = soluciones.findIndex((a) => a.id === elegido);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= soluciones.length) return;
    const orden = [...soluciones];
    [orden[i], orden[j]] = [orden[j], orden[i]];
    // Se pinta ya, sin esperar al servidor: mover algo y que tarde medio segundo en
    // reaccionar hace dudar de si se pulsó bien.
    setSoluciones(orden);
    const r = await fetch('/api/admin/soluciones/reordenar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: orden.map((x) => x.id) }),
    });
    if (!r.ok) { toast.error('No se pudo reordenar'); await cargar(); return; }
    setSoluciones((await r.json()).data ?? orden);
  }

  /* ── El catálogo del panel derecho, filtrado y sin lo ya asociado ─────────── */
  const catalogo = useMemo(() => {
    const yaEstan = new Set((solucion?.talentos ?? []).map((t) => t.talento));
    const q = busqueda.trim().toLowerCase();
    // ⚠️ Se esconden los que ya tiene OTRO solución: un talento pertenece a uno solo
    // (migración 042). Ofrecer uno que la base va a rechazar es prometer lo imposible.
    return TALENTOS_BY_CATEGORY
      .map((g) => ({
        category: g.category,
        items: g.items.filter(
          (t) => !yaEstan.has(t) && !ocupados[t] && (!q || t.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [solucion, busqueda, ocupados]);

  const sinRespaldo = filas.filter((f) => f.proyectos === 0 && f.tickets === 0).length;

  return (
    <div ref={cajaRef} style={{ height: alto }} className="flex flex-col">
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] flex-1 min-h-0">

        {/* ── 1. LOS ÁMBITOS ──────────────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 gap-2">
          <button type="button" className={BTN_PRIMARY} style={mf}
            onClick={() => { setEditando('nuevo'); setNombre(''); }}>
            <Plus className="w-4 h-4" /> Nueva solución
          </button>
          <div className="flex-1 min-h-0">
            <FilterRail
              title="Soluciones"
              value={String(elegido ?? '')}
              onChange={(v) => setElegido(Number(v))}
              wrapLabels
              items={soluciones.map((a) => ({
                value: String(a.id),
                label: a.nombre,
                Icon: Layers,
                count: a.talentos.length,
                hint: `/soluciones#${a.slug}`,
              }))}
            />
          </div>
        </div>

        {/* ── 2. LOS TALENTOS DEL ÁMBITO, CON SU RESPALDO ─────────────────────── */}
        <div className="flex flex-col min-h-0">
          {solucion ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[15px] font-semibold text-digi-text flex-1 truncate" style={mf}>
                  {solucion.nombre}
                </p>
                <button type="button" className={BTN_SECONDARY} style={mf}
                  onClick={() => mover(-1)} title="Subir" aria-label="Subir la solución">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button type="button" className={BTN_SECONDARY} style={mf}
                  onClick={() => mover(1)} title="Bajar" aria-label="Bajar la solución">
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button type="button" className={BTN_SECONDARY} style={mf}
                  onClick={() => { setEditando(solucion); setNombre(solucion.nombre); }}
                  title="Renombrar" aria-label="Renombrar la solución">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" className={BTN_SECONDARY} style={mf}
                  onClick={() => setPorBorrar(solucion)} title="Eliminar" aria-label="Eliminar la solución">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* El aviso solo aparece si hay algo que avisar. Una caja permanente que casi
                  siempre dice «todo bien» se deja de leer. */}
              {sinRespaldo > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p className="text-[12.5px] leading-relaxed text-digi-text" style={mf}>
                    {sinRespaldo === 1
                      ? 'Un talento no tiene ningún proyecto ni ticket terminado.'
                      : `${sinRespaldo} talentos no tienen ningún proyecto ni ticket terminado.`}{' '}
                    En la web su carpeta se abrirá vacía.
                  </p>
                </div>
              )}

              <PixelDataTable<FilaTalento>
                data={filas}
                emptyTitle={cargando ? 'Cargando…' : 'Sin talentos'}
                emptyDesc={cargando ? '' : 'Añade talentos desde el catálogo de la derecha.'}
                singleLine
                columns={[
                  { key: 'talento', header: 'Talento', render: (f: FilaTalento) => (
                    <span className="text-digi-text">{f.talento}</span>
                  ) },
                  // La descripción se enseña aquí, cortada: sin una señal de que falta,
                  // un talento sin describir se publica y nadie se entera.
                  { key: 'descripcion', header: 'Descripción', render: (f: FilaTalento) => (
                    f.descripcion
                      ? <span className="text-digi-muted">{f.descripcion}</span>
                      : <span className="text-amber-400">Sin descripción</span>
                  ) },
                  { key: 'editar', header: '', width: '44px', render: (f: FilaTalento) => (
                    <button type="button" aria-label={`Editar la descripción de ${f.talento}`}
                      title="Editar la descripción"
                      className="w-7 h-7 inline-flex items-center justify-center rounded text-digi-muted hover:text-digi-text hover:bg-digi-darker transition-colors"
                      onClick={() => { setTalentoEnEdicion({ talento: f.talento, nuevo: false }); setDescripcion(f.descripcion ?? ''); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  ) },
                  { key: 'proyectos', header: 'Proyectos', width: '100px', render: (f: FilaTalento) => (
                    <span className={f.proyectos ? 'text-digi-text' : 'text-digi-muted'}>{f.proyectos}</span>
                  ) },
                  { key: 'tickets', header: 'Tickets', width: '90px', render: (f: FilaTalento) => (
                    <span className={f.tickets ? 'text-digi-text' : 'text-digi-muted'}>{f.tickets}</span>
                  ) },
                  { key: 'quitar', header: '', width: '44px', render: (f: FilaTalento) => (
                    <button type="button" aria-label={`Quitar ${f.talento}`} title="Quitar de la solución"
                      className="w-7 h-7 inline-flex items-center justify-center rounded text-digi-muted hover:text-digi-text hover:bg-digi-darker transition-colors"
                      onClick={() => guardarTalentos(solucion.id, solucion.talentos.filter((t) => t.talento !== f.talento))}>
                      <X className="w-4 h-4" />
                    </button>
                  ) },
                ]}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-digi-muted" style={mf}>
                {cargando ? 'Cargando…' : 'Crea el primer solución para empezar.'}
              </p>
            </div>
          )}
        </div>

        {/* ── 3. EL CATÁLOGO DE TALENTOS ──────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 rounded-lg border border-digi-border bg-digi-card p-4">
          <p className="text-[13px] font-semibold text-digi-text mb-2" style={mf}>Añadir talentos</p>
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el catálogo"
              className={`${CAMPO} pl-9`}
              style={mf}
              disabled={!solucion}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {!solucion ? (
              <p className="text-[12.5px] text-digi-muted" style={mf}>Elige una solución.</p>
            ) : catalogo.length === 0 ? (
              <p className="text-[12.5px] text-digi-muted" style={mf}>
                {busqueda ? 'Sin coincidencias.' : 'Todos los talentos ya están en esta solución.'}
              </p>
            ) : (
              catalogo.map((g) => (
                <div key={g.category} className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-digi-muted mb-1.5" style={mf}>
                    {g.category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => { setTalentoEnEdicion({ talento: t, nuevo: true }); setDescripcion(''); }}
                        className="px-2 py-1 rounded border border-digi-border text-[12px] text-digi-text
                                   hover:border-accent hover:bg-accent-light/10 transition-colors"
                        style={mf}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Crear / renombrar: panel lateral derecho, que es el estándar del proyecto para
          formularios (nada de edición inline). */}
      {editando && (
        <EditPanel
          open
          title={editando === 'nuevo' ? 'Nueva solución' : 'Renombrar solución'}
          onClose={() => setEditando(null)}
          onSave={guardarNombre}
          saving={guardando}
        >
          <EditField label="Nombre">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') guardarNombre(); }}
              placeholder="Tecnología"
              className={CAMPO}
              style={mf}
            />
          </EditField>
          {editando !== 'nuevo' && (
            <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
              La dirección de la solución en la web —<code>/soluciones#{editando.slug}</code>— <strong>no
              cambia</strong> al renombrarlo: es un enlace que puede estar ya compartido.
            </p>
          )}
        </EditPanel>
      )}

      {/* Asociar un talento (o corregir su descripción). La descripción se pide AQUÍ, al
          asociar, que es lo que pidió Fernando: «uno de los campos a llenar al asociar un
          talento a una solución». Puede quedar vacía — entonces la web no pinta el párrafo. */}
      {talentoEnEdicion && solucion && (
        <EditPanel
          open
          title={talentoEnEdicion.nuevo ? 'Asociar talento' : 'Descripción del talento'}
          onClose={() => setTalentoEnEdicion(null)}
          saving={guardando}
          onSave={async () => {
            setGuardando(true);
            try {
              const texto = descripcion.trim() || null;
              const yaEsta = solucion.talentos.some((t) => t.talento === talentoEnEdicion.talento);
              const lista = yaEsta
                ? solucion.talentos.map((t) =>
                    t.talento === talentoEnEdicion.talento ? { ...t, descripcion: texto } : t)
                // El `slug` lo calcula el servidor al guardar (`fijarTalentos`): es una URL
                // y no algo que deba inventar la pantalla. Aquí va vacío a propósito.
                : [...solucion.talentos, { talento: talentoEnEdicion.talento, descripcion: texto, slug: '' }];
              await guardarTalentos(solucion.id, lista);
              setTalentoEnEdicion(null);
              toast.success(talentoEnEdicion.nuevo ? 'Talento asociado' : 'Descripción guardada');
            } finally {
              setGuardando(false);
            }
          }}
        >
          <EditField label="Talento">
            <p className="text-[13px] text-digi-text px-3 py-2 rounded bg-digi-darker border border-digi-border" style={mf}>
              {talentoEnEdicion.talento}
            </p>
          </EditField>
          <EditField label="Descripción">
            <textarea
              autoFocus
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={5}
              placeholder={`Cómo se ejerce «${talentoEnEdicion.talento}» dentro de ${solucion.nombre}…`}
              className={`${CAMPO} resize-none`}
              style={mf}
            />
          </EditField>
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Se publica en <code>/soluciones</code>, bajo el título del talento. Si la dejas vacía,
            la web no pinta el párrafo — ni recuadro ni «próximamente».
          </p>
        </EditPanel>
      )}

      {porBorrar && (
        <PixelConfirm
          open
          danger
          title="Eliminar solución"
          message={`Se eliminará «${porBorrar.nombre}» y sus ${porBorrar.talentos.length} talento(s) asociados. Los proyectos y tickets NO se tocan: la relación se calcula, no se guarda.`}
          confirmLabel="Eliminar"
          onConfirm={() => borrar(porBorrar)}
          onCancel={() => setPorBorrar(null)}
        />
      )}
    </div>
  );
}
