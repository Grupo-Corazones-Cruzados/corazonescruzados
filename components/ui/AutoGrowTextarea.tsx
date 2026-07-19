'use client';

import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react';

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & {
  value: string;
  /** Altura mínima en filas de texto. */
  minRows?: number;
  /**
   * Altura máxima en px antes de hacer scroll interno. `0` = sin límite (crece siempre y la
   * página se desplaza). Por defecto 70% del viewport: se ve muchísimo texto sin que el
   * cuadro empuje el resto de la interfaz fuera de la pantalla.
   */
  maxHeight?: number;
};

/**
 * Textarea que **crece en alto automáticamente** con el texto que se escribe, para que no haya
 * que hacer scroll dentro de un cuadro pequeño. Definición ÚNICA reusable.
 *
 * Detalle que hace que funcione: antes de medir se pone `height:auto`. Sin eso, `scrollHeight`
 * nunca baja de la altura ya fijada y el cuadro crecería pero **no volvería a encogerse** al
 * borrar texto.
 *
 * Recalcula al cambiar el valor (incluye montaje con texto ya cargado, pegar y limpiar tras
 * guardar) y al redimensionar la ventana, porque al cambiar el ancho cambia el ajuste de línea
 * y con él la altura necesaria.
 */
const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoGrowTextarea(
  { value, minRows = 3, maxHeight, className, style, ...rest }, ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  // Deja que el padre siga usando el ref (p. ej. para hacer focus).
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;

    // 1) Encoger para poder medir el alto REAL del contenido.
    el.style.height = 'auto';

    // 2) Suelo: `minRows` líneas, calculado desde el line-height real (respeta el tema).
    const cs = window.getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 18;
    const chrome = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const min = line * minRows + chrome;

    // 3) Techo: el indicado, o 70% del viewport si no se indica. 0 = sin límite.
    const max = maxHeight === 0 ? Infinity : (maxHeight ?? window.innerHeight * 0.7);

    const needed = Math.max(el.scrollHeight, min);
    el.style.height = `${Math.min(needed, max)}px`;
    // Solo aparece la barra cuando de verdad se topa con el techo.
    el.style.overflowY = needed > max ? 'auto' : 'hidden';
  }, [minRows, maxHeight]);

  useLayoutEffect(() => { resize(); }, [value, resize]);

  useLayoutEffect(() => {
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  return (
    <textarea
      {...rest}
      ref={innerRef}
      value={value}
      // `resize-none`: el arrastre manual pelearía con el alto que calculamos.
      className={`resize-none ${className || ''}`}
      style={style}
    />
  );
});

export default AutoGrowTextarea;
