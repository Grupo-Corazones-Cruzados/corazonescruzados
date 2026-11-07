import { ACCESOS, PUBLICOS, SERVICIOS, SITIO, TEMAS_CLIENTES } from '@/lib/sitio/contenido';
import { HERRAMIENTAS, HERRAMIENTAS_INTRO, MODELO_INTRO, PASOS, PISOS, REGLAS_4P, sinNegritas } from '@/lib/sitio/modeloGcc';

/**
 * LO PÚBLICO DEL NEGOCIO QUE EL AGENTE PUEDE CONTAR. Sale de los mismos textos que enseña el sitio; lo que
 * no vive en él (módulos de la plataforma, pagos, facturación) va escrito aquí y se revisa con Fernando.
 */

export const CARGOS_PUBLICOS = `Lo que SÍ compartes de los miembros, porque es público: su perfil, contacto, talentos y portafolio, y quiénes fueron responsables de un trabajo. Usa \`buscar_miembros\` y \`leer_trabajo\`.`;

const limpio = (t: unknown) => sinNegritas(String(t ?? '')).replace(/\s+/g, ' ').trim();

export function conocimientoDelNegocio(): string {
  const temas = TEMAS_CLIENTES.map((t) => `- ${t.titulo}: ${limpio(t.descripcion ?? t.texto)}`).join('\n');
  const accesos = ACCESOS.map((a) => `- ${a.titulo}: ${limpio(a.texto)}`).join('\n');
  const servicios = SERVICIOS.map((s) => `- ${s.titulo}: ${limpio(s.resumen)}`).join('\n');
  const publicos = PUBLICOS.map((p) => `- ${p.label}: ${limpio(p.entradilla)}`).join('\n');
  return `### Quiénes somos
${SITIO.nombre}. Razón social: ${SITIO.razonSocial}. RUC: ${SITIO.ruc}. Dirección: ${SITIO.direccion}. Correo: ${SITIO.correo}. Teléfono: ${SITIO.telefono}. Sitio: ${SITIO.url}.
Eslogan: Un corazón puede cruzar al mundo.

### Propósito y Modelo de Grupo
${limpio(MODELO_INTRO)}
Pisos: ${PISOS.map((p) => `${p.name} (${p.desc})`).join('; ')}.
Pasos: ${PASOS.map((p) => `${p.name} (${p.desc})`).join('; ')}.
Reglas: ${REGLAS_4P.map(limpio).join(' ')}
Herramientas: ${limpio(HERRAMIENTAS_INTRO)}
${HERRAMIENTAS.map((h) => `- ${h.nombre}: ${h.parrafos.map(limpio).join(' ').slice(0, 500)}`).join('\n')}

### Página Clientes
${temas}
${accesos}

### Servicios
${servicios}

### Para quién es
${publicos}

### Página Candidatos
Quien quiere sumarse se postula desde la página Candidatos: recorre el Modelo de Grupo, las herramientas, los motivos, el método y envía su postulación, que el grupo revisa. Un equipo solo puede crear un registro cada 24 horas.

### Página Miembros
Los miembros atienden proyectos y tickets según sus talentos y publican su portafolio. Su perfil, contacto y portafolio son públicos.

### Plataforma (GCC Progreso), por módulos
- Tickets: pedir y seguir trabajos puntuales.
- Proyectos: crear y seguir proyectos con sus requerimientos y etapas.
- Marketplace: productos, servicios y proyectos publicados.
- Plataformas: los productos contratados por suscripción.
- Suscripciones: ver y gestionar las mensualidades.
- Configuración: perfil, passkeys, datos de facturación y conexiones.
- Soporte: ayuda y preguntas frecuentes.
Candidatos y miembros tienen además Inicio, Mi día, Recordatorios, Pensamientos, Experiencias, Clientes, Facturas y Herramientas. Los miembros usan los sistemas internos de Centralizado.
GCC Aventura es el videojuego del grupo. GCC Centralizado es la app de los miembros.

### Métodos de pago
Tarjeta, por la pasarela PayPhone, y transferencia a Banco Pichincha o Banco Guayaquil, en dólares. La transferencia se confirma al verificar el dinero en el banco. Los números de cuenta se muestran en la página de pago del cobro: no los des aquí. En las apps de teléfono pueden no estar disponibles todos los pagos: remite a la web.

### Facturación
GCC emite factura electrónica autorizada por el SRI de Ecuador, en dólares. El cliente puede tener hasta 3 datos de facturación, y la factura se emite con los datos que elija. Para una factura concreta, debe escribir a ${SITIO.correo} o consultarla con su cuenta.`;
}
