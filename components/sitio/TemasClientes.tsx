/**
 * LOS TEMAS DE CLIENTES, preparados en el servidor para `RecorridoPagina` (iconos y negritas ya
 * pintados). El tema «Soluciones» lleva debajo las soluciones publicadas (los productos,
 * `ListaProductos`; la lista de soluciones de Admin con sus talentos se quitó el 2026-11-01, Fernando:
 * «esta parte ya no va»); y el tema «Tickets» y el «Proyectos», la lista de los terminados
 * (`ListaTrabajos`).
 */

import { TEMAS_CLIENTES } from '@/lib/sitio/contenido';
import { cargarSolucionesCacheadas, cargarTicketsCacheados, cargarProyectosCacheados, cargarProductosCacheados } from '@/app/(sitio)/soluciones/datos';
import { ICONOS, conNegritas } from './piezas';
import RecorridoPagina from './RecorridoPagina';
import { AltaClienteEnPagina } from './VentanaCliente';
import { UserPlus } from 'lucide-react';
import ListaTrabajos from './ListaTrabajos';
import ListaProductos from './ListaProductos';

export default async function TemasClientes({ inicial }: { inicial: string }) {
  const [tickets, proyectos, productos] = await Promise.all([
    cargarTicketsCacheados(), cargarProyectosCacheados(), cargarProductosCacheados(),
  ]);
  const soluciones = await cargarSolucionesCacheadas();
  const solucionDe = Object.fromEntries(soluciones.flatMap((s) => s.talentos.map((t) => [t.talento, s.nombre])));
  const slugDe = Object.fromEntries(soluciones.map((s) => [s.nombre, s.slug]));
  // Desde 2026-11-11, el mismo recorrido que Candidatos (Fernando): cada tema con su texto en la
  // tarjeta y su lista debajo, y al final el alta de la cuenta de cliente.
  const pasos = TEMAS_CLIENTES.map((t) => {
    const Icono = ICONOS[t.icono] ?? ICONOS.capas;
    const texto = t.descripcion ?? t.texto;
    const lista = t.id === 'soluciones' ? <ListaProductos productos={productos} solucionDe={solucionDe} slugDe={slugDe} />
      : t.id === 'tickets' ? <ListaTrabajos tipo="ticket" trabajos={tickets} solucionDe={solucionDe} />
      : t.id === 'proyectos' ? <ListaTrabajos tipo="proyecto" trabajos={proyectos} solucionDe={solucionDe} />
      : null;
    return {
      id: t.id,
      title: t.titulo,
      icono: <Icono className="h-4 w-4" />,
      contenido: (
        <>
          {texto && <div className="paso-candidato"><p className="paso-cliente-texto">{conNegritas(texto)}</p></div>}
          {lista && <div className="tema-contenido">{lista}</div>}
        </>
      ),
    };
  });
  pasos.push({
    id: PASO_ALTA_CLIENTE,
    title: 'Crear cuenta',
    icono: <UserPlus className="h-4 w-4" />,
    contenido: <div className="paso-candidato"><AltaClienteEnPagina /></div>,
  });
  return <RecorridoPagina pasos={pasos} inicial={inicial} base="/clientes" etiqueta="Temas de Clientes" />;
}

/** El último paso de `/clientes`: el alta de la cuenta, con su propia URL. */
export const PASO_ALTA_CLIENTE = 'crear-cuenta';
