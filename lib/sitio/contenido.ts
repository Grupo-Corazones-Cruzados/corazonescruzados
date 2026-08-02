/**
 * EL CONTENIDO DEL SITIO PÚBLICO — fuente única.
 *
 * Las páginas de `/negocio`, `/recursos` y `/contacto` **no llevan texto escrito dentro**:
 * lo leen de aquí. Así se edita en un sitio, se traduce de una vez si algún día hace falta,
 * y no hay dos versiones del mismo servicio en dos páginas distintas.
 *
 * ── LA REGLA ───────────────────────────────────────────────────────────────────
 * **Nada que no sea verificable.** Cada servicio corresponde a un módulo que existe en la
 * aplicación. Sin cifras de clientes, sin años de experiencia, sin premios: esta es la web
 * que abre un revisor de Meta con el certificado del RUC delante, y un dato que no cuadra
 * hace más daño que un dato que falta.
 */

import { NOMBRE_COMERCIAL, RAZON_SOCIAL, RUC, DIRECCION, CONTACTO } from '@/app/legal/datos';

export const SITIO = {
  nombre: NOMBRE_COMERCIAL,
  razonSocial: RAZON_SOCIAL,
  ruc: RUC,
  direccion: DIRECCION,
  correo: CONTACTO,
  /** Tal como se marca desde fuera de Ecuador. */
  telefono: '+593 99 270 6933',
  telefonoPlano: '+593992706933',
  /** Nacional, como lo escribiría alguien en Guayaquil. */
  telefonoLocal: '0992706933',
  url: 'https://app.grupocc.org',
  ciudad: 'Guayaquil',
  pais: 'Ecuador',
} as const;

/* ═══════════════════════ NAVEGACIÓN ═══════════════════════ */

export const NAVEGACION = [
  { href: '/', label: 'Inicio' },
  { href: '/negocio', label: 'Negocio' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/contacto', label: 'Contacto' },
] as const;

/* ═══════════════════════ SERVICIOS ═══════════════════════ */

export interface Servicio {
  id: string;
  icono: string;
  titulo: string;
  resumen: string;
  detalle: string[];
}

export const SERVICIOS: Servicio[] = [
  {
    id: 'agente-whatsapp',
    icono: 'mensaje',
    titulo: 'Agentes de atención con IA en WhatsApp',
    resumen:
      'Tu número de WhatsApp Business atiende solo, con la información de tu negocio, y pasa a una persona cuando hace falta.',
    detalle: [
      'Conectas **tu propio número** y lo conservas: tu equipo sigue usando WhatsApp Business en el teléfono y WhatsApp Web como siempre. Es una conexión en coexistencia, no una sustitución.',
      'El agente se configura con **el conocimiento de tu negocio** —qué ofreces, precios, horarios, políticas— y responde solo con eso. Lo que no sabe, no se lo inventa: lo pasa a una persona.',
      'Cada conversación queda en **una bandeja** donde tu equipo ve quién contestó qué, y puede tomar el control de un chat en cualquier momento.',
      'Tú decides cuándo se enciende. **No responde a nadie hasta que lo apruebas.**',
    ],
  },
  {
    id: 'plataformas',
    icono: 'capas',
    titulo: 'Plataformas de gestión a medida',
    resumen:
      'El sistema con el que tu empresa gestiona su trabajo, construido sobre cómo trabajáis de verdad.',
    detalle: [
      'Proyectos y tareas, tickets de soporte, clientes, cotizaciones, suscripciones y facturación, en un solo sitio.',
      'Cada implantación se ajusta a **tu operación real** en lugar de obligarte a adaptarte a un producto cerrado.',
      'Tus clientes pueden tener su propio acceso para ver el estado de lo suyo sin tener que preguntarte.',
    ],
  },
  {
    id: 'automatizacion',
    icono: 'rayo',
    titulo: 'Automatización de la comunicación',
    resumen:
      'Campañas, recordatorios y avisos que salen solos desde lo que ya ocurre en tu operación.',
    detalle: [
      'Campañas de **correo electrónico y de WhatsApp** con plantillas, programación por lotes y seguimiento de entrega.',
      'Recordatorios automáticos generados desde tu propia operación: un vencimiento, una reunión, una factura.',
    ],
  },
  {
    id: 'facturacion',
    icono: 'documento',
    titulo: 'Facturación electrónica con el SRI',
    resumen:
      'Emisión, firma y autorización de comprobantes ante el SRI, dentro del mismo sistema.',
    detalle: [
      'Comprobantes electrónicos firmados y autorizados por el **Servicio de Rentas Internas del Ecuador**.',
      'Integrada en el mismo sistema de gestión: se factura desde donde ya está el proyecto o la suscripción, sin volver a teclear nada.',
    ],
  },
];

/* ═══════════════════════ RECURSOS ═══════════════════════ */

export interface Recurso {
  id: string;
  icono: string;
  titulo: string;
  resumen: string;
  detalle: string[];
  /** A quién le sirve. Encabeza la tarjeta. */
  para: string;
}

export const RECURSOS: Recurso[] = [
  {
    id: 'desarrollo-humano',
    icono: 'personas',
    para: 'Para quien quiere crecer',
    titulo: 'Plataforma de desarrollo humano',
    resumen:
      'Herramientas para trabajar sobre tus condiciones: reconocerlas, medirlas y cambiarlas.',
    detalle: [
      'El crecimiento se analiza con cuatro aspectos, en orden de importancia: **talento, valores, dimensiones de desarrollo humano** —laboral, corporal, social y mental— **y red de apoyo**.',
      'La metodología condiciológica da el método: Reconocer, Controlar, Predecir, Experimentar, Convertir y Cambiar.',
      'Los miembros usan una aplicación que evalúa sus condiciones del día a día, con horario de vida, tareas y seguimiento.',
    ],
  },
  {
    id: 'proyectos',
    icono: 'capas',
    para: 'Para quien quiere participar',
    titulo: 'Participación en proyectos',
    resumen:
      'Todos los proyectos del grupo son recursos compartidos. El talento se reutiliza entre ellos.',
    detalle: [
      'El grupo se organiza con el **Modelo 4P**: cuatro pisos —Global, Pilar, Controlador y Colaborador— y cuatro pasos —Fundamentación, Creación, Implementación y Gestión—.',
      'Si un proyecto cae, **el talento se reutiliza** en otro con mejores resultados. El conocimiento se comparte entre generaciones y entre proyectos.',
      'El crecimiento se adapta a la necesidad de cada persona, valorando su talento y dándole los recursos que requiere.',
    ],
  },
  {
    id: 'videojuego',
    icono: 'juego',
    para: 'Para quien llega nuevo',
    titulo: 'GCC World — el videojuego',
    resumen:
      'Un mundo 2D donde el proyecto se explica jugando, no leyendo un folleto.',
    detalle: [
      'Juego de **pixel art en 2D** desarrollado en Godot, jugable desde el navegador.',
      'Tu personaje se crea al entrar y te acompaña dentro de la plataforma: es la misma identidad, no dos cosas separadas.',
    ],
  },
  {
    id: 'marketplace',
    icono: 'tienda',
    para: 'Para quien busca o ofrece',
    titulo: 'Marketplace y talento',
    resumen:
      'Un espacio donde los proyectos del grupo publican lo que ofrecen y buscan.',
    detalle: [
      'Perfiles con CV y portafolio, para que el talento del grupo sea visible y reutilizable.',
      'Publicación de servicios y necesidades entre los proyectos del grupo.',
    ],
  },
];

/* ═══════════════════════ CLIENTES ═══════════════════════ */

export interface Cliente {
  nombre: string;
  sector: string;
  /** Qué se hizo con ellos. Concreto, sin adjetivos. */
  que: string;
  /** Opcional. Solo con permiso EXPRESO de la empresa. */
  url?: string;
}

/**
 * ⚠️ VACÍO A PROPÓSITO, Y NO ES UN OLVIDO.
 *
 * Publicar el nombre de un cliente en una web es una decisión **suya**, no nuestra. Aunque
 * el trabajo sea real y esté hecho, aparecer como referencia comercial se pide y se
 * concede: hay empresas que no quieren que se sepa qué proveedor les lleva la atención al
 * cliente, y descubrirlo en una web ajena sienta mal.
 *
 * Fernando: dime **qué clientes autorizan aparecer** y los añado aquí. Mientras la lista
 * esté vacía, la sección entera **no se pinta** — no queda un hueco ni un «próximamente».
 *
 * Ejemplo del formato:
 *   { nombre: "Peter's Tours", sector: 'Transporte de pasajeros y encomiendas',
 *     que: 'Agente de atención en WhatsApp con coexistencia' }
 */
export const CLIENTES: Cliente[] = [];

/* ═══════════════════════ CONTENIDO EN VÍDEO ═══════════════════════ */

export interface Video {
  titulo: string;
  descripcion: string;
  /** La URL completa del vídeo o del canal. */
  url: string;
}

/**
 * ⚠️ TAMBIÉN VACÍO, y por otra razón: **no tengo los enlaces**.
 *
 * Fernando: pásame la URL del canal y de los vídeos que quieras destacar, y los pongo. No
 * se inventan enlaces que puedan no existir — un enlace roto en la web que revisa Meta es
 * peor que no tener sección.
 */
export const VIDEOS: Video[] = [];
export const CANAL_YOUTUBE: string | null = null;
