/**
 * NOTAS DE VOZ E IMÁGENES: convertirlas en texto para que el agente pueda contestarlas.
 *
 * ── EL PROBLEMA ───────────────────────────────────────────────────────────────────────
 * Media clientela de Peter Tours manda audios en vez de escribir, y fotos de la pantalla
 * de una transferencia o de la ubicación de un destino. Todo eso llegaba al webhook, se
 * guardaba… y **sin texto**. El agente veía un mensaje en blanco, y en la bandeja el
 * equipo veía otro: no había forma ni de contestarlo ni de saber qué decía.
 *
 * ── LA DECISIÓN: CONVERTIR A TEXTO Y GUARDARLO ────────────────────────────────────────
 * En vez de mandarle el audio o la imagen al modelo en cada turno, se convierten **una vez**
 * y el resultado se guarda en `texto`, como si el cliente lo hubiera escrito. Tres ventajas
 * que no da la otra vía:
 *
 *  · Se paga **una sola vez** por medio, no una por cada mensaje posterior de esa
 *    conversación —el historial entero viaja en cada llamada—.
 *  · **La bandeja lo enseña.** El equipo de Peter Tours lee la transcripción sin abrir el
 *    audio, que es lo que de verdad les ahorra tiempo.
 *  · El resumen largo de la conversación y las búsquedas funcionan solas, porque todo es
 *    texto en la misma columna.
 *
 * ── CON LA CLAVE DEL CLIENTE ──────────────────────────────────────────────────────────
 * Las dos llamadas van con la clave de IA **del cliente**, la misma que ya usa el agente
 * para pensar. Es su cuenta, su gasto y sus datos: ni un audio de un cliente suyo pasa por
 * una clave nuestra.
 */

import OpenAI from 'openai';
import { pool } from '@/lib/db';
import { descargarMedio } from './whatsapp';

/** El modelo de transcripción de OpenAI. Uno solo, y aquí. */
const MODELO_TRANSCRIPCION = 'gpt-transcribe';

/**
 * El modelo que mira las imágenes. Es el MISMO que piensa (`lib/ia/openai.ts`): no hay que
 * mantener dos, y el cliente no paga una tarifa distinta por mirar una foto.
 */
import { MODELO_IA } from '@/lib/ia/openai';

/**
 * Los tipos de los que SÍ merece la pena sacar texto: una nota de voz y una foto llevan
 * dentro lo que el cliente quiere decir.
 *
 * El sticker, el video y el documento se quedan fuera a propósito. Ya llegan con su
 * etiqueta desde `entrante.ts` —«[sticker]», «[video]»— y describirlos con el modelo
 * sería pagar por «un dibujo de un gato con corazones»: no hay nada ahí que contestar.
 */
const CON_MEDIO = new Set(['audio', 'voice', 'image']);

/**
 * De dónde sale el identificador del archivo dentro de la carga cruda de Meta.
 * Se guarda entera en `payload` al ingerir, así que no hace falta ninguna columna nueva.
 */
function idDelMedio(crudo: any, tipo: string): string | null {
  return crudo?.[tipo]?.id ?? crudo?.audio?.id ?? crudo?.image?.id ?? null;
}

/**
 * Transcribe una nota de voz.
 *
 * ⚠️ WhatsApp manda los audios en **OGG/Opus**, que la API acepta pero necesita reconocer:
 * si el archivo va sin nombre, se rechaza por formato. Por eso se construye un `File` con
 * una extensión coherente con su tipo — no es decorativo, es lo que hace que funcione.
 */
async function transcribir(clave: string, bytes: Buffer, mime: string): Promise<string | null> {
  const cliente = new OpenAI({ apiKey: clave });
  const extension = mime.includes('mpeg') ? 'mp3'
    : mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
    : mime.includes('wav') ? 'wav'
    : mime.includes('webm') ? 'webm'
    : 'ogg';

  const archivo = new File([new Uint8Array(bytes)], `nota.${extension}`, { type: mime });

  const r = await cliente.audio.transcriptions.create({
    file: archivo,
    model: MODELO_TRANSCRIPCION,
    // La clientela de Peter Tours habla español. Decírselo evita que un audio corto y con
    // ruido se transcriba «traducido» a otro idioma, que es el fallo típico de estos
    // modelos cuando dudan.
    languages: ['es'],
  } as any);

  const texto = (r as any)?.text?.trim();
  return texto || null;
}

/**
 * Describe una imagen, **transcribiendo lo que ponga en ella**.
 *
 * Lo segundo importa más que lo primero: la mayoría de las fotos que manda un cliente son
 * capturas —un comprobante de transferencia, un horario, una dirección— y lo que hace
 * falta para responder es el DATO que hay escrito, no «una captura de pantalla».
 */
async function describir(clave: string, bytes: Buffer, mime: string): Promise<string | null> {
  const cliente = new OpenAI({ apiKey: clave });
  const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;

  const r: any = await cliente.responses.create({
    model: MODELO_IA,
    // Sin razonamiento: describir lo que se ve no lo necesita y encarece cada foto.
    reasoning: { effort: 'none' },
    max_output_tokens: 400,
    store: false,
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: 'Describe brevemente esta imagen que un cliente envió por WhatsApp, en español y en 1-3 frases. '
              + 'Si contiene texto, números, importes, fechas o una dirección, TRANSCRÍBELOS literalmente: '
              + 'suele ser el dato por el que escribe. No saludes ni añadas comentarios.',
        },
        { type: 'input_image', image_url: dataUrl, detail: 'auto' },
      ],
    }],
  } as any);

  const texto = (r?.output_text ?? '').trim();
  return texto || null;
}

/**
 * Resuelve los medios pendientes de una conversación. Se llama ANTES de armar el prompt.
 *
 * Nunca lanza: un audio que no se deja transcribir no puede tumbar la respuesta al resto
 * de la conversación. Lo que hace es **marcarlo como intentado** y seguir — así el agente
 * contesta a lo que sí entendió, y no se reintenta ese archivo para siempre.
 */
export async function resolverMedios(
  conversacionId: number,
  claveIA: string,
  tokenWa: string | null,
): Promise<number> {
  if (!tokenWa) return 0;

  /**
   * ⇒ QUÉ SE CONVIERTE Y QUÉ NO (decisión de Fernando, 2026-08-30):
   *
   *   · **Audios, vengan de quien vengan.** Los del cliente, para que el agente pueda
   *     contestarlos; los del EQUIPO, para que en la bandeja se lea lo que dijeron sin
   *     tener que reproducir el audio. Una nota de voz de veinte segundos se lee en dos.
   *   · **Imágenes solo del cliente.** Las que manda el equipo ya saben ellos lo que son
   *     —las acaban de enviar—, y describirlas sería pagar por contarles su propia foto.
   *     Esas se quedan con su etiqueta «[imagen]».
   */
  const { rows } = await pool.query(
    `SELECT id, tipo, direccion, payload
       FROM gcc_world.agente_mensajes
      WHERE conversacion_id = $1
        AND medio_resuelto_en IS NULL
        AND (texto IS NULL OR texto = '')
        AND (
          direccion = 'entrante'
          OR (direccion = 'saliente' AND herramienta = 'equipo' AND tipo IN ('audio', 'voice'))
        )
      ORDER BY id
      LIMIT 10`,
    [conversacionId],
  );

  let resueltos = 0;

  for (const m of rows) {
    const tipo = String(m.tipo);
    if (!CON_MEDIO.has(tipo)) {
      // Ni audio ni imagen —un contacto compartido, una reacción—: no hay archivo del que
      // sacar texto. Se deja constancia para que el agente sepa que el cliente mandó algo,
      // y se marca para no volver a mirarlo.
      await pool.query(
        `UPDATE gcc_world.agente_mensajes SET texto = $2, medio_resuelto_en = NOW() WHERE id = $1`,
        [m.id, `[El cliente envió algo que no es texto (${tipo})]`],
      );
      continue;
    }

    let texto: string | null = null;
    try {
      const mediaId = idDelMedio(m.payload, tipo);
      const medio = mediaId ? await descargarMedio(mediaId, tokenWa) : null;

      if (medio) {
        const esAudio = medio.mime.startsWith('audio') || tipo === 'audio' || tipo === 'voice';
        const esImagen = medio.mime.startsWith('image') || tipo === 'image';
        if (esAudio) texto = await transcribir(claveIA, medio.bytes, medio.mime);
        else if (esImagen) texto = await describir(claveIA, medio.bytes, medio.mime);
      }
    } catch (err: any) {
      // Se registra y se sigue. Un medio ilegible no puede dejar sin respuesta al cliente.
      console.error('[agente/medios] no se pudo leer', m.id, err?.message);
    }

    /**
     * ⚠️ SI NO SE PUDO LEER, SE ESCRIBE QUE NO SE PUDO. Nunca se deja en blanco.
     *
     * `historialDe` descarta los mensajes sin texto, así que un audio ilegible sería
     * INVISIBLE para el agente: el cliente manda una nota de voz, no recibe respuesta y no
     * entiende por qué. Con esta línea el agente sabe que llegó algo y puede pedirle que
     * lo escriba — que es exactamente lo que haría una persona.
     */
    const delEquipo = m.direccion === 'saliente';
    const constancia = texto ?? (
      tipo === 'audio' || tipo === 'voice'
        ? (delEquipo ? '[Nota de voz que no se pudo transcribir]'
                     : '[El cliente envió una nota de voz que no se pudo escuchar]')
        : tipo === 'image'
          ? '[El cliente envió una imagen que no se pudo ver]'
          : `[El cliente envió un archivo (${tipo}) que no se puede leer por aquí]`
    );

    await pool.query(
      `UPDATE gcc_world.agente_mensajes SET texto = $2, medio_resuelto_en = NOW() WHERE id = $1`,
      [m.id, constancia],
    );
    if (texto) resueltos++;
  }

  return resueltos;
}
