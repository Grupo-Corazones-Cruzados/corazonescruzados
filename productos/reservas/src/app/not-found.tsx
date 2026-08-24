import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NoEncontrado() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fondo px-4">
      <div className="tarjeta w-full max-w-md p-8 text-center">
        <SearchX className="mx-auto mb-3 h-8 w-8 text-tenue" />
        <h1 className="text-[17px] font-semibold">Esta dirección no existe</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-tenue">
          Comprueba el enlace que te dieron. Cada alojamiento tiene su propia dirección.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block text-[13px] font-semibold text-acento underline underline-offset-2"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
