import type { Metadata } from 'next';
import { Lora } from 'next/font/google';
import LibroHistoria from '@/components/libro/LibroHistoria';

/** La letra del libro: una serif de lectura, solo en esta página (Fernando: «el libro debe tener su color o diseño»). */
const lora = Lora({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-libro', display: 'swap' });

/** «El libro de GCC World»: la postulación contada como un cuento (propuesta, 2026-11-12). Fuera de buscadores
 *  mientras Fernando la revisa. */
export const metadata: Metadata = {
  title: 'El libro · Grupo Corazones Cruzados',
  description: 'La historia del Grupo Corazones Cruzados, contada como un libro.',
  robots: { index: false, follow: false },
};

export default function PaginaLibro() {
  return <LibroHistoria fuente={lora.variable} />;
}
