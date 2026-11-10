/**
 * Límites de YouTube para el título y la descripción. La publicación de una idea está en `publicar-idea.ts`
 * (desde 2026-11-10, a todas las redes del talento); aquí queda solo lo que YouTube rechaza.
 */

/** YouTube rechaza un título de más de 100 caracteres y los signos < y > en título o descripción. */
export function limpiarParaYoutube(d: { titulo: string; descripcion: string; etiquetas: string[] }) {
  const quitar = (s: string) => s.replace(/[<>]/g, '').trim();
  let suma = 0;
  const etiquetas = d.etiquetas.map(quitar).filter(Boolean).filter((e) => { suma += e.length + 2; return suma <= 480; });
  return { titulo: quitar(d.titulo).slice(0, 100), descripcion: Array.from(quitar(d.descripcion)).slice(0, 4900).join(''), etiquetas };
}
