import { notFound } from 'next/navigation';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios, feriadosDelNegocio } from '@/lib/servicios-db';
import { calendarioServicio } from '@/lib/servicios';
import { aDia, hoyEn } from '@/lib/fechas';
import FichaCliente, { type ServicioVista } from './FichaCliente';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ negocio: string; id: string }> }) {
  const { negocio, id } = await params;
  const c = await prisma.cliente.findFirst({ where: { id: Number(id), inquilino: { slug: negocio } }, select: { nombre: true } });
  return { title: c ? c.nombre : 'Cliente' };
}

export default async function PaginaFicha({ params }: { params: Promise<{ negocio: string; id: string }> }) {
  const { negocio, id } = await params;
  const { inquilino } = await exigirContexto(negocio, 'clientes');
  const hoy = hoyEn(inquilino.zonaHoraria);

  const cliente = await prisma.cliente.findFirst({
    where: { id: Number(id), inquilinoId: inquilino.id },
    include: {
      restricciones: { include: { alimento: { select: { id: true, nombre: true } } } },
      mensajes: { orderBy: { creado: 'desc' } },
    },
  });
  if (!cliente) notFound();

  const [servicios, feriados, alimentos, motorizados] = await Promise.all([
    cargarServicios(inquilino, { clienteId: cliente.id }),
    feriadosDelNegocio(inquilino.id),
    prisma.alimento.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }] }),
    prisma.motorizado.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ]);

  const vista: ServicioVista[] = servicios
    .sort((a, b) => b.id - a.id)
    .map((s) => ({
      id: s.id,
      estado: s.estado,
      diasTotales: s.diasTotales,
      fechaInicio: aDia(s.fechaInicio),
      tiposComida: s.tiposComida,
      diasSemana: s.diasSemana,
      porcentajeCancelacion: s.porcentajeCancelacion,
      renovaciones: s.renovaciones,
      notas: s.notas,
      terminoEn: s.terminoEn ? aDia(s.terminoEn) : null,
      resumen: s.resumen,
      calendario: calendarioServicio(
        s,
        hoy,
        feriados,
        s.cancelaciones.filter((c) => c.activa).map((c) => ({ id: c.id, dia: aDia(c.fecha), motivo: c.motivo })),
      ),
      cancelaciones: s.cancelaciones.map((c) => ({
        id: c.id,
        dia: aDia(c.fecha),
        motivo: c.motivo,
        autor: c.autor,
        activa: c.activa,
        reactivadaPor: c.reactivadaPor,
      })),
    }));

  return (
    <FichaCliente
      slug={negocio}
      hoy={hoy}
      zonaHoraria={inquilino.zonaHoraria}
      comidas={inquilino.tiposComida}
      diasNegocio={inquilino.diasServicio}
      porcentajeDefecto={inquilino.porcentajeCancelacion}
      cliente={{
        id: cliente.id,
        email: cliente.email,
        estado: cliente.estado,
        creado: cliente.creado.toISOString(),
        ultimoAcceso: cliente.ultimoAcceso?.toISOString() ?? null,
        datos: {
          nombre: cliente.nombre, celular: cliente.celular, edad: cliente.edad,
          facebook: cliente.facebook, instagram: cliente.instagram, tiktok: cliente.tiktok,
          altura: cliente.altura, peso: cliente.peso, genero: cliente.genero, frecuenciaActividad: cliente.frecuenciaActividad,
          direccion: cliente.direccion, edificio: cliente.edificio, piso: cliente.piso, referencias: cliente.referencias, colorIdentificador: cliente.colorIdentificador,
          direccion2: cliente.direccion2, edificio2: cliente.edificio2, piso2: cliente.piso2, referencias2: cliente.referencias2, colorIdentificador2: cliente.colorIdentificador2,
          diasDireccion2: cliente.diasDireccion2, tiposComida: cliente.tiposComida,
          sinAgua: cliente.sinAgua, sinFruta: cliente.sinFruta, sinCubiertos: cliente.sinCubiertos, envasesPropios: cliente.envasesPropios,
          motorizadoId: cliente.motorizadoId, motorizado2Id: cliente.motorizado2Id,
        },
        restricciones: cliente.restricciones.map((r) => ({ alimentoId: r.alimentoId, nombre: r.alimento.nombre, tiposComida: r.tiposComida })),
        mensajes: cliente.mensajes.map((m) => ({ id: m.id, texto: m.texto, tipo: m.tipo, leido: m.leido, creado: m.creado.toISOString() })),
      }}
      servicios={vista}
      alimentos={alimentos.map((a) => ({ id: a.id, nombre: a.nombre, categoria: a.categoria }))}
      motorizados={motorizados}
    />
  );
}
