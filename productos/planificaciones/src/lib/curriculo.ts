import { prisma } from '@/lib/db';
import { correrAgente } from '@/lib/ia';
import { normalizarCodigo } from '@/lib/destrezas';

/**
 * IMPORTAR EL CURRÍCULO PRIORIZADO DEL MINISTERIO EN UN GRADO (Fernando, 2026-09-17):
 * el documento («Mapas curriculares para el subnivel de Preparatoria…») trae, por
 * cada «Ámbito de desarrollo y aprendizaje» (= materia), sus objetivos y una tabla
 * de tres columnas con celdas combinadas: criterio de evaluación · destrezas con
 * criterios de desempeño · indicadores de evaluación (varias destrezas comparten un
 * criterio o un indicador). Aquí se lee el PDF conservando LAS COLUMNAS (cada
 * fragmento de texto va etiquetado con su columna según la cabecera de la tabla de
 * esa página), se parte por ámbitos y el agente transcribe cada ámbito a una fila
 * por destreza con su criterio y su indicador. Se crean las materias que falten,
 * se guardan los objetivos y las destrezas (las nuevas sin seleccionar: el
 * administrador elige cuáles usa).
 */

type Item = { x: number; y: number; w: number; s: string };

/** El texto del PDF con cada fragmento etiquetado por columna: [C] criterio · [D] destreza · [I] indicador. */
export async function textoConColumnas(datos: Buffer): Promise<string> {
  const pdf = (await import('pdf-parse/lib/pdf-parse.js')).default as (b: Buffer, o: Record<string, unknown>) => Promise<{ text: string }>;
  let cols: { d: number; i: number; k?: boolean; h?: number } | null = null;
  const render = (pagina: { getTextContent: (o: Record<string, unknown>) => Promise<{ items: { str: string; transform: number[]; width: number }[] }> }) =>
    pagina.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false }).then((tc) => {
      const items: Item[] = tc.items.filter((i) => i.str.trim()).map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, s: i.str.trim() }));
      const hC = items.find((i) => /^Criterios de evaluaci/.test(i.s));
      const hD = items.find((i) => /^Destrezas con criterios/.test(i.s));
      const hI = items.find((i) => /^Indicadores de evaluaci/.test(i.s));
      if (hC && hD && hI) cols = { d: (hC.x + hC.w + hD.x) / 2 - 20, i: (hD.x + hD.w + hI.x) / 2 - 20 };
      // La sección de Cívica (Fernando, 2026-09-18) tiene otra tabla: CÓDIGO · DESTREZAS · HABILIDADES
      // SOCIOEMOCIONALES · INDICADORES (sin código, por bloque). Se etiqueta [K] [D] [H] [I].
      const hK = items.find((i) => /^CÓDIGO$/i.test(i.s));
      const hD2 = items.find((i) => /^DESTREZAS CON CRITERIOS/i.test(i.s));
      const hH = items.find((i) => /^HABILIDADES$/i.test(i.s) || /^SOCIOEMOCIONALES/i.test(i.s));
      const hI2 = items.find((i) => /^INDICADORES DE EVALUACI/i.test(i.s));
      if (hK && hD2 && hH && hI2) cols = { k: true, d: (hK.x + hK.w + hD2.x) / 2 - 10, h: hH.x - 12, i: hI2.x - 12 };
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const lineas: { y: number; items: Item[] }[] = [];
      for (const it of items) {
        const l = lineas.find((L) => Math.abs(L.y - it.y) < 3);
        if (l) l.items.push(it);
        else lineas.push({ y: it.y, items: [it] });
      }
      return (
        lineas
          .map((L) => {
            L.items.sort((a, b) => a.x - b.x);
            const partes: { tag: string; s: string }[] = [];
            for (const it of L.items) {
              const cabecera = /^(Criterios de evaluaci|Destrezas con criterios|de desempeño$|Indicadores de evaluaci|CÓDIGO$|DESTREZAS CON CRITERIOS|DE DESEMPEÑO$|HABILIDADES$|SOCIOEMOCIONALES$|ASOCIADAS$|INDICADORES DE EVALUACI)/i.test(it.s);
              const tag = !cols || cabecera ? '' : cols.k ? (it.x >= cols.i ? 'I' : it.x >= (cols.h ?? cols.i) ? 'H' : it.x >= cols.d ? 'D' : 'K') : it.x >= cols.i ? 'I' : it.x >= cols.d ? 'D' : 'C';
              const ult = partes[partes.length - 1];
              if (ult && ult.tag === tag) ult.s += ' ' + it.s;
              else partes.push({ tag, s: it.s });
            }
            return partes.map((p) => (p.tag ? `[${p.tag}] ${p.s}` : p.s)).join('   ');
          })
          .join('\n') + '\n'
      );
    });
  const r = await pdf(datos, { pagerender: render });
  return r.text;
}

/**
 * Parte el texto en ámbitos: «8.1. Ámbito de desarrollo y aprendizaje 1: Identidad y
 * Autonomía» y también las áreas que el documento titula distinto («9.1. Mapas del
 * currículo de Educación Cultural y Artística del subnivel…», Educación Física).
 */
export function partirEnAmbitos(texto: string): { titulo: string; texto: string }[] {
  const re = /^.*(Ámbito de desarrollo y aprendizaje\s*\d+\s*:?|Mapas del currículo de .+? del subnivel|Mapa curricular para el per[ií]odo pedag[oó]gico de .+).*$/gim;
  const marcas: { indice: number; titulo: string }[] = [];
  for (const m of texto.matchAll(re)) marcas.push({ indice: m.index ?? 0, titulo: m[0].replace(/\[[CDI]\]/g, '').replace(/\s+/g, ' ').trim() });
  return marcas.map((m, k) => ({ titulo: m.titulo, texto: texto.slice(m.indice, marcas[k + 1]?.indice ?? texto.length) }));
}

export type SalidaAmbito = {
  materia: string;
  objetivos: { codigo: string; descripcion: string }[];
  filas: { destrezaCodigo: string; destreza: string; criterioCodigo: string; criterio: string; indicadorCodigo: string; indicador: string }[];
};

const texto = (descripcion: string) => ({ type: 'string', description: descripcion });
export const ESQUEMA_AMBITO = {
  nombre: 'ambito_curriculo',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['materia', 'objetivos', 'filas'],
    properties: {
      materia: texto('El nombre del ámbito tal como está tras «Ámbito de desarrollo y aprendizaje N:» (p. ej. «Identidad y Autonomía»; puede seguir en la línea siguiente: «Descubrimiento y comprensión del medio natural y cultural»). Si el título es «Mapas del currículo de X del subnivel…», el nombre es X (p. ej. «Educación Cultural y Artística», «Educación Física»). Si es «Mapa curricular para el período pedagógico de X…», el nombre es X («Cívica y Acompañamiento Integral en el Aula»).'),
      objetivos: {
        type: 'array',
        description: 'Los objetivos del ámbito, en orden.',
        items: { type: 'object', additionalProperties: false, required: ['codigo', 'descripcion'], properties: { codigo: texto('«O.CS.1.1.»'), descripcion: texto('El texto completo del objetivo, sin el código.') } },
      },
      filas: {
        type: 'array',
        description: 'UNA FILA POR DESTREZA, en el orden del documento, con el criterio y el indicador de evaluación que le corresponden (varias destrezas repiten el mismo criterio o indicador).',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['destrezaCodigo', 'destreza', 'criterioCodigo', 'criterio', 'indicadorCodigo', 'indicador'],
          properties: {
            destrezaCodigo: texto('El código de la destreza («CN.1.1.1.»), con punto final.'),
            destreza: texto('El texto de la destreza, sin el código.'),
            criterioCodigo: texto('El código del criterio de evaluación de su fila («CE.CN.1.2.»). Vacío si no hay.'),
            criterio: texto('El texto del criterio, sin el código.'),
            indicadorCodigo: texto('El código del indicador de su fila («I.CN.1.2.1.»; si viene como «(Ref. I.CS.1.1.2.)», ese). Vacío si no hay.'),
            indicador: texto('El texto del indicador, sin el código, con su paréntesis final «(J.3., I.2.)» si lo tiene.'),
          },
        },
      },
    },
  } as Record<string, unknown>,
};

export const SISTEMA_AMBITO = `
Eres un transcriptor meticuloso del currículo priorizado del Ministerio de Educación del Ecuador. Recibes el texto de UN ámbito de desarrollo y aprendizaje extraído de un PDF y devuelves, en el JSON pedido, su nombre, sus objetivos y una fila por cada destreza con criterio de desempeño, conectada con su criterio de evaluación y su indicador de evaluación.

CÓMO VIENE EL TEXTO
La tabla del documento tiene tres columnas y celdas combinadas. Cada fragmento viene etiquetado con su columna: [C] = criterio de evaluación, [D] = destreza con criterio de desempeño, [I] = indicador de evaluación. Las líneas siguen el orden vertical del documento: los fragmentos [C], [D] e [I] de una misma línea están a la misma altura. Un criterio [C] (empieza por «CE.») abarca todas las destrezas [D] que aparecen desde que empieza hasta que empieza el siguiente «CE.». Un indicador [I] (empieza por «I.» o viene sin código con «(Ref. I.…)» al final) corresponde a las destrezas que están a su altura y a las siguientes hasta que empieza otro indicador dentro del mismo criterio; si el indicador empieza a la altura de la segunda destreza de un criterio, la primera destreza también lo comparte cuando no hay otro indicador antes. Las palabras cortadas con «-» al final de un fragmento se unen con el siguiente fragmento de la misma columna («funciona - miento» → «funcionamiento»). Los números de página sueltos, las cabeceras repetidas de la tabla y los títulos del documento se ignoran. Los iconos no salen en el texto.

EL FORMATO DE CÍVICA (período pedagógico de Cívica y Acompañamiento Integral en el Aula) ES DISTINTO: va por «Bloque curricular N: …», cada bloque abre con «Criterio de evaluación N: texto» (sin código) y su tabla tiene cuatro columnas etiquetadas [K] código (CAI.1.1.1), [D] destreza, [H] habilidades socioemocionales, [I] indicadores de evaluación. Ahí los indicadores NO llevan código ni van alineados con cada destreza: son la lista del bloque («Pensamiento crítico: Hace preguntas…», «Manejo de problemas: …»). Para cada destreza del bloque: código = su [K] (añade el punto final), criterio = el «Criterio de evaluación N» del bloque (criterioCodigo vacío), indicador = TODOS los indicadores del bloque, cada uno en su línea «Nombre: texto» (indicadorCodigo vacío). Las habilidades [H] no se transcriben. El «Objetivo:» de Cívica no lleva código: devuélvelo con codigo vacío.

REGLAS
1. TRANSCRIBES, NO REDACTAS: códigos exactos (con punto final) y textos tal cual, solo uniendo líneas y palabras cortadas.
2. Una fila por destreza; no te saltes ninguna y no inventes. Si una destreza no tiene código, usa el texto igualmente con código vacío... pero en este documento todas lo tienen.
3. El criterio y el indicador se repiten en cada fila que los comparte, completos.
4. Los objetivos van en «objetivos», no en las filas.
5. Solo el JSON.
`.trim();

/** Dos nombres de materia son el mismo si, sin acentos, guiones ni palabras vacías, comparten casi todas las palabras (o una empieza por la otra). */
export function parecidos(a: string, b: string): boolean {
  const limpiar = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/compresion/g, 'comprension')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !['y', 'e', 'de', 'del', 'la', 'el', 'las', 'los', 'en'].includes(w))
      .map((w) => w.replace(/(es|as|os|s|a|o)$/, ''));
  const A = limpiar(a);
  const B = limpiar(b);
  if (!A.length || !B.length) return false;
  if (A.join(' ') === B.join(' ')) return true;
  const comunes = A.filter((w) => B.includes(w)).length;
  const minimo = Math.min(A.length, B.length);
  // Todas las palabras de la corta están en la larga (y son al menos dos), o coinciden ≥ 75 %.
  return (comunes === minimo && minimo >= 2) || comunes / Math.max(A.length, B.length) >= 0.75;
}

/** Corre la importación de un grado: crea materias, objetivos y destrezas. Fuera de la petición. */
export async function importarCurriculo(gradoId: number, datos: Buffer): Promise<void> {
  const grado = await prisma.grado.findUnique({ where: { id: gradoId }, include: { materias: { include: { destrezas: true } } } });
  if (!grado) return;
  const fallar = (error: string) => prisma.grado.update({ where: { id: gradoId }, data: { importacionEstado: 'ERROR', importacionError: error } });
  let texto: string;
  try {
    texto = await textoConColumnas(datos);
  } catch (e) {
    return void (await fallar(`No se pudo leer el PDF: ${e instanceof Error ? e.message : String(e)}`));
  }
  const ambitos = partirEnAmbitos(texto);
  if (!ambitos.length) return void (await fallar('En el PDF no aparece ningún «Ámbito de desarrollo y aprendizaje»: tiene que ser el currículo priorizado del Ministerio.'));

  const resumen: string[] = [];
  const errores: string[] = [];
  for (const a of ambitos) {
    const r = await correrAgente<SalidaAmbito>({
      sistema: SISTEMA_AMBITO,
      encargo: `ÁMBITO: ${a.titulo}\n\nTEXTO (con sus columnas etiquetadas):\n\n${a.texto}\n\nTranscríbelo al JSON pedido.`,
      esquema: ESQUEMA_AMBITO,
      esfuerzo: 'low',
      maxSalida: 40_000,
      claveCache: 'planificaciones-curriculo',
    });
    if (!r.ok) {
      errores.push(`${a.titulo}: ${r.error}`);
      continue;
    }
    const s = r.salida;
    const nombre = (s.materia || a.titulo.replace(/^.*:\s*/, '')).trim().slice(0, 120);
    if (!nombre || !s.filas.length) {
      errores.push(`${a.titulo}: sin destrezas`);
      continue;
    }
    // La materia: la que ya exista con ese nombre —o uno PARECIDO: «Compresión y expresión
    // artística» ≈ «Comprensión y expresión artística», «Relaciones lógico matemático» ≈
    // «Relaciones lógico-matemáticas» (Fernando, 2026-09-17: actualizar las materias sin
    // perder las planificaciones ya creadas)— o una nueva. Si se parecía, toma el nombre
    // oficial y sus planificaciones cambian el área de conocimiento a ese nombre.
    let materia = grado.materias.find((m) => m.nombre.trim().toLowerCase() === nombre.toLowerCase()) ?? grado.materias.find((m) => parecidos(m.nombre, nombre));
    if (materia && materia.nombre !== nombre) {
      const viejoNombre = materia.nombre;
      await prisma.$transaction([
        prisma.materiaGrado.update({ where: { id: materia.id }, data: { nombre } }),
        prisma.planificacion.updateMany({ where: { materiaGradoId: materia.id, materia: viejoNombre }, data: { materia: nombre } }),
        prisma.planificacion.updateMany({ where: { materiaGradoId: materia.id, ambito: viejoNombre }, data: { ambito: nombre } }),
        prisma.destreza.updateMany({ where: { materiaGradoId: materia.id }, data: { materia: nombre } }),
      ]);
      materia.nombre = nombre;
      resumen.push(`«${viejoNombre}» pasa a llamarse «${nombre}»`);
    }
    if (!materia) {
      const ultimo = await prisma.materiaGrado.aggregate({ where: { gradoId }, _max: { orden: true } });
      const creada = await prisma.materiaGrado.create({ data: { inquilinoId: grado.inquilinoId, gradoId, nombre, orden: (ultimo._max.orden ?? -1) + 1 }, include: { destrezas: true } });
      materia = creada;
      grado.materias.push(creada);
    }
    // Objetivos: se reemplazan por los del documento.
    await prisma.$transaction([
      prisma.objetivoMateria.deleteMany({ where: { materiaGradoId: materia.id } }),
      ...s.objetivos
        .filter((o) => o.descripcion.trim())
        .map((o, i) => prisma.objetivoMateria.create({ data: { materiaGradoId: materia!.id, codigo: (o.codigo.trim() ? normalizarCodigo(o.codigo) : `O.${i + 1}.`).slice(0, 40), descripcion: o.descripcion.trim(), orden: i } })),
    ]);
    // Destrezas: se actualizan por código (texto, criterio, indicador; el icono y la selección se conservan) o se crean sin seleccionar.
    const porCodigo = new Map(materia.destrezas.map((d) => [normalizarCodigo(d.codigo), d]));
    let orden = materia.destrezas.reduce((x, d) => Math.max(x, d.orden), -1) + 1;
    let nuevas = 0;
    for (const f of s.filas) {
      const codigo = normalizarCodigo(f.destrezaCodigo).slice(0, 40);
      if (!codigo || !f.destreza.trim()) continue;
      const criterio = [f.criterioCodigo.trim(), f.criterio.trim()].filter(Boolean).join(' ') || null;
      const indicador = [f.indicadorCodigo.trim(), f.indicador.trim()].filter(Boolean).join(' ') || null;
      const actual = porCodigo.get(codigo);
      if (actual) {
        await prisma.destreza.update({ where: { id: actual.id }, data: { descripcion: f.destreza.trim(), criterio, indicador } });
      } else {
        const d = await prisma.destreza.create({ data: { inquilinoId: grado.inquilinoId, materiaGradoId: materia.id, nivel: grado.nivel, materia: materia.nombre, codigo, descripcion: f.destreza.trim(), criterio, indicador, activa: false, orden: orden++ } });
        porCodigo.set(codigo, d);
        nuevas++;
      }
    }
    resumen.push(`${nombre}: ${s.filas.length} destrezas (${nuevas} nuevas), ${s.objetivos.length} objetivos`);
  }
  await prisma.grado.update({
    where: { id: gradoId },
    data: {
      importacionEstado: errores.length && !resumen.length ? 'ERROR' : null,
      importacionError: [...resumen, ...errores.map((e) => `⚠ ${e}`)].join('\n') || null,
    },
  });
}

export function importarCurriculoEnSegundoPlano(gradoId: number, datos: Buffer) {
  return importarCurriculo(gradoId, datos).catch(async (e) => {
    console.error('[curriculo]', gradoId, e);
    await prisma.grado.update({ where: { id: gradoId }, data: { importacionEstado: 'ERROR', importacionError: `Fallo inesperado: ${e?.message ?? e}` } }).catch(() => {});
  });
}
