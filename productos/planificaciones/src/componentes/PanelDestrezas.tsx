'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2, Loader2, FileUp, ImageOff, ListChecks, Plus as PlusIcon } from 'lucide-react';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Confirmar, EstadoVacio } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { crearDestreza, editarDestreza, eliminarDestreza, importarDestrezas } from '@/acciones/destrezas';

export type DestrezaVista = { id: number; codigo: string; descripcion: string; imagenUrl: string | null; materia?: string };

/**
 * LAS DESTREZAS DE UNA MATERIA DE GRADO (Fernando, 2026-09-17): las gestiona el
 * administrador en «Unidades» (lista, alta, edición, borrado e importación desde el
 * PCA); en Planificaciones el docente solo las ve (`puedo = false`). Un solo
 * componente para las dos pantallas.
 */

export function PanelDestrezas({ slug, materiaGradoId, destrezas, puedo }: { slug: string; materiaGradoId: number | null; destrezas: DestrezaVista[]; puedo: boolean }) {
  const router = useRouter();
  const [modo, setModo] = useState<'lista' | 'nueva' | DestrezaVista>('lista');
  const [borrar, setBorrar] = useState<DestrezaVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [enCurso, arranca] = useTransition();
  const [importando, setImportando] = useState(false);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const editando = modo !== 'lista' && modo !== 'nueva' ? modo : null;

  // «Importar destrezas» (Fernando, 2026-09-17): se sube el PCA y el agente saca las
  // de esta materia y nivel; las que la planificación no tenga se añaden.
  const importar = (archivo: File) => {
    const d = new FormData();
    d.set('archivo', archivo);
    setImportando(true);
    setError(null);
    arranca(async () => {
      const r = await importarDestrezas(slug, materiaGradoId!, d);
      setImportando(false);
      if (entradaArchivo.current) entradaArchivo.current.value = '';
      if (!r.ok) return setError(r.error);
      toast.success(r.anadidas ? `${r.anadidas} destreza${r.anadidas === 1 ? '' : 's'} añadida${r.anadidas === 1 ? '' : 's'}${r.repetidas ? ` · ${r.repetidas} ya estaba${r.repetidas === 1 ? '' : 'n'}` : ''}` : 'Todas las destrezas del documento ya estaban en la planificación');
      router.refresh();
    });
  };

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
            {destrezas.length} destreza{destrezas.length === 1 ? '' : 's'}. La imagen de cada una sale en el formato junto a su código.{!puedo && ' Las gestiona el administrador en Unidades.'}
          </p>
          {puedo && materiaGradoId && (
            <div className="flex shrink-0 items-center gap-2">
              <input ref={entradaArchivo} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
              <Boton tamano="sm" variante="secundario" icono={importando ? Loader2 : FileUp} onClick={() => entradaArchivo.current?.click()} disabled={enCurso} title="Sube el PCA (PDF o Word): el agente añade las destrezas de esta materia y nivel que falten">
                {importando ? 'Leyendo el documento…' : 'Importar destrezas'}
              </Boton>
              <Boton tamano="sm" icono={PlusIcon} onClick={() => setModo('nueva')} disabled={enCurso}>
                Nueva destreza
              </Boton>
            </div>
          )}
        </div>
        {error && <Aviso texto={error} />}
        {destrezas.length === 0 && <EstadoVacio icono={ListChecks} titulo="Sin destrezas todavía" detalle="Las destrezas con criterio de desempeño de esta materia: el agente elige una por semana. El administrador las añade en Unidades (a mano o importando el PCA)." />}
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
