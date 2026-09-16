'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Settings,
  FileDown,
  FileType,
  Sparkles,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  Link2,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  ListChecks,
  Plus as PlusIcon,
  ImageOff,
  Info,
} from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Selector, Buscador, Tarjeta, Insignia, PanelLateral, Confirmar, EstadoVacio, type Tono } from '@/componentes/ui';
import { Aviso, Chips } from '@/componentes/campos';
import { Dictado } from '@/componentes/Dictado';
import { Adjuntos, type AdjuntoSubido } from '@/componentes/Adjuntos';
import { crearPlanificacion, configurarPlanificacion, eliminarPlanificacion, crearSemana, regenerarSemana, editarSemana, eliminarSemana } from '@/acciones/planificaciones';
import { crearDestreza, editarDestreza, eliminarDestreza } from '@/acciones/destrezas';
import { parsearEstrategias, lineas } from '@/plantillas/pud/estrategias';
import { NIVELES, ETIQUETA_NIVEL, ETIQUETA_ESTADO_SEMANA } from '@/lib/catalogo';
import { diaDeMes, fechaCorta, sumarDias } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import type { Nivel, EstadoSemana } from '@/generated/prisma/enums';

export type PlanificacionVista = {
  id: number;
  plantilla: string;
  nivel: Nivel;
  materia: string;
  ambito: string;
  numeroUnidad: number;
  tituloUnidad: string;
  inicioPud: string;
  finPud: string;
  gradoCurso: string | null;
  paralelo: string | null;
  jornada: string | null;
  objetivosUnidad: string | null;
  criteriosEvaluacion: string | null;
  elaboradoPor: string | null;
  revisadoPor: string | null;
  revisadoCargo: string | null;
  aprobadoPor: string | null;
  aprobadoCargo: string | null;
  registroTitulo: string | null;
  registroElaboradoCargo: string | null;
  registroElaboradoNombre: string | null;
  registroElaboradoFecha: string | null;
  registroAprobadoCargo: string | null;
  registroAprobadoNombre: string | null;
  registroAprobadoFecha: string | null;
  deceNombre: string | null;
  docente: string;
  usuarioId: number;
  semanas: number;
  actualizado: string;
  puedoCambiar: boolean;
};

export type DestrezaVista = { id: number; codigo: string; descripcion: string; imagenUrl: string | null; materia?: string };

export type SemanaVista = {
  id: number;
  orden: number;
  estado: EstadoSemana;
  error: string | null;
  indicaciones: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  tema: string | null;
  numeroPeriodos: string | null;
  objetivosTema: string | null;
  estrategias: string | null;
  recursos: string | null;
  tecnica: string | null;
  instrumento: string | null;
  referencias: { titulo: string; url: string; uso: string }[];
  uso: Record<string, number> | null;
  destrezas: DestrezaVista[];
  /** Las líneas de «Ajustes razonables» de la semana: una por estudiante con condición especial. */
  ajustes: { id: number; estudiante: string; iniciales: string; condicion: string; estrategia: string }[];
  adjuntos: { id: number; nombre: string; fragmentos: number }[];
  docente: string;
  creado: string;
  generadaEn: string | null;
};

type Props = {
  slug: string;
  yoSoy: number;
  soyAdmin: boolean;
  todas: boolean;
  q: string;
  planificaciones: PlanificacionVista[];
  actual: PlanificacionVista | null;
  semanas: SemanaVista[];
  semanaId: number | null;
  vista: 'campos' | 'previa';
  abrirNueva: boolean;
  destrezasCatalogo: DestrezaVista[];
  materias: { nivel: Nivel; nombre: string; ambito: string | null }[];
  /** Las materias (con su grado) que el administrador asignó al docente: las únicas que puede planificar. */
  materiasDocente: { id: number; etiqueta: string; materia: string; grado: string }[];
  plantillas: { clave: string; nombre: string; descripcion: string }[];
  plantillaPorDefecto: string;
  cupo: { tope: number | null; usadas: number; quedan: number | null };
  soloLectura: boolean;
  vistaPrevia: ReactNode;
};

const TONO_ESTADO: Record<EstadoSemana, Tono> = { PENDIENTE: 'aviso', GENERANDO: 'aviso', LISTA: 'exito', ERROR: 'error' };

export default function PlanificacionesCliente(p: Props) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'nueva' | 'configurar' | 'semana' | 'editar' | 'destrezas' | null>(p.abrirNueva ? 'nueva' : null);
  const [borrarPl, setBorrarPl] = useState<PlanificacionVista | null>(null);
  const [borrarSem, setBorrarSem] = useState<SemanaVista | null>(null);
  const [busqueda, setBusqueda] = useState(p.q);
  const [ayuda, setAyuda] = useState(false);

  const semana = useMemo(() => p.semanas.find((s) => s.id === p.semanaId) ?? p.semanas[p.semanas.length - 1] ?? null, [p.semanas, p.semanaId]);
  const sinCupo = p.cupo.quedan !== null && p.cupo.quedan <= 0;

  // ── Navegación por la dirección: la selección vive en ?p=&s=&vista= ─────────
  const ir = (cambios: Record<string, string | number | null | undefined>) => {
    const u = new URLSearchParams();
    const base: Record<string, string | number | null | undefined> = { quien: p.todas ? 'todas' : null, q: p.q || null, p: p.actual?.id, s: semana?.id, vista: p.vista === 'previa' ? 'previa' : null, ...cambios };
    for (const [k, v] of Object.entries(base)) if (v !== null && v !== undefined && v !== '') u.set(k, String(v));
    router.push(`/${p.slug}/planificaciones${u.toString() ? `?${u}` : ''}`);
  };

  // El buscador escribe en la dirección con un pequeño retraso.
  useEffect(() => {
    if (busqueda === p.q) return;
    const t = setTimeout(() => ir({ q: busqueda || null, p: null, s: null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  // Mientras el agente redacta, se consulta el estado y se refresca al cambiar.
  const redactando = p.semanas.some((s) => s.estado === 'PENDIENTE' || s.estado === 'GENERANDO');
  useEffect(() => {
    if (!redactando || !p.actual) return;
    const firma = p.semanas.map((s) => `${s.id}:${s.estado}`).join(',');
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/${p.slug}/api/semanas?planificacion=${p.actual!.id}`);
        const j = await r.json();
        const nueva = (j.semanas as { id: number; estado: string }[]).map((s) => `${s.id}:${s.estado}`).join(',');
        if (nueva !== firma) router.refresh();
      } catch {
        /* siguiente vuelta */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [redactando, p.semanas, p.actual, p.slug, router]);

  const cerrar = () => {
    setPanel(null);
    setError(null);
    if (p.abrirNueva) ir({ nueva: null });
  };

  const conResultado = (fn: () => Promise<{ ok: boolean; error?: string; id?: number }>, hecho: string, despues?: (id?: number) => void) =>
    arranca(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? 'No se pudo completar la acción');
        return;
      }
      toast.success(hecho);
      setPanel(null);
      despues?.(r.id);
      router.refresh();
    });

  const actual = p.actual;
  const puedo = Boolean(actual?.puedoCambiar) && !p.soloLectura;

  return (
    <>
      <CabeceraPagina
        titulo="Planificaciones"
        descripcion={p.cupo.tope === null ? `${p.cupo.usadas} planificaciones semanales generadas esta semana` : `${p.cupo.usadas} de ${p.cupo.tope} planificaciones semanales generadas esta semana en la institución`}
        acciones={
          <>
            {actual && (
              <>
                <a href={`/${p.slug}/api/word/${actual.id}`} download>
                  <Boton variante="secundario" icono={FileType}>
                    Word
                  </Boton>
                </a>
                <a href={`/${p.slug}/api/pdf/${actual.id}`} download>
                  <Boton variante="secundario" icono={FileDown}>
                    PDF
                  </Boton>
                </a>
              </>
            )}
            {/* «Destrezas» (Fernando, 2026-09-16): el conjunto propio de la planificación del que el agente elige una por semana. */}
            <Boton variante="secundario" icono={ListChecks} disabled={!actual} onClick={() => setPanel('destrezas')} title={!actual ? 'Elige una planificación' : 'Las destrezas con criterio de desempeño de esta planificación'}>
              Destrezas{actual ? ` · ${p.destrezasCatalogo.length}` : ''}
            </Boton>
            {/* «Configurar» solo con una planificación elegida (Fernando, 2026-09-15). */}
            <Boton variante="secundario" icono={Settings} disabled={!actual || !puedo} onClick={() => setPanel('configurar')} title={!actual ? 'Elige una planificación' : !puedo ? 'Solo quien la creó (o el administrador) puede configurarla' : 'Plantilla, datos del formato y firmas'}>
              Configurar
            </Boton>
            <Boton icono={Plus} onClick={() => setPanel('nueva')} disabled={p.soloLectura}>
              Nueva planificación
            </Boton>
            <Boton variante="secundario" icono={Trash2} disabled={!actual || !puedo} title={!actual ? 'Elige una planificación' : !puedo ? 'Solo quien la creó (o el administrador) puede eliminarla' : 'Eliminar la planificación elegida'} onClick={() => actual && setBorrarPl(actual)}>
              Eliminar planificación
            </Boton>
          </>
        }
      />

      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:h-[calc(100vh-61px)] xl:flex-row xl:overflow-hidden">
        {/* ── Columna 1: las planificaciones ─────────────────────────────── */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[300px] xl:shrink-0">
          <div className="space-y-2 border-b border-borde p-3">
            <Chips
              opciones={['mias', 'todas'] as const}
              etiquetas={{ mias: 'Mías', todas: 'De todos' }}
              valor={[p.todas ? 'todas' : 'mias']}
              alCambiar={(v) => {
                const nuevo = v[v.length - 1];
                if (nuevo) ir({ quien: nuevo === 'todas' ? 'todas' : null, p: null, s: null });
              }}
            />
            <Buscador valor={busqueda} alCambiar={setBusqueda} marcador="Materia, unidad o docente…" />
          </div>
          <div className="desplaza min-h-0 flex-1 overflow-y-auto p-2">
            {p.planificaciones.length === 0 && <EstadoVacio icono={BookOpenText} titulo={p.todas ? 'Nadie ha creado planificaciones' : 'Todavía no tienes planificaciones'} detalle="Crea la primera con «Nueva planificación»: materia, unidad y las fechas del PUD." />}
            {p.planificaciones.map((pl) => {
              const sel = actual?.id === pl.id;
              return (
                <button
                  key={pl.id}
                  onClick={() => ir({ p: pl.id, s: null })}
                  className={cn('mb-1 flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition-colors foco-visible', sel ? 'bg-acento-suave border-l-2 border-acento' : 'border-l-2 border-transparent hover:bg-realce')}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>{pl.materia}</p>
                    <p className="truncate text-[11px] text-tenue">
                      Unidad {pl.numeroUnidad} · {pl.tituloUnidad}
                    </p>
                    <p className="truncate text-[11px] text-tenue">
                      {ETIQUETA_NIVEL[pl.nivel]} · {pl.semanas} semana{pl.semanas === 1 ? '' : 's'}
                      {p.todas && ` · ${pl.docente}`}
                    </p>
                  </div>
                  <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-borde')} />
                </button>
              );
            })}
          </div>
        </Tarjeta>

        {/* ── La planificación elegida: semanas en galería arriba, campos/vista previa abajo ── */}
        {!actual ? (
          <Tarjeta className="flex flex-1 items-center justify-center">
            <EstadoVacio icono={BookOpenText} titulo="Elige una planificación" detalle="A la izquierda están las tuyas; cambia a «De todos» para ver las de tus compañeros." />
          </Tarjeta>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {/* Semanas: a todo el ancho, con altura limitada y en galería horizontal (Fernando, 2026-09-16) */}
            <Tarjeta className="shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-texto">{actual.materia}</p>
                  <div className="relative">
                    <BotonIcono icono={Info} titulo="Detalles de la planificación" onClick={() => setAyuda((v) => !v)} className={cn(ayuda && 'bg-realce text-texto')} />
                    {ayuda && (
                      <div className="absolute left-0 top-9 z-30 w-72 rounded-md border border-borde bg-tarjeta p-3 text-[12px] shadow-xl">
                        <p className="font-semibold text-texto">
                          Unidad {actual.numeroUnidad} · {actual.tituloUnidad}
                        </p>
                        <p className="mt-1 text-tenue">
                          {diaDeMes(actual.inicioPud)} – {diaDeMes(actual.finPud)}
                        </p>
                        <p className="text-tenue">{actual.docente}</p>
                        <p className="mt-1 text-tenue">
                          {ETIQUETA_NIVEL[actual.nivel]} · {actual.ambito}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Boton tamano="sm" icono={Sparkles} onClick={() => setPanel('semana')} disabled={!puedo || sinCupo} title={sinCupo ? `Tu institución ya generó ${p.cupo.tope} esta semana` : !puedo ? 'Solo quien la creó (o el administrador) puede añadir semanas' : 'Nueva planificación semanal'}>
                    Nueva
                  </Boton>
                  <Boton variante="secundario" tamano="sm" icono={Trash2} disabled={!semana || !puedo} title={!semana ? 'Elige una semana' : 'Eliminar la semana elegida'} onClick={() => semana && setBorrarSem(semana)}>
                    Eliminar
                  </Boton>
                </div>
              </div>
              <div className="desplaza flex gap-2 overflow-x-auto p-2">
                {p.semanas.length === 0 && (
                  <div className="w-full">
                    <EstadoVacio icono={CalendarDays} titulo="Sin semanas todavía" detalle="Cada semana es una línea del formato. Dicta o escribe lo que quieres y el agente la redacta." />
                  </div>
                )}
                {p.semanas.map((s) => {
                  const sel = semana?.id === s.id;
                  const enMarcha = s.estado === 'PENDIENTE' || s.estado === 'GENERANDO';
                  return (
                    <button key={s.id} onClick={() => ir({ s: s.id, vista: null })} className={cn('flex w-[220px] shrink-0 flex-col gap-1 rounded border px-3 py-2 text-left transition-colors foco-visible', sel ? 'border-acento bg-acento-suave' : 'border-borde hover:bg-realce')}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>Semana {s.orden}</p>
                        {enMarcha ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-aviso" /> : <Insignia tono={TONO_ESTADO[s.estado]}>{ETIQUETA_ESTADO_SEMANA[s.estado]}</Insignia>}
                      </div>
                      <p className="line-clamp-2 text-[11px] text-tenue">{s.tema?.split('\n')[0] || (enMarcha ? 'El agente está redactando…' : s.estado === 'ERROR' ? 'La redacción falló' : '—')}</p>
                      <p className="text-[11px] text-tenue">{s.fechaInicio ? `${diaDeMes(s.fechaInicio)} – ${diaDeMes(s.fechaFin)}` : '\u00a0'}</p>
                    </button>
                  );
                })}
              </div>
            </Tarjeta>

            {/* Campos / Vista previa, debajo y a todo el ancho */}
            <Tarjeta className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-3 py-2">
                <div className="flex rounded border border-borde p-0.5">
                  {(['campos', 'previa'] as const).map((v) => (
                    <button key={v} onClick={() => ir({ vista: v === 'previa' ? 'previa' : null })} className={cn('rounded px-3 py-1 text-[12px] font-semibold transition-colors foco-visible', p.vista === v ? 'bg-acento text-acento-contraste' : 'text-tenue hover:text-texto')}>
                      {v === 'campos' ? 'Campos generados' : 'Vista previa'}
                    </button>
                  ))}
                </div>
                {p.vista === 'campos' && semana && semana.estado === 'LISTA' && puedo && (
                  <div className="flex items-center gap-1">
                    <Boton variante="secundario" tamano="sm" icono={Pencil} onClick={() => setPanel('editar')}>
                      Corregir
                    </Boton>
                    <Boton variante="secundario" tamano="sm" icono={RefreshCw} disabled={enCurso || sinCupo} title={sinCupo ? 'Sin cupo esta semana' : 'Volver a pedirla al agente (cuenta contra el tope)'} onClick={() => conResultado(() => regenerarSemana(p.slug, semana.id), 'El agente vuelve a redactar la semana')}>
                      Regenerar
                    </Boton>
                  </div>
                )}
              </div>
              <div className={cn('desplaza min-h-0 flex-1 overflow-y-auto', p.vista === 'previa' ? 'bg-realce p-4' : 'p-4')}>
                {p.vista === 'previa' ? (
                  p.vistaPrevia
                ) : !semana ? (
                  <EstadoVacio icono={CalendarDays} titulo="Elige una semana" detalle="O crea la primera con «Nueva»." />
                ) : (
                  <CamposSemana semana={semana} slug={p.slug} puedo={puedo} sinCupo={sinCupo} enCurso={enCurso} alReintentar={() => conResultado(() => regenerarSemana(p.slug, semana.id), 'El agente vuelve a intentarlo')} alBorrar={() => setBorrarSem(semana)} />
                )}
              </div>
            </Tarjeta>
          </div>
        )}
      </div>

      {/* ── Nueva planificación ───────────────────────────────────────────── */}
      <PanelLateral abierto={panel === 'nueva'} alCerrar={cerrar} titulo="Nueva planificación" descripcion="La cabecera del plan de unidad. Después, semana a semana, el agente redacta cada línea." ancho="lg">
        <FormularioPlanificacion materiasDocente={p.materiasDocente} materias={p.materias} error={error} enCurso={enCurso} alCancelar={cerrar} textoEnviar="Continuar" alEnviar={(d) => conResultado(() => crearPlanificacion(p.slug, d), 'Planificación creada', (id) => ir({ p: id ?? null, s: null, nueva: null, quien: null }))} />
      </PanelLateral>

      {/* ── Configurar ────────────────────────────────────────────────────── */}
      <PanelLateral abierto={panel === 'configurar' && !!actual} alCerrar={cerrar} titulo="Configurar la planificación" descripcion="Plantilla, datos del formato y firmas de responsabilidad." ancho="lg">
        {actual && (
          <form action={(d) => conResultado(() => configurarPlanificacion(p.slug, actual.id, d), 'Planificación actualizada')} className="space-y-4">
            <Campo etiqueta="Plantilla (formato + forma de redactar)" requerido>
              <Selector name="plantilla" defaultValue={actual.plantilla || p.plantillaPorDefecto}>
                {p.plantillas.map((t) => (
                  <option key={t.clave} value={t.clave}>
                    {t.nombre}
                  </option>
                ))}
              </Selector>
            </Campo>
            <h3 className="border-t border-borde pt-3 text-[12px] font-semibold uppercase tracking-wide text-tenue">Datos informativos</h3>
            <CamposCabecera materias={p.materias} valores={actual} conAmbito />
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Grado / Curso">
                <Entrada name="gradoCurso" defaultValue={actual.gradoCurso ?? ''} placeholder="Primer grado" />
              </Campo>
              <Campo etiqueta="Paralelo">
                <Entrada name="paralelo" defaultValue={actual.paralelo ?? ''} placeholder="A" />
              </Campo>
              <Campo etiqueta="Jornada">
                <Entrada name="jornada" defaultValue={actual.jornada ?? ''} placeholder="Matutina" />
              </Campo>
            </div>
            <Campo etiqueta="Objetivos específicos de la unidad">
              <AreaTexto name="objetivosUnidad" rows={3} defaultValue={actual.objetivosUnidad ?? ''} />
            </Campo>
            <Campo etiqueta="Criterios de evaluación de la unidad">
              <AreaTexto name="criteriosEvaluacion" rows={3} defaultValue={actual.criteriosEvaluacion ?? ''} />
            </Campo>
            <Campo etiqueta="Responsable del DECE (nombre)">
              <Entrada name="deceNombre" defaultValue={actual.deceNombre ?? ''} placeholder="Psic. …" />
            </Campo>
            <h3 className="border-t border-borde pt-3 text-[12px] font-semibold uppercase tracking-wide text-tenue">Firmas de responsabilidad</h3>
            <p className="text-[12px] text-tenue">Van al final del formato con la fecha del día de la descarga; la firma se pone a mano sobre el papel.</p>
            <Campo etiqueta="Elaborado por (docente)">
              <Entrada name="elaboradoPor" defaultValue={actual.elaboradoPor ?? actual.docente} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Campo etiqueta="Revisado por">
                <Entrada name="revisadoPor" defaultValue={actual.revisadoPor ?? ''} />
              </Campo>
              <Campo etiqueta="Cargo">
                <Entrada name="revisadoCargo" defaultValue={actual.revisadoCargo ?? 'Coordinador de área'} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Campo etiqueta="Aprobado por">
                <Entrada name="aprobadoPor" defaultValue={actual.aprobadoPor ?? ''} />
              </Campo>
              <Campo etiqueta="Cargo">
                <Entrada name="aprobadoCargo" defaultValue={actual.aprobadoCargo ?? 'Rector/Vicerrector'} />
              </Campo>
            </div>
            <h3 className="border-t border-borde pt-3 text-[12px] font-semibold uppercase tracking-wide text-tenue">Registro de formato</h3>
            <p className="text-[12px] text-tenue">El pie del documento: quién elaboró y aprobó el formato y cuándo.</p>
            <Campo etiqueta="Título (va tras «REGISTRO DE FORMATO:»)">
              <Entrada name="registroTitulo" defaultValue={actual.registroTitulo ?? ''} placeholder="Planificación Curricular Anual 2026 - 2027" />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Elaborado por · cargo">
                <Entrada name="registroElaboradoCargo" defaultValue={actual.registroElaboradoCargo ?? 'Coordinación Pedagógica'} />
              </Campo>
              <Campo etiqueta="Elaborado por · nombre">
                <Entrada name="registroElaboradoNombre" defaultValue={actual.registroElaboradoNombre ?? ''} />
              </Campo>
              <Campo etiqueta="Elaborado por · fecha">
                <Entrada name="registroElaboradoFecha" defaultValue={actual.registroElaboradoFecha ?? ''} placeholder="21.01.2026" />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Aprobado por · cargo">
                <Entrada name="registroAprobadoCargo" defaultValue={actual.registroAprobadoCargo ?? 'Dirección General'} />
              </Campo>
              <Campo etiqueta="Aprobado por · nombre">
                <Entrada name="registroAprobadoNombre" defaultValue={actual.registroAprobadoNombre ?? ''} />
              </Campo>
              <Campo etiqueta="Aprobado por · fecha">
                <Entrada name="registroAprobadoFecha" defaultValue={actual.registroAprobadoFecha ?? ''} />
              </Campo>
            </div>
            {error && <Aviso texto={error} />}
            <div className="flex justify-end gap-2 border-t border-borde pt-4">
              <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={enCurso}>
                {enCurso ? 'Guardando…' : 'Guardar'}
              </Boton>
            </div>
          </form>
        )}
      </PanelLateral>

      {/* ── Nueva planificación semanal ───────────────────────────────────── */}
      <PanelLateral abierto={panel === 'semana' && !!actual} alCerrar={cerrar} titulo={`Semana ${p.semanas.length + 1} · nueva planificación semanal`} descripcion="Cuéntale al agente qué quieres: el tema, lo que tienes, lo que te importa. Él redacta la línea del formato." ancho="lg">
        {actual && <FormularioSemana slug={p.slug} actual={actual} semanas={p.semanas} cupo={p.cupo} error={error} enCurso={enCurso} alCancelar={cerrar} alEnviar={(d) => conResultado(() => crearSemana(p.slug, actual.id, d), 'Solicitud enviada: el agente está redactando', (id) => ir({ s: id ?? null, vista: null }))} />}
      </PanelLateral>

      {/* ── Corregir la semana ────────────────────────────────────────────── */}
      <PanelLateral abierto={panel === 'editar' && !!semana} alCerrar={cerrar} titulo={`Corregir la semana ${semana?.orden ?? ''}`} descripcion="Lo que cambies aquí es lo que sale en el formato." ancho="lg">
        {semana && actual && <FormularioCampos slug={p.slug} semana={semana} catalogo={p.destrezasCatalogo} materia={actual.materia} error={error} enCurso={enCurso} alCancelar={cerrar} alEnviar={(d) => conResultado(() => editarSemana(p.slug, semana.id, d), 'Semana corregida')} />}
      </PanelLateral>

      {/* ── Destrezas de la planificación ─────────────────────────────────── */}
      <PanelLateral abierto={panel === 'destrezas' && !!actual} alCerrar={cerrar} titulo={`Destrezas · ${actual?.materia ?? ''}`} descripcion="Las destrezas con criterio de desempeño de esta planificación. El agente elige una por semana según lo que dictes." ancho="lg">
        {actual && <PanelDestrezas slug={p.slug} planificacionId={actual.id} destrezas={p.destrezasCatalogo} puedo={puedo} />}
      </PanelLateral>

      <Confirmar abierto={!!borrarPl} titulo="Eliminar la planificación" mensaje={`Se eliminará «${borrarPl?.materia} · Unidad ${borrarPl?.numeroUnidad}» con sus ${borrarPl?.semanas ?? 0} semana(s). No se puede deshacer.`} ocupado={enCurso} alCerrar={() => setBorrarPl(null)} alAceptar={() => borrarPl && conResultado(() => eliminarPlanificacion(p.slug, borrarPl.id), 'Planificación eliminada', () => { setBorrarPl(null); ir({ p: null, s: null }); })} />
      <Confirmar abierto={!!borrarSem} titulo="Eliminar la semana" mensaje={`Se eliminará la semana ${borrarSem?.orden ?? ''} y las siguientes se renumerarán. No se puede deshacer.`} ocupado={enCurso} alCerrar={() => setBorrarSem(null)} alAceptar={() => borrarSem && conResultado(() => eliminarSemana(p.slug, borrarSem.id), 'Semana eliminada', () => { setBorrarSem(null); ir({ s: null }); })} />
    </>
  );
}

// ── Los campos de la cabecera (alta y configuración comparten) ───────────────

function CamposCabecera({ materias, valores, conAmbito }: { materias: Props['materias']; valores?: Partial<PlanificacionVista>; conAmbito?: boolean }) {
  const [nivel, setNivel] = useState<Nivel>(valores?.nivel ?? 'PREPARATORIA');
  const delNivel = materias.filter((m) => m.nivel === nivel);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nivel" requerido>
          <Selector name="nivel" value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {ETIQUETA_NIVEL[n]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Materia (área de conocimiento)" requerido>
          <Entrada name="materia" list="materias-del-nivel" required autoFocus defaultValue={valores?.materia ?? ''} placeholder="Elige o escribe" />
          <datalist id="materias-del-nivel">
            {delNivel.map((m) => (
              <option key={m.nombre} value={m.nombre} />
            ))}
          </datalist>
        </Campo>
      </div>
      <Campo etiqueta={conAmbito ? 'Ámbito de desarrollo/aprendizaje' : 'Ámbito de desarrollo/aprendizaje (si no lo escribes, se usa la materia)'} requerido={conAmbito}>
        <Entrada name="ambito" defaultValue={valores?.ambito ?? ''} required={conAmbito} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
        <Campo etiqueta="N.º de unidad" requerido>
          <Entrada name="numeroUnidad" type="number" min={1} max={99} required defaultValue={valores?.numeroUnidad ?? 1} />
        </Campo>
        <Campo etiqueta="Título de la unidad de planificación" requerido>
          <Entrada name="tituloUnidad" required defaultValue={valores?.tituloUnidad ?? ''} />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Inicio de PUD" requerido>
          <Entrada name="inicioPud" type="date" required defaultValue={valores?.inicioPud ?? ''} />
        </Campo>
        <Campo etiqueta="Fin de PUD" requerido>
          <Entrada name="finPud" type="date" required defaultValue={valores?.finPud ?? ''} />
        </Campo>
      </div>
    </>
  );
}

function FormularioPlanificacion({ materiasDocente, error, enCurso, alCancelar, alEnviar, textoEnviar }: { materiasDocente: Props['materiasDocente']; materias: Props['materias']; error: string | null; enCurso: boolean; alCancelar: () => void; alEnviar: (d: FormData) => void; textoEnviar: string }) {
  const [nivel, setNivel] = useState<Nivel>('PREPARATORIA');
  return (
    <form action={alEnviar} className="space-y-4">
      {/* La materia sale de las que el administrador asignó al docente en «Unidades» (Fernando, 2026-09-16). */}
      {materiasDocente.length === 0 && <Aviso tono="info" texto="Todavía no tienes materias asignadas. Pide al administrador que te asigne tus materias en Unidades." />}
      {/* Filas de dos columnas con etiquetas de una línea: la materia sola, luego nivel · ámbito, n.º · título, inicio · fin (Fernando, 2026-09-16: «que se vea ordenado»). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo etiqueta="Materia (grado)" requerido>
            <Selector name="materiaGradoId" required defaultValue="" autoFocus>
              <option value="" disabled>
                Elige una materia…
              </option>
              {materiasDocente.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.etiqueta}
                </option>
              ))}
            </Selector>
          </Campo>
        </div>
        <Campo etiqueta="Nivel" requerido>
          <Selector name="nivel" value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {ETIQUETA_NIVEL[n]}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Ámbito de desarrollo / aprendizaje">
          <Entrada name="ambito" placeholder="Opcional" />
        </Campo>
        <Campo etiqueta="N.º de unidad" requerido>
          <Entrada name="numeroUnidad" type="number" min={1} max={99} required defaultValue={1} />
        </Campo>
        <Campo etiqueta="Título de la unidad de planificación" requerido>
          <Entrada name="tituloUnidad" required />
        </Campo>
        <Campo etiqueta="Inicio de PUD" requerido>
          <Entrada name="inicioPud" type="date" required />
        </Campo>
        <Campo etiqueta="Fin de PUD" requerido>
          <Entrada name="finPud" type="date" required />
        </Campo>
      </div>
      {error && <Aviso texto={error} />}
      <div className="flex justify-end gap-2 border-t border-borde pt-4">
        <Boton type="button" variante="secundario" onClick={alCancelar} disabled={enCurso}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enCurso || materiasDocente.length === 0}>
          {enCurso ? 'Creando…' : textoEnviar}
        </Boton>
      </div>
    </form>
  );
}

// ── La solicitud de una semana: micrófono + texto + adjuntos ────────────────

function FormularioSemana({ slug, actual, semanas, cupo, error, enCurso, alCancelar, alEnviar }: { slug: string; actual: PlanificacionVista; semanas: SemanaVista[]; cupo: Props['cupo']; error: string | null; enCurso: boolean; alCancelar: () => void; alEnviar: (d: FormData) => void }) {
  const [indicaciones, setIndicaciones] = useState('');
  const [adjuntos, setAdjuntos] = useState<AdjuntoSubido[]>([]);
  const ultima = [...semanas].filter((s) => s.fechaFin).sort((a, b) => (a.fechaFin! < b.fechaFin! ? 1 : -1))[0];
  const inicioPropuesto = ultima?.fechaFin ? siguienteLunes(ultima.fechaFin) : actual.inicioPud;
  const finPropuesto = sumarDias(inicioPropuesto, 4);

  return (
    <form action={alEnviar} className="space-y-4">
      <div className="rounded border border-borde bg-realce px-3 py-2 text-[12px] text-tenue">
        {cupo.tope === null ? `${cupo.usadas} generadas esta semana.` : `${cupo.usadas} de ${cupo.tope} planificaciones semanales generadas esta semana en la institución.`}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Semana del">
          <Entrada name="fechaInicio" type="date" defaultValue={inicioPropuesto} min={actual.inicioPud} max={actual.finPud} />
        </Campo>
        <Campo etiqueta="al">
          <Entrada name="fechaFin" type="date" defaultValue={finPropuesto} min={actual.inicioPud} max={actual.finPud} />
        </Campo>
      </div>
      <Campo etiqueta="Indicaciones del docente">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Dictado slug={slug} alTranscribir={(t) => setIndicaciones((v) => (v.trim() ? `${v.trim()}\n${t}` : t))} deshabilitado={enCurso} />
          <span className="text-[11px] text-tenue">Pulsa, cuenta la semana con todo el detalle y vuelve a pulsar. Puedes corregir el texto.</span>
        </div>
        <AreaTexto name="indicaciones" rows={9} value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} placeholder="El tema de la semana, lo que quieres lograr, el material que tienes, las páginas del libro, los estudiantes que necesitan algo distinto, cuántas horas…" />
      </Campo>
      <Campo etiqueta="Archivos adjuntos (guías, libro, planificaciones anteriores)">
        <Adjuntos slug={slug} valor={adjuntos} alCambiar={setAdjuntos} deshabilitado={enCurso} />
      </Campo>
      {error && <Aviso texto={error} />}
      <div className="flex justify-end gap-2 border-t border-borde pt-4">
        <Boton type="button" variante="secundario" onClick={alCancelar} disabled={enCurso}>
          Cancelar
        </Boton>
        <Boton type="submit" icono={Sparkles} disabled={enCurso}>
          {enCurso ? 'Enviando…' : 'Redactar la semana'}
        </Boton>
      </div>
    </form>
  );
}

function siguienteLunes(dia: string) {
  const d = new Date(`${dia}T00:00:00Z`).getUTCDay();
  return sumarDias(dia, d === 0 ? 1 : 8 - d);
}

// ── Los campos generados, en lectura ────────────────────────────────────────

function CamposSemana({ semana: s, puedo, sinCupo, enCurso, alReintentar, alBorrar }: { semana: SemanaVista; slug: string; puedo: boolean; sinCupo: boolean; enCurso: boolean; alReintentar: () => void; alBorrar: () => void }) {
  if (s.estado === 'PENDIENTE' || s.estado === 'GENERANDO') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-acento" />
        <p className="text-[13px] font-semibold">El agente está redactando la semana {s.orden}</p>
        <p className="max-w-md text-[12px] text-tenue">Está leyendo tus indicaciones{s.adjuntos.length ? ' y los adjuntos' : ''}, eligiendo las destrezas y buscando recursos en la web. Suele tardar entre uno y tres minutos; la pantalla se actualiza sola.</p>
        <details className="mt-2 max-w-lg text-left text-[12px] text-tenue">
          <summary className="cursor-pointer font-semibold">Lo que le contaste</summary>
          <p className="mt-1 whitespace-pre-line">{s.indicaciones || '(sin indicaciones)'}</p>
        </details>
      </div>
    );
  }
  if (s.estado === 'ERROR') {
    return (
      <div className="space-y-3">
        <Aviso texto={s.error ?? 'La redacción falló.'} />
        <details className="text-[12px] text-tenue">
          <summary className="cursor-pointer font-semibold">Lo que le contaste</summary>
          <p className="mt-1 whitespace-pre-line">{s.indicaciones || '(sin indicaciones)'}</p>
        </details>
        {puedo && (
          <div className="flex gap-2">
            <Boton icono={RefreshCw} onClick={alReintentar} disabled={enCurso}>
              Volver a intentar
            </Boton>
            <Boton variante="secundario" icono={Trash2} onClick={alBorrar} disabled={enCurso}>
              Eliminar semana
            </Boton>
          </div>
        )}
        {sinCupo && <p className="text-[11px] text-tenue">Un reintento tras un fallo no cuenta contra el tope.</p>}
      </div>
    );
  }

  const fases = parsearEstrategias(s.estrategias);
  const CampoLectura = ({ titulo, children }: { titulo: string; children: ReactNode }) => (
    <section>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">{titulo}</h3>
      <div className="text-[13px] leading-relaxed text-texto">{children}</div>
    </section>
  );
  const esEnlace = (t: string) => /^https?:\/\/\S+$/.test(t.trim());
  const Texto = ({ t }: { t: string }) => (esEnlace(t) ? <a href={t} target="_blank" rel="noreferrer" className="break-all text-acento underline">{t}</a> : <>{t}</>);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoLectura titulo="Fecha inicio">{fechaCorta(s.fechaInicio)}</CampoLectura>
        <CampoLectura titulo="Fecha fin">{fechaCorta(s.fechaFin)}</CampoLectura>
        <CampoLectura titulo="N.º de periodos">{s.numeroPeriodos || '—'}</CampoLectura>
      </div>
      <CampoLectura titulo="Tema">
        <p className="whitespace-pre-line font-semibold">{s.tema || '—'}</p>
      </CampoLectura>
      <CampoLectura titulo="Objetivos del tema">
        <p className="whitespace-pre-line">{s.objetivosTema || '—'}</p>
      </CampoLectura>
      <CampoLectura titulo="Destrezas con criterio de desempeño">
        {s.destrezas.length === 0 && <p className="text-tenue">Ninguna (no había destrezas cargadas para esta materia, o el agente no eligió). Puedes elegirlas en «Corregir».</p>}
        <ul className="space-y-2">
          {s.destrezas.map((d) => (
            <li key={d.id} className="flex items-start gap-2.5">
              {d.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.imagenUrl} alt="" className="mt-0.5 h-8 w-auto max-w-[120px] shrink-0 object-contain" />
              ) : (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-acento-suave text-[10px] font-bold text-acento">{d.codigo.split('.')[0]}</span>
              )}
              <p>
                <span className="font-semibold">{d.codigo}</span> {d.descripcion}
              </p>
            </li>
          ))}
        </ul>
      </CampoLectura>
      <CampoLectura titulo="Estrategias metodológicas">
        <div className="space-y-3">
          {fases.map((f, i) => (
            <div key={i}>
              {f.titulo && <p className="mb-1 inline-block rounded border border-borde bg-realce px-2 py-0.5 text-[11px] font-bold text-acento">{f.titulo}</p>}
              <div className="space-y-1.5">
                {f.actividades.map((a, j) => (
                  <div key={j}>
                    <p>
                      <Texto t={a.texto} />
                    </p>
                    {a.vinetas.length > 0 && (
                      <ul className="list-disc pl-6 text-tenue">
                        {a.vinetas.map((v, k) => (
                          <li key={k}>
                            <Texto t={v} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CampoLectura>
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoLectura titulo="Recursos">
          <ul className="list-disc pl-5">
            {lineas(s.recursos).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </CampoLectura>
        <CampoLectura titulo="Técnica">
          {lineas(s.tecnica).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </CampoLectura>
        <CampoLectura titulo="Instrumento">
          {lineas(s.instrumento).map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </CampoLectura>
      </div>
      {s.ajustes.length > 0 && (
        <CampoLectura titulo={`Ajustes razonables · ${s.ajustes.length} estudiante${s.ajustes.length === 1 ? '' : 's'}`}>
          <ul className="space-y-2">
            {s.ajustes.map((a) => (
              <li key={a.id} className="rounded border border-borde p-2.5">
                <p className="text-[12px] font-semibold text-texto">
                  {a.iniciales} <span className="font-normal text-tenue">· {a.condicion}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-[12px]">{a.estrategia}</p>
              </li>
            ))}
          </ul>
        </CampoLectura>
      )}
      {s.referencias.length > 0 && (
        <CampoLectura titulo="Referencias que usó el agente">
          <ul className="space-y-1">
            {s.referencias.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-acento" />
                <span>
                  <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-acento underline">
                    {r.titulo}
                  </a>{' '}
                  <span className="text-tenue">— {r.uso}</span>
                </span>
              </li>
            ))}
          </ul>
        </CampoLectura>
      )}
      <details className="border-t border-borde pt-3 text-[12px] text-tenue">
        <summary className="cursor-pointer font-semibold">Lo que le contaste al agente{s.adjuntos.length ? ` · ${s.adjuntos.length} adjunto(s)` : ''}</summary>
        <p className="mt-1 whitespace-pre-line">{s.indicaciones || '(sin indicaciones)'}</p>
        {s.adjuntos.length > 0 && <p className="mt-1">Adjuntos: {s.adjuntos.map((a) => a.nombre).join(' · ')}</p>}
        {s.uso && (
          <p className="mt-1">
            Redactada por {s.docente} · {s.uso.tokensEntrada ?? 0} tokens de entrada, {s.uso.tokensSalida ?? 0} de salida, {s.uso.busquedasWeb ?? 0} búsqueda(s) web, {Math.round((s.uso.duracionMs ?? 0) / 1000)} s
          </p>
        )}
      </details>
    </div>
  );
}

// ── Corregir a mano ─────────────────────────────────────────────────────────

function FormularioCampos({ semana: s, catalogo, materia, error, enCurso, alCancelar, alEnviar }: { slug: string; semana: SemanaVista; catalogo: DestrezaVista[]; materia: string; error: string | null; enCurso: boolean; alCancelar: () => void; alEnviar: (d: FormData) => void }) {
  const [elegidas, setElegidas] = useState<number[]>(s.destrezas.map((d) => d.id));
  const [filtro, setFiltro] = useState('');
  const visibles = catalogo.filter((d) => {
    const t = `${d.codigo} ${d.descripcion} ${d.materia ?? ''}`.toLowerCase();
    return !filtro || t.includes(filtro.toLowerCase());
  });
  // Primero las de la materia de la planificación, que son las que casi siempre van.
  const ordenadas = [...visibles].sort((a, b) => Number((b.materia ?? '').toLowerCase() === materia.toLowerCase()) - Number((a.materia ?? '').toLowerCase() === materia.toLowerCase()));

  return (
    <form action={alEnviar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Fecha inicio" requerido>
          <Entrada name="fechaInicio" type="date" required defaultValue={s.fechaInicio ?? ''} />
        </Campo>
        <Campo etiqueta="Fecha fin" requerido>
          <Entrada name="fechaFin" type="date" required defaultValue={s.fechaFin ?? ''} />
        </Campo>
        <Campo etiqueta="N.º de periodos">
          <Entrada name="numeroPeriodos" defaultValue={s.numeroPeriodos ?? ''} placeholder="5 horas" />
        </Campo>
      </div>
      <Campo etiqueta="Tema (si son dos contenidos, uno por línea)">
        <AreaTexto name="tema" rows={2} defaultValue={s.tema ?? ''} />
      </Campo>
      <Campo etiqueta="Objetivos del tema">
        <AreaTexto name="objetivosTema" rows={4} defaultValue={s.objetivosTema ?? ''} />
      </Campo>
      <Campo etiqueta={`Destrezas con criterio de desempeño (${elegidas.length} elegidas)`}>
        {elegidas.map((id) => (
          <input key={id} type="hidden" name="destrezas" value={id} />
        ))}
        <Buscador valor={filtro} alCambiar={setFiltro} marcador="Buscar por código o texto…" className="mb-2" />
        <div className="desplaza max-h-56 space-y-1 overflow-y-auto rounded border border-borde p-2">
          {ordenadas.length === 0 && <p className="text-[12px] text-tenue">No hay destrezas cargadas para este nivel todavía.</p>}
          {ordenadas.map((d) => {
            const marcada = elegidas.includes(d.id);
            return (
              <label key={d.id} className={cn('flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-[12px] transition-colors', marcada ? 'bg-acento-suave' : 'hover:bg-realce')}>
                <input type="checkbox" checked={marcada} onChange={() => setElegidas((v) => (marcada ? v.filter((x) => x !== d.id) : [...v, d.id]))} className="mt-0.5 h-4 w-4 accent-[var(--color-acento)]" />
                <span>
                  <span className="font-semibold">{d.codigo}</span> {d.descripcion}
                  {d.materia && <span className="block text-[11px] text-tenue">{d.materia}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </Campo>
      <Campo etiqueta="Estrategias metodológicas (las fases empiezan con «## », las preguntas con «• », un enlace en su propia línea)">
        <AreaTexto name="estrategias" rows={16} defaultValue={s.estrategias ?? ''} className="font-mono text-[12px]" />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Recursos (uno por línea)">
          <AreaTexto name="recursos" rows={6} defaultValue={s.recursos ?? ''} />
        </Campo>
        <Campo etiqueta="Técnica (una por línea)">
          <AreaTexto name="tecnica" rows={6} defaultValue={s.tecnica ?? ''} />
        </Campo>
        <Campo etiqueta="Instrumento (uno por línea)">
          <AreaTexto name="instrumento" rows={6} defaultValue={s.instrumento ?? ''} />
        </Campo>
      </div>
      {s.ajustes.map((a) => (
        <Campo key={a.id} etiqueta={`Ajuste razonable · ${a.iniciales} (${a.condicion}) · estrategia empleada`}>
          <AreaTexto name={`ajuste-${a.id}`} rows={5} defaultValue={a.estrategia} />
        </Campo>
      ))}
      {error && <Aviso texto={error} />}
      <div className="flex justify-end gap-2 border-t border-borde pt-4">
        <Boton type="button" variante="secundario" onClick={alCancelar} disabled={enCurso}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enCurso}>
          {enCurso ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </form>
  );
}

// ── Las destrezas de la planificación: lista + alta/edición ─────────────────

function PanelDestrezas({ slug, planificacionId, destrezas, puedo }: { slug: string; planificacionId: number; destrezas: DestrezaVista[]; puedo: boolean }) {
  const router = useRouter();
  const [modo, setModo] = useState<'lista' | 'nueva' | DestrezaVista>('lista');
  const [borrar, setBorrar] = useState<DestrezaVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [enCurso, arranca] = useTransition();
  const editando = modo !== 'lista' && modo !== 'nueva' ? modo : null;

  const volver = () => {
    setModo('lista');
    setError(null);
    setVista(null);
    setQuitarImagen(false);
  };
  const enviar = (d: FormData) =>
    arranca(async () => {
      setError(null);
      if (quitarImagen) d.set('quitarImagen', 'true');
      const r = editando ? await editarDestreza(slug, editando.id, d) : await crearDestreza(slug, planificacionId, d);
      if (!r.ok) return setError(r.error);
      toast.success(editando ? 'Destreza guardada' : 'Destreza añadida');
      volver();
      router.refresh();
    });

  if (modo === 'lista')
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] text-tenue">
            {destrezas.length} destreza{destrezas.length === 1 ? '' : 's'}. La imagen de cada una sale en el formato junto a su código.
          </p>
          {puedo && (
            <Boton tamano="sm" icono={PlusIcon} onClick={() => setModo('nueva')}>
              Nueva destreza
            </Boton>
          )}
        </div>
        {destrezas.length === 0 && <EstadoVacio icono={ListChecks} titulo="Sin destrezas todavía" detalle="Añade las destrezas con criterio de desempeño de esta materia: el agente elegirá una por semana." />}
        <ul className="divide-y divide-[var(--color-borde)] rounded border border-borde">
          {destrezas.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-3 py-2.5">
              <div className="flex h-10 w-[84px] shrink-0 items-center justify-center rounded bg-realce">
                {d.imagenUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.imagenUrl} alt="" className="h-9 w-auto max-w-[80px] object-contain" />
                ) : (
                  <ImageOff className="h-4 w-4 text-tenue" />
                )}
              </div>
              <div className="min-w-0 flex-1 text-[12px]">
                <p className="font-semibold text-texto">{d.codigo}</p>
                <p className="leading-relaxed text-tenue">{d.descripcion}</p>
              </div>
              {puedo && (
                <div className="flex shrink-0 items-center gap-1">
                  <BotonIcono icono={Pencil} titulo="Editar" onClick={() => setModo(d)} />
                  <BotonIcono icono={Trash2} titulo="Quitar" className="text-error" onClick={() => setBorrar(d)} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <Confirmar
          abierto={!!borrar}
          titulo="Quitar la destreza"
          mensaje={`Se quitará «${borrar?.codigo}» de esta planificación. Si alguna semana ya la usaba, quedará sin destreza hasta que la corrijas.`}
          textoAceptar="Quitar"
          ocupado={enCurso}
          alCerrar={() => setBorrar(null)}
          alAceptar={() =>
            arranca(async () => {
              if (!borrar) return;
              const r = await eliminarDestreza(slug, borrar.id);
              if (!r.ok) return void toast.error(r.error);
              toast.success('Destreza quitada');
              setBorrar(null);
              router.refresh();
            })
          }
        />
      </div>
    );

  const imagenActual = vista ?? (quitarImagen ? null : (editando?.imagenUrl ?? null));
  return (
    <form action={enviar} className="space-y-4">
      <Campo etiqueta="Código" requerido>
        <Entrada name="codigo" required defaultValue={editando?.codigo ?? ''} placeholder="CS.1.1.7." className="font-mono" autoFocus />
      </Campo>
      <Campo etiqueta="Descripción (la destreza con criterio de desempeño, tal como está en el currículo)" requerido>
        <AreaTexto name="descripcion" rows={4} required defaultValue={editando?.descripcion ?? ''} />
      </Campo>
      <Campo etiqueta="Imagen o icono (PNG o JPG, hasta 300 KB; sale en el formato junto al código)">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-[110px] items-center justify-center rounded border border-borde bg-realce">
            {imagenActual ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagenActual} alt="" className="h-10 w-auto max-w-[104px] object-contain" />
            ) : (
              <ImageOff className="h-4 w-4 text-tenue" />
            )}
          </div>
          <input
            type="file"
            name="imagen"
            accept="image/png,image/jpeg"
            className="text-[12px] text-tenue file:mr-2 file:rounded file:border file:border-borde file:bg-tarjeta file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-texto hover:file:bg-realce"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return setVista(null);
              setQuitarImagen(false);
              const lector = new FileReader();
              lector.onload = () => setVista(String(lector.result));
              lector.readAsDataURL(f);
            }}
          />
          {imagenActual && (
            <Boton type="button" variante="fantasma" tamano="sm" onClick={() => { setVista(null); setQuitarImagen(true); }}>
              Quitar imagen
            </Boton>
          )}
        </div>
        <Entrada name="imagenUrl" className="mt-2" placeholder="…o pega la dirección de una imagen" />
      </Campo>
      {error && <Aviso texto={error} />}
      <div className="flex justify-end gap-2 border-t border-borde pt-4">
        <Boton type="button" variante="secundario" onClick={volver} disabled={enCurso}>
          Volver a la lista
        </Boton>
        <Boton type="submit" disabled={enCurso}>
          {enCurso ? 'Guardando…' : editando ? 'Guardar' : 'Añadir destreza'}
        </Boton>
      </div>
    </form>
  );
}
