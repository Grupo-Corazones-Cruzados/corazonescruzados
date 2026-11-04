/**
 * EL ÚLTIMO TEMA DEL PANEL USADO EN ESTE EQUIPO, antes de saber quién es.
 *
 * Lo leen dos pantallas que se ven sin cuenta resuelta: la de carga del panel (`CargaPanel`) y
 * el marco de las páginas públicas por enlace (`MarcoPublico`). Se aplica con un `<script>` en
 * línea mientras el navegador lee el HTML: sin él, el servidor pinta el claro y quien usa un
 * tema oscuro vería un fogonazo blanco. Después React coge el mismo valor con `leerUltimoTema`.
 *
 * `segunSistema`: si en este equipo nunca se abrió el panel (el cliente que llega por un enlace),
 * se sigue el modo claro/oscuro del sistema en vez de imponer el claro.
 */
import { TEMAS, TEMA_POR_DEFECTO, definicionTema, type TemaId } from '@/lib/temas';
import { LLAVE_ULTIMO_TEMA } from '@/components/providers/TemaPanel';

export const TEMAS_OSCUROS = TEMAS.filter((t) => t.base === 'oscuro').map((t) => t.id);
const IDS = TEMAS.map((t) => t.id);

export function leerUltimoTema(segunSistema = false): TemaId {
  try {
    const v = localStorage.getItem(LLAVE_ULTIMO_TEMA) ?? localStorage.getItem('gcc_dash_theme');
    if (v === 'dark') return 'oscuro';
    if (v === 'light') return 'claro';
    const t = definicionTema(v)?.id;
    if (t) return t;
    if (segunSistema && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'oscuro';
    return TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

/** Lo mismo que `leerUltimoTema`, para el `<script>` en línea (corre antes que React). */
export function scriptTema(segunSistema = false) {
  const sistema = segunSistema
    ? `if(!t&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='oscuro';`
    : '';
  return `(function(){try{var e=document.currentScript.parentElement,t=localStorage.getItem(${JSON.stringify(LLAVE_ULTIMO_TEMA)})||localStorage.getItem('gcc_dash_theme')||'';if(t==='dark')t='oscuro';if(t==='light')t='claro';if(${JSON.stringify(IDS)}.indexOf(t)<0)t='';${sistema}if(!t)t=${JSON.stringify(TEMA_POR_DEFECTO)};e.classList.remove('tema-${TEMA_POR_DEFECTO}');e.classList.add('tema-'+t);if(${JSON.stringify(TEMAS_OSCUROS)}.indexOf(t)>=0)e.classList.add('dark');}catch(_){}})();`;
}
