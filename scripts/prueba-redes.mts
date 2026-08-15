import { normalizarRed, textoCorto } from '../lib/members/redes.ts';
let fallos = 0;
const p = (d: string, real: any, esperado: any) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? '✔' : '✖'} ${d}${ok ? '' : `\n    esperado ${JSON.stringify(esperado)}\n    fue      ${JSON.stringify(real)}`}`);
};
const u = (r: any, v: string) => normalizarRed(r, v).url;
const e = (r: any, v: string) => normalizarRed(r, v).error !== null;

p('vacío no es error', normalizarRed('linkedin', ''), { url: null, error: null });
p('URL completa se respeta', u('linkedin', 'https://www.linkedin.com/in/fulano'), 'https://www.linkedin.com/in/fulano');
p('sin protocolo se le pone https', u('linkedin', 'www.linkedin.com/in/fulano'), 'https://www.linkedin.com/in/fulano');
p('@usuario se compone', u('instagram', '@fulano'), 'https://www.instagram.com/fulano');
p('usuario suelto se compone', u('facebook', 'lfgonzalezm0'), 'https://www.facebook.com/lfgonzalezm0');
p('tiktok compone con @', u('tiktok', '@lfgonzalezm0'), 'https://www.tiktok.com/@lfgonzalezm0');
p('youtube compone con @', u('youtube', 'micanal'), 'https://www.youtube.com/@micanal');
p('http se sube a https', u('instagram', 'http://instagram.com/x'), 'https://instagram.com/x');
p('alias de youtube vale', u('youtube', 'https://youtu.be/abc'), 'https://youtu.be/abc');
p('subdominio vale', u('linkedin', 'https://ec.linkedin.com/in/x'), 'https://ec.linkedin.com/in/x');
p('dominio ajeno se rechaza', e('instagram', 'https://evil.com/x'), true);
p('javascript: se rechaza', e('web', 'javascript:alert(1)'), true);
p('la web propia acepta cualquier host', u('web', 'tusitio.com'), 'https://tusitio.com/');
p('la web NO compone un usuario suelto', e('web', 'fulano'), true);
p('usuario con caracteres raros se rechaza', e('instagram', '@fu lano!'), true);
p('texto corto sin www ni barra final', textoCorto('https://www.linkedin.com/in/fulano/'), 'linkedin.com/in/fulano');
console.log(fallos ? `\n❌ ${fallos} fallos` : '\n✅ todas pasan');
process.exit(fallos ? 1 : 0);
