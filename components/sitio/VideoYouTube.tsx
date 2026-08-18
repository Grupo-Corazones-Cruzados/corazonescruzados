/**
 * EL VÍDEO DE UNA PÁGINA DE `/clientes`.
 *
 * ── ACEPTA LA URL TAL CUAL SE COPIA DEL NAVEGADOR ──────────────────────────────
 * `youtube.com/watch?v=…`, `youtu.be/…`, `/embed/…` o `/shorts/…`. Nadie debería tener que
 * saber qué es un «identificador de vídeo» para poner uno: se pega la dirección y ya.
 *
 * ── CARGA DIFERIDA, Y NO ES UN DETALLE ─────────────────────────────────────────
 * `loading="lazy"`: el reproductor de YouTube trae varios cientos de kilobytes y scripts de
 * terceros. Cargarlo de entrada penalizaría la velocidad de la página —que es un factor de
 * posicionamiento— por un vídeo que quizá nadie reproduzca. Se carga cuando se acerca a la
 * pantalla.
 *
 * `youtube-nocookie.com`: no deja rastro de seguimiento en quien solo pasa por la página.
 * Coherente con lo que decimos en las páginas legales sobre tratamiento de datos.
 *
 * Server Component: no lleva estado.
 */

/** Saca el identificador de las formas en que YouTube reparte una dirección. */
export function idDeYouTube(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      if (m) return m[1];
    }
    return null;
  } catch {
    // Una dirección mal escrita no debe tumbar la página entera: se trata como «sin vídeo».
    return null;
  }
}

export default function VideoYouTube({ url, titulo }: { url?: string; titulo: string }) {
  const id = url ? idDeYouTube(url) : null;
  if (!id) return null;

  return (
    // `aspect-video` mantiene la proporción 16:9 sin trucos de relleno, y reserva el hueco
    // antes de que cargue nada: así la página no da el salto que Google penaliza.
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-[var(--linea)] bg-[#1c1b22]">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={titulo}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}
