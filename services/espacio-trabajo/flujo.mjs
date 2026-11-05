import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASES_CONEXION, LARGO, TIPOS_NODO } from './flujo-catalogo.mjs';

/**
 * DIAGRAMA DE FLUJO DE UN PROYECTO. Una sesión normal de Claude Code lo escribe y este archivo decide si se
 * publica. Vive en `~/.gcc-espacio/flujos/<proyecto>` y no en la carpeta del proyecto: esos repositorios son
 * de los clientes y se despliegan por su cuenta.
 *
 * La sesión escribe `borrador.json` y publica con `publicar-flujo.mjs`. Lo publicado solo se sustituye por algo
 * válido: una sesión detenida a medias no estropea el diagrama anterior.
 */
const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const REGLAS_FLUJO = path.join(AQUI, 'flujo-reglas.md');
export const CLI_FLUJO = path.join(AQUI, 'publicar-flujo.mjs');

export const carpetaFlujo = (datos, proyectoId) => path.join(datos, 'flujos', proyectoId);
const archivo = (carpeta, nombre) => path.join(carpeta, nombre);

const ID = /^[a-z0-9][a-z0-9-]{0,60}$/;
const SECRETO = /\bsk-[\w-]{16,}|\beyJ[\w-]{20,}|\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/\S+@|\bAKIA[0-9A-Z]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}/;
const MAX_ERRORES = 40;

/** Nada se dibuja si no está en el código: el `origen` tiene que existir de verdad. */
function errorDeOrigen(origen, raiz) {
  if (typeof origen !== 'string' || !origen.trim()) return 'le falta «origen» (archivo o archivo:línea).';
  const m = origen.match(/^(.+?)(?::(\d+))?$/);
  const relativo = m[1];
  if (path.isAbsolute(relativo)) return `«origen» debe ser relativo a la raíz: ${origen}`;
  const completo = path.resolve(raiz, relativo);
  if (completo !== raiz && !completo.startsWith(raiz + path.sep)) return `«origen» sale del proyecto: ${origen}`;
  let info;
  try { info = fs.statSync(completo); } catch { return `«origen» no existe: ${origen}`; }
  if (m[2]) {
    if (!info.isFile()) return `«origen» indica una línea, pero no es un archivo: ${origen}`;
    const lineas = fs.readFileSync(completo, 'utf8').split('\n').length;
    if (Number(m[2]) < 1 || Number(m[2]) > lineas) return `«origen» apunta a una línea que no existe (el archivo tiene ${lineas}): ${origen}`;
  }
  return null;
}

/** Devuelve lo que hay que corregir, en frases que la sesión pueda seguir. Vacío si es válido. */
export function validarFlujo(f, { raiz }) {
  const errores = [];
  const mal = (t) => errores.push(t);
  if (!f || typeof f !== 'object' || Array.isArray(f)) return ['El archivo debe ser un objeto JSON.'];
  if (f.version !== 1) mal('«version» debe ser 1.');
  if (typeof f.resumen !== 'string' || !f.resumen.trim() || f.resumen.length > LARGO.resumen) mal(`«resumen» es obligatorio, de hasta ${LARGO.resumen} caracteres.`);
  if (!Array.isArray(f.roles) || !f.roles.length) mal('«roles» debe tener al menos un rol.');
  if (!Array.isArray(f.nodos) || !f.nodos.length) mal('«nodos» debe tener al menos un nodo.');
  if (!Array.isArray(f.conexiones)) mal('«conexiones» debe ser una lista.');
  if (errores.length) return errores;
  if (f.nodos.length > LARGO.nodos) mal(`Hay ${f.nodos.length} nodos y el máximo es ${LARGO.nodos}: agrupa los que sean la misma acción.`);

  const roles = new Set();
  for (const r of f.roles) {
    if (!ID.test(r?.id ?? '')) { mal(`Rol con id inválido: ${JSON.stringify(r?.id)}. Usa minúsculas, números y guiones.`); continue; }
    if (roles.has(r.id)) mal(`Rol repetido: ${r.id}.`);
    roles.add(r.id);
    if (typeof r.nombre !== 'string' || !r.nombre.trim() || r.nombre.length > LARGO.rol) mal(`Rol ${r.id}: «nombre» es obligatorio, de hasta ${LARGO.rol} caracteres.`);
  }

  const nodos = new Map();
  for (const n of f.nodos) {
    if (!ID.test(n?.id ?? '')) { mal(`Nodo con id inválido: ${JSON.stringify(n?.id)}. Usa minúsculas, números y guiones.`); continue; }
    if (nodos.has(n.id)) { mal(`Nodo repetido: ${n.id}.`); continue; }
    nodos.set(n.id, n);
    if (!Object.hasOwn(TIPOS_NODO, n.tipo)) mal(`Nodo ${n.id}: tipo «${n.tipo}» no existe. Usa: ${Object.keys(TIPOS_NODO).join(', ')}.`);
    if (!roles.has(n.rol)) mal(`Nodo ${n.id}: el rol «${n.rol}» no está en «roles».`);
    const tope = n.tipo === 'decision' ? LARGO.tituloDecision : LARGO.titulo;
    if (typeof n.titulo !== 'string' || !n.titulo.trim() || n.titulo.length > tope) mal(`Nodo ${n.id}: «titulo» es obligatorio, de hasta ${tope} caracteres.`);
    if (typeof n.descripcion !== 'string' || !n.descripcion.trim() || n.descripcion.length > LARGO.descripcion) mal(`Nodo ${n.id}: «descripcion» es obligatoria, de hasta ${LARGO.descripcion} caracteres.`);
    const origen = errorDeOrigen(n.origen, raiz);
    if (origen) mal(`Nodo ${n.id}: ${origen}`);
  }

  const salidas = new Map();
  const entradas = new Map();
  const vistas = new Set();
  for (const [i, c] of f.conexiones.entries()) {
    const nombre = `Conexión ${i + 1} (${c?.de} → ${c?.a})`;
    if (!nodos.has(c?.de)) mal(`${nombre}: el origen no existe.`);
    if (!nodos.has(c?.a)) mal(`${nombre}: el destino no existe.`);
    if (!nodos.has(c?.de) || !nodos.has(c?.a)) continue;
    if (c.de === c.a) mal(`${nombre}: un nodo no se conecta consigo mismo.`);
    const clave = `${c.de}\u0000${c.a}`;
    if (vistas.has(clave)) mal(`${nombre}: repetida. Une las etiquetas en una sola.`);
    vistas.add(clave);
    const clase = c.clase ?? 'normal';
    if (!Object.hasOwn(CLASES_CONEXION, clase)) mal(`${nombre}: clase «${clase}» no existe. Usa: ${Object.keys(CLASES_CONEXION).join(', ')}.`);
    if ((clase === 'si' || clase === 'no') && nodos.get(c.de).tipo !== 'decision') mal(`${nombre}: «${clase}» solo sale de una decisión.`);
    if (c.etiqueta !== undefined && (typeof c.etiqueta !== 'string' || c.etiqueta.length > LARGO.etiqueta)) mal(`${nombre}: «etiqueta» de hasta ${LARGO.etiqueta} caracteres.`);
    salidas.set(c.de, [...(salidas.get(c.de) || []), c]);
    entradas.set(c.a, [...(entradas.get(c.a) || []), c]);
  }

  for (const r of roles) {
    const propios = [...nodos.values()].filter((n) => n.rol === r);
    if (!propios.length) mal(`El rol ${r} no tiene nodos: quítalo o complétalo.`);
    else if (!propios.some((n) => n.tipo === 'inicio')) mal(`El rol ${r} no tiene un nodo de tipo inicio.`);
  }

  for (const n of nodos.values()) {
    const fuera = salidas.get(n.id) || [];
    if (n.tipo === 'fin' && fuera.length) mal(`Nodo ${n.id}: un fin no tiene salidas.`);
    if (n.tipo === 'inicio' && entradas.get(n.id)?.length) mal(`Nodo ${n.id}: a un inicio no se llega desde otro nodo.`);
    if (n.tipo !== 'fin' && n.tipo !== 'dato' && !fuera.length) mal(`Nodo ${n.id}: no tiene salida. Conéctalo o termina el recorrido en un fin.`);
    if (n.tipo === 'decision') {
      if (fuera.length < 2) mal(`Nodo ${n.id}: una decisión necesita al menos dos salidas.`);
      if (fuera.some((c) => !c.etiqueta && c.clase !== 'si' && c.clase !== 'no')) mal(`Nodo ${n.id}: cada salida de una decisión lleva clase si/no o «etiqueta».`);
    }
    if (n.tipo === 'bucle') {
      if (!fuera.some((c) => c.clase === 'repite')) mal(`Nodo ${n.id}: un bucle necesita una salida de clase repite.`);
      if (!fuera.some((c) => c.clase !== 'repite')) mal(`Nodo ${n.id}: un bucle necesita una salida para terminar.`);
    }
  }

  // Un nodo al que no se llega es una acción que nadie puede ejecutar: o sobra, o falta una conexión.
  const alcanzados = new Set([...nodos.values()].filter((n) => n.tipo === 'inicio').map((n) => n.id));
  const pendientes = [...alcanzados];
  while (pendientes.length) {
    for (const c of salidas.get(pendientes.pop()) || []) {
      if (!alcanzados.has(c.a)) { alcanzados.add(c.a); pendientes.push(c.a); }
    }
  }
  for (const id of nodos.keys()) if (!alcanzados.has(id)) mal(`Nodo ${id}: no se llega a él desde ningún inicio.`);

  if (SECRETO.test(JSON.stringify(f))) mal('El diagrama contiene algo que parece una credencial. Quítala: aquí solo van nombres, nunca valores.');

  return errores.length > MAX_ERRORES ? [...errores.slice(0, MAX_ERRORES), `… y ${errores.length - MAX_ERRORES} más.`] : errores;
}

export function leerMeta(carpeta) {
  try { return JSON.parse(fs.readFileSync(archivo(carpeta, 'proyecto.json'), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

export function guardarMeta(carpeta, meta) {
  fs.mkdirSync(carpeta, { recursive: true, mode: 0o700 });
  fs.writeFileSync(archivo(carpeta, 'proyecto.json'), JSON.stringify(meta, null, 2), { mode: 0o600 });
}

/** Lo publicado, o null si aún no hay. Un archivo dañado es un error, no un «sin diagrama». */
export function leerFlujo(carpeta) {
  const ruta = archivo(carpeta, 'flujo.json');
  let texto;
  try { texto = fs.readFileSync(ruta, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  return { flujo: JSON.parse(texto), actualizado: fs.statSync(ruta).mtimeMs };
}

/** Valida el borrador y, solo si es correcto, lo convierte en lo publicado de una vez. */
export function publicarBorrador(carpeta) {
  const meta = leerMeta(carpeta);
  if (!meta?.ruta) return { errores: [`No encuentro el proyecto de ${carpeta}. Lanza el diagrama desde el Espacio de trabajo.`] };
  let datos;
  try { datos = JSON.parse(fs.readFileSync(archivo(carpeta, 'borrador.json'), 'utf8')); }
  catch (e) { return { errores: [e.code === 'ENOENT' ? `Falta ${archivo(carpeta, 'borrador.json')}.` : `borrador.json no es un JSON válido: ${e.message}`] }; }
  const errores = validarFlujo(datos, { raiz: meta.ruta });
  if (errores.length) return { errores };
  const tmp = archivo(carpeta, `flujo.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(datos), { mode: 0o600 });
  fs.renameSync(tmp, archivo(carpeta, 'flujo.json'));
  return { errores: [], roles: datos.roles.length, nodos: datos.nodos.length, conexiones: datos.conexiones.length };
}

/** La primera orden de la sesión. Las reglas van en un archivo: en la conversación no se leerían. */
export function ordenFlujo({ nombre, ruta, carpeta, hayPublicado, node = process.execPath }) {
  return [
    `Actualiza el diagrama de flujo del proyecto «${nombre}».`,
    '',
    `Primero lee ${REGLAS_FLUJO} y síguelo al pie de la letra.`,
    `- Raíz del proyecto: ${ruta}`,
    hayPublicado
      ? `- Diagrama publicado: ${archivo(carpeta, 'flujo.json')}. Actualízalo contra el código de hoy y conserva los id de lo que no cambió.`
      : '- Aún no hay diagrama publicado: este es el primero.',
    `- Escribe el borrador en: ${archivo(carpeta, 'borrador.json')}`,
    `- Valida y publica con: ${JSON.stringify(node)} ${JSON.stringify(CLI_FLUJO)} ${JSON.stringify(carpeta)}`,
    '- No crees, edites ni borres nada dentro del proyecto, y no hagas commit.',
  ].join('\n');
}
