import { exigirContexto } from '@/lib/inquilino';
import { urlLogo } from '@/lib/marca';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
import { Armazon } from '@/componentes/Armazon';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';
import { estaEmbebido } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del PERSONAL. `exigirContexto` decide si esta pantalla
 * llega a existir: sin sesión manda a acceder, con la mensualidad vencida manda a
 * suscripción y a un cliente final lo devuelve a su portal. Las páginas de dentro
 * ya no comprueban nada de eso.
 *
 * El armazón es el de Automatizaciones (2026-11-08): la columna mide la ventana, el `main` se
 * desplaza y es `flex-col`, así una página pide `flex-1` y su último bloque llega hasta el pie.
 * La franja de demostración va en escritorio a TODO el ancho (`--alto-aviso`), por encima del
 * menú y del contenido, para que las dos cabeceras de 68 px sigan alineadas.
 */
export default async function LayoutApp({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ negocio: string }>;
}) {
  const { negocio } = await params;
  const { inquilino, sesion } = await exigirContexto(negocio);
  // Dentro de GCC World el menú lo pone la plataforma (`/<slug>/entrar`, `lib/sesion.ts`).
  const embebido = await estaEmbebido();
  const quien = { tipo: 'personal' as const, rol: sesion.rol };
  const menu = { slug: negocio, negocio: inquilino.nombre, logoUrl: urlLogo(inquilino), usuario: sesion.nombre, quien };

  return (
    <AplicaMarca>
      <Armazon aviso={inquilino.soloLectura ? <AvisoEscaparate /> : null} embebido={embebido}
        lateral={<BarraLateral {...menu} />} inferior={<BarraInferior {...menu} />}>
        {children}
      </Armazon>
    </AplicaMarca>
  );
}
