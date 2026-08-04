/**
 * EL CONTENIDO DEL SITIO PÚBLICO — fuente única.
 *
 * Las páginas de `/negocio`, `/recursos` y `/contacto` **no llevan texto escrito dentro**:
 * lo leen de aquí. Así se edita en un sitio, se traduce de una vez si algún día hace falta,
 * y no hay dos versiones del mismo servicio en dos páginas distintas.
 *
 * ── LAS DOS REGLAS ─────────────────────────────────────────────────────────────
 * 1. **Nada que no sea verificable.** Cada servicio corresponde a un módulo que existe en
 *    la aplicación. Sin cifras de clientes, sin años de experiencia, sin premios: un dato
 *    que no cuadra hace más daño que un dato que falta.
 *
 * 2. **El GCC es, ante todo, un PROYECTO DE DESARROLLO HUMANO** (corrección de Fernando,
 *    2026-08-02). La primera versión de este sitio lo presentaba como proveedor de
 *    tecnología, porque se escribió mirando a un revisor de Meta. Estaba del revés: los
 *    servicios a clientes **nacen del** proyecto de desarrollo humano, no al contrario, y
 *    el agente de WhatsApp es **uno** de ellos, no el eje.
 *
 *    De ahí que los servicios estén agrupados por **a quién sirven** —clientes, miembros y
 *    candidatos—, que son los tres públicos del proyecto.
 */

import { NOMBRE_COMERCIAL, RAZON_SOCIAL, RUC, DIRECCION, CONTACTO } from '@/lib/negocio/datos';

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
  /**
   * EL DOMINIO CANÓNICO DEL SITIO PÚBLICO — el que se le declara a Google.
   *
   * Solo lo usan piezas de SEO: `metadataBase`, los `canonical`, el `openGraph.url`, el
   * mapa del sitio, `robots.ts` y los JSON-LD. **No** los enlaces de los correos ni de la
   * aplicación, que van por `NEXT_PUBLIC_APP_URL`.
   *
   * ── POR QUÉ `www` Y NO `grupocc.org` A SECAS (2026-08-03) ──────────────────────
   * No es una preferencia: el dominio se compró **dentro de Microsoft 365**, y eso congela
   * los nameservers. Sin poder moverlos a un DNS con aplanado de CNAME, el apex **no puede
   * apuntar a Railway** (Railway no publica IP fija, así que no admite registros A). `www`
   * sí, con un CNAME normal.
   *
   * Para Google `www` y el apex valen exactamente igual. Lo que sí cuesta posicionamiento
   * es **cambiar el canónico a mitad de camino**, así que se elige una vez y se elige este.
   * Si algún día se transfiere el dominio fuera de Microsoft, el apex redirigirá aquí —
   * esta constante no se toca.
   *
   * ⚠️ `app.grupocc.org` NO desaparece: sigue sirviendo la plataforma, el juego y también
   * `/negocio`, que es la URL declarada a Meta en las verificaciones.
   */
  url: 'https://www.grupocc.org',
  ciudad: 'Guayaquil',
  pais: 'Ecuador',
} as const;

/**
 * LA IMAGEN QUE SALE AL COMPARTIR — hay que nombrarla en cada página, y no es obvio.
 *
 * `app/opengraph-image.tsx` se aplica sola a la portada y a cualquier ruta que **no**
 * declare su propio `openGraph`. Pero `/negocio`, `/recursos` y `/contacto` sí lo declaran
 * —cada una con su título y su descripción—, y Next **sustituye** el bloque `openGraph`
 * entero en vez de completarlo: al no llevar `images`, se quedaban sin imagen.
 *
 * Comprobado en producción el 2026-08-04: la portada traía `og:image` y las otras tres no.
 * Por eso las tres la nombran con esta constante — una sola definición, no tres rutas
 * escritas a mano.
 */
export const OG_IMAGEN = '/opengraph-image';

/* ═══════════════════════ PERFILES OFICIALES ═══════════════════════ */

/**
 * LOS PERFILES DE LA ORGANIZACIÓN EN OTRAS PLATAFORMAS.
 *
 * Van al `sameAs` de los datos estructurados de las tres páginas. `sameAs` es la forma de
 * decirle a un buscador **«esta web, esa página de LinkedIn y ese Instagram son la misma
 * organización»**. Sin él, para Google son tres cosas sueltas que casualmente se llaman
 * parecido — y con un nombre tan repetido como «Corazones Cruzados», donde hay otra
 * organización real y hasta un libro, esa confusión es justo lo que hay que deshacer.
 *
 * ⚠️ **URLs PÚBLICAS, no de administración.** Fernando pasó la de LinkedIn en su forma
 * `/company/91638038/admin/dashboard/`, que es su panel: exige sesión y permisos, así que
 * un buscador solo vería una pantalla de acceso. La que vale es la dirección pública.
 * Comprobadas las tres el 2026-08-03: responden 200 sin sesión.
 */
export const REDES = [
  'https://www.linkedin.com/company/grupo-corazones-cruzados/',
  'https://www.instagram.com/grupocorazonescruzados/',
  'https://www.facebook.com/GrupoCorazonesCruzados',
  'https://www.tiktok.com/@grupocc.org',
  'https://www.youtube.com/@grupocc-org',
] as const;

/* ═══════════════════════ NAVEGACIÓN ═══════════════════════ */

export const NAVEGACION = [
  { href: '/', label: 'Inicio' },
  // La ruta sigue siendo /recursos para no romper enlaces ya publicados; la etiqueta
  // dice lo que de verdad contiene.
  { href: '/negocio', label: 'Negocios' },
  { href: '/recursos', label: 'Desarrollo Humano' },
  { href: '/contacto', label: 'Contacto' },
] as const;

/* ═══════════════════════ ACCESOS — las cinco puertas de /negocio ═══════════════════════ */

/**
 * LAS CINCO PUERTAS DE `/negocio` — dictadas por Fernando (2026-08-04).
 *
 * Sustituyeron al bloque que había («Primero las personas. Lo demás sale de ahí.») porque
 * no decía **qué puede hacer aquí** quien llega. Y desde el mismo día son además **cinco
 * páginas**: `/negocio/<id>`.
 *
 * ── ⚠️ EL `id` ES LA URL. NO SE CAMBIA A LA LIGERA ─────────────────────────────
 * De aquí salen a la vez la tarjeta, la ruta, el mapa del sitio y el `canonical`. Cambiar
 * un `id` **rompe cualquier enlace ya publicado y tira el posicionamiento** que esa URL
 * hubiera ganado. Si algún día hay que renombrar uno, se hace con una **redirección
 * permanente** del viejo al nuevo, nunca a secas.
 *
 * Fernando eligió nombres y no números (`/negocio/requerimientos` en vez de
 * `/negocio/necesidad1`): la URL dice de qué va, y eso cuenta tanto para el buscador como
 * para quien recibe el enlace por WhatsApp.
 *
 * ── CÓMO ESTÁN ESCRITAS LAS TARJETAS ───────────────────────────────────────────
 * **Nombre + una frase.** Nacieron sin nombre —el icono hacía de rótulo— y Fernando les
 * puso uno el mismo día: Progreso · Automatización · Videojuego · Marketplace · Democracia.
 * Ese nombre es **el mismo** en la tarjeta, en el `<h1>` de su página y en el rail del
 * Admin: un solo `titulo`, para que no se separen con el tiempo.
 *
 * ⚠️ **La quinta habla de algo que TODAVÍA NO EXISTE.** Buscado en el código: lo único que
 * hay es que los **miembros** voten la **cancelación de un proyecto**
 * (`project_cancellation_votes`, y el endpoint rechaza a quien no es miembro). Se avisó del
 * riesgo —esta es la página que revisa Meta, y anunciar lo que un revisor no encuentra es
 * justo lo que tumbó la primera verificación— y **Fernando decidió dejarla**: «es lo que
 * viene». Queda escrito aquí para que la decisión tenga dueño y fecha.
 */
export interface Acceso {
  /** El último tramo de la URL: `/negocio/<id>`. Ver el aviso de arriba. */
  id: string;
  icono: string;
  /**
   * El nombre de la puerta. Se usa en TRES sitios y por eso es uno solo: el título de la
   * tarjeta, el `<h1>` de su página y la etiqueta del rail de Admin → FAQs. Dos nombres para
   * lo mismo se separan con el tiempo.
   * Dictados por Fernando el 2026-08-04: Progreso · Automatización · Videojuego ·
   * Marketplace · Democracia.
   */
  titulo: string;
  /** La frase de la tarjeta. */
  texto: string;
  /**
   * Enlace a otra parte del sitio, si lo tiene. Se pinta **en la página de detalle**, no en
   * la tarjeta: la tarjeta entera ya es un enlace, y un `<a>` dentro de otro `<a>` es
   * marcado inválido — el navegador lo desarma y uno de los dos deja de funcionar.
   */
  enlaceExterno?: { href: string; etiqueta: string };
  /**
   * ⏳ PENDIENTE — el vídeo de YouTube de esta página.
   *
   * Fernando (2026-08-04): *«no tengo los enlaces de youtube porque no he creado los vídeos
   * todavía; en el futuro te los pasaré»*. Mientras esté vacío, **la sección de vídeo no se
   * pinta**: ni hueco, ni recuadro gris, ni «próximamente». Es la misma regla que ya siguen
   * `CLIENTES` y `VIDEOS`.
   *
   * Cuando lleguen, basta con pegar aquí la dirección normal del vídeo —la de la barra del
   * navegador, `https://www.youtube.com/watch?v=…` o `https://youtu.be/…`—. De extraer el
   * identificador y montar el reproductor se encarga `idDeYouTube` en `VideoYouTube`.
   */
  video?: string;
  /**
   * LOS TEMAS de su página — entre el vídeo y las preguntas frecuentes.
   *
   * Cada uno le habla al cliente de una cosa: una pregunta grande que le suena a su
   * problema, la respuesta en una o dos frases, y unos pasos para que no quede en promesa.
   * Aquí caben los flujos de trabajo que resuelven dudas frecuentes.
   *
   * Si una puerta no trae ninguno, **no se pinta nada**: ni recuadro vacío ni relleno.
   */
  temas?: Tema[];
}

/**
 * UN TEMA — con su propio enlace.
 *
 * ── POR QUÉ ANCLA Y NO PÁGINA PROPIA (decisión de Fernando, 2026-08-04) ────────
 * Se enlazan como `/negocio/<puerta>#<id>`, no como `/negocio/<puerta>/<id>`. Los temas son
 * **cortos** —párrafo y unos pasos—, y una página corta en un dominio recién estrenado
 * acaba en «rastreada, actualmente sin indexar». Acumulándolos en la página de su puerta
 * pasa lo contrario: **la página se hace densa**, que es justo lo que Google pide cuando
 * habla de «calidad suficiente». Y el enlace directo funciona igual de bien.
 *
 * ⚠️ **El `id` es la mitad de una URL**: `#como-funciona` se comparte por WhatsApp y se
 * queda en el navegador de la gente. Cambiarlo rompe los enlaces que ya circulen. Se usan
 * palabras, sin tildes ni mayúsculas, separadas por guiones.
 */
export interface Tema {
  /** El ancla: `/negocio/<puerta>#<id>`. No se cambia a la ligera. */
  id: string;
  /** Rótulo pequeño en versalitas, sobre la pregunta. */
  etiqueta: string;
  /** La pregunta grande. Es el gancho: tiene que sonar al problema de quien lee. */
  pregunta: string;
  /** La respuesta, en una o dos frases. */
  texto: string;
  /** Los pasos, para que la promesa se vea concreta. Opcional. */
  pasos?: { titulo: string; texto: string }[];
}

export const ACCESOS: Acceso[] = [
  {
    id: 'requerimientos', icono: 'ticket',
    titulo: 'Progreso',
    texto: 'Gestiona tus requerimientos publicando tickets, o proyectos que necesitan en tu organización.',
    /**
     * Dictado por Fernando el 2026-08-04, con permiso para retocarlo. Su texto era:
     *
     *   «¿Tienes requerimientos específicos en tus proyectos o en tus procesos para tu
     *   organización? Solicita un ticket al cual nuestros miembros a través de su talento
     *   podrán tomarlo y resolverlo aprovechando la disponibilidad y el acceso rápido a
     *   nuestros recursos humanos.»
     *
     * Qué se cambió y por qué:
     *  · La pregunta se acortó. Un titular grande se lee de un vistazo o no se lee; «para tu
     *    organización» ya se entiende por el contexto y solo alargaba la línea.
     *  · «Aprovechando la disponibilidad y el acceso rápido a nuestros recursos humanos» se
     *    convirtió en **lo que significa**: que lo toma quien tiene el talento, y que empieza
     *    ya. Dicho así es una ventaja; dicho en el original, es una frase de folleto.
     *  · Se añadieron los tres pasos. La promesa «lo resolvemos» la hace cualquiera; lo que
     *    convence es enseñar el mecanismo. Los tres corresponden a módulos que EXISTEN
     *    —tickets, el círculo del talento y el portal del cliente—, según la regla de la
     *    página: nada que no sea verificable.
     */
    temas: [{
      id: 'como-funciona',
      etiqueta: 'Cómo funciona',
      pregunta: '¿Tienes un requerimiento que nadie termina de resolver?',
      texto:
        'Publícalo como ticket. No se queda esperando a que alguien tenga hueco: lo toma el miembro cuyo talento encaja con lo que pides, y empieza a moverse desde ese momento.',
      pasos: [
        {
          titulo: 'Lo publicas',
          texto: 'Un ticket con lo que necesitas, desde tu espacio de cliente. Sin reuniones previas para poder empezar.',
        },
        {
          titulo: 'Lo toma quien sabe hacerlo',
          texto: 'Nuestros miembros ven los requerimientos abiertos y lo toma quien tiene el talento que ese pide.',
        },
        {
          titulo: 'Lo sigues sin preguntar',
          texto: 'El estado está siempre a la vista, y lo que se resuelve queda registrado con su historia.',
        },
      ],
    }],
  },
  {
    id: 'automatizacion', icono: 'rayo',
    titulo: 'Automatización',
    texto: 'Adquiere soluciones de automatización para tu negocio: aplicaciones, agentes de IA y robots.',
  },
  {
    id: 'videojuego', icono: 'juego',
    titulo: 'Videojuego',
    texto: 'Adéntrate en una aventura a través del videojuego GCC World.',
  },
  {
    id: 'marketplace', icono: 'tienda',
    titulo: 'Marketplace',
    texto: 'Accede al marketplace y compra productos, automatizaciones y proyectos de los miembros y candidatos de la organización.',
    enlaceExterno: { href: '/marketplace-publico', etiqueta: 'Ver el marketplace' },
  },
  {
    id: 'votacion', icono: 'voto',
    titulo: 'Democracia',
    texto: 'Sé parte de un sistema que te permite votar sobre las mejoras a realizar dentro de la organización.',
  },
];

/** Búsqueda por URL. `undefined` si el tramo no es ninguna puerta → la ruta responde 404. */
export function accesoPorId(id: string): Acceso | undefined {
  return ACCESOS.find((a) => a.id === id);
}

/* ═══════════════════════ SERVICIOS ═══════════════════════ */

export type Publico = 'clientes' | 'miembros' | 'candidatos';

export const PUBLICOS: { id: Publico; label: string; entradilla: string }[] = [
  { id: 'clientes', label: 'Para empresas y clientes',
    entradilla: 'Lo que construimos y operamos para quien nos contrata. Nace de lo que primero desarrollamos para nosotros mismos.' },
  { id: 'miembros', label: 'Para los miembros',
    entradilla: 'Las herramientas del proyecto: es aquí donde empieza todo lo demás.' },
  { id: 'candidatos', label: 'Para quien llega nuevo',
    entradilla: 'Cómo se entra, qué se recibe y cómo se demuestra la afiliación.' },
];

export interface Servicio {
  id: string;
  icono: string;
  publico: Publico;
  titulo: string;
  resumen: string;
  detalle: string[];
}

export const SERVICIOS: Servicio[] = [
  /* ── PARA CLIENTES ─────────────────────────────────────────────────────────── */
  {
    id: 'plataformas', icono: 'capas', publico: 'clientes',
    titulo: 'Plataformas de gestión a medida',
    resumen: 'El sistema con el que tu empresa gestiona su trabajo, construido sobre cómo trabajáis de verdad.',
    detalle: [
      'Proyectos y tareas, tickets de soporte, clientes, cotizaciones, suscripciones y facturación, en un solo sitio.',
      'Cada implantación se ajusta a **tu operación real** en lugar de obligarte a adaptarte a un producto cerrado.',
      'Tus clientes pueden tener su propio acceso para ver el estado de lo suyo sin tener que preguntarte.',
    ],
  },
  {
    id: 'agente-whatsapp', icono: 'mensaje', publico: 'clientes',
    titulo: 'Agentes de atención con IA en WhatsApp',
    resumen: 'Tu número de WhatsApp Business atiende solo, con la información de tu negocio, y pasa a una persona cuando hace falta.',
    detalle: [
      'Conectas **tu propio número** y lo conservas: tu equipo sigue usando WhatsApp Business en el teléfono y WhatsApp Web como siempre.',
      'El agente responde solo con **el conocimiento de tu negocio**. Lo que no sabe, no se lo inventa: lo pasa a una persona.',
      'Cada conversación queda en **una bandeja** donde tu equipo ve quién contestó qué y puede tomar el control.',
      'Tú decides cuándo se enciende. **No responde a nadie hasta que lo apruebas.**',
    ],
  },
  {
    id: 'automatizacion', icono: 'rayo', publico: 'clientes',
    titulo: 'Automatización de la comunicación',
    resumen: 'Campañas, recordatorios y avisos que salen solos desde lo que ya ocurre en tu operación.',
    detalle: [
      'Campañas de **correo electrónico y de WhatsApp** con plantillas, programación por lotes y seguimiento de entrega.',
      'Recordatorios automáticos generados desde tu propia operación: un vencimiento, una reunión, una factura.',
    ],
  },
  {
    id: 'facturacion', icono: 'documento', publico: 'clientes',
    titulo: 'Facturación electrónica con el SRI',
    resumen: 'Emisión, firma y autorización de comprobantes ante el SRI, dentro del mismo sistema.',
    detalle: [
      'Comprobantes firmados y autorizados por el **Servicio de Rentas Internas del Ecuador**.',
      'Se factura desde donde ya está el proyecto o la suscripción, sin volver a teclear nada.',
    ],
  },
  {
    id: 'cotizaciones', icono: 'documento', publico: 'clientes',
    titulo: 'Cotizaciones y seguimiento',
    resumen: 'Pides lo que necesitas, recibes la propuesta con su alcance y su precio, y queda registrada.',
    detalle: [
      'Todo ocurre **dentro de la plataforma**, en tu espacio de cliente: nada se pierde en un hilo de correos.',
      'Cada versión de la cotización se conserva, así que se puede volver atrás y comparar.',
    ],
  },

  /* ── PARA MIEMBROS ─────────────────────────────────────────────────────────── */
  {
    id: 'condiciologia', icono: 'brujula', publico: 'miembros',
    titulo: 'Metodología condiciológica',
    resumen: 'El método del proyecto: reconocer las condiciones que intervienen en algo, y cambiarlas.',
    detalle: [
      'Seis pasos: **Reconocer, Controlar, Predecir, Experimentar, Convertir y Cambiar.**',
      'Una condición es el conjunto de factores que se manifiestan en una instancia de la realidad. Lo que **no se ha estudiado no es una condición**: se convierte en una cuando se reconoce por qué ocurrió.',
      'Se aplica a personas, a proyectos y a ideas, y de ahí salen las decisiones estratégicas del grupo.',
    ],
  },
  {
    id: 'crecimiento', icono: 'personas', publico: 'miembros',
    titulo: 'Método de crecimiento personal',
    resumen: 'Cuatro aspectos, en orden de importancia, para analizar dónde está cada persona y qué necesita.',
    detalle: [
      '**Talento** primero, porque es el origen del potencial. Después **valores**, que fortalecen a la persona frente al mundo.',
      'Luego las **cuatro dimensiones de desarrollo humano**: laboral, corporal, social y mental.',
      'Y la **red de apoyo** al final: es un complemento, no el origen. Nadie la necesita para tener éxito.',
    ],
  },
  {
    id: 'herramientas-diarias', icono: 'rayo', publico: 'miembros',
    titulo: 'Herramientas del día a día',
    resumen: 'La aplicación con la que un miembro trabaja sus condiciones cada día.',
    detalle: [
      'Horario de vida, tareas, recordatorios y seguimiento de lo que se propone.',
      'Registro de pensamientos y de percepción, para tener con qué medir en lugar de opinar de memoria.',
      'Su espacio de proyectos y experiencias dentro del grupo.',
    ],
  },
  {
    id: 'proyectos-compartidos', icono: 'capas', publico: 'miembros',
    titulo: 'Proyectos compartidos',
    resumen: 'Todos los proyectos que surgen son recursos del grupo, y el talento se reutiliza entre ellos.',
    detalle: [
      'Organizados con el **Modelo 4P**: cuatro pisos —Global, Pilar, Controlador y Colaborador— y cuatro pasos —Fundamentación, Creación, Implementación y Gestión—.',
      'Si un proyecto cae, **el talento se reutiliza** en otro. El conocimiento se comparte entre generaciones y entre proyectos, con competencia sana.',
    ],
  },
  {
    id: 'marketplace', icono: 'tienda', publico: 'miembros',
    titulo: 'Marketplace y talento',
    resumen: 'Perfiles con CV y portafolio, para que el talento del grupo sea visible y reutilizable.',
    detalle: [
      'Publicación de servicios y necesidades entre los proyectos del grupo.',
      'Un CV y un portafolio que se mantienen solos desde lo que ya se hace dentro.',
    ],
  },

  /* ── PARA CANDIDATOS ───────────────────────────────────────────────────────── */
  {
    id: 'videojuego', icono: 'juego', publico: 'candidatos',
    titulo: 'GCC World — el videojuego',
    resumen: 'Un mundo 2D donde el proyecto se explica jugando, no leyendo un folleto.',
    detalle: [
      'Juego de **pixel art en 2D** desarrollado en Godot, jugable desde el navegador.',
      'Tu personaje se crea al entrar y **te acompaña dentro de la plataforma**: es la misma identidad, no dos cosas separadas.',
    ],
  },
  {
    id: 'afiliacion', icono: 'brujula', publico: 'candidatos',
    titulo: 'El camino de candidato a miembro',
    resumen: 'Qué se recibe al entrar y cómo se demuestra la afiliación.',
    detalle: [
      'Se postula desde el formulario del sitio. Quien es elegido recibe acceso como **usuario candidato** y su **pulsera gris**.',
      'Y una **pizarra de visión personal**, que se lleva a las reuniones semanales presenciales con los controladores.',
      'La afiliación **no se mide en puntos**: es una cualificación basada en los logros y resultados de las acciones que se ejecutan.',
    ],
  },
  {
    id: 'beneficios', icono: 'personas', publico: 'candidatos',
    titulo: 'Qué se recibe desde el primer día',
    resumen: 'Beneficios para el desarrollo humano en todas sus dimensiones.',
    detalle: [
      '**No es un empleo y no hay trabajos no remunerados**: toda acción tiene un propósito y un beneficio para quien la hace.',
      'El crecimiento se adapta a la necesidad de cada uno, valorando su talento y dándole los recursos que requiere.',
      'Acceso a las herramientas del grupo desde el momento de la afiliación.',
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
 * ⚠️ `VIDEOS` SIGUE VACÍO A PROPÓSITO: Fernando dio el **canal** (2026-08-03), no vídeos
 * concretos. Destacar uno es una decisión suya —cuál representa al proyecto—, y no se
 * inventan enlaces que puedan no existir: uno roto en la web que revisa Meta es peor que no
 * tener sección. Cuando diga cuáles, entran aquí y la rejilla aparece sola.
 *
 * `CANAL_YOUTUBE` sí está: con él, la sección «En vídeo» de `/contacto` **ya se pinta**, con
 * su botón al canal. Comprobado el 2026-08-03: responde 200.
 */
export const VIDEOS: Video[] = [];
export const CANAL_YOUTUBE: string | null = 'https://www.youtube.com/@grupocc-org';
