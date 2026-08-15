/**
 * REDES SOCIALES — catálogo, normalización y validación. Módulo **puro**.
 *
 * ── QUÉ PROBLEMA RESUELVE ─────────────────────────────────────────────────────
 * Los campos de redes del perfil guardaban un texto libre («@lfgonzalezm0»), que
 * sirve para escribir un copy pero **no se puede pulsar**. Ahora guardan la URL del
 * perfil, y el CV público las pinta como botones que llevan a alguna parte.
 *
 * ── LAS TRES FORMAS EN QUE ALGUIEN ESCRIBE SU RED, Y LAS TRES VALEN ───────────
 * Nadie copia siempre la URL entera. Se aceptan las tres y se guarda **siempre**
 * una URL absoluta:
 *   · `https://www.linkedin.com/in/fulano`  → tal cual
 *   · `www.linkedin.com/in/fulano`          → se le antepone `https://`
 *   · `@fulano` o `fulano`                  → se compone con el perfil de esa red
 *
 * ⚠️ **Sin `https://` un enlace NO funciona.** `<a href="www.linkedin.com/in/x">` lo
 * lee el navegador como una **ruta relativa** y acaba en `…/cv/<token>/www.linkedin…`,
 * que es un 404. Es un fallo que se ve solo pulsando, no leyendo el código.
 *
 * ── POR QUÉ SE COMPRUEBA EL DOMINIO ───────────────────────────────────────────
 * Un enlace del CV se le enseña a un reclutador. Si en «Instagram» cabe cualquier
 * URL, el botón de Instagram puede acabar llevando a cualquier sitio. Se exige que
 * el host sea el de la red — con sus alias reales (`youtu.be`, `fb.com`…).
 */

export type Red = 'linkedin' | 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'web';

interface DefRed {
  etiqueta: string;
  /** Hosts admitidos, sin `www.`. Vacío = cualquiera (el caso de la web propia). */
  hosts: string[];
  /** Con qué se compone un `@usuario` suelto. `null` = no se puede componer. */
  perfil: string | null;
  ejemplo: string;
}

export const REDES: Record<Red, DefRed> = {
  linkedin: {
    etiqueta: 'LinkedIn',
    hosts: ['linkedin.com'],
    perfil: 'https://www.linkedin.com/in/',
    ejemplo: 'https://www.linkedin.com/in/tu-perfil',
  },
  youtube: {
    etiqueta: 'YouTube',
    hosts: ['youtube.com', 'youtu.be'],
    perfil: 'https://www.youtube.com/@',
    ejemplo: 'https://www.youtube.com/@tu-canal',
  },
  tiktok: {
    etiqueta: 'TikTok',
    hosts: ['tiktok.com'],
    perfil: 'https://www.tiktok.com/@',
    ejemplo: 'https://www.tiktok.com/@tu-usuario',
  },
  instagram: {
    etiqueta: 'Instagram',
    hosts: ['instagram.com'],
    perfil: 'https://www.instagram.com/',
    ejemplo: 'https://www.instagram.com/tu-usuario',
  },
  facebook: {
    etiqueta: 'Facebook',
    hosts: ['facebook.com', 'fb.com', 'fb.me'],
    perfil: 'https://www.facebook.com/',
    ejemplo: 'https://www.facebook.com/tu-pagina',
  },
  web: {
    etiqueta: 'Sitio web',
    hosts: [],
    perfil: null,
    ejemplo: 'https://tusitio.com',
  },
};

/** El orden en que se pintan los botones. LinkedIn primero: es la que mira un reclutador. */
export const ORDEN_REDES: Red[] = ['linkedin', 'web', 'youtube', 'instagram', 'tiktok', 'facebook'];

const sinWww = (host: string) => host.replace(/^www\./i, '').toLowerCase();

/** ¿El host pertenece a esa red? Acepta subdominios (`ec.linkedin.com`). */
function hostEncaja(host: string, def: DefRed): boolean {
  if (!def.hosts.length) return true;
  const h = sinWww(host);
  return def.hosts.some((d) => h === d || h.endsWith(`.${d}`));
}

export interface ResultadoRed {
  /** URL absoluta lista para un `href`, o `null` si el campo se dejó vacío. */
  url: string | null;
  /** Mensaje para la persona si lo escrito no sirve. `null` = todo bien. */
  error: string | null;
}

/**
 * Deja lo escrito en una URL de perfil utilizable, o explica por qué no puede.
 * Es la ÚNICA función que interpreta estos campos: la usan el formulario (para
 * avisar mientras se escribe) y el endpoint (para no guardar basura).
 */
export function normalizarRed(red: Red, bruto: unknown): ResultadoRed {
  const def = REDES[red];
  const txt = typeof bruto === 'string' ? bruto.trim() : '';
  if (!txt) return { url: null, error: null };

  // Un usuario suelto: `@fulano` o `fulano`. Solo si la red sabe componerlo y no
  // parece una dirección (sin puntos ni barras).
  if (!/[./]/.test(txt) || txt.startsWith('@')) {
    const usuario = txt.replace(/^@+/, '');
    if (!def.perfil) {
      return { url: null, error: `Escribe la dirección completa, por ejemplo ${def.ejemplo}` };
    }
    if (!/^[A-Za-z0-9._-]{2,60}$/.test(usuario)) {
      return { url: null, error: `Nombre de usuario no válido. Ejemplo: ${def.ejemplo}` };
    }
    return { url: def.perfil + usuario, error: null };
  }

  // Con pinta de dirección. Si no trae protocolo, se le pone: sin él, el navegador
  // lo trata como ruta relativa y el botón no lleva a ninguna parte.
  const conProtocolo = /^[a-z][a-z0-9+.-]*:\/\//i.test(txt) ? txt : `https://${txt}`;

  let u: URL;
  try {
    u = new URL(conProtocolo);
  } catch {
    return { url: null, error: `Dirección no válida. Ejemplo: ${def.ejemplo}` };
  }

  // Solo http(s): un `javascript:` en un enlace que se le enseña a un tercero es
  // exactamente lo que no puede pasar.
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { url: null, error: 'La dirección debe empezar por https://' };
  }
  if (!hostEncaja(u.hostname, def)) {
    return { url: null, error: `Esa dirección no es de ${def.etiqueta}. Ejemplo: ${def.ejemplo}` };
  }
  // `http://` se sube a `https://`: todas estas plataformas lo sirven y así el
  // navegador no avisa de sitio no seguro dentro de un currículum.
  if (u.protocol === 'http:') u.protocol = 'https:';

  return { url: u.toString(), error: null };
}

/** Cómo se enseña una URL cuando el botón ya dice de qué red es: sin ruido. */
export function textoCorto(url: string): string {
  try {
    const u = new URL(url);
    const camino = (u.pathname + u.search).replace(/\/$/, '');
    const limpio = `${sinWww(u.hostname)}${camino}`;
    return limpio.length > 42 ? `${limpio.slice(0, 41)}…` : limpio;
  } catch {
    return url;
  }
}
