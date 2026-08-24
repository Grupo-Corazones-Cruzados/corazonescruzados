import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Gestión de Pedidos', template: '%s · Gestión de Pedidos' },
  description:
    'Control de pedidos para negocios de comida: mesas, carta, cocina y cobro. Un producto del Grupo Corazones Cruzados.',
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
