'use client';

import { useEffect, type RefObject } from 'react';

/**
 * ⭐ LOS BOTONES DEL PANEL, FIJOS ABAJO (Fernando, 2026-10-30: «el botón o botones estén fijos
 * en la parte inferior del panel y que no dependa su visualización o posición de otro
 * control»).
 *
 * Lo correcto es pasarlos en `pie` de `PixelModal`, que los saca de lo que se desplaza. Pero
 * casi 80 paneles los escribieron al final del formulario, DENTRO del `<form>` (el «Guardar»
 * es `type="submit"`: sacarlo del formulario lo desconectaría). Así que, en vez de moverlos,
 * se buscan y se marcan, y el CSS (`globals.css`, «ACCIONES FIJAS») los pega abajo:
 *   · `data-acciones-fijas` en la fila: `sticky` al pie del cuerpo, con el fondo y el borde
 *     del `pie`, siempre a la vista aunque el formulario sea largo;
 *   · `data-acciones-cadena` en sus contenedores, si todos son cajas normales: pasan a
 *     columna flexible y la fila baja al final aunque el formulario sea corto.
 *
 * Qué es «la fila de acciones»: el ÚLTIMO elemento visible del cuerpo (bajando siempre por el
 * último hijo) cuyos hijos visibles son todos botones o enlaces, y que tiene un botón
 * principal, de enviar, o uno de cancelar/cerrar. Si no hay nada así, no se toca nada.
 *   · Si esa fila es el final de una barra horizontal (p. ej. «Eliminar» a la izquierda y
 *     «Cancelar · Guardar» a la derecha), se fija la barra entera.
 *   · Si lo último es UN botón suelto (el «Crear» a todo el ancho de Clientes o Proyectos),
 *     se fija el botón: no se le puede poner un envoltorio sin romper a React, así que la
 *     franja la pinta su sombra (`data-acciones-fijas="boton"`).
 */
const FILA = 'data-acciones-fijas';
const CADENA = 'data-acciones-cadena';
const CANCELAR = /^(cancelar|cerrar|volver|descartar)$/i;

function visible(el: Element): boolean {
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  if (el.tagName === 'DIALOG' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEMPLATE') return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.position !== 'fixed' && cs.position !== 'absolute' && el.getClientRects().length > 0;
}

function esAccion(el: Element): boolean {
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return true;
  // Un envoltorio de un solo botón (tooltip, `Demostracion`…).
  const hijos = Array.from(el.children).filter(visible);
  return hijos.length === 1 && esAccion(hijos[0]);
}

function esDecisivo(b: Element): boolean {
  return b.classList.contains('btn-primario') ||
    b.classList.contains('pixel-btn-primary') ||
    (b instanceof HTMLButtonElement && b.type === 'submit') ||
    CANCELAR.test((b.textContent ?? '').trim());
}

function esFilaDeAcciones(el: Element): boolean {
  if (el.tagName === 'BUTTON' || el.tagName === 'A') return false;
  const hijos = Array.from(el.children).filter(visible);
  if (hijos.length === 0 || hijos.length > 4 || !hijos.every(esAccion)) return false;
  return Array.from(el.querySelectorAll('button, a')).some(esDecisivo);
}

function filaHorizontal(el: Element): boolean {
  const cs = getComputedStyle(el);
  return (cs.display === 'flex' || cs.display === 'inline-flex') && !cs.flexDirection.startsWith('column');
}

function buscarFila(cuerpo: HTMLElement): { fila: HTMLElement; boton: boolean } | null {
  let el: Element = cuerpo;
  for (let nivel = 0; nivel < 8; nivel++) {
    const hijos = Array.from(el.children).filter(visible);
    const ultimo = hijos[hijos.length - 1];
    if (!ultimo) return null;
    if (el !== cuerpo && (ultimo.tagName === 'BUTTON' || ultimo.tagName === 'A')) {
      // Un botón suelto al final de un bloque de campos (no de una fila de botones).
      return esDecisivo(ultimo) && !filaHorizontal(el) ? { fila: ultimo as HTMLElement, boton: true } : null;
    }
    if (esFilaDeAcciones(ultimo)) {
      let fila = ultimo as HTMLElement;
      // Sube a la barra que la contiene mientras sea horizontal y la fila vaya al final.
      while (fila.parentElement && fila.parentElement !== cuerpo && filaHorizontal(fila.parentElement)) {
        const hs = Array.from(fila.parentElement.children).filter(visible);
        if (hs[hs.length - 1] !== fila) break;
        fila = fila.parentElement;
      }
      return { fila, boton: false };
    }
    el = ultimo;
  }
  return null;
}

function limpiar(cuerpo: HTMLElement) {
  cuerpo.querySelectorAll(`[${FILA}], [${CADENA}]`).forEach((e) => { e.removeAttribute(FILA); e.removeAttribute(CADENA); });
  cuerpo.removeAttribute(CADENA);
  cuerpo.style.removeProperty('--acciones-izq');
  cuerpo.style.removeProperty('--acciones-der');
}

function marcar(cuerpo: HTMLElement) {
  const hallada = buscarFila(cuerpo);
  const fila = hallada?.fila ?? null;
  const actual = cuerpo.querySelector(`[${FILA}]`);
  if (fila && fila === actual) return medir(cuerpo, fila);
  limpiar(cuerpo);
  if (!fila) return;
  fila.setAttribute(FILA, hallada!.boton ? 'boton' : '');
  // La cadena solo si todos los contenedores son cajas normales: pasar una rejilla o una
  // fila flexible a columna la desharía.
  const cadena: Element[] = [];
  for (let el = fila.parentElement; el && el !== cuerpo; el = el.parentElement) {
    const d = getComputedStyle(el).display;
    const columna = d === 'flex' && getComputedStyle(el).flexDirection === 'column';
    if (d !== 'block' && !columna) return medir(cuerpo, fila);
    cadena.push(el);
  }
  cuerpo.setAttribute(CADENA, '');
  cadena.forEach((e) => e.setAttribute(CADENA, ''));
  medir(cuerpo, fila);
}

/** La franja va de borde a borde del panel: se mide cuánto le falta a cada lado. */
function medir(cuerpo: HTMLElement, fila: HTMLElement) {
  const c = cuerpo.getBoundingClientRect();
  const f = fila.getBoundingClientRect();
  const raya = cuerpo.offsetWidth - cuerpo.clientWidth;
  const izq = Math.max(0, Math.round(f.left - c.left));
  const der = Math.max(0, Math.round(c.right - raya - f.right));
  // Medida con la fila ya ensanchada: el margen negativo la lleva al borde, no se suma dos veces.
  const yaIzq = parseFloat(cuerpo.style.getPropertyValue('--acciones-izq')) || 0;
  const yaDer = parseFloat(cuerpo.style.getPropertyValue('--acciones-der')) || 0;
  // Solo si cambia: escribir el `style` del cuerpo despierta al observador, y con el mismo
  // valor de siempre sería un bucle de un cuadro tras otro.
  const nIzq = `${izq + yaIzq}px`, nDer = `${der + yaDer}px`;
  if (cuerpo.style.getPropertyValue('--acciones-izq') !== nIzq) cuerpo.style.setProperty('--acciones-izq', nIzq);
  if (cuerpo.style.getPropertyValue('--acciones-der') !== nDer) cuerpo.style.setProperty('--acciones-der', nDer);
}

export function useAccionesFijas(cuerpoRef: RefObject<HTMLElement | null>, activo: boolean) {
  useEffect(() => {
    const cuerpo = cuerpoRef.current;
    if (!cuerpo || !activo) return;
    let cuadro = 0;
    const pedir = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(() => marcar(cuerpo)); };
    pedir();
    const mo = new MutationObserver(pedir);
    mo.observe(cuerpo, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    const ro = new ResizeObserver(pedir);
    ro.observe(cuerpo);
    return () => { cancelAnimationFrame(cuadro); mo.disconnect(); ro.disconnect(); limpiar(cuerpo); };
  }, [cuerpoRef, activo]);
}
