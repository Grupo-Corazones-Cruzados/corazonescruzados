/**
 * Pruebas de la deducción del tipo de identificación (`lib/pagos/identificacion.ts`).
 *
 * Lo que se comprueba no es que «devuelva algo», sino que **un número mal escrito se pare
 * aquí y no en el SRI**: un comprobante rechazado después de haber cobrado es un problema
 * mucho más caro que un mensaje en el formulario.
 *
 *   npm run pagos:prueba-id
 */
import { deducirIdentificacion, cedulaValida, errorRazonSocial } from '../lib/pagos/identificacion.ts';

let fallos = 0;
const p = (d: string, real: any, esperado: any) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? '✔' : '✖'} ${d}${ok ? '' : `\n    esperado ${JSON.stringify(esperado)}\n    fue      ${JSON.stringify(real)}`}`);
};
const tipo = (pais: string, num: string) => {
  const r = deducirIdentificacion(pais, num);
  return r.ok ? r.valor.idType : `error`;
};

// ── La regla de Fernando ────────────────────────────────────────────────────
p('Ecuador + termina en 001 → RUC', tipo('Ecuador', '1793203098001'), '04');
p('Ecuador + 10 dígitos → cédula', tipo('Ecuador', '0930095922'), '05');
p('otro país → identificación del exterior', tipo('Costa Rica', '3-101-619800'), '08');
p('España con letra también vale fuera', tipo('España', 'B12345678'), '08');

// ── Lo que la regla sola dejaría pasar, y aquí se para ──────────────────────
// Sin comprobar longitud, «1001» pasaría por RUC y el SRI rechazaría el comprobante
// DESPUÉS de haber cobrado. Ese es el fallo caro que estas dos pruebas evitan.
p('«1001» NO es un RUC', tipo('Ecuador', '1001'), 'error');
p('9 dígitos no son cédula', tipo('Ecuador', '093009592'), 'error');
p('13 dígitos que no acaban en 001 tampoco cuelan', tipo('Ecuador', '1793203098999'), 'error');
p('letras en un número ecuatoriano se rechazan', tipo('Ecuador', '09300959AB'), 'error');

// ── El SRI autoriza números falsos: se paran aquí ────────────────────────────
p('cédula con dígito verificador malo', tipo('Ecuador', '2018923849'), 'error');
p('cédula de una provincia que no existe', tipo('Ecuador', '9930095922'), 'error');
p('RUC de persona natural con cédula mala', tipo('Ecuador', '2018923849001'), 'error');
p('RUC que no existe en el catastro del SRI', tipo('Ecuador', '0916737222001'), 'error');
p('RUC de sociedad (tercer dígito 9) no se juzga por la cédula', tipo('Ecuador', '1790986640001'), '04');
p('cédulas reales de clientes valen',
  ['0930095922', '1721239158', '0917757817'].every(cedulaValida), true);
p('un correo no es razón social', errorRazonSocial('dcastillowork@outlook.com') !== null, true);
p('un nombre sí', errorRazonSocial('PETER TOURS S.A.'), null);

// ── Vacíos ──────────────────────────────────────────────────────────────────
p('sin país no se deduce nada', tipo('', '0930095922'), 'error');
p('sin número tampoco', tipo('Ecuador', ''), 'error');
p('fuera: menos de 3 caracteres se rechaza', tipo('Perú', 'ab'), 'error');
p('fuera: más de 20 se rechaza', tipo('Perú', 'x'.repeat(21)), 'error');

// ── Los mensajes tienen que servirle a quien los lee ────────────────────────
const msg = (pais: string, num: string) => {
  const r = deducirIdentificacion(pais, num);
  return r.ok ? null : r.error;
};
p('el error de un RUC corto explica el formato', /13 dígitos/.test(msg('Ecuador', '1001') || ''), true);
p('el error de una cédula corta menciona las dos opciones',
  /cédula tiene 10/.test(msg('Ecuador', '12345') || '') && /RUC, 13/.test(msg('Ecuador', '12345') || ''), true);

// ── Consumidor final ya no se emite por aquí ────────────────────────────────
p('ningún camino devuelve el 07',
  ['Ecuador', 'Costa Rica', 'España'].every(x => tipo(x, '9999999999999') !== '07'), true);

console.log(fallos ? `\n❌ ${fallos} fallos` : '\n✅ todas pasan');
process.exit(fallos ? 1 : 0);
