'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PASOS, PISOS } from '@/lib/sitio/modeloGcc';

/** Alto de la tarjeta respecto a su ancho, y el hueco entre tarjetas (los usa también el CSS). */
const ALTO = 1.25;
const HUECO = 8;

type Miembro = { id: number; nombre: string; cargo: string | null; piso: string | null; paso: string | null; foto: string | null };

/** `pilar` → «Pilar», `fundamentacion` → «Fundamentación»: los nombres del Modelo 4P. */
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nombreDe = (lista: { name: string }[], id: string | null) =>
  id ? lista.find((x) => sinTildes(x.name) === sinTildes(id))?.name ?? null : null;

/** En las tarjetas pequeñas: el primer nombre y el primer apellido («Luis Fernando González Muyulema» → «Luis González»). */
const nombreCorto = (nombre: string) => {
  const p = nombre.split(/\s+/).filter(Boolean);
  return p.length >= 4 ? `${p[0]} ${p[2]}` : p.slice(0, 2).join(' ');
};

const iniciales = (nombre: string) =>
  nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * MIEMBROS — la galería del paso «Modelo de Grupo» (Fernando, 2026-11-12): hasta 30 miembros al azar con
 * su foto y sus datos, TODOS A LA VISTA SIN DESLIZAR. El lado de la tarjeta (`--lado`) se calcula con el
 * ancho y el alto que quedan libres en el paso: el más grande (hasta 200 px) con el que caben todos.
 * Con 2 miembros salen grandes; con 30, pequeñas. En el teléfono, si no caben ni al mínimo, se baja.
 * Entran una tras otra, siguiendo el «cuento» del paso.
 */
export default function MiembrosGaleria() {
  const [miembros, setMiembros] = useState<Miembro[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/members/galeria')
      .then((r) => r.json())
      .then((j) => vivo && setMiembros(Array.isArray(j?.data) ? j.data : []))
      .catch(() => vivo && setMiembros([]));
    return () => { vivo = false; };
  }, []);

  const n = miembros?.length ?? 0;
  const rejilla = useRef<HTMLUListElement>(null);
  const [lado, setLado] = useState(180);
  useLayoutEffect(() => {
    const ul = rejilla.current;
    const caja = ul?.parentElement;
    if (!ul || !caja || !n) return;
    const cuerpo = ul.closest('.onb-cuerpo') as HTMLElement | null;
    const medir = () => {
      const ancho = caja.clientWidth;
      let alto = Infinity;
      if (cuerpo) {
        const arriba = ul.getBoundingClientRect().top - cuerpo.getBoundingClientRect().top + cuerpo.scrollTop;
        alto = Math.max(220, cuerpo.clientHeight - arriba - 40);
      }
      let l = 200;
      for (; l > 64; l -= 2) {
        const columnas = Math.max(1, Math.floor((ancho + HUECO) / (l + HUECO)));
        if (Math.ceil(n / columnas) * (l * ALTO + HUECO) - HUECO <= alto && columnas * (l + HUECO) - HUECO <= ancho) break;
      }
      setLado(l);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja);
    if (cuerpo) ro.observe(cuerpo);
    return () => ro.disconnect();
  }, [n]);

  if (miembros && miembros.length === 0) return null;

  return (
    <section className="onb-miembros" aria-label="Miembros del proyecto">
      <h3 className="onb-miembros-titulo">Miembros</h3>
      <ul
        ref={rejilla}
        className="onb-miembros-rejilla"
        data-compacta={lado < 110 ? '' : undefined}
        style={{ '--lado': `${lado}px`, '--hueco': `${HUECO}px` } as React.CSSProperties}
      >
        {(miembros ?? []).map((m, i) => {
          const piso = nombreDe(PISOS, m.piso);
          const paso = nombreDe(PASOS, m.paso);
          return (
            <li key={m.id} className="onb-miembro" style={{ '--i': i } as React.CSSProperties} title={m.nombre}>
              <span className="onb-miembro-foto">
                {m.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.foto} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span aria-hidden>{iniciales(m.nombre)}</span>
                )}
              </span>
              <span className="onb-miembro-nombre">{m.nombre}</span>
              <span className="onb-miembro-corto">{nombreCorto(m.nombre)}</span>
              {m.cargo && <span className="onb-miembro-cargo">{m.cargo}</span>}
              {piso && <span className="onb-miembro-piso">{piso}</span>}
              {paso && <span className="onb-miembro-piso onb-miembro-paso">{paso}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
