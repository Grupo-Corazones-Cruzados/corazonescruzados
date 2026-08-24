/** Fecha a lo que entiende un <input type="datetime-local">: AAAA-MM-DDTHH:mm. */
export function aCampoFechaHora(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Fecha a AAAA-MM-DD, para <input type="date"> y para los filtros de reportes. */
export function aCampoFecha(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
