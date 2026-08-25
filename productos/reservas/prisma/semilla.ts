/**
 * Semilla del producto. Es IDEMPOTENTE: se puede volver a ejecutar sin duplicar
 * nada y sin pisar contraseñas ya cambiadas.
 *
 *   npm run semilla
 *
 * Crea lo mínimo para que el producto exista: un plan, el operador de GCC y un
 * alojamiento de demostración con datos suficientes para ver las pantallas llenas.
 * Las contraseñas se generan al azar y se imprimen UNA vez: no se guardan en
 * ningún archivo del repositorio.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';

const esquema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') || 'reservas';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${esquema},public`,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: esquema }) });

const claveAlAzar = () => randomBytes(9).toString('base64url');
const dias = (n: number) => new Date(Date.now() + n * 86_400_000);
const aFecha = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const conHora = (base: Date, h: number) => {
  const x = new Date(base);
  x.setHours(h, 0, 0, 0);
  return x;
};

const nuevas: string[] = [];

async function main() {
  // ── El plan, tal y como lo definió Fernando el 2026-08-25: 5 $ al mes, hasta 100
  //    cuentas, sin límite de ubicaciones ni de suites, y un mes de histórico.
  const plan = await prisma.plan.upsert({
    where: { slug: 'estandar' },
    update: {},
    create: {
      slug: 'estandar',
      nombre: 'Estándar',
      descripcion: 'Todo el sistema, sin límite de ubicaciones ni de suites. Se conserva un mes de histórico.',
      precioMensual: 5,
      maxUsuarios: 100,
      mesesRetencion: 1,
      caracteristicas: [
        'Ubicaciones y suites sin límite',
        'Hasta 100 cuentas de usuario',
        'Agenda, panel de ocupación y reportes',
        'Exportación a Excel',
        'Marca propia (nombre, logo, color y tema)',
        'Un mes de histórico: lo anterior se borra a fin de mes',
      ],
      orden: 0,
    },
  });

  // ── Operador de GCC
  const correoOperador = 'lfgonzalezm0@grupocc.org';
  const existeOperador = await prisma.operadorGcc.findUnique({ where: { email: correoOperador } });
  if (!existeOperador) {
    const clave = claveAlAzar();
    await prisma.operadorGcc.create({
      data: {
        email: correoOperador,
        nombre: 'Luis Fernando González Muyulema',
        passwordHash: await bcrypt.hash(clave, 10),
      },
    });
    nuevas.push(`  Operador GCC   /gcc/acceso   ${correoOperador}   ${clave}`);
  }

  // ── Alojamiento de demostración
  let hotel = await prisma.inquilino.findUnique({ where: { slug: 'demo' } });
  if (!hotel) {
    hotel = await prisma.inquilino.create({
      data: {
        slug: 'demo',
        nombre: 'Hotel de Demostración',
        estado: 'PRUEBA',
        contactoEmail: correoOperador,
        suscripcion: {
          create: {
            planId: plan.id,
            estado: 'PRUEBA',
            // 30 días de prueba: la puerta necesita una fecha, no un «ya veremos».
            pagadoHasta: aFecha(dias(30)),
          },
        },
      },
    });

    const clave = claveAlAzar();
    await prisma.usuario.create({
      data: {
        inquilinoId: hotel.id,
        usuario: 'admin',
        nombre: 'Administrador',
        email: correoOperador,
        rol: 'ADMIN',
        passwordHash: await bcrypt.hash(clave, 10),
      },
    });
    nuevas.push(`  Hotel demo     /demo/acceso  admin   ${clave}`);

    const central = await prisma.ubicacion.create({
      data: { inquilinoId: hotel.id, nombre: 'Sede Centro', orden: 0 },
    });
    const playa = await prisma.ubicacion.create({
      data: { inquilinoId: hotel.id, nombre: 'Sede Playa', orden: 1 },
    });

    const suites = await Promise.all(
      [
        { u: central, n: 'Suite 101', p: 45 },
        { u: central, n: 'Suite 102', p: 45 },
        { u: central, n: 'Suite 103', p: 60 },
        { u: central, n: 'Suite 201', p: 60 },
        { u: playa, n: 'Cabaña A', p: 80 },
        { u: playa, n: 'Cabaña B', p: 80 },
      ].map((s, i) =>
        prisma.suite.create({
          data: {
            inquilinoId: hotel!.id,
            ubicacionId: s.u.id,
            nombre: s.n,
            precioNoche: s.p,
            capacidad: 2,
            orden: i,
          },
        }),
      ),
    );

    const hoy = new Date();
    await prisma.reserva.createMany({
      data: [
        // Dentro ahora, sale dentro de dos días.
        {
          inquilinoId: hotel.id,
          suiteId: suites[0].id,
          clienteNombre: 'María Salazar',
          telefono: '0991234567',
          entrada: conHora(dias(-1), 15),
          salida: conHora(dias(2), 12),
          precioTotal: 135,
          anticipo: 50,
          estadoPago: 'PENDIENTE',
          estado: 'OCUPADA',
        },
        // Sale HOY: es la que debe pintarse «Por salir».
        {
          inquilinoId: hotel.id,
          suiteId: suites[2].id,
          clienteNombre: 'Jorge Andrade',
          telefono: '0987654321',
          entrada: conHora(dias(-2), 14),
          salida: conHora(hoy, 12),
          precioTotal: 120,
          anticipo: 120,
          estadoPago: 'PAGADO',
          estado: 'POR_SALIR',
        },
        // Entra mañana: alimenta la columna de próximos 7 días.
        {
          inquilinoId: hotel.id,
          suiteId: suites[4].id,
          clienteNombre: 'Familia Cedeño',
          telefono: '0999888777',
          entrada: conHora(dias(1), 16),
          salida: conHora(dias(4), 11),
          precioTotal: 240,
          anticipo: 0,
          estadoPago: 'PENDIENTE',
          estado: 'OCUPADA',
        },
        // Terminada la semana pasada: da contenido a los reportes.
        {
          inquilinoId: hotel.id,
          suiteId: suites[1].id,
          clienteNombre: 'Andrea Vera',
          entrada: conHora(dias(-9), 15),
          salida: conHora(dias(-6), 11),
          precioTotal: 135,
          anticipo: 135,
          estadoPago: 'PAGADO',
          estado: 'FINALIZADA',
        },
      ],
    });
  }

  const resumen = {
    planes: await prisma.plan.count(),
    inquilinos: await prisma.inquilino.count(),
    usuarios: await prisma.usuario.count(),
    ubicaciones: await prisma.ubicacion.count(),
    suites: await prisma.suite.count(),
    reservas: await prisma.reserva.count(),
    operadores: await prisma.operadorGcc.count(),
  };
  console.log('✔ Semilla lista:', JSON.stringify(resumen));

  if (nuevas.length) {
    console.log('\n  ── Credenciales generadas (se muestran UNA vez) ─────────────');
    nuevas.forEach((l) => console.log(l));
    console.log('  ─────────────────────────────────────────────────────────────\n');
  } else {
    console.log('  (Sin cuentas nuevas: ya existían. Nada se ha pisado.)');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
