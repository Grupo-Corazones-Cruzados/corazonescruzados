'use client';

/**
 * PESTAÑA «SOLUCIONES» DEL ADMIN — los tipos de proyecto que el grupo maneja.
 *
 * Se publican en `/soluciones`, donde el visitante ve cada solución como una carpeta, la
 * despliega y elige un talento para ver el trabajo hecho con él.
 *
 * ── DOS PANELES, Y UN TERCERO QUE SE ABRE CUANDO HACE FALTA (2026-08-21) ───────
 *   ┌────────────┬───────────────────────────────────────────┐
 *   │ Las        │ Los talentos de la solución, con su       │   ← al pulsar una fila,
 *   │ soluciones │ respaldo real y cuántos conceptos tienen  │     panel ANCHO por la derecha
 *   └────────────┴───────────────────────────────────────────┘
 *
 * Era un explorador de TRES columnas fijas: soluciones · talentos/conceptos · catálogo de
 * talentos. Fernando lo cambió el 2026-08-21 y tenía razón en las tres cosas que dijo:
 *
 *  1. **Fuera la tercera columna.** El catálogo solo servía para añadir talentos, así que
 *     se pasaba el día ocupando 320px para nada —y en la cara de «Conceptos» se escondía
 *     entero, dejando el hueco vacío que él señaló—. Ahora es un panel que se abre desde el
 *     botón «Añadir talentos» y se va cuando termina su trabajo.
 *  2. **Fuera el conmutador Talentos/Conceptos.** Los conceptos dejaron de ser de la
 *     solución para ser **del talento** (migración 051), así que ya no son una segunda cara
 *     de la misma columna: son el contenido del talento, y viven dentro de su panel.
 *  3. **Cada tabla decide su alto de fila por lo que sirve.** La de talentos va a **una
 *     línea** (`singleLine`, con «…» si no cabe): es una tabla para ENCONTRAR un talento, y
 *     su descripción son párrafos que se leen dentro de su panel. La de conceptos, dentro
 *     de ese panel, va **entera**: ahí la frase corta ES el contenido.
 *
 * Sigue siendo el patrón **«Explorador Azure»** documentado en `Diseño.md` —`FilterRail` +
 * `PixelDataTable`—, en su variante de dos columnas. **No se ha escrito ningún control
 * nuevo «parecido»**: el rail es `FilterRail`, las tablas `PixelDataTable`, la lista de
 * talentos `ListaMarcable` (que comparte la fila con `MultiSelectSearch`) y toda edición va
 * en `EditPanel` / `WideEditPanel`, que es lo que manda el sistema.
 *
 * ── ⭐ POR QUÉ LA TABLA ENSEÑA CUÁNTO RESPALDA A CADA TALENTO ──────────────────
 * Porque es lo único que evita publicar una carpeta vacía. Una solución se monta eligiendo
 * talentos del catálogo del grupo —que tiene cientos, incluidos «Jugar fútbol» o
 * «Repostería»—, y nada impide asociar uno con el que jamás se ha hecho un proyecto. En la
 * web eso es un visitante que despliega una carpeta y no encuentra nada.
 *
 * Las columnas «Proyectos» y «Tickets» cuentan **solo lo terminado**, que es lo único que
 * se publica (decisión de Fernando, 2026-08-18). Un 0 no impide guardar: avisa.
 *
 * ── ⚠️ QUITAR UN TALENTO SE LLEVA SUS CONCEPTOS ───────────────────────────────
 * Cuelgan de él con `ON DELETE CASCADE` (migración 051). Por eso quitarlo pide confirmación
 * diciendo **cuántos** se van, en vez de borrarlos por sorpresa.
 *
 * ── LO QUE SE ESCRIBE AQUÍ SALE PUBLICADO ──────────────────────────────────────
 * No es una tabla interna. Un error de ortografía en el nombre de una solución es un error
 * de ortografía publicado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, ArrowUp, ArrowDown, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import FilterRail from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { EditPanel, WideEditPanel, EditField } from '@/components/ui/EditDialog';
import ListaMarcable, { type OpcionMarcable } from '@/components/ui/ListaMarcable';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TALENTOS } from '@/lib/centralized/talentos';
import { ICONOS } from '@/components/sitio/piezas';
import GaleriaIconos from './GaleriaIconos';
import type { Solucion, CoberturaTalento, TalentoDeSolucion, Concepto } from '@/lib/soluciones';

const mf = { fontFamily: 'var(--font-body)' } as const;
const CAMPO =
  'field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] ' +
  'text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none transition-colors';

/** Una fila de la tabla central: el talento, su descripción y lo que lo respalda. */
interface FilaTalento {
  talento: string;
  slug: string;
  descripcion: string | null;
  conceptos: number;
  proyectos: number;
  tickets: number;
}

export default function SolucionesPanel() {
  const [soluciones, setSoluciones] = useState<Solucion[]>([]);
  const [cobertura, setCobertura] = useState<Record<string, CoberturaTalento>>({});
  // Talento → nombre de la solución que ya lo tiene. Un talento pertenece a UNO solo.
  const [ocupados, setOcupados] = useState<Record<string, string>>({});
  /** Los conceptos de TODOS los talentos, tal como los devuelve la API en una sola consulta. */
  const [conceptos, setConceptos] = useState<Record<string, Concepto[]>>({});
  const [elegido, setElegido] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [editando, setEditando] = useState<Solucion | 'nuevo' | null>(null);
  const [nombre, setNombre] = useState('');
  const [porBorrar, setPorBorrar] = useState<Solucion | null>(null);

  /* ── El panel de elegir talentos ──────────────────────────────────────────── */
  const [eligiendoTalentos, setEligiendoTalentos] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  /** Lo que se va a guardar, en espera de que se confirme la pérdida de conceptos. */
  const [porConfirmarQuitar, setPorConfirmarQuitar] =
    useState<{ lista: TalentoDeSolucion[]; quitados: string[]; conceptos: number } | null>(null);

  /* ── El panel ANCHO de un talento: su descripción y sus conceptos ─────────── */
  const [talentoAbierto, setTalentoAbierto] = useState<FilaTalento | null>(null);
  const [descripcion, setDescripcion] = useState('');

  const [conceptoEnEdicion, setConceptoEnEdicion] = useState<Concepto | 'nuevo' | null>(null);
  const [cTitulo, setCTitulo] = useState('');
  const [cIcono, setCIcono] = useState('capas');
  const [cDescripcion, setCDescripcion] = useState('');
  const [conceptoPorBorrar, setConceptoPorBorrar] = useState<Concepto | null>(null);

  // Mide el hueco hasta la barra de ruta fija del pie, igual que las otras pestañas del
  // admin. Sin esto, los paneles se salen por debajo y sus últimas filas quedan tapadas.
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
      if (!r.ok) { toast.error(j.error || 'No se pudieron cargar las soluciones'); return; }
      const lista: Solucion[] = j.data ?? [];
      setSoluciones(lista);
      setCobertura(Object.fromEntries((j.cobertura ?? []).map((c: CoberturaTalento) => [c.talento, c])));
      setOcupados(j.ocupados ?? {});
      setConceptos(j.conceptos ?? {});
      // Se elige la primera solo si no había nada elegido, para no saltar de solución
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
      slug: t.slug,
      descripcion: t.descripcion,
      conceptos: conceptos[t.talento]?.length ?? 0,
      proyectos: cobertura[t.talento]?.proyectos ?? 0,
      tickets: cobertura[t.talento]?.tickets ?? 0,
    })),
    [solucion, cobertura, conceptos],
  );

  const sinRespaldo = filas.filter((f) => f.proyectos === 0 && f.tickets === 0).length;

  /* ── Guardar la lista de talentos ───────────────────────────────────────────
     Siempre se manda la lista COMPLETA: la pantalla edita el estado final. El servidor
     guarda por diferencias, así que los talentos que siguen conservan sus conceptos. */
  async function guardarTalentos(id: number, talentos: TalentoDeSolucion[]): Promise<boolean> {
    const r = await fetch(`/api/admin/soluciones/${id}/talentos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ talentos }),
    });
    if (!r.ok) {
      // La API explica el choque con «un talento, una solución» nombrando a la solución que
      // lo tiene. Tragarse ese texto y poner uno genérico sería desperdiciarlo.
      const j = await r.json().catch(() => ({}));
      toast.error(j.error || 'No se pudieron guardar los talentos');
      return false;
    }
    await cargar();
    return true;
  }

  /* ── El catálogo del panel de talentos ──────────────────────────────────────
     Una sola columna, alfabético ascendente (Fernando, 2026-08-21). Se esconden los que ya
     tiene OTRA solución: un talento pertenece a una sola (migración 042), y ofrecer uno que
     la base va a rechazar es prometer lo imposible. */
  const opciones: OpcionMarcable[] = useMemo(() => {
    const mios = new Set((solucion?.talentos ?? []).map((t) => t.talento));
    return TALENTOS
      .filter((t) => mios.has(t) || !ocupados[t])
      .map((t) => {
        const c = cobertura[t];
        const respaldo = (c?.proyectos ?? 0) + (c?.tickets ?? 0);
        return {
          valor: t,
          etiqueta: t,
          // Lo que respalda al talento se enseña AQUÍ, al elegirlo, que es cuando decide algo:
          // asociar uno sin nada detrás es publicar una carpeta vacía.
          nota: mios.has(t) && respaldo > 0 ? `${respaldo} trabajos` : undefined,
        };
      });
  }, [solucion, ocupados, cobertura]);

  function abrirPanelTalentos() {
    setSeleccion((solucion?.talentos ?? []).map((t) => t.talento));
    setEligiendoTalentos(true);
  }

  /** Convierte la selección del panel en la lista a guardar, conservando descripciones. */
  function listaDesdeSeleccion(): TalentoDeSolucion[] {
    const previos = solucion?.talentos ?? [];
    const enSeleccion = new Set(seleccion);
    // Los que ya estaban conservan su orden y su descripción; los nuevos se añaden al final
    // en orden alfabético, que es como se acaban de ver en la lista.
    const siguen = previos.filter((t) => enSeleccion.has(t.talento));
    const nuevos = seleccion
      .filter((t) => !previos.some((p) => p.talento === t))
      .sort((a, b) => a.localeCompare(b, 'es-ES', { sensitivity: 'base' }))
      .map((t) => ({ talento: t, descripcion: null, slug: '' } as TalentoDeSolucion));
    return [...siguen, ...nuevos];
  }

  async function guardarSeleccionTalentos() {
    if (!solucion) return;
    const lista = listaDesdeSeleccion();
    const quitados = solucion.talentos
      .filter((t) => !lista.some((x) => x.talento === t.talento))
      .map((t) => t.talento);
    const cuantosConceptos = quitados.reduce((n, t) => n + (conceptos[t]?.length ?? 0), 0);

    // Quitar un talento se lleva sus conceptos por cascada. Si hay alguno, se avisa ANTES.
    if (cuantosConceptos > 0) {
      setPorConfirmarQuitar({ lista, quitados, conceptos: cuantosConceptos });
      return;
    }
    setGuardando(true);
    try {
      if (await guardarTalentos(solucion.id, lista)) {
        setEligiendoTalentos(false);
        toast.success('Talentos guardados');
      }
    } finally {
      setGuardando(false);
    }
  }

  /* ── Los conceptos del talento abierto ─────────────────────────────────────── */
  const conceptosAbiertos = talentoAbierto ? conceptos[talentoAbierto.talento] ?? [] : [];

  /** Recarga solo los conceptos del talento abierto: es una consulta, no la pantalla entera. */
  const recargarConceptos = useCallback(async (slug: string, talento: string) => {
    const r = await fetch(`/api/admin/talentos/${slug}/conceptos`);
    if (!r.ok) return;
    const j = await r.json();
    setConceptos((prev) => ({ ...prev, [talento]: j.data ?? [] }));
  }, []);

  async function guardarConcepto() {
    if (!cTitulo.trim()) { toast.error('El título es obligatorio'); return; }
    if (!talentoAbierto) return;
    setGuardando(true);
    try {
      const esNuevo = conceptoEnEdicion === 'nuevo';
      const cuerpo = JSON.stringify({
        titulo: cTitulo.trim(), icono: cIcono, descripcion: cDescripcion.trim() || null,
      });
      const r = await fetch(
        esNuevo
          ? `/api/admin/talentos/${talentoAbierto.slug}/conceptos`
          : `/api/admin/conceptos/${(conceptoEnEdicion as Concepto).id}`,
        { method: esNuevo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: cuerpo },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'No se pudo guardar'); return; }
      setConceptoEnEdicion(null);
      await recargarConceptos(talentoAbierto.slug, talentoAbierto.talento);
      toast.success(esNuevo ? 'Concepto creado' : 'Concepto actualizado');
    } finally {
      setGuardando(false);
    }
  }

  async function borrarConceptoConfirmado(c: Concepto) {
    const r = await fetch(`/api/admin/conceptos/${c.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('No se pudo eliminar'); return; }
    setConceptoPorBorrar(null);
    if (talentoAbierto) await recargarConceptos(talentoAbierto.slug, talentoAbierto.talento);
    toast.success('Concepto eliminado');
  }

  async function moverConcepto(c: Concepto, dir: -1 | 1) {
    if (!talentoAbierto) return;
    const orden = [...conceptosAbiertos];
    const i = orden.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    // Se pinta ya, sin esperar al servidor: en la web el orden es el de la tira, así que
    // moverlo y que tarde medio segundo hace dudar de si se pulsó bien.
    setConceptos((prev) => ({ ...prev, [talentoAbierto.talento]: orden }));
    const r = await fetch('/api/admin/conceptos/reordenar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: orden.map((x) => x.id) }),
    });
    if (!r.ok) {
      toast.error('No se pudo reordenar');
      await recargarConceptos(talentoAbierto.slug, talentoAbierto.talento);
    }
  }

  /* ── La solución: crear, renombrar, mover, borrar ──────────────────────────── */
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

  /** Quitar un talento de la solución (con aviso si se lleva conceptos por delante). */
  function quitarTalento(f: FilaTalento) {
    if (!solucion) return;
    const lista = solucion.talentos.filter((t) => t.talento !== f.talento);
    if (f.conceptos > 0) {
      setPorConfirmarQuitar({ lista, quitados: [f.talento], conceptos: f.conceptos });
      return;
    }
    guardarTalentos(solucion.id, lista);
  }

  const iconoBoton =
    'w-7 h-7 inline-flex items-center justify-center rounded text-digi-muted ' +
    'hover:text-digi-text hover:bg-digi-darker transition-colors';

  return (
    <div ref={cajaRef} style={{ height: alto }} className="flex flex-col">
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] flex-1 min-h-0">

        {/* ── 1. LAS SOLUCIONES ───────────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0 gap-2">
          <button type="button" className={BTN_PRIMARY} style={mf}
            onClick={() => { setEditando('nuevo'); setNombre(''); }}>
            <Plus className="w-4 h-4" /> Nueva solución
          </button>
          <div className="flex-1 min-h-0">
            <FilterRail
              title="Soluciones"
              /* El rail trae 220px por defecto y la columna mide 240: la tarjeta salía más
                 estrecha que el botón «Nueva solución» de encima (Fernando, 2026-08-23). Con
                 `lg:w-full` ocupa su columna, que es para lo que el componente admite
                 `className` — no se toca su ancho por defecto, que rige en las otras once
                 pantallas. */
              className="lg:w-full"
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

        {/* ── 2. LOS TALENTOS DE LA SOLUCIÓN ──────────────────────────────────── */}
        <div className="flex flex-col min-h-0">
          {solucion ? (
            <>
              {/* Acciones de la solución. Las secundarias (mover, renombrar, eliminar) a la
                  izquierda y la primaria a la derecha, que es el orden del sistema. */}
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
                <button type="button" className={BTN_PRIMARY} style={mf}
                  onClick={abrirPanelTalentos}
                  title="Elegir los talentos de esta solución">
                  <Plus className="w-4 h-4" /> Añadir talentos
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
                emptyDesc={cargando ? '' : 'Pulsa «Añadir talentos» para elegirlos del catálogo.'}
                /* La fila entera abre el panel del talento: allí se escribe su descripción y
                   se gestionan sus conceptos (Fernando, 2026-08-21). */
                onRowClick={(f) => { setTalentoAbierto(f); setDescripcion(f.descripcion ?? ''); }}
                /* UNA línea por fila (Fernando, 2026-08-22): la descripción de un talento son
                   párrafos, y desplegada entera hacía filas de seis líneas para una tabla que
                   sirve para ENCONTRAR el talento, no para leerlo — se lee en su panel. Lo que
                   no cabe termina en «…». La de conceptos NO lleva esto: allí la frase es corta
                   y es el contenido. */
                singleLine
                columns={[
                  { key: 'talento', header: 'Talento', width: '260px', render: (f: FilaTalento) => (
                    <span className="text-digi-text font-medium">{f.talento}</span>
                  ) },
                  // Sin una señal de que falta, un talento sin describir se publica y nadie
                  // se entera; por eso el hueco vacío se dice con palabras, en ámbar.
                  { key: 'descripcion', header: 'Descripción', render: (f: FilaTalento) => (
                    f.descripcion
                      ? <span className="text-digi-muted">{f.descripcion}</span>
                      : <span className="text-amber-400">Sin descripción</span>
                  ) },
                  { key: 'conceptos', header: 'Conceptos', width: '110px', render: (f: FilaTalento) => (
                    f.conceptos
                      ? <span className="text-digi-text tabular-nums">{f.conceptos}</span>
                      : <span className="text-digi-muted tabular-nums">0</span>
                  ) },
                  { key: 'proyectos', header: 'Proyectos', width: '100px', render: (f: FilaTalento) => (
                    <span className={`tabular-nums ${f.proyectos ? 'text-digi-text' : 'text-digi-muted'}`}>{f.proyectos}</span>
                  ) },
                  { key: 'tickets', header: 'Tickets', width: '90px', render: (f: FilaTalento) => (
                    <span className={`tabular-nums ${f.tickets ? 'text-digi-text' : 'text-digi-muted'}`}>{f.tickets}</span>
                  ) },
                  { key: 'quitar', header: '', width: '48px', render: (f: FilaTalento) => (
                    <button type="button" aria-label={`Quitar ${f.talento}`} title="Quitar de la solución"
                      className={iconoBoton}
                      onClick={(e) => { e.stopPropagation(); quitarTalento(f); }}>
                      <X className="w-4 h-4" />
                    </button>
                  ) },
                ]}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[13px] text-digi-muted" style={mf}>
                {cargando ? 'Cargando…' : 'Crea la primera solución para empezar.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── EL PANEL DE UN TALENTO: descripción + sus conceptos ──────────────────
          Ancho de verdad (1040px) porque lleva DENTRO una tabla: con los 644px del panel
          estándar volvería el corte de texto que Fernando quiso quitar. */}
      {talentoAbierto && solucion && (
        <WideEditPanel
          open
          title={talentoAbierto.talento}
          onClose={() => setTalentoAbierto(null)}
          saving={guardando}
          saveLabel="Guardar descripción"
          onSave={async () => {
            setGuardando(true);
            try {
              const texto = descripcion.trim() || null;
              const lista = solucion.talentos.map((t) =>
                t.talento === talentoAbierto.talento ? { ...t, descripcion: texto } : t);
              if (await guardarTalentos(solucion.id, lista)) {
                setTalentoAbierto(null);
                toast.success('Descripción guardada');
              }
            } finally {
              setGuardando(false);
            }
          }}
        >
          <EditField label="Descripción">
            <textarea
              autoFocus
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder={`Cómo se ejerce «${talentoAbierto.talento}» dentro de ${solucion.nombre}…`}
              /* `resize-y` y no `resize-none`: esta descripción son párrafos, y con alto fijo
                 el texto se lee por una rendija. Se estira si hace falta. */
              className={`${CAMPO} resize-y`}
              style={mf}
            />
          </EditField>
          {/* ── SUS CONCEPTOS ─────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 pt-2">
            <p className="text-[13px] font-semibold text-digi-text flex-1" style={mf}>
              Conceptos
              <span className="ml-1.5 text-[11.5px] text-digi-muted tabular-nums">{conceptosAbiertos.length}</span>
            </p>
            <button type="button" className={BTN_PRIMARY} style={mf}
              onClick={() => { setConceptoEnEdicion('nuevo'); setCTitulo(''); setCIcono('capas'); setCDescripcion(''); }}>
              <Plus className="w-4 h-4" /> Nuevo concepto
            </button>
          </div>

          <PixelDataTable<Concepto>
            data={conceptosAbiertos}
            emptyTitle="Sin conceptos"
            emptyDesc="Añade el primero: en la web se pintan como una tira vertical junto a este talento. Sin ninguno, la tira no aparece."
            /* Deja sitio al pie del panel (Cancelar / Guardar): la tabla se estira hasta el
               borde de la ventana y, sin reservarlo, el pie quedaría por debajo. */
            bottomReserve={72}
            columns={[
              { key: 'icono', header: '', width: '44px', render: (c: Concepto) => {
                const Icono = ICONOS[c.icono] ?? Layers;
                return (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded border border-digi-border text-accent" title={c.icono}>
                    <Icono className="w-4 h-4" />
                  </span>
                );
              } },
              { key: 'titulo', header: 'Concepto', width: '230px', render: (c: Concepto) => (
                <span className="text-digi-text">{c.titulo}</span>
              ) },
              { key: 'descripcion', header: 'Descripción', render: (c: Concepto) => (
                c.descripcion
                  ? <span className="text-digi-muted">{c.descripcion}</span>
                  : <span className="text-amber-400">Sin descripción</span>
              ) },
              { key: 'acciones', header: '', width: '128px', render: (c: Concepto) => (
                <span className="inline-flex gap-0.5">
                  <button type="button" aria-label={`Subir ${c.titulo}`} title="Subir"
                    className={iconoBoton} onClick={() => moverConcepto(c, -1)}>
                    <ArrowUp className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label={`Bajar ${c.titulo}`} title="Bajar"
                    className={iconoBoton} onClick={() => moverConcepto(c, 1)}>
                    <ArrowDown className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label={`Editar ${c.titulo}`} title="Editar"
                    className={iconoBoton}
                    onClick={() => { setConceptoEnEdicion(c); setCTitulo(c.titulo); setCIcono(c.icono); setCDescripcion(c.descripcion ?? ''); }}>
                    <Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" aria-label={`Eliminar ${c.titulo}`} title="Eliminar"
                    className={iconoBoton} onClick={() => setConceptoPorBorrar(c)}>
                    <Trash2 className="w-3.5 h-3.5" /></button>
                </span>
              ) },
            ]}
          />
        </WideEditPanel>
      )}

      {/* ── ELEGIR LOS TALENTOS DE LA SOLUCIÓN ───────────────────────────────────
          Una sola columna y alfabético ascendente, como lo pidió Fernando. La lista es
          `ListaMarcable`, la misma casilla que usa el selector con desplegable. */}
      {eligiendoTalentos && solucion && (
        <EditPanel
          open
          title={`Talentos de ${solucion.nombre}`}
          onClose={() => setEligiendoTalentos(false)}
          onSave={guardarSeleccionTalentos}
          saving={guardando}
          saveLabel="Guardar"
        >
          {/* Cuántos lleva elegidos: la lista va en alfabético (lo pidió así), de modo que
              los elegidos quedan repartidos entre 500 filas y sin esto no se sabe cuántos son. */}
          <p className="text-[12px] text-digi-muted -mb-1" style={mf}>
            {seleccion.length === 0
              ? 'Ningún talento elegido.'
              : `${seleccion.length} talento${seleccion.length === 1 ? '' : 's'} elegido${seleccion.length === 1 ? '' : 's'}.`}
          </p>
          <div className="flex flex-col min-h-0" style={{ height: 'calc(100vh - 258px)' }}>
            <ListaMarcable
              opciones={opciones}
              elegidas={seleccion}
              onChange={setSeleccion}
              placeholder="Buscar en el catálogo"
              vacio="Sin coincidencias."
            />
          </div>
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Los talentos que ya pertenecen a otra solución no aparecen: un talento solo puede
            estar en una. La descripción de cada uno se escribe al abrir su fila.
          </p>
        </EditPanel>
      )}

      {/* Crear / renombrar la solución: panel lateral derecho, que es el estándar del
          proyecto para formularios (nada de edición inline). */}
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
              cambia</strong> al renombrarla: es un enlace que puede estar ya compartido.
            </p>
          )}
        </EditPanel>
      )}

      {/* Crear o editar un concepto. Se abre ENCIMA del panel del talento —dos `<dialog>`
          apilados, que el navegador maneja en su capa superior—. La galería de iconos vive
          aquí porque el icono se elige VIÉNDOLO: escribir «base-datos» a ciegas es pedir un
          error de dedo que acaba publicado con el icono por defecto. */}
      {conceptoEnEdicion && talentoAbierto && (
        <EditPanel
          open
          title={conceptoEnEdicion === 'nuevo' ? 'Nuevo concepto' : 'Editar concepto'}
          onClose={() => setConceptoEnEdicion(null)}
          onSave={guardarConcepto}
          saving={guardando}
        >
          <EditField label="Título">
            <input
              autoFocus
              value={cTitulo}
              onChange={(e) => setCTitulo(e.target.value)}
              placeholder="Robots Automatizados"
              className={CAMPO}
              style={mf}
            />
          </EditField>
          <EditField label="Icono">
            <GaleriaIconos valor={cIcono} onChange={setCIcono} />
          </EditField>
          <EditField label="Descripción">
            <textarea
              value={cDescripcion}
              onChange={(e) => setCDescripcion(e.target.value)}
              rows={4}
              placeholder="Una frase. En la tira se lee de un vistazo, así que un párrafo largo no se lee."
              className={`${CAMPO} resize-none`}
              style={mf}
            />
          </EditField>
        </EditPanel>
      )}

      {conceptoPorBorrar && (
        <PixelConfirm
          open
          danger
          title="Eliminar concepto"
          message={`Se eliminará «${conceptoPorBorrar.titulo}» de la tira de este talento.`}
          confirmLabel="Eliminar"
          onConfirm={() => borrarConceptoConfirmado(conceptoPorBorrar)}
          onCancel={() => setConceptoPorBorrar(null)}
        />
      )}

      {/* Quitar un talento que tiene conceptos: se van con él (cascada de la migración 051),
          así que se dice cuántos ANTES, no después. */}
      {porConfirmarQuitar && solucion && (
        <PixelConfirm
          open
          danger
          title={porConfirmarQuitar.quitados.length === 1 ? 'Quitar el talento' : 'Quitar talentos'}
          message={
            `Se quitará${porConfirmarQuitar.quitados.length === 1 ? '' : 'n'} ` +
            `${porConfirmarQuitar.quitados.map((t) => `«${t}»`).join(', ')} de esta solución y se ` +
            `eliminará${porConfirmarQuitar.conceptos === 1 ? '' : 'n'} sus ${porConfirmarQuitar.conceptos} ` +
            `concepto${porConfirmarQuitar.conceptos === 1 ? '' : 's'}. Los proyectos y tickets NO se tocan.`
          }
          confirmLabel="Quitar"
          onConfirm={async () => {
            const { lista } = porConfirmarQuitar;
            setPorConfirmarQuitar(null);
            setGuardando(true);
            try {
              if (await guardarTalentos(solucion.id, lista)) {
                setEligiendoTalentos(false);
                setTalentoAbierto(null);
                toast.success('Talentos guardados');
              }
            } finally {
              setGuardando(false);
            }
          }}
          onCancel={() => setPorConfirmarQuitar(null)}
        />
      )}

      {porBorrar && (
        <PixelConfirm
          open
          danger
          title="Eliminar solución"
          message={`Se eliminará «${porBorrar.nombre}», sus ${porBorrar.talentos.length} talento(s) y los conceptos de cada uno. Los proyectos y tickets NO se tocan: la relación se calcula, no se guarda.`}
          confirmLabel="Eliminar"
          onConfirm={() => borrar(porBorrar)}
          onCancel={() => setPorBorrar(null)}
        />
      )}
    </div>
  );
}
