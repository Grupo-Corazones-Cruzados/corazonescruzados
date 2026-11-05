/**
 * EL MOTOR DE LA REUNIÓN: audio → tramo → texto → ¿pregunta? → respuesta. No sabe nada de HTTP ni de
 * Whisper ni de Claude más allá de lo que recibe, así que se prueba con guiones de una reunión.
 *
 * Quién dijo qué sale de la entrada: el micrófono es Fernando y el audio del equipo es el cliente.
 * Solo el micrófono puede dar órdenes con la palabra clave.
 */
import { buscarClave, ordenaTerminar } from './palabra-clave.mjs';
import { esAlucinacion, esEco, parecePregunta } from './filtro.mjs';
import { Segmentador, energia } from './segmentador.mjs';

const FERNANDO = 'Fernando';
const CLIENTE = 'Cliente';
const ESPERA_CLAVE_MS = 8000; // «GUMDRAMON…» y la pregunta en el tramo siguiente
const ESPERA_ECO_MS = 2500;
const SUENA_MS = 3000;
const LARGO_SIN_PAUSA = 500; // si alguien habla sin parar, no se espera para siempre a que acabe

export class Motor {
  constructor({ transcriptor, agente, sesion, emitir, terminar, ahora = Date.now, esperar = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
    Object.assign(this, { transcriptor, agente, sesion, emitir, terminar, ahora, esperar });
    this.ultimaVozSistema = 0;
    this.activo = false;
    this.claveHasta = 0;
    this.previoMic = '';
    this.sinResponder = '';
    this.ocupado = false;
    this.nConsulta = 0;
    this.orden = { mic: Promise.resolve(), sistema: Promise.resolve() };
    this.segmentos = {
      mic: new Segmentador({ alCerrar: (a, seguir) => this.#tramo('mic', a, seguir) }),
      sistema: new Segmentador({ alCerrar: (a, seguir) => this.#tramo('sistema', a, seguir) }),
    };
  }

  activar() {
    if (this.activo) return;
    this.activo = true;
    this.sesion.abrir();
    this.transcriptor.iniciar().catch((e) => this.emitir('error', { mensaje: e.message }));
    Promise.resolve(this.agente.iniciar()).catch((e) => this.emitir('error', { mensaje: e.message }));
    this.emitir('estado', this.estado());
  }

  desactivar() {
    if (!this.activo) return;
    this.activo = false;
    this.segmentos.mic.cerrar();
    this.segmentos.sistema.cerrar();
    this.transcriptor.detener();
    this.agente.detener();
    this.emitir('estado', this.estado());
  }

  estado() {
    return { activo: this.activo, sesion: this.sesion.id, lineas: this.sesion.lineas.length };
  }

  audio(canal, pcm) {
    if (!this.activo || !this.segmentos[canal]) return;
    if (canal === 'sistema' && energia(pcm) > 0.006) this.ultimaVozSistema = this.ahora();
    this.segmentos[canal].agregar(pcm);
  }

  /**
   * Cada canal conserva su orden, pero uno no espera al otro: el micrófono se detiene a veces a mirar
   * si lo suyo es eco, y para eso necesita que el texto del equipo pueda seguir llegando.
   */
  #tramo(canal, audio, seguir) {
    const texto = this.transcriptor.transcribir(audio);
    this.orden[canal] = this.orden[canal].then(async () => {
      try { await this.texto(canal, await texto, { seguir }); }
      catch (e) { this.emitir('error', { mensaje: e.message }); }
    });
  }

  /** Lo que entra ya transcrito. */
  async texto(canal, texto, { seguir = false } = {}) {
    const limpio = String(texto || '').trim();
    if (esAlucinacion(limpio)) return;

    if (canal === 'mic') {
      // Con altavoces, el micrófono acaba antes que el equipo: su eco llegaba primero y se anotaba como
      // de Fernando. Solo se espera si de verdad está sonando algo; con audífonos, no se pierde tiempo.
      if (this.ahora() - this.ultimaVozSistema < SUENA_MS) await this.esperar(ESPERA_ECO_MS);
      const sistemaReciente = this.sesion.reciente(15, this.ahora()).filter((l) => l.quien === CLIENTE).map((l) => l.texto).join(' ');
      if (esEco(limpio, sistemaReciente)) return;
      await this.#deFernando(limpio);
      return;
    }
    this.#registrar(CLIENTE, limpio);
    this.sinResponder = `${this.sinResponder} ${limpio}`.trim().slice(-800);
    // A media frase todavía no se pregunta: gastaría una consulta con la pregunta incompleta.
    if (seguir && this.sinResponder.length < LARGO_SIN_PAUSA) return;
    if (parecePregunta(this.sinResponder)) this.#consultarAutomatico();
  }

  #registrar(quien, texto) {
    this.sesion.agregar(quien, texto, new Date(this.ahora()).toISOString());
    this.emitir('transcripcion', { quien, texto });
  }

  async #deFernando(texto) {
    // Una clave partida entre dos tramos se reconoce con el tramo anterior.
    const hallada = buscarClave(texto) || buscarClave(`${this.previoMic} ${texto}`);
    this.previoMic = texto;

    if (hallada) {
      this.previoMic = '';
      if (ordenaTerminar(hallada.resto)) { await this.terminar(); return; }
      this.#registrar(FERNANDO, texto);
      if (hallada.resto.length >= 4) this.#consultar(hallada.resto, 'pedido');
      else { this.claveHasta = this.ahora() + ESPERA_CLAVE_MS; this.emitir('escuchando', {}); }
      return;
    }

    this.#registrar(FERNANDO, texto);
    if (this.ahora() < this.claveHasta) {
      this.claveHasta = 0;
      if (ordenaTerminar(texto)) { await this.terminar(); return; }
      this.#consultar(texto, 'pedido');
    }
  }

  #consultarAutomatico() {
    if (this.ocupado) return; // al acabar se vuelve a mirar lo acumulado
    const texto = this.sinResponder;
    this.sinResponder = '';
    this.#consultar(texto, 'automático');
  }

  /** Lo que se pide por escrito en el widget va igual que con la palabra clave. */
  consultaEscrita(texto) {
    const t = String(texto || '').trim();
    if (t) this.#consultar(t, 'pedido');
  }

  async #consultar(foco, modo) {
    const id = ++this.nConsulta;
    const conversacion = this.sesion.reciente(45, this.ahora()).map((l) => `${l.quien}: ${l.texto}`).join('\n');
    const mensaje = `MODO ${modo}\n\nLo último de la reunión:\n"""\n${conversacion}\n"""\n\n${modo === 'pedido' ? 'Fernando te pide' : 'Lo nuevo que dijo el cliente'}:\n"""\n${foco}\n"""`;
    const pedido = modo === 'pedido';
    if (pedido) this.emitir('consulta', { id, pregunta: foco, modo });
    if (!pedido) this.ocupado = true;

    let acumulado = '';
    let anunciada = pedido;
    const inicio = this.ahora();
    try {
      const respuesta = await this.agente.preguntar(mensaje, {
        alTexto: (d) => {
          acumulado += d;
          // «NADA» no se enseña: hasta descartar que lo sea no se pinta ninguna letra.
          if (!pedido && !anunciada && !'NADA'.startsWith(acumulado.trim().slice(0, 4).toUpperCase()) && acumulado.trim()) {
            anunciada = true;
            this.emitir('consulta', { id, pregunta: foco, modo });
          }
          if (anunciada && !(acumulado.trim().toUpperCase() === 'NADA')) this.emitir('parcial', { id, texto: acumulado });
        },
        alBuscar: () => {
          if (!anunciada) { anunciada = true; this.emitir('consulta', { id, pregunta: foco, modo }); }
          this.emitir('buscando', { id });
        },
      });
      const final = respuesta.trim();
      if (!pedido && /^nada\W*$/i.test(final)) {
        if (anunciada) this.emitir('descartada', { id });
        this.emitir('sin_respuesta', { id, foco, ms: this.ahora() - inicio }); // el widget lo ignora; sirve para diagnosticar
      } else {
        if (!anunciada) this.emitir('consulta', { id, pregunta: foco, modo });
        this.emitir('respuesta', { id, texto: final, ms: this.ahora() - inicio });
      }
    } catch (e) {
      this.emitir('error', { id, mensaje: e.message });
    } finally {
      if (!pedido) {
        this.ocupado = false;
        if (parecePregunta(this.sinResponder)) this.#consultarAutomatico();
      }
    }
  }
}
