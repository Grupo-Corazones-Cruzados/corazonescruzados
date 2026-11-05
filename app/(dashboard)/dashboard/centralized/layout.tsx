import type { ReactNode } from 'react';
import PuertaCentralizado from '@/components/centralized/PuertaCentralizado';

export default function LayoutCentralizado({ children }: { children: ReactNode }) {
  return <PuertaCentralizado>{children}</PuertaCentralizado>;
}
