/**
 * EL AGENTE de «Generación de Contenido». Aquí se arma el contexto, se llama al modelo y se
 * convierte lo que vuelve en algo que una persona pueda leer y corregir.
 *
 * Dos decisiones que no son de estilo:
 *
 * 1. **UN ENTREGABLE POR LLAMADA.** No hay un botón que lo genere todo del tirón en una sola
 *    petición. Generar imágenes se pasa del plazo de espera de cabeceras de Node —está
 *    medido en este repo, en `scripts/ilustrar-pasos.mjs`— y una llamada que lo haga todo se
 *    cae ENTERA, llevándose por delante los entregables que ya estaban bien. Además, así se
 *    puede regenerar solo el que no gustó.
 *
 * 2. **CADA ENTREGABLE LEE LOS ANTERIORES.** El short es un recorte del guion largo y el
 *    guion corto cuenta el mismo tema para otra persona: si no ven el guion largo, se
 *    inventan tres videos distintos en vez de uno.
 *
 * El modelo y sus trampas viven en `lib/ia/openai.ts` (temperature/top_p/max_tokens son 400).
 */
import { chatJSON } from '@/lib/ia/openai';
import { claveIA, mensajeDeErrorIA } from '@/lib/ia/openai';
import { cloudinaryConfigured, uploadImage } from '@/lib/cloudinary';
import {
  CARRUSEL_MAX_LAMINAS, CARRUSEL_MIN_LAMINAS, CARRUSEL_TAMANO,
  ENTREGABLE_META, type EntregableTipo, type LaminaRol,
} from '@/lib/centralized/generacion-contenido';
import {
  detalleFuentes, detalleReferencias, getContenido, getPrompts,
  guardarEntregable, reemplazarLaminas, setLaminaImagen,
} from '@/lib/centralized/generacion-contenido-db';

/** Techo de salida por entregable. El guion largo es el que de verdad escribe. */
const TECHO: Record<EntregableTipo, number> = {
  guion_largo: 24000,
  guion_corto: 12000,
  short: 6000,
  carrusel: 12000,
  requerimientos: 12000,
  metadatos: 8000,
};

/* ── El contexto ──────────────────────────────────────────────────────────────── */
async function armarContexto(contenido: any, tipo: EntregableTipo): Promise<string> {
  const partes: string[] = [];

  partes.push(`IDEA DE VIDEO
Tema: ${contenido.tema}
Propósito social: ${contenido.proposito_social || '(sin especificar)'}
Propósito monetario: ${contenido.proposito_monetario || '(sin especificar)'}
Desarrollo del contenido: ${contenido.desarrollo || '(sin especificar)'}
Talento desde el que se habla: ${contenido.talento || '(sin especificar)'}`);

  const tonos: string[] = contenido.tonos || [];
  partes.push(
    tonos.length
      ? `TONOS DE EXPRESIÓN (${tonos.length}): ${tonos.join(', ')}\n` +
        (tonos.length > 1
          ? 'Son VARIOS a la vez: no elijas uno. Encuentra cómo integrarlos para que la mezcla capte la atención.'
          : 'Todo el entregable —lo que se dice, cómo suena y cómo se ve— tiene que sonar así.')
      : 'TONOS DE EXPRESIÓN: no se especificaron. Usa un tono sobrio y directo.',
  );

  const refs = contenido.referencias || [];
  if (refs.length) {
    const detalle = await detalleReferencias(refs);
    partes.push(`REFERENCIA HISTÓRICA — trabajos reales del grupo que este video puede citar:\n\n${detalle.join('\n\n')}`);
  }

  const fuentes = contenido.fuentes || [];
  if (fuentes.length) {
    const detalle = await detalleFuentes(fuentes);
    partes.push(
      `FUENTES DE CONOCIMIENTO — investigación ya clasificada por el grupo (Gestión de Datos).\n` +
      `Es de donde sale lo que se afirma. Cítalas por su nomenclatura cuando aporte credibilidad:\n\n${detalle.join('\n\n')}`,
    );
  }

  // Lo ya escrito para este mismo video. Cada entregable ve lo que necesita, no todo.
  const previos: Record<string, string> = {};
  for (const e of contenido.entregables || []) previos[e.tipo] = e.texto || JSON.stringify(e.datos);
  const necesita = ENTREGABLE_META[tipo].depende;
  for (const dep of necesita) {
    if (previos[dep]) {
      partes.push(`${ENTREGABLE_META[dep].label.toUpperCase()} YA ESCRITO (respétalo, es el mismo video):\n\n${previos[dep]}`);
    }
  }
  // Los requerimientos y los metadatos se hacen mirándolo TODO, no solo el guion largo.
  if (tipo === 'requerimientos' || tipo === 'metadatos') {
    for (const otro of ['guion_corto', 'short', 'carrusel'] as EntregableTipo[]) {
      if (previos[otro]) partes.push(`${ENTREGABLE_META[otro].label.toUpperCase()}:\n\n${previos[otro]}`);
    }
  }

  return partes.join('\n\n──────────\n\n');
}

/* ── De JSON a texto legible ──────────────────────────────────────────────────── */
/**
 * Los guiones se guardan TAMBIÉN como texto corrido, porque es lo que se corrige a mano: el
 * botón de editar abre este texto, no un formulario con treinta campos. La estructura sigue
 * en `datos` por si algún día hace falta.
 */
function bloquesATexto(datos: any): string {
  const lineas: string[] = [];
  if (datos?.titulo) lineas.push(`# ${datos.titulo}`);
  if (datos?.duracion_estimada) lineas.push(`_Duración estimada: ${datos.duracion_estimada}_`);
  for (const b of datos?.bloques || []) {
    lineas.push('');
    lineas.push(`## ${b.nombre || 'Bloque'}${b.duracion ? ` · ${b.duracion}` : ''}`);
    if (b.locucion) lineas.push(b.locucion);
    const ficha: [string, string][] = [
      ['Corte', b.corte], ['Transición', b.transicion], ['Sonido', b.sonido],
      ['Efectos', b.efectos], ['Formato', b.formato], ['Objetos', b.objetos], ['Gestos', b.gestos],
    ].filter(([, v]) => v) as [string, string][];
    if (ficha.length) {
      lineas.push('');
      for (const [k, v] of ficha) lineas.push(`- **${k}:** ${v}`);
    }
  }
  return lineas.join('\n').trim();
}

function shortATexto(d: any): string {
  const l: string[] = [];
  if (d?.titulo) l.push(`# ${d.titulo}`);
  const cab = [d?.duracion_estimada && `Duración: ${d.duracion_estimada}`, d?.bloque_origen && `Sale de: ${d.bloque_origen}`]
    .filter(Boolean).join(' · ');
  if (cab) l.push(`_${cab}_`);
  if (d?.locucion) { l.push(''); l.push(d.locucion); }
  if (d?.texto_en_pantalla) { l.push(''); l.push(`**En pantalla:** ${d.texto_en_pantalla}`); }
  const ficha: [string, string][] = [
    ['Corte', d?.corte], ['Transición', d?.transicion], ['Sonido', d?.sonido], ['Efectos', d?.efectos],
    ['Formato', d?.formato], ['Objetos', d?.objetos], ['Gestos', d?.gestos],
  ].filter(([, v]) => v) as [string, string][];
  if (ficha.length) { l.push(''); for (const [k, v] of ficha) l.push(`- **${k}:** ${v}`); }
  return l.join('\n').trim();
}

function carruselATexto(d: any): string {
  const l: string[] = [];
  if (d?.titulo) l.push(`# ${d.titulo}`);
  (d?.laminas || []).forEach((lam: any, i: number) => {
    l.push('');
    l.push(`## ${i + 1}. ${lam.titulo || ''} (${lam.rol || 'desarrollo'})`);
    if (lam.texto) l.push(lam.texto);
  });
  return l.join('\n').trim();
}

function requerimientosATexto(d: any): string {
  const l: string[] = [];
  for (const g of d?.grupos || []) {
    l.push(`## ${g.titulo || 'Grupo'}`);
    for (const it of g.items || []) {
      l.push(`- ${it.imprescindible === false ? '(deseable) ' : ''}${it.accion}${it.detalle ? ` — ${it.detalle}` : ''}`);
    }
    l.push('');
  }
  return l.join('\n').trim();
}

/* ── Generar un entregable ────────────────────────────────────────────────────── */
export interface ResultadoGeneracion {
  entregable: any;
  laminas?: number;
}

export async function generarEntregable(
  contenidoId: number, tipo: EntregableTipo, userId: string, isAdmin: boolean,
): Promise<ResultadoGeneracion> {
  const contenido = await getContenido(contenidoId, userId, isAdmin);
  if (!contenido) throw new Error('No se encontró la idea de video.');

  // La dependencia se comprueba ANTES de gastar una llamada al modelo: sin guion largo, el
  // short no es un recorte de nada.
  for (const dep of ENTREGABLE_META[tipo].depende) {
    const existe = (contenido.entregables || []).some((e: any) => e.tipo === dep);
    if (!existe) {
      throw new Error(`Antes hay que generar «${ENTREGABLE_META[dep].label}»: ${ENTREGABLE_META[tipo].label} se apoya en él.`);
    }
  }

  const prompts = await getPrompts();
  const system = `${prompts.base}\n\n──────────\n\n${prompts[tipo]}`;
  const user = await armarContexto(contenido, tipo);

  const datos = await chatJSON<any>({
    system,
    user,
    maxTokens: TECHO[tipo],
    etiqueta: `contenido:${tipo}`,
  });

  let texto = '';
  if (tipo === 'guion_largo' || tipo === 'guion_corto') texto = bloquesATexto(datos);
  else if (tipo === 'short') texto = shortATexto(datos);
  else if (tipo === 'carrusel') texto = carruselATexto(datos);
  else if (tipo === 'requerimientos') texto = requerimientosATexto(datos);
  else texto = '';

  const entregable = await guardarEntregable(contenidoId, tipo, texto, datos);

  let laminas: number | undefined;
  if (tipo === 'carrusel') {
    const crudas = Array.isArray(datos?.laminas) ? datos.laminas : [];
    if (crudas.length < CARRUSEL_MIN_LAMINAS) {
      throw new Error(`El agente devolvió ${crudas.length} lámina(s); un carrusel necesita al menos ${CARRUSEL_MIN_LAMINAS}.`);
    }
    const estilo = String(datos?.estilo_visual || '').trim();
    const normalizadas = crudas.slice(0, CARRUSEL_MAX_LAMINAS).map((l: any, i: number) => ({
      rol: (['intro', 'desarrollo', 'cierre'].includes(l?.rol) ? l.rol : (i === 0 ? 'intro' : 'desarrollo')) as LaminaRol,
      titulo: String(l?.titulo ?? ''),
      texto: String(l?.texto ?? ''),
      // El estilo común se pega a CADA lámina: si no, cada imagen sale de un carrusel distinto.
      prompt_visual: [String(l?.prompt_visual ?? ''), estilo].filter(Boolean).join('. '),
    }));
    await reemplazarLaminas(contenidoId, normalizadas);
    laminas = normalizadas.length;
  }

  return { entregable, laminas };
}

/* ── Generar la imagen de UNA lámina ──────────────────────────────────────────── */
/**
 * `gpt-image-2` por `/v1/images/generations`, con la misma clave de OpenAI. Es lo que ya
 * usa `scripts/ilustrar-pasos.mjs` para las ilustraciones del sitio.
 *
 * ⚠️ CON REINTENTOS, Y NO ES POR SI ACASO: generar una imagen tarda a veces más que el plazo
 * de espera de cabeceras de Node y el `fetch` revienta con `UND_ERR_HEADERS_TIMEOUT`. Ese
 * fallo tumbaba la tanda entera cuando se ilustró el sitio.
 *
 * La imagen se sube a Cloudinary y se guarda la URL. En la fila NUNCA: guardar base64 en la
 * base es el problema que este repo ya se quitó de encima una vez.
 */
export async function generarImagenLamina(lamina: any): Promise<string> {
  if (!cloudinaryConfigured()) {
    throw new Error('Cloudinary no está configurado y la imagen del carrusel se guarda ahí, no en la base de datos.');
  }
  const prompt = (lamina.prompt_visual || '').trim();
  if (!prompt) throw new Error('La lámina no trae instrucción visual; regenera el carrusel.');

  let ultimo = '';
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${claveIA()}` },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt,
          size: CARRUSEL_TAMANO,
          output_format: 'png',
          n: 1,
        }),
      });
      if (!res.ok) {
        const cuerpo = await res.text().catch(() => '');
        ultimo = mensajeDeErrorIA(res.status, cuerpo);
        // Un 400 no mejora repitiéndolo: es el prompt o el modelo, no la red.
        if (res.status === 400 || res.status === 401 || res.status === 403) break;
        continue;
      }
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) { ultimo = 'El modelo no devolvió imagen.'; continue; }
      const url = await uploadImage(`data:image/png;base64,${b64}`, 'gcc/contenido/carrusel');
      await setLaminaImagen(lamina.id, url, null);
      return url;
    } catch (e: any) {
      ultimo = e?.cause?.code || e?.message || 'fallo de red';
    }
  }
  await setLaminaImagen(lamina.id, null, ultimo);
  throw new Error(`No se pudo generar la imagen de la lámina ${lamina.orden + 1}: ${ultimo}`);
}
