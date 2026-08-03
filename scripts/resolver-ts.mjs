/**
 * Resolutor para correr módulos TypeScript del repo directamente con Node.
 *
 * Node exige la extensión en los import relativos; el código del repo la omite porque lo
 * resuelve el empaquetador. Este gancho la añade, y así las pruebas de colocación pueden
 * ejecutar **el mismo archivo** que usa la aplicación, sin copias ni adaptaciones — que es
 * justo lo que hace que la prueba valga.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(especificador, contexto, siguiente) {
  // `@/loquesea` → la raíz del repo. Es el alias de `tsconfig.json`, que lo entiende el
  // empaquetador y no Node. Sin esto, en cuanto un módulo del repo importa a otro con `@/`
  // la prueba muere — y son casi todos.
  if (especificador.startsWith('@/')) {
    const base = path.join(RAIZ, especificador.slice(2));
    for (const cand of ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts']) {
      if (cand && existsSync(base + cand)) return siguiente(pathToFileURL(base + cand).href, contexto);
    }
    return siguiente(pathToFileURL(base).href, contexto);
  }

  if (especificador.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(especificador)) {
    for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
      const url = new URL(especificador + ext, contexto.parentURL);
      if (existsSync(fileURLToPath(url))) return siguiente(especificador + ext, contexto);
    }
  }
  return siguiente(especificador, contexto);
}
