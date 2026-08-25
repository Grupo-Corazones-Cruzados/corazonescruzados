/**
 * Pruebas del recargo de la pasarela (`lib/pagos/comision.ts`).
 *
 * Lo que de verdad se comprueba aquí no es que la fórmula «dé un número»: es que
 * **a GCC nunca le llegue menos de lo pactado**. Por eso la prueba clave recorre
 * importes reales y verifica el ida y vuelta — cobrar el total, quitarle la comisión
 * que la pasarela cobra de verdad, y ver que el resto cubre el neto.
 *
 *   npm run pagos:prueba
 */
import { calcularRecargo, netoRecibido, TARIFAS, centavosArriba } from '../lib/pagos/comision.ts';

let fallos = 0;
const p = (d: string, real: any, esperado: any) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? '✔' : '✖'} ${d}${ok ? '' : `\n    esperado ${JSON.stringify(esperado)}\n    fue      ${JSON.stringify(real)}`}`);
};

const kushki = TARIFAS.kushki;
const payphone = TARIFAS.payphone;

// ── El caso que Fernando vio en pantalla ────────────────────────────────────
p('etapa de 2.000 $ por Kushki', calcularRecargo(2000, kushki),
  { neto: 2000, recargo: 61.06, total: 2061.06 });

p('la misma etapa por PayPhone cuesta casi el doble de recargo',
  calcularRecargo(2000, payphone).recargo, 122.02);

// ── Lo que NO hay que hacer: sumar el porcentaje por encima ─────────────────
// 2.000 + 2,95 % = 2.059. Con ese total la pasarela cobra 60,99 y llegan 1.998,01:
// faltan casi 2 $. El gross-up existe para esto.
p('sumar el % por encima dejaría corto a GCC', netoRecibido(2059, kushki) < 2000, true);

// ── La propiedad que importa: nunca falta dinero ────────────────────────────
const importes = [1, 1.01, 7.5, 19.99, 100, 250.33, 999.99, 1500, 2000, 3333.33, 5000, 6000, 9999.99];
let cortos = 0;
let sobrantes: number[] = [];
for (const neto of importes) {
  for (const tarifa of [kushki, payphone]) {
    const r = calcularRecargo(neto, tarifa);
    const recibido = netoRecibido(r.total, tarifa);
    if (recibido < neto) cortos++;
    sobrantes.push(Math.round((recibido - neto) * 100) / 100);
  }
}
p('en 26 combinaciones, GCC nunca recibe menos de lo pactado', cortos, 0);
p('y lo que sobra nunca pasa de un centavo', Math.max(...sobrantes) <= 0.01, true);

// ── Coherencia interna ──────────────────────────────────────────────────────
const r = calcularRecargo(4000, kushki);
p('neto + recargo = total, siempre', Math.round((r.neto + r.recargo) * 100) / 100, r.total);

// ── El canal manual no lleva recargo ────────────────────────────────────────
p('sin pasarela no hay nada que trasladar', calcularRecargo(2000, TARIFAS.manual),
  { neto: 2000, recargo: 0, total: 2000 });

// ── Bordes ──────────────────────────────────────────────────────────────────
p('importe 0 no inventa un cargo fijo', calcularRecargo(0, kushki), { neto: 0, recargo: 0, total: 0 });
p('importe negativo se trata como 0', calcularRecargo(-5, kushki), { neto: 0, recargo: 0, total: 0 });
p('un importe mínimo sigue cubriendo el fijo', netoRecibido(calcularRecargo(1, kushki).total, kushki) >= 1, true);
p('una tarifa del 100 % es un error, no un infinito',
  (() => { try { calcularRecargo(100, { porcentaje: 1, fijo: 0 }); return false; } catch { return true; } })(), true);

// ── El redondeo hacia arriba no se pasa de listo ─────────────────────────────
p('20,61 ya redondeado no sube a 20,62', centavosArriba(20.61), 20.61);
p('20,610000000000003 tampoco', centavosArriba(20.610000000000003), 20.61);
p('20,601 sí sube', centavosArriba(20.601), 20.61);

console.log(fallos ? `\n❌ ${fallos} fallos` : '\n✅ todas pasan');
process.exit(fallos ? 1 : 0);
