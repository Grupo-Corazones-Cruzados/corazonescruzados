/**
 * «Corazón» y «mundo» como IMÁGENES en el titular de la portada (prueba, Fernando, 2026-10-26).
 *
 * Se probó primero con el logo de los corazones cruzados y el planeta morado del juego, y
 * Fernando lo descartó: «no son imágenes de corazón tan real y el mundo no parece el planeta
 * Tierra». Estos son propios, en pixel-art (casan con el juego) y en SVG (nítidos a cualquier
 * tamaño): un corazón rojo que late y la Tierra, que gira desplazando sus continentes dentro
 * del círculo. Miden en `em`, así escalan con el titular (`.titular-icono` en globals.css).
 */

// Corazón 13×12. 1 = rojo, 2 = rojo oscuro (sombra), 3 = brillo, 4 = contorno.
const CORAZON = [
  '0044400044400',
  '0411140411140',
  '4113114111114',
  '4133111111114',
  '4131111111124',
  '4111111111124',
  '0411111111240',
  '0041111112400',
  '0004111124000',
  '0000411240000',
  '0000042400000',
  '0000004000000',
];
const COLOR_CORAZON: Record<string, string> = { '1': '#ef4444', '2': '#b91c1c', '3': '#fecaca', '4': '#450a0a' };

export function IconoCorazon() {
  return (
    <svg viewBox="0 0 13 12" shapeRendering="crispEdges" className="titular-icono titular-icono-corazon" role="img" aria-label="Corazón">
      {CORAZON.flatMap((fila, y) =>
        [...fila].map((c, x) => (c !== '0' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={COLOR_CORAZON[c]} /> : null)),
      )}
    </svg>
  );
}

// Mapa de la Tierra, 32×14 (dos vueltas iguales, para girar sin costura). 1 = tierra, 2 = hielo.
const MAPA = [
  '00222220000000000002222200000000',
  '00011100000001100000111000000011',
  '01111110001111110111111000111111',
  '11111100011111100111110001111110',
  '01111000001111000011100000111100',
  '00110000000111100001000000011110',
  '00011100000011100000111000001110',
  '00011110000001000000111100000100',
  '00001111000000000000011110000000',
  '00000110000110000000001100001100',
  '00000100001111000000001000011110',
  '00000000000110000000000000001100',
  '00000000000000000000000000000000',
  '00000002222220000000000222222000',
];

/**
 * `idRecorte`: el `id` del círculo que recorta el mapa. Debe ser ÚNICO en la página: con dos
 * Tierras y el mismo `id`, la segunda usa el recorte de la primera, y si esa está oculta
 * (`display:none`) no recorta nada y la Tierra sale cuadrada (Desarrollo Humano, 2026-10-29).
 */
export function IconoMundo({ idRecorte = 'icono-mundo-disco' }: { idRecorte?: string } = {}) {
  return (
    <svg viewBox="0 0 14 14" shapeRendering="crispEdges" className="titular-icono titular-icono-mundo" role="img" aria-label="mundo">
      <defs>
        <clipPath id={idRecorte}>
          <circle cx="7" cy="7" r="6.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${idRecorte})`}>
        <rect x="0" y="0" width="14" height="14" fill="#2563eb" />
        <g className="titular-mundo-mapa">
          {MAPA.flatMap((fila, y) =>
            [...fila].map((c, x) =>
              c !== '0' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={c === '1' ? '#22c55e' : '#f8fafc'} /> : null,
            ),
          )}
        </g>
        {/* Sombra del lado de la noche y brillo del lado del sol: le dan volumen. */}
        <circle cx="10.5" cy="10" r="7" fill="#0b1e4d" opacity="0.32" />
        <rect x="3" y="3" width="2" height="1" fill="#ffffff" opacity="0.55" />
        <rect x="3" y="4" width="1" height="1" fill="#ffffff" opacity="0.55" />
      </g>
      <circle cx="7" cy="7" r="6.5" fill="none" stroke="#0b1e4d" strokeWidth="0.6" />
    </svg>
  );
}
