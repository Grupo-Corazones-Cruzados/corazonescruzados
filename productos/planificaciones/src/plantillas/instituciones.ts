import type { InstitucionConfig } from './tipos';

/**
 * CONFIGURACIÓN DEL FORMATO POR INSTITUCIÓN (a nivel de código, por inquilino).
 *
 * Aquí va lo que el formato de cada cliente lleva impreso y no se pide en ningún
 * formulario: las líneas de la cabecera, el año lectivo, los logos, los ejes
 * transversales de su proyecto educativo, las competencias e inserciones
 * curriculares, la bibliografía y el registro del formato. Para añadir una
 * institución se añade una entrada con su `slug` (el primer tramo de su
 * dirección) y se despliega.
 *
 * La entrada `predeterminada` es la que usa cualquier institución que no tenga
 * la suya: un PUD genérico con las competencias e inserciones del currículo
 * nacional.
 */

const COMPETENCIAS_NACIONALES = {
  titulo: 'COMPETENCIAS',
  columnas: ['Competencias Comunicacionales', 'Competencias Matemáticas', 'Competencias Digitales', 'Competencias Socioemocionales'],
};

const INSERCIONES_NACIONALES = {
  titulo: 'INSERCIONES CURRICULARES',
  columnas: [
    'Educación, Cívica, Ética e Integridad',
    'Educación para el Desarrollo Sostenible',
    'Educación Socioemocional',
    'Educación Financiera',
    'Educación para la Seguridad Vial y Movilidad Sostenible',
    'Seguridad Integral',
  ],
};

const BIBLIOGRAFIA_PREPARATORIA =
  'Ministerio de Educación del Ecuador. (2025). Currículo priorizado con énfasis en habilidades comunicacionales, lógico-matemáticas, digitales y socioemocionales: Educación General Básica, subnivel Preparatoria. https://educacion.gob.ec/wp-content/uploads/downloads/2025/07/Curriculo-Priorizado-Preparatoria.pdf';

export const predeterminada = (nombreInstitucion: string): InstitucionConfig => ({
  cabecera: [{ texto: nombreInstitucion, estilo: 'grande' }],
  anioLectivo: anioLectivoActual(),
  logos: [],
  tituloDocumento: 'PLAN DE UNIDAD DIDÁCTICA',
  competencias: COMPETENCIAS_NACIONALES,
  inserciones: INSERCIONES_NACIONALES,
  adaptaciones: true,
  bibliografia: [BIBLIOGRAFIA_PREPARATORIA],
});

/**
 * Las instituciones con formato propio, por slug. Ejemplo de cómo se declara una
 * (con una red educativa, ejes de pastoral y registro del formato):
 *
 *   'mi-colegio': {
 *     ...predeterminada('Unidad Educativa Mi Colegio'),
 *     cabecera: [
 *       { texto: 'Unidad Educativa Particular' },
 *       { texto: '“Mi Colegio”', estilo: 'grande' },
 *       { texto: 'Red Educativa …', estilo: 'acento' },
 *     ],
 *     anioLectivo: '2026 - 2027',
 *     logos: ['https://res.cloudinary.com/…/escudo.png'],
 *     colorCabecera: '#E5232B',
 *     ejesTransversales: { titulo: 'EJES TRANSVERSALES DE LA PASTORAL EDUCATIVA', filas: [
 *       { eje: 'Encuentro Con Cristo-Espiritual', actividades: ['…', '…'] },
 *     ] },
 *     dece: { responsable: 'Psic. …' },
 *     registroFormato: { titulo: 'REGISTRO DE FORMATO: Planificación Curricular Anual 2026 - 2027',
 *       elaboradoPor: { cargo: 'Coordinación Pedagógica', nombre: '…', fecha: '…' },
 *       aprobadoPor: { cargo: 'Dirección General', nombre: '…', fecha: '' } },
 *   },
 */
const INSTITUCIONES: Record<string, InstitucionConfig> = {
  demo: {
    ...predeterminada('Unidad Educativa de Demostración'),
    cabecera: [
      { texto: 'Unidad Educativa Particular' },
      { texto: '“Demostración”', estilo: 'grande' },
      { texto: 'Un producto del Grupo Corazones Cruzados', estilo: 'acento' },
    ],
    ejesTransversales: {
      titulo: 'EJES TRANSVERSALES',
      filas: [
        { eje: 'Convivencia y respeto', actividades: ['Respeta a sus semejantes y trata con delicadeza a sus compañeros.', 'Participa en la construcción de los acuerdos del aula.'] },
        { eje: 'Formación integral', actividades: ['Demuestra interés por su crecimiento personal e intelectual.', 'Investiga, analiza y pregunta durante el proceso de aprendizaje.'] },
      ],
    },
    dece: { responsable: '' },
  },
};

export function institucionDe(slug: string, nombre: string): InstitucionConfig {
  return INSTITUCIONES[slug] ?? predeterminada(nombre);
}

/** «2026 - 2027» según el mes: el año lectivo de la Costa empieza en mayo. */
function anioLectivoActual(ahora = new Date()) {
  const a = ahora.getFullYear();
  return ahora.getMonth() + 1 >= 5 ? `${a} - ${a + 1}` : `${a - 1} - ${a}`;
}
