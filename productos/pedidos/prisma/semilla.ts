/**
 * Semilla del producto. IDEMPOTENTE: se puede repetir sin duplicar nada y sin
 * pisar contraseñas ya cambiadas.  ·  npm run semilla
 *
 * Crea el plan, el operador de GCC y un negocio de demostración con carta, mesas y
 * pedidos en distintos estados, para que las pantallas se vean llenas y el flujo
 * (tomar → cocina → servir → cobrar) se pueda recorrer entero.
 *
 * Las contraseñas se generan al azar y se imprimen UNA vez: no quedan en ningún
 * archivo del repositorio.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { calcularCuenta } from '../src/lib/pedidos.ts';

const esquema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') || 'pedidos';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${esquema},public` });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: esquema }) });

const claveAlAzar = () => randomBytes(9).toString('base64url');
const aFecha = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const haceMinutos = (n: number) => new Date(Date.now() - n * 60000);
const nuevas: string[] = [];

async function main() {
  // ── El plan, tal y como lo definió Fernando el 2026-08-25: 5 $ al mes, hasta 100
  //    cuentas, sin límite de mesas ni de productos, y un mes de histórico.
  const plan = await prisma.plan.upsert({
    where: { slug: 'estandar' },
    update: {},
    create: {
      slug: 'estandar',
      nombre: 'Estándar',
      descripcion: 'Todo el sistema, sin límite de mesas ni de productos. Se conserva un mes de histórico.',
      precioMensual: 5,
      maxUsuarios: 100,
      mesesRetencion: 1,
      caracteristicas: [
        'Mesas, zonas y carta sin límite',
        'Hasta 100 cuentas de usuario',
        'Pantalla de cocina y control de estados',
        'Cobro con método de pago e IVA configurable',
        'Reservas de mesa',
        'Reportes con exportación a Excel',
        'Marca propia (nombre, logo, color y tema)',
        'Un mes de histórico: lo anterior se borra a fin de mes',
      ],
      orden: 0,
    },
  });

  const correoOperador = 'lfgonzalezm0@grupocc.org';
  if (!(await prisma.operadorGcc.findUnique({ where: { email: correoOperador } }))) {
    const clave = claveAlAzar();
    await prisma.operadorGcc.create({
      data: {
        email: correoOperador,
        nombre: 'Luis Fernando González Muyulema',
        passwordHash: await bcrypt.hash(clave, 10),
      },
    });
    nuevas.push(`  Operador GCC   /gcc/acceso    ${correoOperador}   ${clave}`);
  }

  let negocio = await prisma.inquilino.findUnique({ where: { slug: 'demo' } });
  if (!negocio) {
    const dentroDe30 = new Date(Date.now() + 30 * 86_400_000);
    negocio = await prisma.inquilino.create({
      data: {
        slug: 'demo',
        nombre: 'Sabor de Casa',
        estado: 'PRUEBA',
        contactoEmail: correoOperador,
        // Ecuador: IVA del 15 % y precios de carta con el impuesto dentro, que es
        // lo que ve el cliente en la mesa.
        aplicaIva: true,
        ivaPorcentaje: 15,
        precioConIva: true,
        suscripcion: { create: { planId: plan.id, estado: 'PRUEBA', pagadoHasta: aFecha(dentroDe30) } },
      },
    });

    for (const [usuario, nombre, rol] of [
      ['admin', 'Administrador', 'ADMIN'],
      ['mesero', 'Ana · mesera', 'MESERO'],
      ['cocina', 'Luis · cocina', 'COCINERO'],
    ] as const) {
      const clave = claveAlAzar();
      await prisma.usuario.create({
        data: {
          inquilinoId: negocio.id,
          usuario,
          nombre,
          rol,
          passwordHash: await bcrypt.hash(clave, 10),
        },
      });
      nuevas.push(`  ${nombre.padEnd(18)} /demo/acceso   ${usuario.padEnd(7)} ${clave}`);
    }

    const salon = await prisma.zona.create({ data: { inquilinoId: negocio.id, nombre: 'Salón', orden: 0 } });
    const terraza = await prisma.zona.create({ data: { inquilinoId: negocio.id, nombre: 'Terraza', orden: 1 } });

    const mesas = await Promise.all(
      [
        { z: salon, n: '1', c: 4 }, { z: salon, n: '2', c: 4 }, { z: salon, n: '3', c: 2 },
        { z: salon, n: '4', c: 6 }, { z: terraza, n: 'T1', c: 4 }, { z: terraza, n: 'T2', c: 2 },
      ].map((m, i) =>
        prisma.mesa.create({
          data: { inquilinoId: negocio!.id, zonaId: m.z.id, nombre: m.n, capacidad: m.c, orden: i },
        }),
      ),
    );

    const carta = [
      { categoria: 'Entradas', productos: [['Ceviche de camarón', 8.5], ['Empanadas de verde (2)', 4.0], ['Bolón mixto', 3.5]] },
      { categoria: 'Platos fuertes', productos: [['Encebollado', 6.0], ['Seco de pollo', 7.5], ['Arroz marinero', 11.0], ['Churrasco', 9.5]] },
      { categoria: 'Bebidas', productos: [['Jugo natural', 2.5], ['Cola personal', 1.5], ['Café pasado', 1.75], ['Agua sin gas', 1.0]] },
      { categoria: 'Postres', productos: [['Tres leches', 4.0], ['Helado artesanal', 3.0]] },
    ];
    const productosCreados: Record<string, { id: number; precio: number }> = {};
    for (const [i, c] of carta.entries()) {
      const cat = await prisma.categoria.create({ data: { inquilinoId: negocio.id, nombre: c.categoria, orden: i } });
      for (const [j, [nombre, precio]] of c.productos.entries()) {
        const p = await prisma.producto.create({
          data: {
            inquilinoId: negocio.id,
            categoriaId: cat.id,
            nombre: nombre as string,
            precio: precio as number,
            orden: j,
          },
        });
        productosCreados[nombre as string] = { id: p.id, precio: precio as number };
      }
    }

    const hoy = aFecha(new Date());
    const config = { aplicaIva: true, ivaPorcentaje: 15, precioConIva: true };

    /** Un pedido completo, con su cuenta ya cuadrada. */
    const pedido = async (
      numero: number,
      mesaIdx: number,
      lineas: [string, number][],
      estado: 'EN_PREPARACION' | 'LISTO' | 'SERVIDO' | 'COBRADO',
      hace: number,
      itemsListos: boolean,
    ) => {
      const cuenta = calcularCuenta(
        lineas.map(([n, c]) => ({ precioUnitario: productosCreados[n].precio, cantidad: c })),
        config,
      );
      const p = await prisma.pedido.create({
        data: {
          inquilinoId: negocio!.id,
          mesaId: mesas[mesaIdx].id,
          numero,
          dia: hoy,
          estado,
          comensales: 2,
          subtotal: cuenta.subtotal,
          iva: cuenta.iva,
          total: cuenta.total,
          ivaPorcentaje: cuenta.ivaPorcentaje,
          creado: haceMinutos(hace),
          ...(estado === 'COBRADO'
            ? { metodoPago: 'EFECTIVO' as const, cerradoEn: haceMinutos(hace - 40), servidoEn: haceMinutos(hace - 50), listoEn: haceMinutos(hace - 55) }
            : {}),
          ...(estado === 'SERVIDO' ? { servidoEn: haceMinutos(hace - 10), listoEn: haceMinutos(hace - 15) } : {}),
          ...(estado === 'LISTO' ? { listoEn: haceMinutos(hace - 5) } : {}),
        },
      });
      for (const [nombre, cantidad] of lineas)
        await prisma.pedidoItem.create({
          data: {
            pedidoId: p.id,
            productoId: productosCreados[nombre].id,
            nombre,
            precioUnitario: productosCreados[nombre].precio,
            cantidad,
            estado: itemsListos ? 'LISTO' : 'PENDIENTE',
          },
        });
      if (estado !== 'COBRADO')
        await prisma.mesa.update({ where: { id: mesas[mesaIdx].id }, data: { estado: 'OCUPADA', desde: haceMinutos(hace) } });
      return p;
    };

    // Cuatro situaciones distintas, para que el tablero enseñe de qué va esto.
    await pedido(1, 0, [['Encebollado', 2], ['Jugo natural', 2]], 'EN_PREPARACION', 12, false);
    await pedido(2, 4, [['Ceviche de camarón', 1], ['Arroz marinero', 1], ['Cola personal', 2]], 'LISTO', 25, true);
    await pedido(3, 1, [['Seco de pollo', 3], ['Agua sin gas', 3], ['Tres leches', 1]], 'SERVIDO', 45, true);
    await pedido(4, 2, [['Bolón mixto', 2], ['Café pasado', 2]], 'COBRADO', 95, true);

    // Una mesa esperando atención: el estado que no se puede deducir de nada.
    await prisma.mesa.update({ where: { id: mesas[3].id }, data: { estado: 'ESPERANDO_ATENCION', desde: haceMinutos(6) } });

    const estaNoche = new Date();
    estaNoche.setHours(20, 0, 0, 0);
    await prisma.reservaMesa.create({
      data: {
        inquilinoId: negocio.id,
        mesaId: mesas[5].id,
        cliente: 'Familia Zambrano',
        telefono: '0991234567',
        personas: 4,
        desde: estaNoche,
        hasta: new Date(estaNoche.getTime() + 90 * 60000),
        notas: 'Cumpleaños, llevan pastel',
      },
    });
  }

  const resumen = {
    planes: await prisma.plan.count(),
    negocios: await prisma.inquilino.count(),
    usuarios: await prisma.usuario.count(),
    zonas: await prisma.zona.count(),
    mesas: await prisma.mesa.count(),
    productos: await prisma.producto.count(),
    pedidos: await prisma.pedido.count(),
    platos: await prisma.pedidoItem.count(),
    reservas: await prisma.reservaMesa.count(),
  };
  console.log('✔ Semilla lista:', JSON.stringify(resumen));

  if (nuevas.length) {
    console.log('\n  ── Credenciales generadas (se muestran UNA vez) ───────────────');
    nuevas.forEach((l) => console.log(l));
    console.log('  ───────────────────────────────────────────────────────────────\n');
  } else console.log('  (Sin cuentas nuevas: ya existían. Nada se ha pisado.)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
