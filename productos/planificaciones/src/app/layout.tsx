import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Planificación de Clases', template: '%s · Planificación de Clases' },
  description:
    'Planificaciones de unidad didáctica redactadas por un agente que trabaja como la docente: por semanas, con destrezas del currículo y descarga en PDF. Un producto del Grupo Corazones Cruzados.',
  // El producto es de uso privado de cada negocio: no hay nada que indexar.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
