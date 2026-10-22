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

/**
 * Suma días a un AAAA-MM-DD y devuelve otro AAAA-MM-DD. Se cuenta a mediodía UTC:
 * el día es una fecha de calendario, no un instante, y así ninguna zona horaria
 * lo hace caer en el día de al lado.
 */
export function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
