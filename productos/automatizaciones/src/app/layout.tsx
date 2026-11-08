import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  // REGLA DE LOS PRODUCTOS (Fernando, 2026-11-08): el nombre de la ventana empieza por «GCC».
  title: { default: 'GCC · Automatizaciones de WhatsApp', template: 'GCC · %s · Automatizaciones de WhatsApp' },
  description:
    'Agente de IA en WhatsApp, campañas de correo y plantillas. Un producto del Grupo Corazones Cruzados.',
  // El producto es de uso privado de cada cliente: no hay nada que indexar.
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
