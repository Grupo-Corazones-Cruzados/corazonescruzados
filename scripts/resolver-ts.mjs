/**
 * Resolutor para correr módulos TypeScript del repo directamente con Node.
 *
 * Node exige la extensión en los import relativos; el código del repo la omite porque lo
 * resuelve el empaquetador. Este gancho la añade, y así las pruebas de colocación pueden
 * ejecutar **el mismo archivo** que usa la aplicación, sin copias ni adaptaciones — que es
 * justo lo que hace que la prueba valga.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(especificador)) {
    for (const ext of ['.ts', '.tsx', '.mjs', '.js']) {
      const url = new URL(especificador + ext, contexto.parentURL);
      if (existsSync(fileURLToPath(url))) return siguiente(especificador + ext, contexto);
    }
  }
  return siguiente(especificador, contexto);
}
