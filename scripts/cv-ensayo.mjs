/**
 * ENSAYO EN SECO DEL CV PÚBLICO — la verificación que ni `tsc` ni `next build` dan.
 *
 *   npm run build && npx next start -p 3099 &
 *   node scripts/cv-ensayo.mjs            # o ENSAYO_BASE=https://… para producción
 *
 * Siembra un CV completo en el miembro de PRUEBA (id 3), recorre las cuatro puertas
 * —página, JSON, imagen y PDF—, comprueba que revocar apaga las cuatro, y **deja la
 * base exactamente como estaba**: compara el inventario antes y después y aborta si
 * el miembro de prueba tuviera datos que borrar.
 *
 * Hermano de `scripts/agente-ensayo.mjs`, y por el mismo motivo: la primera vez que
 * se corrió encontró que **el PDF daba 500 al incrustar una imagen**
 * (`pdfkit.standalone` empaquetado no reconoce un `Buffer` de Node). Ese fallo no lo
 * caza el typecheck, ni el build, ni la base de datos: solo ejecutarlo de verdad.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { writeFileSync } from 'node:fs';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BASE = process.env.ENSAYO_BASE || 'http://127.0.0.1:3099';
const MIEMBRO = '3';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=gcc_world,public' });

let fallos = 0;
const ok = (c, msg) => { console.log(`${c ? '✔' : '✖'} ${msg}`); if (!c) fallos++; };

async function inventario() {
  const q = async (sql) => (await pool.query(sql)).rows[0].n;
  return {
    cv: await q(`SELECT count(*)::int n FROM gcc_world.member_cv_profiles WHERE member_id = ${MIEMBRO}`),
    portafolio: await q(`SELECT count(*)::int n FROM gcc_world.member_portfolio_items WHERE member_id = ${MIEMBRO}`),
    horario: await q(`SELECT count(*)::int n FROM gcc_world.member_schedules WHERE member_id = ${MIEMBRO}`),
    servicios: await q(`SELECT count(*)::int n FROM gcc_world.services WHERE member_id = ${MIEMBRO}`),
    token: await q(`SELECT count(*)::int n FROM gcc_world.members WHERE id = ${MIEMBRO} AND cv_public_token IS NOT NULL`),
    redes: await q(`SELECT count(*)::int n FROM gcc_world.users
                     WHERE member_id = ${MIEMBRO}
                       AND COALESCE(youtube_handle, tiktok_handle, instagram_handle, facebook_handle) IS NOT NULL`),
  };
}

// PNG rojo de 2×2, suficiente para probar el camino de la imagen y el del PDF.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8BQz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC';

async function sembrar() {
  await pool.query(`
    INSERT INTO gcc_world.member_cv_profiles (member_id, bio, skills, languages, linkedin_url, website_url, talents,
      headline, location, salary_min, salary_max, salary_visible,
      job_status, job_available_from, job_workday, job_mode, job_note, share_email, share_phone)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 1200, 1800, true,
            'from_date', '2026-09-01', 'both', 'hybrid', 'Con disponibilidad para viajar', true, true)
    ON CONFLICT (member_id) DO UPDATE SET bio = EXCLUDED.bio`,
    [MIEMBRO,
     'Perfil de ensayo con acentos: ñ, á, é, í, ó, ú, ü y «comillas».',
     ['React', 'PostgreSQL', 'Next.js'],
     ['Español', 'Inglés'],
     'https://linkedin.com/in/ensayo', 'https://ejemplo.test',
     JSON.stringify([{
       key: 'Desarrollo de software',
       education: [{ institution: 'Universidad de Ensayo', degree: 'Ingeniería', field: 'Sistemas', start_year: '2014', end_year: '2019' }],
       experience: [{ company: 'Empresa Ñ', position: 'Desarrollador', description: 'Construcción de la plataforma interna.', start_year: '2019', end_year: 'Actual' }],
     }, { key: 'Diseño', education: [], experience: [] }]),
     'Desarrollador full-stack', 'Guayaquil, Ecuador']);

  await pool.query(
    `INSERT INTO gcc_world.member_portfolio_items (member_id, title, description, item_type, tags, images, image_url, project_url, cost, sort_order)
     VALUES ($1, 'Proyecto de ensayo', 'Descripción del proyecto de ensayo.', 'project', ARRAY['React','API'], ARRAY[$2::text], $2, 'https://ejemplo.test/p', 999, 1)`,
    [MIEMBRO, PNG]);

  await pool.query(
    `INSERT INTO gcc_world.member_schedules (member_id, day_of_week, start_time, end_time, is_active)
     VALUES ($1,1,'09:00','17:00',true), ($1,2,'09:00','17:00',true)`, [MIEMBRO]);

  await pool.query(
    `INSERT INTO gcc_world.services (member_id, name, description, base_price, is_active, talent)
     VALUES ($1, 'Servicio de ensayo', null, 0, true, 'Desarrollo de software')`, [MIEMBRO]);

  // Redes: se siembran EN CRUDO (un @usuario y una URL sin protocolo) para que el
  // ensayo compruebe que la normalización ocurre al LEER, no solo al guardar desde
  // el formulario. Hay filas anteriores a la migración 035 justo así.
  await pool.query(
    `UPDATE gcc_world.users SET youtube_handle = $2, tiktok_handle = $3,
            instagram_handle = $4, facebook_handle = $5
      WHERE member_id = $1`,
    [MIEMBRO, 'https://www.youtube.com/@ensayo', '@ensayo',
     'www.instagram.com/ensayo', 'https://evil.example.com/no']);

  const token = (await pool.query(
    `UPDATE gcc_world.members SET cv_public_token = encode(gen_random_bytes(32),'hex'), cv_public_token_created_at = NOW()
      WHERE id = $1 RETURNING cv_public_token`, [MIEMBRO])).rows[0].cv_public_token;
  return token;
}

async function limpiar() {
  await pool.query(`DELETE FROM gcc_world.member_cv_profiles WHERE member_id = ${MIEMBRO}`);
  await pool.query(`DELETE FROM gcc_world.member_portfolio_items WHERE member_id = ${MIEMBRO}`);
  await pool.query(`DELETE FROM gcc_world.member_schedules WHERE member_id = ${MIEMBRO}`);
  await pool.query(`DELETE FROM gcc_world.services WHERE member_id = ${MIEMBRO}`);
  await pool.query(`UPDATE gcc_world.members SET cv_public_token = NULL, cv_public_token_created_at = NULL WHERE id = ${MIEMBRO}`);
  await pool.query(`UPDATE gcc_world.users SET youtube_handle = NULL, tiktok_handle = NULL,
                           instagram_handle = NULL, facebook_handle = NULL WHERE member_id = ${MIEMBRO}`);
}

async function main() {
  const antes = await inventario();
  console.log('Inventario antes:', antes);
  if (antes.cv || antes.portafolio || antes.horario || antes.servicios) {
    console.error('✖ ABORTADO: el miembro de prueba YA tiene datos; el ensayo los borraría.');
    process.exit(1);
  }

  const token = await sembrar();
  console.log(`\nToken de ensayo: ${token.slice(0, 12)}…\n`);

  try {
    // ── 1. JSON ──────────────────────────────────────────────────────────────
    const rJson = await fetch(`${BASE}/api/cv/${token}`);
    ok(rJson.status === 200, `JSON responde 200 (fue ${rJson.status})`);
    const cv = await rJson.json();
    ok(cv.nombre === 'Miembro de Prueba', `nombre: ${cv.nombre}`);
    ok(cv.salario?.min === 1200 && cv.salario?.max === 1800, `salario: ${JSON.stringify(cv.salario)}`);
    ok(cv.disponibilidad?.estado === 'from_date' && cv.disponibilidad?.desde === '2026-09-01', `disponibilidad: ${cv.disponibilidad?.estado} ${cv.disponibilidad?.desde}`);
    ok(cv.talentos?.length === 2, `talentos: ${cv.talentos?.length}`);
    ok(cv.talentos?.[0]?.servicios?.[0] === 'Servicio de ensayo', 'el servicio activo cuelga de su talento');
    ok(cv.talentos?.[1]?.experiencia?.length === 0, 'el talento sin trayectoria no inventa entradas');
    ok(cv.portafolio?.length === 1 && cv.portafolio[0].imagenes === 1, `portafolio: ${cv.portafolio?.length} ítem, ${cv.portafolio?.[0]?.imagenes} imagen`);
    ok(!('price' in (cv.portafolio?.[0] || {})) && !('precio' in (cv.portafolio?.[0] || {})), 'el portafolio NO lleva precio');
    ok(cv.correo === 'miembro@prueba.com' || typeof cv.correo === 'string', `correo publicado: ${cv.correo}`);
    ok(cv.disponibilidad?.horario?.length === 2, `horario: ${cv.disponibilidad?.horario?.length} franjas`);
    ok(rJson.headers.get('x-robots-tag')?.includes('noindex'), 'el JSON manda X-Robots-Tag noindex');

    // ── 1a bis. REDES: enlaces absolutos, de su red, y los malos no salen ────
    const redes = Object.fromEntries((cv.redes || []).map((r) => [r.red, r.url]));
    ok((cv.redes || []).every((r) => /^https:\/\//.test(r.url)),
       `todas las redes son URL absolutas https (${(cv.redes || []).length})`);
    ok(redes.tiktok === 'https://www.tiktok.com/@ensayo', `un @usuario se compone: ${redes.tiktok}`);
    ok(redes.instagram === 'https://www.instagram.com/ensayo', `sin protocolo se completa: ${redes.instagram}`);
    ok(!('facebook' in redes), 'una URL de otro dominio NO se publica como Facebook');
    ok(!('linkedin' in cv), 'ya no hay campos sueltos `linkedin`/`web`; todo va en `redes`');

    // ── 1b. Contacto apagado ⇒ NO sale del servidor ──────────────────────────
    await pool.query(`UPDATE gcc_world.member_cv_profiles SET share_phone = false, share_email = false WHERE member_id = ${MIEMBRO}`);
    const cv2 = await (await fetch(`${BASE}/api/cv/${token}`)).json();
    ok(!('telefono' in cv2) && !('correo' in cv2), 'con los interruptores apagados, correo y teléfono NO están en el JSON');
    await pool.query(`UPDATE gcc_world.member_cv_profiles SET share_phone = true, share_email = true WHERE member_id = ${MIEMBRO}`);

    // ── 1c. Salario oculto ───────────────────────────────────────────────────
    await pool.query(`UPDATE gcc_world.member_cv_profiles SET salary_visible = false WHERE member_id = ${MIEMBRO}`);
    const cv3 = await (await fetch(`${BASE}/api/cv/${token}`)).json();
    ok(!('salario' in cv3), 'con el rango oculto, el salario NO está en el JSON');
    await pool.query(`UPDATE gcc_world.member_cv_profiles SET salary_visible = true WHERE member_id = ${MIEMBRO}`);

    // ── 2. Página ────────────────────────────────────────────────────────────
    const rPag = await fetch(`${BASE}/cv/${token}`);
    const html = await rPag.text();
    ok(rPag.status === 200, `la página responde 200 (fue ${rPag.status})`);
    ok(html.includes('Miembro de Prueba'), 'el nombre está en el HTML crudo');
    ok(html.includes('Proyecto de ensayo'), 'el portafolio está en el HTML crudo (no solo como prop)');
    ok(html.includes('Universidad de Ensayo'), 'la formación está en el HTML crudo');
    ok(/1\.200|1200/.test(html) && /1\.800|1800/.test(html), 'el rango salarial está en el HTML');
    ok(/<meta name="robots"[^>]*noindex/i.test(html), 'la página declara noindex');
    ok(html.includes('maximum-scale=5') || html.includes('user-scalable=yes'), 'el viewport permite ampliar (zoom desbloqueado)');
    ok(html.includes('href="https://www.tiktok.com/@ensayo"'), 'el botón de la red lleva una URL absoluta en el HTML');
    ok(!/href="www\./.test(html), 'ningún href se queda sin protocolo (sería una ruta relativa)');

    // ── 3. Imagen ────────────────────────────────────────────────────────────
    const itemId = cv.portafolio[0].id;
    const rImg = await fetch(`${BASE}/api/cv/${token}/imagen?item=${itemId}&i=0&w=480`);
    ok(rImg.status === 200 && rImg.headers.get('content-type') === 'image/webp', `imagen: ${rImg.status} ${rImg.headers.get('content-type')}`);
    const rImgAjena = await fetch(`${BASE}/api/cv/${token}/imagen?item=999999&i=0&w=480`);
    ok(rImgAjena.status === 404, `con el id de un ítem ajeno responde 404 (fue ${rImgAjena.status})`);

    // ── 4. PDF ───────────────────────────────────────────────────────────────
    const rPdf = await fetch(`${BASE}/api/cv/${token}/pdf`);
    const pdf = Buffer.from(await rPdf.arrayBuffer());
    ok(rPdf.status === 200, `el PDF responde 200 (fue ${rPdf.status})`);
    ok(pdf.subarray(0, 5).toString() === '%PDF-', `es un PDF de verdad (cabecera: ${pdf.subarray(0, 5).toString()})`);
    ok(pdf.length > 3000, `el PDF pesa ${(pdf.length / 1024).toFixed(1)} KB`);
    ok(pdf.includes(Buffer.from('/Image')) || pdf.includes(Buffer.from('DCTDecode')), 'el PDF lleva la imagen del portafolio incrustada');
    ok((rPdf.headers.get('content-disposition') || '').includes('attachment'), 'se descarga como adjunto');
    writeFileSync('/tmp/cv-ensayo.pdf', pdf);
    console.log('   → guardado en /tmp/cv-ensayo.pdf');

    // ── 4b. Los PROYECTOS de la app (solo lectura, contra una cuenta real) ───
    // El miembro de prueba no participa en ningún proyecto, así que este camino se
    // comprueba contra una cuenta que sí — sin escribir nada. Si no tiene enlace
    // generado, se salta y se dice: **un ensayo que se salta algo lo anuncia**.
    const { rows: [real] } = await pool.query(
      `SELECT id, cv_public_token FROM gcc_world.members
        WHERE cv_public_token IS NOT NULL AND is_active = true
        ORDER BY id LIMIT 1`);
    if (!real) {
      console.log('◻ SALTADO: ningún miembro tiene enlace generado, no se comprueba el camino de los proyectos');
    } else {
      const rr = await fetch(`${BASE}/api/cv/${real.cv_public_token}`);
      const cvr = await rr.json();
      const proyectos = (cvr.portafolio || []).filter((x) => x.fuente === 'proyecto');
      const { rows: [esperado] } = await pool.query(
        `SELECT count(*)::int AS n FROM gcc_world.projects p
          WHERE p.status = 'completed'
            AND (EXISTS (SELECT 1 FROM gcc_world.project_bids b
                          WHERE b.project_id = p.id AND b.member_id = $1 AND b.status = 'accepted')
              OR EXISTS (SELECT 1 FROM gcc_world.requirement_assignments ra
                           JOIN gcc_world.project_requirements pr ON pr.id = ra.requirement_id
                          WHERE pr.project_id = p.id AND ra.member_id = $1 AND ra.status = 'accepted'))`,
        [real.id]);
      ok(proyectos.length === esperado.n, `salen los ${esperado.n} proyectos completados en los que participa (${proyectos.length})`);

      // Lo que NO debe salir: nada que no esté completado.
      const { rows: noCompletados } = await pool.query(
        `SELECT p.title FROM gcc_world.projects p WHERE p.status <> 'completed'`);
      const titulos = new Set(proyectos.map((x) => x.titulo));
      const colados = noCompletados.filter((x) => titulos.has(x.title));
      ok(colados.length === 0, `ningún borrador ni cotización se cuela (${colados.map((c) => c.title).join(', ') || 'ninguno'})`);

      if (proyectos.length) {
        const conFoto = proyectos.find((x) => x.imagenes > 0);
        if (conFoto) {
          // ⚠️ Aquí NO se exige `image/webp`. Las imágenes ya migradas a Cloudinary
          // se sirven con una REDIRECCIÓN a su transformación de ancho, y llegan en
          // el formato que elija Cloudinary; solo las que siguen en base64 pasan por
          // `sharp`. Exigir webp hacía fallar el camino que MÁS se usa.
          const ri = await fetch(`${BASE}/api/cv/${real.cv_public_token}/imagen?fuente=proyecto&item=${conFoto.id}&i=0&w=480`);
          const tipo = ri.headers.get('content-type') || '';
          ok(ri.status === 200 && tipo.startsWith('image/'), `la imagen de un proyecto se sirve (${ri.status} ${tipo})`);
        }
        // El token del miembro de PRUEBA no puede sacar la imagen de un proyecto ajeno.
        const rx = await fetch(`${BASE}/api/cv/${token}/imagen?fuente=proyecto&item=${proyectos[0].id}&i=0&w=480`);
        ok(rx.status === 404, `con otro token, la imagen de ese proyecto da 404 (fue ${rx.status})`);
      }
    }

    // ── 5. Token inválido y revocación ───────────────────────────────────────
    const inventado = 'a'.repeat(64);
    ok((await fetch(`${BASE}/api/cv/${inventado}`)).status === 404, 'un token inventado da 404');
    ok((await fetch(`${BASE}/cv/deadbeef`)).status === 404, 'un token con forma imposible da 404 sin tocar la base');

    await pool.query(`UPDATE gcc_world.members SET cv_public_token = NULL WHERE id = ${MIEMBRO}`);
    const tras = await Promise.all([
      fetch(`${BASE}/api/cv/${token}`),
      fetch(`${BASE}/cv/${token}`),
      fetch(`${BASE}/api/cv/${token}/pdf`),
      fetch(`${BASE}/api/cv/${token}/imagen?item=${itemId}&i=0&w=480`),
    ]);
    ok(tras.every((r) => r.status === 404), `tras REVOCAR, las cuatro puertas dan 404 (${tras.map((r) => r.status).join(', ')})`);
  } finally {
    await limpiar();
    const despues = await inventario();
    console.log('\nInventario después:', despues);
    ok(JSON.stringify(antes) === JSON.stringify(despues), 'la base queda como estaba');
    await pool.end();
  }

  console.log(fallos === 0 ? '\n✅ ENSAYO SUPERADO' : `\n❌ ${fallos} COMPROBACIONES FALLIDAS`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error('ERROR', e); process.exit(1); });
