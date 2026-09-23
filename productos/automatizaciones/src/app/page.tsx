import { redirect } from 'next/navigation';

/**
 * La raíz no es de nadie: cada cliente vive en `/<su-codigo>`. Se manda al área del
 * equipo, que es la única pantalla del producto que no pertenece a un inquilino.
 */
export default function Raiz() {
  redirect('/gcc');
}
