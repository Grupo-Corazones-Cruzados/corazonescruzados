import { notFound, redirect } from 'next/navigation';
import { espacioHabilitado, llamarServicio, sesionValida } from '@/lib/espacio-trabajo/guardia';
import FormAcceso from '@/components/espacio/FormAcceso';
import { destinoSeguro } from '@/components/espacio/api';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Espacio de trabajo', robots: { index: false, follow: false } };

export default async function Acceso({ searchParams }: { searchParams: Promise<{ volver?: string }> }) {
  if (!espacioHabilitado()) notFound();
  if (await sesionValida()) redirect(destinoSeguro((await searchParams).volver));
  let servicio = false;
  let claveConfigurada = false;
  try {
    const r = await llamarServicio('/estado');
    if (r.ok) { servicio = true; claveConfigurada = !!(await r.json()).claveConfigurada; }
  } catch { /* lo dice el formulario */ }
  return <FormAcceso servicio={servicio} claveConfigurada={claveConfigurada} />;
}
