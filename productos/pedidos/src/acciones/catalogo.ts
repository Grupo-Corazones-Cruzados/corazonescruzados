'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { subirImagen } from '@/lib/imagenes';

export type Resultado = { ok: true; url?: string } | { ok: false; error: string };
const refrescar = (slug: string) => revalidatePath(`/${slug}`, 'layout');

// ── Categorías de la carta ──────────────────────────────────────────────────
export async function guardarCategoria(slug: string, id: number | null, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const nombre = String(datos.get('nombre') || '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la categoría.' };

  const repetida = await prisma.categoria.findFirst({
    where: { inquilinoId: ctx.inquilino.id, nombre, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetida) return { ok: false, error: `Ya existe una categoría llamada «${nombre}».` };

  if (id) {
    const propia = await prisma.categoria.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!propia) return { ok: false, error: 'La categoría no existe.' };
    await prisma.categoria.update({ where: { id }, data: { nombre } });
  } else {
    const cuantas = await prisma.categoria.count({ where: { inquilinoId: ctx.inquilino.id } });
    await prisma.categoria.create({ data: { inquilinoId: ctx.inquilino.id, nombre, orden: cuantas } });
  }
  refrescar(slug);
  return { ok: true };
}

export async function eliminarCategoria(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const conProductos = await prisma.producto.count({ where: { categoriaId: id, inquilinoId: ctx.inquilino.id } });
  if (conProductos)
    return { ok: false, error: `Esta categoría tiene ${conProductos} producto(s). Muévelos o elimínalos antes.` };

  const r = await prisma.categoria.deleteMany({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!r.count) return { ok: false, error: 'La categoría no existe.' };
  refrescar(slug);
  return { ok: true };
}

// ── Productos ───────────────────────────────────────────────────────────────
export async function guardarProducto(slug: string, id: number | null, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const nombre = String(datos.get('nombre') || '').trim();
  const descripcion = String(datos.get('descripcion') || '').trim();
  const categoriaId = Number(datos.get('categoriaId') || 0);
  const precio = Number(datos.get('precio') || 0);
  const fotoUrl = String(datos.get('fotoUrl') || '').trim();
  const disponible = datos.get('disponible') === 'on' || datos.get('disponible') === 'true';

  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre del producto.' };
  if (!(precio >= 0)) return { ok: false, error: 'El precio no puede ser negativo.' };

  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!categoria) return { ok: false, error: 'Elige una categoría de este negocio.' };

  const repetido = await prisma.producto.findFirst({
    where: { inquilinoId: ctx.inquilino.id, nombre, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: `Ya hay un producto llamado «${nombre}».` };

  const comun = { nombre, descripcion: descripcion || null, categoriaId, precio, fotoUrl: fotoUrl || null, disponible };

  if (id) {
    const propio = await prisma.producto.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!propio) return { ok: false, error: 'El producto no existe.' };
    await prisma.producto.update({ where: { id }, data: comun });
  } else {
    const cuantos = await prisma.producto.count({ where: { categoriaId } });
    await prisma.producto.create({ data: { ...comun, inquilinoId: ctx.inquilino.id, orden: cuantos } });
  }
  refrescar(slug);
  return { ok: true };
}

/** Se agota el ceviche: se apaga, no se borra. El histórico de ventas sigue. */
export async function alternarDisponible(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const p = await prisma.producto.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true, disponible: true } });
  if (!p) return { ok: false, error: 'El producto no existe.' };
  await prisma.producto.update({ where: { id }, data: { disponible: !p.disponible } });
  refrescar(slug);
  return { ok: true };
}

export async function eliminarProducto(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  // Las líneas de pedido guardan copia del nombre y del precio, así que borrar el
  // producto no falsea ninguna cuenta pasada. Aun así se avisa de cuántas ventas
  // dejarán de poder enlazarse con su ficha.
  const vendido = await prisma.pedidoItem.count({ where: { productoId: id } });
  const r = await prisma.producto.deleteMany({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!r.count) return { ok: false, error: 'El producto no existe.' };
  refrescar(slug);
  return { ok: true, url: vendido ? `Se desligaron ${vendido} línea(s) de pedidos pasados.` : undefined };
}

export async function subirFotoProducto(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Elige una imagen.' };
  return subirImagen(archivo, `${ctx.inquilino.slug}/catalogo`);
}
