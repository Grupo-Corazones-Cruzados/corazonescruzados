'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import CargaPanel from '@/components/dashboard/CargaPanel';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  // La silueta del panel, con el tema de este equipo (ver `CargaPanel`).
  if (isLoading) return <CargaPanel />;

  if (!user) return null;

  return <>{children}</>;
}
