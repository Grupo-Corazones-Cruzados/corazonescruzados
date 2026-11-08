/**
 * LA SESIÓN DE CLAUDE CODE DE LA REUNIÓN. Es una sesión real del Espacio de trabajo (Fernando, 2026-11-05):
 * se ve en Admin ▸ Espacio de trabajo, en el proyecto Gumdramon, con su historial y sus subagentes, y se puede
 * seguir allí al terminar. El servicio del Espacio es su dueño; aquí solo se le escribe y se le escucha.
 *
 * ⚠️ Lo que entra lo puede haber dicho cualquiera en la reunión. Por eso va en `dontAsk` con la lista de
 * `.claude/settings.json` que escribe el instalador: investiga sin límite, pero solo lee y nunca se queda
 * esperando un permiso a mitad de una reunión.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ESPACIO = process.env.COPILOTO_ESPACIO || 'http://127.0.0.1:3791';
const TOKEN = process.env.COPILOTO_TOKEN_ESPACIO || path.join(os.homedir(), '.gcc-espacio/token');
export const CARPETA_SESION = () => process.env.COPILOTO_CARPETA_SESION || path.join(process.env.COPILOTO_DATOS || path.join(os.homedir(), '.gcc-copiloto'), 'sesion');

/** Lo que enseña el widget mientras investiga: qué mira, no solo que está ocupado. */
export function describirHerramienta(nombre, e = {}) {
  const base = (r) => path.basename(String(r || ''));
  if (nombre === 'Read') return `Leyendo ${base(e.file_path)}`;
  if (nombre === 'WebSearch') return `En la web: ${String(e.query || '').slice(0, 40)}`;
  if (nombre === 'Bash') {
    const c = String(e.command || '');
    if (/consultar-bd/.test(c)) return 'Consultando la base del negocio';
    const b = c.match(/buscar\.mjs\s+(\w+)\s+"?([^"]*)/);
    if (b) return b[1] === 'carpeta' ? 'Revisando carpetas' : `Buscando en los proyectos: ${b[2].slice(0, 40)}`;
    return 'Revisando';
  }
  if (nombre === 'Task' || nombre === 'Agent') return `Subagente: ${String(e.description || 'investigando').slice(0, 40)}`;
  return 'Investigando';
}

export class SesionClaude {
  constructor({ alSesion = () => {}, fetcher = fetch } = {}) {
    this.alSesion = alSesion;
    this.fetcher = fetcher;
    this.id = null;
    this.proyecto = null;
    this.turno = null;
    this.visto = 0;
    this.lector = null;
    this.cola = Promise.resolve();
  }

  async #api(ruta, cuerpo) {
    const r = await this.fetcher(`${ESPACIO}${ruta}`, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fs.readFileSync(TOKEN, 'utf8').trim()}` },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `El Espacio de trabajo respondió ${r.status}`);
    return j;
  }

  /** El proyecto Gumdramon del Espacio; se registra la primera vez. */
  async #proyecto() {
    if (this.proyecto) return this.proyecto;
    const ruta = fs.realpathSync(CARPETA_SESION());
    const { proyectos } = await this.#api('/proyectos');
    const hallado = proyectos.find((p) => p.ruta === ruta);
    this.proyecto = hallado || (await this.#api('/proyectos', { ruta, nombre: 'Gumdramon', grupo: 'Fernando González' })).proyecto;
    return this.proyecto;
  }

  /** La sesión nace con la primera pregunta real: activar y desactivar no deja sesiones vacías en el Espacio. */
  async #asegurar() {
    if (this.id) return;
    const p = await this.#proyecto();
    const { id } = await this.#api('/sesiones', { proyecto: p.id, modo: 'dontAsk' });
    this.id = id;
    this.titulada = false;
    this.visto = 0;
    this.alSesion({ id, proyecto: p.id });
  }

  /** El archivo de la sesión existe desde la primera respuesta: antes no hay qué titular. Solo una vez y solo en
   *  las sesiones nuevas: un nombre puesto por Fernando no se vuelve a tocar (Fernando, 2026-11-08). */
  #titular() {
    if (this.titulada || !this.proyecto) return;
    this.titulada = true;
    const hora = new Date().toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
    this.#api(`/sesiones/${this.id}/titulo`, { proyecto: this.proyecto.id, titulo: `Reunión ${hora}` }).catch(() => {});
  }

  async #escuchar(id) {
    const fin = new AbortController();
    this.lector = fin;
    try {
      const r = await this.fetcher(`${ESPACIO}/sesiones/${id}/eventos?desde=${this.visto}`, {
        headers: { Authorization: `Bearer ${fs.readFileSync(TOKEN, 'utf8').trim()}` }, signal: fin.signal,
      });
      if (!r.ok) throw new Error(`Sin eventos de la sesión (${r.status})`);
      let resto = '';
      const dec = new TextDecoder();
      for await (const trozo of r.body) {
        resto += dec.decode(trozo, { stream: true });
        let i;
        while ((i = resto.indexOf('\n\n')) >= 0) {
          const bloque = resto.slice(0, i);
          resto = resto.slice(i + 2);
          const dato = bloque.split('\n').find((l) => l.startsWith('data: '));
          if (dato) this.evento(JSON.parse(dato.slice(6)));
        }
      }
      throw new Error('La sesión de Claude se cerró.');
    } catch (e) {
      if (fin.signal.aborted) return;
      const t = this.turno;
      this.turno = null;
      this.lector = null;
      t?.mal(e);
    }
  }

  /** Público para probarlo sin red. */
  evento(e) {
    if (e.seq) this.visto = Math.max(this.visto, e.seq);
    const t = this.turno;
    if (e.tipo === 'solicitud') {
      // Con `dontAsk` no debería ocurrir; si ocurre, una reunión no puede quedarse esperando.
      this.#api(`/sesiones/${this.id}/responder`, { solicitudId: e.solicitudId, permitir: false, mensaje: 'Gumdramon solo lee: sigue sin esto.' }).catch(() => {});
      return;
    }
    if (!t) return;
    if (e.tipo === 'delta') {
      t.texto += e.texto;
      t.alTexto?.(t.texto);
    } else if (e.tipo === 'mensaje' && e.rol === 'assistant') {
      for (const b of e.bloques || []) {
        if (b.tipo === 'herramienta') {
          // Lo escrito antes de una herramienta es narración, no la respuesta.
          t.texto = '';
          t.ultimo = '';
          t.alBuscar?.(describirHerramienta(b.nombre, b.entrada));
        } else if (b.tipo === 'texto' && !e.padre) t.ultimo = b.texto;
      }
    } else if (e.tipo === 'fin') {
      this.turno = null;
      if (e.detenida) { const d = new Error('Detenida.'); d.detenida = true; t.mal(d); }
      else if (e.ok) { this.#titular(); t.ok(String(t.ultimo || t.texto || '').trim()); }
      else t.mal(new Error(e.error || 'Claude no pudo responder.'));
    } else if (e.tipo === 'error') {
      this.turno = null;
      t.mal(new Error(e.texto || 'Error de la sesión.'));
    } else if (e.tipo === 'estado' && e.estado === 'cerrada') {
      this.turno = null;
      t.mal(new Error('La sesión de Claude se cerró.'));
    }
  }

  /** Una pregunta detrás de otra. No hay plazo: investigar puede llevar minutos. */
  preguntar(texto, { alTexto, alBuscar } = {}) {
    const trabajo = this.cola.then(async () => {
      await this.#asegurar();
      // Si el Espacio la cerró por inactiva, al retomarla los eventos vuelven a contar desde cero.
      if (!this.lector) {
        const { vivas } = await this.#api('/vivas');
        if (!vivas.some((v) => v.id === this.id)) this.visto = 0;
      }
      return new Promise((ok, mal) => {
        this.turno = { ok, mal, alTexto, alBuscar, texto: '', ultimo: '' };
        this.#api(`/sesiones/${this.id}/enviar`, { texto, proyecto: this.proyecto.id })
          .then(() => { if (!this.lector) this.#escuchar(this.id); })
          .catch((e) => { this.turno = null; mal(e); });
      });
    });
    this.cola = trabajo.catch(() => {});
    return trabajo;
  }

  /** Corta lo que esté investigando: cada búsqueda de más gasta la suscripción de Fernando. */
  parar() {
    if (this.turno && this.id) this.#api(`/sesiones/${this.id}/detener`, {}).catch(() => {});
  }

  /** Deja de escuchar la sesión; se retoma con la siguiente pregunta. */
  detener() {
    this.lector?.abort();
    this.lector = null;
    const t = this.turno;
    this.turno = null;
    if (t) { const d = new Error('Detenida.'); d.detenida = true; t.mal(d); }
  }

  /** Las sesiones de Gumdramon, la más reciente primero. */
  async lista() {
    const p = await this.#proyecto();
    const { sesiones } = await this.#api(`/proyectos/${p.id}/sesiones`);
    return sesiones.map((x) => ({
      id: x.id, titulo: x.titulo, actualizada: x.actualizada, actual: x.id === this.id,
      trabajando: x.viva?.estado === 'trabajando',
    }));
  }

  /** El nombre queda fijo: el Espacio lo guarda aparte y manda sobre el resumen que Claude Code va escribiendo. */
  async renombrar(id, titulo) {
    const t = String(titulo || '').trim().slice(0, 200);
    if (!t) throw new Error('Escribe un nombre.');
    const p = await this.#proyecto();
    await this.#api(`/sesiones/${id}/titulo`, { proyecto: p.id, titulo: t });
    if (id === this.id) this.titulada = true;
  }

  /** A la papelera del Espacio (30 días). Si es la de ahora, la siguiente pregunta abre otra. */
  async eliminar(id) {
    if (id === this.id && this.turno) throw new Error('Está respondiendo. Deténla antes de eliminarla.');
    const p = await this.#proyecto();
    await this.#api(`/sesiones/${id}/eliminar`, { proyecto: p.id });
    if (id === this.id) this.olvidar();
  }

  /** Lo preguntado y lo respondido, sin el contexto de la reunión que va en cada mensaje. */
  async historial(id) {
    const p = await this.#proyecto();
    const r = await this.#api(`/sesiones/${id}/mensajes?proyecto=${encodeURIComponent(p.id)}`);
    return { pares: paresDeMensajes(r.mensajes || []), ultimoSeq: r.ultimoSeq || 0 };
  }

  /** Las siguientes preguntas van a esta sesión, con todo lo que ya sabe. */
  async retomar(id) {
    if (this.turno) throw new Error('Espera a que termine la respuesta en curso.');
    const p = await this.#proyecto();
    const h = await this.historial(id);
    this.detener();
    this.id = id;
    this.titulada = true;
    // Si sigue viva en el Espacio, sus eventos viejos no deben contestar la próxima pregunta.
    this.visto = h.ultimoSeq;
    this.alSesion({ id, proyecto: p.id });
    return h.pares;
  }

  /** La reunión terminó: la siguiente pregunta abre otra sesión. */
  olvidar() {
    this.detener();
    this.id = null;
  }
}

const textoDe = (m) => (m.bloques || []).filter((b) => b.tipo === 'texto').map((b) => b.texto).join('\n').trim();

/** Empareja cada pregunta con su respuesta final; vacía si Claude no llegó a responder. Público para probarlo. */
export function paresDeMensajes(mensajes) {
  const pares = [];
  for (const m of mensajes) {
    // Lo escrito antes de una herramienta es narración, no la respuesta (igual que en directo).
    if (m.rol === 'assistant' && pares.length && (m.bloques || []).some((b) => b.tipo === 'herramienta')) { pares.at(-1).respuesta = ''; continue; }
    const t = textoDe(m);
    if (!t) continue;
    if (m.rol === 'user') {
      const q = t.match(/(?:El cliente pregunta|Fernando te pide):\s*([\s\S]*)$/);
      pares.push({ pregunta: (q ? q[1] : t).trim(), respuesta: '' });
    } else if (m.rol === 'assistant' && pares.length) {
      pares.at(-1).respuesta = t;
    }
  }
  return pares.filter((x) => x.pregunta);
}
