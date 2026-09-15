import { exigirContextoCliente } from '@/lib/inquilino';
import MiDireccionCliente from './MiDireccionCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi dirección' };

export default async function PaginaMiDireccion({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const { inquilino, cliente } = await exigirContextoCliente(negocio);
  return (
    <MiDireccionCliente
      slug={negocio}
      comidas={inquilino.tiposComida}
      datos={{
        nombre: cliente.nombre, celular: cliente.celular, edad: cliente.edad,
        facebook: cliente.facebook, instagram: cliente.instagram, tiktok: cliente.tiktok,
        altura: cliente.altura, peso: cliente.peso, genero: cliente.genero, frecuenciaActividad: cliente.frecuenciaActividad,
        direccion: cliente.direccion, edificio: cliente.edificio, piso: cliente.piso, referencias: cliente.referencias, colorIdentificador: cliente.colorIdentificador,
        direccion2: cliente.direccion2, edificio2: cliente.edificio2, piso2: cliente.piso2, referencias2: cliente.referencias2, colorIdentificador2: cliente.colorIdentificador2,
        diasDireccion2: cliente.diasDireccion2, tiposComida: cliente.tiposComida,
        sinAgua: cliente.sinAgua, sinFruta: cliente.sinFruta, sinCubiertos: cliente.sinCubiertos, envasesPropios: cliente.envasesPropios,
        motorizadoId: cliente.motorizadoId, motorizado2Id: cliente.motorizado2Id,
      }}
    />
  );
}
