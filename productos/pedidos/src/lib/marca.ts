/**
 * La marca del inquilino, convertida en tokens de color.
 *
 * El cliente elige UN color; de ahí salen el de pulsación, el fondo tenue de los
 * estados activos y el color del texto que va encima. Pedirle cuatro colores sería
 * pedirle que haga de diseñador, y elegir mal el texto de encima es lo que deja un
 * botón ilegible.
 */

export const ACENTO_GCC = '#4B2D8E';

type RGB = { r: number; g: number; b: number };

function aRgb(hex: string): RGB | null {
  const h = hex.trim().replace('#', '');
  const c = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return null;
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

const aHex = ({ r, g, b }: RGB) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

const mezclar = (a: RGB, b: RGB, peso: number): RGB => ({
  r: a.r + (b.r - a.r) * peso,
  g: a.g + (b.g - a.g) * peso,
  b: a.b + (b.b - a.b) * peso,
});

/**
 * Luminancia relativa (WCAG). Es lo que decide si encima del acento va texto
 * blanco o negro: un amarillo de marca con letras blancas no se lee.
 */
function luminancia({ r, g, b }: RGB) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const contraste = (a: RGB, b: RGB) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export function esHexValido(hex: string) {
  return aRgb(hex) !== null;
}

export type TokensMarca = Record<string, string>;

/**
 * Los neutros del tema, en valores literales. Hacen falta fuera de las variables
 * CSS porque el <body> es ANCESTRO del contenedor que las lleva: sin esto, con el
 * tema oscuro el papel de debajo se queda blanco y asoma al rebotar el scroll.
 */
export const neutrosDeTema = (oscuro: boolean) =>
  oscuro
    ? { fondo: '#1b1a19', texto: '#f3f2f1', esquema: 'dark' as const }
    : { fondo: '#faf9f8', texto: '#242424', esquema: 'light' as const };

/**
 * Devuelve las variables CSS que se inyectan en el contenedor de la aplicación.
 * Son las MISMAS que declara globals.css: aquí solo se sustituyen sus valores, así
 * que un componente no necesita saber si hay marca propia o no.
 */
export function tokensDeMarca(colorAcento: string, oscuro: boolean): TokensMarca {
  const base = aRgb(colorAcento) || aRgb(ACENTO_GCC)!;
  const blanco: RGB = { r: 255, g: 255, b: 255 };
  const negro: RGB = { r: 0, g: 0, b: 0 };

  // Pulsado: el mismo color un 22 % más oscuro (y más claro si el tema es oscuro y
  // el color ya es muy oscuro, o el botón desaparecería al pulsarlo).
  const fuerte = luminancia(base) < 0.08 && oscuro
    ? mezclar(base, blanco, 0.22)
    : mezclar(base, negro, 0.22);

  // Fondo del estado activo: una insinuación del acento sobre la superficie.
  const suave = oscuro ? mezclar(base, { r: 37, g: 36, b: 35 }, 0.82) : mezclar(base, blanco, 0.9);

  // Texto encima del acento: el que más contraste dé, no el que se suponga.
  const encima = contraste(base, blanco) >= contraste(base, negro) ? blanco : negro;

  return {
    '--color-acento': aHex(base),
    '--color-acento-fuerte': aHex(fuerte),
    '--color-acento-suave': aHex(suave),
    '--color-acento-contraste': aHex(encima),
  };
}
