/**
 * CORTA EL AUDIO EN TRAMOS DE VOZ. Cortar cada 5 s a ciegas parte las palabras, incluida la clave. Un
 * tramo se cierra con una pausa, o a los 5 s si la persona sigue hablando. En ese caso se corta por el
 * punto más callado del último segundo, entre dos palabras, y lo que sobra abre el tramo siguiente: un
 * corte ciego en «sistema de reservas» hizo que Whisper entendiera «cilindro» (2026-11-05).
 *
 * Audio: PCM de 16 bits, 16 kHz, un canal.
 */
const HZ = 16000;
const BYTES_S = HZ * 2;
const CUADRO = Math.round(HZ * 0.03) * 2; // 30 ms
const SILENCIO_CIERRE_S = 0.7;
const MINIMO_S = 0.6;
const VENTANA_CORTE = Math.round(1 / 0.03); // cuadros del último segundo
const UMBRAL_MINIMO = 0.006;

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
  constructor({ maximoS = 5, alCerrar, alVoz = () => {} }) {
    this.alVoz = alVoz;
    this.maximo = Math.round(maximoS * BYTES_S);
    this.alCerrar = alCerrar;
    this.pendiente = Buffer.alloc(0);
    this.tramo = [];
    this.bytes = 0;
    this.bytesVoz = 0;
    this.silencio = 0;
    this.piso = UMBRAL_MINIMO / 3;
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
    const umbral = Math.max(UMBRAL_MINIMO, this.piso * 3);
    const voz = e > umbral;
    if (voz) this.alVoz();
    if (!voz) this.piso = this.piso * 0.98 + e * 0.02; // el ruido de fondo se aprende solo en lo que no es voz

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
      for (let i = this.tramo.length - 1; i >= Math.max(1, this.tramo.length - VENTANA_CORTE); i--) {
        if (this.energias[i] < menor) { menor = this.energias[i]; hasta = i; }
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
