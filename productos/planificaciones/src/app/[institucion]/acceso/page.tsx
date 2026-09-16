import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { INICIO_DE_ROL } from '@/lib/permisos';
import { AplicaMarca, LogoNegocio } from '@/componentes/Marca';
import FormularioAcceso from './FormularioAcceso';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const inq = await prisma.inquilino.findUnique({ where: { slug: institucion }, select: { nombre: true } });
  return { title: inq ? `Acceso · ${inq.nombre}` : 'Acceso' };
}

export default async function PaginaAcceso({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const inquilino = await prisma.inquilino.findUnique({ where: { slug: institucion } });
  if (!inquilino) notFound();

  // Si ya hay sesión de ESTA institución (por código Y por id), no se pide de nuevo.
  const sesion = await leerSesionUsuario();
  if (sesion?.slug === institucion && sesion.inquilinoId === inquilino.id) redirect(`/${institucion}/${INICIO_DE_ROL[sesion.rol]}`);

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema} className="flex items-center justify-center px-4 py-10">
      <div className="tarjeta w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoNegocio nombre={inquilino.nombre} logoUrl={inquilino.logoUrl} tamano={52} />
          <div>
            <h1 className="text-[17px] font-semibold text-texto">{inquilino.nombre}</h1>
            <p className="text-[12px] text-tenue">Planificación de Clases</p>
          </div>
        </div>
        {inquilino.soloLectura && (
          <p className="mb-4 rounded border border-borde bg-acento-suave px-3 py-2 text-center text-[12px] leading-relaxed text-acento">
            Institución de demostración. Se puede recorrer entera; los cambios no se guardan.
          </p>
        )}
        <FormularioAcceso slug={institucion} />
      </div>
      <p className="pointer-events-none fixed bottom-4 left-0 right-0 text-center text-[11px] text-tenue">Un producto del Grupo Corazones Cruzados</p>
    </AplicaMarca>
  );
}
