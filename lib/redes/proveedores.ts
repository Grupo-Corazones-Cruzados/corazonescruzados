/**
 * CÓMO SE AUTORIZA CADA RED (OAuth 2.0 con código). Uno por proveedor: Meta trae Facebook e Instagram juntos.
 *
 * Variables del servidor (solo nombres; los valores están en Railway y en la Mac):
 *   · YouTube  → GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET (el mismo cliente que «Conexiones»).
 *   · Meta     → META_APP_ID / META_APP_SECRET.
 *   · TikTok   → TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET.
 *   · LinkedIn → LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET.
 * La URI de retorno es `<origen>/api/redes/<proveedor>/callback` y hay que registrarla en cada consola.
 * Las direcciones base se pueden cambiar con variables (`*_BASE`) para probar contra un simulador.
 */
import type { Proveedor, RedTalento } from './talento';

const env = (k: string) => process.env[k] || '';
const GRAPH = () => env('META_GRAPH_BASE') || 'https://graph.facebook.com/v21.0';
const GOOGLE_API = () => env('YOUTUBE_API_BASE') || 'https://www.googleapis.com';
const GOOGLE_TOKEN = () => env('GOOGLE_TOKEN_URL') || 'https://oauth2.googleapis.com/token';
const TIKTOK_API = () => env('TIKTOK_API_BASE') || 'https://open.tiktokapis.com';
const LINKEDIN_API = () => env('LINKEDIN_API_BASE') || 'https://api.linkedin.com';
const LINKEDIN_OAUTH = () => env('LINKEDIN_OAUTH_BASE') || 'https://www.linkedin.com/oauth/v2';

export function configurado(p: Proveedor): boolean {
  if (p === 'youtube') return !!(env('GOOGLE_OAUTH_CLIENT_ID') && env('GOOGLE_OAUTH_CLIENT_SECRET'));
  if (p === 'meta') return !!(env('META_APP_ID') && env('META_APP_SECRET'));
  if (p === 'tiktok') return !!(env('TIKTOK_CLIENT_KEY') && env('TIKTOK_CLIENT_SECRET'));
  return !!(env('LINKEDIN_CLIENT_ID') && env('LINKEDIN_CLIENT_SECRET'));
}

/** Solo subir y publicar: nada de leer mensajes ni datos que no hacen falta. */
const PERMISOS: Record<Proveedor, string> = {
  youtube: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
  meta: 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management',
  tiktok: 'user.info.basic,video.upload,video.publish',
  linkedin: 'openid profile w_member_social',
};

export function urlAutorizacion(p: Proveedor, redirect: string, state: string): string {
  if (p === 'youtube') {
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: env('GOOGLE_OAUTH_CLIENT_ID'), redirect_uri: redirect, response_type: 'code', scope: PERMISOS.youtube,
      access_type: 'offline', prompt: 'select_account consent', state,
    })}`;
  }
  if (p === 'meta') {
    return `https://www.facebook.com/v21.0/dialog/oauth?${new URLSearchParams({
      client_id: env('META_APP_ID'), redirect_uri: redirect, response_type: 'code', scope: PERMISOS.meta, state,
    })}`;
  }
  if (p === 'tiktok') {
    return `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
      client_key: env('TIKTOK_CLIENT_KEY'), redirect_uri: redirect, response_type: 'code', scope: PERMISOS.tiktok, state,
    })}`;
  }
  return `${LINKEDIN_OAUTH()}/authorization?${new URLSearchParams({
    client_id: env('LINKEDIN_CLIENT_ID'), redirect_uri: redirect, response_type: 'code', scope: PERMISOS.linkedin, state,
  })}`;
}

/** Lo que se guarda tras autorizar: una cuenta por red (Meta puede dar dos). */
export interface CuentaAutorizada {
  red: RedTalento; externoId: string; nombre: string; url: string | null; token: Record<string, unknown>; extra?: Record<string, unknown>;
}

const json = async (r: Response) => {
  const t = await r.text();
  try { return JSON.parse(t); } catch { throw new Error(`Respuesta no válida (${r.status}).`); }
};
const form = (o: Record<string, string>) => ({
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o), cache: 'no-store' as const,
});

export async function canjear(p: Proveedor, code: string, redirect: string): Promise<CuentaAutorizada[]> {
  if (p === 'youtube') {
    const t = await json(await fetch(GOOGLE_TOKEN(), form({
      code, client_id: env('GOOGLE_OAUTH_CLIENT_ID'), client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'), grant_type: 'authorization_code', redirect_uri: redirect,
    })));
    if (!t.refresh_token) throw new Error(t.error_description || 'Google no entregó un permiso permanente.');
    const c = await json(await fetch(`${GOOGLE_API()}/youtube/v3/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${t.access_token}` }, cache: 'no-store' }));
    const canal = c.items?.[0];
    if (!canal) throw new Error(c.error?.message || 'Esa cuenta no tiene un canal de YouTube.');
    const handle = canal.snippet?.customUrl ? String(canal.snippet.customUrl) : '';
    return [{
      red: 'youtube', externoId: canal.id, nombre: canal.snippet.title,
      url: handle ? `https://www.youtube.com/${handle.startsWith('@') ? handle : `@${handle}`}` : `https://www.youtube.com/channel/${canal.id}`,
      token: { refresh: t.refresh_token },
    }];
  }

  if (p === 'meta') {
    const corto = await json(await fetch(`${GRAPH()}/oauth/access_token?${new URLSearchParams({
      client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), redirect_uri: redirect, code,
    })}`, { cache: 'no-store' }));
    if (!corto.access_token) throw new Error(corto.error?.message || 'Meta no entregó el permiso.');
    // El de usuario dura horas; el largo, 60 días; y el de PÁGINA sacado del largo no caduca.
    const largo = await json(await fetch(`${GRAPH()}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token', client_id: env('META_APP_ID'), client_secret: env('META_APP_SECRET'), fb_exchange_token: corto.access_token,
    })}`, { cache: 'no-store' }));
    const usuario = largo.access_token || corto.access_token;
    const pags = await json(await fetch(`${GRAPH()}/me/accounts?${new URLSearchParams({
      fields: 'id,name,link,access_token,instagram_business_account{id,username}', access_token: usuario,
    })}`, { cache: 'no-store' }));
    const lista: any[] = pags.data || [];
    if (!lista.length) throw new Error('Esa cuenta no administra ninguna página de Facebook.');
    // Una cuenta por red y talento: la página con Instagram enlazado, o la primera.
    const pag = lista.find((x) => x.instagram_business_account) || lista[0];
    const salida: CuentaAutorizada[] = [{
      red: 'facebook', externoId: pag.id, nombre: pag.name, url: pag.link || `https://www.facebook.com/${pag.id}`,
      token: { pagina: pag.access_token }, extra: { otras: lista.length - 1 },
    }];
    const ig = pag.instagram_business_account;
    if (ig?.id) {
      salida.push({
        red: 'instagram', externoId: ig.id, nombre: ig.username ? `@${ig.username}` : pag.name,
        url: ig.username ? `https://www.instagram.com/${ig.username}` : null, token: { pagina: pag.access_token }, extra: { pagina_id: pag.id },
      });
    }
    return salida;
  }

  if (p === 'tiktok') {
    const t = await json(await fetch(`${TIKTOK_API()}/v2/oauth/token/`, form({
      client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), code, grant_type: 'authorization_code', redirect_uri: redirect,
    })));
    if (!t.access_token) throw new Error(t.error_description || 'TikTok no entregó el permiso.');
    const u = await json(await fetch(`${TIKTOK_API()}/v2/user/info/?fields=open_id,display_name,username`, { headers: { Authorization: `Bearer ${t.access_token}` }, cache: 'no-store' }));
    const d = u.data?.user || {};
    return [{
      red: 'tiktok', externoId: t.open_id || d.open_id, nombre: d.username ? `@${d.username}` : d.display_name || 'TikTok',
      url: d.username ? `https://www.tiktok.com/@${d.username}` : null,
      token: { access: t.access_token, refresh: t.refresh_token, expira: Date.now() + (Number(t.expires_in) || 0) * 1000 },
    }];
  }

  const t = await json(await fetch(`${LINKEDIN_OAUTH()}/accessToken`, form({
    grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: env('LINKEDIN_CLIENT_ID'), client_secret: env('LINKEDIN_CLIENT_SECRET'),
  })));
  if (!t.access_token) throw new Error(t.error_description || 'LinkedIn no entregó el permiso.');
  const u = await json(await fetch(`${LINKEDIN_API()}/v2/userinfo`, { headers: { Authorization: `Bearer ${t.access_token}` }, cache: 'no-store' }));
  if (!u.sub) throw new Error('LinkedIn no dijo de quién es la cuenta.');
  return [{
    red: 'linkedin', externoId: u.sub, nombre: u.name || 'LinkedIn', url: null,
    token: { access: t.access_token, refresh: t.refresh_token || null, expira: Date.now() + (Number(t.expires_in) || 0) * 1000 },
  }];
}
