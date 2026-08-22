/**
 * PRUEBAS DE COLOCACIÓN del Estudio del agente.
 *
 *   node scripts/probar-estudio-layout.mjs
 *
 * Comprueba lo que a ojo se ve bien y en realidad está mal. Son las tres cosas que el
 * patrón dice que hay que medir antes de dar por buena una migración:
 *
 *  1. **Cada arista nace en el borde inferior de su origen y muere en el superior de su
 *     destino.** Es la que detecta el fallo del ancestro común: si se suma el
 *     desplazamiento equivocado, las aristas internas quedan corridas justo lo que mide su
 *     grupo, y el diagrama parece «casi bien».
 *  2. **Ningún nodo se solapa con otro**, contando el abanico de satélites.
 *  3. **Ninguna arista viene con menos de dos puntos** ni con puntos duplicados, que es lo
 *     que mete un NaN en el `path` y hace que el navegador descarte la línea entera.
 *
 * Funciona en Node porque los dos módulos de colocación solo importan TIPOS de fuera
 * (que Node borra al ejecutar TypeScript) y elkjs corre igual sin navegador.
 */

import { colocarPipeline, TAMANO } from '../components/dashboard/flows/estudio/pipeline-layout.ts';
import { altoAbanico, anchoAbanico, colocarSatelites } from '../components/dashboard/flows/estudio/satelites-layout.ts';
import { construirPipeline } from '../lib/agente/estudio/pipeline.ts';

const pipeline = construirPipeline({
  botActivo: false, modelo: 'gpt-5.6-luna', estadoCanal: 'sin_conectar', numero: null,
  tieneClaveIA: true, tieneToken: false, pendientes: [], enCola: 0, ultimoError: null,
});

const c = await colocarPipeline(pipeline);

let fallos = 0;
const comprobar = (ok, texto, detalle = '') => {
  if (!ok) fallos++;
  console.log(`${ok ? '✅' : '❌'} ${texto}${detalle && !ok ? `\n     ${detalle}` : ''}`);
};

/* ── Posiciones absolutas ─────────────────────────────────────────────────── */
const abs = new Map();
for (const n of c.nodos) {
  const g = c.grupos.find((x) => x.id === n.padre);
  const nodo = pipeline.nodos.find((x) => x.id === n.id);
  const t = TAMANO[nodo.tipo];
  abs.set(n.id, {
    x: (g?.x ?? 0) + n.x, y: (g?.y ?? 0) + n.y,
    tarjeta: t,
    cajaAncho: n.ancho, cajaAlto: n.alto,
    grupo: n.padre,
  });
}

console.log(`Pipeline: ${pipeline.nodos.length} nodos · ${pipeline.aristas.length} aristas · ${c.grupos.length} grupos`);
console.log(`Colocados: ${c.nodos.length} nodos · ${c.aristas.length} aristas\n`);

comprobar(c.nodos.length === pipeline.nodos.length, 'Se colocaron todos los nodos');
comprobar(c.aristas.length === pipeline.aristas.length,
  'Se colocaron todas las aristas', `${c.aristas.length} de ${pipeline.aristas.length}`);

/* ── 1. Las aristas nacen y mueren donde deben ───────────────────────────── */
console.log('\n── Aristas: origen y destino ──');
const TOL = 2;
for (const a of c.aristas) {
  const o = abs.get(a.desde), d = abs.get(a.hacia);
  if (!o || !d) { comprobar(false, `${a.desde} → ${a.hacia}`, 'nodo desconocido'); continue; }
  const p0 = a.puntos[0], pf = a.puntos[a.puntos.length - 1];

  const salidaX = o.x + o.tarjeta.ancho / 2;
  const salidaY = o.y + o.tarjeta.alto;
  const entradaX = d.x + d.tarjeta.ancho / 2;
  const entradaY = d.y;

  const okSalida = Math.abs(p0.x - salidaX) <= TOL && Math.abs(p0.y - salidaY) <= TOL;
  const okEntrada = Math.abs(pf.x - entradaX) <= TOL && Math.abs(pf.y - entradaY) <= TOL;

  comprobar(okSalida && okEntrada, `${a.desde} → ${a.hacia}`,
    `nace en (${Math.round(p0.x)},${Math.round(p0.y)}) y debía en (${Math.round(salidaX)},${Math.round(salidaY)}) · ` +
    `muere en (${Math.round(pf.x)},${Math.round(pf.y)}) y debía en (${Math.round(entradaX)},${Math.round(entradaY)})`);
}

/* ── 2. Puntos: mínimo dos, y sin duplicados consecutivos ─────────────────── */
console.log('\n── Aristas: puntos utilizables ──');
let malos = 0;
for (const a of c.aristas) {
  if (a.puntos.length < 2) { malos++; continue; }
  for (let i = 1; i < a.puntos.length; i++) {
    if (a.puntos[i].x === a.puntos[i - 1].x && a.puntos[i].y === a.puntos[i - 1].y) { malos++; break; }
  }
}
comprobar(malos === 0, 'Ninguna arista con menos de 2 puntos ni con duplicados consecutivos', `${malos} con problemas`);

/* ── 3. Solapamientos, contando el abanico ────────────────────────────────── */
console.log('\n── Solapamientos ──');
const cajas = [...abs.entries()].map(([id, v]) => {
  const nodo = pipeline.nodos.find((x) => x.id === id);
  return {
    id,
    x: v.x, y: v.y,
    w: v.tarjeta.ancho + anchoAbanico(nodo.satelites),
    h: Math.max(v.tarjeta.alto, altoAbanico(nodo.satelites)),
  };
});
let choques = 0;
for (let i = 0; i < cajas.length; i++) {
  for (let j = i + 1; j < cajas.length; j++) {
    const a = cajas[i], b = cajas[j];
    const solapa = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    if (solapa) { choques++; console.log(`     ⚠️ ${a.id} pisa a ${b.id}`); }
  }
}
comprobar(choques === 0, 'Ningún nodo pisa a otro (abanico incluido)', `${choques} solapamiento(s)`);

/* ── 4. El abanico se calcula igual en los dos sitios ─────────────────────── */
console.log('\n── Abanicos ──');
let abanicos = 0, malAbanico = 0;
for (const n of pipeline.nodos) {
  if (!n.satelites?.length) continue;
  abanicos++;
  const t = TAMANO[n.tipo];
  const colocados = colocarSatelites(n.satelites, t.ancho, t.alto);
  const declarado = { w: anchoAbanico(n.satelites), h: altoAbanico(n.satelites) };
  const real = {
    w: Math.max(...colocados.map((s) => s.x + s.ancho)) - t.ancho,
    h: Math.max(...colocados.map((s) => s.y + s.alto)) - Math.min(...colocados.map((s) => s.y)),
  };
  const ok = Math.abs(real.w - declarado.w) <= 1 && Math.abs(real.h - declarado.h) <= 1;
  if (!ok) { malAbanico++; console.log(`     ⚠️ ${n.id}: declarado ${declarado.w}×${declarado.h}, dibujado ${Math.round(real.w)}×${Math.round(real.h)}`); }
}
comprobar(malAbanico === 0, `El hueco declarado a ELK coincide con lo dibujado (${abanicos} abanicos)`);

console.log(`\n${fallos === 0 ? '✅ TODO CORRECTO' : `❌ ${fallos} FALLO(S)`}`);
process.exit(fallos ? 1 : 0);
