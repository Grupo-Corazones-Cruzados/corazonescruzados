const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL no está configurado en .env.local');
  console.log('');
  console.log('Para conectarte a Supabase, necesitas agregar DATABASE_URL a tu .env.local');
  console.log('Puedes encontrarlo en: Supabase Dashboard > Settings > Database > Connection string');
  console.log('');
  console.log('Ejemplo:');
  console.log('DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.[TU-PROJECT].supabase.co:5432/postgres');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const result = await pool.query(`
      SELECT email, nombre, rol, verificado, created_at
      FROM user_profiles
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log('=== Usuarios en la base de datos ===');
    console.log('Total encontrados:', result.rows.length);
    console.log('');

    if (result.rows.length === 0) {
      console.log('No hay usuarios registrados aún.');
    } else {
      result.rows.forEach((u, i) => {
        console.log(`${i + 1}. ${u.email}`);
        console.log(`   Nombre: ${u.nombre || 'Sin nombre'}`);
        console.log(`   Rol: ${u.rol}`);
        console.log(`   Verificado: ${u.verificado ? 'Sí' : 'No'}`);
        console.log(`   Creado: ${new Date(u.created_at).toLocaleString('es-MX')}`);
        console.log('');
      });
    }
  } catch (err) {
    console.error('Error al consultar:', err.message);
  } finally {
    await pool.end();
  }
}

main();
