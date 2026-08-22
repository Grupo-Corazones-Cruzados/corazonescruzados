/**
 * EL PIPELINE DEL AGENTE, declarado.
 *
 * ⚠️ REGLA QUE GOBIERNA ESTE ARCHIVO: **cada nodo corresponde a código real y lleva su
 * `archivo`**. Si alguien cambia el runner y no toca esto, el diagrama miente — y un
 * diagrama que miente es peor que no tenerlo, porque se usa para decidir.
 *
 * Antes de tocar aquí, leer el código citado. El orden de los nodos es el orden real de
 * ejecución, y `considerModelOrder` de ELK lo respeta al colocar.
 *
 * Se construye en el SERVIDOR y viaja entero al cliente. Por eso no importa React ni nada
 * de interfaz: los iconos viajan como cadena.
 */

import type { Pipeline, NodoPipeline, Arista, FuenteMeta } from './tipos';

/* ═══════════════════════ FUENTES ═══════════════════════ */

export const FUENTES: Record<string, FuenteMeta> = {
  parametros: {
    id: 'parametros', label: 'Parámetros del canal', origen: 'bd',
    detalle: 'agente_canales · modelo, debounce, ventana, tokens, encendido',
  },
  conexion: {
    id: 'conexion', label: 'Conexión con WhatsApp', origen: 'runtime',
    detalle: 'Meta · número, WABA y estado del alta',
  },
  secretos: {
    id: 'secretos', label: 'Credenciales del cliente', origen: 'bd',
    detalle: 'agente_canales · cifradas con AES-256-GCM, no se pueden volver a leer',
  },
  prompt_perfil: {
    id: 'prompt_perfil', label: 'Perfil del agente', origen: 'bd',
    detalle: 'agente_prompts · tipo perfil_agente — va DENTRO del prefijo cacheado',
  },
  prompt_reglas: {
    id: 'prompt_reglas', label: 'Reglas de negocio', origen: 'bd',
    detalle: 'agente_prompts · tipo reglas_negocio — va FUERA del caché, cambia con los pendientes',
  },
  prompt_resumen: {
    id: 'prompt_resumen', label: 'Prompt de resumen', origen: 'bd',
    detalle: 'agente_prompts · tipo resumen_conversacion',
  },
  conocimiento: {
    id: 'conocimiento', label: 'Conocimiento del negocio', origen: 'bd',
    detalle: 'agente_conocimiento · entra COMPLETO en cada consulta, ordenado y cacheado',
  },
  historial: {
    id: 'historial', label: 'Historial de la conversación', origen: 'bd',
    detalle: 'agente_mensajes · la ventana configurada, más el resumen acumulado',
  },
  herramientas: {
    id: 'herramientas', label: 'Las tres herramientas', origen: 'codigo',
    detalle: 'lib/agente/herramientas.ts · strict, con tool_choice «any»',
  },
  capacidades: {
    id: 'capacidades', label: 'Capacidades del modelo', origen: 'codigo',
    detalle: 'lib/agente/modelos.ts · qué parámetros acepta cada modelo',
  },
  cola: {
    id: 'cola', label: 'Cola de trabajos', origen: 'bd',
    detalle: 'agente_cola · debounce por índice único parcial',
  },
  uso: {
    id: 'uso', label: 'Consumo del modelo', origen: 'bd',
    detalle: 'agente_uso_modelo · tokens de entrada, salida y caché',
  },
};

/* ═══════════════════════ NODOS ═══════════════════════ */

const NODOS: NodoPipeline[] = [
  {
    id: 'webhook', label: 'Llega un mensaje', sublabel: 'Webhook de Meta',
    icono: 'webhook', tipo: 'paso', ejecucion: 'funcion', grupo: 'ingesta',
    archivo: 'app/api/agente/webhook/route.ts',
    bloques: [
      { id: 'e', titulo: 'Entrada', esquema: { metodo: 'POST', cabecera: 'x-hub-signature-256', cuerpo: 'carga cruda de Meta' } },
      { id: 's', titulo: 'Salida', esquema: { respuesta: '200 siempre, salvo firma inválida' } },
    ],
  },
  {
    id: 'firma', label: '¿La firma es válida?', sublabel: 'HMAC-SHA256 sobre el cuerpo CRUDO',
    icono: 'escudo', tipo: 'condicion', ejecucion: 'funcion', grupo: 'ingesta',
    archivo: 'lib/agente/firma.ts',
    bloques: [
      { id: 'e', titulo: 'Entrada', esquema: { cuerpoCrudo: 'string', cabecera: 'sha256=…', appSecret: 'WHATSAPP_APP_SECRET' } },
      { id: 'g', titulo: 'Guarda', esquema: { comparacion: 'timingSafeEqual', nota: 'sobre el cuerpo SIN parsear: un JSON.parse+stringify cambia los bytes y la firma deja de cuadrar' } },
    ],
  },
  {
    id: 'rechazo', label: 'Se rechaza y queda constancia', sublabel: '403 · agente_eventos_webhook',
    icono: 'stop', tipo: 'fin', ejecucion: 'funcion', grupo: 'ingesta',
    archivo: 'app/api/agente/webhook/route.ts',
    bloques: [{ id: 's', titulo: 'Salida', esquema: { http: 403, registro: 'firma_valida = false' } }],
  },
  {
    id: 'lectura', label: 'Se lee la carga', sublabel: 'Función pura, sin red ni base',
    icono: 'codigo', tipo: 'paso', ejecucion: 'funcion', grupo: 'ingesta',
    archivo: 'lib/agente/entrante.ts',
    bloques: [
      { id: 's', titulo: 'Salida', esquema: { phoneNumberId: 'string | null', mensajes: [{ waMessageId: 'string', waId: 'string', tipo: 'text | image | audio | …', texto: 'string | null' }] } },
    ],
  },
  {
    id: 'canal', label: '¿De qué cliente es?', sublabel: 'phone_number_id → canal',
    icono: 'canal', tipo: 'condicion', ejecucion: 'funcion', grupo: 'ingesta',
    archivo: 'lib/agente/canales.ts',
    bloques: [
      { id: 'e', titulo: 'Entrada', esquema: { phone_number_id: 'de metadata, lo manda Meta' } },
      { id: 'g', titulo: 'Guarda', esquema: { indice: 'UNIQUE parcial sobre phone_number_id', nota: 'el aislamiento entre clientes sale del modelo de datos, no de acordarse de filtrar' } },
    ],
    satelites: [
      { id: 's-cfg', label: 'Configuración', icono: 'ajustes', hijos: [
        { id: 's-par', label: 'Parámetros', sublabel: 'modelo, debounce, ventana', icono: 'ajustes', fuenteId: 'parametros' },
        { id: 's-con', label: 'Conexión', sublabel: 'número y estado del alta', icono: 'enchufe', fuenteId: 'conexion' },
        { id: 's-sec', label: 'Credenciales', sublabel: 'cifradas', icono: 'llave', fuenteId: 'secretos' },
      ] },
    ],
  },
  {
    id: 'ingesta', label: 'Se guarda el mensaje', sublabel: 'Contacto, conversación y mensaje',
    icono: 'guardar', tipo: 'paso', ejecucion: 'funcion', grupo: 'ingesta',
    archivo: 'lib/agente/ingesta.ts',
    bloques: [
      { id: 's', titulo: 'Salida', esquema: { conversacionId: 'number', duplicado: 'boolean' } },
      { id: 'g', titulo: 'Guarda', esquema: { idempotencia: 'ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL', nota: 'repetir la condición del índice parcial es obligatorio o Postgres falla' } },
    ],
  },
  {
    id: 'encolar', label: 'Se encola con debounce', sublabel: 'Una ráfaga = una sola corrida',
    icono: 'reloj', tipo: 'paso', ejecucion: 'funcion', grupo: 'ingesta',
    archivo: 'lib/agente/cola.ts',
    bloques: [
      { id: 'e', titulo: 'Entrada', esquema: { conversacionId: 'number', segundos: '@parametros' } },
      { id: 'g', titulo: 'Guarda', esquema: { indice: 'UNIQUE parcial WHERE estado IN (pendiente, procesando)', nota: 'el debounce vive en la BASE, no en un setTimeout: un redeploy no puede perder el mensaje' } },
    ],
    satelites: [{ id: 's-cola', label: 'Cola', sublabel: 'agente_cola', icono: 'reloj', fuenteId: 'cola' }],
  },
  {
    id: 'worker', label: 'El worker lo recoge', sublabel: 'Bucle de 5 s, proceso de larga vida',
    icono: 'engranaje', tipo: 'paso', ejecucion: 'funcion', grupo: 'decision',
    archivo: 'scripts/agente-worker.mjs',
    bloques: [
      { id: 'g', titulo: 'Guarda', esquema: { reclamo: 'FOR UPDATE SKIP LOCKED', colgados: 'se recuperan a los 5 min', enSerie: 'de 5 en 5 y uno detrás de otro: varias llamadas a la vez se comen el límite de la clave del cliente' } },
    ],
  },
  {
    id: 'activo', label: '¿El agente está encendido?', sublabel: 'No se enciende solo, a propósito',
    icono: 'interruptor', tipo: 'condicion', ejecucion: 'funcion', grupo: 'decision',
    archivo: 'lib/agente/runner.ts',
    bloques: [{ id: 'e', titulo: 'Entrada', esquema: { canal: '@parametros', conversacion: 'bot_activo — se apaga solo en el chat que toma una persona' } }],
  },
  {
    id: 'guardado', label: 'Se guarda y no se responde', sublabel: 'El mensaje está en la bandeja',
    icono: 'stop', tipo: 'fin', ejecucion: 'funcion', grupo: 'cierre',
    archivo: 'lib/agente/runner.ts',
    bloques: [{ id: 's', titulo: 'Salida', esquema: { accion: 'omitido' } }],
  },
  {
    id: 'clave', label: '¿Hay clave de IA?', sublabel: 'La pone el cliente',
    icono: 'llave', tipo: 'condicion', ejecucion: 'funcion', grupo: 'decision',
    archivo: 'lib/agente/canales.ts',
    bloques: [
      { id: 'e', titulo: 'Entrada', esquema: { clave: '@secretos' } },
      { id: 'g', titulo: 'Guarda', esquema: { nota: 'si falta o no descifra se ESCALA y se avisa en el panel: un agente mudo en silencio es el peor final posible' } },
    ],
  },
  {
    id: 'sistema', label: 'Se arma el prompt', sublabel: 'Perfil + conocimiento (caché) + reglas',
    icono: 'capas', tipo: 'paso', ejecucion: 'funcion', grupo: 'decision',
    archivo: 'lib/agente/conocimiento.ts',
    bloques: [
      { id: 's', titulo: 'Salida', esquema: { system: ['@prompt_perfil', '@conocimiento', '@prompt_reglas'], messages: '@historial' } },
      { id: 'g', titulo: 'Guarda', esquema: { orden: 'estable, byte a byte: si cambia, el caché se pierde entero', pendientes: 'se CALCULAN del conocimiento, nunca se escriben a mano' } },
    ],
    satelites: [
      { id: 's-ctx', label: 'Contexto', icono: 'capas', hijos: [
        { id: 's-perfil', label: 'Perfil del agente', icono: 'texto', fuenteId: 'prompt_perfil' },
        { id: 's-cono', label: 'Conocimiento', sublabel: 'entra completo', icono: 'libro', fuenteId: 'conocimiento' },
        { id: 's-reglas', label: 'Reglas de negocio', icono: 'texto', fuenteId: 'prompt_reglas' },
        { id: 's-hist', label: 'Historial', sublabel: 'ventana + resumen', icono: 'chat', fuenteId: 'historial' },
      ] },
    ],
  },
  {
    id: 'decidir', label: 'El modelo decide', sublabel: 'Una llamada, una herramienta, sin bucle',
    icono: 'chispa', tipo: 'paso', ejecucion: 'ia', grupo: 'decision',
    archivo: 'lib/agente/ia.ts',
    bloques: [
      { id: 'e', titulo: 'Entrada', esquema: { endpoint: 'POST /v1/responses — las herramientas dan 400 en /v1/chat/completions', model: '@parametros', instructions: '@prompt_perfil', tools: '@herramientas', tool_choice: 'required' } },
      { id: 's', titulo: 'Salida', esquema: { output: 'function_call | message(refusal) | output_text', status: 'completed | incomplete', herramienta: 'responder | no_responder | escalar_a_humano', uso: '@uso' } },
      { id: 'g', titulo: 'Guarda', esquema: { razonamiento: 'CONVIVE con forzar herramienta (los 6 niveles, medido). Lo elige el cliente en Parámetros', refusal: 'llega como content[].refusal, se comprueba ANTES de buscar la herramienta', arguments: 'vienen como CADENA JSON, no como objeto' } },
    ],
    satelites: [
      { id: 's-herr', label: 'Herramientas', icono: 'herramienta', hijos: [
        { id: 's-h1', label: 'responder', sublabel: 'contesta al contacto', icono: 'chat', fuenteId: 'herramientas' },
        { id: 's-h2', label: 'no_responder', sublabel: 'spam o sin intención', icono: 'silencio', fuenteId: 'herramientas' },
        { id: 's-h3', label: 'escalar_a_humano', sublabel: 'pasa a una persona', icono: 'persona', fuenteId: 'herramientas' },
      ] },
      { id: 's-cap', label: 'Capacidades', sublabel: 'qué acepta el modelo', icono: 'codigo', fuenteId: 'capacidades' },
    ],
  },
  {
    id: 'que', label: '¿Qué decidió?', sublabel: 'La herramienta ES la decisión',
    icono: 'bifurcacion', tipo: 'condicion', ejecucion: 'funcion', grupo: 'decision',
    archivo: 'lib/agente/herramientas.ts',
    bloques: [{ id: 'e', titulo: 'Entrada', esquema: { herramienta: '@herramientas' } }],
  },
  {
    id: 'enviar', label: 'Se envía por WhatsApp', sublabel: 'Graph API de Meta',
    icono: 'enviar', tipo: 'paso', ejecucion: 'funcion', grupo: 'cierre',
    archivo: 'lib/agente/whatsapp.ts',
    bloques: [
      { id: 'e', titulo: 'Entrada', esquema: { phone_number_id: '@conexion', token: '@secretos', texto: 'la respuesta ya saneada' } },
      { id: 'g', titulo: 'Guarda', esquema: { saneado: 'se quitan etiquetas inventadas por el modelo antes de enviar', fallo: 'que decidiera bien y el envío falle son dos cosas distintas: el motivo se ve en el panel' } },
    ],
  },
  {
    id: 'callado', label: 'No se responde', sublabel: 'Queda registrado el motivo',
    icono: 'silencio', tipo: 'fin', ejecucion: 'funcion', grupo: 'cierre',
    archivo: 'lib/agente/runner.ts',
    bloques: [{ id: 's', titulo: 'Salida', esquema: { accion: 'callado', motivo: 'nota interna' } }],
  },
  {
    id: 'escalado', label: 'Pasa a una persona', sublabel: 'El bot se apaga en ESTE chat',
    icono: 'persona', tipo: 'fin', ejecucion: 'funcion', grupo: 'cierre',
    archivo: 'lib/agente/runner.ts',
    bloques: [{ id: 's', titulo: 'Salida', esquema: { accion: 'escalado', bot_activo: false, alcance: 'solo esta conversación, no el canal' } }],
  },
  {
    id: 'respondido', label: 'Respondido', sublabel: 'Y anotado el consumo',
    icono: 'ok', tipo: 'fin', ejecucion: 'funcion', grupo: 'cierre',
    archivo: 'lib/agente/ingesta.ts',
    bloques: [{ id: 's', titulo: 'Salida', esquema: { accion: 'respondido', uso: '@uso' } }],
  },
];

const ARISTAS: Arista[] = [
  { desde: 'webhook', hacia: 'firma' },
  { desde: 'firma', hacia: 'rechazo', etiqueta: 'no', variante: 'alterna' },
  { desde: 'firma', hacia: 'lectura', etiqueta: 'sí' },
  { desde: 'lectura', hacia: 'canal' },
  { desde: 'canal', hacia: 'ingesta', etiqueta: 'encontrado' },
  { desde: 'ingesta', hacia: 'encolar' },
  { desde: 'encolar', hacia: 'worker' },
  { desde: 'worker', hacia: 'activo' },
  { desde: 'activo', hacia: 'guardado', etiqueta: 'apagado', variante: 'alterna' },
  { desde: 'activo', hacia: 'clave', etiqueta: 'encendido' },
  { desde: 'clave', hacia: 'escalado', etiqueta: 'falta', variante: 'alterna' },
  { desde: 'clave', hacia: 'sistema', etiqueta: 'hay' },
  { desde: 'sistema', hacia: 'decidir' },
  { desde: 'decidir', hacia: 'que' },
  { desde: 'que', hacia: 'enviar', etiqueta: 'responder' },
  { desde: 'que', hacia: 'callado', etiqueta: 'no_responder', variante: 'alterna' },
  { desde: 'que', hacia: 'escalado', etiqueta: 'escalar', variante: 'alterna' },
  { desde: 'enviar', hacia: 'respondido' },
];

/** Arma el pipeline con el estado real del canal. */
export function construirPipeline(estado: Pipeline['estado']): Pipeline {
  return {
    nodos: NODOS,
    aristas: ARISTAS,
    fuentes: FUENTES,
    atajos: [
      {
        titulo: 'Editar',
        items: [
          { fuenteId: 'prompt_perfil', label: 'Perfil del agente' },
          { fuenteId: 'prompt_reglas', label: 'Reglas de negocio' },
          { fuenteId: 'conocimiento', label: 'Conocimiento' },
          { fuenteId: 'parametros', label: 'Parámetros' },
          { fuenteId: 'conexion', label: 'Conexión' },
        ],
      },
    ],
    estado,
  };
}
