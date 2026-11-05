/**
 * LOS TEMAS DE CLIENTES, preparados en el servidor para `TemasPestanas` (iconos y negritas ya
 * pintados). El tema «Soluciones» lleva debajo las soluciones publicadas (los productos,
 * `ListaProductos`; la lista de soluciones de Admin con sus talentos se quitó el 2026-11-01, Fernando:
 * «esta parte ya no va»); y el tema «Tickets» y el «Proyectos», la lista de los terminados
 * (`ListaTrabajos`).
 */

import { TEMAS_CLIENTES } from '@/lib/sitio/contenido';
import { cargarSolucionesCacheadas, cargarTicketsCacheados, cargarProyectosCacheados, cargarProductosCacheados } from '@/app/(sitio)/soluciones/datos';
import { ICONOS, conNegritas } from './piezas';
import TemasPestanas from './TemasPestanas';
import ListaTrabajos from './ListaTrabajos';
import ListaProductos from './ListaProductos';

export default async function TemasClientes({ inicial }: { inicial: string }) {
  const [tickets, proyectos, productos] = await Promise.all([
    cargarTicketsCacheados(), cargarProyectosCacheados(), cargarProductosCacheados(),
  ]);
  const soluciones = await cargarSolucionesCacheadas();
  const solucionDe = Object.fromEntries(soluciones.flatMap((s) => s.talentos.map((t) => [t.talento, s.nombre])));
  const slugDe = Object.fromEntries(soluciones.map((s) => [s.nombre, s.slug]));
  const temas = TEMAS_CLIENTES.map((t) => {
    const Icono = ICONOS[t.icono] ?? ICONOS.capas;
    const texto = t.descripcion ?? t.texto;
    return {
      id: t.id,
      titulo: t.titulo,
      descripcion: texto ? conNegritas(texto) : null,
      icono: <Icono className="h-4 w-4" />,
      iconoGrande: <Icono className="h-12 w-12" strokeWidth={1.5} />,
      contenido: t.id === 'soluciones' ? <ListaProductos productos={productos} solucionDe={solucionDe} slugDe={slugDe} />
        : t.id === 'tickets' ? <ListaTrabajos tipo="ticket" trabajos={tickets} solucionDe={solucionDe} />
        : t.id === 'proyectos' ? <ListaTrabajos tipo="proyecto" trabajos={proyectos} solucionDe={solucionDe} />
        : undefined,
    };
  });
  return <TemasPestanas temas={temas} inicial={inicial} base="/clientes" />;
}
