/**
 * LA TRANSCRIPCIÓN DE UNA REUNIÓN. Se escribe línea a línea en disco: si la Mac se reinicia a mitad de
 * reunión no se pierde. Al terminar se envía a Recordatorios, y solo con la confirmación se borra.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class Sesion {
  constructor(dir) {
    this.dir = path.join(dir, 'sesiones');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.ruta = path.join(this.dir, 'actual.jsonl');
    this.lineas = [];
    this.id = null;
    this.#reanudar();
  }

  #reanudar() {
    if (!fs.existsSync(this.ruta)) return;
    const filas = fs.readFileSync(this.ruta, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
    this.id = filas.find((f) => f.id)?.id || null;
    this.lineas = filas.filter((f) => f.texto);
  }

  abrir() {
    if (this.id) return;
    this.id = crypto.randomUUID();
    fs.writeFileSync(this.ruta, `${JSON.stringify({ id: this.id })}\n`, { mode: 0o600 });
    this.lineas = [];
  }

  agregar(quien, texto, hora = new Date().toISOString()) {
    this.abrir();
    const fila = { hora, quien, texto };
    this.lineas.push(fila);
    fs.appendFileSync(this.ruta, `${JSON.stringify(fila)}\n`);
  }

  /** Lo último, para darle contexto al agente. */
  reciente(segundos = 45, ahora = Date.now()) {
    return this.lineas.filter((l) => ahora - new Date(l.hora).getTime() <= segundos * 1000);
  }

  /** Cierra la actual y deja un archivo pendiente de enviar. Devuelve null si no se dijo nada. */
  cerrar() {
    if (!this.id) return null;
    const id = this.id;
    const vacia = !this.lineas.length;
    this.id = null;
    this.lineas = [];
    if (vacia) { fs.rmSync(this.ruta, { force: true }); return null; }
    const destino = path.join(this.dir, `pendiente-${id}.jsonl`);
    fs.renameSync(this.ruta, destino);
    return destino;
  }

  pendientes() {
    return fs.readdirSync(this.dir).filter((n) => n.startsWith('pendiente-')).map((n) => path.join(this.dir, n));
  }
}

const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });

export function textoDeTranscripcion(filas) {
  return filas.map((f) => `[${hhmm(f.hora)}] ${f.quien}: ${f.texto}`).join('\n');
}

export function leerPendiente(ruta) {
  const filas = fs.readFileSync(ruta, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const lineas = filas.filter((f) => f.texto);
  return {
    id: filas.find((f) => f.id)?.id,
    transcripcion: textoDeTranscripcion(lineas),
    inicio: lineas[0]?.hora,
    fin: lineas.at(-1)?.hora,
  };
}
