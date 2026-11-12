/**
 * La página Candidatos: la presentación y el botón «Postularme» (Fernando, 2026-11-11: «debería estar
 * solo el botón de postularme»). Los apartados (Modelo de Grupo, Herramientas…) se leen dentro de la
 * ventana del botón, que es la misma de la portada; `/candidatos/<apartado>` redirige aquí.
 */

import { Contenedor, PresentacionPagina } from './piezas';
import { PRESENTACION_CANDIDATOS } from './presentaciones';
import BotonPostularme from './BotonPostularme';
import BeneficiosCandidatos from './BeneficiosCandidatos';

export default function PaginaCandidatos() {
  return (
    <section className="flex-1 pt-6 sm:pt-10 pb-16">
      <Contenedor ancho="sitio">
        <PresentacionPagina {...PRESENTACION_CANDIDATOS} accion={<BotonPostularme />} />
        <BeneficiosCandidatos />
      </Contenedor>
    </section>
  );
}
