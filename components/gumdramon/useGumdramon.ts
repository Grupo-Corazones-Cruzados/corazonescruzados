'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cabeceras, guardarToken } from '@/components/espacio/api';
import { abrirMicrofono } from './microfono';

const API = '/api/copiloto/nucleo';
const TONO_VOZ = 1.55;

export type Consulta = { id: number; pregunta: string; respuesta: string; buscando: boolean; detalle?: string; terminada: boolean };
export type Linea = { quien: string; texto: string };
export type Dictado = { texto: string; restante: number | null; total: number };
export type SesionGum = { id: string; titulo: string; actualizada: number; actual: boolean; trabajando: boolean };

function hablar(texto: string) {
  if (!('speechSynthesis' in window)) return;
  const limpio = texto.replace(/[*_`#>]/g, '').replace(/\$\s*([0-9.,]+)/g, '$1 dólares').replace(/([0-9.,]+)\s*\$/g, '$1 dólares').replace(/\/mes/g, ' al mes').trim();
  window.speechSynthesis.cancel();
  if (!limpio) return;
  const u = new SpeechSynthesisUtterance(limpio);
  const voces = window.speechSynthesis.getVoices();
  u.voice = voces.find((v) => v.lang === 'es-MX' && /paulina/i.test(v.name)) || voces.find((v) => v.lang.startsWith('es-MX')) || voces.find((v) => v.lang.startsWith('es')) || null;
  u.lang = u.voice?.lang || 'es-MX';
  u.pitch = TONO_VOZ;
  window.speechSynthesis.speak(u);
}

const sinSesion = () => { guardarToken(null); window.dispatchEvent(new Event('espacio-sin-sesion')); };

/**
 * TODO GUMDRAMON EN EL TELÉFONO, SIN PINTAR NADA. Va por Tailscale a la Mac, que transcribe y consulta; aquí
 * se escucha el micrófono, se reciben los eventos del núcleo, se lee en voz alta y se manejan las sesiones.
 * Un solo micrófono: para el núcleo todo lo que oye es de Fernando, así que se pregunta con «GUMDRAMON».
 */
export function useGumdramon() {
  const [activo, setActivo] = useState(false);
  const [dispositivo, setDispositivo] = useState('mac');
  const [conectado, setConectado] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [dictado, setDictado] = useState<Dictado | null>(null);
  const [aviso, setAviso] = useState('');
  const [nota, setNota] = useState('');
  const [nivel, setNivel] = useState(0);
  const [voz, setVoz] = useState(false);
  const [sesiones, setSesiones] = useState<SesionGum[] | null>(null);
  const vozRef = useRef(false);
  const mic = useRef<Awaited<ReturnType<typeof abrirMicrofono>> | null>(null);
  const pantalla = useRef<any>(null);

  useEffect(() => {
    const v = localStorage.getItem('gumdramon_voz') === '1';
    setVoz(v); vozRef.current = v;
  }, []);

  const pedir = useCallback(async (ruta: string, metodo: 'GET' | 'POST' = 'POST', cuerpo?: unknown) => {
    const r = await fetch(`${API}/${ruta}`, {
      method: metodo, headers: cabeceras({ 'Content-Type': 'application/json' }),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) sinSesion();
    if (!r.ok) throw new Error(j.error || `La Mac respondió ${r.status}`);
    return j;
  }, []);

  const cargarSesiones = useCallback(async () => {
    try { setSesiones((await pedir('sesiones', 'GET')).sesiones || []); } catch (e: any) { setAviso(e.message); }
  }, [pedir]);

  const apagarCaptura = useCallback(() => {
    mic.current?.cerrar();
    mic.current = null;
    setCapturando(false);
    setNivel(0);
    pantalla.current?.release?.().catch?.(() => {});
    pantalla.current = null;
  }, []);

  const mantenerPantalla = useCallback(async () => {
    try { pantalla.current = await (navigator as any).wakeLock?.request('screen'); } catch { /* se apagará según el ajuste del teléfono */ }
  }, []);

  const evento = useCallback((nombre: string, d: any) => {
    switch (nombre) {
      case 'estado':
        setActivo(!!d.activo);
        setDispositivo(d.dispositivo || 'mac');
        if (!d.activo || d.dispositivo !== 'telefono') apagarCaptura();
        break;
      case 'transcripcion': setLineas((l) => [...l.slice(-300), { quien: d.quien, texto: d.texto }]); break;
      case 'escuchando': setDictado(d.activo ? { texto: d.texto || '', restante: d.restante ?? null, total: d.total ?? 4 } : null); break;
      case 'consulta':
        setDictado(null);
        setConsultas((c) => [...c, { id: d.id, pregunta: d.pregunta, respuesta: '', buscando: false, terminada: false }]);
        break;
      case 'buscando': setConsultas((c) => c.map((x) => (x.id === d.id ? { ...x, buscando: true, respuesta: '', detalle: d.detalle } : x))); break;
      case 'parcial': setConsultas((c) => c.map((x) => (x.id === d.id ? { ...x, buscando: false, respuesta: d.texto } : x))); break;
      case 'respuesta':
        setConsultas((c) => c.map((x) => (x.id === d.id ? { ...x, buscando: false, terminada: true, respuesta: d.texto } : x)));
        if (vozRef.current) hablar(d.texto);
        break;
      case 'descartada': setConsultas((c) => c.filter((x) => x.id !== d.id)); break;
      case 'terminada':
        apagarCaptura();
        setNota(d.conTranscripcion ? 'Sesión terminada. Creando el recordatorio…' : 'Sesión terminada, sin nada que guardar.');
        break;
      case 'recordatorio': setNota(`Recordatorio creado: ${d.titulo || ''}`); break;
      case 'sesion':
        if (!d.id) setConsultas([]);
        setSesiones((s) => (s ? s.map((x) => ({ ...x, actual: x.id === d.id })) : s));
        break;
      case 'retomada':
        setConsultas((d.pares || []).map((p: any, i: number) => ({
          id: -(i + 1), pregunta: p.pregunta, respuesta: p.respuesta || 'Sin respuesta en esta sesión.', buscando: false, terminada: true,
        })));
        break;
      case 'error':
        if (d.id != null) setConsultas((c) => c.filter((x) => x.id !== d.id));
        setAviso(/limit/i.test(d.mensaje || '') ? 'Se alcanzó el límite de Claude: no habrá respuestas hasta que se libere.' : d.mensaje || 'Error');
        break;
    }
  }, [apagarCaptura]);

  // Los eventos van por `fetch`: EventSource no deja mandar la cabecera de la sesión.
  useEffect(() => {
    const corte = new AbortController();
    (async () => {
      while (!corte.signal.aborted) {
        try {
          const r = await fetch(`${API}/eventos`, { headers: cabeceras(), signal: corte.signal });
          if (r.status === 401) { sinSesion(); return; }
          if (!r.ok || !r.body) throw new Error();
          setConectado(true);
          const lector = r.body.getReader();
          const dec = new TextDecoder();
          let resto = '';
          for (;;) {
            const { value, done } = await lector.read();
            if (done) break;
            resto += dec.decode(value, { stream: true });
            let i;
            while ((i = resto.indexOf('\n\n')) >= 0) {
              const b = resto.slice(0, i);
              resto = resto.slice(i + 2);
              const nombre = b.match(/^event: (.*)$/m)?.[1];
              const dato = b.match(/^data: (.*)$/m)?.[1];
              if (nombre && dato) evento(nombre, JSON.parse(dato));
            }
          }
        } catch { /* se reintenta abajo */ }
        if (corte.signal.aborted) return;
        setConectado(false);
        await new Promise((res) => setTimeout(res, 2000));
      }
    })();
    return () => corte.abort();
  }, [evento]);

  // Al volver de otra app o de la pantalla bloqueada, el audio queda pausado: se reanuda.
  useEffect(() => {
    const volver = () => {
      if (document.visibilityState !== 'visible' || !mic.current) return;
      mic.current.reanudar();
      mantenerPantalla();
    };
    document.addEventListener('visibilitychange', volver);
    return () => document.removeEventListener('visibilitychange', volver);
  }, [mantenerPantalla]);

  useEffect(() => () => apagarCaptura(), [apagarCaptura]);

  const intentar = useCallback(async (trabajo: () => Promise<unknown>) => {
    setAviso('');
    try { await trabajo(); } catch (e: any) { setAviso(e?.message || 'No se pudo.'); }
  }, []);

  const alternar = useCallback(async () => {
    setAviso(''); setNota('');
    try {
      if (capturando) { apagarCaptura(); await pedir('desactivar'); return; }
      // Dentro del toque: Safari solo abre el micrófono y el audio a partir de un gesto.
      mic.current = await abrirMicrofono(setNivel);
      setCapturando(true);
      mantenerPantalla();
      await pedir('activar?dispositivo=telefono');
    } catch (e: any) {
      apagarCaptura();
      setAviso(e?.name === 'NotAllowedError' ? 'Falta el permiso del micrófono.' : e?.message || 'No se pudo activar.');
    }
  }, [capturando, apagarCaptura, mantenerPantalla, pedir]);

  const alternarVoz = useCallback(() => {
    const v = !vozRef.current;
    setVoz(v); vozRef.current = v;
    localStorage.setItem('gumdramon_voz', v ? '1' : '0');
    // Safari solo deja hablar después de un toque: este deja la voz lista para las respuestas.
    if (v) hablar('Voz activada'); else window.speechSynthesis?.cancel();
  }, []);

  return {
    activo, dispositivo, conectado, capturando, consultas, lineas, dictado, aviso, nota, nivel, voz, sesiones,
    enOtro: activo && dispositivo !== 'telefono',
    cerrarAviso: () => setAviso(''),
    alternar,
    alternarVoz,
    preguntar: (texto: string) => intentar(() => pedir('consulta', 'POST', { texto })),
    detenerConsulta: () => intentar(() => pedir('detener')),
    terminar: () => { apagarCaptura(); setNota('Guardando la transcripción…'); return intentar(() => pedir('terminar')); },
    cargarSesiones,
    retomar: (id: string) => intentar(async () => { await pedir(`sesiones/${id}/retomar`); setNota('Sesión retomada: lo que preguntes sigue esa conversación.'); await cargarSesiones(); }),
    nuevaSesion: () => intentar(async () => { await pedir('sesiones/nueva'); setNota('La próxima pregunta abre una sesión nueva.'); await cargarSesiones(); }),
    renombrar: (id: string, titulo: string) => intentar(async () => {
      setSesiones((s) => s?.map((x) => (x.id === id ? { ...x, titulo } : x)) ?? s);
      await pedir(`sesiones/${id}/titulo`, 'POST', { titulo });
    }),
    eliminar: (id: string) => intentar(async () => { await pedir(`sesiones/${id}/eliminar`); await cargarSesiones(); }),
  };
}
