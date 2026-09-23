import { redirect } from 'next/navigation';
import { leerSesionOperador } from '@/lib/sesion';
import FormularioOperador from './FormularioOperador';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acceso del equipo' };

export default async function PaginaAccesoGcc() {
  if (await leerSesionOperador()) redirect('/gcc');
  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo px-4 py-10">
      <div className="tarjeta w-full max-w-sm p-8">
        <h1 className="text-[17px] font-semibold text-texto">Automatizaciones</h1>
        <p className="mb-5 text-[12px] text-tenue">Área del equipo del Grupo Corazones Cruzados</p>
        <FormularioOperador />
      </div>
    </main>
  );
}
