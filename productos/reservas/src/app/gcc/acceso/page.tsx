import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { leerSesionOperador } from '@/lib/sesion';
import FormularioOperador from './FormularioOperador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acceso del equipo' };

export default async function AccesoOperador() {
  if (await leerSesionOperador()) redirect('/gcc');
  return (
    <main className="flex min-h-screen items-center justify-center bg-fondo px-4">
      <div className="tarjeta w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-acento-suave">
            <ShieldCheck className="h-6 w-6 text-acento" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold">Equipo GCC</h1>
            <p className="text-[12px] text-tenue">Administración de Gestión de Reservas</p>
          </div>
        </div>
        <FormularioOperador />
      </div>
    </main>
  );
}
