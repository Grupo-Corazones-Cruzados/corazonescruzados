#!/usr/bin/env node
/**
 * TRAER AUTOMATIZACIONES DESDE LA PLATAFORMA (`gcc_world` → `automatizaciones`).
 *
 * Fernando decidió el 2026-09-23 que «Automatizaciones» dejara de ser una sección de la
 * plataforma y pasara a ser un producto. Esto mueve los datos que ya existen: dos
 * clientes, dos números de WhatsApp conectados y 29.000 mensajes reales.
 *
 *   node scripts/traer-de-la-plataforma.mjs           → trae (y se puede repetir)
 *   node scripts/traer-de-la-plataforma.mjs --contar  → solo cuenta, no escribe
 *
 * ── TRES REGLAS QUE GOBIERNAN ESTE ARCHIVO ──────────────────────────────────────
 *
 * 1. **NO BORRA NADA DE `gcc_world`.** Ni una fila. La sección vieja sigue funcionando
 *    mientras el producto se verifica; apagarla es una decisión posterior y separada.
 *    Si este script borrara, un fallo a mitad dejaría al cliente sin las dos.
 *
 * 2. **SE CONSERVAN LOS IDENTIFICADORES ORIGINALES.** La conversación 412 de la
 *    plataforma es la conversación 412 aquí. Eso da dos cosas de golpe: el script es
 *    repetible sin duplicar (`ON CONFLICT (id) DO NOTHING`) y cualquier fila se puede
 *    rastrear hasta su origen el día que algo no cuadre. Al final se recolocan las
 *    secuencias, o el primer registro nuevo chocaría con uno traído.
 *
 * 3. **EL ORDEN LO MANDAN LAS CLAVES AJENAS.** Inquilinos → automatizaciones → canales
 *    → contactos → conversaciones → mensajes. Cada paso cuenta lo que insertó y lo
 *    imprime: una migración silenciosa no se puede comprobar.
 *
 * ── CÓMO SE REPARTEN LOS FLUJOS EN INQUILINOS ───────────────────────────────────
 * Antes, `flow_clients` decía de qué cliente era cada flujo. Ahora el cliente ES el
 * inquilino:
 *   · flujo 10 «Diego Castillo» → PETER TOURS S.A. — el cliente de verdad, con su
 *     número (+593 99 595 1038) y su histórico.
 *   · flujos 1, 3, 4 y 23       → el inquilino del GRUPO (cortesía): los flujos propios
 *     de GCC, incluido el que se usó para la revisión de Meta.
 */
import 'dotenv/config';
import pg from 'pg';

const soloContar = process.argv.includes('--contar');

if (!process.env.DATABASE_URL) {
  console.error('✖ Falta DATABASE_URL (.env)');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: '-c search_path=automatizaciones,public',
});

/** Cómo se reparten los flujos de la plataforma entre inquilinos de este producto. */
const INQUILINOS = [
  {
    slug: 'grupo',
    nombre: 'Grupo Corazones Cruzados',
    cortesia: true,
    contactoNombre: 'Luis Fernando González Muyulema',
    contactoEmail: 'lfgonzalezm0@grupocc.org',
    flujos: [1, 3, 4, 23],
  },
  {
    slug: 'peter-tours',
    nombre: 'PETER TOURS S.A.',
    cortesia: false,
    contactoNombre: 'Diego Castillo',
    contactoEmail: 'dcastillowork@outlook.com',
    gccClienteId: 8,
    flujos: [10],
  },
];

const TIPO = { ai_agent: 'AGENTE_IA', email: 'CORREO', whatsapp: 'WHATSAPP' };
const ESTADO_AUT = { draft: 'BORRADOR', active: 'ACTIVA', paused: 'PAUSADA' };
const DIRECCION = { entrante: 'ENTRANTE', saliente: 'SALIENTE' };
const ESTADO_CAMPANA = { draft: 'borrador', sent: 'enviada', sending: 'enviando', scheduled: 'programada' };
const ESTADO_ENVIO = { pending: 'pendiente', sent: 'enviado', failed: 'fallido' };

/**
 * Un valor para una columna `jsonb`.
 *
 * ⚠️ HACE FALTA, Y NO ES OBVIO: `pg` convierte un array de JavaScript en un ARRAY DE
 * POSTGRES (`{1,2}`), no en JSON, y la columna lo rechaza con «invalid input syntax for
 * type json». Con un objeto acierta por casualidad; con `[]` falla siempre. Así que
 * todo lo que va a un `jsonb` se manda ya serializado.
 */
const json = (v) => JSON.stringify(v ?? null);

const cuentas = [];
const anota = (paso, n) => { cuentas.push([paso, n]); return n; };

/** Inserta filas conservando el id. Devuelve cuántas entraron de verdad. */
async function copiar(cli, paso, tabla, columnas, filas) {
  if (!filas.length) return anota(paso, 0);
  const cols = columnas.map((c) => `"${c}"`).join(', ');
  let insertadas = 0;
  // De 500 en 500: 29.000 mensajes en una sola sentencia son megas de texto y un
  // parámetro por columna y fila (Postgres topa en 65.535 parámetros por sentencia).
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    const valores = [];
    const marcas = lote
      .map((fila) => `(${fila.map((v) => { valores.push(v); return `$${valores.length}`; }).join(', ')})`)
      .join(', ');
    const { rowCount } = await cli.query(
      `INSERT INTO ${tabla} (${cols}) VALUES ${marcas} ON CONFLICT ("id") DO NOTHING`,
      valores,
    );
    insertadas += rowCount;
  }
  return anota(paso, insertadas);
}

async function main() {
  const cli = await pool.connect();
  try {
    // ── Lo que hay al otro lado, antes de tocar nada
    const { rows: flujos } = await cli.query(
      `SELECT id, name, type, description, status, config, created_at, updated_at, category
         FROM gcc_world.flows ORDER BY id`,
    );
    const deQuien = new Map(); // flujo → inquilino (slug)
    for (const inq of INQUILINOS) for (const f of inq.flujos) deQuien.set(f, inq.slug);
    const huerfanos = flujos.filter((f) => !deQuien.has(f.id));
    if (huerfanos.length) {
      console.error(`✖ Hay flujos sin inquilino asignado: ${huerfanos.map((f) => `${f.id} «${f.name}»`).join(', ')}`);
      console.error('  Añádelos a INQUILINOS antes de seguir: traerlos a ciegas los dejaría sin dueño.');
      process.exit(1);
    }

    if (soloContar) {
      for (const inq of INQUILINOS) {
        const mios = flujos.filter((f) => deQuien.get(f.id) === inq.slug);
        console.log(`· ${inq.slug.padEnd(14)} ${mios.length} flujo(s): ${mios.map((f) => f.name).join(', ')}`);
      }
      return;
    }

    await cli.query('BEGIN');

    // ── 1. El plan
    //
    // Fernando lo fijó el 2026-09-23: 5 $/mes con las tres cosas dentro. No se cobran
    // por separado.
    const { rows: [plan] } = await cli.query(
      `INSERT INTO planes (slug, nombre, descripcion, precio_mensual, max_usuarios,
                           max_automatizaciones, max_conversaciones_mes, meses_retencion, orden, actualizado_en)
            VALUES ('estandar', 'Estándar',
                    'Agente de IA en WhatsApp, campañas de correo y campañas de WhatsApp, todo incluido.',
                    5, 10, 5, NULL, 1, 1, now())
       ON CONFLICT (slug) DO UPDATE SET precio_mensual = EXCLUDED.precio_mensual
         RETURNING id`,
    );

    // ── 2. Inquilinos, su suscripción y su administrador
    const idDe = new Map(); // slug → inquilino_id
    for (const inq of INQUILINOS) {
      const { rows: [fila] } = await cli.query(
        `INSERT INTO inquilinos (slug, nombre, cortesia, estado, gcc_cliente_id,
                                 contacto_nombre, contacto_email, actualizado_en)
              VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
           RETURNING id`,
        [inq.slug, inq.nombre, inq.cortesia, inq.cortesia ? 'ACTIVO' : 'ACTIVO',
         inq.gccClienteId ?? null, inq.contactoNombre, inq.contactoEmail],
      );
      idDe.set(inq.slug, fila.id);

      // La suscripción existe aunque sea de cortesía: la puerta la mira siempre, y un
      // inquilino sin fila sería «suspendido».
      await cli.query(
        `INSERT INTO suscripciones (inquilino_id, plan_id, estado, pagado_hasta, actualizado_en)
              VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (inquilino_id) DO NOTHING`,
        [fila.id, plan.id, inq.cortesia ? 'ACTIVA' : 'PRUEBA',
         // Al cliente de verdad se le deja el mes en curso; el de cortesía no mira esta
         // fecha.
         inq.cortesia ? null : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 0))],
      );

      // Su administrador, con la cuenta de GCC World: sin contraseña aquí.
      await cli.query(
        // `enlazado_por`: quién de GCC autorizó el enlace. Desde la migración 012 es
        // obligatorio para entrar con origen GCC — el cliente no puede enlazar cuentas
        // de la plataforma, solo el equipo (ver `acciones/gccUsuarios.ts`).
        `INSERT INTO usuarios (inquilino_id, usuario, nombre, email, origen, clave_hash, rol, enlazado_por, actualizado_en)
              VALUES ($1, $2, $3, $2, 'GCC', NULL, 'ADMIN', 'migración', now())
         ON CONFLICT (inquilino_id, usuario) DO NOTHING`,
        [fila.id, inq.contactoEmail, inq.contactoNombre],
      );
    }
    anota('inquilinos', INQUILINOS.length);

    /** El usuario del producto que corresponde a un uuid de `gcc_world.users`. */
    const usuarioPara = async (uuid, inquilinoId) => {
      if (!uuid) return null;
      const { rows } = await cli.query(
        `SELECT email, first_name, last_name FROM gcc_world.users WHERE id = $1`, [uuid],
      );
      const u = rows[0];
      if (!u?.email) return null;
      const nombre = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email;
      const { rows: [creado] } = await cli.query(
        `INSERT INTO usuarios (inquilino_id, usuario, nombre, email, origen, clave_hash, rol, enlazado_por, actualizado_en)
              VALUES ($1, $2, $3, $2, 'GCC', NULL, 'OPERADOR', 'migración', now())
         ON CONFLICT (inquilino_id, usuario) DO UPDATE SET usuario = EXCLUDED.usuario
           RETURNING id`,
        [inquilinoId, u.email.toLowerCase(), nombre],
      );
      return creado.id;
    };

    const inqDeFlujo = (f) => idDe.get(deQuien.get(f));

    // ── 3. Automatizaciones (ex `flows`)
    await copiar(cli, 'automatizaciones', 'automatizaciones',
      ['id', 'inquilino_id', 'nombre', 'tipo', 'descripcion', 'categoria', 'estado', 'config', 'creado_en', 'actualizado_en'],
      flujos.map((f) => [
        f.id, inqDeFlujo(f.id), f.name, TIPO[f.type] ?? 'AGENTE_IA', f.description, f.category,
        ESTADO_AUT[f.status] ?? 'BORRADOR', json(f.config ?? {}), f.created_at, f.updated_at ?? f.created_at,
      ]));

    // ── 4. Canales
    const { rows: canales } = await cli.query(`SELECT * FROM gcc_world.agente_canales ORDER BY id`);
    await copiar(cli, 'canales', 'canales',
      ['id', 'inquilino_id', 'automatizacion_id', 'waba_id', 'phone_number_id', 'numero_visible',
       'nombre_verificado', 'wa_token_cifrado', 'ia_api_key_cifrada', 'pin_cifrado', 'ia_proveedor',
       'modelo', 'razonamiento', 'max_tokens', 'debounce_segundos', 'ventana_mensajes', 'bot_activo',
       'estado', 'coexistencia_verificada', 'ultimo_error', 'ultimo_error_en',
       'contactos_sincronizados_en', 'historial_sincronizado_en', 'creado_en', 'actualizado_en'],
      canales.map((c) => [
        c.id, inqDeFlujo(c.flow_id), c.flow_id, c.waba_id, c.phone_number_id, c.numero_visible,
        c.nombre_verificado, c.wa_token_cifrado, c.ia_api_key_cifrada, c.pin_cifrado, c.ia_proveedor,
        c.modelo, c.razonamiento, c.max_tokens, c.debounce_segundos, c.ventana_mensajes, c.bot_activo,
        c.estado, c.coexistencia_verificada, c.ultimo_error, c.ultimo_error_en,
        c.contactos_sincronizados_en, c.historial_sincronizado_en, c.created_at, c.updated_at,
      ]));
    const inqDeCanal = new Map(canales.map((c) => [c.id, inqDeFlujo(c.flow_id)]));

    // ── 5. Contactos
    const { rows: contactos } = await cli.query(`SELECT * FROM gcc_world.agente_contactos ORDER BY id`);
    await copiar(cli, 'contactos', 'contactos',
      ['id', 'inquilino_id', 'canal_id', 'wa_id', 'nombre_perfil', 'nombre_agenda', 'creado_en', 'actualizado_en'],
      contactos.map((c) => [c.id, inqDeCanal.get(c.canal_id), c.canal_id, c.wa_id, c.nombre_perfil,
                            c.nombre_agenda, c.created_at, c.updated_at]));

    // ── 6. Conversaciones
    const { rows: convs } = await cli.query(`SELECT * FROM gcc_world.agente_conversaciones ORDER BY id`);
    const tomadaPor = new Map();
    for (const c of new Set(convs.map((x) => x.tomada_por).filter(Boolean))) {
      // Quien tomó una conversación se crea como usuario DEL INQUILINO de esa
      // conversación: puede ser alguien de GCC atendiendo a un cliente.
      const alguna = convs.find((x) => x.tomada_por === c);
      tomadaPor.set(c, await usuarioPara(c, inqDeCanal.get(alguna.canal_id)));
    }
    await copiar(cli, 'conversaciones', 'conversaciones',
      ['id', 'inquilino_id', 'canal_id', 'contacto_id', 'bot_activo', 'tomada_por_id', 'tomada_en',
       'motivo_escalado', 'resumen', 'resumen_hasta_id', 'ultimo_mensaje_en', 'creado_en', 'actualizado_en'],
      convs.map((c) => [c.id, inqDeCanal.get(c.canal_id), c.canal_id, c.contacto_id, c.bot_activo,
                        tomadaPor.get(c.tomada_por) ?? null, c.tomada_en, c.motivo_escalado, c.resumen,
                        c.resumen_hasta_id, c.ultimo_mensaje_en, c.created_at, c.updated_at]));
    const inqDeConv = new Map(convs.map((c) => [c.id, inqDeCanal.get(c.canal_id)]));

    // ── 7. Plantillas del agente, conocimiento y prompts
    const { rows: plantillas } = await cli.query(`SELECT * FROM gcc_world.agente_plantillas ORDER BY id`);
    await copiar(cli, 'plantillas_agente', 'plantillas_agente',
      ['id', 'inquilino_id', 'canal_id', 'meta_id', 'nombre', 'idioma', 'categoria', 'estado',
       'motivo_rechazo', 'encabezado', 'cuerpo', 'pie', 'variables', 'sincronizado_en', 'creado_en', 'actualizado_en'],
      plantillas.map((p) => [p.id, inqDeCanal.get(p.canal_id), p.canal_id, p.meta_id, p.nombre, p.idioma,
                             p.categoria, p.estado, p.motivo_rechazo, p.encabezado, p.cuerpo, p.pie,
                             json(p.variables ?? []), p.sincronizado_en, p.created_at, p.updated_at]));

    const { rows: conoc } = await cli.query(`SELECT * FROM gcc_world.agente_conocimiento ORDER BY id`);
    await copiar(cli, 'conocimiento', 'conocimiento',
      ['id', 'inquilino_id', 'canal_id', 'clave', 'titulo', 'contenido', 'orden', 'activo', 'creado_en', 'actualizado_en'],
      conoc.map((c) => [c.id, inqDeCanal.get(c.canal_id), c.canal_id, c.clave, c.titulo, c.contenido,
                        c.orden, c.activo, c.created_at, c.updated_at]));

    const { rows: prompts } = await cli.query(`SELECT * FROM gcc_world.agente_prompts ORDER BY id`);
    await copiar(cli, 'prompts', 'prompts',
      ['id', 'inquilino_id', 'canal_id', 'tipo', 'version', 'contenido', 'activo', 'creado_en'],
      prompts.map((p) => [p.id, inqDeCanal.get(p.canal_id), p.canal_id, p.tipo, p.version, p.contenido,
                          p.activo, p.created_at]));

    // ── 8. Listas de contactos y sus contactos (antes de envíos, que las referencian)
    const { rows: listas } = await cli.query(`SELECT * FROM gcc_world.flow_contact_lists ORDER BY id`);
    await copiar(cli, 'listas_contactos', 'listas_contactos',
      ['id', 'inquilino_id', 'automatizacion_id', 'nombre', 'token_compartir', 'compartida_en', 'creado_en'],
      listas.map((l) => [l.id, inqDeFlujo(l.flow_id), l.flow_id, l.name, l.share_token, l.share_created_at,
                         l.created_at ?? new Date()]));
    const inqDeLista = new Map(listas.map((l) => [l.id, inqDeFlujo(l.flow_id)]));

    const { rows: cl } = await cli.query(`SELECT * FROM gcc_world.flow_contacts ORDER BY id`);
    await copiar(cli, 'contactos_lista', 'contactos_lista',
      ['id', 'inquilino_id', 'lista_id', 'nombre', 'email', 'telefono', 'cargo', 'desde_compartir', 'creado_en'],
      cl.map((c) => [c.id, inqDeLista.get(c.list_id), c.list_id, c.name, c.email, c.phone, c.position,
                     c.added_via_share, c.created_at ?? new Date()]));

    // ── 9. Envíos por plantilla (dependen de canal, plantilla y lista)
    const { rows: envios } = await cli.query(`SELECT * FROM gcc_world.agente_envios ORDER BY id`);
    const lanzadoPor = new Map();
    for (const u of new Set(envios.map((e) => e.lanzado_por).filter(Boolean))) {
      const alguno = envios.find((e) => e.lanzado_por === u);
      lanzadoPor.set(u, await usuarioPara(u, inqDeCanal.get(alguno.canal_id)));
    }
    await copiar(cli, 'envios', 'envios',
      ['id', 'inquilino_id', 'canal_id', 'plantilla_id', 'lista_id', 'estado', 'total', 'enviados',
       'fallidos', 'error', 'lanzado_por_id', 'creado_en', 'terminado_en'],
      envios.map((e) => [e.id, inqDeCanal.get(e.canal_id), e.canal_id, e.plantilla_id, e.lista_id, e.estado,
                         e.total, e.enviados, e.fallidos, e.error, lanzadoPor.get(e.lanzado_por) ?? null,
                         e.created_at, e.terminado_en]));

    // ── 10. Mensajes — el grueso: 29.000 filas
    const { rows: mensajes } = await cli.query(`SELECT * FROM gcc_world.agente_mensajes ORDER BY id`);
    await copiar(cli, 'mensajes', 'mensajes',
      ['id', 'inquilino_id', 'conversacion_id', 'direccion', 'wa_message_id', 'tipo', 'texto', 'payload',
       'ubicacion_lat', 'ubicacion_lng', 'ubicacion_texto', 'ubicacion_resuelta_en', 'medio_resuelto_en',
       'herramienta', 'motivo', 'enviado_ok', 'error_envio', 'envio_id', 'creado_en'],
      mensajes.map((m) => [m.id, inqDeConv.get(m.conversacion_id), m.conversacion_id,
                           DIRECCION[m.direccion] ?? 'ENTRANTE', m.wa_message_id, m.tipo, m.texto, json(m.payload),
                           m.ubicacion_lat, m.ubicacion_lng, m.ubicacion_texto, m.ubicacion_resuelta_en,
                           m.medio_resuelto_en, m.herramienta, m.motivo, m.enviado_ok, m.error_envio,
                           m.envio_id, m.created_at]));

    // ── 11. Uso del modelo (lo que costó cada llamada)
    const { rows: uso } = await cli.query(`SELECT * FROM gcc_world.agente_uso_modelo ORDER BY id`);
    await copiar(cli, 'uso_modelo', 'uso_modelo',
      ['id', 'inquilino_id', 'conversacion_id', 'modelo', 'tokens_entrada', 'tokens_salida',
       'tokens_cache_escritura', 'tokens_cache_lectura', 'herramienta', 'duracion_ms', 'creado_en'],
      uso.map((u) => [u.id, inqDeConv.get(u.conversacion_id) ?? idDe.get('grupo'), u.conversacion_id,
                      u.modelo, u.tokens_entrada, u.tokens_salida, u.tokens_cache_escritura,
                      u.tokens_cache_lectura, u.herramienta, u.duracion_ms, u.created_at]));

    // ── 12. Plantillas de WhatsApp de campaña y campañas
    const { rows: pwa } = await cli.query(`SELECT * FROM gcc_world.flow_wa_templates ORDER BY id`);
    await copiar(cli, 'plantillas_wa', 'plantillas_wa',
      ['id', 'inquilino_id', 'automatizacion_id', 'nombre', 'idioma', 'tipo_encabezado', 'encabezado',
       'encabezado_archivo', 'cuerpo', 'pie', 'botones', 'creado_en'],
      pwa.map((p) => [p.id, inqDeFlujo(p.flow_id), p.flow_id, p.name, p.language,
                      p.header_type === 'none' ? 'ninguno' : p.header_type, p.header_content,
                      p.header_filename, p.body, p.footer, json(p.buttons ?? []), p.created_at ?? new Date()]));

    const { rows: camp } = await cli.query(`SELECT * FROM gcc_world.flow_campaigns ORDER BY id`);
    await copiar(cli, 'campanas', 'campanas',
      ['id', 'inquilino_id', 'automatizacion_id', 'remitente', 'asunto', 'cuerpo_html', 'pie_html',
       'adjuntos', 'plantilla_wa_id', 'estado', 'programada_para', 'tipo_programa', 'frecuencia_unidad',
       'frecuencia_intervalo', 'repetir_hasta', 'proxima_en', 'vueltas', 'enviada_en',
       'envio_iniciado_en', 'creado_en', 'actualizado_en'],
      camp.map((c) => [c.id, inqDeFlujo(c.flow_id), c.flow_id, c.from_email, c.subject, c.body_html,
                       c.footer_html, json(c.attachments ?? []), c.wa_template_id,
                       ESTADO_CAMPANA[c.status] ?? 'borrador', c.scheduled_at, c.schedule_kind,
                       c.freq_unit, c.freq_interval, c.recur_until, c.next_run_at, c.run_count,
                       c.sent_at, c.send_started_at, c.created_at ?? new Date(),
                       c.updated_at ?? c.created_at ?? new Date()]));
    const inqDeCampana = new Map(camp.map((c) => [c.id, inqDeFlujo(c.flow_id)]));

    // Las tablas de cruce no tienen `id`: su conflicto es la clave compuesta.
    const { rows: campListas } = await cli.query(`SELECT * FROM gcc_world.flow_campaign_lists`);
    let nCL = 0;
    for (const x of campListas) {
      const { rowCount } = await cli.query(
        `INSERT INTO campana_listas (campana_id, lista_id, creado_en) VALUES ($1,$2,$3)
         ON CONFLICT (campana_id, lista_id) DO NOTHING`, [x.campaign_id, x.list_id, x.created_at]);
      nCL += rowCount;
    }
    anota('campana_listas', nCL);

    const { rows: pl } = await cli.query(`SELECT * FROM gcc_world.agente_plantilla_listas`);
    let nPL = 0;
    for (const x of pl) {
      const { rowCount } = await cli.query(
        `INSERT INTO plantilla_listas (plantilla_id, lista_id, creado_en) VALUES ($1,$2,$3)
         ON CONFLICT (plantilla_id, lista_id) DO NOTHING`, [x.plantilla_id, x.lista_id, x.created_at]);
      nPL += rowCount;
    }
    anota('plantilla_listas', nPL);

    const { rows: cs } = await cli.query(`SELECT * FROM gcc_world.flow_campaign_sends ORDER BY id`);
    await copiar(cli, 'campana_envios', 'campana_envios',
      ['id', 'inquilino_id', 'campana_id', 'contacto_nombre', 'contacto_email', 'resend_id', 'estado',
       'error', 'enviado_en'],
      cs.map((s) => [s.id, inqDeCampana.get(s.campaign_id), s.campaign_id, s.contact_name, s.contact_email,
                     s.resend_id, ESTADO_ENVIO[s.status] ?? 'pendiente', s.error_message, s.sent_at]));

    // ── 13. Recolocar las secuencias.
    //
    // Sin esto, el primer registro NUEVO que cree el producto pediría el id 1 y chocaría
    // con uno traído. Es el paso que se olvida y revienta en producción, no aquí.
    const conId = ['automatizaciones', 'canales', 'contactos', 'conversaciones', 'mensajes',
                   'conocimiento', 'prompts', 'plantillas_agente', 'envios', 'uso_modelo',
                   'listas_contactos', 'contactos_lista', 'campanas', 'campana_envios', 'plantillas_wa'];
    for (const t of conId) {
      await cli.query(
        `SELECT setval(pg_get_serial_sequence('automatizaciones.${t}', 'id'),
                       GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${t}), 1))`,
      );
    }
    anota('secuencias recolocadas', conId.length);

    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cli.release();
  }

  for (const [paso, n] of cuentas) console.log(`  ${String(n).padStart(6)}  ${paso}`);
  console.log('\n✔ Traído. En `gcc_world` no se ha borrado ni modificado nada.');
}

main()
  .catch((e) => { console.error('\n✖', e.message); process.exit(1); })
  .finally(() => pool.end());
