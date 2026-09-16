import { exigirContexto } from '@/lib/inquilino';
import NegocioCliente from './NegocioCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Negocio' };

export default async function PaginaNegocio({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino: i } = await exigirContexto(institucion, 'administrar');
  return (
    <NegocioCliente
      slug={institucion}
      datos={{
        nombre: i.nombre,
        contactoNombre: i.contactoNombre,
        contactoEmail: i.contactoEmail,
        contactoTelefono: i.contactoTelefono,
        cabeceraLinea1: i.cabeceraLinea1,
        cabeceraLinea2: i.cabeceraLinea2,
        cabeceraLinea3: i.cabeceraLinea3,
        anioLectivo: i.anioLectivo,
        deceResponsable: i.deceResponsable,
        logoInstitucionUrl: i.logoInstitucionUrl,
        logoOrganizacionUrl: i.logoOrganizacionUrl,
        logoOpcionalUrl: i.logoOpcionalUrl,
      }}
    />
  );
}
