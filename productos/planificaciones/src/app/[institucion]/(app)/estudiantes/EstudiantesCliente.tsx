'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronRight, Users, Save } from 'lucide-react';
import { CabeceraPagina, MenuFila } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, AreaTexto, Selector, Tarjeta, EstadoVacio, PanelLateral, Confirmar, Insignia, Tabla, PieAcciones, BotonEliminar } from '@/componentes/ui';
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
  const grado = grados.find((g) => g.id === gradoId) ?? null;
  const [panel, setPanel] = useState<'nuevo' | 'editar' | null>(null);
  const [editando, setEditando] = useState<EstudianteVista | null>(null);
  const [borrar, setBorrar] = useState<EstudianteVista | null>(null);
  const [conCondicion, setConCondicion] = useState(false);

  const ir = (g: number | null) => router.push(`/${slug}/estudiantes${g ? `?g=${g}` : ''}`);
  const cerrar = () => {
    setPanel(null);
    setEditando(null);
  };
  const abrir = (e: EstudianteVista | null) => {
    setEditando(e);
    setConCondicion(e?.condicionEspecial ?? false);
    setPanel(e ? 'editar' : 'nuevo');
  };
  const conResultado = (fn: () => Promise<{ ok: boolean; error?: string; id?: number }>, hecho: string, despues?: () => void) =>
    arranca(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? 'No se pudo completar la acción.');
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
        descripcion="Los estudiantes de tus grados. Los que tienen condición especial llevan una línea de ajustes razonables en cada semana."
        acciones={
          <Boton icono={Plus} onClick={() => abrir(null)} disabled={soloLectura || !grado}>
            Nuevo estudiante
          </Boton>
        }
      />
      {/* Alto completo: las dos columnas llegan hasta el pie y desplazan por dentro (2026-11-08). */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 xl:min-h-0 xl:flex-row xl:overflow-hidden">
        {/* Grados del docente */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[280px] xl:shrink-0">
          <div className="border-b border-borde px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">Mis grados</div>
          <div className="desplaza flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1">
            {grados.length === 0 && <div className="flex flex-1 flex-col justify-center"><EstadoVacio icono={Users} titulo="Sin grados" detalle="Te los asigna el administrador en Unidades." /></div>}
            {grados.map((g) => {
              const sel = grado?.id === g.id;
              return (
                <button key={g.id} onClick={() => ir(g.id)} className={cn('flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition-colors foco-visible', sel ? 'bg-acento-suave' : 'hover:bg-realce')}>
                  <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>{g.nombre}</p>
                    <p className="truncate text-[11px] text-tenue">{g.materias.join(' · ')}</p>
                  </div>
                  <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-tenue')} />
                </button>
              );
            })}
          </div>
        </Tarjeta>

        {/* Estudiantes del grado, en tabla (galería en el teléfono) con el recuento al pie. */}
        <Tarjeta className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-10 shrink-0 items-center border-b border-borde px-4">
            <p className="truncate text-[13px] font-semibold text-texto">{grado?.nombre ?? 'Estudiantes'}</p>
          </div>
          <div className="desplaza flex min-h-0 flex-1 flex-col overflow-y-auto">
            {!grado ? (
              <div className="flex flex-1 flex-col justify-center"><EstadoVacio icono={Users} titulo="Elige un grado" /></div>
            ) : (
              <Tabla
                filas={estudiantes}
                claveFila={(e) => e.id}
                alPulsarFila={soloLectura ? undefined : (e) => abrir(e)}
                recuento={`${estudiantes.length} ${estudiantes.length === 1 ? 'estudiante' : 'estudiantes'} · ${especiales} con condición especial`}
                vacio={<div className="flex flex-1 flex-col justify-center"><EstadoVacio icono={Users} titulo="Sin estudiantes" /></div>}
                columnas={[
                  { clave: 'nombre', titulo: 'Estudiante', ancho: '26%', render: (e) => <span className="block truncate font-semibold text-texto">{e.nombre}</span> },
                  { clave: 'condicion', titulo: 'Condición', ancho: '16%', render: (e) => (e.condicionEspecial ? <Insignia tono="aviso">Especial · {e.iniciales}</Insignia> : <Insignia>Ninguna</Insignia>) },
                  { clave: 'reportada', titulo: 'Reportada', ancho: '20%', render: (e) => <span className="block truncate" title={e.condicion ?? undefined}>{e.condicion || '—'}</span> },
                  { clave: 'nivel', titulo: 'Nivel', ancho: '12%', render: (e) => <span className="block truncate">{e.nivelAjuste || '—'}</span> },
                  { clave: 'enfoque', titulo: 'Enfoque', ancho: '26%', render: (e) => <span className="line-clamp-2 text-tenue" title={e.enfoque ?? undefined}>{e.enfoque || '—'}</span> },
                  ...(soloLectura
                    ? []
                    : [{
                        clave: 'acciones',
                        titulo: '',
                        ancho: '56px',
                        alinear: 'der' as const,
                        render: (e: EstudianteVista) => (
                          <div className="flex justify-end" onClick={(ev) => ev.stopPropagation()}>
                            <MenuFila acciones={[
                              { etiqueta: 'Editar', icono: Pencil, alPulsar: () => abrir(e) },
                              { etiqueta: 'Eliminar', icono: Trash2, peligro: true, alPulsar: () => setBorrar(e) },
                            ]} />
                          </div>
                        ),
                      }]),
                ]}
              />
            )}
          </div>
        </Tarjeta>
      </div>

      <PanelLateral
        abierto={panel !== null && !!grado}
        alCerrar={cerrar}
        titulo={panel === 'nuevo' ? `Nuevo estudiante · ${grado?.nombre}` : `Editar estudiante · ${grado?.nombre}`}
        pie={
          <PieAcciones eliminar={panel === 'editar' && editando ? <BotonEliminar titulo="Eliminar el estudiante" onClick={() => setBorrar(editando)} disabled={enCurso} /> : undefined}>
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-estudiante" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        {grado && (
          <form id="form-estudiante" key={editando?.id ?? 'nuevo'} action={(d) => conResultado(() => (panel === 'nuevo' ? crearEstudiante(slug, grado.id, d) : editarEstudiante(slug, editando!.id, d)), 'Guardado.')} className="space-y-4">
            <Campo etiqueta="Nombre completo" requerido>
              <Entrada name="nombre" required autoFocus defaultValue={editando?.nombre ?? ''} placeholder="Nombres y apellidos" />
            </Campo>
            <Campo etiqueta="Condición especial" requerido>
              <Selector name="condicionEspecial" value={conCondicion ? 'si' : 'no'} onChange={(e) => setConCondicion(e.target.value === 'si')}>
                <option value="no">No</option>
                <option value="si">Sí</option>
              </Selector>
            </Campo>
            {conCondicion && (
              <div className="space-y-4 rounded-md border border-borde bg-realce p-3">
                <Campo etiqueta="Iniciales" requerido>
                  <Entrada name="iniciales" required defaultValue={editando?.iniciales ?? ''} placeholder="A.G.B.G" className="w-40" />
                </Campo>
                <Campo etiqueta="Condición reportada" requerido>
                  <Entrada name="condicion" required defaultValue={editando?.condicion ?? ''} placeholder="TDAH (Trastorno por déficit de atención e hiperactividad)" />
                </Campo>
                <Campo etiqueta="Nivel de ajuste" requerido>
                  <Entrada name="nivelAjuste" required defaultValue={editando?.nivelAjuste ?? ''} placeholder="Grado 1 y 2" />
                </Campo>
                <Campo etiqueta="Enfoque" requerido>
                  <AreaTexto name="enfoque" required rows={4} defaultValue={editando?.enfoque ?? ''} placeholder="Ajuste en la forma de presentar la actividad, el tiempo y el manejo de las transiciones, sin reducir el nivel del contenido." />
                </Campo>
              </div>
            )}
          </form>
        )}
      </PanelLateral>

      <Confirmar abierto={!!borrar} titulo="Eliminar el estudiante" mensaje={`Se eliminará «${borrar?.nombre}»${borrar?.condicionEspecial ? ' y sus líneas de ajustes razonables en las semanas ya generadas' : ''}.`} ocupado={enCurso} alCerrar={() => setBorrar(null)} alAceptar={() => borrar && conResultado(() => eliminarEstudiante(slug, borrar.id), 'Eliminado.', () => setBorrar(null))} />
    </>
  );
}
