import type { Metadata } from 'next';
import LibroHistoria from '@/components/libro/LibroHistoria';

/** «El libro de GCC World»: la postulación contada como un cuento. Es el mismo libro que abre «Postularme»;
 *  esta página es su dirección directa. Fuera de buscadores. */
export const metadata: Metadata = {
  title: 'El libro · Grupo Corazones Cruzados',
  description: 'La historia del Grupo Corazones Cruzados, contada como un libro.',
  robots: { index: false, follow: false },
};

export default function PaginaLibro() {
  return <LibroHistoria />;
}
