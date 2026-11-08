'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GraduationCap, BookOpen, ChevronRight, Users, FileUp, Loader2, ListChecks, Save } from 'lucide-react';
import { AccionesTarjeta, CabeceraPagina, MenuFila } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Selector, Tarjeta, EstadoVacio, PanelLateral, Ventanita, Confirmar, Insignia, EtiquetaGrado, PaletaGrado, PieAcciones, BotonEliminar } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { crearGrado, renombrarGrado, eliminarGrado, crearMateria, editarMateria, eliminarMateria, importarCurriculo } from '@/acciones/unidades';
import { cn } from '@/lib/utils';
import { NIVELES, ETIQUETA_NIVEL } from '@/lib/catalogo';
import { PanelDestrezas, TablaIdentificadores, type DestrezaVista } from '@/componentes/PanelDestrezas';
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
  const cerrar = () => setPanel(null);
  const conResultado = (fn: () => Promise<{ ok: boolean; error?: string; id?: number }>, hecho: string, despues?: (id?: number) => void) =>
    arranca(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? 'No se pudo completar la acción.');
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
      {/* Alto completo: las tres columnas llegan hasta el pie y desplazan por dentro (2026-11-08). */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 xl:min-h-0 xl:flex-row xl:overflow-hidden">
        {/* Grados */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[260px] xl:shrink-0">
          <div className="border-b border-borde px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">Grados</div>
          <div className="desplaza flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1">
            {grados.length === 0 && <div className="flex flex-1 flex-col justify-center"><EstadoVacio icono={GraduationCap} titulo="Sin grados" /></div>}
            {grados.map((g) => {
              const sel = grado?.id === g.id;
              return (
                <button key={g.id} onClick={() => ir(g.id, null)} className={cn('flex w-full items-center gap-2 rounded px-2.5 py-2 text-left transition-colors foco-visible', sel ? 'bg-acento-suave' : 'hover:bg-realce')}>
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>{g.nombre}</span>
                    <span className="block truncate text-[11px] text-tenue">{ETIQUETA_NIVEL[g.nivel]}</span>
                  </span>
                  <span className="text-[11px] text-tenue">{g.materias.length}</span>
                  <ChevronRight className={cn('h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-tenue')} />
                </button>
              );
            })}
          </div>
        </Tarjeta>

        {/* Materias del grado */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[320px] xl:shrink-0">
          <div className="flex min-h-10 items-center justify-between gap-2 border-b border-borde px-3 py-1.5">
            <p className="min-w-0 truncate text-[13px] font-semibold text-texto">{grado?.nombre ?? 'Materias'}</p>
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
                <BotonIcono icono={grado.importacionEstado === 'LEYENDO' ? Loader2 : FileUp} titulo={grado.importacionEstado === 'LEYENDO' ? 'El agente está leyendo el currículo…' : 'Importar currículo (PDF del Ministerio): crea las materias que falten y añade o actualiza objetivos y destrezas con su criterio e indicador. Nunca borra nada'} onClick={() => entradaCurriculo.current?.click()} disabled={enCurso || (grado.importacionEstado === 'LEYENDO' && !grado.importacionAtascada)} className={grado.importacionEstado === 'LEYENDO' && !grado.importacionAtascada ? '[&>svg]:animate-spin' : ''} />
                <MenuFila acciones={[
                  { etiqueta: 'Renombrar', icono: Pencil, alPulsar: () => setPanel('renombrar') },
                  { etiqueta: 'Eliminar el grado', icono: Trash2, peligro: true, alPulsar: () => setBorrarG(grado) },
                ]} />
                <Boton tamano="sm" icono={Plus} onClick={() => abrirMateria(null)}>
                  Materia
                </Boton>
              </div>
            )}
          </div>
          <div className="desplaza flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1">
            {grado?.importacionEstado === 'LEYENDO' && !grado.importacionAtascada && (
              <div className="mb-2 flex items-start gap-2 rounded bg-aviso-suave px-2.5 py-2 text-[12px] text-texto">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-aviso" />
                Leyendo «{grado.importacionArchivo}». Esta pantalla se actualiza sola.
              </div>
            )}
            {grado?.importacionEstado === 'LEYENDO' && grado.importacionAtascada && <div className="mb-2"><Aviso tono="aviso" texto={`La lectura de «${grado.importacionArchivo}» se interrumpió. Lo importado se conserva: vuelve a subir el PDF.`} /></div>}
            {grado?.importacionEstado === 'ERROR' && <div className="mb-2"><Aviso texto={`No se pudo importar «${grado.importacionArchivo}»: ${grado.importacionError ?? ''}`} /></div>}
            {grado && !grado.importacionEstado && grado.importacionError && (
              <details className="mb-2 rounded bg-realce px-2.5 py-1.5 text-[11px] text-tenue">
                <summary className="cursor-pointer font-semibold">Última importación: «{grado.importacionArchivo}»</summary>
                <p className="mt-1 whitespace-pre-line">{grado.importacionError}</p>
              </details>
            )}
            {grado && grado.materias.length === 0 && <div className="flex flex-1 flex-col justify-center"><EstadoVacio icono={BookOpen} titulo="Sin materias" /></div>}
            {grado?.materias.map((m) => {
              const sel = materia?.id === m.id;
              return (
                <button key={m.id} onClick={() => ir(grado.id, m.id)} className={cn('flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition-colors foco-visible', sel ? 'bg-acento-suave' : 'hover:bg-realce')}>
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-[13px] font-semibold', sel ? 'text-acento' : 'text-texto')}>{m.nombre}</p>
                    <p className="truncate text-[11px] text-tenue">{m.docentes.length ? m.docentes.map((d) => d.nombre).join(' · ') : 'Sin docentes'}</p>
                  </div>
                  <ChevronRight className={cn('mt-1 h-4 w-4 shrink-0', sel ? 'text-acento' : 'text-tenue')} />
                </button>
              );
            })}
          </div>
        </Tarjeta>

        {/* Detalle de la materia */}
        <Tarjeta className="flex min-h-0 flex-1 flex-col">
          {!materia ? (
            <div className="flex flex-1 items-center justify-center">
              <EstadoVacio icono={BookOpen} titulo="Elige una materia" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-texto">{materia.nombre}</h2>
                  {grado && <EtiquetaGrado nombre={grado.nombre} color={grado.color} />}
                </div>
                {/* Selección de destrezas (con su criterio e indicador), a la izquierda de Editar (Fernando, 2026-09-18).
                    Botones en escritorio y «⋯» en el teléfono; la que borra, en rojo y al final. */}
                {!soloLectura && (
                  <AccionesTarjeta acciones={[
                    { etiqueta: 'Destrezas', icono: ListChecks, alPulsar: () => setPanelDestrezas(true) },
                    { etiqueta: 'Editar', icono: Pencil, alPulsar: () => abrirMateria(materia) },
                    { etiqueta: 'Eliminar', icono: Trash2, peligro: true, titulo: 'Eliminar la materia', alPulsar: () => setBorrarM(materia) },
                  ]} />
                )}
              </div>
              <div className="desplaza min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <section>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Descripción</h3>
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-texto">{materia.descripcion || <span className="text-tenue">Sin descripción.</span>}</p>
                </section>
                <section>
                  <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-tenue">
                    <Users className="h-3.5 w-3.5" /> Docentes
                  </h3>
                  {materia.docentes.length ? (
                    <ul className="flex flex-wrap gap-x-3 gap-y-1">
                      {materia.docentes.map((d) => (
                        <li key={d.id}>
                          <Insignia tono="info">{d.nombre}</Insignia>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-tenue">Sin docentes.</p>
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
                    <p className="text-[13px] text-tenue">Sin objetivos.</p>
                  )}
                </section>
                <section>
                  {/* Los seleccionados, en tabla destreza · criterio · indicador (Fernando, 2026-09-18); se eligen con «Destrezas», arriba. */}
                  <h3 className="mb-1 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-wide text-tenue">
                    Identificadores
                    <span className="font-normal normal-case tracking-normal">{destrezas.filter((d) => d.activa !== false).length} de {destrezas.length}</span>
                  </h3>
                  {destrezas.some((d) => d.activa !== false) ? <TablaIdentificadores destrezas={destrezas.filter((d) => d.activa !== false)} /> : <p className="text-[13px] text-tenue">Ninguna seleccionada.</p>}
                </section>
                <div className="grid gap-4 sm:grid-cols-2">
                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Unidades</h3>
                    <p className="text-[13px] text-texto">{materia.unidades ?? <span className="text-tenue">No indicada</span>}</p>
                  </section>
                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Planificaciones</h3>
                    <p className="text-[13px] text-texto">{materia.planificaciones}</p>
                  </section>
                </div>
              </div>
            </>
          )}
        </Tarjeta>
      </div>

      {/* Nuevo grado / renombrar: una o dos casillas → ventanita */}
      <Ventanita
        abierto={panel === 'grado' || panel === 'renombrar'}
        alCerrar={cerrar}
        titulo={panel === 'grado' ? 'Nuevo grado' : 'Renombrar el grado'}
        pie={
          <>
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-grado" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </>
        }
      >
        <form id="form-grado" key={panel ?? 'x'} action={(d) => conResultado(() => (panel === 'grado' ? crearGrado(slug, d) : renombrarGrado(slug, grado!.id, d)), 'Guardado.', (id) => panel === 'grado' && ir(id ?? null, null))} className="space-y-4">
          <Campo etiqueta="Nombre" requerido>
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
            <Campo etiqueta="Color">
              <PaletaGrado name="color" valor={grado.color} />
            </Campo>
          )}
        </form>
      </Ventanita>

      {/* Materia: alta y edición */}
      <PanelLateral
        abierto={(panel === 'materia' || panel === 'editarMateria') && !!grado}
        alCerrar={cerrar}
        titulo={panel === 'materia' ? `Nueva materia · ${grado?.nombre}` : `Editar materia · ${grado?.nombre}`}
        pie={
          <PieAcciones eliminar={panel === 'editarMateria' && materia ? <BotonEliminar titulo="Eliminar la materia" onClick={() => setBorrarM(materia)} disabled={enCurso} /> : undefined}>
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-materia" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        {grado && (
          <form id="form-materia" key={panel === 'editarMateria' ? materia?.id : 'nueva'} action={(d) => conResultado(() => (panel === 'materia' ? crearMateria(slug, grado.id, d) : editarMateria(slug, materia!.id, d)), 'Guardado.', (id) => ir(grado.id, id ?? materia?.id ?? null))} className="space-y-4">
            <Campo etiqueta="Nombre" requerido>
              <Entrada name="nombre" required autoFocus defaultValue={panel === 'editarMateria' ? materia?.nombre : ''} placeholder="Identidad y Autonomía" />
            </Campo>
            <Campo etiqueta="Descripción">
              <AreaTexto name="descripcion" rows={3} defaultValue={panel === 'editarMateria' ? (materia?.descripcion ?? '') : ''} />
            </Campo>
            <Campo etiqueta="Unidades">
              <Entrada name="unidades" type="number" min={0} max={99} className="w-32" defaultValue={panel === 'editarMateria' ? (materia?.unidades ?? '') : ''} />
            </Campo>
            <Campo etiqueta={`Docentes (${elegidos.length})`}>
              {elegidos.map((id) => (
                <input key={id} type="hidden" name="docentes" value={id} />
              ))}
              <div className="desplaza max-h-56 space-y-1 overflow-y-auto rounded border border-borde p-2">
                {docentes.length === 0 && <p className="text-[12px] text-tenue">Sin cuentas activas.</p>}
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
          </form>
        )}
      </PanelLateral>

      <PanelLateral abierto={panelDestrezas && !!materia} alCerrar={() => setPanelDestrezas(false)} titulo={`Destrezas · ${materia?.nombre ?? ''}`} ancho="lg">
        {materia && <PanelDestrezas slug={slug} materiaGradoId={materia.id} destrezas={destrezas} puedo={!soloLectura} />}
      </PanelLateral>

      <Confirmar abierto={!!borrarG} titulo="Eliminar el grado" mensaje={`Se eliminará «${borrarG?.nombre}» con sus ${borrarG?.materias.length ?? 0} materia(s), sus asignaciones y sus horas en los horarios. Las planificaciones ya creadas se conservan.`} ocupado={enCurso} alCerrar={() => setBorrarG(null)} alAceptar={() => borrarG && conResultado(() => eliminarGrado(slug, borrarG.id), 'Eliminado.', () => { setBorrarG(null); ir(null, null); })} />
      <Confirmar abierto={!!borrarM} titulo="Eliminar la materia" mensaje={`Se eliminará «${borrarM?.nombre}» de ${grado?.nombre}, con sus asignaciones y sus horas en los horarios. Las planificaciones ya creadas se conservan.`} ocupado={enCurso} alCerrar={() => setBorrarM(null)} alAceptar={() => borrarM && conResultado(() => eliminarMateria(slug, borrarM.id), 'Eliminada.', () => { setBorrarM(null); ir(grado?.id ?? null, null); })} />
    </>
  );
}
