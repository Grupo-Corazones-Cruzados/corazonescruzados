/**
 * Migra imágenes guardadas como base64 en la BD a Cloudinary y reemplaza el valor
 * por la `secure_url`. Idempotente: solo sube las entradas que empiezan por `data:`
 * (las que ya son URL se dejan igual), así se puede correr varias veces sin duplicar.
 *
 * Uso:
 *   node --env-file=.env --env-file=.env.local scripts/migrate-images-to-cloudinary.cjs
 *
 * Requiere CLOUDINARY_URL (o CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) y DATABASE_URL.
 */
const { Pool } = require('pg');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({ secure: true }); // usa CLOUDINARY_URL del entorno

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const isBase64 = (v) => typeof v === 'string' && v.startsWith('data:');

async function uploadOne(dataUri, folder) {
  const r = await cloudinary.uploader.upload(dataUri, { folder, resource_type: 'image', overwrite: false });
  return r.secure_url;
}

async function migrateArray(table, folder, idCol = 'id', imgCol = 'images') {
  const { rows } = await pool.query(
    `SELECT ${idCol} AS id, ${imgCol} AS images FROM ${table} WHERE ${imgCol} IS NOT NULL AND array_length(${imgCol}, 1) > 0`
  );
  let changed = 0, uploaded = 0;
  for (const row of rows) {
    const imgs = row.images || [];
    let rowChanged = false;
    const out = [];
    for (const img of imgs) {
      if (isBase64(img)) {
        try {
          const url = await uploadOne(img, `${folder}/${row.id}`);
          out.push(url); uploaded++; rowChanged = true;
        } catch (e) {
          console.error(`  ! ${table} #${row.id}: fallo al subir una imagen: ${e.message}`);
          out.push(img); // conserva el base64 si falla
        }
      } else out.push(img);
    }
    if (rowChanged) {
      await pool.query(`UPDATE ${table} SET ${imgCol} = $1 WHERE ${idCol} = $2`, [out, row.id]);
      changed++;
      console.log(`  ${table} #${row.id}: ${out.length} imágenes (algunas recién subidas)`);
    }
  }
  console.log(`${table}: ${changed} filas actualizadas, ${uploaded} imágenes subidas.`);
}

async function migrateScalar(table, col, folder, idCol = 'id') {
  const { rows } = await pool.query(`SELECT ${idCol} AS id, ${col} AS val FROM ${table} WHERE ${col} LIKE 'data:%'`);
  let uploaded = 0;
  for (const row of rows) {
    try {
      const url = await uploadOne(row.val, folder);
      await pool.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [url, row.id]);
      uploaded++;
    } catch (e) {
      console.error(`  ! ${table} #${row.id}.${col}: ${e.message}`);
    }
  }
  console.log(`${table}.${col}: ${uploaded} subidas.`);
}

(async () => {
  if (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_API_KEY) {
    console.error('Falta CLOUDINARY_URL. Aborta.');
    process.exit(1);
  }
  console.log('Migrando imágenes base64 → Cloudinary...\n');
  await migrateArray('gcc_world.projects', 'corazones-cruzados/projects');
  await migrateArray('gcc_world.member_portfolio_items', 'corazones-cruzados/portfolio');
  await migrateScalar('gcc_world.users', 'avatar_url', 'corazones-cruzados/avatars');
  await migrateScalar('gcc_world.members', 'photo_url', 'corazones-cruzados/avatars');
  await pool.end();
  console.log('\nListo.');
})().catch((e) => { console.error(e); process.exit(1); });
