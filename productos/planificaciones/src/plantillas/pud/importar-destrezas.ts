/**
 * IMPORTAR DESTREZAS DESDE UN DOCUMENTO (Fernando, 2026-09-17): el docente sube
 * el PCA (o cualquier PDF/Word con la tabla de destrezas con criterio de
 * desempeño) y el agente saca las de la materia y el nivel de la planificación
 * —en Preparatoria, la columna «Preparatoria» de la tabla, no las de 3 ni 4
 * años— con su código exacto y su descripción. Transcribe, no redacta.
 */
export type SalidaDestrezas = { destrezas: { codigo: string; descripcion: string }[] };

export const ESQUEMA_DESTREZAS = {
  nombre: 'destrezas_importadas',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['destrezas'],
    properties: {
      destrezas: {
        type: 'array',
        description: 'Las destrezas con criterio de desempeño del nivel pedido, en el orden del documento.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['codigo', 'descripcion'],
          properties: {
            codigo: { type: 'string', description: 'El código exacto, con sus puntos (p. ej. «M.1.4.13.»).' },
            descripcion: { type: 'string', description: 'La descripción completa, tal cual, uniendo las líneas que el PDF partió.' },
          },
        },
      },
    },
  } as Record<string, unknown>,
};

export const SISTEMA_DESTREZAS = `
Eres un transcriptor meticuloso de documentos curriculares del Ecuador (PCA, currículo priorizado). Recibes el TEXTO extraído de un PDF o un Word (las tablas llegan aplanadas: las celdas de una fila salen una tras otra, y a veces las columnas se mezclan) y devuelves en el JSON pedido las DESTREZAS CON CRITERIO DE DESEMPEÑO de la materia y el nivel que se te indican.

REGLAS
1. TRANSCRIBES, NO REDACTAS: el código exacto con sus puntos y la descripción tal cual está, solo uniendo las líneas partidas. No inventes destrezas ni completes descripciones.
2. SOLO LAS DEL NIVEL PEDIDO. En un PCA de Inicial-Preparatoria la tabla «Destrezas con criterios de desempeño» tiene tres columnas: «Destreza 3 años», «Destrezas 4 años» y «Preparatoria»; si el nivel es Preparatoria, devuelves SOLO las de la columna «Preparatoria» (las que llevan código, p. ej. «M.1.4.6.»; las de 3 y 4 años no llevan código y NO van).
3. Una destreza tiene un código con el formato Letras.Número.Número.Número. («CS.1.1.7.», «M.1.4.21.», «LL.1.5.5.», «CN.1.3.15.»). Los objetivos («O.M.1.1.») NO son destrezas: no los incluyas. Los indicadores de evaluación («I.M.1.1.1.») tampoco.
4. Si el código del documento no termina en punto, añádeselo. No repitas códigos.
5. Ignora el resto del documento (datos informativos, objetivos, ejes transversales, bibliografía, firmas).
6. Solo el JSON.
`.trim();
