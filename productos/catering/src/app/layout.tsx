import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Gestión de Catering', template: '%s · Gestión de Catering' },
  description:
    'Comida por suscripción a domicilio: clientes, servicios por días, menú del día, etiquetas y rutas de reparto. Un producto del Grupo Corazones Cruzados.',
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
