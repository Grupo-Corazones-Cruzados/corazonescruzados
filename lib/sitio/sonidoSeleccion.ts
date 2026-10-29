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
