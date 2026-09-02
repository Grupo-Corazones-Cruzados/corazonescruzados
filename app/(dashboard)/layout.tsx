'use client';

import AuthGuard from '@/components/providers/AuthGuard';
import PolicyEffectsProvider from '@/components/providers/PolicyEffectsProvider';
import { ProveedorTemaPanel, useTemaPanel } from '@/components/providers/TemaPanel';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardBreadcrumb from '@/components/dashboard/DashboardBreadcrumb';
import DashboardAccessGuard from '@/components/dashboard/DashboardAccessGuard';
import PolicyBanner from '@/components/dashboard/PolicyBanner';
import ChatDock from '@/components/chat/ChatDock';
import NotificationsDock from '@/components/notifications/NotificationsDock';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PolicyEffectsProvider>
        <ProveedorTemaPanel>
          <Panel>{children}</Panel>
        </ProveedorTemaPanel>
      </PolicyEffectsProvider>
    </AuthGuard>
  );
}

/**
 * ⚠️ Componente aparte y no el cuerpo del layout: `useTemaPanel()` tiene que leerse DENTRO
 * del proveedor, y un componente no puede consumir un contexto que él mismo monta.
 */
function Panel({ children }: { children: React.ReactNode }) {
  const { oscuro } = useTemaPanel();

  /**
   * ⇒ EL MENÚ YA NO SE COLAPSA A MANO: se abre al pasar el puntero (ver
   * `DashboardSidebar`). Por eso aquí el margen es SIEMPRE el del raíl estrecho.
   *
   * Es la clave de que funcione: el menú abierto se monta ENCIMA del contenido en vez de
   * empujarlo. Si empujara, la página entera se movería cada vez que el ratón cruza la
   * izquierda camino de otra cosa — y eso marea y hace perder el sitio donde se estaba
   * leyendo.
   */
  return (
    <div className={`corp ${oscuro ? 'dark' : ''} flex min-h-screen`}>
      <PolicyBanner collapsed />
      <DashboardSidebar />
      {/* ⚠️ `pt-[4.5rem]` en teléfono = los 56 px de la cabecera fija + los 16 de respiro
          que tienen los otros tres lados. Antes era `pt-14`, exactamente el alto de la
          barra, así que el contenido nacía pegado a ella sin un pixel de margen. En
          escritorio no hay cabecera y manda `lg:pt-6`.

          Este relleno es lo que sostiene a TODAS las páginas del panel: la barra es fija,
          así que si alguna arrancara por encima de él se metería debajo. Cualquier
          superficie que deba taparla —un diálogo, un panel deslizante— va con z-50 o más,
          por encima de la cabecera (z-30). */}
      <main className="flex-1 ml-0 lg:ml-16 p-4 md:p-6 pt-[4.5rem] lg:pt-6 pb-14 overflow-auto min-h-screen">
        <DashboardAccessGuard>{children}</DashboardAccessGuard>
      </main>
      <DashboardBreadcrumb collapsed />
      {/* Muelle inferior derecho, de derecha a izquierda: campanita · Mis chats · Chat
          (y GCC Bot cuando hay cotización). La campanita es el ancla: los demás se miden
          contra ella. Dentro de `.corp` para heredar el tema. */}
      <NotificationsDock />
      <ChatDock />
    </div>
  );
}
