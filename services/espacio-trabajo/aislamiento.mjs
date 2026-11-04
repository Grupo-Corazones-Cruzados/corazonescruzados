import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * EL LÍMITE DE CADA SESIÓN, impuesto por Claude Code y por el sistema; nunca como texto en el
 * prompt (así lo hacía el DigiMundo y por eso se metía en otros proyectos).
 *
 * Probado el 2026-11-04 con `bypassPermissions`:
 *   · Las herramientas de archivo las frena `blockReads/WritesOutsideWorkingDirectories`.
 *   · Bash y todo lo que lance lo frena el sandbox (Seatbelt).
 *   · ⚠️ `denyRead` NO puede incluir una carpeta PADRE del proyecto, aunque `allowRead` reabra el
 *     proyecto: git y npm dejan de poder leer su directorio actual. Por eso se deniegan las
 *     HERMANAS de cada nivel, y no la raíz de los clientes.
 *   · git push y gh sacan su credencial del Llavero: sin esos servicios Mach se quedan colgados.
 */
const HOME = os.homedir();

/** Carpetas donde viven los demás proyectos. */
export const RAICES_CLIENTES = [
  path.join(HOME, 'Documents/02_Clientes'),
  path.join(HOME, 'Library/CloudStorage/OneDrive-GCC/02_Clientes'),
  path.join(HOME, 'corazonescruzados'),
];

export const dentroDe = (ruta, carpeta) => ruta === carpeta || ruta.startsWith(carpeta + path.sep);

/** Lo que hay junto al camino de `raiz` a `cwd`, en cada nivel, sin el propio camino. */
export function hermanas(raiz, cwd, leer = (d) => fs.readdirSync(d)) {
  const salida = [];
  let actual = raiz;
  const tramos = path.relative(raiz, cwd).split(path.sep).filter(Boolean);
  for (const tramo of tramos) {
    let entradas = [];
    try { entradas = leer(actual); } catch { /* sin permiso o inexistente: nada que denegar aquí */ }
    for (const e of entradas) if (e !== tramo) salida.push(path.join(actual, e));
    actual = path.join(actual, tramo);
  }
  return salida;
}

/** Nombre de la carpeta de sesiones de Claude Code para un directorio de trabajo. */
export const carpetaSesiones = (cwd) => path.join(HOME, '.claude/projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));

/** Los adjuntos de un proyecto. Cada uno tiene la suya: un proyecto no ve los de otro. */
export const carpetaAdjuntos = (proyectoId, datos = path.join(HOME, '.gcc-espacio')) => path.join(datos, 'adjuntos', proyectoId);

export function ajustesDeSesion({ cwd, raizProyecto = cwd, proyectos = [], sandbox = true, leer, adjuntos = null, datos = path.join(HOME, '.gcc-espacio') }) {
  // El token, la contraseña y las variables de la copia local no son para las sesiones.
  const denegar = new Set([datos]);
  for (const raiz of RAICES_CLIENTES) {
    if (dentroDe(raizProyecto, raiz)) for (const h of hermanas(raiz, raizProyecto, leer)) denegar.add(h);
    else denegar.add(raiz);
  }
  // Abrir una carpeta madre (Motordesa) es pedir todo lo que cuelga de ella (Gestión de Ventas,
  // Marketplace…), aunque cada una esté registrada también por su cuenta. Fernando trabaja así el
  // cliente entero; denegarlas dejó a esa sesión sin el código que tenía que revisar (2026-11-04).
  // Al revés no: una sesión de Marketplace sigue sin ver a Gestión de Ventas.
  for (const p of proyectos) {
    if (dentroDe(p.ruta, raizProyecto) || dentroDe(raizProyecto, p.ruta)) continue;
    denegar.add(p.ruta);
  }
  const memoria = carpetaSesiones(raizProyecto);
  const memoriaCwd = carpetaSesiones(cwd);
  const ajustes = {
    permissions: {
      blockReadsOutsideWorkingDirectories: true,
      blockWritesOutsideWorkingDirectories: true,
      blockReadsExemptPaths: [path.join(HOME, '.claude/skills'), path.join(HOME, '.claude/plugins'), path.join(HOME, '.claude/CLAUDE.md'), memoria, memoriaCwd, ...(adjuntos ? [adjuntos] : [])],
    },
  };
  if (sandbox) {
    ajustes.sandbox = {
      enabled: true,
      failIfUnavailable: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      network: {
        allowedDomains: ['*'],
        allowLocalBinding: true,
        allowMachLookup: ['com.apple.SecurityServer', 'com.apple.securityd.xpc', 'com.apple.security.*', 'com.apple.trustd*', 'com.apple.ctkd*', 'com.apple.secd*'],
      },
      filesystem: {
        denyRead: [...denegar, path.join(HOME, '.claude/projects')],
        allowRead: [
          raizProyecto, memoria, memoriaCwd, ...(adjuntos ? [adjuntos] : []), path.join(HOME, 'Library/Keychains'), path.join(HOME, '.config/gh'),
          path.join(HOME, '.config/git'), path.join(HOME, '.gitconfig'), path.join(HOME, '.npm'), path.join(HOME, '.npmrc'),
          path.join(HOME, '.nvm'), path.join(HOME, '.local'), path.join(HOME, '.railway'),
        ],
        allowWrite: [
          memoria, memoriaCwd, path.join(HOME, 'Library/Keychains'), path.join(HOME, '.npm'),
          path.join(HOME, '.cache'), path.join(HOME, '.config/gh'), path.join(HOME, '.railway'),
        ],
      },
    };
  }
  return ajustes;
}

/** Sin esto se cobra por API: `.env.local` tiene la clave, y con ella presente Claude Code siempre la usa. */
export function entornoLimpio(entorno = process.env) {
  const limpio = { ...entorno };
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'ESPACIO_TRABAJO_LOCAL', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT']) delete limpio[k];
  return limpio;
}
