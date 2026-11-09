'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Upload, Play, Pause, Save, Trash2, ChevronLeft, ChevronRight, X, Pipette, ZoomIn, ZoomOut, Lock, Loader2,
  Eraser, Film,
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
type Limpieza = { quitarFondo: boolean; fondo: [number, number, number]; tolerancia: number; escala: number; alinear: boolean; ajusteX: number; ajusteY: number };
type Animacion = { archivo: string; fotogramas: number; ancho: number; alto: number; fps: number; bucle: boolean; guardada: string };
type Ficha = { personaje: string; animaciones: Record<string, Animacion> };
type Cuadro = { canvas: HTMLCanvasElement; desborda: boolean; vacio: boolean };
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

/**
 * Un cuadro de la imagen → una celda del juego.
 * La reducción no promedia: cada bloque de `escala × escala` se queda con su color MÁS REPETIDO (o
 * transparente si la mayoría lo es). Promediar inventaría colores intermedios en los bordes, que es
 * justo lo que ensucia el pixel art que sale de la IA.
 */
function procesar(img: HTMLImageElement, r: { x: number; y: number; w: number; h: number }, l: Limpieza): Cuadro {
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
  if (vacio) return { canvas: salida, desborda: false, vacio };
  const dx = (l.alinear ? Math.round(CELDA.ancho / 2 - (x0 + x1 + 1) / 2) : Math.round((CELDA.ancho - w2) / 2)) + l.ajusteX;
  const dy = (l.alinear ? CELDA.alto - MARGEN_PIES - 1 - y1 : Math.round((CELDA.alto - h2) / 2)) + l.ajusteY;
  const tmp = document.createElement('canvas');
  tmp.width = w2; tmp.height = h2;
  tmp.getContext('2d')!.putImageData(new ImageData(red, w2, h2), 0, 0);
  salida.getContext('2d')!.drawImage(tmp, dx, dy);
  const desborda = x0 + dx < 0 || y0 + dy < 0 || x1 + dx >= CELDA.ancho || y1 + dy >= CELDA.alto;
  return { canvas: salida, desborda, vacio };
}

/** Una celda del juego a tamaño grande, con el suelo marcado: lo que se ve al animar. */
function Escenario({ cuadros, fps, reproducir, guias, escala = 3 }: {
  cuadros: HTMLCanvasElement[]; fps: number; reproducir: boolean; guias: boolean; escala?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [cuadros]);
  useEffect(() => {
    if (!reproducir || cuadros.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % cuadros.length), 1000 / Math.max(1, fps));
    return () => window.clearInterval(id);
  }, [reproducir, fps, cuadros.length]);
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
      ctx.fillStyle = 'rgba(239,68,68,0.55)';
      ctx.fillRect(0, CELDA.alto - MARGEN_PIES, CELDA.ancho, 1);
      ctx.fillStyle = 'rgba(148,163,184,0.45)';
      ctx.fillRect(CELDA.ancho / 2, 0, 1, CELDA.alto);
    }
    const f = cuadros[i % Math.max(1, cuadros.length)];
    if (f) ctx.drawImage(f, 0, 0);
  }, [i, cuadros, guias]);
  return (
    <canvas ref={ref} width={CELDA.ancho} height={CELDA.alto}
      className="block rounded-md border border-digi-border bg-digi-darker"
      style={{ width: CELDA.ancho * escala, height: CELDA.alto * escala, imageRendering: 'pixelated' }} />
  );
}

/** Una animación ya guardada: su tira se corta igual que la verá Godot. */
function AnimacionGuardada({ personaje, nombre, a, onBorrar }: { personaje: string; nombre: string; a: Animacion; onBorrar: () => void }) {
  const [cuadros, setCuadros] = useState<HTMLCanvasElement[]>([]);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const lista: HTMLCanvasElement[] = [];
      for (let f = 0; f < a.fotogramas; f++) {
        const c = document.createElement('canvas');
        c.width = a.ancho; c.height = a.alto;
        c.getContext('2d')!.drawImage(img, f * a.ancho, 0, a.ancho, a.alto, 0, 0, a.ancho, a.alto);
        lista.push(c);
      }
      setCuadros(lista);
    };
    img.src = `${API}/imagen?personaje=${encodeURIComponent(personaje)}&archivo=${encodeURIComponent(a.archivo)}&v=${encodeURIComponent(a.guardada)}`;
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

function Cortador() {
  const [personajes, setPersonajes] = useState<string[]>([]);
  const [personaje, setPersonaje] = useState('');
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [nombreImagen, setNombreImagen] = useState('');
  const [rejilla, setRejilla] = useState<Rejilla>({ columnas: 4, filas: 1, margenX: 0, margenY: 0, sepX: 0, sepY: 0 });
  const [limpieza, setLimpieza] = useState<Limpieza>({ quitarFondo: true, fondo: [255, 255, 255], tolerancia: 24, escala: 1, alinear: true, ajusteX: 0, ajusteY: 0 });
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
      setNombreImagen(archivo.name);
      setSeleccion([]);
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(i, 0, 0, 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      // La escala propuesta: que el alto de una celda quepa en los 128 px del juego.
      const filas = rejilla.filas;
      const altoCelda = i.naturalHeight / filas;
      setLimpieza((l) => ({ ...l, fondo: [r, g, b], escala: Math.max(1, Math.round(altoCelda / CELDA.alto)) }));
      // Que la imagen entre entera a lo ancho en la columna central (sin el relleno de 16 px por lado).
      const ancho = (visor.current?.clientWidth ?? 900) - 32;
      setZoom(Math.min(1, ancho / i.naturalWidth));
    };
    i.src = url;
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
    for (let i = 0; i < total; i++) {
      const r = celda(i, rejilla, img.naturalWidth, img.naturalHeight);
      const orden = seleccion.indexOf(i);
      if (orden >= 0) {
        ctx.fillStyle = 'rgba(124,58,237,0.22)';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      ctx.strokeStyle = orden >= 0 ? 'rgba(124,58,237,0.95)' : 'rgba(239,68,68,0.85)';
      ctx.strokeRect(r.x + grosor / 2, r.y + grosor / 2, r.w - grosor, r.h - grosor);
      if (orden >= 0) {
        const t = Math.max(14, Math.round(18 / zoom));
        ctx.fillStyle = 'rgba(124,58,237,0.95)';
        ctx.fillRect(r.x, r.y, t * 1.6, t * 1.3);
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${t}px system-ui, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(String(orden + 1), r.x + t * 0.3, r.y + t * 0.15);
      }
    }
  }, [img, rejilla, seleccion, total, zoom]);

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
    return seleccion.filter((i) => i < total).map((i) => procesar(img, celda(i, rejilla, img.naturalWidth, img.naturalHeight), limpieza));
  }, [img, seleccion, rejilla, limpieza, total]);
  const lienzos = useMemo(() => cuadros.map((c) => c.canvas), [cuadros]);
  const desbordan = cuadros.filter((c) => c.desborda).length;

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
        setSeleccion([]);
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
        {img && <p className="text-[11px] text-digi-muted truncate tabular-nums" style={mf} title={nombreImagen}>{nombreImagen} · {img.naturalWidth}×{img.naturalHeight}</p>}

        <div className="pt-3 border-t border-digi-border space-y-3">
          <p className="text-[12px] font-semibold text-digi-text" style={mf}>Rejilla</p>
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
            <span className="text-[12px] text-digi-text" style={mf}>Pies en la línea del suelo</span>
            <Interruptor activo={limpieza.alinear} onChange={(v: boolean) => setLimpieza((l) => ({ ...l, alinear: v }))} etiqueta="Pies en la línea del suelo" />
          </div>
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
            {!img ? 'Sube la imagen con las poses' : gotero ? 'Toca el fondo de la imagen' : `Toca los cuadros en el orden de la animación · ${seleccion.length} elegidos`}
          </p>
          {seleccion.length > 0 && (
            <button type="button" onClick={() => setSeleccion([])} className={BTN_ICONO_FILA} title="Quitar la selección" aria-label="Quitar la selección"><Eraser className="w-4 h-4" /></button>
          )}
          <button type="button" onClick={() => setZoom((z) => Math.max(0.1, +(z / 1.25).toFixed(3)))} disabled={!img} className={BTN_ICONO_FILA} title="Alejar" aria-label="Alejar"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-[11px] text-digi-muted tabular-nums w-10 text-center" style={mf}>{Math.round(zoom * 100)} %</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(8, +(z * 1.25).toFixed(3)))} disabled={!img} className={BTN_ICONO_FILA} title="Acercar" aria-label="Acercar"><ZoomIn className="w-4 h-4" /></button>
        </div>
        <div ref={visor} className="overflow-auto max-h-[calc(100dvh-14rem)] p-4">
          {img ? (
            <canvas ref={lienzo} onClick={alTocarImagen}
              className={gotero ? 'cursor-crosshair' : 'cursor-pointer'}
              style={{ width: img.naturalWidth * zoom, height: img.naturalHeight * zoom, imageRendering: 'pixelated' }} />
          ) : (
            <button type="button" onClick={() => entrada.current?.click()}
              className="w-full py-20 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-digi-border text-digi-muted hover:border-accent hover:text-accent transition-colors">
              <Upload className="w-6 h-6" />
              <span className="text-[13px]" style={mf}>Subir imagen</span>
            </button>
          )}
        </div>
      </section>

      {/* ── 3. La animación: verla, ordenarla y guardarla ── (entre lg y xl, bajo la imagen) */}
      <section className="bg-digi-card border border-digi-border rounded-lg p-4 space-y-4 lg:col-start-2 xl:col-start-auto">
        <div className="flex justify-center">
          <Escenario cuadros={lienzos} fps={fps} reproducir={reproducir} guias={guias} />
        </div>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setReproducir((r) => !r)} className={BTN_SECONDARY} disabled={lienzos.length < 2}>
            {reproducir ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Reproducir</>}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-digi-text" style={mf}>Guías</span>
            <Interruptor activo={guias} onChange={setGuias} etiqueta="Guías" />
          </div>
        </div>
        {desbordan > 0 && (
          <p className="text-[12px] text-red-500" style={mf}>
            {desbordan === 1 ? 'Un cuadro se sale' : `${desbordan} cuadros se salen`} de la celda de 96 × 128: sube el tamaño de cada píxel.
          </p>
        )}

        {cuadros.length > 0 && (
          <ol className="flex flex-wrap gap-2">
            {cuadros.map((c, pos) => (
              <li key={`${seleccion[pos]}-${pos}`} className={`relative rounded border ${c.desborda ? 'border-red-400' : 'border-digi-border'} bg-digi-darker`}>
                <canvas width={CELDA.ancho} height={CELDA.alto} className="block" style={{ width: 48, height: 64, imageRendering: 'pixelated' }}
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
