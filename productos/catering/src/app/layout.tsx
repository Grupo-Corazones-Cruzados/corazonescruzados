import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  // REGLA DE LOS PRODUCTOS (Fernando, 2026-11-08): el nombre de la ventana empieza por «GCC».
  title: { default: 'GCC · Gestión de Catering', template: 'GCC · %s · Gestión de Catering' },
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
