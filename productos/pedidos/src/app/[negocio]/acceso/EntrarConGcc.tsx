'use client';

import { BOTON_PRIMARIO } from '@/componentes/ui';
import { cn } from '@/lib/utils';

/**
 * LA PUERTA DE UN NEGOCIO QUE NO ES DE DEMOSTRACIÓN (Fernando, 2026-11-08: todos los usuarios son
 * clientes de GCC World y entran por GCC World). No hay usuario ni contraseña propios: el botón va a
 * la plataforma, que pide su sesión si hace falta y vuelve con un pase de un uso a `/<slug>/entrar`.
 * Con `fuera=1`, porque se viene de una pestaña normal y el producto se ve con su menú propio.
 *
 * Es de cliente solo para poder usar `BOTON_PRIMARIO` (vive en el catálogo de controles, que es de
 * cliente): un enlace con el aspecto del botón principal, no un botón «parecido».
 */
export default function EntrarConGcc({ href }: { href: string }) {
  return (
    <div className="space-y-3 text-center">
      <h2 className="text-[15px] font-semibold text-texto">Entra con tu cuenta de GCC World</h2>
      <a href={href} className={cn(BOTON_PRIMARIO, 'h-9 w-full px-4 text-[13px]')}>
        Entrar con GCC World
      </a>
    </div>
  );
}
