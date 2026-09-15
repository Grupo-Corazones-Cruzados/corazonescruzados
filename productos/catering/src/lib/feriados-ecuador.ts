import type { Dia } from '@/lib/fechas';

/**
 * Los feriados nacionales de Ecuador, calculados para un año. Se cargan en la
 * tabla del negocio con un botón; desde ahí el negocio los edita (decide cuáles
 * trabaja) y añade los suyos. Son un punto de partida, no la verdad: los
 * decretos mueven feriados a lunes o viernes y eso lo ajusta cada negocio.
 */

const p2 = (n: number) => String(n).padStart(2, '0');
const dia = (a: number, m: number, d: number): Dia => `${a}-${p2(m)}-${p2(d)}`;

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascua(anio: number) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const d2 = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, d2));
}

const desdePascua = (anio: number, dias: number): Dia => {
  const d = pascua(anio);
  d.setUTCDate(d.getUTCDate() + dias);
  return dia(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

export function feriadosDeEcuador(anio: number): { fecha: Dia; nombre: string }[] {
  return [
    { fecha: dia(anio, 1, 1), nombre: 'Año Nuevo' },
    { fecha: desdePascua(anio, -48), nombre: 'Carnaval (lunes)' },
    { fecha: desdePascua(anio, -47), nombre: 'Carnaval (martes)' },
    { fecha: desdePascua(anio, -2), nombre: 'Viernes Santo' },
    { fecha: dia(anio, 5, 1), nombre: 'Día del Trabajo' },
    { fecha: dia(anio, 5, 24), nombre: 'Batalla de Pichincha' },
    { fecha: dia(anio, 8, 10), nombre: 'Primer Grito de Independencia' },
    { fecha: dia(anio, 10, 9), nombre: 'Independencia de Guayaquil' },
    { fecha: dia(anio, 11, 2), nombre: 'Día de los Difuntos' },
    { fecha: dia(anio, 11, 3), nombre: 'Independencia de Cuenca' },
    { fecha: dia(anio, 12, 25), nombre: 'Navidad' },
  ];
}
