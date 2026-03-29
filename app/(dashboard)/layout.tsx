'use client';

import AuthGuard from '@/components/providers/AuthGuard';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <main className="flex-1 ml-0 lg:ml-56 p-4 md:p-6 pt-14 lg:pt-6 overflow-auto min-h-screen">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
