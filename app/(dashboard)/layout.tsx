'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '@/components/providers/AuthGuard';
import PolicyEffectsProvider from '@/components/providers/PolicyEffectsProvider';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardBreadcrumb from '@/components/dashboard/DashboardBreadcrumb';
import DashboardAccessGuard from '@/components/dashboard/DashboardAccessGuard';
import PolicyBanner from '@/components/dashboard/PolicyBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('gcc_dash_theme') === 'dark') setDark(true);
      if (localStorage.getItem('gcc_dash_collapsed') === '1') setCollapsed(true);
    } catch {}
  }, []);

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      try { localStorage.setItem('gcc_dash_theme', next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('gcc_dash_collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  return (
    <AuthGuard>
      <PolicyEffectsProvider>
        <div className={`corp ${dark ? 'dark' : ''} flex min-h-screen`}>
          <DashboardSidebar dark={dark} onToggleTheme={toggleTheme} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
          <main className={`flex-1 ml-0 ${collapsed ? 'lg:ml-16' : 'lg:ml-56'} p-4 md:p-6 pt-14 lg:pt-6 pb-12 overflow-auto min-h-screen transition-[margin] duration-200`}>
            <PolicyBanner />
            <DashboardAccessGuard>{children}</DashboardAccessGuard>
          </main>
          <DashboardBreadcrumb collapsed={collapsed} />
        </div>
      </PolicyEffectsProvider>
    </AuthGuard>
  );
}
