'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Upload, Play, Pause, Save, Trash2, ChevronLeft, ChevronRight, X, Pipette, ZoomIn, ZoomOut, Lock, Loader2,
  Eraser, Film, ClipboardPaste,
} from 'lucide-react';
import { EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelConfirm from '@/components/ui/PixelConfirm';
import Interruptor from '@/components/ui/Interruptor';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_ICONO_FILA } from '@/components/ui/Button';
import { rutaAcceso } from '@/components/espacio/api';

/**
 * ⇒ CORTADOR DE SPRITES (Herramientas → Edición; Fernando, 2026-11-08).
 *
 * Fernando genera las poses en su chat de Gemini y aquí las convierte en animaciones del juego:
 *  1. sube la imagen y ajusta la REJILLA viéndola encima (columnas, filas, margen y separación);
 *  2. toca los cuadros en el orden en que deben animarse;
 *  3. cada cuadro se LIMPIA solo: se quita el fondo, se reduce al píxel real (Gemini entrega la
 *     imagen ampliada) y se coloca en la celda del juego con los pies en la línea del suelo;
 *  4. agrupa los cuadros como una animación (tipo + dirección), la ve en movimiento y la guarda.
 * Lo guardado va a `godot/assets/personajes/<personaje>/` (ver `lib/herramientas/sprites.ts`).
 *
 * La imagen no sale del navegador: al servidor solo llega la tira ya cortada.
 */

const mf = { fontFamily: 'var(--font-body)' } as const;
const API = '/api/herramientas/sprites';

/** La celda del juego (Videojuego.md §4-ter): 96×128, pies en la fila 119, eje en x = 48. */
const CELDA = { ancho: 96, alto: 128 };
const MARGEN_PIES = 8;

const TIPOS = [
  { value: 'quieto', label: 'Quieto' },
  { value: 'caminar', label: 'Caminar' },
  { value: 'correr', label: 'Correr' },
  { value: 'atacar', label: 'Atacar' },
  { value: 'atacar_2', label: 'Atacar (segundo golpe)' },
  { value: 'cubrirse', label: 'Cubrirse' },
  { value: 'esquivar', label: 'Esquivar' },
  { value: 'saltar', label: 'Saltar' },
  { value: 'recibir_dano', label: 'Recibir daño' },
  { value: 'morir', label: 'Morir' },
  { value: 'hablar', label: 'Hablar' },
  { value: 'especial', label: 'Especial' },
  { value: 'otra', label: 'Otra…' },
];
const DIRECCIONES = [
  { value: 'abajo', label: 'Frente (abajo)' },
  { value: 'arriba', label: 'Espalda (arriba)' },
  { value: 'izquierda', label: 'Izquierda' },
  { value: 'derecha', label: 'Derecha' },
  { value: 'ninguna', label: 'Sin dirección' },
];
/** Lo que no se repite al terminar: un golpe o morir se ven una vez. */
const SIN_BUCLE = new Set(['atacar', 'atacar_2', 'saltar', 'recibir_dano', 'morir', 'esquivar', 'especial']);

type Rejilla = { columnas: number; filas: number; margenX: number; margenY: number; sepX: number; sepY: number };
/** `pies`: cada cuadro con sus pies en el suelo. `conservar`: el borde de abajo del recorte es el suelo, así
 *  un salto o una caída mantienen su altura. En los dos, el eje horizontal es el centro de lo dibujado. */
type Colocacion = 'pies' | 'conservar';
type Limpieza = { quitarFondo: boolean; fondo: [number, number, number]; tolerancia: number; escala: number; colocacion: Colocacion; quitarRestos: boolean; ajusteX: number; ajusteY: number };
type Rect = { x: number; y: number; w: number; h: number };
type Modo = 'franja' | 'rejilla';
/** Lo que se está arrastrando sobre la imagen en el modo franja. */
type Arrastre =
  | { tipo: 'corte'; i: number; movido: boolean }
  | { tipo: 'borde'; lado: 'izq' | 'der' | 'arr' | 'aba' }
  | { tipo: 'nueva'; x0: number; y0: number; movido: boolean }
  | { tipo: 'anadir'; x: number; movido: boolean };
type Animacion = { archivo: string; fotogramas: number; ancho: number; alto: number; fps: number; bucle: boolean; guardada: string };
type Ficha = { personaje: string; animaciones: Record<string, Animacion> };
/** `caja`: lo dibujado, ya colocado en la celda (para saber si se sale al moverlo a mano). */
type Cuadro = { canvas: HTMLCanvasElement; desborda: boolean; vacio: boolean; caja: { x0: number; y0: number; x1: number; y1: number } | null };
type Puerta = 'cargando' | 'web' | 'clave' | 'dentro';

const nombreSeguro = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);

/** El rectángulo de la celda `i` en la imagen original (en píxeles de la imagen, con decimales). */
function celda(i: number, r: Rejilla, w: number, h: number) {
  const cw = (w - 2 * r.margenX - (r.columnas - 1) * r.sepX) / r.columnas;
  const ch = (h - 2 * r.margenY - (r.filas - 1) * r.sepY) / r.filas;
  const col = i % r.columnas;
  const fila = Math.floor(i / r.columnas);
  return { x: r.margenX + col * (cw + r.sepX), y: r.margenY + fila * (ch + r.sepY), w: cw, h: ch };
}

/** ¿Este píxel es dibujo (no fondo)? Con el mismo color y tolerancia que la limpieza. */
function mascara(datos: ImageData, l: Limpieza): Uint8Array {
  const { data: d, width: w, height: h } = datos;
  const m = new Uint8Array(w * h);
  const [fr, fg, fb] = l.fondo;
  const tol = Math.max(l.tolerancia, 8) * 3;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    m[i] = d[p + 3] >= 128 && Math.abs(d[p] - fr) + Math.abs(d[p + 1] - fg) + Math.abs(d[p + 2] - fb) > tol ? 1 : 0;
  }
  return m;
}

/** La fila de dibujos que hay a la altura `y`: de su primera a su última línea con dibujo, y de lado a lado. */
function detectarFila(m: Uint8Array, w: number, h: number, y: number): Rect | null {
  const conDibujo = (fila: number) => { let n = 0; for (let x = 0; x < w; x++) n += m[fila * w + x]; return n >= 2; };
  let cy = Math.max(0, Math.min(h - 1, Math.round(y)));
  // Si se tocó el hueco entre filas, la más cercana (hasta 24 px).
  if (!conDibujo(cy)) {
    let hallada = -1;
    for (let d = 1; d <= 24 && hallada < 0; d++) {
      if (cy - d >= 0 && conDibujo(cy - d)) hallada = cy - d;
      else if (cy + d < h && conDibujo(cy + d)) hallada = cy + d;
    }
    if (hallada < 0) return null;
    cy = hallada;
  }
  let y0 = cy, y1 = cy;
  while (y0 > 0 && conDibujo(y0 - 1)) y0--;
  while (y1 < h - 1 && conDibujo(y1 + 1)) y1++;
  // Dos filas pegadas (un salto que se mete entre los pies de la fila de arriba) salen como una sola el
  // doble de alta que las demás: se parte por la línea con menos dibujo, y se queda la parte tocada.
  const corridas: number[] = [];
  for (let fy = 0; fy < h;) {
    if (!conDibujo(fy)) { fy++; continue; }
    const ini = fy;
    while (fy < h && conDibujo(fy)) fy++;
    if (fy - ini > 8) corridas.push(fy - ini);
  }
  const mediana = corridas.length ? [...corridas].sort((a, b) => a - b)[Math.floor(corridas.length / 2)] : 0;
  for (let vuelta = 0; vuelta < 4 && mediana && y1 - y0 + 1 > mediana * 1.6; vuelta++) {
    const desde = y0 + Math.round((y1 - y0) * 0.3), hasta = y1 - Math.round((y1 - y0) * 0.3);
    let menor = Infinity, linea = -1;
    for (let fy = desde; fy <= hasta; fy++) {
      let n = 0; for (let x = 0; x < w; x++) n += m[fy * w + x];
      if (n < menor) { menor = n; linea = fy; }
    }
    if (linea < 0) break;
    if (cy < linea) y1 = linea - 1; else y0 = linea + 1;
  }
  let x0 = w, x1 = -1;
  for (let fy = y0; fy <= y1; fy++) for (let x = 0; x < w; x++) if (m[fy * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  if (x1 < 0) return null;
  // Un píxel de aire a los lados y arriba; abajo no: el borde de abajo es el suelo de la fila.
  const ax = Math.max(0, x0 - 1), ay = Math.max(0, y0 - 1);
  return { x: ax, y: ay, w: Math.min(w, x1 + 2) - ax, h: y1 + 1 - ay };
}

/** Cortes donde, dentro de la franja, hay una columna sin dibujo: uno en el centro de cada hueco. */
function detectarCortes(m: Uint8Array, w: number, b: Rect): number[] {
  // Entre las letras de un rótulo también hay huecos: solo se corta en los anchos.
  const minimo = Math.max(4, Math.round(b.h * 0.06));
  const x0 = Math.round(b.x), x1 = Math.round(b.x + b.w), y0 = Math.round(b.y), y1 = Math.round(b.y + b.h);
  const vacia: boolean[] = [];
  for (let x = x0; x < x1; x++) { let n = 0; for (let y = y0; y < y1; y++) n += m[y * w + x]; vacia.push(n < 2); }
  const cortes: number[] = [];
  let i = 0;
  while (i < vacia.length && vacia[i]) i++;
  while (i < vacia.length) {
    if (!vacia[i]) { i++; continue; }
    const ini = i;
    while (i < vacia.length && vacia[i]) i++;
    if (i < vacia.length && i - ini >= minimo) cortes.push(x0 + Math.round((ini + i) / 2));
  }
  return cortes;
}

/**
 * Restos de las filas vecinas: piezas sueltas que entran por un borde del recorte (los pies de la fila
 * de arriba, la mano de la pose de al lado) y son mucho más pequeñas que la figura. Lo que no toca el
 * borde se respeta aunque sea pequeño: una corona que se cae es parte de la animación.
 */
function quitarRestos(d: Uint8ClampedArray, w: number, h: number) {
  const etiqueta = new Int32Array(w * h).fill(-1);
  const tamanos: number[] = [];
  const tocaBorde: boolean[] = [];
  const pila: number[] = [];
  for (let inicio = 0; inicio < w * h; inicio++) {
    if (etiqueta[inicio] >= 0 || d[inicio * 4 + 3] < 128) continue;
    const id = tamanos.length;
    let n = 0, borde = false;
    etiqueta[inicio] = id; pila.push(inicio);
    while (pila.length) {
      const i = pila.pop()!;
      n++;
      const x = i % w, y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) borde = true;
      for (const v of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (v >= 0 && etiqueta[v] < 0 && d[v * 4 + 3] >= 128) { etiqueta[v] = id; pila.push(v); }
      }
    }
    tamanos.push(n); tocaBorde.push(borde);
  }
  if (tamanos.length < 2) return;
  const mayor = Math.max(...tamanos);
  for (let i = 0; i < w * h; i++) {
    const id = etiqueta[i];
    if (id >= 0 && tocaBorde[id] && tamanos[id] < mayor * 0.25) d[i * 4 + 3] = 0;
  }
}

/** Alto de lo dibujado dentro de un trozo: una pose ocupa casi toda la franja; un rótulo, poco. */
function altoDibujo(m: Uint8Array, w: number, t: Rect): number {
  let y0 = Infinity, y1 = -1;
  for (let y = Math.round(t.y); y < Math.round(t.y + t.h); y++) {
    for (let x = Math.round(t.x); x < Math.round(t.x + t.w); x++) if (m[y * w + x]) { if (y < y0) y0 = y; y1 = y; break; }
  }
  return y1 < 0 ? 0 : y1 - y0 + 1;
}

/** Los trozos de una franja entre sus cortes, de izquierda a derecha. */
function trozos(b: Rect, cortes: number[]): Rect[] {
  const bordes = [b.x, ...cortes, b.x + b.w];
  return bordes.slice(0, -1).map((x, i) => ({ x, y: b.y, w: bordes[i + 1] - x, h: b.h }));
}

/**
 * Un cuadro de la imagen → una celda del juego.
 * La reducción no promedia: cada bloque de `escala × escala` se queda con su color MÁS REPETIDO (o
 * transparente si la mayoría lo es). Promediar inventaría colores intermedios en los bordes, que es
 * justo lo que ensucia el pixel art que sale de la IA.
 */
function procesar(img: HTMLImageElement, r: Rect, l: Limpieza): Cuadro {
  const sx = Math.round(r.x), sy = Math.round(r.y);
  const sw = Math.max(1, Math.round(r.w)), sh = Math.max(1, Math.round(r.h));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const d = ctx.getImageData(0, 0, sw, sh).data;

  if (l.quitarFondo) {
    const [fr, fg, fb] = l.fondo;
    const tol = l.tolerancia * 3;
    for (let p = 0; p < d.length; p += 4) {
      if (Math.abs(d[p] - fr) + Math.abs(d[p + 1] - fg) + Math.abs(d[p + 2] - fb) <= tol) d[p + 3] = 0;
    }
  }

  if (l.quitarRestos) quitarRestos(d, sw, sh);

  const k = Math.max(1, Math.round(l.escala));
  const w2 = Math.max(1, Math.floor(sw / k)), h2 = Math.max(1, Math.floor(sh / k));
  const red = new Uint8ClampedArray(w2 * h2 * 4);
  const cuentas = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let by = 0; by < h2; by++) {
    for (let bx = 0; bx < w2; bx++) {
      cuentas.clear();
      let transparentes = 0, total = 0;
      for (let y = by * k; y < by * k + k; y++) {
        for (let x = bx * k; x < bx * k + k; x++) {
          const p = (y * sw + x) * 4;
          total++;
          if (d[p + 3] < 128) { transparentes++; continue; }
          const clave = ((d[p] >> 3) << 10) | ((d[p + 1] >> 3) << 5) | (d[p + 2] >> 3);
          const e = cuentas.get(clave);
          if (e) { e.n++; e.r += d[p]; e.g += d[p + 1]; e.b += d[p + 2]; }
          else cuentas.set(clave, { n: 1, r: d[p], g: d[p + 1], b: d[p + 2] });
        }
      }
      const o = (by * w2 + bx) * 4;
      if (transparentes * 2 > total) continue;
      let mejor: { n: number; r: number; g: number; b: number } | null = null;
      for (const e of cuentas.values()) if (!mejor || e.n > mejor.n) mejor = e;
      if (!mejor) continue;
      red[o] = Math.round(mejor.r / mejor.n);
      red[o + 1] = Math.round(mejor.g / mejor.n);
      red[o + 2] = Math.round(mejor.b / mejor.n);
      red[o + 3] = 255;
    }
  }

  // Caja de lo dibujado: de ella salen los pies (su fila más baja) y el eje (su centro).
  let x0 = w2, y0 = h2, x1 = -1, y1 = -1;
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    if (red[(y * w2 + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const salida = document.createElement('canvas');
  salida.width = CELDA.ancho; salida.height = CELDA.alto;
  const vacio = x1 < 0;
  if (vacio) return { canvas: salida, desborda: false, vacio, caja: null };
  const dx = Math.round(CELDA.ancho / 2 - (x0 + x1 + 1) / 2) + l.ajusteX;
  const dy = (l.colocacion === 'pies' ? CELDA.alto - MARGEN_PIES - 1 - y1 : CELDA.alto - MARGEN_PIES - h2) + l.ajusteY;
  const tmp = document.createElement('canvas');
  tmp.width = w2; tmp.height = h2;
  tmp.getContext('2d')!.putImageData(new ImageData(red, w2, h2), 0, 0);
  salida.getContext('2d')!.drawImage(tmp, dx, dy);
  const desborda = x0 + dx < 0 || y0 + dy < 0 || x1 + dx >= CELDA.ancho || y1 + dy >= CELDA.alto;
  return { canvas: salida, desborda, vacio, caja: { x0: x0 + dx, y0: y0 + dy, x1: x1 + dx, y1: y1 + dy } };
}

/** Las guías de la plantilla de Procreate (godot/plantillas): mismas líneas, mismos colores. */
const GUIA_CABEZA = 24;
const GUIA_OJOS = 44;

/**
 * Una celda del juego a tamaño grande, con el suelo y las guías: lo que se ve al animar. Con `fijo`
 * se queda en ese fotograma y, si hay `onArrastre`, el personaje se mueve con el dedo o el ratón
 * (en píxeles del juego); `fantasma` es el fotograma anterior, en transparencia, para alinearlo.
 */
function Escenario({ cuadros, fps, reproducir, guias, escala = 3, fijo = null, fantasma = null, onArrastre }: {
  cuadros: HTMLCanvasElement[]; fps: number; reproducir: boolean; guias: boolean; escala?: number;
  fijo?: number | null; fantasma?: HTMLCanvasElement | null; onArrastre?: (dx: number, dy: number, fin: boolean) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [i, setI] = useState(0);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { setI(0); }, [cuadros.length]);
  useEffect(() => {
    if (fijo !== null || !reproducir || cuadros.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % cuadros.length), 1000 / Math.max(1, fps));
    return () => window.clearInterval(id);
  }, [reproducir, fps, cuadros.length, fijo]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    // Sombra bajo los pies, como la tendrá en el juego.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(CELDA.ancho / 2, CELDA.alto - MARGEN_PIES, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (guias) {
      ctx.fillStyle = 'rgba(80,180,255,0.6)';
      ctx.fillRect(0, GUIA_CABEZA, CELDA.ancho, 1);
      ctx.fillStyle = 'rgba(200,120,255,0.6)';
      ctx.fillRect(0, GUIA_OJOS, CELDA.ancho, 1);
      ctx.fillStyle = 'rgba(239,68,68,0.7)';
      ctx.fillRect(0, CELDA.alto - MARGEN_PIES, CELDA.ancho, 1);
      ctx.fillStyle = 'rgba(148,163,184,0.5)';
      ctx.fillRect(CELDA.ancho / 2, 0, 1, CELDA.alto);
    }
    if (fantasma) { ctx.globalAlpha = 0.3; ctx.drawImage(fantasma, 0, 0); ctx.globalAlpha = 1; }
    const f = cuadros[fijo ?? i % Math.max(1, cuadros.length)];
    if (f) ctx.drawImage(f, 0, 0);
  }, [i, cuadros, guias, fijo, fantasma]);
  const k = (e: React.PointerEvent<HTMLCanvasElement>) => e.currentTarget.getBoundingClientRect().width / CELDA.ancho;
  const arrastrable = fijo !== null && !!onArrastre;
  return (
    <canvas ref={ref} width={CELDA.ancho} height={CELDA.alto}
      className={`block rounded-md border bg-digi-darker ${arrastrable ? 'border-accent cursor-move' : 'border-digi-border'}`}
      style={{ width: CELDA.ancho * escala, height: CELDA.alto * escala, imageRendering: 'pixelated', ...(arrastrable ? { touchAction: 'none' as const } : {}) }}
      onPointerDown={arrastrable ? (e) => { e.currentTarget.setPointerCapture(e.pointerId); inicio.current = { x: e.clientX, y: e.clientY }; } : undefined}
      onPointerMove={arrastrable ? (e) => { const o = inicio.current; if (o) onArrastre!(Math.round((e.clientX - o.x) / k(e)), Math.round((e.clientY - o.y) / k(e)), false); } : undefined}
      onPointerUp={arrastrable ? (e) => { const o = inicio.current; inicio.current = null; if (o) onArrastre!(Math.round((e.clientX - o.x) / k(e)), Math.round((e.clientY - o.y) / k(e)), true); } : undefined} />
  );
}

/** Una animación ya guardada: su tira se corta igual que la verá Godot. */
function AnimacionGuardada({ personaje, nombre, a, onBorrar }: { personaje: string; nombre: string; a: Animacion; onBorrar: () => void }) {
  const [cuadros, setCuadros] = useState<HTMLCanvasElement[]>([]);
  useEffect(() => {
    // Por `fetch` y no con un <img src>: dentro del marco de las apps la sesión va en una cabecera
    // (`firmarPeticionesDeLaPagina`) y una imagen no la lleva.
    let url = '';
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      if (!vivo) return;
      const lista: HTMLCanvasElement[] = [];
      for (let f = 0; f < a.fotogramas; f++) {
        const c = document.createElement('canvas');
        c.width = a.ancho; c.height = a.alto;
        c.getContext('2d')!.drawImage(img, f * a.ancho, 0, a.ancho, a.alto, 0, 0, a.ancho, a.alto);
        lista.push(c);
      }
      setCuadros(lista);
    };
    fetch(`${API}/imagen?personaje=${encodeURIComponent(personaje)}&archivo=${encodeURIComponent(a.archivo)}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('sin imagen'))))
      .then((b) => { if (!vivo) return; url = URL.createObjectURL(b); img.src = url; })
      .catch(() => { /* la fila se queda sin vista previa; el nombre y los datos siguen */ });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
    // Por sus valores, no por el objeto: cada vez que se vuelve a pedir la ficha llega un objeto nuevo
    // con lo mismo, y la imagen se volvía a descargar sin llegar a pintarse.
  }, [personaje, a.archivo, a.guardada, a.fotogramas, a.ancho, a.alto]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <li className="flex items-center gap-3 py-2 border-b border-digi-border last:border-b-0">
      <Escenario cuadros={cuadros} fps={a.fps} reproducir guias={false} escala={0.75} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-digi-text truncate" style={mf} title={nombre}>{nombre}</p>
        <p className="text-[11px] text-digi-muted tabular-nums" style={mf}>
          {a.fotogramas} {a.fotogramas === 1 ? 'fotograma' : 'fotogramas'} · {a.fps} fps{a.bucle ? ' · en bucle' : ''}
        </p>
      </div>
      <button type="button" onClick={onBorrar} className={`${BTN_ICONO_FILA} hover:!text-red-500`} title={`Borrar «${nombre}»`} aria-label={`Borrar «${nombre}»`}>
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

const Numero = ({ label, valor, onChange, min = 0, max = 4096 }: { label: string; valor: number; onChange: (n: number) => void; min?: number; max?: number }) => (
  <EditField label={label}>
    <input type="number" inputMode="numeric" className={`${EDIT_INPUT} tabular-nums`} value={valor} min={min} max={max}
      onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))); }} />
  </EditField>
);

export default function CortadorSprites() {
  const [puerta, setPuerta] = useState<Puerta>('cargando');
  useEffect(() => {
    fetch('/api/espacio-trabajo/estado')
      .then(async (r) => {
        if (!r.ok) { setPuerta('web'); return; }
        const j = await r.json();
        setPuerta(j.autenticado ? 'dentro' : 'clave');
      })
      .catch(() => setPuerta('web'));
  }, []);
  if (puerta === 'dentro') return <Cortador />;
  if (puerta === 'cargando') return <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>;
  const ruta = typeof window === 'undefined' ? '' : window.location.pathname;
  return (
    <div className="bg-digi-card border border-digi-border rounded-xl py-16 px-6 flex flex-col items-center text-center gap-3">
      <Lock className="w-6 h-6 text-digi-muted" />
      <p className="text-[14px] font-medium text-digi-text" style={mf}>
        {puerta === 'web' ? 'El cortador de sprites solo funciona en tu Mac' : 'Hace falta la contraseña del Espacio de trabajo'}
      </p>
      {puerta === 'web' && <a className={BTN_PRIMARY} href={`http://localhost:3792${ruta}`}>Abrir en la Mac</a>}
      {puerta === 'clave' && <a className={BTN_PRIMARY} href={rutaAcceso(ruta)}>Escribir la contraseña</a>}
    </div>
  );
}

export function Cortador() {
  const [personajes, setPersonajes] = useState<string[]>([]);
  const [personaje, setPersonaje] = useState('');
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [nombreImagen, setNombreImagen] = useState('');
  const [rejilla, setRejilla] = useState<Rejilla>({ columnas: 4, filas: 1, margenX: 0, margenY: 0, sepX: 0, sepY: 0 });
  const [limpieza, setLimpieza] = useState<Limpieza>({ quitarFondo: true, fondo: [255, 255, 255], tolerancia: 24, escala: 1, colocacion: 'pies', quitarRestos: true, ajusteX: 0, ajusteY: 0 });
  // Modo franja (Fernando, 2026-11-09): hojas irregulares, con filas de distinto número de poses y
  // separaciones desiguales. Se elige una fila y se reparte con cortes que se arrastran.
  const [modo, setModo] = useState<Modo>('franja');
  const [banda, setBanda] = useState<Rect | null>(null);
  const [cortes, setCortes] = useState<number[]>([]);
  const [borrador, setBorrador] = useState<Rect | null>(null);
  const [cursor, setCursor] = useState('crosshair');
  const arrastre = useRef<Arrastre | null>(null);
  // Colocación a mano de cada fotograma (Fernando, 2026-11-09): un desplazamiento en píxeles del juego,
  // por cuadro de origen, que se suma a la colocación automática. `activo` es el que se está moviendo.
  const [ajustes, setAjustes] = useState<Record<number, { x: number; y: number }>>({});
  const [activo, setActivo] = useState<number | null>(null);
  const base = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const arrastrando = useRef(false);
  const datosImg = useRef<ImageData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [gotero, setGotero] = useState(false);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [tipo, setTipo] = useState('caminar');
  const [tipoLibre, setTipoLibre] = useState('');
  const [direccion, setDireccion] = useState('abajo');
  const [fps, setFps] = useState(8);
  const [bucle, setBucle] = useState(true);
  const [reproducir, setReproducir] = useState(true);
  const [guias, setGuias] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState<null | { titulo: string; mensaje: string; accion: () => void; peligro?: boolean; boton: string }>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const visor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const personajeId = nombreSeguro(personaje);
  const nombreAnimacion = nombreSeguro(tipo === 'otra' ? tipoLibre : tipo) + (direccion !== 'ninguna' ? `_${direccion}` : '');

  useEffect(() => {
    fetch(API).then((r) => r.json()).then((j) => setPersonajes(j.data || [])).catch(() => {});
  }, []);
  // Se pide al escribir el nombre: una respuesta vieja (de «prueba_cortado») no puede pisar a la nueva,
  // y mientras llega no se dice «no tiene animaciones», que haría pasar una carga por un vacío.
  const [errorFicha, setErrorFicha] = useState('');
  useEffect(() => {
    setFicha(null); setErrorFicha('');
    if (!personajeId) return;
    const corte = new AbortController();
    const id = window.setTimeout(() => {
      fetch(`${API}?personaje=${encodeURIComponent(personajeId)}`, { signal: corte.signal })
        .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'No se pudieron leer sus animaciones'); setFicha(j.data); })
        .catch((e) => { if (e.name !== 'AbortError') setErrorFicha(e.message); });
    }, 250);
    return () => { window.clearTimeout(id); corte.abort(); };
  }, [personajeId]);

  // Lo que no se repite (un golpe, morir) se propone sin bucle; Fernando puede cambiarlo.
  useEffect(() => { setBucle(!SIN_BUCLE.has(tipo)); }, [tipo]);

  const total = rejilla.columnas * rejilla.filas;
  const celdaOrigen = img ? celda(0, rejilla, img.naturalWidth, img.naturalHeight) : null;

  /** Al subir: la rejilla parte de una fila y el fondo se toma de la esquina. */
  const abrirImagen = (archivo: File) => {
    const url = URL.createObjectURL(archivo);
    const i = new Image();
    i.onload = () => {
      setImg(i);
      setNombreImagen(archivo.name && archivo.name !== 'image.png' ? archivo.name : 'Imagen pegada');
      setSeleccion([]);
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(i, 0, 0, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      const todo = document.createElement('canvas');
      todo.width = i.naturalWidth; todo.height = i.naturalHeight;
      const tctx = todo.getContext('2d', { willReadFrequently: true })!;
      tctx.drawImage(i, 0, 0);
      datosImg.current = tctx.getImageData(0, 0, i.naturalWidth, i.naturalHeight);
      setBanda(null); setCortes([]); setAjustes({}); setActivo(null);
      escalaPropuesta.current = false;
      // En rejilla, la escala propuesta es que el alto de una celda quepa en los 128 px del juego; en
      // franja se propone al elegir la fila, que es cuando se sabe cuánto mide.
      const altoCelda = i.naturalHeight / rejilla.filas;
      setLimpieza((l) => ({ ...l, fondo: [r, g, b], escala: modo === 'rejilla' ? Math.max(1, Math.round(altoCelda / CELDA.alto)) : 1 }));
      // Que la imagen entre entera a lo ancho en la columna central (sin el relleno de 16 px por lado).
      const ancho = (visor.current?.clientWidth ?? 900) - 32;
      setZoom(Math.min(1, ancho / i.naturalWidth));
    };
    i.src = url;
  };

  // Pegar con ⌘V o Ctrl+V (Fernando, 2026-11-09): si el portapapeles trae una imagen, se abre como si se subiera.
  // Un texto pegado en un campo sigue su camino normal: solo se intercepta cuando hay imagen.
  const abrirRef = useRef(abrirImagen);
  abrirRef.current = abrirImagen;
  useEffect(() => {
    const alPegar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((it) => it.kind === 'file' && it.type.startsWith('image/'));
      const archivo = item?.getAsFile();
      if (!archivo) return;
      e.preventDefault();
      abrirRef.current(archivo);
    };
    window.addEventListener('paste', alPegar);
    return () => window.removeEventListener('paste', alPegar);
  }, []);
  /** En el teléfono no hay teclas: el botón «Pegar» lee la imagen copiada (el sistema pide permiso). */
  const pegarDelPortapapeles = async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error('Este navegador no deja leer el portapapeles: usa «Subir imagen».');
      for (const item of await navigator.clipboard.read()) {
        const tipo = item.types.find((t) => t.startsWith('image/'));
        if (tipo) { const b = await item.getType(tipo); abrirImagen(new File([b], 'Imagen pegada', { type: tipo })); return; }
      }
      toast.error('No hay ninguna imagen copiada');
    } catch (e: any) {
      toast.error(e?.name === 'NotAllowedError' ? 'No se dio permiso para leer el portapapeles' : e?.message || 'No se pudo pegar');
    }
  };

  // Rejilla dibujada sobre la imagen, con los cuadros elegidos numerados en su orden.
  useEffect(() => {
    const c = lienzo.current;
    if (!c || !img) return;
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    const grosor = Math.max(1, Math.round(1 / zoom));
    ctx.lineWidth = grosor;
    const numero = (texto: string, x: number, y: number) => {
      const t = Math.max(12, Math.round(16 / zoom));
      ctx.fillStyle = 'rgba(124,58,237,0.95)';
      ctx.fillRect(x, y, t * (texto.length > 1 ? 1.9 : 1.4), t * 1.3);
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${t}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(texto, x + t * 0.3, y + t * 0.15);
    };
    if (modo === 'franja') {
      const W = img.naturalWidth, H = img.naturalHeight;
      const b = borrador ?? banda;
      if (b) {
        // Lo de fuera, apagado: la franja es lo que cuenta.
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, b.y);
        ctx.fillRect(0, b.y + b.h, W, H - b.y - b.h);
        ctx.fillRect(0, b.y, b.x, b.h);
        ctx.fillRect(b.x + b.w, b.y, W - b.x - b.w, b.h);
        ctx.strokeStyle = 'rgba(124,58,237,0.95)';
        ctx.lineWidth = grosor * 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
      if (banda && !borrador) {
        const lista = trozos(banda, cortes);
        lista.forEach((t, i) => {
          const orden = seleccion.indexOf(i);
          if (orden < 0) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(t.x, t.y, t.w, t.h); }
          else numero(String(orden + 1), t.x + grosor * 2, t.y + grosor * 2);
        });
        const asa = Math.max(6, Math.round(10 / zoom));
        cortes.forEach((x) => {
          ctx.fillStyle = 'rgba(239,68,68,0.95)';
          ctx.fillRect(x - grosor, banda.y - asa, grosor * 2, banda.h + asa * 2);
          ctx.fillRect(x - asa / 2, banda.y - asa, asa, asa);
          ctx.fillRect(x - asa / 2, banda.y + banda.h, asa, asa);
        });
      }
      return;
    }
    for (let i = 0; i < total; i++) {
      const r = celda(i, rejilla, img.naturalWidth, img.naturalHeight);
      const orden = seleccion.indexOf(i);
      if (orden >= 0) {
        ctx.fillStyle = 'rgba(124,58,237,0.22)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      ctx.strokeStyle = orden >= 0 ? 'rgba(124,58,237,0.95)' : 'rgba(239,68,68,0.85)';
      ctx.strokeRect(r.x + grosor / 2, r.y + grosor / 2, r.w - grosor, r.h - grosor);
      if (orden >= 0) numero(String(orden + 1), r.x, r.y);
    }
  }, [img, rejilla, seleccion, total, zoom, modo, banda, cortes, borrador]);

  /** Cambiar la franja o sus cortes: todos sus trozos pasan a ser la animación, en orden. */
  const fijarFranja = (b: Rect | null, c: number[]) => {
    const orden = [...c].sort((a, z) => a - z);
    setAjustes({}); setActivo(null);
    setBanda(b); setCortes(orden);
    if (!b || !img || !datosImg.current) { setSeleccion([]); return; }
    // Los trozos mucho más bajos que una pose (el rótulo de la fila) entran apagados; se tocan para usarlos.
    const m = mascara(datosImg.current, limpieza);
    const altos = trozos(b, orden).map((t) => altoDibujo(m, img.naturalWidth, t));
    const max = Math.max(0, ...altos);
    setSeleccion(altos.map((a, i) => (a > 0 && a >= max * 0.45 ? i : -1)).filter((i) => i >= 0));
  };
  const autoCortes = (b: Rect) => {
    if (!datosImg.current || !img) return [];
    return detectarCortes(mascara(datosImg.current, limpieza), img.naturalWidth, b);
  };
  /**
   * Escala propuesta UNA vez por imagen, con la primera fila: que la pose más alta quepa sobre la línea
   * del suelo. Se mide la pose y no la franja (la de un salto es más alta por el recorrido), y no se
   * vuelve a cambiar sola: todas las animaciones de un personaje tienen que salir a la misma escala.
   */
  const escalaPropuesta = useRef(false);
  const proponerEscala = (b: Rect, c: number[]) => {
    if (escalaPropuesta.current || !img || !datosImg.current) return;
    escalaPropuesta.current = true;
    const m = mascara(datosImg.current, limpieza);
    const alto = Math.max(0, ...trozos(b, c).map((t) => altoDibujo(m, img.naturalWidth, t)));
    if (alto) setLimpieza((l) => ({ ...l, escala: Math.max(1, Math.ceil(alto / (CELDA.alto - MARGEN_PIES))) }));
  };

  const aImagen = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const caja = e.currentTarget.getBoundingClientRect();
    const k = img!.naturalWidth / caja.width;
    return { x: (e.clientX - caja.left) * k, y: (e.clientY - caja.top) * k, tol: 8 * k };
  };
  /** Qué hay bajo el puntero en la franja: un corte, un borde o el interior. */
  const queHay = (x: number, y: number, tol: number): Arrastre | null => {
    if (!banda) return null;
    const dentroY = y >= banda.y - tol && y <= banda.y + banda.h + tol;
    const dentroX = x >= banda.x - tol && x <= banda.x + banda.w + tol;
    const i = cortes.findIndex((c) => Math.abs(c - x) <= tol);
    if (i >= 0 && dentroY) return { tipo: 'corte', i, movido: false };
    if (dentroY && Math.abs(x - banda.x) <= tol) return { tipo: 'borde', lado: 'izq' };
    if (dentroY && Math.abs(x - (banda.x + banda.w)) <= tol) return { tipo: 'borde', lado: 'der' };
    if (dentroX && Math.abs(y - banda.y) <= tol) return { tipo: 'borde', lado: 'arr' };
    if (dentroX && Math.abs(y - (banda.y + banda.h)) <= tol) return { tipo: 'borde', lado: 'aba' };
    if (dentroX && dentroY) return { tipo: 'anadir', x, movido: false };
    return null;
  };

  const alBajar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img || modo !== 'franja' || gotero) return;
    const { x, y, tol } = aImagen(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = queHay(x, y, tol) ?? { tipo: 'nueva', x0: x, y0: y, movido: false };
  };
  const alMover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!img || modo !== 'franja') return;
    const { x, y, tol } = aImagen(e);
    const a = arrastre.current;
    if (!a) {
      const h = queHay(x, y, tol);
      setCursor(gotero ? 'crosshair' : !h ? 'crosshair' : h.tipo === 'corte' || (h.tipo === 'borde' && (h.lado === 'izq' || h.lado === 'der')) ? 'ew-resize' : h.tipo === 'borde' ? 'ns-resize' : 'copy');
      return;
    }
    const W = img.naturalWidth, H = img.naturalHeight;
    if (a.tipo === 'nueva') {
      a.movido = a.movido || Math.abs(x - a.x0) > tol / 2 || Math.abs(y - a.y0) > tol / 2;
      if (a.movido) {
        const cx = Math.max(0, Math.min(W, x)), cy = Math.max(0, Math.min(H, y));
        setBorrador({ x: Math.round(Math.min(a.x0, cx)), y: Math.round(Math.min(a.y0, cy)), w: Math.round(Math.abs(cx - a.x0)), h: Math.round(Math.abs(cy - a.y0)) });
      }
    } else if (a.tipo === 'anadir') {
      a.movido = a.movido || Math.abs(x - a.x) > tol / 2;
    } else if (a.tipo === 'corte' && banda) {
      a.movido = true;
      const nx = Math.round(Math.max(banda.x + 1, Math.min(banda.x + banda.w - 1, x)));
      setCortes((c) => c.map((v, k) => (k === a.i ? nx : v)));
    } else if (a.tipo === 'borde' && banda) {
      const b = { ...banda };
      const fx = Math.round(Math.max(0, Math.min(W, x))), fy = Math.round(Math.max(0, Math.min(H, y)));
      if (a.lado === 'izq') { const der = b.x + b.w; b.x = Math.min(fx, der - 2); b.w = der - b.x; }
      if (a.lado === 'der') b.w = Math.max(2, fx - b.x);
      if (a.lado === 'arr') { const aba = b.y + b.h; b.y = Math.min(fy, aba - 2); b.h = aba - b.y; }
      if (a.lado === 'aba') b.h = Math.max(2, fy - b.y);
      setBanda(b);
    }
  };
  const alSoltar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const a = arrastre.current;
    arrastre.current = null;
    if (!img || modo !== 'franja' || !a) return;
    const { x, y, tol } = aImagen(e);
    if (a.tipo === 'nueva') {
      setBorrador(null);
      let b: Rect | null = null;
      if (a.movido && borrador && borrador.w > 3 && borrador.h > 3) b = borrador;
      else if (!a.movido && datosImg.current) b = detectarFila(mascara(datosImg.current, limpieza), img.naturalWidth, img.naturalHeight, y);
      if (!b) { if (!a.movido) toast.error('No hay ninguna fila de dibujos ahí'); return; }
      const c = autoCortes(b);
      proponerEscala(b, c);
      fijarFranja(b, c);
    } else if (a.tipo === 'anadir' && !a.movido && banda) {
      const i = trozos(banda, cortes).findIndex((t) => x >= t.x && x < t.x + t.w);
      if (i >= 0 && !seleccion.includes(i)) setSeleccion((s) => [...s, i].sort((p, q) => p - q));
      else fijarFranja(banda, [...cortes, Math.round(x)]);
    } else if (a.tipo === 'corte' && banda) {
      // Arrastrado fuera de la franja, se quita.
      const fuera = y < banda.y - tol * 3 || y > banda.y + banda.h + tol * 3;
      fijarFranja(banda, fuera ? cortes.filter((_, k) => k !== a.i) : cortes);
    } else if (a.tipo === 'borde' && banda) {
      fijarFranja(banda, cortes.filter((c) => c > banda.x && c < banda.x + banda.w));
    }
  };

  const alTocarImagen = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!img) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - caja.left) / caja.width) * img.naturalWidth;
    const y = ((e.clientY - caja.top) / caja.height) * img.naturalHeight;
    if (gotero) {
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      setLimpieza((l) => ({ ...l, fondo: [r, g, b], quitarFondo: true }));
      setGotero(false);
      return;
    }
    if (modo !== 'rejilla') return;
    for (let i = 0; i < total; i++) {
      const r = celda(i, rejilla, img.naturalWidth, img.naturalHeight);
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        setSeleccion((s) => (s.includes(i) ? s.filter((n) => n !== i) : [...s, i]));
        return;
      }
    }
  };

  const cuadros = useMemo<Cuadro[]>(() => {
    if (!img) return [];
    if (modo === 'franja') {
      if (!banda) return [];
      const lista = trozos(banda, cortes);
      return seleccion.filter((i) => i < lista.length).map((i) => procesar(img, lista[i], limpieza));
    }
    return seleccion.filter((i) => i < total).map((i) => procesar(img, celda(i, rejilla, img.naturalWidth, img.naturalHeight), limpieza));
  }, [img, seleccion, rejilla, limpieza, total, modo, banda, cortes]);
  const origen = useMemo(() => seleccion.filter((i) => modo === 'rejilla' ? i < total : true).slice(0, cuadros.length), [seleccion, modo, total, cuadros.length]);
  const colocados = useMemo<Cuadro[]>(() => cuadros.map((c, pos) => {
    const a = ajustes[origen[pos]];
    if (!a || (!a.x && !a.y) || !c.caja) return c;
    const lienzo = document.createElement('canvas');
    lienzo.width = CELDA.ancho; lienzo.height = CELDA.alto;
    lienzo.getContext('2d')!.drawImage(c.canvas, a.x, a.y);
    const caja = { x0: c.caja.x0 + a.x, y0: c.caja.y0 + a.y, x1: c.caja.x1 + a.x, y1: c.caja.y1 + a.y };
    return { ...c, canvas: lienzo, caja, desborda: caja.x0 < 0 || caja.y0 < 0 || caja.x1 >= CELDA.ancho || caja.y1 >= CELDA.alto };
  }), [cuadros, ajustes, origen]);
  const lienzos = useMemo(() => colocados.map((c) => c.canvas), [colocados]);
  const desbordan = colocados.filter((c) => c.desborda).length;
  const posActivo = activo === null ? -1 : origen.indexOf(activo);
  useEffect(() => { if (activo !== null && posActivo < 0) setActivo(null); }, [activo, posActivo]);
  const ajustar = (fn: (a: { x: number; y: number }) => { x: number; y: number }) => {
    if (activo === null) return;
    setAjustes((t) => ({ ...t, [activo]: fn(t[activo] ?? { x: 0, y: 0 }) }));
  };
  // Flechas: 1 píxel (con Mayúsculas, 4), mientras haya un fotograma elegido y no se esté escribiendo.
  useEffect(() => {
    if (activo === null) return;
    const alPulsar = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      const paso = e.shiftKey ? 4 : 1;
      const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      if (!d) { if (e.key === 'Escape') setActivo(null); return; }
      e.preventDefault();
      setAjustes((t) => { const a = t[activo] ?? { x: 0, y: 0 }; return { ...t, [activo]: { x: a.x + d[0], y: a.y + d[1] } }; });
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [activo]);

  const mover = (pos: number, paso: number) => setSeleccion((s) => {
    const n = [...s];
    const destino = pos + paso;
    if (destino < 0 || destino >= n.length) return s;
    [n[pos], n[destino]] = [n[destino], n[pos]];
    return n;
  });

  const guardar = async () => {
    if (!personajeId) { toast.error('Escribe el nombre del personaje'); return; }
    if (!nombreAnimacion || nombreAnimacion === `_${direccion}`) { toast.error('Escribe el nombre de la animación'); return; }
    if (!cuadros.length) { toast.error('Elige al menos un cuadro'); return; }
    const hacer = async () => {
      setConfirmar(null);
      setGuardando(true);
      try {
        const tira = document.createElement('canvas');
        tira.width = CELDA.ancho * lienzos.length; tira.height = CELDA.alto;
        const ctx = tira.getContext('2d')!;
        lienzos.forEach((c, i) => ctx.drawImage(c, i * CELDA.ancho, 0));
        const r = await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personaje: personajeId, nombre: nombreAnimacion, png: tira.toDataURL('image/png'),
            fotogramas: lienzos.length, ancho: CELDA.ancho, alto: CELDA.alto, fps, bucle,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'No se pudo guardar');
        setFicha(j.data);
        if (!personajes.includes(personajeId)) setPersonajes((p) => [...p, personajeId].sort());
        if (modo === 'franja') fijarFranja(null, []); else setSeleccion([]);
        toast.success(`«${nombreAnimacion}» guardada en godot/assets/personajes/${personajeId}/`);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setGuardando(false);
      }
    };
    if (ficha?.animaciones[nombreAnimacion]) {
      setConfirmar({
        titulo: 'Reemplazar animación', boton: 'Reemplazar', accion: hacer,
        mensaje: `«${nombreAnimacion}» ya existe en ${personajeId}. Se reemplazará por estos ${cuadros.length} fotogramas.`,
      });
      return;
    }
    hacer();
  };

  const borrar = (nombre: string) => setConfirmar({
    titulo: 'Borrar animación', boton: 'Borrar', peligro: true,
    mensaje: `Se borrará «${nombre}» de ${personajeId}, con su imagen.`,
    accion: async () => {
      setConfirmar(null);
      const r = await fetch(`${API}?personaje=${encodeURIComponent(personajeId)}&nombre=${encodeURIComponent(nombre)}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'No se pudo borrar'); return; }
      setFicha(j.data);
    },
  });

  const hex = `#${limpieza.fondo.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  const animacionesGuardadas = Object.entries(ficha?.animaciones ?? {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px] items-start">
      {/* ── 1. Imagen, rejilla y limpieza ── */}
      <section className="bg-digi-card border border-digi-border rounded-lg p-4 space-y-4">
        <EditField label="Personaje">
          <input className={EDIT_INPUT} list="personajes-guardados" value={personaje} placeholder="rey_orejon"
            onChange={(e) => setPersonaje(e.target.value)} />
          <datalist id="personajes-guardados">{personajes.map((p) => <option key={p} value={p} />)}</datalist>
        </EditField>

        <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) abrirImagen(f); e.target.value = ''; }} />
        <button type="button" onClick={() => entrada.current?.click()} className={`${BTN_SECONDARY} w-full`}>
          <Upload className="w-4 h-4" /> {img ? 'Cambiar imagen' : 'Subir imagen'}
        </button>
        <button type="button" onClick={pegarDelPortapapeles} className={`${BTN_SECONDARY} w-full`} title="Pegar la imagen copiada (⌘V o Ctrl+V)">
          <ClipboardPaste className="w-4 h-4" /> Pegar imagen
        </button>
        {img && <p className="text-[11px] text-digi-muted truncate tabular-nums" style={mf} title={nombreImagen}>{nombreImagen} · {img.naturalWidth}×{img.naturalHeight}</p>}

        <div className="pt-3 border-t border-digi-border space-y-3">
          <p className="text-[12px] font-semibold text-digi-text" style={mf}>Corte</p>
          <div role="radiogroup" aria-label="Modo de corte" className="grid grid-cols-2 rounded-md border border-digi-border bg-digi-darker p-0.5">
            {([['franja', 'Por fila'], ['rejilla', 'Rejilla']] as [Modo, string][]).map(([valor, texto]) => (
              <button key={valor} type="button" role="radio" aria-checked={modo === valor}
                onClick={() => { setModo(valor); setSeleccion([]); fijarFranja(null, []); }}
                className={`h-8 rounded text-[13px] transition-colors ${modo === valor ? 'bg-digi-card text-digi-text shadow-sm ring-1 ring-digi-border font-medium' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>
                {texto}
              </button>
            ))}
          </div>
          {modo === 'franja' ? (
            <>
              <p className="text-[11px] text-digi-muted tabular-nums" style={mf}>
                {banda ? `Franja de ${Math.round(banda.w)} × ${Math.round(banda.h)} px · ${cortes.length} ${cortes.length === 1 ? 'corte' : 'cortes'} · ${cortes.length + 1} trozos` : 'Sin fila elegida'}
              </p>
              <div className="space-y-2">
                <button type="button" className={`${BTN_SECONDARY} w-full`} disabled={!banda} onClick={() => banda && fijarFranja(banda, autoCortes(banda))}>Detectar cortes</button>
                <button type="button" className={`${BTN_SECONDARY} w-full`} disabled={!banda || !cortes.length} onClick={() => banda && fijarFranja(banda, [])}>Quitar cortes</button>
              </div>
            </>
          ) : (<>
          <div className="grid grid-cols-2 gap-2">
            <Numero label="Columnas" valor={rejilla.columnas} min={1} max={64} onChange={(n) => { setRejilla((r) => ({ ...r, columnas: n })); setSeleccion([]); }} />
            <Numero label="Filas" valor={rejilla.filas} min={1} max={64} onChange={(n) => { setRejilla((r) => ({ ...r, filas: n })); setSeleccion([]); }} />
            <Numero label="Margen horizontal" valor={rejilla.margenX} onChange={(n) => setRejilla((r) => ({ ...r, margenX: n }))} />
            <Numero label="Margen vertical" valor={rejilla.margenY} onChange={(n) => setRejilla((r) => ({ ...r, margenY: n }))} />
            <Numero label="Hueco horizontal" valor={rejilla.sepX} onChange={(n) => setRejilla((r) => ({ ...r, sepX: n }))} />
            <Numero label="Hueco vertical" valor={rejilla.sepY} onChange={(n) => setRejilla((r) => ({ ...r, sepY: n }))} />
          </div>
          {celdaOrigen && (
            <p className="text-[11px] text-digi-muted tabular-nums" style={mf}>
              Cada cuadro: {celdaOrigen.w.toFixed(1).replace('.', ',')} × {celdaOrigen.h.toFixed(1).replace('.', ',')} px
            </p>
          )}
          </>)}
        </div>

        <div className="pt-3 border-t border-digi-border space-y-3">
          <p className="text-[12px] font-semibold text-digi-text" style={mf}>Limpieza</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-digi-text" style={mf}>Quitar el fondo</span>
            <Interruptor activo={limpieza.quitarFondo} onChange={(v: boolean) => setLimpieza((l) => ({ ...l, quitarFondo: v }))} etiqueta="Quitar el fondo" />
          </div>
          {limpieza.quitarFondo && (
            <div className="flex items-end gap-2">
              <EditField label="Color del fondo">
                <input type="color" value={hex} className="h-9 w-14 cursor-pointer rounded border-2 border-digi-border bg-digi-darker"
                  onChange={(e) => { const v = e.target.value; setLimpieza((l) => ({ ...l, fondo: [1, 3, 5].map((p) => parseInt(v.slice(p, p + 2), 16)) as [number, number, number] })); }} />
              </EditField>
              <button type="button" onClick={() => setGotero((g) => !g)} disabled={!img}
                className={`${gotero ? BTN_PRIMARY : BTN_SECONDARY} h-9`} title="Tomar el color del fondo tocando la imagen" aria-label="Tomar el color del fondo tocando la imagen">
                <Pipette className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <Numero label="Tolerancia" valor={limpieza.tolerancia} max={255} onChange={(n) => setLimpieza((l) => ({ ...l, tolerancia: n }))} />
              </div>
            </div>
          )}
          <Numero label="Tamaño de cada píxel en la imagen" valor={limpieza.escala} min={1} max={64} onChange={(n) => setLimpieza((l) => ({ ...l, escala: n }))} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-digi-text" style={mf}>Quitar restos de las filas vecinas</span>
            <Interruptor activo={limpieza.quitarRestos} onChange={(v: boolean) => setLimpieza((l) => ({ ...l, quitarRestos: v }))} etiqueta="Quitar restos de las filas vecinas" />
          </div>
          <PixelSelect label="Colocación en la celda" value={limpieza.colocacion}
            onChange={(e) => setLimpieza((l) => ({ ...l, colocacion: e.target.value as Colocacion }))}
            options={[{ value: 'pies', label: 'Pies al suelo en cada cuadro' }, { value: 'conservar', label: 'Conservar la altura (saltos)' }]} />
          <div className="grid grid-cols-2 gap-2">
            <Numero label="Mover derecha" valor={limpieza.ajusteX} min={-96} max={96} onChange={(n) => setLimpieza((l) => ({ ...l, ajusteX: n }))} />
            <Numero label="Mover abajo" valor={limpieza.ajusteY} min={-128} max={128} onChange={(n) => setLimpieza((l) => ({ ...l, ajusteY: n }))} />
          </div>
        </div>
      </section>

      {/* ── 2. La imagen con la rejilla encima ── */}
      <section className="bg-digi-card border border-digi-border rounded-lg min-w-0">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-digi-border">
          <p className="text-[12px] font-semibold text-digi-text flex-1 min-w-0 truncate" style={mf}>
            {!img ? 'Sube la imagen con las poses o pégala con ⌘V o Ctrl+V' : gotero ? 'Toca el fondo de la imagen'
              : modo === 'rejilla' ? `Toca los cuadros en el orden de la animación · ${seleccion.length} elegidos`
              : !banda ? 'Toca una fila para elegirla, o arrastra para marcar la franja'
              : `Toca dentro para cortar o para usar un trozo apagado · arrastra un corte fuera para quitarlo · ${seleccion.length} fotogramas`}
          </p>
          {(seleccion.length > 0 || banda) && (
            <button type="button" onClick={() => (modo === 'franja' ? fijarFranja(null, []) : setSeleccion([]))} className={BTN_ICONO_FILA}
              title={modo === 'franja' ? 'Elegir otra fila' : 'Quitar la selección'} aria-label={modo === 'franja' ? 'Elegir otra fila' : 'Quitar la selección'}><Eraser className="w-4 h-4" /></button>
          )}
          <button type="button" onClick={() => setZoom((z) => Math.max(0.1, +(z / 1.25).toFixed(3)))} disabled={!img} className={BTN_ICONO_FILA} title="Alejar" aria-label="Alejar"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-[11px] text-digi-muted tabular-nums w-10 text-center" style={mf}>{Math.round(zoom * 100)} %</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(8, +(z * 1.25).toFixed(3)))} disabled={!img} className={BTN_ICONO_FILA} title="Acercar" aria-label="Acercar"><ZoomIn className="w-4 h-4" /></button>
        </div>
        <div ref={visor} className="overflow-auto max-h-[calc(100dvh-14rem)] p-4">
          {img ? (
            // En la franja se arrastra con el dedo o el lápiz: sin `touch-action: none` el iPad desplazaría la página.
            <canvas ref={lienzo} onClick={alTocarImagen}
              onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={() => { arrastre.current = null; setBorrador(null); }}
              className={gotero ? 'cursor-crosshair' : modo === 'rejilla' ? 'cursor-pointer' : ''}
              style={{ width: img.naturalWidth * zoom, height: img.naturalHeight * zoom, imageRendering: 'pixelated',
                ...(modo === 'franja' && !gotero ? { cursor, touchAction: 'none' as const } : {}) }} />
          ) : (
            <button type="button" onClick={() => entrada.current?.click()}
              className="w-full py-20 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-digi-border text-digi-muted hover:border-accent hover:text-accent transition-colors">
              <Upload className="w-6 h-6" />
              <span className="text-[13px]" style={mf}>Subir imagen o pegarla con ⌘V o Ctrl+V</span>
            </button>
          )}
        </div>
      </section>

      {/* ── 3. La animación: verla, ordenarla y guardarla ── (entre lg y xl, bajo la imagen) */}
      <section className="bg-digi-card border border-digi-border rounded-lg p-4 space-y-4 lg:col-start-2 xl:col-start-auto">
        <div className="flex justify-center">
          <Escenario cuadros={lienzos} fps={fps} reproducir={reproducir} guias={guias}
            fijo={posActivo >= 0 ? posActivo : null}
            fantasma={posActivo > 0 ? lienzos[posActivo - 1] : posActivo === 0 && lienzos.length > 1 ? lienzos[lienzos.length - 1] : null}
            onArrastre={(dx, dy, fin) => {
              // La base se toma al empezar cada arrastre: las flechas pueden haberlo movido entre medias.
              if (!arrastrando.current && activo !== null) { arrastrando.current = true; base.current = ajustes[activo] ?? { x: 0, y: 0 }; }
              ajustar(() => ({ x: base.current.x + dx, y: base.current.y + dy }));
              if (fin) arrastrando.current = false;
            }} />
        </div>
        {posActivo >= 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="basis-full text-[12px] text-digi-text tabular-nums text-center" style={mf}>
              Fotograma {posActivo + 1} · {(ajustes[activo!]?.x ?? 0) >= 0 ? '+' : ''}{ajustes[activo!]?.x ?? 0}, {(ajustes[activo!]?.y ?? 0) >= 0 ? '+' : ''}{ajustes[activo!]?.y ?? 0} px
            </p>
            <button type="button" className={BTN_SECONDARY} onClick={() => { ajustar(() => ({ x: 0, y: 0 })); base.current = { x: 0, y: 0 }; }}>Restablecer</button>
            <button type="button" className={BTN_PRIMARY} onClick={() => setActivo(null)}>Listo</button>
          </div>
        ) : (
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setReproducir((r) => !r)} className={BTN_SECONDARY} disabled={lienzos.length < 2}>
            {reproducir ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Reproducir</>}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-digi-text" style={mf}>Guías</span>
            <Interruptor activo={guias} onChange={setGuias} etiqueta="Guías" />
          </div>
        </div>
        )}
        {desbordan > 0 && (
          <p className="text-[12px] text-red-500" style={mf}>
            {desbordan === 1 ? 'Un cuadro se sale' : `${desbordan} cuadros se salen`} de la celda de 96 × 128: sube el tamaño de cada píxel.
          </p>
        )}

        {cuadros.length > 0 && (
          <ol className="flex flex-wrap gap-2">
            {colocados.map((c, pos) => (
              <li key={`${origen[pos]}-${pos}`} className={`relative rounded border bg-digi-darker ${posActivo === pos ? 'border-accent ring-2 ring-accent/40' : c.desborda ? 'border-red-400' : 'border-digi-border'}`}>
                <canvas width={CELDA.ancho} height={CELDA.alto} className="block cursor-pointer" style={{ width: 48, height: 64, imageRendering: 'pixelated' }}
                  title="Tocar para colocarlo a mano"
                  onClick={() => { const o = origen[pos]; if (activo === o) { setActivo(null); return; } setActivo(o); base.current = ajustes[o] ?? { x: 0, y: 0 }; }}
                  ref={(el) => { if (el) { const ctx = el.getContext('2d')!; ctx.clearRect(0, 0, el.width, el.height); ctx.drawImage(c.canvas, 0, 0); } }} />
                <span className="absolute top-0.5 left-1 text-[10px] font-semibold text-digi-muted tabular-nums" style={mf}>{pos + 1}</span>
                <div className="flex justify-between">
                  <button type="button" onClick={() => mover(pos, -1)} disabled={pos === 0} className="p-0.5 text-digi-muted hover:text-accent disabled:opacity-30" aria-label="Antes" title="Antes"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => setSeleccion((s) => s.filter((_, k) => k !== pos))} className="p-0.5 text-digi-muted hover:text-red-500" aria-label="Quitar" title="Quitar"><X className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => mover(pos, 1)} disabled={pos === cuadros.length - 1} className="p-0.5 text-digi-muted hover:text-accent disabled:opacity-30" aria-label="Después" title="Después"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="pt-3 border-t border-digi-border space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PixelSelect label="Animación" options={TIPOS} value={tipo} onChange={(e) => setTipo(e.target.value)} />
            <PixelSelect label="Dirección" options={DIRECCIONES} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>
          {tipo === 'otra' && (
            <EditField label="Nombre de la animación">
              <input className={EDIT_INPUT} value={tipoLibre} onChange={(e) => setTipoLibre(e.target.value)} placeholder="lanzar_roca" />
            </EditField>
          )}
          <div className="grid grid-cols-2 gap-2 items-end">
            <Numero label="Velocidad (fps)" valor={fps} min={1} max={60} onChange={setFps} />
            <div className="flex items-center justify-between gap-2 h-[42px]">
              <span className="text-[12px] text-digi-text" style={mf}>Repetir</span>
              <Interruptor activo={bucle} onChange={setBucle} etiqueta="Repetir" />
            </div>
          </div>
          <button type="button" onClick={guardar} disabled={guardando || !cuadros.length || !personajeId} className={`${BTN_PRIMARY} w-full`}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar {nombreAnimacion || 'animación'}
          </button>
        </div>

        {personajeId && (
          <div className="pt-3 border-t border-digi-border">
            <p className="text-[12px] font-semibold text-digi-text mb-1 flex items-center gap-1.5" style={mf}>
              <Film className="w-4 h-4 text-digi-muted" /> Animaciones de {personajeId}
            </p>
            {errorFicha ? (
              <p className="text-[12px] text-red-500 py-2" style={mf}>{errorFicha}</p>
            ) : !ficha ? (
              <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-digi-muted" /></div>
            ) : animacionesGuardadas.length ? (
              <ul>
                {animacionesGuardadas.map(([nombre, a]) => (
                  <AnimacionGuardada key={nombre} personaje={personajeId} nombre={nombre} a={a} onBorrar={() => borrar(nombre)} />
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-digi-muted py-2" style={mf}>Todavía no tiene animaciones.</p>
            )}
          </div>
        )}
      </section>

      <PixelConfirm open={!!confirmar} title={confirmar?.titulo} message={confirmar?.mensaje ?? ''} confirmLabel={confirmar?.boton}
        danger={confirmar?.peligro} onConfirm={() => confirmar?.accion()} onCancel={() => setConfirmar(null)} />
    </div>
  );
}
