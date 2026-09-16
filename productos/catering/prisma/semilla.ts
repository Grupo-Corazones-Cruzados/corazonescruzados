/**
 * Semilla del producto. IDEMPOTENTE: se puede repetir sin duplicar nada y sin
 * pisar contraseñas ya cambiadas.  ·  npm run semilla
 *
 * Crea el plan, el operador de GCC y un negocio de demostración con clientes en
 * todos los estados, servicios en marcha, cancelaciones, menús de la semana,
 * motorizados y los feriados del año, para que las pantallas se vean llenas y
 * el flujo entero (registro → aprobación → servicio → menú → etiquetas → rutas)
 * se pueda recorrer.
 *
 * Las contraseñas se generan al azar y se imprimen UNA vez, salvo que se pase
 * DEMO_CLAVE: es la contraseña PÚBLICA del escaparate (va en la ficha del
 * marketplace a propósito) y así la semilla lo reproduce entero.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { feriadosDeEcuador } from '../src/lib/feriados-ecuador.ts';
import { aFechaSql, hoyEn, sumarDias, diaSemanaDe } from '../src/lib/fechas.ts';
import type { TipoComida, DiaSemana, CategoriaAlimento } from '../src/generated/prisma/enums.ts';

const esquema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') || 'catering';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${esquema},public` });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: esquema }) });

const claveAlAzar = () => randomBytes(9).toString('base64url');
const claveDemo = () => process.env.DEMO_CLAVE || claveAlAzar();
const nuevas: string[] = [];
const LV: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

async function main() {
  // ── El plan: el mismo trato que los otros dos productos (Fernando, 2026-08-25 y
  //    2026-09-15): 5 $ al mes, hasta 100 cuentas del personal, clientes sin
  //    límite y un mes de histórico.
  const plan = await prisma.plan.upsert({
    where: { slug: 'estandar' },
    update: {},
    create: {
      slug: 'estandar',
      nombre: 'Estándar',
      descripcion: 'Todo el sistema, clientes sin límite. Se conserva un mes de histórico.',
      precioMensual: 5,
      maxUsuarios: 100,
      mesesRetencion: 1,
      caracteristicas: [
        'Clientes sin límite, con registro público y aprobación',
        'Hasta 100 cuentas del personal (administración, cocina y despacho)',
        'Servicios por días, con feriados y cancelaciones que corren la fecha de fin',
        'Portal del cliente: su servicio, sus días y su dirección',
        'Menú del día y etiquetas con las restricciones de cada cliente',
        'Hojas de ruta por motorizado',
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
      data: { email: correoOperador, nombre: 'Luis Fernando González Muyulema', passwordHash: await bcrypt.hash(clave, 10) },
    });
    nuevas.push(`  Operador GCC       /gcc/acceso    ${correoOperador}   ${clave}`);
  }

  let negocio = await prisma.inquilino.findUnique({ where: { slug: 'demo' } });
  if (!negocio) {
    const dentroDe30 = new Date(Date.now() + 30 * 86_400_000);
    negocio = await prisma.inquilino.create({
      data: {
        slug: 'demo',
        nombre: 'Verde & Sano',
        estado: 'PRUEBA',
        contactoEmail: correoOperador,
        tiposComida: ['ALMUERZO', 'MEDIA_TARDE', 'CENA'],
        diasServicio: LV,
        suscripcion: { create: { planId: plan.id, estado: 'PRUEBA', pagadoHasta: new Date(Date.UTC(dentroDe30.getFullYear(), dentroDe30.getMonth(), dentroDe30.getDate())) } },
      },
    });
    const zona = negocio.zonaHoraria;
    const hoy = hoyEn(zona);

    // ── Personal: los tres oficios.
    for (const [usuario, nombre, rol] of [
      ['admin', 'Administrador', 'ADMIN'],
      ['cocina', 'Rosa · cocina', 'COCINA'],
      ['despacho', 'Marco · despacho', 'DESPACHO'],
    ] as const) {
      const clave = claveDemo();
      await prisma.usuario.create({ data: { inquilinoId: negocio.id, usuario, nombre, rol, passwordHash: await bcrypt.hash(clave, 10) } });
      nuevas.push(`  ${nombre.padEnd(18)} /demo/acceso   ${usuario.padEnd(22)} ${clave}`);
    }

    // ── Feriados del año en curso y el siguiente.
    const anio = Number(hoy.slice(0, 4));
    for (const a of [anio, anio + 1])
      await prisma.feriado.createMany({ data: feriadosDeEcuador(a).map((f) => ({ inquilinoId: negocio!.id, fecha: aFechaSql(f.fecha), nombre: f.nombre })) });

    // ── Motorizados.
    const motos = await Promise.all(
      [['Carlos Vera', '0991112233', '#0F6CBD'], ['Diana Paredes', '0982223344', '#CA5010'], ['Jorge Mite', '0973334455', '#0F7B0F']].map(([nombre, celular, color]) =>
        prisma.motorizado.create({ data: { inquilinoId: negocio!.id, nombre, celular, color } }),
      ),
    );

    // ── Alimentos.
    const catalogo: [string, CategoriaAlimento][] = [
      ['Pollo', 'PROTEINA'], ['Carne de res', 'PROTEINA'], ['Pescado', 'PROTEINA'], ['Camarón', 'PROTEINA'], ['Huevo', 'PROTEINA'], ['Atún', 'PROTEINA'], ['Cerdo', 'PROTEINA'],
      ['Arroz integral', 'CARBOHIDRATO'], ['Arroz blanco', 'CARBOHIDRATO'], ['Quinua', 'CARBOHIDRATO'], ['Papa', 'CARBOHIDRATO'], ['Camote', 'CARBOHIDRATO'], ['Verde', 'CARBOHIDRATO'], ['Pasta integral', 'CARBOHIDRATO'], ['Pan integral', 'CARBOHIDRATO'],
      ['Brócoli', 'VEGETAL'], ['Zanahoria', 'VEGETAL'], ['Lechuga', 'VEGETAL'], ['Tomate', 'VEGETAL'], ['Pimiento', 'VEGETAL'], ['Cebolla', 'VEGETAL'], ['Espinaca', 'VEGETAL'], ['Champiñones', 'VEGETAL'],
      ['Manzana', 'FRUTA'], ['Banano', 'FRUTA'], ['Papaya', 'FRUTA'], ['Piña', 'FRUTA'], ['Frutilla', 'FRUTA'],
      ['Queso', 'LACTEO'], ['Yogur', 'LACTEO'], ['Leche', 'LACTEO'],
      ['Maní', 'OTRO'], ['Aguacate', 'OTRO'], ['Frutos secos', 'OTRO'],
    ];
    const alimentos: Record<string, number> = {};
    for (const [nombre, categoria] of catalogo) {
      const a = await prisma.alimento.create({ data: { inquilinoId: negocio.id, nombre, categoria } });
      alimentos[nombre] = a.id;
    }

    // ── Clientes: activos con servicio, pendientes, inactivo, rechazado.
    type Semilla = {
      nombre: string; email: string; celular: string; direccion: string; edificio?: string; piso?: string; referencias?: string; color?: string;
      estado: 'ACTIVO' | 'PENDIENTE' | 'INACTIVO' | 'RECHAZADO'; comidas: TipoComida[]; moto?: number; despacho?: Partial<Record<'sinAgua' | 'sinFruta' | 'sinCubiertos' | 'envasesPropios', boolean>>;
      restricciones?: [string, TipoComida[]][]; direccion2?: { direccion: string; dias: DiaSemana[]; moto: number; referencias?: string };
      servicio?: { dias: number; inicioHace: number; comidas?: TipoComida[]; semana?: DiaSemana[]; canceladas?: number[] };
      nutricion?: { altura: number; peso: number; genero: 'MASCULINO' | 'FEMENINO' | 'OTRO'; actividad: 'SEDENTARIO' | 'LEVE' | 'MODERADO' | 'INTENSO' };
    };
    const clientes: Semilla[] = [
      { nombre: 'María José Andrade', email: 'maria.andrade@ejemplo.com', celular: '0991234567', direccion: 'Av. Francisco de Orellana y Justino Cornejo', edificio: 'Torre Sol', piso: '12-B', referencias: 'Frente al Mall del Sol', color: '#C42B1C', estado: 'ACTIVO', comidas: ['ALMUERZO', 'CENA'], moto: 0, despacho: { sinCubiertos: true }, restricciones: [['Camarón', []], ['Maní', []]], servicio: { dias: 20, inicioHace: 12, canceladas: [3] }, nutricion: { altura: 1.65, peso: 62, genero: 'FEMENINO', actividad: 'MODERADO' } },
      { nombre: 'Andrés Salazar', email: 'andres.salazar@ejemplo.com', celular: '0987654321', direccion: 'Cdla. Kennedy Norte, Mz. 45 V. 12', referencias: 'Casa de dos pisos, portón blanco', color: '#0F6CBD', estado: 'ACTIVO', comidas: ['ALMUERZO'], moto: 0, restricciones: [['Cerdo', []]], direccion2: { direccion: 'Edificio Las Cámaras, piso 8, oficina 802', dias: ['LUNES', 'MIERCOLES', 'VIERNES'], moto: 1, referencias: 'Dejar en recepción' }, servicio: { dias: 20, inicioHace: 5 }, nutricion: { altura: 1.78, peso: 84, genero: 'MASCULINO', actividad: 'INTENSO' } },
      { nombre: 'Gabriela Torres', email: 'gabriela.torres@ejemplo.com', celular: '0976543210', direccion: 'Urdesa Central, Víctor Emilio Estrada 512', edificio: 'Condominio Alameda', piso: '3-A', color: '#0F7B0F', estado: 'ACTIVO', comidas: ['ALMUERZO', 'MEDIA_TARDE', 'CENA'], moto: 1, despacho: { sinAgua: true, envasesPropios: true }, restricciones: [['Queso', ['CENA']], ['Leche', []], ['Yogur', []]], servicio: { dias: 30, inicioHace: 20, canceladas: [2, 9] }, nutricion: { altura: 1.6, peso: 55, genero: 'FEMENINO', actividad: 'LEVE' } },
      { nombre: 'Luis Cárdenas', email: 'luis.cardenas@ejemplo.com', celular: '0965432109', direccion: 'Samborondón, Urb. Río Grande, Villa 8', referencias: 'Garita: preguntar por Cárdenas', color: '#5C2D91', estado: 'ACTIVO', comidas: ['ALMUERZO', 'CENA'], moto: 2, restricciones: [['Pescado', []], ['Atún', []], ['Camarón', []]], servicio: { dias: 10, inicioHace: 9, comidas: ['ALMUERZO', 'CENA'] } },
      { nombre: 'Paola Mendoza', email: 'paola.mendoza@ejemplo.com', celular: '0954321098', direccion: 'Alborada 11ª etapa, Mz. 20 V. 5', color: '#CA5010', estado: 'ACTIVO', comidas: ['ALMUERZO'], moto: 2, despacho: { sinFruta: true }, servicio: { dias: 20, inicioHace: 2, semana: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES'] } },
      { nombre: 'Ricardo Zambrano', email: 'ricardo.zambrano@ejemplo.com', celular: '0943210987', direccion: 'Sauces 6, Mz. 280 V. 3', estado: 'ACTIVO', comidas: ['ALMUERZO', 'MEDIA_TARDE'], moto: 1, restricciones: [['Huevo', ['MEDIA_TARDE']]], servicio: { dias: 15, inicioHace: 30 } },
      { nombre: 'Carolina Espinoza', email: 'carolina.espinoza@ejemplo.com', celular: '0932109876', direccion: 'Ceibos Norte, calle 5ta 210', estado: 'ACTIVO', comidas: ['CENA'], moto: 0 },
      { nombre: 'Daniel Rivas', email: 'daniel.rivas@ejemplo.com', celular: '0921098765', direccion: 'Guayacanes, Mz. 12 V. 30', estado: 'PENDIENTE', comidas: ['ALMUERZO', 'CENA'] },
      { nombre: 'Valeria Guerrero', email: 'valeria.guerrero@ejemplo.com', celular: '0910987654', direccion: 'Bellavista, Av. del Bosque 44', estado: 'PENDIENTE', comidas: ['ALMUERZO'] },
      { nombre: 'Sebastián Ochoa', email: 'sebastian.ochoa@ejemplo.com', celular: '0998877665', direccion: 'La Garzota 2, Mz. 8 V. 15', estado: 'INACTIVO', comidas: ['ALMUERZO'], moto: 2 },
      { nombre: 'Prueba Rechazada', email: 'rechazado@ejemplo.com', celular: '0900000000', direccion: 'Sin dirección válida', estado: 'RECHAZADO', comidas: ['ALMUERZO'] },
    ];

    let claveCliente = '';
    for (const c of clientes) {
      const clave = claveDemo();
      if (c.email === 'maria.andrade@ejemplo.com') claveCliente = clave;
      const fila = await prisma.cliente.create({
        data: {
          inquilinoId: negocio.id,
          email: c.email,
          passwordHash: await bcrypt.hash(clave, 10),
          nombre: c.nombre,
          celular: c.celular,
          direccion: c.direccion,
          edificio: c.edificio ?? null,
          piso: c.piso ?? null,
          referencias: c.referencias ?? null,
          colorIdentificador: c.color ?? null,
          estado: c.estado,
          tiposComida: c.comidas,
          motorizadoId: c.moto !== undefined ? motos[c.moto].id : null,
          ...(c.despacho ?? {}),
          ...(c.nutricion ? { altura: c.nutricion.altura, peso: c.nutricion.peso, genero: c.nutricion.genero, frecuenciaActividad: c.nutricion.actividad } : {}),
          ...(c.direccion2 ? { direccion2: c.direccion2.direccion, referencias2: c.direccion2.referencias ?? null, diasDireccion2: c.direccion2.dias, motorizado2Id: motos[c.direccion2.moto].id, colorIdentificador2: '#008272' } : {}),
          restricciones: { create: (c.restricciones ?? []).map(([nombre, comidas]) => ({ alimentoId: alimentos[nombre], tiposComida: comidas })) },
        },
      });
      if (c.estado === 'PENDIENTE') continue;
      if (c.servicio) {
        const inicio = sumarDias(hoy, -c.servicio.inicioHace);
        const s = await prisma.servicio.create({
          data: {
            inquilinoId: negocio.id,
            clienteId: fila.id,
            diasTotales: c.servicio.dias,
            fechaInicio: aFechaSql(inicio),
            tiposComida: c.servicio.comidas ?? c.comidas,
            diasSemana: c.servicio.semana ?? LV,
            porcentajeCancelacion: 20,
          },
        });
        // Cancelaciones en días de servicio concretos (contando desde el inicio).
        for (const n of c.servicio.canceladas ?? []) {
          let d = inicio, vistos = 0;
          while (vistos < n) { d = sumarDias(d, 1); if ((c.servicio.semana ?? LV).includes(diaSemanaDe(d))) vistos++; }
          await prisma.cancelacion.create({ data: { inquilinoId: negocio.id, servicioId: s.id, clienteId: fila.id, fecha: aFechaSql(d), motivo: n % 2 ? 'Viaje de trabajo' : null, autor: n % 2 ? 'CLIENTE' : 'PERSONAL' } });
        }
      }
      if (c.estado === 'ACTIVO')
        await prisma.mensaje.create({ data: { inquilinoId: negocio.id, clienteId: fila.id, tipo: 'APROBACION', texto: 'Tu registro fue aprobado. ¡Bienvenido/a a Verde & Sano!', leido: c.email !== 'maria.andrade@ejemplo.com' } });
    }
    nuevas.push(`  Cliente (portal)   /demo/acceso   maria.andrade@ejemplo.com ${claveCliente}`);

    // ── Menús: de ayer a dentro de una semana, para los días de reparto.
    const menus: Record<TipoComida, [string, string[]][]> = {
      ALMUERZO: [
        ['Pollo al horno con arroz integral y ensalada', ['Pollo', 'Arroz integral', 'Lechuga', 'Tomate']],
        ['Pescado a la plancha con quinua y brócoli', ['Pescado', 'Quinua', 'Brócoli', 'Zanahoria']],
        ['Carne salteada con papa y vegetales', ['Carne de res', 'Papa', 'Pimiento', 'Cebolla']],
        ['Camarones al ajillo con arroz y ensalada', ['Camarón', 'Arroz blanco', 'Lechuga', 'Tomate']],
        ['Cerdo agridulce con camote y espinaca', ['Cerdo', 'Camote', 'Espinaca']],
      ],
      MEDIA_TARDE: [
        ['Yogur con frutilla y frutos secos', ['Yogur', 'Frutilla', 'Frutos secos']],
        ['Tostada integral con huevo y aguacate', ['Pan integral', 'Huevo', 'Aguacate']],
        ['Ensalada de frutas', ['Papaya', 'Piña', 'Banano']],
      ],
      CENA: [
        ['Omelette de champiñones con ensalada', ['Huevo', 'Champiñones', 'Lechuga', 'Tomate']],
        ['Atún con verde y ensalada', ['Atún', 'Verde', 'Tomate', 'Cebolla']],
        ['Pasta integral con pollo y brócoli', ['Pasta integral', 'Pollo', 'Brócoli']],
        ['Queso fresco con tostadas y aguacate', ['Queso', 'Pan integral', 'Aguacate']],
      ],
      DESAYUNO: [],
      MEDIA_MANANA: [],
    };
    let k = 0;
    for (let d = sumarDias(hoy, -1); d <= sumarDias(hoy, 7); d = sumarDias(d, 1)) {
      if (!LV.includes(diaSemanaDe(d))) continue;
      for (const tipo of ['ALMUERZO', 'MEDIA_TARDE', 'CENA'] as TipoComida[]) {
        const [descripcion, lista] = menus[tipo][k % menus[tipo].length];
        await prisma.menu.create({
          data: { inquilinoId: negocio.id, fecha: aFechaSql(d), tipoComida: tipo, descripcion, alimentos: { create: lista.map((n) => ({ alimentoId: alimentos[n] })) } },
        });
      }
      k++;
    }
  }

  // ── El inquilino del GRUPO (Fernando, 2026-09-16): «ya comprado» para la
  //    administración del Grupo Corazones Cruzados, sin mensualidad ni topes.
  //    El código es «grupo»: «gcc» está reservado para el área del equipo.
  if (!(await prisma.inquilino.findUnique({ where: { slug: 'grupo' } }))) {
    const clave = process.env.GCC_CLAVE || claveAlAzar();
    await prisma.inquilino.create({
      data: {
        slug: 'grupo',
        nombre: 'Grupo Corazones Cruzados',
        estado: 'ACTIVO',
        cortesia: true,
        contactoNombre: 'Luis Fernando González Muyulema',
        contactoEmail: correoOperador,
        suscripcion: { create: { planId: plan.id, estado: 'ACTIVA', notas: 'Acceso del grupo: sin mensualidad.' } },
        usuarios: { create: { usuario: 'admin', nombre: 'Luis Fernando González Muyulema', rol: 'ADMIN', email: correoOperador, passwordHash: await bcrypt.hash(clave, 10) } },
      },
    });
    nuevas.push(`  Grupo (acceso del grupo) /grupo/acceso  admin    ${clave}`);
  }

  const resumen = {
    planes: await prisma.plan.count(),
    negocios: await prisma.inquilino.count(),
    usuarios: await prisma.usuario.count(),
    clientes: await prisma.cliente.count(),
    servicios: await prisma.servicio.count(),
    cancelaciones: await prisma.cancelacion.count(),
    alimentos: await prisma.alimento.count(),
    menus: await prisma.menu.count(),
    motorizados: await prisma.motorizado.count(),
    feriados: await prisma.feriado.count(),
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
