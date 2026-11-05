/**
 * MIEMBROS — pestaña nueva, VACÍA a propósito (Fernando, 2026-10-31).
 *
 * El sitio pasa a Inicio · Candidatos · Clientes · Miembros y Fernando dictará qué va aquí;
 * buena parte saldrá de Soluciones. Hasta entonces no se indexa: una página
 * vacía en Google es peor que ninguna.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Miembros',
  alternates: { canonical: '/miembros' },
  robots: { index: false, follow: true },
};

export default function MiembrosPage() {
  return (
    <section className="flex-1 pt-6 sm:pt-10 pb-16">
      <h1 className="sr-only">Miembros</h1>
    </section>
  );
}
