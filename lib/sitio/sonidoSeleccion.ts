/**
 * EL «CLIC DE SELECCIÓN» DE VIDEOJUEGO — al pulsar «Entrar a la Aventura» o «Ir a mi Progreso»
 * (Fernando, 2026-10-29: «que se sienta como un clic de una selección de un videojuego»).
 *
 * No es un archivo: se SINTETIZA con Web Audio. Así no pesa nada, no hay licencia de terceros y
 * se afina cambiando números. Es un «confirmar» retro: un golpe corto y tres notas que suben
 * (do–mi–sol, una octava alta) con onda cuadrada de 8 bits, filtrada para que no chille, y un eco
 * suave. Dura ~0,45 s, menos que el llenado del mundo.
 *
 * ⚠️ iOS solo deja sonar audio que nace de un gesto: se llama DENTRO del clic, y el contexto se
 * crea (o se reanuda) ahí mismo. Si el navegador no tiene Web Audio, no suena y no pasa nada.
 */

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!contexto) contexto = new Ctor();
  if (contexto.state === 'suspended') void contexto.resume();
  return contexto;
}

/** Volumen general del efecto (0–1). Por debajo del latido de fondo (0,45) a propósito. */
const VOLUMEN = 0.32;

export function sonarSeleccion() {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.005;

    // La salida: volumen general → filtro (quita el chillido de la onda cuadrada) → altavoz,
    // con un eco corto en paralelo.
    const salida = ctx.createGain();
    salida.gain.value = VOLUMEN;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 4200;
    salida.connect(filtro);
    filtro.connect(ctx.destination);
    const eco = ctx.createDelay();
    eco.delayTime.value = 0.09;
    const ecoGanancia = ctx.createGain();
    ecoGanancia.gain.value = 0.22;
    filtro.connect(eco);
    eco.connect(ecoGanancia);
    ecoGanancia.connect(ctx.destination);

    // 1. El «golpe» del botón: un pulso grave que cae muy rápido.
    const golpe = ctx.createOscillator();
    const golpeVol = ctx.createGain();
    golpe.type = 'triangle';
    golpe.frequency.setValueAtTime(320, t0);
    golpe.frequency.exponentialRampToValueAtTime(90, t0 + 0.08);
    golpeVol.gain.setValueAtTime(0.0001, t0);
    golpeVol.gain.exponentialRampToValueAtTime(0.9, t0 + 0.005);
    golpeVol.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    golpe.connect(golpeVol).connect(salida);
    golpe.start(t0);
    golpe.stop(t0 + 0.1);

    // 2. El arpegio de «confirmado»: do6 – mi6 – sol6, la última más larga.
    const notas = [1046.5, 1318.5, 1568.0];
    notas.forEach((f, i) => {
      const inicio = t0 + 0.035 + i * 0.065;
      const largo = i === notas.length - 1 ? 0.22 : 0.07;
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, inicio);
      vol.gain.setValueAtTime(0.0001, inicio);
      vol.gain.exponentialRampToValueAtTime(0.5, inicio + 0.006);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + largo);
      osc.connect(vol).connect(salida);
      osc.start(inicio);
      osc.stop(inicio + largo + 0.02);
    });
  } catch {
    // Sin audio no se rompe nada: el clic sigue funcionando en silencio.
  }
}

/**
 * EL SONIDO DE LA UNIÓN — cuando el corazón se posa sobre la Tierra en «el cruce del corazón»
 * (Fernando, 2026-10-29: «cuando el corazón da ese golpe… suene un sonido»).
 *
 * Un golpe grave como un latido (seno que cae de 150 a 50 Hz) y, encima, una campanita cálida
 * que brilla y se apaga (sol–si–re, dos octavas arriba, en seno, con un leve trémolo), más un eco.
 * Se PROGRAMA con el reloj de audio para que caiga justo en el contacto: `enSegundos` después de
 * llamarla (el contacto es el 62 % de `corazonCruza`, 1,9 s → ~1,2 s). Devuelve con qué cancelarlo
 * (si se pulsa «Volver» antes). Usa el contexto que abrió el clic del mundo (gesto válido en iOS).
 */
export function sonarUnion(enSegundos: number): () => void {
  const nodos: AudioScheduledSourceNode[] = [];
  try {
    const ctx = obtenerContexto();
    if (!ctx) return () => undefined;
    const t0 = ctx.currentTime + Math.max(0, enSegundos);

    const salida = ctx.createGain();
    salida.gain.value = 0.42;
    salida.connect(ctx.destination);
    const eco = ctx.createDelay();
    eco.delayTime.value = 0.14;
    const ecoGanancia = ctx.createGain();
    ecoGanancia.gain.value = 0.25;
    salida.connect(eco);
    eco.connect(ecoGanancia);
    ecoGanancia.connect(ctx.destination);

    // 1. El golpe: un latido grave.
    const golpe = ctx.createOscillator();
    const golpeVol = ctx.createGain();
    golpe.type = 'sine';
    golpe.frequency.setValueAtTime(150, t0);
    golpe.frequency.exponentialRampToValueAtTime(50, t0 + 0.22);
    golpeVol.gain.setValueAtTime(0.0001, t0);
    golpeVol.gain.exponentialRampToValueAtTime(1, t0 + 0.008);
    golpeVol.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    golpe.connect(golpeVol).connect(salida);
    golpe.start(t0);
    golpe.stop(t0 + 0.35);
    nodos.push(golpe);

    // 2. La campanita: tres notas casi a la vez (un acorde que se abre), largas y suaves.
    [1568.0, 1975.5, 2349.3].forEach((f, i) => {
      const inicio = t0 + 0.02 + i * 0.045;
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, inicio);
      // Un trémolo leve: la campana «vibra».
      const lfo = ctx.createOscillator();
      const lfoVol = ctx.createGain();
      lfo.frequency.value = 6;
      lfoVol.gain.value = f * 0.004;
      lfo.connect(lfoVol).connect(osc.frequency);
      vol.gain.setValueAtTime(0.0001, inicio);
      vol.gain.exponentialRampToValueAtTime(0.28, inicio + 0.012);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.9);
      osc.connect(vol).connect(salida);
      osc.start(inicio);
      lfo.start(inicio);
      osc.stop(inicio + 0.95);
      lfo.stop(inicio + 0.95);
      nodos.push(osc, lfo);
    });
  } catch {
    // Sin audio no se rompe nada.
  }
  return () => {
    nodos.forEach((n) => { try { n.stop(); } catch { /* ya parado */ } });
  };
}

/**
 * EL «VOLVER» — el cancelar de un menú de videojuego (Fernando, 2026-10-29: «y al darle al botón
 * de volver también un sonido»). La pareja del «confirmar»: el mismo timbre de 8 bits, pero dos
 * notas que BAJAN (sol6 → do6) y más suave. Suena con el botón «Volver» y con Escape.
 */
export function sonarVolver() {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.005;
    const salida = ctx.createGain();
    salida.gain.value = VOLUMEN * 0.8;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 3200;
    salida.connect(filtro);
    filtro.connect(ctx.destination);

    [1568.0, 1046.5].forEach((f, i) => {
      const inicio = t0 + i * 0.075;
      const largo = i === 0 ? 0.07 : 0.16;
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, inicio);
      // La segunda nota cae un poco al final: suena a «de vuelta».
      if (i === 1) osc.frequency.exponentialRampToValueAtTime(f * 0.94, inicio + largo);
      vol.gain.setValueAtTime(0.0001, inicio);
      vol.gain.exponentialRampToValueAtTime(0.45, inicio + 0.006);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + largo);
      osc.connect(vol).connect(salida);
      osc.start(inicio);
      osc.stop(inicio + largo + 0.02);
    });
  } catch {
    // Sin audio no se rompe nada.
  }
}

/**
 * ELEGIR UNA TARJETA DE ROL — Postulación, Candidato, Cliente o Miembro (Fernando, 2026-10-29).
 * Un «elegir objeto» de menú: dos notas rápidas que SUBEN una cuarta (mi6 → la6) con onda
 * triangular (más redonda que la cuadrada del «confirmar» de mundo) y un brillo corto encima.
 * Más ligero que entrar a un mundo, para que cada gesto tenga su sonido.
 */
export function sonarTarjeta() {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.005;
    const salida = ctx.createGain();
    salida.gain.value = VOLUMEN;
    salida.connect(ctx.destination);
    const eco = ctx.createDelay();
    eco.delayTime.value = 0.08;
    const ecoGanancia = ctx.createGain();
    ecoGanancia.gain.value = 0.18;
    salida.connect(eco);
    eco.connect(ecoGanancia);
    ecoGanancia.connect(ctx.destination);

    const voz = (tipo: OscillatorType, f: number, inicio: number, largo: number, pico: number) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(f, inicio);
      vol.gain.setValueAtTime(0.0001, inicio);
      vol.gain.exponentialRampToValueAtTime(pico, inicio + 0.006);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + largo);
      osc.connect(vol).connect(salida);
      osc.start(inicio);
      osc.stop(inicio + largo + 0.02);
    };
    voz('triangle', 1318.5, t0, 0.07, 0.7);
    voz('triangle', 1760.0, t0 + 0.06, 0.18, 0.7);
    voz('sine', 3520.0, t0 + 0.06, 0.12, 0.18); // el brillo
  } catch {
    // Sin audio no se rompe nada.
  }
}

/**
 * PASAR EL PUNTERO POR UNA TARJETA DE ROL — un «tic» de cursor de menú, muy suave (Fernando,
 * 2026-10-29: «un sonidito suave»). Una nota aguda cortísima en seno, bajita.
 *
 * ⚠️ Pasar el puntero NO es un gesto que autorice audio: solo suena si el contexto YA está
 * sonando (lo abrió el clic en el mundo). Nunca lo crea. Y no se repite más de una vez cada
 * 70 ms, para que barrer las tarjetas no haga ráfaga.
 */
let ultimoTic = 0;
export function sonarPasar() {
  try {
    if (!contexto || contexto.state !== 'running') return;
    const ahora = performance.now();
    if (ahora - ultimoTic < 70) return;
    ultimoTic = ahora;
    const ctx = contexto;
    const t0 = ctx.currentTime + 0.002;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2093, t0);
    osc.frequency.exponentialRampToValueAtTime(2349, t0 + 0.03);
    vol.gain.setValueAtTime(0.0001, t0);
    vol.gain.exponentialRampToValueAtTime(0.07, t0 + 0.004);
    vol.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    osc.connect(vol).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.06);
  } catch {
    // Sin audio no se rompe nada.
  }
}

/**
 * MARCAR «ENTENDIDO» EN LA POSTULACIÓN (Fernando, 2026-10-29: «que al aceptar… tenga un sonidito
 * también»). El «clic» de un interruptor: un golpecito seco y una nota corta que SUBE (sol5 → re6)
 * al encender; al apagar, una sola nota que baja, más bajita. Más discreto que elegir una tarjeta.
 */
export function sonarInterruptor(encendido: boolean) {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.005;
    const salida = ctx.createGain();
    salida.gain.value = VOLUMEN * (encendido ? 0.75 : 0.5);
    salida.connect(ctx.destination);

    // El golpecito del mecanismo: ruido muy corto filtrado.
    const largoRuido = 0.025;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * largoRuido), ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let k = 0; k < datos.length; k++) datos[k] = (Math.random() * 2 - 1) * (1 - k / datos.length);
    const ruido = ctx.createBufferSource();
    ruido.buffer = buffer;
    const pasoAlto = ctx.createBiquadFilter();
    pasoAlto.type = 'highpass';
    pasoAlto.frequency.value = 2500;
    const volRuido = ctx.createGain();
    volRuido.gain.value = 0.35;
    ruido.connect(pasoAlto).connect(volRuido).connect(salida);
    ruido.start(t0);

    const notas = encendido ? [783.99, 1174.66] : [987.77, 659.25];
    notas.forEach((f, i) => {
      if (!encendido && i === 0) return; // al apagar, solo la nota que baja
      const inicio = t0 + 0.012 + (encendido ? i * 0.055 : 0);
      const largo = i === notas.length - 1 ? 0.13 : 0.06;
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, inicio);
      vol.gain.setValueAtTime(0.0001, inicio);
      vol.gain.exponentialRampToValueAtTime(0.6, inicio + 0.005);
      vol.gain.exponentialRampToValueAtTime(0.0001, inicio + largo);
      osc.connect(vol).connect(salida);
      osc.start(inicio);
      osc.stop(inicio + largo + 0.02);
    });
  } catch {
    // Sin audio no se rompe nada.
  }
}
