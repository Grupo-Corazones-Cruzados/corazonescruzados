import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { AplicaMarca, LogoHotel } from '@/componentes/Marca';
import FormularioAcceso from './FormularioAcceso';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await params;
  const inq = await prisma.inquilino.findUnique({ where: { slug: hotel }, select: { nombre: true } });
  return { title: inq ? `Acceso · ${inq.nombre}` : 'Acceso' };
}

export default async function PaginaAcceso({ params }: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await params;
  const inquilino = await prisma.inquilino.findUnique({ where: { slug: hotel } });
  if (!inquilino) notFound();

  // Si ya hay sesión de ESTE hotel, no se pide de nuevo.
  const sesion = await leerSesionUsuario();
  if (sesion?.slug === hotel) redirect(`/${hotel}/panel`);

  return (
    <AplicaMarca
      colorAcento={inquilino.colorAcento}
      tema={inquilino.tema}
      className="flex items-center justify-center px-4 py-10"
    >
      <div className="tarjeta w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoHotel nombre={inquilino.nombre} logoUrl={inquilino.logoUrl} tamano={52} />
          <div>
            <h1 className="text-[17px] font-semibold text-texto">{inquilino.nombre}</h1>
            <p className="text-[12px] text-tenue">Gestión de Reservas</p>
          </div>
        </div>
        <FormularioAcceso slug={hotel} />
      </div>
      <p className="pointer-events-none fixed bottom-4 left-0 right-0 text-center text-[11px] text-tenue">
        Un producto del Grupo Corazones Cruzados
      </p>
    </AplicaMarca>
  );
}
