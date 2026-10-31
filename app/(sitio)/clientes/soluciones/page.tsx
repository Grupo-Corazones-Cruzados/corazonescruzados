/**
 * CLIENTES ▸ SOLUCIONES — el tema «Soluciones» de Clientes con la lista de todas las soluciones.
 *
 * Tiene carpeta propia (y no pasa por `[necesidad]`) porque de ella cuelga la página de cada
 * solución: `/clientes/soluciones/<slug>`. Pinta lo mismo que `/clientes` con este tema abierto.
 */

import type { Metadata } from 'next';
import { SITIO, OG_IMAGEN, temaClientesPorId } from '@/lib/sitio/contenido';
import { Contenedor, PresentacionPagina } from '@/components/sitio/piezas';
import { PRESENTACION_CLIENTES } from '@/components/sitio/presentaciones';
import TemasClientes from '@/components/sitio/TemasClientes';

export const dynamic = 'force-dynamic';

const tema = temaClientesPorId('soluciones');

export const metadata: Metadata = {
  title: 'Soluciones',
  description: tema?.descripcion,
  alternates: { canonical: '/clientes/soluciones' },
  openGraph: {
    title: `Soluciones — ${SITIO.nombre}`,
    description: tema?.descripcion,
    url: `${SITIO.url}/clientes/soluciones`,
    type: 'website',
    locale: 'es_EC',
    images: [OG_IMAGEN],
  },
};

export default function ClientesSolucionesPage() {
  return (
    <section className="flex-1 pt-6 sm:pt-10 pb-16">
      <Contenedor ancho="sitio">
        <PresentacionPagina {...PRESENTACION_CLIENTES} />
        <TemasClientes inicial="soluciones" />
      </Contenedor>
    </section>
  );
}
