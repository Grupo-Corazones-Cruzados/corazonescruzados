import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Gestión de Reservas', template: '%s · Gestión de Reservas' },
  description:
    'Gestión de reservas para alojamientos: ubicaciones, suites, agenda y reportes. Un producto del Grupo Corazones Cruzados.',
  // El producto es de uso privado de cada hotel: no hay nada que indexar.
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
