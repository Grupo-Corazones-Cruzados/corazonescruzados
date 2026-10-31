/**
 * `/clientes/soluciones/<slug>` YA NO ES UNA PÁGINA (Fernando, 2026-10-31: «quita que al seleccionar
 * la solución se vaya a otra pantalla; al seleccionar el talento te lleve a la página enfocada en
 * ese talento»). Se elige el talento en la lista; esta dirección, que pudo llegar a compartirse,
 * lleva a la lista en vez de dar 404. La del talento sigue colgando de aquí: `<slug>/<talento>`.
 */

import { permanentRedirect } from 'next/navigation';

export default function SolucionPage() {
  permanentRedirect('/clientes/soluciones');
}
