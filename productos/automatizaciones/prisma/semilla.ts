/**
 * SEMILLA — idempotente. Se puede correr las veces que haga falta.
 *
 * A diferencia de los otros productos, esta semilla **no inventa un inquilino de
 * demostración con datos falsos**: los inquilinos de este producto (el del grupo y
 * PETER TOURS S.A.) los trae `scripts/traer-de-la-plataforma.mjs` con sus datos
 * reales, porque el producto nace de una sección que ya estaba en marcha.
 *
 * Lo que sí crea, porque no viene de ningún sitio:
 *   · el plan (a cero: el precio lo tiene que decidir Fernando);
 *   · la cuenta del operador de GCC, sin la cual no se puede entrar a `/gcc` ni,
 *     por tanto, dar de alta a nadie.
 *
 * La contraseña del operador se imprime UNA vez y solo cuando la cuenta se crea. Si
 * ya existe, no se toca: volver a correr la semilla no puede cambiarle la contraseña
 * a alguien que ya está trabajando.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/lib/db';

const claveAlAzar = () => randomBytes(9).toString('base64url');

async function main() {
  // ⭐ TRES PRODUCTOS, TRES PLANES (Fernando, 2026-09-23: «automatizaciones no es un
  // producto como tal, sino los tipos de flujos son los productos»).
  //
  // ⚠️ TODOS A CERO Y A PROPÓSITO: Fernando no ha puesto precio a ninguno, y un precio
  // inventado se acaba cobrando. Se cambian desde /gcc cuando lo decida. Mientras estén a
  // cero, tampoco hay ficha en el marketplace.
  const PRODUCTOS = [
    { producto: 'AGENTE_IA' as const, nombre: 'Agente de IA', orden: 1,
      descripcion: 'Contesta WhatsApp solo, con el conocimiento del negocio. Precio por definir.' },
    { producto: 'CORREO' as const, nombre: 'Campañas de Correo', orden: 2,
      descripcion: 'Listas de contactos y envíos programados por correo. Precio por definir.' },
    { producto: 'WHATSAPP' as const, nombre: 'Campañas de WhatsApp', orden: 3,
      descripcion: 'Plantillas y difusión por WhatsApp a listas de contactos. Precio por definir.' },
  ];

  for (const d of PRODUCTOS) {
    const plan = await prisma.plan.upsert({
      where: { producto_slug: { producto: d.producto, slug: 'estandar' } },
      update: { nombre: d.nombre, descripcion: d.descripcion, orden: d.orden },
      create: {
        producto: d.producto,
        slug: 'estandar',
        nombre: d.nombre,
        descripcion: d.descripcion,
        precioMensual: 0,
        maxUsuarios: 10,
        maxAutomatizaciones: 5,
        maxConversacionesMes: null,
        mesesRetencion: 1,
        orden: d.orden,
      },
    });
    console.log(`· plan «${plan.nombre}» listo (${Number(plan.precioMensual).toFixed(2)} ${plan.moneda}/mes)`);
  }

  const email = 'hola@grupocc.org';
  const yaEsta = await prisma.operadorGcc.findUnique({ where: { email } });
  if (yaEsta) {
    console.log(`· operador ${email} ya existe (no se toca su contraseña)`);
  } else {
    const clave = claveAlAzar();
    await prisma.operadorGcc.create({
      data: {
        email,
        nombre: 'Equipo GCC',
        claveHash: await bcrypt.hash(clave, 10),
      },
    });
    console.log('\n  ┌─────────────────────────────────────────────');
    console.log('  │ ACCESO AL ÁREA DEL EQUIPO  ·  /gcc/acceso');
    console.log(`  │ correo:     ${email}`);
    console.log(`  │ contraseña: ${clave}`);
    console.log('  │ Se enseña UNA vez: guárdala ahora.');
    console.log('  └─────────────────────────────────────────────\n');
  }
}

main()
  .catch((e) => {
    console.error('✖', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
