'use client';

/**
 * LA TABLA DEL MODELO 4P y EL RECORRIDO DE LA METODOLOGÍA — compartidos por el formulario de
 * postulación (pasos 1 y 2) y las páginas públicas de Desarrollo Humano. Los textos salen de
 * `lib/sitio/modeloGcc.ts`; los estilos (`.modelo-4p`, `.m4p-*`, `.cond-*`) de `app/globals.css`,
 * con los tokens `--color-digi-*` / `--color-accent*` (en el sitio público los reasigna
 * `.modelo-gcc-publico` a la paleta clara).
 *
 * Es de cliente por el foco de la tabla (pasar por un piso o un paso ilumina su fila y su
 * columna). El HTML sale igual en el servidor, así que el buscador lee la tabla entera.
 */

import { useState } from 'react';
import { PASOS, PASOS_CONDICIOLOGIA, PISOS, REGLAS_4P } from '@/lib/sitio/modeloGcc';

/**
 * EL MODELO 4P COMO TABLA (Fernando, 2026-10-29: «quitemos las pestañas… en formato tabla, los
 * 4 pisos con su nombre y número, y los 4 pasos uno a la derecha del otro, porque es la forma
 * correcta de representar el modelo organizacional 4P»).
 *
 * Filas = los 4 PISOS (del gobierno, arriba, a la ejecución, abajo); columnas = los 4 PASOS (de
 * izquierda a derecha, en el orden en que se recorren). Cada cruce es un punto: en toda etapa
 * participan los cuatro roles. Al pasar por un piso, un paso o un cruce, se iluminan su fila y su
 * columna; la descripción de cada uno queda en su `title`.
 */
export default function Modelo4P() {
  const [foco, setFoco] = useState<{ piso: number | null; paso: number | null }>({ piso: null, paso: null });
  const soltar = () => setFoco({ piso: null, paso: null });
  return (
    <div className="modelo-4p" onMouseLeave={soltar}>
      <table>
        <caption className="sr-only">Modelo Organizacional 4P: los 4 pisos (filas) por los 4 pasos (columnas)</caption>
        <thead>
          <tr>
            <th scope="col" className="m4p-esquina">
              <span className="m4p-esquina-pasos">Pasos →</span>
              <span className="m4p-esquina-pisos">Pisos ↓</span>
            </th>
            {PASOS.map((s, j) => (
              <th
                key={s.name}
                scope="col"
                title={s.desc}
                className={`m4p-paso ${foco.paso === j ? 'es-foco' : ''}`}
                onMouseEnter={() => setFoco({ piso: null, paso: j })}
                onClick={() => setFoco({ piso: null, paso: j })}
              >
                <span className="m4p-num">{j + 1}</span>
                <span className="m4p-nombre">{s.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PISOS.map((p, i) => (
            <tr key={p.name}>
              <th
                scope="row"
                title={p.desc}
                className={`m4p-piso ${foco.piso === i ? 'es-foco' : ''}`}
                onMouseEnter={() => setFoco({ piso: i, paso: null })}
                onClick={() => setFoco({ piso: i, paso: null })}
              >
                <span className="m4p-num">{i + 1}</span>
                <span className="m4p-nombre">{p.name}</span>
              </th>
              {PASOS.map((s, j) => {
                const enFila = foco.piso === i;
                const enColumna = foco.paso === j;
                return (
                  <td
                    key={s.name}
                    className={`m4p-cruce ${enFila || enColumna ? 'es-foco' : ''} ${enFila && enColumna ? 'es-cruce' : ''}`}
                    onMouseEnter={() => setFoco({ piso: i, paso: j })}
                onClick={() => setFoco({ piso: i, paso: j })}
                    aria-label={`${p.name} en ${s.name}`}
                  >
                    <span className="m4p-punto" aria-hidden="true" />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/**
 * LOS SEIS PASOS DE LA METODOLOGÍA como un RECORRIDO (Fernando, 2026-10-29): una línea con un
 * nodo por paso y, debajo, el número y el nombre SOLO con color de texto — nada de etiquetas con
 * relleno ni borde (*«ese estilo ya he dicho antes que no me gusta»*). Seis en fila desde `sm`;
 * en el teléfono, dos filas de tres.
 */
export function PasosCondiciologia() {
  return (
    <ol className="cond-pasos" aria-label="Los seis pasos de la Metodología Condiciológica">
      {PASOS_CONDICIOLOGIA.map((s, i) => (
        <li key={s} className="cond-paso">
          <span className="cond-nodo" aria-hidden="true" />
          <span className="cond-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="cond-nombre">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Cómo se lee la tabla (Fernando, 2026-10-29, texto literal). La última es la conclusión. */
export function ReglasModelo4P() {
  return (
    <ol className="m4p-reglas">
      {REGLAS_4P.map((r, i) => (
        <li key={i} className={i === REGLAS_4P.length - 1 ? 'es-conclusion' : ''}>
          <span className="m4p-regla-num" aria-hidden="true">{i + 1}</span>
          <span>{r}</span>
        </li>
      ))}
    </ol>
  );
}
