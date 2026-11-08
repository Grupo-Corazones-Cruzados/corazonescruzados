'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2, ImageOff, ListChecks, Plus as PlusIcon, Upload, Save } from 'lucide-react';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Confirmar, EstadoVacio, PieAcciones, BotonEliminar } from '@/componentes/ui';
import { MenuFila } from '@/componentes/Navegacion';
import { crearDestreza, editarDestreza, eliminarDestreza, seleccionarDestreza } from '@/acciones/destrezas';

export type DestrezaVista = { id: number; codigo: string; descripcion: string; imagenUrl: string | null; /** Nombre del archivo en el Drive del Grupo, si la imagen vive allí. */ imagenNombre?: string | null; materia?: string; criterio?: string | null; indicador?: string | null; activa?: boolean };

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
  const [vista, setVista] = useState<string | null>(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [enCurso, arranca] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const editando = modo !== 'lista' && modo !== 'nueva' ? modo : null;



  const volver = () => {
    setModo('lista');
    setVista(null);
    setQuitarImagen(false);
  };
  const enviar = (d: FormData) =>
    arranca(async () => {
      if (quitarImagen) d.set('quitarImagen', 'true');
      const r = editando ? await editarDestreza(slug, editando.id, d) : await crearDestreza(slug, materiaGradoId!, d);
      if (!r.ok) return void toast.error(r.error);
      toast.success('Guardado.');
      volver();
      router.refresh();
    });

  // El diálogo de quitar sirve en la lista (el «⋯») y en el formulario (la papelera del pie).
  const confirmar = (
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
          toast.success('Quitada.');
          setBorrar(null);
          if (modo !== 'lista') volver();
          router.refresh();
        })
      }
    />
  );

  if (modo === 'lista')
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-[12px] text-tenue"
            title={puedo ? 'Marca las que se usan en esta materia: el docente ve esas y el agente elige entre ellas; cada una arrastra su criterio y su indicador.' : 'Las selecciona el administrador en Unidades. El agente elige una por semana.'}
          >
            {puedo ? `${destrezas.filter((d) => d.activa !== false).length} de ${destrezas.length} seleccionadas` : `${destrezas.length} ${destrezas.length === 1 ? 'destreza' : 'destrezas'}`}
          </p>
          {puedo && materiaGradoId && (
            <Boton tamano="sm" icono={PlusIcon} onClick={() => setModo('nueva')} disabled={enCurso}>
              Nueva destreza
            </Boton>
          )}
        </div>
        {destrezas.length === 0 && <EstadoVacio icono={ListChecks} titulo="Sin destrezas" />}
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
                <MenuFila acciones={[
                  { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setModo(d) },
                  { etiqueta: 'Quitar', icono: Trash2, peligro: true, alPulsar: () => setBorrar(d) },
                ]} />
              </li>
            ))}
          </ul>
        )}
        {confirmar}
      </div>
    );

  const imagenActual = vista ?? (quitarImagen ? null : (editando?.imagenUrl ?? null));
  return (
    <>
    {confirmar}
    <form action={enviar} className="space-y-4">
      <Campo etiqueta="Código" requerido>
        <Entrada name="codigo" required defaultValue={editando?.codigo ?? ''} placeholder="CS.1.1.7." className="font-mono" autoFocus />
      </Campo>
      <Campo etiqueta="Descripción" requerido>
        <AreaTexto name="descripcion" rows={4} required defaultValue={editando?.descripcion ?? ''} placeholder="La destreza con criterio de desempeño, tal como está en el currículo" />
      </Campo>
      <Campo etiqueta="Criterio de evaluación">
        <AreaTexto name="criterio" rows={3} defaultValue={editando?.criterio ?? ''} placeholder="CE.CS.1.1. Reconoce que es un ser integral…" />
      </Campo>
      <Campo etiqueta="Indicador de evaluación">
        <AreaTexto name="indicador" rows={3} defaultValue={editando?.indicador ?? ''} placeholder="I.CS.1.1.1. Expresa sus datos personales… (J.4.)" />
      </Campo>
      <Campo etiqueta="Imagen">
        <div className="flex flex-wrap items-center gap-2" title="PNG o JPG, hasta 300 KB. Sale en el formato junto al código.">
          <div className="flex h-12 w-[110px] items-center justify-center rounded border border-borde bg-realce">
            {imagenActual ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagenActual} alt="" className="h-10 w-auto max-w-[104px] object-contain" />
            ) : (
              <ImageOff className="h-4 w-4 text-tenue" />
            )}
          </div>
          <input
            ref={archivo}
            type="file"
            name="imagen"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return setVista(null);
              setQuitarImagen(false);
              const lector = new FileReader();
              lector.onload = () => setVista(String(lector.result));
              lector.readAsDataURL(f);
            }}
          />
          <Boton type="button" variante="secundario" tamano="sm" icono={Upload} onClick={() => archivo.current?.click()} disabled={enCurso}>
            {imagenActual ? 'Cambiar' : 'Subir'}
          </Boton>
          {imagenActual && (
            <BotonIcono type="button" icono={Trash2} titulo="Quitar la imagen" onClick={() => { if (archivo.current) archivo.current.value = ''; setVista(null); setQuitarImagen(true); }} />
          )}
        </div>
        <Entrada name="imagenUrl" className="mt-2" placeholder="O pega la dirección de una imagen" />
      </Campo>
      {/* La imagen está en el Drive del Grupo y no se está cambiando: su nombre se puede editar
          aquí y cambia también en Drive (2026-10-13). Se edita el nombre; la extensión no. */}
      {editando?.imagenNombre && !vista && !quitarImagen && (() => {
        const n = editando.imagenNombre;
        const i = n.lastIndexOf('.');
        const base = i > 0 ? n.slice(0, i) : n;
        const ext = i > 0 ? n.slice(i) : '';
        return (
          <Campo etiqueta="Nombre del archivo">
            <div className="flex items-center gap-2">
              <Entrada name="imagenNombre" defaultValue={base} maxLength={150} />
              {ext && <span className="shrink-0 text-[12px] text-tenue">{ext}</span>}
            </div>
            <input type="hidden" name="imagenNombreAntes" value={base} />
          </Campo>
        );
      })()}
      <div className="border-t border-borde pt-4">
        <PieAcciones eliminar={editando ? <BotonEliminar titulo="Quitar la destreza" onClick={() => setBorrar(editando)} disabled={enCurso} /> : undefined}>
          <Boton type="button" variante="secundario" onClick={volver} disabled={enCurso}>
            Volver
          </Boton>
          <Boton type="submit" icono={Save} disabled={enCurso}>
            {enCurso ? 'Guardando…' : 'Guardar'}
          </Boton>
        </PieAcciones>
      </div>
    </form>
    </>
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
