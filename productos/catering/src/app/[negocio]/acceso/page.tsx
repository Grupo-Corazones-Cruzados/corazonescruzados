import { notFound, redirect } from 'next/navigation';
import { urlLogo } from '@/lib/marca';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { leerSesionUsuario } from '@/lib/sesion';
import { INICIO_DE_ROL } from '@/lib/permisos';
import { AplicaMarca, LogoNegocio } from '@/componentes/Marca';
import FormularioAcceso from './FormularioAcceso';
import EntrarConGcc from './EntrarConGcc';
import { config } from '@/lib/identidadGcc';

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
  if (sesion?.slug === negocio && sesion.inquilinoId === inquilino.id)
    redirect(sesion.tipo === 'cliente' ? `/${negocio}/mi-servicio` : `/${negocio}/${INICIO_DE_ROL[sesion.rol]}`);

  // Fuera de los escaparates, aquí ya no se escribe ninguna contraseña (Fernando, 2026-11-08): se
  // entra con la cuenta de GCC World. La dirección de la plataforma se lee en el servidor.
  // ⚠️ Solo el PERSONAL: el cliente final del portal sigue entrando con su correo y su contraseña,
  // en el mismo formulario de siempre (que aquí queda solo para él). `destino=inicio` no es una
  // pantalla: `entrar/route.ts` lo manda al puesto de su oficio, como el acceso normal.
  const conGcc = !inquilino.soloLectura;
  const urlGcc = `${config().base}/api/productos/entrar?${new URLSearchParams({
    producto: 'catering', slug: negocio, destino: 'inicio', fuera: '1',
  })}`;

  return (
    <AplicaMarca className="flex items-center justify-center px-4 py-10"
    >
      <div className="tarjeta w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoNegocio nombre={inquilino.nombre} logoUrl={urlLogo(inquilino)} tamano={52} />
          <div>
            <h1 className="text-[17px] font-semibold text-texto">{inquilino.nombre}</h1>
            <p className="text-[12px] text-tenue">Gestión de Catering</p>
          </div>
        </div>
        {inquilino.soloLectura && (
          <p className="mb-4 rounded border border-borde bg-acento-suave px-3 py-2 text-center text-[12px] leading-relaxed text-acento">
            Negocio de demostración. Se puede recorrer entero; los cambios no se guardan.
          </p>
        )}
        {conGcc ? (
          <>
            <EntrarConGcc href={urlGcc} />
            <div className="mt-6 border-t border-borde pt-5">
              <p className="mb-3 text-center text-[12.5px] font-semibold text-texto">¿Eres cliente del servicio?</p>
              <FormularioAcceso slug={negocio} soloClientes />
            </div>
          </>
        ) : (
          <FormularioAcceso slug={negocio} />
        )}
        {inquilino.registroAbierto && (
          <p className="mt-5 border-t border-borde pt-4 text-center text-[12px] text-tenue">
            ¿Todavía no eres cliente?{' '}
            <Link href={`/${negocio}/registro`} className="font-semibold text-acento underline underline-offset-2">
              Regístrate
            </Link>
          </p>
        )}
      </div>
      <p className="pointer-events-none fixed bottom-4 left-0 right-0 text-center text-[11px] text-tenue">
        Un producto del Grupo Corazones Cruzados
      </p>
    </AplicaMarca>
  );
}
