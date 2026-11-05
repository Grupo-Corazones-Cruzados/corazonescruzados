/**
 * WHISPER LOCAL. El audio no sale de la Mac. `whisper-server` mantiene el modelo cargado: lanzar
 * `whisper-cli` por tramo gastaría hasta 2 s extra en cada uno. Arranca al activar y se apaga al desactivar.
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const PUERTO = Number(process.env.COPILOTO_PUERTO_WHISPER || 3794);
const MODELO = process.env.COPILOTO_MODELO || path.join(os.homedir(), '.cache/whisper-cpp/ggml-medium.bin');
const URL_SERVIDOR = `http://127.0.0.1:${PUERTO}`;
// Sin esto escribe «Gundramón» o «GCC» como «y C C». No es una orden: solo orienta el vocabulario.
const VOCABULARIO = 'GUMDRAMON. Grupo Corazones Cruzados, GCC World. Reunión de trabajo con un cliente.';

export function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export class Transcriptor {
  proceso = null;
  listo = null;
  cola = Promise.resolve();

  iniciar() {
    if (this.listo) return this.listo;
    this.proceso = spawn(process.env.COPILOTO_WHISPER || 'whisper-server', ['-m', MODELO, '-l', 'es', '--host', '127.0.0.1', '--port', String(PUERTO), '-t', '4'], { stdio: 'ignore' });
    const proceso = this.proceso;
    proceso.on('exit', () => { if (this.proceso === proceso) { this.proceso = null; this.listo = null; } });
    this.listo = (async () => {
      for (let i = 0; i < 240; i++) {
        if (!this.proceso) throw new Error('whisper-server no arrancó.');
        try { await fetch(URL_SERVIDOR, { signal: AbortSignal.timeout(500) }); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
      }
      throw new Error('whisper-server no respondió a tiempo.');
    })();
    return this.listo;
  }

  detener() {
    this.proceso?.kill();
    this.proceso = null;
    this.listo = null;
  }

  /** Uno a la vez: dos canales a la vez saturan la GPU y ninguno llega antes. */
  transcribir(pcm) {
    const trabajo = this.cola.then(() => this.#una(pcm));
    this.cola = trabajo.catch(() => {});
    return trabajo;
  }

  async #una(pcm) {
    await this.iniciar();
    const f = new FormData();
    f.append('file', new Blob([wav(pcm)], { type: 'audio/wav' }), 'tramo.wav');
    f.append('response_format', 'json');
    f.append('language', 'es');
    f.append('temperature', '0');
    f.append('prompt', VOCABULARIO);
    const r = await fetch(`${URL_SERVIDOR}/inference`, { method: 'POST', body: f, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`whisper-server respondió ${r.status}`);
    return String((await r.json()).text || '').trim();
  }
}
