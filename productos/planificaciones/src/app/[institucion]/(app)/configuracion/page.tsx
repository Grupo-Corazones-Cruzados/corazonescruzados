import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cupoDeCuentas, topesDe } from '@/lib/limites';
import { urlLogo } from '@/lib/marca';
import { listaDePlantillas } from '@/plantillas';
import ConfiguracionCliente, { type NegocioVista } from './ConfiguracionCliente';
import type { UsuarioVista } from './SeccionUsuarios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración' };

/**
 * CONFIGURACIÓN COMO LA DE AUTOMATIZACIONES (Fernando, 2026-11-08): Negocio · Usuarios ·
 * Suscripción. «Negocio» une lo que antes eran el módulo Negocio (lo que lleva impreso el formato)
 * y la sección Marca (nombre, logo y plantilla por defecto): es el mismo inquilino. «Mi cuenta» no
 * va aquí: la contraseña y los datos de cada docente viven en «Mi perfil», que ven todos.
 */
export default async function PaginaConfiguracion({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino: i, sesion } = await exigirContexto(institucion, 'administrar');
  const plan = i.suscripcion?.plan;

  const negocio: NegocioVista = {
    nombre: i.nombre,
    logoUrl: urlLogo(i),
    plantillaPorDefecto: i.plantillaPorDefecto,
    contactoNombre: i.contactoNombre,
    contactoEmail: i.contactoEmail,
    contactoTelefono: i.contactoTelefono,
    cabeceraLinea1: i.cabeceraLinea1,
    cabeceraLinea2: i.cabeceraLinea2,
    cabeceraLinea3: i.cabeceraLinea3,
    anioLectivo: i.anioLectivo,
    logoInstitucionUrl: i.logoInstitucionUrl,
    logoOrganizacionUrl: i.logoOrganizacionUrl,
    logoOpcionalUrl: i.logoOpcionalUrl,
  };

  // Los usuarios de la institución: antes, el módulo «Usuarios» (2026-11-08).
  const usuarios = await prisma.usuario.findMany({
    where: { inquilinoId: i.id },
    orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }],
    include: { _count: { select: { planificaciones: true, semanas: { where: { estado: 'LISTA' } } } } },
  });
  const lista: UsuarioVista[] = usuarios.map((u) => ({
    id: u.id,
    usuario: u.usuario,
    nombre: u.nombre,
    profesion: u.profesion,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    planificaciones: u._count.planificaciones,
    semanas: u._count.semanas,
    ultimoAcceso: u.ultimoAcceso?.toISOString() ?? null,
    esYo: u.id === sesion.uid,
  }));
  const cupo = await cupoDeCuentas(i.id, topesDe(i).cuentas);

  return (
    <ConfiguracionCliente
      slug={institucion}
      negocio={negocio}
      plantillas={listaDePlantillas()}
      usuarios={{ lista, cupo }}
      cortesia={i.cortesia}
      plan={
        plan
          ? {
              nombre: plan.nombre,
              precioMensual: Number(plan.precioMensual),
              moneda: plan.moneda,
              pagadoHasta: i.suscripcion?.pagadoHasta?.toISOString() ?? null,
              mesesRetencion: plan.mesesRetencion,
              maxUsuarios: plan.maxUsuarios,
              maxGeneracionesSemana: plan.maxGeneracionesSemana,
              caracteristicas: plan.caracteristicas,
            }
          : null
      }
    />
  );
}
