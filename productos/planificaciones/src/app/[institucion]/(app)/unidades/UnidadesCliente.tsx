'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GraduationCap, BookOpen, ChevronRight, Users, FileUp, Loader2, ListChecks } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Selector, Tarjeta, EstadoVacio, PanelLateral, Ventanita, Confirmar, Insignia, EtiquetaGrado, PaletaGrado } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { crearGrado, renombrarGrado, eliminarGrado, crearMateria, editarMateria, eliminarMateria, importarCurriculo } from '@/acciones/unidades';
import { cn } from '@/lib/utils';
import { NIVELES, ETIQUETA_NIVEL } from '@/lib/catalogo';
import { PanelDestrezas, type DestrezaVista } from '@/componentes/PanelDestrezas';
import type { Nivel } from '@/generated/prisma/enums';

export type DocenteVista = { id: number; nombre: string; rol: string };
export type MateriaVista = { id: number; nombre: string; descripcion: string | null; unidades: number | null; docentes: { id: number; nombre: string }[]; planificaciones: number; objetivos: { codigo: string; descripcion: string }[]; destrezas: number };
export type GradoVista = { id: number; nombre: string; nivel: Nivel; color: string; importacionEstado: string | null; importacionError: string | null; importacionArchivo: string | null; importacionAtascada: boolean; materias: MateriaVista[] };

/**
 * EL MÓDULO «UNIDADES» (Fernando, 2026-09-16): a la izquierda los grados; en el
 * medio las materias del grado elegido; a la derecha el detalle de la materia
 * elegida (descripción, docentes que la dan, cantidad de unidades). Solo el
 * administrador. Lo que se arma aquí es lo que cada docente puede elegir al
 * planificar y poner en su horario.
 */
export default function UnidadesCliente({ slug, grados, docentes, gradoId, materiaId, destrezas, soloLectura }: { slug: string; grados: GradoVista[]; docentes: DocenteVista[]; gradoId: number | null; materiaId: number | null; destrezas: DestrezaVista[]; soloLectura: boolean }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const grado = grados.find((g) => g.id === gradoId) ?? grados[0] ?? null;
  const materia = grado?.materias.find((m) => m.id === materiaId) ?? null;
  const [panel, setPanel] = useState<'grado' | 'renombrar' | 'materia' | 'editarMateria' | null>(null);
  const [borrarG, setBorrarG] = useState<GradoVista | null>(null);
  const [borrarM, setBorrarM] = useState<MateriaVista | null>(null);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [panelDestrezas, setPanelDestrezas] = useState(false);
  const entradaCurriculo = useRef<HTMLInputElement>(null);

  // Mientras el agente lee el currículo de un grado, la pantalla se refresca sola.
  const leyendo = grados.some((g) => g.importacionEstado === 'LEYENDO');
  useEffect(() => {
    if (!leyendo) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [leyendo, router]);

  const ir = (g: number | null, m: number | null) => router.push(`/${slug}/unidades${g ? `?g=${g}${m ? `&m=${m}` : ''}` : ''}`);
  const cerrar = () => {
    setPanel(null);
    setError(null);
  };
  const conResultado = (fn: () => Promise<{ ok: boolean; error?: string; id?: number }>, hecho: string, despues?: (id?: number) => void) =>
    arranca(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? 'No se pudo completar la acción');
      toast.success(hecho);
      cerrar();
      despues?.(r.id);
      router.refresh();
    });
  const abrirMateria = (m: MateriaVista | null) => {
    setElegidos(m ? m.docentes.map((d) => d.id) : []);
    setPanel(m ? 'editarMateria' : 'materia');
  };

  return (
    <>
      <CabeceraPagina
        titulo="Unidades"
        descripcion="Los grados de la institución, sus materias y qué docentes dan cada una"
        acciones={
          <Boton icono={Plus} onClick={() => setPanel('grado')} disabled={soloLectura}>
            Nuevo grado
          </Boton>
        }
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:h-[calc(100vh-61px)] xl:flex-row xl:overflow-hidden">
        {/* Grados */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[260px] xl:shrink-0">
          <div className="border-b border-borde px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">Grados</div>
          <div className="desplaza min-h-0 flex-1 overflow-y-auto p-2">
            {grados.length === 0 && <EstadoVacio icono={GraduationCap} titulo="Sin grados todavía" detalle="Crea el primero con «Nuevo grado»." />}
            {grados.map((g) => {
              const sel = grado?.id === g.id;
              return (
                <button key={g.id} onClick={() => ir(g.id, null)} className={cn('mb-1 flex w-full items-center gap-2 rounded px-2.5 py-2 text-left transition-colors foco-visible', sel ? 'bg-acento-suave border-l-2 border-acento' : 'border-l-2 border-transparent hover:bg-realce')}>
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>{g.nombre}</span>
                    <span className="block truncate text-[11px] text-tenue">{ETIQUETA_NIVEL[g.nivel]}</span>
                  </span>
                  <span className="text-[11px] text-tenue">{g.materias.length}</span>
                  <ChevronRight className={cn('h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-borde')} />
                </button>
              );
            })}
          </div>
        </Tarjeta>

        {/* Materias del grado */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[320px] xl:shrink-0">
          <div className="flex items-center justify-between gap-2 border-b border-borde px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-texto">{grado?.nombre ?? 'Materias'}</p>
              <p className="text-[11px] text-tenue">{grado ? `${grado.materias.length} materia${grado.materias.length === 1 ? '' : 's'}` : 'Elige un grado'}</p>
            </div>
            {grado && !soloLectura && (
              <div className="flex items-center gap-1">
                <input
                  ref={entradaCurriculo}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f || !grado) return;
                    const d = new FormData();
                    d.set('archivo', f);
                    conResultado(() => importarCurriculo(slug, grado.id, d), 'Currículo recibido: el agente está leyéndolo');
                    e.target.value = '';
                  }}
                />
                {/* Solo icono: el texto no cabe en la cabecera (Fernando, 2026-09-17). */}
                <BotonIcono icono={grado.importacionEstado === 'LEYENDO' ? Loader2 : FileUp} titulo={grado.importacionEstado === 'LEYENDO' ? 'El agente está leyendo el currículo…' : 'Importar currículo (PDF del Ministerio): crea las materias, sus objetivos y la tabla destreza · criterio · indicador'} onClick={() => entradaCurriculo.current?.click()} disabled={enCurso || (grado.importacionEstado === 'LEYENDO' && !grado.importacionAtascada)} className={grado.importacionEstado === 'LEYENDO' && !grado.importacionAtascada ? '[&>svg]:animate-spin' : ''} />
                <BotonIcono icono={Pencil} titulo="Renombrar el grado" onClick={() => setPanel('renombrar')} />
                <BotonIcono icono={Trash2} titulo="Eliminar el grado" className="text-error" onClick={() => setBorrarG(grado)} />
                <Boton tamano="sm" icono={Plus} onClick={() => abrirMateria(null)}>
                  Materia
                </Boton>
              </div>
            )}
          </div>
          <div className="desplaza min-h-0 flex-1 overflow-y-auto p-2">
            {grado?.importacionEstado === 'LEYENDO' && !grado.importacionAtascada && (
              <div className="mb-2 flex items-start gap-2 rounded bg-aviso-suave px-2.5 py-2 text-[12px] text-texto">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-aviso" />
                El agente está leyendo «{grado.importacionArchivo}», ámbito por ámbito. Tarda unos minutos; esta pantalla se actualiza sola.
              </div>
            )}
            {grado?.importacionEstado === 'LEYENDO' && grado.importacionAtascada && <div className="mb-2"><Aviso tono="aviso" texto={`La lectura de «${grado.importacionArchivo}» se interrumpió (lleva más de 15 minutos). Lo importado hasta ese punto se conserva; vuelve a subir el PDF para completar el resto.`} /></div>}
            {grado?.importacionEstado === 'ERROR' && <div className="mb-2"><Aviso texto={`No se pudo importar «${grado.importacionArchivo}»: ${grado.importacionError ?? ''}`} /></div>}
            {grado && !grado.importacionEstado && grado.importacionError && (
              <details className="mb-2 rounded bg-realce px-2.5 py-1.5 text-[11px] text-tenue">
                <summary className="cursor-pointer font-semibold">Última importación: «{grado.importacionArchivo}»</summary>
                <p className="mt-1 whitespace-pre-line">{grado.importacionError}</p>
              </details>
            )}
            {grado && grado.materias.length === 0 && <EstadoVacio icono={BookOpen} titulo="Sin materias" detalle="Añade la primera materia de este grado o importa el currículo priorizado del Ministerio." />}
            {grado?.materias.map((m) => {
              const sel = materia?.id === m.id;
              return (
                <button key={m.id} onClick={() => ir(grado.id, m.id)} className={cn('mb-1 flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition-colors foco-visible', sel ? 'bg-acento-suave border-l-2 border-acento' : 'border-l-2 border-transparent hover:bg-realce')}>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>{m.nombre}</p>
                    <p className="truncate text-[11px] text-tenue">{m.docentes.length ? m.docentes.map((d) => d.nombre).join(' · ') : 'Sin docentes asignados'}</p>
                  </div>
                  <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-borde')} />
                </button>
              );
            })}
          </div>
        </Tarjeta>

        {/* Detalle de la materia */}
        <Tarjeta className="flex min-h-0 flex-1 flex-col">
          {!materia ? (
            <div className="flex flex-1 items-center justify-center">
              <EstadoVacio icono={BookOpen} titulo="Elige una materia" detalle="Verás su descripción, los docentes que la dan y sus unidades." />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-texto">{materia.nombre}</h2>
                  {grado && <EtiquetaGrado nombre={grado.nombre} color={grado.color} />}
                </div>
                {!soloLectura && (
                  <div className="flex items-center gap-1">
                    <Boton variante="secundario" tamano="sm" icono={Pencil} onClick={() => abrirMateria(materia)}>
                      Editar
                    </Boton>
                    <BotonIcono icono={Trash2} titulo="Eliminar la materia" className="text-error" onClick={() => setBorrarM(materia)} />
                  </div>
                )}
              </div>
              <div className="desplaza min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <section>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Descripción</h3>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-texto">{materia.descripcion || <span className="text-tenue">Sin descripción.</span>}</p>
                </section>
                <section>
                  <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">
                    <Users className="h-3.5 w-3.5" /> Docentes que dan la materia
                  </h3>
                  {materia.docentes.length ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {materia.docentes.map((d) => (
                        <li key={d.id}>
                          <Insignia tono="info">{d.nombre}</Insignia>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-tenue">Nadie todavía. Sin docentes asignados, ningún profesor puede elegir esta materia al planificar ni ponerla en su horario.</p>
                  )}
                </section>
                <section>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Objetivos</h3>
                  {materia.objetivos.length ? (
                    <ul className="space-y-1 text-[12px] text-texto">
                      {materia.objetivos.map((o) => (
                        <li key={o.codigo}>
                          <span className="font-semibold">{o.codigo}</span> <span className="text-tenue">{o.descripcion}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-tenue">Sin objetivos. Llegan al importar el currículo priorizado del grado.</p>
                  )}
                </section>
                <section>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Destrezas con criterio de desempeño</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[13px] text-texto">
                      {destrezas.filter((d) => d.activa !== false).length} seleccionada{destrezas.filter((d) => d.activa !== false).length === 1 ? '' : 's'} de {destrezas.length}
                    </p>
                    {/* La selección y la edición van en un panel lateral; en Planificaciones solo se ven (Fernando, 2026-09-17). */}
                    <Boton variante="secundario" tamano="sm" icono={ListChecks} onClick={() => setPanelDestrezas(true)}>
                      Destrezas
                    </Boton>
                  </div>
                </section>
                <div className="grid gap-4 sm:grid-cols-2">
                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Cantidad de unidades</h3>
                    <p className="text-[13px] text-texto">{materia.unidades ?? <span className="text-tenue">No indicada</span>}</p>
                  </section>
                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Planificaciones creadas</h3>
                    <p className="text-[13px] text-texto">{materia.planificaciones}</p>
                  </section>
                </div>
              </div>
            </>
          )}
        </Tarjeta>
      </div>

      {/* Nuevo grado / renombrar: una o dos casillas → ventanita */}
      <Ventanita abierto={panel === 'grado' || panel === 'renombrar'} alCerrar={cerrar} titulo={panel === 'grado' ? 'Nuevo grado' : 'Renombrar el grado'}>
        <form action={(d) => conResultado(() => (panel === 'grado' ? crearGrado(slug, d) : renombrarGrado(slug, grado!.id, d)), panel === 'grado' ? 'Grado creado' : 'Grado renombrado', (id) => panel === 'grado' && ir(id ?? null, null))} className="space-y-4">
          <Campo etiqueta="Nombre del grado" requerido>
            <Entrada name="nombre" required autoFocus defaultValue={panel === 'renombrar' ? grado?.nombre : ''} placeholder="Primer grado" />
          </Campo>
          <Campo etiqueta="Nivel" requerido>
            <Selector name="nivel" defaultValue={panel === 'renombrar' ? grado?.nivel : 'PREPARATORIA'}>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  {ETIQUETA_NIVEL[n]}
                </option>
              ))}
            </Selector>
          </Campo>
          {/* Al crearlo el color sale al azar; al renombrar se puede cambiar. */}
          {panel === 'renombrar' && grado && (
            <Campo etiqueta="Color del grado">
              <PaletaGrado name="color" valor={grado.color} />
            </Campo>
          )}
          {error && <Aviso texto={error} />}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </Ventanita>

      {/* Materia: alta y edición */}
      <PanelLateral abierto={(panel === 'materia' || panel === 'editarMateria') && !!grado} alCerrar={cerrar} titulo={panel === 'materia' ? `Nueva materia · ${grado?.nombre}` : `Editar materia · ${grado?.nombre}`} descripcion="Los docentes marcados podrán elegirla al planificar y ponerla en su horario.">
        {grado && (
          <form action={(d) => conResultado(() => (panel === 'materia' ? crearMateria(slug, grado.id, d) : editarMateria(slug, materia!.id, d)), panel === 'materia' ? 'Materia añadida' : 'Materia guardada', (id) => ir(grado.id, id ?? materia?.id ?? null))} className="space-y-4">
            <Campo etiqueta="Nombre de la materia" requerido>
              <Entrada name="nombre" required autoFocus defaultValue={panel === 'editarMateria' ? materia?.nombre : ''} placeholder="Identidad y Autonomía" />
            </Campo>
            <Campo etiqueta="Descripción">
              <AreaTexto name="descripcion" rows={3} defaultValue={panel === 'editarMateria' ? (materia?.descripcion ?? '') : ''} />
            </Campo>
            <Campo etiqueta="Cantidad de unidades (opcional)">
              <Entrada name="unidades" type="number" min={0} max={99} className="w-32" defaultValue={panel === 'editarMateria' ? (materia?.unidades ?? '') : ''} />
            </Campo>
            <Campo etiqueta={`Docentes que dan la materia (${elegidos.length})`}>
              {elegidos.map((id) => (
                <input key={id} type="hidden" name="docentes" value={id} />
              ))}
              <div className="desplaza max-h-56 space-y-1 overflow-y-auto rounded border border-borde p-2">
                {docentes.length === 0 && <p className="text-[12px] text-tenue">No hay cuentas activas. Créalas en Usuarios.</p>}
                {docentes.map((d) => {
                  const marcado = elegidos.includes(d.id);
                  return (
                    <label key={d.id} className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors', marcado ? 'bg-acento-suave' : 'hover:bg-realce')}>
                      <input type="checkbox" checked={marcado} onChange={() => setElegidos((v) => (marcado ? v.filter((x) => x !== d.id) : [...v, d.id]))} className="h-4 w-4 accent-[var(--color-acento)]" />
                      <span className="flex-1">{d.nombre}</span>
                      {d.rol === 'ADMIN' && <span className="text-[11px] text-tenue">administrador</span>}
                    </label>
                  );
                })}
              </div>
            </Campo>
            {error && <Aviso texto={error} />}
            <div className="flex justify-end gap-2 border-t border-borde pt-4">
              <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={enCurso}>
                {enCurso ? 'Guardando…' : panel === 'materia' ? 'Añadir materia' : 'Guardar'}
              </Boton>
            </div>
          </form>
        )}
      </PanelLateral>

      <PanelLateral abierto={panelDestrezas && !!materia} alCerrar={() => setPanelDestrezas(false)} titulo={`Destrezas · ${materia?.nombre ?? ''}`} descripcion="Marca las destrezas que se usan en esta materia: cada una lleva su criterio y su indicador de evaluación. Es lo que el docente ve en Identificadores y entre lo que el agente elige." ancho="lg">
        {materia && <PanelDestrezas slug={slug} materiaGradoId={materia.id} destrezas={destrezas} puedo={!soloLectura} />}
      </PanelLateral>

      <Confirmar abierto={!!borrarG} titulo="Eliminar el grado" mensaje={`Se eliminará «${borrarG?.nombre}» con sus ${borrarG?.materias.length ?? 0} materia(s), sus asignaciones y sus horas en los horarios. Las planificaciones ya creadas se conservan.`} ocupado={enCurso} alCerrar={() => setBorrarG(null)} alAceptar={() => borrarG && conResultado(() => eliminarGrado(slug, borrarG.id), 'Grado eliminado', () => { setBorrarG(null); ir(null, null); })} />
      <Confirmar abierto={!!borrarM} titulo="Eliminar la materia" mensaje={`Se eliminará «${borrarM?.nombre}» de ${grado?.nombre}, con sus asignaciones y sus horas en los horarios. Las planificaciones ya creadas se conservan.`} ocupado={enCurso} alCerrar={() => setBorrarM(null)} alAceptar={() => borrarM && conResultado(() => eliminarMateria(slug, borrarM.id), 'Materia eliminada', () => { setBorrarM(null); ir(grado?.id ?? null, null); })} />
    </>
  );
}
