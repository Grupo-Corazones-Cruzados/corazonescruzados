'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import CvPanel from '@/components/settings/CvPanel';
import { ChevronLeft } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function CvPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-2" style={mf}>
        <ChevronLeft className="w-4 h-4" /> Configuración
      </Link>
      <PageHeader title="Mi CV" description="Edita tu currículum vitae" />

      {user?.member_id ? (
        <CvPanel />
      ) : (
        <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center">
          <p className="text-sm text-digi-muted" style={mf}>Solo disponible para miembros.</p>
        </div>
      )}
    </div>
  );
}
