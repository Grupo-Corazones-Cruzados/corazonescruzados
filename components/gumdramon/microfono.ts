import { cabeceras } from '@/components/espacio/api';

const SALIDA_HZ = 16000;
const CADA_MS = 500;

/** Baja a lo que espera el núcleo: 16 kHz, un canal, PCM de 16 bits. */
export function aPcm16(entrada: Float32Array, hz: number): Int16Array {
  const razon = hz / SALIDA_HZ;
  const salida = new Int16Array(Math.floor(entrada.length / razon));
  for (let i = 0; i < salida.length; i++) {
    const desde = Math.floor(i * razon);
    const hasta = Math.max(desde + 1, Math.floor((i + 1) * razon));
    let suma = 0;
    for (let k = desde; k < hasta && k < entrada.length; k++) suma += entrada[k];
    const v = Math.max(-1, Math.min(1, suma / (hasta - desde)));
    salida[i] = v < 0 ? v * 32768 : v * 32767;
  }
  return salida;
}

/**
 * EL MICRÓFONO DEL TELÉFONO, en tiempo real hacia la Mac. Con ScriptProcessor y no AudioWorklet porque
 * dentro de un marco de la app un Worklet necesita cargar un módulo aparte, y esto ya basta.
 * Se manda en orden: uno detrás de otro, para que un envío lento no desordene el audio.
 */
export async function abrirMicrofono(alNivel: (n: number) => void): Promise<{ cerrar: () => void; reanudar: () => void }> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('El micrófono necesita entrar por HTTPS.');
  const flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const Contexto = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new Contexto();
  await ctx.resume();
  const fuente = ctx.createMediaStreamSource(flujo);
  const proceso = ctx.createScriptProcessor(4096, 1, 1);
  const silencio = ctx.createGain();
  silencio.gain.value = 0;
  let pendiente: Int16Array[] = [];
  proceso.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    let suma = 0;
    for (let i = 0; i < d.length; i++) suma += d[i] * d[i];
    alNivel(Math.sqrt(suma / d.length));
    pendiente.push(aPcm16(d, ctx.sampleRate));
  };
  fuente.connect(proceso);
  proceso.connect(silencio);
  silencio.connect(ctx.destination);

  let enviando = false;
  const enviar = async () => {
    if (enviando || !pendiente.length) return;
    enviando = true;
    const trozos = pendiente;
    pendiente = [];
    const total = trozos.reduce((n, t) => n + t.length, 0);
    const todo = new Int16Array(total);
    let at = 0;
    for (const t of trozos) { todo.set(t, at); at += t.length; }
    try {
      await fetch('/api/copiloto/nucleo/audio?canal=mic&dispositivo=telefono', { method: 'POST', headers: cabeceras(), body: todo.buffer });
    } catch { /* la red volverá; ese trozo se pierde, no se atrasa todo lo que sigue */ }
    enviando = false;
  };
  const reloj = window.setInterval(enviar, CADA_MS);

  return {
    reanudar: () => { ctx.resume().catch(() => {}); },
    cerrar: () => {
      window.clearInterval(reloj);
      proceso.disconnect();
      fuente.disconnect();
      silencio.disconnect();
      flujo.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}
