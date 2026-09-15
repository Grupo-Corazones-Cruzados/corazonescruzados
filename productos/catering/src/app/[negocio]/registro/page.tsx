import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AplicaMarca, LogoNegocio } from '@/componentes/Marca';
import FormularioRegistro from './FormularioRegistro';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const inq = await prisma.inquilino.findUnique({ where: { slug: negocio }, select: { nombre: true } });
  return { title: inq ? `Registro · ${inq.nombre}` : 'Registro' };
}

/** Alta pública del cliente final. Corta: lo demás lo completa en el portal cuando lo aprueben. */
export default async function PaginaRegistro({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const inquilino = await prisma.inquilino.findUnique({ where: { slug: negocio } });
  if (!inquilino) notFound();

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema} className="flex items-center justify-center px-4 py-10">
      <div className="tarjeta w-full max-w-lg p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoNegocio nombre={inquilino.nombre} logoUrl={inquilino.logoUrl} tamano={52} />
          <div>
            <h1 className="text-[17px] font-semibold text-texto">Regístrate en {inquilino.nombre}</h1>
            <p className="text-[12px] text-tenue">Tu registro queda pendiente hasta que el negocio lo apruebe.</p>
          </div>
        </div>
        {!inquilino.registroAbierto ? (
          <p className="rounded border border-borde bg-aviso-suave px-3 py-2 text-center text-[13px] text-aviso">Este negocio no acepta registros por ahora. Ponte en contacto con ellos.</p>
        ) : inquilino.soloLectura ? (
          <p className="rounded border border-borde bg-acento-suave px-3 py-2 text-center text-[13px] text-acento">Negocio de demostración: el registro no se guarda. Entra con la cuenta de prueba.</p>
        ) : (
          <FormularioRegistro slug={negocio} comidas={inquilino.tiposComida} />
        )}
        <p className="mt-5 border-t border-borde pt-4 text-center text-[12px] text-tenue">
          ¿Ya tienes cuenta? <Link href={`/${negocio}/acceso`} className="font-semibold text-acento underline underline-offset-2">Entra</Link>
        </p>
      </div>
    </AplicaMarca>
  );
}
