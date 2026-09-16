'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronRight, Users } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Selector, Tarjeta, EstadoVacio, PanelLateral, Confirmar, Insignia, EtiquetaGrado } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { crearEstudiante, editarEstudiante, eliminarEstudiante } from '@/acciones/estudiantes';
import type { EstudianteVista, GradoDelDocente } from '@/lib/estudiantes';
import { cn } from '@/lib/utils';

/**
 * EL MÓDULO «ESTUDIANTES» (Fernando, 2026-09-16): a la izquierda los grados en
 * los que el docente tiene materias; a la derecha los estudiantes del grado
 * elegido. Cada estudiante lleva el nombre completo y si tiene condición
 * especial; si la tiene, los cuatro datos de la sección «Ajustes razonables»
 * (iniciales, condición reportada, nivel de ajuste, enfoque), porque por cada
 * uno el agente redacta una línea en cada planificación semanal.
 */
export default function EstudiantesCliente({ slug, grados, gradoId, estudiantes, soloLectura }: { slug: string; grados: GradoDelDocente[]; gradoId: number | null; estudiantes: EstudianteVista[]; soloLectura: boolean }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const grado = grados.find((g) => g.id === gradoId) ?? null;
  const [panel, setPanel] = useState<'nuevo' | 'editar' | null>(null);
  const [editando, setEditando] = useState<EstudianteVista | null>(null);
  const [borrar, setBorrar] = useState<EstudianteVista | null>(null);
  const [conCondicion, setConCondicion] = useState(false);

  const ir = (g: number | null) => router.push(`/${slug}/estudiantes${g ? `?g=${g}` : ''}`);
  const cerrar = () => {
    setPanel(null);
    setEditando(null);
    setError(null);
  };
  const abrir = (e: EstudianteVista | null) => {
    setEditando(e);
    setConCondicion(e?.condicionEspecial ?? false);
    setPanel(e ? 'editar' : 'nuevo');
  };
  const conResultado = (fn: () => Promise<{ ok: boolean; error?: string; id?: number }>, hecho: string, despues?: () => void) =>
    arranca(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? 'No se pudo completar la acción');
      toast.success(hecho);
      cerrar();
      despues?.();
      router.refresh();
    });

  const especiales = estudiantes.filter((e) => e.condicionEspecial).length;

  return (
    <>
      <CabeceraPagina
        titulo="Estudiantes"
        descripcion="Los estudiantes de tus grados. Los que tienen condición especial llevan una línea de ajustes razonables en cada semana"
        acciones={
          <Boton icono={Plus} onClick={() => abrir(null)} disabled={soloLectura || !grado}>
            Nuevo estudiante
          </Boton>
        }
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:h-[calc(100vh-61px)] xl:flex-row xl:overflow-hidden">
        {/* Grados del docente */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[280px] xl:shrink-0">
          <div className="border-b border-borde px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">Mis grados</div>
          <div className="desplaza min-h-0 flex-1 overflow-y-auto p-2">
            {grados.length === 0 && <EstadoVacio icono={Users} titulo="Sin grados" detalle="Cuando el administrador te asigne materias en Unidades, sus grados aparecerán aquí." />}
            {grados.map((g) => {
              const sel = grado?.id === g.id;
              return (
                <button key={g.id} onClick={() => ir(g.id)} className={cn('mb-1 flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition-colors foco-visible', sel ? 'bg-acento-suave border-l-2 border-acento' : 'border-l-2 border-transparent hover:bg-realce')}>
                  <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>{g.nombre}</p>
                    <p className="truncate text-[11px] text-tenue">{g.materias.join(' · ')}</p>
                  </div>
                  <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-borde')} />
                </button>
              );
            })}
          </div>
        </Tarjeta>

        {/* Estudiantes del grado */}
        <Tarjeta className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-borde px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-texto">{grado?.nombre ?? 'Estudiantes'}</p>
              <p className="text-[11px] text-tenue">{grado ? `${estudiantes.length} estudiante${estudiantes.length === 1 ? '' : 's'} · ${especiales} con condición especial` : 'Elige un grado'}</p>
            </div>
            {grado && <EtiquetaGrado nombre={grado.nombre} color={grado.color} />}
          </div>
          <div className="desplaza min-h-0 flex-1 overflow-y-auto p-2">
            {!grado && <EstadoVacio icono={Users} titulo="Elige un grado" detalle="Verás y podrás dar de alta a sus estudiantes." />}
            {grado && estudiantes.length === 0 && <EstadoVacio icono={Users} titulo="Sin estudiantes" detalle="Añade el primero con «Nuevo estudiante»." />}
            {estudiantes.map((e) => (
              <div key={e.id} className="mb-1 flex items-start gap-3 rounded border border-borde px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-texto">{e.nombre}</p>
                    {e.condicionEspecial ? <Insignia tono="aviso">Condición especial · {e.iniciales}</Insignia> : <Insignia>Sin condición especial</Insignia>}
                  </div>
                  {e.condicionEspecial && (
                    <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-[12px] sm:grid-cols-[auto_1fr]">
                      <dt className="text-tenue">Condición reportada</dt>
                      <dd className="text-texto">{e.condicion}</dd>
                      <dt className="text-tenue">Nivel de ajuste</dt>
                      <dd className="text-texto">{e.nivelAjuste}</dd>
                      <dt className="text-tenue">Enfoque</dt>
                      <dd className="whitespace-pre-line text-texto">{e.enfoque}</dd>
                    </dl>
                  )}
                </div>
                {!soloLectura && (
                  <div className="flex shrink-0 gap-1">
                    <BotonIcono icono={Pencil} titulo="Editar" onClick={() => abrir(e)} />
                    <BotonIcono icono={Trash2} titulo="Eliminar" className="text-error" onClick={() => setBorrar(e)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>

      <PanelLateral abierto={panel !== null && !!grado} alCerrar={cerrar} titulo={panel === 'nuevo' ? `Nuevo estudiante · ${grado?.nombre}` : `Editar estudiante · ${grado?.nombre}`} descripcion="Si tiene condición especial, sus datos van a la sección «Ajustes razonables» de cada semana.">
        {grado && (
          <form key={editando?.id ?? 'nuevo'} action={(d) => conResultado(() => (panel === 'nuevo' ? crearEstudiante(slug, grado.id, d) : editarEstudiante(slug, editando!.id, d)), panel === 'nuevo' ? 'Estudiante guardado' : 'Estudiante actualizado')} className="space-y-4">
            <Campo etiqueta="Nombre completo" requerido>
              <Entrada name="nombre" required autoFocus defaultValue={editando?.nombre ?? ''} placeholder="Nombres y apellidos" />
            </Campo>
            <Campo etiqueta="¿Tiene condición especial?" requerido>
              <Selector name="condicionEspecial" value={conCondicion ? 'si' : 'no'} onChange={(e) => setConCondicion(e.target.value === 'si')}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </Selector>
            </Campo>
            {conCondicion && (
              <div className="space-y-4 rounded-md border border-borde bg-realce p-3">
                <Campo etiqueta="Iniciales del estudiante" requerido>
                  <Entrada name="iniciales" required defaultValue={editando?.iniciales ?? ''} placeholder="A.G.B.G" className="w-40" />
                </Campo>
                <Campo etiqueta="Condición reportada" requerido>
                  <Entrada name="condicion" required defaultValue={editando?.condicion ?? ''} placeholder="TDAH (Trastorno por déficit de atención e hiperactividad)" />
                </Campo>
                <Campo etiqueta="Nivel de ajuste razonable" requerido>
                  <Entrada name="nivelAjuste" required defaultValue={editando?.nivelAjuste ?? ''} placeholder="Grado 1 y 2" />
                </Campo>
                <Campo etiqueta="Enfoque" requerido>
                  <AreaTexto name="enfoque" required rows={4} defaultValue={editando?.enfoque ?? ''} placeholder="Ajuste en la forma de presentar la actividad, el tiempo y el manejo de las transiciones, sin reducir el nivel del contenido." />
                </Campo>
              </div>
            )}
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

      <Confirmar abierto={!!borrar} titulo="Eliminar el estudiante" mensaje={`Se eliminará «${borrar?.nombre}»${borrar?.condicionEspecial ? ' y sus líneas de ajustes razonables en las semanas ya generadas' : ''}.`} ocupado={enCurso} alCerrar={() => setBorrar(null)} alAceptar={() => borrar && conResultado(() => eliminarEstudiante(slug, borrar.id), 'Estudiante eliminado', () => setBorrar(null))} />
    </>
  );
}
