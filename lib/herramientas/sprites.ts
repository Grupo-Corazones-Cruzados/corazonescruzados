import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * CORTADOR DE SPRITES — el lado del servidor (Fernando, 2026-11-08).
 *
 * Fernando corta los fotogramas en el navegador y aquí solo llega el resultado: una tira PNG por
 * animación. Se escribe en la carpeta del juego, `godot/assets/personajes/<personaje>/`, del
 * REPOSITORIO de trabajo. ⚠️ La web local corre desde `~/.gcc-espacio/app`, que es un `git worktree`
 * del repositorio: escribir en su propio `godot/` dejaría los archivos en una copia que se pisa al
 * reinstalar. Por eso la raíz se saca del directorio común de git, que en los dos casos es el
 * `.git` del repositorio de verdad.
 *
 * Por personaje quedan:
 *  - `<animacion>_<direccion>.png`: los fotogramas en fila, todos del mismo tamaño de celda;
 *  - `<personaje>.json`: qué animaciones hay, con sus fotogramas, velocidad y si se repiten;
 *  - `<personaje>.tres`: el `SpriteFrames` de Godot, rehecho desde el JSON en cada guardado, para
 *    arrastrarlo a un `AnimatedSprite2D` y que funcione sin cortar nada a mano.
 */

export type Animacion = {
  archivo: string;
  fotogramas: number;
  ancho: number;
  alto: number;
  fps: number;
  bucle: boolean;
  guardada: string;
};
export type Ficha = { personaje: string; animaciones: Record<string, Animacion> };

let raizCache: string | null = null;
function raizRepositorio(): string {
  if (raizCache) return raizCache;
  try {
    const comun = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: process.cwd(), encoding: 'utf8' }).trim();
    raizCache = path.dirname(comun);
  } catch {
    raizCache = process.cwd();
  }
  return raizCache;
}

/** `res://` de Godot = la carpeta `godot/` del repositorio. */
export const RAIZ_JUEGO = () => path.join(raizRepositorio(), 'godot');
export const CARPETA_PERSONAJES = () => path.join(RAIZ_JUEGO(), 'assets', 'personajes');

/** Nombres de carpeta y de archivo: minúsculas, sin acentos ni espacios. Nunca una ruta. */
export function nombreSeguro(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

const carpetaDe = (personaje: string) => path.join(CARPETA_PERSONAJES(), personaje);
const fichaDe = (personaje: string) => path.join(carpetaDe(personaje), `${personaje}.json`);

export async function listarPersonajes(): Promise<string[]> {
  try {
    const entradas = await fs.readdir(CARPETA_PERSONAJES(), { withFileTypes: true });
    return entradas.filter((e) => e.isDirectory() && nombreSeguro(e.name) === e.name).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

export async function leerFicha(personaje: string): Promise<Ficha> {
  try {
    const f = JSON.parse(await fs.readFile(fichaDe(personaje), 'utf8')) as Ficha;
    return { personaje, animaciones: f.animaciones ?? {} };
  } catch {
    return { personaje, animaciones: {} };
  }
}

/** Ruta absoluta de un PNG de un personaje, o null si se sale de su carpeta. */
export function rutaImagen(personaje: string, archivo: string): string | null {
  if (nombreSeguro(personaje) !== personaje || !/^[a-z0-9_]+\.png$/.test(archivo)) return null;
  return path.join(carpetaDe(personaje), archivo);
}

export async function guardarAnimacion(datos: {
  personaje: string; nombre: string; png: Buffer;
  fotogramas: number; ancho: number; alto: number; fps: number; bucle: boolean;
}): Promise<Ficha> {
  const { personaje, nombre } = datos;
  await fs.mkdir(carpetaDe(personaje), { recursive: true });
  const archivo = `${nombre}.png`;
  await fs.writeFile(path.join(carpetaDe(personaje), archivo), datos.png);
  const ficha = await leerFicha(personaje);
  ficha.animaciones[nombre] = {
    archivo, fotogramas: datos.fotogramas, ancho: datos.ancho, alto: datos.alto,
    fps: datos.fps, bucle: datos.bucle, guardada: new Date().toISOString(),
  };
  await escribirFicha(ficha);
  return ficha;
}

export async function borrarAnimacion(personaje: string, nombre: string): Promise<Ficha> {
  const ficha = await leerFicha(personaje);
  const a = ficha.animaciones[nombre];
  if (a) {
    await fs.rm(path.join(carpetaDe(personaje), a.archivo), { force: true });
    // El `.import` que Godot crea junto al PNG se queda huérfano si no se borra con él.
    await fs.rm(path.join(carpetaDe(personaje), `${a.archivo}.import`), { force: true });
    delete ficha.animaciones[nombre];
    await escribirFicha(ficha);
  }
  return ficha;
}

async function escribirFicha(ficha: Ficha) {
  await fs.writeFile(fichaDe(ficha.personaje), `${JSON.stringify(ficha, null, 2)}\n`);
  await fs.writeFile(path.join(carpetaDe(ficha.personaje), `${ficha.personaje}.tres`), spriteFrames(ficha));
}

/** El `SpriteFrames` de Godot 4 en texto: una textura por tira y una región por fotograma. */
export function spriteFrames(ficha: Ficha): string {
  const nombres = Object.keys(ficha.animaciones).sort();
  const ext: string[] = [];
  const sub: string[] = [];
  const anims: string[] = [];
  nombres.forEach((nombre, i) => {
    const a = ficha.animaciones[nombre];
    const idTextura = `${i + 1}_${nombre}`;
    ext.push(`[ext_resource type="Texture2D" path="res://assets/personajes/${ficha.personaje}/${a.archivo}" id="${idTextura}"]`);
    const cuadros: string[] = [];
    for (let f = 0; f < a.fotogramas; f++) {
      const idCuadro = `Atlas_${nombre}_${f}`;
      sub.push(`[sub_resource type="AtlasTexture" id="${idCuadro}"]\natlas = ExtResource("${idTextura}")\nregion = Rect2(${f * a.ancho}, 0, ${a.ancho}, ${a.alto})`);
      cuadros.push(`{\n"duration": 1.0,\n"texture": SubResource("${idCuadro}")\n}`);
    }
    anims.push(`{\n"frames": [${cuadros.join(', ')}],\n"loop": ${a.bucle},\n"name": &"${nombre}",\n"speed": ${a.fps.toFixed(1)}\n}`);
  });
  const pasos = ext.length + sub.length + 1;
  return [
    `[gd_resource type="SpriteFrames" load_steps=${pasos} format=3]`,
    ...ext,
    ...sub,
    `[resource]\nanimations = [${anims.join(', ')}]`,
  ].join('\n\n') + '\n';
}
