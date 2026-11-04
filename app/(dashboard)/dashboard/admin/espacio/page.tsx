import { notFound, redirect } from 'next/navigation';
import { espacioHabilitado, sesionValida } from '@/lib/espacio-trabajo/guardia';
import EspacioTrabajo from '@/components/espacio/EspacioTrabajo';

export const dynamic = 'force-dynamic';

export default async function PaginaEspacio() {
  if (!espacioHabilitado()) notFound();
  if (!(await sesionValida())) redirect('/espacio-acceso');
  return <EspacioTrabajo />;
}
