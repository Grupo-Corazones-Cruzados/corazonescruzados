/**
 * LOS TEMAS DE CLIENTES, preparados en el servidor para `TemasPestanas` (iconos y negritas ya
 * pintados: el componente de pestañas es de cliente y no importa `piezas`).
 */

import { TEMAS_CLIENTES } from '@/lib/sitio/contenido';
import { ICONOS, conNegritas } from './piezas';
import TemasPestanas from './TemasPestanas';

export default function TemasClientes({ inicial }: { inicial: string }) {
  const temas = TEMAS_CLIENTES.map((t) => {
    const Icono = ICONOS[t.icono] ?? ICONOS.capas;
    const texto = t.descripcion ?? t.texto;
    return {
      id: t.id,
      titulo: t.titulo,
      descripcion: texto ? conNegritas(texto) : null,
      icono: <Icono className="h-4 w-4" />,
      iconoGrande: <Icono className="h-12 w-12" strokeWidth={1.5} />,
    };
  });
  return <TemasPestanas temas={temas} inicial={inicial} base="/clientes" />;
}
