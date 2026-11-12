// App Store Connect API con la clave de Fernando (2026-11-12). La clave y sus IDs viven FUERA del repositorio, en
// ~/.appstoreconnect/config.json y ~/.appstoreconnect/private_keys/. Uso:
//   node scripts/asc.mjs GET /v1/apps            (ASC_JSON=1 para el JSON completo, sin recortar)
//   node scripts/asc.mjs POST /v1/bundleIds '<json>'
import { readFileSync } from 'node:fs';
import { SignJWT, importPKCS8 } from 'jose';
const c = JSON.parse(readFileSync(`${process.env.HOME}/.appstoreconnect/config.json`, 'utf8'));
const key = await importPKCS8(readFileSync(c.keyPath, 'utf8'), 'ES256');
const t = await new SignJWT({ aud: 'appstoreconnect-v1' }).setProtectedHeader({ alg: 'ES256', kid: c.keyId, typ: 'JWT' })
  .setIssuer(c.issuerId).setIssuedAt().setExpirationTime('15m').sign(key);
const [ , , metodo = 'GET', ruta, cuerpo] = process.argv;
const r = await fetch(`https://api.appstoreconnect.apple.com${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: cuerpo });
const texto = await r.text();
if (process.env.ASC_JSON) process.stdout.write(texto); else console.log(r.status, texto.slice(0, 3000));
