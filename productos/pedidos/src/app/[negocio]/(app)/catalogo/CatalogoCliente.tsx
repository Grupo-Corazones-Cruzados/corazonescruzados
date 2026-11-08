'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, BookOpen, Upload, EyeOff, Eye, Save, Tag } from 'lucide-react';
import { CabeceraPagina, MenuFila } from '@/componentes/Navegacion';
import {
  Boton,
  Campo,
  Entrada,
  AreaTexto,
  Tarjeta,
  PanelLateral,
  Confirmar,
  Insignia,
  EstadoVacio,
  RailFiltro,
  Tabla,
  PieAcciones,
  BotonEliminar,
} from '@/componentes/ui';
import {
  guardarCategoria,
  eliminarCategoria,
  guardarProducto,
  eliminarProducto,
  alternarDisponible,
  subirFotoProducto,
} from '@/acciones/catalogo';
import { dinero, numEntero } from '@/lib/formato';

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

/**
 * LA CARTA, CON LAS PIEZAS DE AUTOMATIZACIONES (2026-11-08): las categorías son el raíl de la
 * izquierda y los productos de la elegida, una `Tabla` con el recuento al pie y sus acciones en
 * «⋯». Los formularios van en el panel lateral con el pie fijo (papelera sin texto a la izquierda).
 */
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
  const [elegida, setElegida] = useState<number | null>(categorias[0]?.id ?? null);
  const [panelCategoria, setPanelCategoria] = useState<CategoriaVista | null | 'nueva'>(null);
  const [panelProducto, setPanelProducto] = useState<{ p: ProductoVista | null; categoriaId: number } | null>(null);
  const [borrar, setBorrar] = useState<{ tipo: 'categoria' | 'producto'; id: number; nombre: string } | null>(null);
  const [enCurso, arranca] = useTransition();

  // Si la elegida desaparece (se eliminó), se mira la primera.
  const categoria = categorias.find((c) => c.id === elegida) ?? categorias[0] ?? null;

  const cerrar = () => {
    setPanelCategoria(null);
    setPanelProducto(null);
    setBorrar(null);
  };

  const hecho = (m: string) => {
    toast.success(m);
    cerrar();
    router.refresh();
  };

  const alternar = (p: ProductoVista) =>
    arranca(async () => {
      const r = await alternarDisponible(slug, p.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(p.disponible ? 'Agotado.' : 'Disponible.');
      router.refresh();
    });

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPagina
        titulo="Carta"
        descripcion="Las categorías y los productos que ofrecen los meseros"
        // Cómo se leen los precios es lo que hay que tener presente al escribirlos.
        extra={
          <Insignia tono={aplicaIva ? 'info' : 'neutro'}>
            {aplicaIva ? (precioConIva ? 'Precios con IVA' : 'IVA al cobrar') : 'Sin IVA'}
          </Insignia>
        }
        acciones={
          <Boton icono={Plus} onClick={() => setPanelCategoria('nueva')}>
            Nueva categoría
          </Boton>
        }
      />

      {/* Alto completo: el raíl y la tabla llegan al pie (regla del panel, 2026-11-08). */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        {!categoria ? (
          <Tarjeta className="flex flex-1 flex-col justify-center">
            <EstadoVacio
              icono={BookOpen}
              titulo="La carta está vacía"
              accion={<Boton icono={Plus} onClick={() => setPanelCategoria('nueva')}>Nueva categoría</Boton>}
            />
          </Tarjeta>
        ) : (
          <>
            <RailFiltro
              titulo="Categorías"
              opciones={categorias.map((c) => ({ valor: String(c.id), etiqueta: c.nombre, icono: Tag, conteo: c.productos.length }))}
              activo={String(categoria.id)}
              alElegir={(v) => setElegida(Number(v))}
            />

            <Tarjeta className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center gap-2 border-b border-borde px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-texto">{categoria.nombre}</p>
                <Boton icono={Plus} onClick={() => setPanelProducto({ p: null, categoriaId: categoria.id })}>
                  Nuevo producto
                </Boton>
                <MenuFila
                  acciones={[
                    { etiqueta: 'Editar categoría', icono: Pencil, alPulsar: () => setPanelCategoria(categoria) },
                    { etiqueta: 'Eliminar categoría', icono: Trash2, peligro: true, alPulsar: () => setBorrar({ tipo: 'categoria', id: categoria.id, nombre: categoria.nombre }) },
                  ]}
                />
              </div>

              <Tabla
                filas={categoria.productos}
                claveFila={(p) => p.id}
                alPulsarFila={(p) => setPanelProducto({ p, categoriaId: categoria.id })}
                recuento={`${categoria.productos.length} ${categoria.productos.length === 1 ? 'producto' : 'productos'}`}
                vacio={
                  <div className="flex flex-1 flex-col justify-center">
                    <EstadoVacio icono={BookOpen} titulo="Sin productos" />
                  </div>
                }
                columnas={[
                  { clave: 'nombre', titulo: 'Producto', ancho: '46%', render: (p) => (
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-realce">
                        {p.fotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.fotoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-tenue" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate font-semibold ${p.disponible ? 'text-texto' : 'text-tenue line-through'}`}>{p.nombre}</p>
                        {p.descripcion && <p className="truncate text-[11.5px] text-tenue">{p.descripcion}</p>}
                      </div>
                    </div>
                  ) },
                  { clave: 'precio', titulo: 'Precio', ancho: '16%', alinear: 'der', render: (p) => (
                    <span className="font-semibold tabular-nums text-acento">{dinero(p.precio, moneda)}</span>
                  ) },
                  { clave: 'vendido', titulo: 'Vendidos', ancho: '14%', alinear: 'der', render: (p) => <span className="tabular-nums">{numEntero(p.vendido)}</span> },
                  { clave: 'estado', titulo: 'Estado', ancho: '16%', render: (p) => (
                    <Insignia tono={p.disponible ? 'exito' : 'aviso'}>{p.disponible ? 'Disponible' : 'Agotado'}</Insignia>
                  ) },
                  { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (p) => (
                    <div className="flex justify-end">
                      <MenuFila
                        acciones={[
                          { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPanelProducto({ p, categoriaId: categoria.id }) },
                          {
                            etiqueta: p.disponible ? 'Agotado' : 'Disponible',
                            icono: p.disponible ? EyeOff : Eye,
                            deshabilitado: enCurso,
                            alPulsar: () => alternar(p),
                          },
                          { etiqueta: 'Eliminar', icono: Trash2, peligro: true, alPulsar: () => setBorrar({ tipo: 'producto', id: p.id, nombre: p.nombre }) },
                        ]}
                      />
                    </div>
                  ) },
                ]}
              />
            </Tarjeta>
          </>
        )}
      </div>

      <PanelLateral
        abierto={panelCategoria !== null}
        alCerrar={cerrar}
        titulo={panelCategoria === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
        pie={
          <PieAcciones
            eliminar={panelCategoria && panelCategoria !== 'nueva' ? (
              <BotonEliminar
                titulo="Eliminar la categoría"
                disabled={enCurso}
                onClick={() => setBorrar({ tipo: 'categoria', id: panelCategoria.id, nombre: panelCategoria.nombre })}
              />
            ) : undefined}
          >
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton form="form-categoria" type="submit" icono={Save} disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-categoria"
          key={panelCategoria && panelCategoria !== 'nueva' ? panelCategoria.id : 'nueva'}
          action={(d) =>
            arranca(async () => {
              const id = panelCategoria && panelCategoria !== 'nueva' ? panelCategoria.id : null;
              const r = await guardarCategoria(slug, id, d);
              if (!r.ok) { toast.error(r.error); return; }
              hecho('Guardado.');
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
        </form>
      </PanelLateral>

      <PanelLateral
        abierto={panelProducto !== null}
        alCerrar={cerrar}
        titulo={panelProducto?.p ? 'Editar producto' : 'Nuevo producto'}
        pie={
          <PieAcciones
            eliminar={panelProducto?.p ? (
              <BotonEliminar
                titulo="Eliminar el producto"
                disabled={enCurso}
                onClick={() => panelProducto.p && setBorrar({ tipo: 'producto', id: panelProducto.p.id, nombre: panelProducto.p.nombre })}
              />
            ) : undefined}
          >
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton form="form-producto" type="submit" icono={Save} disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-producto"
          key={panelProducto?.p?.id ?? 'nuevo'}
          action={(d) =>
            arranca(async () => {
              const r = await guardarProducto(slug, panelProducto?.p?.id ?? null, d);
              if (!r.ok) { toast.error(r.error); return; }
              hecho('Guardado.');
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
            Disponible
          </label>
        </form>
      </PanelLateral>

      <Confirmar
        abierto={!!borrar}
        titulo={borrar?.tipo === 'categoria' ? '¿Eliminar la categoría?' : '¿Eliminar el producto?'}
        mensaje={
          borrar?.tipo === 'categoria'
            ? `«${borrar?.nombre}» dejará de existir. Si tiene productos, no se elimina.`
            : `«${borrar?.nombre}» sale de la carta. Las cuentas cobradas no cambian.`
        }
        ocupado={enCurso}
        alCerrar={() => setBorrar(null)}
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
            hecho('Eliminado.');
          })
        }
      />
    </div>
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
                  toast.success('Foto subida.');
                });
              }}
            />
            <span className="inline-flex h-8 items-center gap-2 rounded border border-borde bg-tarjeta px-3 text-[13px] font-semibold text-texto hover:bg-realce">
              <Upload className="h-4 w-4" /> Subir
            </span>
          </label>
        )}
      </div>
    </Campo>
  );
}
