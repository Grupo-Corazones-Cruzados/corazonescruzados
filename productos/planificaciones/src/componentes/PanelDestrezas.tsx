'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2, ImageOff, ListChecks, Plus as PlusIcon } from 'lucide-react';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Confirmar, EstadoVacio } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { crearDestreza, editarDestreza, eliminarDestreza, seleccionarDestreza } from '@/acciones/destrezas';

export type DestrezaVista = { id: number; codigo: string; descripcion: string; imagenUrl: string | null; materia?: string; criterio?: string | null; indicador?: string | null; activa?: boolean };

/**
 * LAS DESTREZAS DE UNA MATERIA DE GRADO (Fernando, 2026-09-17): en «Unidades» el
 * administrador las SELECCIONA (casilla), las añade a mano, las edita y las quita;
 * cada una lleva su criterio y su indicador de evaluación (del currículo priorizado
 * importado en el grado). En Planificaciones, «Identificadores» enseña las
 * seleccionadas en una tabla destreza · criterio · indicador (`puedo = false`).
 */

export function PanelDestrezas({ slug, materiaGradoId, destrezas, puedo }: { slug: string; materiaGradoId: number | null; destrezas: DestrezaVista[]; puedo: boolean }) {
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
      const r = editando ? await editarDestreza(slug, editando.id, d) : await crearDestreza(slug, materiaGradoId!, d);
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
            {puedo ? `${destrezas.filter((d) => d.activa !== false).length} de ${destrezas.length} seleccionadas. Marca las que se usan en esta materia: el docente ve esas y el agente elige entre ellas; cada una arrastra su criterio y su indicador.` : `${destrezas.length} destreza${destrezas.length === 1 ? '' : 's'} seleccionada${destrezas.length === 1 ? '' : 's'} por el administrador en Unidades. El agente elige una por semana.`}
          </p>
          {puedo && materiaGradoId && (
            <Boton tamano="sm" icono={PlusIcon} onClick={() => setModo('nueva')} disabled={enCurso}>
              Nueva destreza
            </Boton>
          )}
        </div>
        {error && <Aviso texto={error} />}
        {destrezas.length === 0 && <EstadoVacio icono={ListChecks} titulo="Sin destrezas todavía" detalle="Las destrezas con criterio de desempeño de esta materia: el agente elige una por semana. El administrador las importa con el currículo priorizado del grado (o las añade a mano) y marca las que se usan." />}
        {!puedo && destrezas.length > 0 && <TablaIdentificadores destrezas={destrezas} />}
        {puedo && (
          <ul className="divide-y divide-[var(--color-borde)] rounded border border-borde">
            {destrezas.map((d) => (
              <li key={d.id} className={`flex items-start gap-3 px-3 py-2.5 ${d.activa === false ? 'opacity-70' : ''}`}>
                <input
                  type="checkbox"
                  checked={d.activa !== false}
                  disabled={enCurso}
                  title={d.activa === false ? 'Seleccionar para esta materia' : 'Quitar de la selección'}
                  onChange={(e) => {
                    const activa = e.target.checked;
                    arranca(async () => {
                      const r = await seleccionarDestreza(slug, d.id, activa);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    });
                  }}
                  className="mt-2.5 h-4 w-4 shrink-0 accent-[var(--color-acento)]"
                />
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
                  {(d.criterio || d.indicador) && (
                    <dl className="mt-1.5 grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-[auto_1fr]">
                      <dt className="font-semibold text-tenue">Criterio</dt>
                      <dd className="text-tenue">{d.criterio || '—'}</dd>
                      <dt className="font-semibold text-tenue">Indicador</dt>
                      <dd className="text-tenue">{d.indicador || '—'}</dd>
                    </dl>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <BotonIcono icono={Pencil} titulo="Editar" onClick={() => setModo(d)} />
                  <BotonIcono icono={Trash2} titulo="Quitar" className="text-error" onClick={() => setBorrar(d)} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <Confirmar
          abierto={!!borrar}
          titulo="Quitar la destreza"
          mensaje={`Se quitará «${borrar?.codigo}» de esta materia. Si alguna semana ya la usaba, quedará sin destreza hasta que la corrijas.`}
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
      <Campo etiqueta="Criterio de evaluación (código y texto)">
        <AreaTexto name="criterio" rows={3} defaultValue={editando?.criterio ?? ''} placeholder="CE.CS.1.1. Reconoce que es un ser integral…" />
      </Campo>
      <Campo etiqueta="Indicador de evaluación (código y texto)">
        <AreaTexto name="indicador" rows={3} defaultValue={editando?.indicador ?? ''} placeholder="I.CS.1.1.1. Expresa sus datos personales… (J.4.)" />
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

/** LA TABLA DE IDENTIFICADORES: destreza · criterio · indicador (Fernando, 2026-09-18). Se usa en Unidades (seleccionadas) y en Planificaciones. */
export function TablaIdentificadores({ destrezas }: { destrezas: DestrezaVista[] }) {
  return (
    <div className="overflow-x-auto rounded border border-borde">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-realce text-left text-[11px] uppercase tracking-wide text-tenue">
            <th className="border-b border-borde px-3 py-2">Destreza con criterio de desempeño</th>
            <th className="border-b border-borde px-3 py-2">Criterio de evaluación</th>
            <th className="border-b border-borde px-3 py-2">Indicador de evaluación</th>
          </tr>
        </thead>
        <tbody>
          {destrezas.map((d) => (
            <tr key={d.id} className="align-top">
              <td className="border-b border-borde px-3 py-2">
                <div className="flex items-start gap-2">
                  {d.imagenUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.imagenUrl} alt="" className="mt-0.5 h-7 w-auto max-w-[70px] shrink-0 object-contain" />
                  )}
                  <span>
                    <span className="font-semibold text-texto">{d.codigo}</span> <span className="text-tenue">{d.descripcion}</span>
                  </span>
                </div>
              </td>
              <td className="border-b border-borde px-3 py-2 text-tenue">{d.criterio || '—'}</td>
              <td className="border-b border-borde px-3 py-2 text-tenue">{d.indicador || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
