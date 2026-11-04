'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const VIDEO_RESPALDO = '/sin-reposo.mp4';

/**
 * Mantener la pantalla encendida.
 *
 * El sistema suelta el bloqueo cada vez que la página pasa a segundo plano, así que se recuerda
 * lo que se PIDIÓ (`deseado`) aparte de lo que está activo, y se vuelve a pedir al regresar.
 *
 * Donde no existe la función, o la rechaza (la vista web de una app nativa puede hacerlo), el
 * respaldo es un video mudo en bucle: mientras se reproduce, el sistema no apaga la pantalla.
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const deseado = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('wakeLock' in navigator || typeof HTMLVideoElement !== 'undefined');
  }, []);

  const pararVideo = useCallback(() => {
    videoRef.current?.pause();
    videoRef.current?.remove();
    videoRef.current = null;
  }, []);

  const usarVideo = useCallback(async () => {
    if (!videoRef.current) {
      const v = document.createElement('video');
      v.src = VIDEO_RESPALDO;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.setAttribute('aria-hidden', 'true');
      v.style.cssText = 'position:fixed;width:1px;height:1px;left:0;bottom:0;opacity:0.01;pointer-events:none';
      document.body.appendChild(v);
      videoRef.current = v;
    }
    await videoRef.current.play();
  }, []);

  const adquirir = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const sentinela = await navigator.wakeLock.request('screen');
        wakeLockRef.current = sentinela;
        sentinela.addEventListener('release', () => {
          if (wakeLockRef.current === sentinela) wakeLockRef.current = null;
          // Soltado por el sistema, no por quien lo pidió: se recupera al volver.
          if (!deseado.current) setIsActive(false);
        });
        pararVideo();
        setIsActive(true);
        return;
      } catch { /* pasa al respaldo */ }
    }
    try {
      await usarVideo();
      setIsActive(true);
    } catch {
      pararVideo();
      deseado.current = false;
      setIsActive(false);
    }
  }, [pararVideo, usarVideo]);

  const request = useCallback(async () => {
    deseado.current = true;
    await adquirir();
  }, [adquirir]);

  const release = useCallback(async () => {
    deseado.current = false;
    setIsActive(false);
    pararVideo();
    const sentinela = wakeLockRef.current;
    wakeLockRef.current = null;
    await sentinela?.release().catch(() => {});
  }, [pararVideo]);

  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible' && deseado.current && !wakeLockRef.current) adquirir();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [adquirir]);

  useEffect(() => () => {
    deseado.current = false;
    wakeLockRef.current?.release().catch(() => {});
    pararVideo();
  }, [pararVideo]);

  return { isActive, isSupported, request, release };
}
