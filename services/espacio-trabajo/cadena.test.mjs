import test from 'node:test';
import assert from 'node:assert/strict';
import { expandirCadena, plegarCadena } from './cadena.mjs';

const N = ['memoria', 'aprendizaje', 'diseno'];

test('una sola skill o un mensaje normal no cambian', () => {
  assert.equal(expandirCadena('/memoria hola', N), '/memoria hola');
  assert.equal(expandirCadena('hola /memoria', N), 'hola /memoria');
  assert.equal(expandirCadena('/memoria /Users/x/archivo', N), '/memoria /Users/x/archivo');
  assert.equal(expandirCadena('/noexiste /memoria hola', N), '/noexiste /memoria hola');
});

test('las siguientes se piden en orden y conservan la petición', () => {
  const r = expandirCadena('/memoria /aprendizaje /diseno quiero esto', N);
  assert.match(r, /^\/memoria quiero esto\n\n/);
  assert.match(r, /aprendizaje, diseno\.\]$/);
});

test('en pantalla vuelve a verse lo que se escribió', () => {
  for (const t of ['/memoria /aprendizaje /diseno quiero esto', '/memoria /aprendizaje', '/memoria /aprendizaje varias\nlíneas']) {
    assert.equal(plegarCadena(expandirCadena(t, N)), t);
  }
  assert.equal(plegarCadena('texto normal'), 'texto normal');
});
