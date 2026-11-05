/**
 * CORTA EL AUDIO EN TRAMOS DE VOZ. Cortar cada 5 s a ciegas parte las palabras, incluida la clave. Un
 * tramo se cierra con una pausa, o a los 10 s si la persona sigue hablando. En ese caso se corta por el
 * punto más callado del último segundo y medio, entre dos palabras, y lo que sobra abre el tramo siguiente: un
 * corte ciego en «sistema de reservas» hizo que Whisper entendiera «cilindro» (2026-11-05).
 *
 * Audio: PCM de 16 bits, 16 kHz, un canal.
 */
const MAXIMO_POR_DEFECTO = 10; // a 5 s partía frases: «sistema | tema de camiones» (2026-11-05)
const HZ = 16000;
const BYTES_S = HZ * 2;
const CUADRO = Math.round(HZ * 0.03) * 2; // 30 ms
const SILENCIO_CIERRE_S = 0.7;
const MINIMO_S = 0.25;
const VENTANA_CORTE = Math.round(1.5 / 0.03); // cuadros del último segundo y medio
const UMBRAL_MINIMO = 0.0015;
const VECES_SOBRE_EL_FONDO = 2.5;
const CUADROS_FONDO = Math.round(5 / 0.03); // el ruido de fondo se mide en los últimos 5 s
const SUAVIZADO_CORTE = 5; // 150 ms: un solo cuadro callado puede ser una consonante, no un hueco

export function energia(cuadro) {
  let suma = 0;
  const n = Math.floor(cuadro.length / 2);
  for (let i = 0; i < n; i++) {
    const v = cuadro.readInt16LE(i * 2) / 32768;
    suma += v * v;
  }
  return n ? Math.sqrt(suma / n) : 0;
}

export class Segmentador {
  constructor({ maximoS = MAXIMO_POR_DEFECTO, alCerrar, alVoz = () => {} }) {
    this.alVoz = alVoz;
    this.maximo = Math.round(maximoS * BYTES_S);
    this.alCerrar = alCerrar;
    this.pendiente = Buffer.alloc(0);
    this.tramo = [];
    this.bytes = 0;
    this.bytesVoz = 0;
    this.silencio = 0;
    this.fondo = [];
    this.energias = [];
    this.previo = Buffer.alloc(0); // lo de justo antes de la voz: si no, se pierde la primera sílaba
  }

  agregar(pcm) {
    this.pendiente = Buffer.concat([this.pendiente, pcm]);
    while (this.pendiente.length >= CUADRO) {
      const cuadro = this.pendiente.subarray(0, CUADRO);
      this.pendiente = this.pendiente.subarray(CUADRO);
      this.#cuadro(Buffer.from(cuadro));
    }
  }

  #cuadro(cuadro) {
    const e = energia(cuadro);
    // El fondo es lo más callado de los últimos segundos, no la media de lo que «no era voz»: con esa media, una voz
    // baja contaba como ruido, subía el umbral y se perdía aún más voz (Fernando, 2026-11-05: solo transcribía la
    // primera frase). El contador y la transcripción usan esta MISMA decisión: si te oye para esperar, te transcribe.
    this.fondo.push(e);
    if (this.fondo.length > CUADROS_FONDO) this.fondo.shift();
    const orden = [...this.fondo].sort((x, y) => x - y);
    const umbral = Math.max(UMBRAL_MINIMO, orden[Math.floor(orden.length * 0.2)] * VECES_SOBRE_EL_FONDO);
    const voz = e > umbral;
    if (voz) this.alVoz();

    if (!this.bytes) {
      if (!voz) {
        this.previo = Buffer.concat([this.previo, cuadro]).subarray(-Math.round(0.3 * BYTES_S));
        return;
      }
      this.tramo.push(this.previo);
      this.energias.push(0);
      this.bytes += this.previo.length;
      this.previo = Buffer.alloc(0);
    }

    this.tramo.push(cuadro);
    this.energias.push(e);
    this.bytes += cuadro.length;
    if (voz) { this.bytesVoz += cuadro.length; this.silencio = 0; } else this.silencio += 0.03;

    if (this.silencio >= SILENCIO_CIERRE_S) this.cerrar();
    else if (this.bytes >= this.maximo) this.cerrar(true);
  }

  /** `seguir` = la persona sigue hablando: el corte busca un hueco y el resto abre el tramo siguiente. */
  cerrar(seguir = false) {
    if (!this.bytes) return;
    let hasta = this.tramo.length;
    if (seguir) {
      let menor = Infinity;
      for (let i = this.tramo.length - 1; i >= Math.max(SUAVIZADO_CORTE, this.tramo.length - VENTANA_CORTE); i--) {
        let suma = 0;
        for (let k = 0; k < SUAVIZADO_CORTE; k++) suma += this.energias[i - k];
        if (suma < menor) { menor = suma; hasta = i - Math.floor(SUAVIZADO_CORTE / 2); }
      }
    }
    const audio = Buffer.concat(this.tramo.slice(0, hasta));
    const hayVoz = this.bytesVoz >= MINIMO_S * BYTES_S;
    const resto = this.tramo.slice(hasta);
    const energiasResto = this.energias.slice(hasta);
    this.tramo = resto;
    this.energias = energiasResto;
    this.bytes = resto.reduce((n, c) => n + c.length, 0);
    this.bytesVoz = energiasResto.filter((e) => e > UMBRAL_MINIMO).length * CUADRO;
    this.silencio = 0;
    if (hayVoz) this.alCerrar(audio, seguir);
  }
}
