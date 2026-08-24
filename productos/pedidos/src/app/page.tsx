import Link from 'next/link';
import { UtensilsCrossed } from 'lucide-react';

/**
 * Portada. Cada negocio entra por SU dirección (/su-codigo/acceso), así que aquí
 * no hay formulario: no se sabría a qué negocio mandar las credenciales, y un
 * formulario que a veces funciona es peor que ninguno.
 */
export default function Portada() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-fondo px-4">
      <div className="tarjeta w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-acento-suave">
          <UtensilsCrossed className="h-6 w-6 text-acento" />
        </div>
        <h1 className="text-[20px] font-semibold text-texto">Gestión de Pedidos</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-tenue">
          Mesas, carta, cocina y cobro para negocios de comida. Cada local entra por su propia
          dirección: usa el enlace que te dieron, termina en{' '}
          <span className="font-mono text-texto">/acceso</span>.
        </p>
        <p className="mt-6 text-[12px] text-tenue">
          ¿Lo quieres para tu negocio?{' '}
          <a
            href="https://www.grupocc.org/contacto"
            className="font-semibold text-acento underline underline-offset-2"
          >
            Habla con el Grupo Corazones Cruzados
          </a>
          .
        </p>
        <p className="mt-8 border-t border-borde pt-4 text-[11px] text-tenue">
          <Link href="/gcc" className="hover:text-texto">
            Acceso del equipo GCC
          </Link>
        </p>
      </div>
    </main>
  );
}
