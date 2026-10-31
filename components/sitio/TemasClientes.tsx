/**
 * LOS TEMAS DE CLIENTES, preparados en el servidor para `TemasPestanas` (iconos y negritas ya
 * pintados). El tema «Soluciones» lleva debajo la lista de soluciones de Admin → Soluciones.
 */

import { TEMAS_CLIENTES } from '@/lib/sitio/contenido';
import { cargarSolucionesCacheadas, resumenSolucion, cifrasDe } from '@/app/(sitio)/soluciones/datos';
import { ICONOS, conNegritas } from './piezas';
import TemasPestanas from './TemasPestanas';
import ListaSoluciones, { type FilaSolucion } from './ListaSoluciones';

// La misma que usa el buscador de la lista (que es de cliente y no se puede llamar desde aquí).
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default async function TemasClientes({ inicial }: { inicial: string }) {
  // A la lista (de cliente, por el buscador) solo viaja lo que pinta, no todo el trabajo detrás.
  const soluciones: FilaSolucion[] = (await cargarSolucionesCacheadas()).map((s) => {
    const r = resumenSolucion(s);
    return {
      id: s.id,
      slug: s.slug,
      nombre: s.nombre,
      descripciones: r.descripciones,
      talentos: s.talentos.map(({ talento, slug, icono }) => ({ talento, slug, icono })),
      cifras: cifrasDe(r).filter((c) => c.valor > 0),
      busqueda: sinTildes([s.nombre, ...r.descripciones, ...s.talentos.map((t) => t.talento),
        ...r.conceptos.map((c) => c.titulo)].join(' ')),
    };
  });
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
