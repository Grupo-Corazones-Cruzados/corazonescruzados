import type { Celda } from '../tipos';

/**
 * El ancho (en % del ancho útil) de cada celda de una fila: `anchos` es por
 * COLUMNA y una celda con `span` ocupa varias (cabeceras combinadas). Si los
 * anchos no cuadran con la fila, se reparte a partes iguales. Lo usan el PDF,
 * el Word y la vista previa para que las tres tablas midan lo mismo.
 */
export function anchosDeFila(fila: Celda[], anchos?: number[]): number[] {
  const columnas = fila.reduce((a, c) => a + (c.span ?? 1), 0);
  if (!anchos || anchos.length !== columnas) return fila.map((c) => (100 * (c.span ?? 1)) / columnas);
  let i = 0;
  return fila.map((c) => {
    const n = c.span ?? 1;
    const w = anchos.slice(i, i + n).reduce((a, b) => a + b, 0);
    i += n;
    return w;
  });
}
