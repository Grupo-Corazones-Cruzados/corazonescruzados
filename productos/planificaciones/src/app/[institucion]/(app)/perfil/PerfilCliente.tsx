'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileDown, FileUp, X } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Tarjeta } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { guardarPerfil } from '@/acciones/perfil';
import { guardarCeldaHorario, importarHorario } from '@/acciones/horario';
import { ETIQUETA_ROL } from '@/lib/permisos';
import { DIAS, ETIQUETA_DIA, HORAS, SIN_CLASE, etiquetaHora, type CeldaHorario, type OpcionMateria } from '@/lib/horario-tipos';
import { cn } from '@/lib/utils';
import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * MI PERFIL (Fernando, 2026-09-16): a la izquierda «Mis datos» (nombre, profesión,
 * correo y, debajo, la contraseña) ocupando la altura de la pantalla; a la derecha
 * el HORARIO DE CLASES: la rejilla de lunes a viernes de 07:00 a 15:00, donde cada
 * celda se elige pulsándola (materias asignadas o «Sin clase»), y los botones para
 * exportar la plantilla en Excel e importarla rellenada. De este horario salen los
 * periodos de cada planificación semanal.
 */
export default function PerfilCliente({ slug, perfil, materias, horario, soloLectura }: { slug: string; perfil: { usuario: string; nombre: string; profesion: string | null; email: string | null; rol: RolUsuario }; materias: OpcionMateria[]; horario: CeldaHorario[]; soloLectura: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  const [celdas, setCeldas] = useState<CeldaHorario[]>(horario);
  const [abierta, setAbierta] = useState<{ dia: number; hora: number } | null>(null);
  const entradaExcel = useRef<HTMLInputElement>(null);
  const porMateria = new Map(materias.map((m) => [m.id, m]));
  const celda = (dia: number, hora: number) => celdas.find((c) => c.dia === dia && c.hora === hora);

  const poner = (dia: number, hora: number, valor: number | 'sin-clase' | 'vacio') => {
    setAbierta(null);
    // Se pinta en el acto y se confirma con el servidor; si falla, se vuelve atrás.
    const antes = celdas;
    setCeldas((v) => {
      const sin = v.filter((c) => !(c.dia === dia && c.hora === hora));
      return valor === 'vacio' ? sin : [...sin, { dia, hora, materiaGradoId: valor === 'sin-clase' ? null : valor }];
    });
    arranca(async () => {
      const r = await guardarCeldaHorario(slug, dia, hora, valor);
      if (!r.ok) {
        setCeldas(antes);
        toast.error(r.error);
      }
    });
  };

  // Cuántas horas de cada materia: es el número de periodos que tendrá su planificación.
  const horasPor = new Map<number, number>();
  for (const c of celdas) if (c.materiaGradoId !== null) horasPor.set(c.materiaGradoId, (horasPor.get(c.materiaGradoId) ?? 0) + 1);

  return (
    <>
      <CabeceraPagina titulo="Mi perfil" descripcion={`${perfil.usuario} · ${ETIQUETA_ROL[perfil.rol]}`} />
      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:h-[calc(100vh-61px)] xl:flex-row xl:overflow-hidden">
        {/* Mis datos: estrecho y a toda la altura */}
        <Tarjeta className="flex min-h-0 flex-col xl:w-[360px] xl:shrink-0">
          <div className="border-b border-borde px-4 py-3">
            <h2 className="text-[13px] font-semibold">Mis datos</h2>
            <p className="text-[11px] text-tenue">Así sales en el formato: «{[perfil.profesion, perfil.nombre].filter(Boolean).join(' ')}».</p>
          </div>
          <form
            id="form-perfil"
            action={(d) =>
              arranca(async () => {
                setError(null);
                const r = await guardarPerfil(slug, d);
                if (!r.ok) return setError(r.error);
                toast.success('Perfil guardado');
                (document.getElementById('form-perfil') as HTMLFormElement | null)?.querySelectorAll<HTMLInputElement>('input[type=password]').forEach((i) => (i.value = ''));
                router.refresh();
              })
            }
            className="desplaza min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            <Campo etiqueta="Profesión / título">
              <Entrada name="profesion" defaultValue={perfil.profesion ?? ''} placeholder="Lcda." />
            </Campo>
            <Campo etiqueta="Nombre" requerido>
              <Entrada name="nombre" defaultValue={perfil.nombre} required />
            </Campo>
            <Campo etiqueta="Correo">
              <Entrada name="email" type="email" defaultValue={perfil.email ?? ''} />
            </Campo>
            <div className="space-y-4 border-t border-borde pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">Cambiar la contraseña (opcional)</p>
              <Campo etiqueta="Contraseña actual">
                <Entrada name="actual" type="password" autoComplete="current-password" />
              </Campo>
              <Campo etiqueta="Contraseña nueva (mínimo 8 caracteres)">
                <Entrada name="nueva" type="password" autoComplete="new-password" minLength={8} />
              </Campo>
            </div>
            {error && <Aviso texto={error} />}
          </form>
          <div className="flex justify-end border-t border-borde px-4 py-3">
            <Boton type="submit" form="form-perfil" disabled={enCurso || soloLectura}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </Tarjeta>

        {/* Horario de clases */}
        <Tarjeta className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
            <div>
              <h2 className="text-[13px] font-semibold">Horario de clases</h2>
              <p className="text-[11px] text-tenue">Pulsa una hora y elige la materia. De aquí salen los periodos de cada planificación semanal.</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/${slug}/api/horario`} download>
                <Boton variante="secundario" tamano="sm" icono={FileDown}>
                  Exportar Excel
                </Boton>
              </a>
              <input
                ref={entradaExcel}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const d = new FormData();
                  d.set('archivo', f);
                  arranca(async () => {
                    const r = await importarHorario(slug, d);
                    if (entradaExcel.current) entradaExcel.current.value = '';
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(`Horario importado: ${r.celdas} hora(s)${r.ignoradas?.length ? ` · ${r.ignoradas.length} no reconocida(s): ${r.ignoradas.slice(0, 3).join(', ')}` : ''}`);
                    router.refresh();
                  });
                }}
              />
              <Boton variante="secundario" tamano="sm" icono={FileUp} onClick={() => entradaExcel.current?.click()} disabled={enCurso || soloLectura}>
                Importar Excel
              </Boton>
            </div>
          </div>
          <div className="desplaza min-h-0 flex-1 overflow-auto p-4">
            {materias.length === 0 && <Aviso tono="info" texto="Todavía no tienes materias asignadas. El administrador te las asigna en Unidades; hasta entonces solo puedes marcar «Sin clase»." />}
            <table className="mt-3 w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <th className="w-28 border border-borde bg-realce px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-tenue">Hora</th>
                  {DIAS.map((d) => (
                    <th key={d} className="border border-borde bg-realce px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-tenue">
                      {ETIQUETA_DIA[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HORAS.map((h) => (
                  <tr key={h}>
                    <td className="border border-borde bg-realce px-2 py-1.5 font-mono text-[11px] text-tenue">{etiquetaHora(h)}</td>
                    {DIAS.map((d) => {
                      const c = celda(d, h);
                      const m = c?.materiaGradoId != null ? porMateria.get(c.materiaGradoId) : null;
                      const esta = abierta?.dia === d && abierta?.hora === h;
                      return (
                        <td key={d} className="relative border border-borde p-0 align-top">
                          <button
                            type="button"
                            disabled={soloLectura}
                            onClick={() => setAbierta(esta ? null : { dia: d, hora: h })}
                            className={cn('block h-12 w-full px-2 py-1 text-left text-[12px] transition-colors foco-visible', m ? 'bg-acento-suave text-acento' : c ? 'bg-realce text-tenue' : 'hover:bg-realce')}
                          >
                            {m ? (
                              <>
                                <span className="block truncate font-semibold">{m.materia}</span>
                                <span className="block truncate text-[11px] opacity-80">{m.grado}</span>
                              </>
                            ) : c ? (
                              <span className="italic">{SIN_CLASE}</span>
                            ) : (
                              <span className="text-transparent">—</span>
                            )}
                          </button>
                          {esta && (
                            <div className="absolute left-0 top-12 z-30 w-64 rounded-md border border-borde bg-tarjeta p-1.5 shadow-xl">
                              <div className="mb-1 flex items-center justify-between px-1">
                                <span className="text-[11px] font-semibold text-tenue">
                                  {ETIQUETA_DIA[d]} · {etiquetaHora(h)}
                                </span>
                                <button type="button" onClick={() => setAbierta(null)} className="rounded p-0.5 text-tenue hover:text-texto">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="desplaza max-h-56 overflow-y-auto">
                                {materias.map((op) => (
                                  <button key={op.id} type="button" onClick={() => poner(d, h, op.id)} className={cn('block w-full rounded px-2 py-1.5 text-left text-[12px] hover:bg-realce', c?.materiaGradoId === op.id && 'bg-acento-suave text-acento font-semibold')}>
                                    {op.etiqueta}
                                  </button>
                                ))}
                                <button type="button" onClick={() => poner(d, h, 'sin-clase')} className={cn('block w-full rounded px-2 py-1.5 text-left text-[12px] italic hover:bg-realce', c && c.materiaGradoId === null && 'bg-realce font-semibold')}>
                                  {SIN_CLASE}
                                </button>
                                {c && (
                                  <button type="button" onClick={() => poner(d, h, 'vacio')} className="block w-full rounded px-2 py-1.5 text-left text-[12px] text-error hover:bg-error-suave">
                                    Vaciar la hora
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {materias.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Horas por materia (los periodos de su planificación semanal)</p>
                <ul className="flex flex-wrap gap-1.5">
                  {materias.map((m) => (
                    <li key={m.id} className={cn('rounded-full border px-2.5 py-0.5 text-[12px]', horasPor.get(m.id) ? 'border-acento bg-acento-suave text-acento' : 'border-borde text-tenue')}>
                      {m.etiqueta} · {horasPor.get(m.id) ?? 0} h
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
