import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { AplicaMarca, LogoHotel } from '@/componentes/Marca';
import { urlLogo } from '@/lib/marca';
import FormularioAcceso, { EntrarConGcc } from './FormularioAcceso';

export const dynamic = 'force-dynamic';

/** El paso a GCC World desde una pestaña normal (`fuera=1`: con el menú propio del producto). */
function urlGcc(slug: string) {
  const base = (process.env.GCC_URL || 'https://app.grupocc.org').replace(/\/$/, '');
  const q = new URLSearchParams({ producto: 'automatizaciones', slug, destino: 'panel', fuera: '1' });
  return `${base}/api/productos/entrar?${q}`;
}

export async function generateMetadata({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const inq = await prisma.inquilino.findUnique({ where: { slug: cliente }, select: { nombre: true } });
  return { title: inq ? `Acceso · ${inq.nombre}` : 'Acceso' };
}

export default async function PaginaAcceso({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const inquilino = await prisma.inquilino.findUnique({ where: { slug: cliente } });
  if (!inquilino) notFound();

  // Si ya hay sesión de ESTE cliente, no se pide de nuevo.
  // ⚠️ Se comprueba también el IDENTIFICADOR, no solo el código: una sesión firmada
  // para un inquilino que se recreó con otro id tiene el slug bueno pero no resuelve,
  // y acceso y panel se rebotan hasta ERR_TOO_MANY_REDIRECTS.
  const sesion = await leerSesionUsuario();
  if (sesion?.slug === cliente && sesion.inquilinoId === inquilino.id) redirect(`/${cliente}/panel`);

  return (
    <AplicaMarca
      className="flex items-center justify-center px-4 py-10"
    >
      <div className="tarjeta w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoHotel nombre={inquilino.nombre} logoUrl={urlLogo(inquilino)} tamano={52} />
          <div>
            <h1 className="text-[17px] font-semibold text-texto">{inquilino.nombre}</h1>
            <p className="text-[12px] text-tenue">Automatizaciones de WhatsApp</p>
          </div>
        </div>
        {inquilino.soloLectura && (
          <p className="mb-4 rounded border border-borde bg-acento-suave px-3 py-2 text-center text-[12px] leading-relaxed text-acento">
            Cliente de demostración. Se puede recorrer entero; los cambios no se guardan.
          </p>
        )}
        {/*
          Solo el escaparate conserva usuario y contraseña propios; en los demás se entra con la
          cuenta de GCC World de cada persona (Fernando, 2026-11-08). La plataforma inicia sesión si
          hace falta, comprueba que la cuenta tiene este negocio y vuelve a `entrar` con un pase.
        */}
        {inquilino.soloLectura ? (
          <FormularioAcceso slug={cliente} />
        ) : (
          <EntrarConGcc url={urlGcc(cliente)} />
        )}
      </div>
      <p className="pointer-events-none fixed bottom-4 left-0 right-0 text-center text-[11px] text-tenue">
        Un producto del Grupo Corazones Cruzados
      </p>
    </AplicaMarca>
  );
}
