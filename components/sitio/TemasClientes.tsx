/**
 * LOS TEMAS DE CLIENTES, preparados en el servidor para `TemasPestanas` (iconos y negritas ya
 * pintados). El tema «Soluciones» lleva debajo la lista de soluciones de Admin → Soluciones.
 */

import { TEMAS_CLIENTES } from '@/lib/sitio/contenido';
import { cargarSolucionesCacheadas } from '@/app/(sitio)/soluciones/datos';
import { ICONOS, conNegritas } from './piezas';
import TemasPestanas from './TemasPestanas';
import ListaSoluciones from './ListaSoluciones';

export default async function TemasClientes({ inicial }: { inicial: string }) {
  const soluciones = await cargarSolucionesCacheadas();
  const temas = TEMAS_CLIENTES.map((t) => {
    const Icono = ICONOS[t.icono] ?? ICONOS.capas;
    const texto = t.descripcion ?? t.texto;
    return {
      id: t.id,
      titulo: t.titulo,
      descripcion: texto ? conNegritas(texto) : null,
      icono: <Icono className="h-4 w-4" />,
      iconoGrande: <Icono className="h-12 w-12" strokeWidth={1.5} />,
      contenido: t.id === 'soluciones' ? <ListaSoluciones soluciones={soluciones} /> : undefined,
    };
  });
  return <TemasPestanas temas={temas} inicial={inicial} base="/clientes" />;
}
