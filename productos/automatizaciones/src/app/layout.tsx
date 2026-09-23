import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Automatizaciones de WhatsApp', template: '%s · Automatizaciones de WhatsApp' },
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
