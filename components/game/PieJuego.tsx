'use client';

// Los temas y las transiciones del panel: fuera de él (`/juego`) no se cargan solos.
import '@/app/tema-progreso.css';
import '@/app/temas.css';
import '@/app/movimiento.css';
import { useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardBreadcrumb from '@/components/dashboard/DashboardBreadcrumb';
import NotificationsDock from '@/components/notifications/NotificationsDock';
import ChatDock from '@/components/chat/ChatDock';
import AgentePresupuestos from '@/components/sitio/AgentePresupuestos';
import { appDeTelefono } from '@/lib/sitio/appDeTelefono';

/**
 * EL PIE DEL PANEL TAMBIÉN EN EL VIDEOJUEGO (Fernando, 2026-11-08: «ese pie de página es súper
 * importante… incluso necesitamos que funcione en el videojuego»): las notificaciones, el chat
 * global, mis chats y el asistente, igual que en el resto. Con el tema negro de Aventura. El juego
 * (`app/juego`) deja su alto (`.juego-con-pie`). Sin sesión del panel no se pinta: no habría nada que
 * mostrar en él.
 */
export default function PieJuego() {
  const { user } = useAuth();
  useEffect(() => {
    const app = appDeTelefono();
    if (app) document.documentElement.dataset.gccApp = app;
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('juego-con-pie', !!user);
    return () => document.documentElement.classList.remove('juego-con-pie');
  }, [user]);
  if (!user) return null;
  return (
    <div className="corp tema-progreso tema-negro dark pie-juego">
      <DashboardBreadcrumb collapsed />
      <NotificationsDock />
      <ChatDock />
      <AgentePresupuestos enPie />
    </div>
  );
}
