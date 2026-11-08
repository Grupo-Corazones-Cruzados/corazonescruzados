import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { AplicaMarca, LogoHotel } from '@/componentes/Marca';
import FormularioAcceso from './FormularioAcceso';
import EntrarConGcc from './EntrarConGcc';
import { config } from '@/lib/identidadGcc';

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
  // ⚠️ Se comprueba también el IDENTIFICADOR, no solo el código. Una sesión firmada
  // para un inquilino que ya no existe —o que se recreó con otro id— tiene el slug
  // correcto pero no resuelve: el acceso mandaba al panel, el panel devolvía al
  // acceso, y el navegador acababa en ERR_TOO_MANY_REDIRECTS. Si no cuadra, se
  // pide entrar otra vez, que es lo único que puede arreglarlo.
  const sesion = await leerSesionUsuario();
  if (sesion?.slug === hotel && sesion.inquilinoId === inquilino.id) redirect(`/${hotel}/panel`);

  // Fuera de los escaparates, aquí ya no se escribe ninguna contraseña (Fernando, 2026-11-08): se
  // entra con la cuenta de GCC World. La dirección de la plataforma se lee en el servidor.
  const conGcc = !inquilino.soloLectura;
  const urlGcc = `${config().base}/api/productos/entrar?${new URLSearchParams({
    producto: 'reservas', slug: hotel, destino: 'panel', fuera: '1',
  })}`;

  return (
    <AplicaMarca
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
        {inquilino.soloLectura && (
          <p className="mb-4 rounded border border-borde bg-acento-suave px-3 py-2 text-center text-[12px] leading-relaxed text-acento">
            Alojamiento de demostración. Se puede recorrer entero; los cambios no se guardan.
          </p>
        )}
        {conGcc ? <EntrarConGcc href={urlGcc} /> : <FormularioAcceso slug={hotel} />}
      </div>
      <p className="pointer-events-none fixed bottom-4 left-0 right-0 text-center text-[11px] text-tenue">
        Un producto del Grupo Corazones Cruzados
      </p>
    </AplicaMarca>
  );
}
