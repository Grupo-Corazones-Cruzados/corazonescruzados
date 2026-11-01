/** La página Candidatos: la usan `/candidatos` y `/candidatos/<apartado>`. */

import { Contenedor, PresentacionPagina } from './piezas';
import { PRESENTACION_CANDIDATOS } from './presentaciones';
import TemasCandidatos from './TemasCandidatos';

export default function PaginaCandidatos({ paso }: { paso: string }) {
  return (
    <section className="flex-1 pt-6 sm:pt-10 pb-16">
      <Contenedor ancho="sitio">
        <PresentacionPagina {...PRESENTACION_CANDIDATOS} />
        <TemasCandidatos inicial={paso} />
      </Contenedor>
    </section>
  );
}
