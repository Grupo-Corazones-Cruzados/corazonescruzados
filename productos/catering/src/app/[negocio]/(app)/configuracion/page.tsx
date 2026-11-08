import { exigirContexto } from '@/lib/inquilino';
import { urlLogo } from '@/lib/marca';
import { prisma } from '@/lib/db';
import { cupoDeCuentas } from '@/lib/limites';
import { fechaMes } from '@/lib/fechas';
import ConfiguracionCliente from './ConfiguracionCliente';
import type { UsuarioVista } from './SeccionUsuarios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

export default async function PaginaConfiguracion({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio, 'administrar');

  // Los usuarios del negocio: antes, la página «Usuarios» (2026-11-08, como en Automatizaciones).
  const usuarios = await prisma.usuario.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
  });
  const filas: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
  }));
  const cupo = await cupoDeCuentas(
    inquilino.id,
    // El inquilino del grupo no tiene topes (Fernando, 2026-09-16).
    inquilino.cortesia ? null : (inquilino.suscripcion?.plan.maxUsuarios ?? null),
  );

  return (
    <ConfiguracionCliente
      slug={negocio}
      zonaHoraria={inquilino.zonaHoraria}
      negocio={{
        nombre: inquilino.nombre,
        logoUrl: urlLogo(inquilino),
        moneda: inquilino.moneda,
        tiposComida: inquilino.tiposComida,
        diasServicio: inquilino.diasServicio,
        horaLimiteCancelacion: inquilino.horaLimiteCancelacion,
        porcentajeCancelacion: inquilino.porcentajeCancelacion,
        registroAbierto: inquilino.registroAbierto,
      }}
      usuarios={{ lista: filas, yoSoy: sesion.uid, cupo }}
      plan={
        inquilino.suscripcion
          ? {
              nombre: inquilino.suscripcion.plan.nombre,
              precioMensual: Number(inquilino.suscripcion.plan.precioMensual),
              moneda: inquilino.suscripcion.plan.moneda,
              pagadoHasta: inquilino.suscripcion.pagadoHasta ? fechaMes(inquilino.suscripcion.pagadoHasta) : null,
              mesesRetencion: inquilino.suscripcion.plan.mesesRetencion,
              caracteristicas: inquilino.suscripcion.plan.caracteristicas,
            }
          : null
      }
    />
  );
}
