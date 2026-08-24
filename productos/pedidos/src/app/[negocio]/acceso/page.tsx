import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { AplicaMarca, LogoHotel } from '@/componentes/Marca';
import FormularioAcceso from './FormularioAcceso';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const inq = await prisma.inquilino.findUnique({ where: { slug: negocio }, select: { nombre: true } });
  return { title: inq ? `Acceso · ${inq.nombre}` : 'Acceso' };
}

export default async function PaginaAcceso({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const inquilino = await prisma.inquilino.findUnique({ where: { slug: negocio } });
  if (!inquilino) notFound();

  // Si ya hay sesión de ESTE negocio, no se pide de nuevo.
  // ⚠️ Se comprueba también el IDENTIFICADOR, no solo el código. Una sesión firmada
  // para un inquilino que ya no existe —o que se recreó con otro id— tiene el slug
  // correcto pero no resuelve: el acceso mandaba al panel, el panel devolvía al
  // acceso, y el navegador acababa en ERR_TOO_MANY_REDIRECTS. Si no cuadra, se
  // pide entrar otra vez, que es lo único que puede arreglarlo.
  const sesion = await leerSesionUsuario();
  if (sesion?.slug === negocio && sesion.inquilinoId === inquilino.id) redirect(`/${negocio}/panel`);

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
            <p className="text-[12px] text-tenue">Gestión de Pedidos</p>
          </div>
        </div>
        {inquilino.soloLectura && (
          <p className="mb-4 rounded border border-borde bg-acento-suave px-3 py-2 text-center text-[12px] leading-relaxed text-acento">
            Negocio de demostración. Se puede recorrer entero; los cambios no se guardan.
          </p>
        )}
        <FormularioAcceso slug={negocio} />
      </div>
      <p className="pointer-events-none fixed bottom-4 left-0 right-0 text-center text-[11px] text-tenue">
        Un producto del Grupo Corazones Cruzados
      </p>
    </AplicaMarca>
  );
}
