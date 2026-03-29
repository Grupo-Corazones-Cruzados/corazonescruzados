'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import BrandLoader from '@/components/ui/BrandLoader';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-digi-darker">
        <BrandLoader size="lg" label="Cargando..." />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
