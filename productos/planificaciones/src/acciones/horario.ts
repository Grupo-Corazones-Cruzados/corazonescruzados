'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { DIAS, HORAS, SIN_CLASE, materiasDelDocente } from '@/lib/horario';

export type Resultado = { ok: true; celdas?: number; ignoradas?: string[] } | { ok: false; error: string };

/** Poner una materia (de las asignadas), «Sin clase» (null) o vaciar (borrar) una celda del horario propio. */
export async function guardarCeldaHorario(slug: string, dia: number, hora: number, valor: number | 'sin-clase' | 'vacio'): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ver');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  if (!(DIAS as readonly number[]).includes(dia) || !(HORAS as readonly number[]).includes(hora)) return { ok: false, error: 'Esa hora no está en el horario.' };
  const donde = { usuarioId_dia_hora: { usuarioId: ctx.sesion.uid, dia, hora } };
  if (valor === 'vacio') {
    await prisma.horarioClase.deleteMany({ where: { usuarioId: ctx.sesion.uid, dia, hora } });
  } else {
    const materiaGradoId = valor === 'sin-clase' ? null : valor;
    if (materiaGradoId !== null) {
      const permitidas = await materiasDelDocente(ctx.inquilino.id, ctx.sesion.uid, ctx.sesion.rol);
      if (!permitidas.some((m) => m.id === materiaGradoId)) return { ok: false, error: 'Esa materia no está entre las que tienes asignadas.' };
    }
    await prisma.horarioClase.upsert({
      where: donde,
      update: { materiaGradoId },
      create: { inquilinoId: ctx.inquilino.id, usuarioId: ctx.sesion.uid, dia, hora, materiaGradoId },
    });
  }
  revalidatePath(`/${slug}/perfil`);
  return { ok: true };
}

/**
 * Importar el Excel que se exportó desde aquí: la hoja «Horario», filas de horas y
 * columnas de días, con las opciones de las materias asignadas o «Sin clase». Lo que
 * no se reconoce se ignora y se dice cuál fue.
 */
export async function importarHorario(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'ver');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || !archivo.size) return { ok: false, error: 'Elige el archivo de Excel.' };
  if (archivo.size > 2 * 1024 * 1024) return { ok: false, error: 'El archivo no puede pasar de 2 MB.' };

  const ExcelJS = (await import('exceljs')).default;
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(await archivo.arrayBuffer());
  } catch {
    return { ok: false, error: 'No se pudo leer el archivo: tiene que ser el Excel exportado desde aquí (.xlsx).' };
  }
  const hoja = libro.getWorksheet('Horario') ?? libro.worksheets[0];
  if (!hoja) return { ok: false, error: 'El archivo no tiene la hoja «Horario».' };

  const permitidas = await materiasDelDocente(ctx.inquilino.id, ctx.sesion.uid, ctx.sesion.rol);
  const porEtiqueta = new Map(permitidas.map((m) => [m.etiqueta.trim().toLowerCase(), m.id]));
  const celdas: { dia: number; hora: number; materiaGradoId: number | null }[] = [];
  const ignoradas: string[] = [];
  // Fila 1: cabecera (Hora, Lunes … Viernes). Filas 2-9: las ocho horas. Columnas B-F: los días.
  HORAS.forEach((hora, i) => {
    DIAS.forEach((dia, j) => {
      const c = hoja.getCell(i + 2, j + 2);
      const texto = String(c.text ?? c.value ?? '').trim();
      if (!texto) return;
      if (texto.toLowerCase() === SIN_CLASE.toLowerCase()) return void celdas.push({ dia, hora, materiaGradoId: null });
      const id = porEtiqueta.get(texto.toLowerCase());
      if (id) celdas.push({ dia, hora, materiaGradoId: id });
      else ignoradas.push(`${texto} (${['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes'][dia]} ${String(hora).padStart(2, '0')}:00)`);
    });
  });

  await prisma.$transaction([
    prisma.horarioClase.deleteMany({ where: { usuarioId: ctx.sesion.uid } }),
    ...(celdas.length ? [prisma.horarioClase.createMany({ data: celdas.map((c) => ({ ...c, inquilinoId: ctx.inquilino.id, usuarioId: ctx.sesion.uid })) })] : []),
  ]);
  revalidatePath(`/${slug}/perfil`);
  return { ok: true, celdas: celdas.length, ignoradas };
}
