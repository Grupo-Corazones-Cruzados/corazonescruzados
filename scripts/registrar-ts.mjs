/** Engancha `resolver-ts.mjs` como resolutor de módulos. Se pasa con `node --import`. */
import { register } from 'node:module';
register('./resolver-ts.mjs', import.meta.url);
