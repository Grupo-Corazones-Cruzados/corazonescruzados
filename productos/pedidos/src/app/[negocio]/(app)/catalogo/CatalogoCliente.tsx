'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, BookOpen, Upload, AlertCircle, EyeOff, Eye } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import {
  Boton,
  BotonIcono,
  Campo,
  Entrada,
  AreaTexto,
  Selector,
  Tarjeta,
  PanelLateral,
  Confirmar,
  Insignia,
  EstadoVacio,
} from '@/componentes/ui';
import {
  guardarCategoria,
  eliminarCategoria,
  guardarProducto,
  eliminarProducto,
  alternarDisponible,
  subirFotoProducto,
} from '@/acciones/catalogo';
import { dinero } from '@/lib/formato';

type ProductoVista = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  fotoUrl: string | null;
  disponible: boolean;
  vendido: number;
};
export type CategoriaVista = { id: number; nombre: string; productos: ProductoVista[] };

export default function CatalogoCliente({
  slug,
  categorias,
  moneda,
  hayCloudinary,
  precioConIva,
  aplicaIva,
}: {
  slug: string;
  categorias: CategoriaVista[];
  moneda: string;
  hayCloudinary: boolean;
  precioConIva: boolean;
  aplicaIva: boolean;
}) {
  const router = useRouter();
  const [panelCategoria, setPanelCategoria] = useState<CategoriaVista | null | 'nueva'>(null);
  const [panelProducto, setPanelProducto] = useState<{ p: ProductoVista | null; categoriaId: number } | null>(null);
  const [borrar, setBorrar] = useState<{ tipo: 'categoria' | 'producto'; id: number; nombre: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrar = () => {
    setPanelCategoria(null);
    setPanelProducto(null);
    setBorrar(null);
    setError(null);
  };

  const hecho = (m: string) => {
    toast.success(m);
    cerrar();
    router.refresh();
  };

  return (
    <>
      <CabeceraPagina
        titulo="Carta"
        descripcion={
          aplicaIva
            ? precioConIva
              ? 'Los precios que escribas YA INCLUYEN el IVA'
              : 'A los precios que escribas se les SUMARÁ el IVA al cobrar'
            : 'Este negocio no cobra IVA'
        }
        acciones={
          <Boton icono={Plus} onClick={() => setPanelCategoria('nueva')}>
            Nueva categoría
          </Boton>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {!categorias.length && (
          <Tarjeta>
            <EstadoVacio
              icono={BookOpen}
              titulo="La carta está vacía"
              detalle="Crea una categoría —Entradas, Platos fuertes, Bebidas— y añade sus productos. Sin carta, los meseros no pueden tomar pedidos."
            />
          </Tarjeta>
        )}

        {categorias.map((c) => (
          <Tarjeta key={c.id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-borde px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{c.nombre}</p>
                <p className="text-[11px] text-tenue">{c.productos.length} productos</p>
              </div>
              <Boton
                variante="secundario"
                tamano="sm"
                icono={Plus}
                onClick={() => setPanelProducto({ p: null, categoriaId: c.id })}
              >
                Producto
              </Boton>
              <BotonIcono icono={Pencil} titulo="Editar categoría" onClick={() => setPanelCategoria(c)} />
              <BotonIcono
                icono={Trash2}
                titulo="Eliminar categoría"
                className="hover:bg-error-suave hover:text-error"
                onClick={() => setBorrar({ tipo: 'categoria', id: c.id, nombre: c.nombre })}
              />
            </div>

            {c.productos.length === 0 ? (
              <p className="px-4 py-5 text-center text-[12px] text-tenue">
                Esta categoría todavía no tiene productos.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-borde)]">
                {c.productos.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-realce">
                      {p.fotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.fotoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-tenue" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[13px] font-semibold ${!p.disponible && 'text-tenue line-through'}`}>
                        {p.nombre}
                      </p>
                      {p.descripcion && <p className="truncate text-[11px] text-tenue">{p.descripcion}</p>}
                    </div>
                    {!p.disponible && <Insignia tono="aviso">Agotado</Insignia>}
                    {p.vendido > 0 && <Insignia tono="neutro">{p.vendido} vendidos</Insignia>}
                    <span className="shrink-0 text-[13px] font-semibold text-acento">
                      {dinero(p.precio, moneda)}
                    </span>
                    <BotonIcono
                      icono={p.disponible ? EyeOff : Eye}
                      titulo={p.disponible ? 'Marcar como agotado' : 'Volver a ofrecerlo'}
                      disabled={enCurso}
                      onClick={() =>
                        arranca(async () => {
                          const r = await alternarDisponible(slug, p.id);
                          if (!r.ok) {
                            toast.error(r.error);
                            return;
                          }
                          toast.success(p.disponible ? `«${p.nombre}» agotado` : `«${p.nombre}» disponible`);
                          router.refresh();
                        })
                      }
                    />
                    <BotonIcono
                      icono={Pencil}
                      titulo="Editar producto"
                      onClick={() => setPanelProducto({ p, categoriaId: c.id })}
                    />
                    <BotonIcono
                      icono={Trash2}
                      titulo="Eliminar producto"
                      className="hover:bg-error-suave hover:text-error"
                      onClick={() => setBorrar({ tipo: 'producto', id: p.id, nombre: p.nombre })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        ))}
      </div>

      <PanelLateral
        abierto={panelCategoria !== null}
        alCerrar={cerrar}
        titulo={panelCategoria === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
      >
        <form
          action={(d) =>
            arranca(async () => {
              setError(null);
              const id = panelCategoria && panelCategoria !== 'nueva' ? panelCategoria.id : null;
              const r = await guardarCategoria(slug, id, d);
              if (!r.ok) return setError(r.error);
              hecho('Categoría guardada');
            })
          }
          className="space-y-4"
        >
          <Campo etiqueta="Nombre" requerido>
            <Entrada
              name="nombre"
              required
              autoFocus
              placeholder="Entradas, Platos fuertes, Bebidas…"
              defaultValue={panelCategoria && panelCategoria !== 'nueva' ? panelCategoria.nombre : ''}
            />
          </Campo>
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
      </PanelLateral>

      <PanelLateral
        abierto={panelProducto !== null}
        alCerrar={cerrar}
        titulo={panelProducto?.p ? 'Editar producto' : 'Nuevo producto'}
      >
        <form
          action={(d) =>
            arranca(async () => {
              setError(null);
              const r = await guardarProducto(slug, panelProducto?.p?.id ?? null, d);
              if (!r.ok) return setError(r.error);
              hecho('Producto guardado');
            })
          }
          className="space-y-4"
        >
          <input type="hidden" name="categoriaId" value={panelProducto?.categoriaId ?? ''} />
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus defaultValue={panelProducto?.p?.nombre ?? ''} />
          </Campo>
          <Campo etiqueta="Descripción">
            <AreaTexto name="descripcion" rows={2} defaultValue={panelProducto?.p?.descripcion ?? ''} />
          </Campo>
          <Campo etiqueta={`Precio (${moneda})`} requerido>
            <Entrada
              name="precio"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={panelProducto?.p?.precio ?? ''}
            />
          </Campo>
          <FotoProducto slug={slug} hayCloudinary={hayCloudinary} inicial={panelProducto?.p?.fotoUrl ?? null} />
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="disponible"
              defaultChecked={panelProducto?.p ? panelProducto.p.disponible : true}
              className="h-4 w-4 accent-[var(--color-acento)]"
            />
            Disponible ahora mismo
          </label>
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
      </PanelLateral>

      <Confirmar
        abierto={!!borrar}
        titulo={borrar?.tipo === 'categoria' ? 'Eliminar la categoría' : 'Eliminar el producto'}
        mensaje={
          borrar?.tipo === 'categoria'
            ? `«${borrar?.nombre}» dejará de existir. Si tiene productos, la aplicación se negará y te dirá cuántos.`
            : `«${borrar?.nombre}» sale de la carta. Las cuentas ya cobradas no cambian: cada línea guarda copia del nombre y del precio.`
        }
        ocupado={enCurso}
        alCerrar={cerrar}
        alAceptar={() =>
          arranca(async () => {
            if (!borrar) return;
            const r =
              borrar.tipo === 'categoria'
                ? await eliminarCategoria(slug, borrar.id)
                : await eliminarProducto(slug, borrar.id);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            hecho(r.url ?? 'Eliminado');
          })
        }
      />
    </>
  );
}

function FotoProducto({
  slug,
  hayCloudinary,
  inicial,
}: {
  slug: string;
  hayCloudinary: boolean;
  inicial: string | null;
}) {
  const [url, setUrl] = useState(inicial ?? '');
  const [, arranca] = useTransition();
  return (
    <Campo etiqueta="Foto">
      <div className="flex items-center gap-2">
        <Entrada
          name="fotoUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1"
        />
        {hayCloudinary && (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                arranca(async () => {
                  const d = new FormData();
                  d.set('archivo', f);
                  const r = await subirFotoProducto(slug, d);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setUrl(r.url!);
                  toast.success('Foto subida');
                });
              }}
            />
            <span className="inline-flex h-8 items-center gap-2 rounded border border-borde bg-tarjeta px-3 text-[13px] font-semibold hover:bg-realce">
              <Upload className="h-4 w-4" /> Subir
            </span>
          </label>
        )}
      </div>
    </Campo>
  );
}

const Aviso = ({ texto }: { texto: string }) => (
  <p
    role="alert"
    className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error"
  >
    <AlertCircle className="mt-px h-4 w-4 shrink-0" />
    {texto}
  </p>
);
