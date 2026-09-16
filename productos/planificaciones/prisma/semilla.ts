/**
 * Semilla del producto. IDEMPOTENTE: se puede repetir sin duplicar nada y sin
 * pisar contraseñas ya cambiadas.  ·  npm run semilla
 *
 * Crea el plan, el operador de GCC, el catálogo de materias por nivel, las
 * destrezas que aparecen en los diez ejemplos de la docente (las del currículo
 * completo se cargarán materia por materia en un paso posterior) y una
 * institución de demostración con un administrador, dos profesores y una
 * planificación con dos semanas ya redactadas, para que la vista previa y el PDF
 * se vean llenos sin gastar una corrida del agente.
 *
 * Las contraseñas se generan al azar y se imprimen UNA vez, salvo que se pase
 * DEMO_CLAVE: es la contraseña PÚBLICA del escaparate.
 */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { aFechaSql, hoyEn, lunesDe, sumarDias } from '../src/lib/fechas.ts';
import type { Nivel } from '../src/generated/prisma/enums.ts';

const esquema = new URL(process.env.DATABASE_URL!).searchParams.get('schema') || 'planificaciones';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${esquema},public` });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: esquema }) });

const claveAlAzar = () => randomBytes(9).toString('base64url');
const claveDemo = () => process.env.DEMO_CLAVE || claveAlAzar();
const nuevas: string[] = [];

const MATERIAS: Record<Nivel, string[]> = {
  PREPARATORIA: [
    'Identidad y Autonomía',
    'Convivencia',
    'Descubrimiento del medio natural y cultural',
    'Relaciones lógico matemático',
    'Comprensión y expresión oral y escrita',
    'Comprensión y expresión artística',
    'Educación Cultural Artística',
    'Expresión corporal',
    'Cívica y acompañamiento integral del aula',
  ],
  PRIMARIA: ['Lengua y Literatura', 'Matemática', 'Ciencias Naturales', 'Estudios Sociales', 'Educación Cultural y Artística', 'Educación Física', 'Lengua Extranjera (Inglés)', 'Proyectos escolares'],
  SECUNDARIA: [
    'Lengua y Literatura',
    'Matemática',
    'Ciencias Naturales',
    'Biología',
    'Física',
    'Química',
    'Estudios Sociales',
    'Historia',
    'Filosofía',
    'Educación para la Ciudadanía',
    'Emprendimiento y Gestión',
    'Educación Cultural y Artística',
    'Educación Física',
    'Lengua Extranjera (Inglés)',
  ],
};

async function main() {
  // ── El plan (Fernando, 2026-09-15): 10 $/mes, hasta 100 cuentas y 40
  //    planificaciones semanales por semana para toda la institución. Sin
  //    límite de histórico (pendiente de que diga otra cosa).
  const plan = await prisma.plan.upsert({
    where: { slug: 'estandar' },
    update: {},
    create: {
      slug: 'estandar',
      nombre: 'Estándar',
      descripcion: 'Todo el sistema para una institución: hasta 100 cuentas y 40 planificaciones semanales por semana.',
      precioMensual: 10,
      maxUsuarios: 100,
      maxGeneracionesSemana: 40,
      mesesRetencion: null,
      caracteristicas: [
        'Hasta 100 cuentas (administrador y profesores)',
        '40 planificaciones semanales redactadas por semana, para toda la institución',
        'Indicaciones por micrófono y hasta 5 archivos adjuntos por solicitud',
        'Destrezas con criterio de desempeño elegidas del currículo, con su imagen',
        'Búsqueda de canciones y videos en la web para las estrategias',
        'Vista previa y descarga en PDF con el formato de la institución',
        'Marca propia (nombre, logo, color y tema)',
        'Las planificaciones se conservan todo el año lectivo',
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

  // ── Materias por nivel (catálogo común).
  for (const nivel of Object.keys(MATERIAS) as Nivel[])
    for (const [i, nombre] of MATERIAS[nivel].entries())
      await prisma.materia.upsert({ where: { nivel_nombre: { nivel, nombre } }, update: { orden: i }, create: { nivel, nombre, ambito: nivel === 'PREPARATORIA' ? nombre : null, orden: i } });

  // ── Destrezas de los ejemplos (catálogo común, Preparatoria).
  const destrezas: { codigo: string; materia: string; descripcion: string }[] = JSON.parse(readFileSync(path.join(import.meta.dirname, 'destrezas-preparatoria.json'), 'utf8'));
  for (const d of destrezas) {
    const existe = await prisma.destreza.findFirst({ where: { nivel: 'PREPARATORIA', codigo: d.codigo, inquilinoId: null } });
    if (!existe) await prisma.destreza.create({ data: { nivel: 'PREPARATORIA', codigo: d.codigo, materia: d.materia, descripcion: d.descripcion } });
  }

  // ── La institución de demostración.
  let inst = await prisma.inquilino.findUnique({ where: { slug: 'demo' } });
  if (!inst) {
    const dentroDe30 = new Date(Date.now() + 30 * 86_400_000);
    inst = await prisma.inquilino.create({
      data: {
        slug: 'demo',
        nombre: 'Unidad Educativa de Demostración',
        estado: 'PRUEBA',
        contactoEmail: correoOperador,
        suscripcion: { create: { planId: plan.id, estado: 'PRUEBA', pagadoHasta: new Date(Date.UTC(dentroDe30.getFullYear(), dentroDe30.getMonth(), dentroDe30.getDate())) } },
      },
    });

    const cuentas: Record<string, number> = {};
    for (const [usuario, nombre, profesion, rol] of [
      ['admin', 'Coordinación Pedagógica', 'Mgtr.', 'ADMIN'],
      ['helen', 'Helen Cárdenas', 'Lcda.', 'PROFESOR'],
      ['marco', 'Marco Villacís', 'Lic.', 'PROFESOR'],
    ] as const) {
      const clave = claveDemo();
      const u = await prisma.usuario.create({ data: { inquilinoId: inst.id, usuario, nombre, profesion, rol, passwordHash: await bcrypt.hash(clave, 10) } });
      cuentas[usuario] = u.id;
      nuevas.push(`  ${nombre.padEnd(24)} /demo/acceso   ${usuario.padEnd(8)} ${clave}`);
    }

    // Una planificación con dos semanas ya redactadas (en el estilo de la
    // docente, con contenido propio de la demostración).
    const hoy = hoyEn(inst.zonaHoraria);
    const lunes = lunesDe(hoy);
    // Las semanas de muestra se fechan diez días atrás para que no cuenten
    // contra el tope de esta semana en el tablero.
    const haceDiez = new Date(Date.now() - 10 * 86_400_000);
    const pl = await prisma.planificacion.create({
      data: {
        inquilinoId: inst.id,
        usuarioId: cuentas.helen,
        nivel: 'PREPARATORIA',
        materia: 'Relaciones lógico matemático',
        ambito: 'Relaciones lógico matemático',
        numeroUnidad: 1,
        tituloUnidad: 'Empiezo una nueva aventura',
        inicioPud: aFechaSql(lunes),
        finPud: aFechaSql(sumarDias(lunes, 32)),
        gradoCurso: 'Primer grado',
        paralelo: 'A',
        jornada: 'Matutina',
        objetivosUnidad: 'Reconocer nociones de tamaño y ubicación y las figuras geométricas básicas en objetos del entorno, mediante la observación, la manipulación de material concreto y actividades lúdicas, para desarrollar la noción de forma y el pensamiento lógico-matemático en situaciones cotidianas.',
        criteriosEvaluacion: 'CE.M.1.1. Clasifica objetos del entorno, establece sus semejanzas y diferencias, la ubicación en la que se encuentran en referencia a sí mismo y a otros objetos, selecciona los atributos que los caracterizan para construir patrones sencillos y expresar situaciones cotidianas.',
        elaboradoPor: 'Lcda. Helen Cárdenas',
        revisadoPor: 'Lcda. Coordinadora de Área',
        aprobadoPor: 'Msc. Vicerrectora Académica',
      },
    });
    const dz = async (codigo: string) => (await prisma.destreza.findFirst({ where: { codigo, inquilinoId: null } }))!.id;

    await prisma.planificacionSemanal.create({
      data: {
        inquilinoId: inst.id,
        planificacionId: pl.id,
        usuarioId: cuentas.helen,
        orden: 1,
        estado: 'LISTA',
        creado: haceDiez,
        indicaciones: 'Primera semana de la unidad: nociones grande y pequeño, y arriba y abajo, con los útiles escolares del aula. Cinco horas. Quiero abrir con la historia de Don lápiz y Doña regla.',
        fechaInicio: aFechaSql(lunes),
        fechaFin: aFechaSql(sumarDias(lunes, 4)),
        tema: 'Grande – Pequeño\nArriba – Abajo',
        numeroPeriodos: '5 horas',
        objetivosTema: 'Reconocer las nociones grande/pequeño y arriba/abajo mediante la observación de objetos del salón, el juego de ubicación y fichas de trabajo, para describir con precisión el lugar y el tamaño de los objetos de su entorno.',
        estrategias: [
          '## ACTIVACIÓN DE CONOCIMIENTOS PREVIOS (A)',
          'Reconocer la emoción del día coloreando la carita correspondiente y compartiéndola, si desea, con el micrófono de participación.',
          'Observar objetos grandes y pequeños que se encuentren en el salón y describir el que cada uno encontró:\n• ¿Qué objeto encontraste?\n• ¿Es grande o pequeño?\n• ¿Hay otro más grande que ese en el salón?',
          'Ubicar una pelota en distintos lugares y responder oralmente:\n• ¿Dónde está la pelota cuando la levanto?\n• ¿Dónde está cuando la pongo en el piso?',
          '',
          '## CONSTRUCCIÓN DEL CONOCIMIENTO (C)',
          'Escuchar la historia de "Don lápiz y Doña regla" y comentar qué útil escolar es más grande y cuál más pequeño.',
          'Mencionar, según lo que salga en una ruleta de útiles escolares, si el útil es grande o pequeño.',
          'Explorar en el aula objetos que estén arriba y abajo, señalándolos y nombrándolos.',
          'Participar en el juego de ubicación ejecutando las consignas:\n• Coloca el lápiz arriba de la mesa.\n• Pon la cartuchera abajo de la silla.\n• Levanta el libro arriba.\n• Colócalo abajo.',
          '',
          '## CONSOLIDACIÓN DEL APRENDIZAJE (C)',
          'Realizar la actividad de la ficha "Mis útiles", coloreando los útiles escolares grandes y encerrando los pequeños.',
          'Identificar en la ficha "¿Arriba o abajo?" lo que va arriba y lo que va abajo, pegando la imagen donde corresponde.',
          'Participar en el juego "Simón dice" con las nociones arriba – abajo para cerrar la clase con movimiento.',
        ].join('\n'),
        recursos: 'objetos de diferente tamaño\npelota\ncuento "Don lápiz y Doña regla"\nruleta de útiles escolares\nfichas de trabajo\nlápices de colores',
        tecnica: 'Observación directa\nAnálisis de desempeño',
        instrumento: 'Lista de cotejo\nFicha de trabajo',
        generadaEn: new Date(),
        destrezas: { create: [{ destrezaId: await dz('M.1.4.6.'), orden: 0 }] },
      },
    });
    await prisma.planificacionSemanal.create({
      data: {
        inquilinoId: inst.id,
        planificacionId: pl.id,
        usuarioId: cuentas.helen,
        orden: 2,
        estado: 'LISTA',
        creado: haceDiez,
        indicaciones: 'Segunda semana: el triángulo y el círculo. Con canción, material concreto de fómix y palos de helado, y las páginas del libro.',
        fechaInicio: aFechaSql(sumarDias(lunes, 7)),
        fechaFin: aFechaSql(sumarDias(lunes, 11)),
        tema: 'Nuestro amigo el triángulo\nEl señor círculo',
        numeroPeriodos: '5 horas',
        objetivosTema:
          'Reconocer la figura geométrica del triángulo mediante la observación, manipulación y trazo de objetos del entorno con forma triangular a través de canciones, material concreto y fichas de trabajo, para desarrollar la noción de forma y el pensamiento lógico-matemático en situaciones cotidianas.\n\nReconocer la figura geométrica del círculo mediante la observación, manipulación y trazo de objetos del entorno con forma circular a través de canciones, material concreto y fichas de trabajo, para desarrollar la noción de forma y el pensamiento lógico-matemático en situaciones cotidianas.',
        estrategias: [
          '## ACTIVACIÓN DE CONOCIMIENTOS PREVIOS (A)',
          'Interpretar una canción sobre las figuras geométricas realizando con los brazos la forma del triángulo.',
          'Observar y responder oralmente al mostrar objetos con forma de triángulo (gorro de fiesta, señal de tránsito, porción de pizza):\n• ¿Qué observan?\n• ¿Cuántos lados tienen?\n• ¿Cuántas puntas ven?',
          'Observar y responder oralmente al mostrar objetos circulares (pelota, plato, reloj, moneda):\n• ¿Qué observan?\n• ¿Tienen puntas?\n• ¿Cómo es su contorno?',
          '',
          '## CONSTRUCCIÓN DEL CONOCIMIENTO (C)',
          'Conversar sobre las características del triángulo respondiendo:\n• ¿Cuántos lados tiene?\n• ¿Cuántas puntas (vértices)?\n• ¿Qué objetos de tu casa tienen esta forma?',
          'Manipular triángulos de material concreto (fómix, cartón, palos) recorriendo con el dedo sus lados y vértices.',
          'Formar triángulos con palitos, lana o el cuerpo en grupos, contando sus lados y puntas.',
          'Manipular círculos de material concreto recorriendo con el dedo su contorno redondo y sin puntas.',
          'Experimentar haciendo rodar objetos circulares y compararlos con el triángulo, que no rueda.',
          'Identificar círculos en un grupo de figuras mezcladas (triángulos, cuadrados, círculos), separando solo los círculos.',
          '',
          '## CONSOLIDACIÓN DEL APRENDIZAJE (C)',
          'Colorear los elementos con forma de triángulo y pegarlos en la ficha de trabajo.',
          'Expresar ante la clase un objeto del entorno que tenga forma de círculo, señalándolo o describiéndolo.',
          'Crear un círculo modelándolo con plastilina o lana y describiendo oralmente su forma redonda.',
          'Trazar y colorear en la ficha de trabajo los círculos siguiendo los puntos guía y decorándolos.',
        ].join('\n'),
        recursos: 'canción\nobjetos con formas\nlana\nfómix\npalos de helado\nplastilina\nimágenes\nlibro del estudiante',
        tecnica: 'Observación directa\nAnálisis de desempeño',
        instrumento: 'Lista de cotejo\nRúbrica\nFichas de trabajo',
        generadaEn: new Date(),
        destrezas: { create: [{ destrezaId: await dz('M.1.4.21.'), orden: 0 }] },
      },
    });
  }

  const resumen = {
    planes: await prisma.plan.count(),
    instituciones: await prisma.inquilino.count(),
    usuarios: await prisma.usuario.count(),
    materias: await prisma.materia.count(),
    destrezas: await prisma.destreza.count(),
    planificaciones: await prisma.planificacion.count(),
    semanas: await prisma.planificacionSemanal.count(),
  };
  console.log('✔ Semilla lista:', JSON.stringify(resumen));

  if (nuevas.length) {
    console.log('\n  ── Credenciales generadas (se muestran UNA vez) ───────────────');
    nuevas.forEach((l) => console.log(l));
    console.log('  ───────────────────────────────────────────────────────────────\n');
  } else console.log('  (Sin cuentas nuevas: ya existían. Nada se ha pisado.)');
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
