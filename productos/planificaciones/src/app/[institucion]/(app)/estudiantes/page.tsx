import { exigirContexto } from '@/lib/inquilino';
import { estudiantesDe, gradosDelDocente } from '@/lib/estudiantes';
import EstudiantesCliente from './EstudiantesCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Estudiantes' };

export default async function PaginaEstudiantes({ params, searchParams }: { params: Promise<{ institucion: string }>; searchParams: Promise<{ g?: string }> }) {
  const { institucion } = await params;
  const b = await searchParams;
  const { inquilino, sesion } = await exigirContexto(institucion, 'planificar');
  const grados = await gradosDelDocente(inquilino.id, sesion.uid, sesion.rol);
  const grado = grados.find((g) => g.id === Number(b.g)) ?? grados[0] ?? null;
  const estudiantes = grado ? await estudiantesDe(grado.id) : [];
  return <EstudiantesCliente slug={institucion} grados={grados} gradoId={grado?.id ?? null} estudiantes={estudiantes} soloLectura={inquilino.soloLectura} />;
}
