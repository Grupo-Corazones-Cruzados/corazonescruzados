'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/providers/AuthGuard';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem('gcc_dash_theme') === 'dark') setDark(true); } catch {}
  }, []);

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      try { localStorage.setItem('gcc_dash_theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  return (
    <AuthGuard>
      <div className={`corp ${dark ? 'dark' : ''} flex min-h-screen`}>
        <DashboardSidebar dark={dark} onToggleTheme={toggleTheme} />
        <main className="flex-1 ml-0 lg:ml-56 p-4 md:p-6 pt-14 lg:pt-6 overflow-auto min-h-screen">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
