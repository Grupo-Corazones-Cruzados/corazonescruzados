/**
 * Una puerta por tipo de cuenta: /auth/cliente · /auth/miembro · /auth/candidato.
 *
 * Antes había una sola pantalla para todos, y no distinguía nada: un candidato entraba por
 * la misma puerta que un cliente. Ahora cada quien tiene su enlace —que además se puede
 * compartir como «este es el acceso de tus clientes»— y el servidor comprueba que la
 * cuenta encaje con la puerta (`login/begin` → `cuentaEncaja`).
 *
 * Una URL inventada no cuela: si el tipo no es de los tres, es 404.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import FormularioAcceso from '@/components/auth/FormularioAcceso';
import { PERFILES, esTipoValido, type TipoCuenta } from '@/lib/auth/tipos';

export function generateStaticParams() {
  return (Object.keys(PERFILES) as TipoCuenta[]).map((tipo) => ({ tipo }));
}

export async function generateMetadata({ params }: { params: Promise<{ tipo: string }> }): Promise<Metadata> {
  const { tipo } = await params;
  if (!esTipoValido(tipo)) return { title: 'Acceso' };
  return { title: `${PERFILES[tipo].titulo} · GCC World`, robots: { index: false } };
}

export default async function PaginaAcceso({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (!esTipoValido(tipo)) notFound();

  return (
    <Suspense>
      <FormularioAcceso tipo={tipo} />
    </Suspense>
  );
}
