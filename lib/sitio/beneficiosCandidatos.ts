/**
 * LOS BENEFICIOS DE SER CANDIDATO — bajo el botón «Postularme» de la página Candidatos (Fernando,
 * 2026-11-12). Lo que abre la cuenta de un candidato ACEPTADO (`lib/dashboard/access.ts`,
 * `lib/herramientas/catalogo.ts`) y lo que se tiene pensado para el videojuego (`godot/Videojuego.md`
 * §3-bis y Clientes ▸ Videojuego).
 *
 * 2.ª versión (2026-11-12): la primera tenía un tono de publicidad que no es el de Fernando («Lo que
 * recibes desde el primer día», «no es esperar a ser aceptado: …») y decía algo falso: ser candidato SÍ
 * es esperar a ser aceptado. Fernando los corrige y se trasladan literales.
 *
 * `icono` es el nombre de un icono de lucide; lo resuelve `BeneficiosCandidatos`. Desde 2026-11-12 la página
 * pinta cada grupo como una GALERÍA HORIZONTAL con `etiqueta` por título (Fernando, 2026-11-12:
 * «conservar las separaciones por grupos… galerías horizontales»); `titulo` y `texto` del grupo no se ven.
 * El grupo `miembros` se llama «Desarrollo Humano»: sus beneficios son también de los candidatos. Sin «Próximamente» (Fernando, 2026-11-12: no se da acceso aún;
 * todo se tendrá listo antes de publicar).
 */

export interface Beneficio { titulo: string; texto: string; icono: string }
export interface GrupoBeneficios { id: string; etiqueta: string; titulo: string; texto: string; beneficios: Beneficio[] }

export const BENEFICIOS_INTRO = {
  etiqueta: 'Beneficios',
  titulo: 'Beneficios de los candidatos',
  texto:
    'Los candidatos que son aceptados en el proyecto del Grupo Corazones Cruzados, reciben acceso a los módulos de la plataforma "Progreso", al videojuego "GCC World" y a las herramientas públicas, con el fin de impulsar su "Desarrollo Humano" mientras demuestran los valores de la organización. A continuación te presento los beneficios que tendrás como candidato:',
};

export const GRUPOS_BENEFICIOS: GrupoBeneficios[] = [
  {
    id: 'progreso',
    etiqueta: 'Progreso',
    titulo: 'Módulos de Progreso',
    texto: '"Progreso" es la plataforma en donde los candidatos y miembros organizan su trabajo, y registran las acciones que demuestran su avance dentro del proyecto.',
    beneficios: [
      { icono: 'CalendarDays', titulo: 'Mi día', texto: 'El horario de vida de cada candidato, con las tareas de cada día asociadas a sus valores, talentos, tickets y proyectos.' },
      { icono: 'PartyPopper', titulo: 'Experiencias', texto: 'Los eventos de Gestión Social abiertos a candidatos y miembros, en donde pueden participar para demostrar sus valores.' },
      { icono: 'BrainCircuit', titulo: 'Pensamientos', texto: 'Un cuaderno personal y privado para escribir lo que piensas y sientes cada día.' },
      { icono: 'AlarmClock', titulo: 'Recordatorios', texto: 'Los recordatorios que se generan sobre tus eventos o registros en la plataformas.' },
      { icono: 'Ticket', titulo: 'Tickets y Proyectos', texto: 'Los requerimientos de nuestros clientes, en donde puedes obtener oportunidades con el talento que tienes.' },
      { icono: 'ReceiptText', titulo: 'Facturas', texto: 'Registramos los trabajos realizados y de los pagos recibidos emitidos desde una cuenta tuya del Sistema de Rentas Internas.' },
      { icono: 'Store', titulo: 'Marketplace', texto: 'Las soluciones, productos y servicios publicados por todos los talentos del grupo, incluyendo tus publicaciones.' },
      { icono: 'IdCard', titulo: 'Hoja de vida y portafolio', texto: 'La hoja de vida, el portafolio y la disponibilidad de tu perfil, y puedes compartir un enlace a clientes desde el cuál pueden cotizar tus servicios mediante un agente de IA.' },
    ],
  },
  {
    id: 'videojuego',
    etiqueta: 'Videojuego',
    titulo: 'Videojuego GCC World',
    texto: '"GCC World" es un videojuego que se encuentra en desarrollo, y que va a permitir a los candidatos y miembros participar en el proyecto mediante retos, misiones y eventos. Esto es lo que se tiene pensado ofrecer:',
    beneficios: [
      { icono: 'Swords', titulo: 'Misiones cooperativas', texto: 'Ofrecemos retos diarios a través de nuestro Videojuego, en donde puedes enfrentar pruebas de estrategia, puzzles y decisiones difíciles junto a otros candidatos, miembros, y clientes.' },
      { icono: 'Coins', titulo: 'GCC Coins', texto: 'Participar para obtener GCC Coins, y ganar acceso a recursos, servicios y productos gratuitos que puedes reclamar para aumentar tu progreso.' },
      { icono: 'Users', titulo: 'Eventos comunitarios', texto: 'Participar en eventos comunitarios del videojuego para ganar GCC Coins, conocer otros usuarios, conseguir logros o reconocimientos, premios, y también obtener oportunidades para socializar con nuestros clientes.' },
    ],
  },
  {
    id: 'herramientas',
    etiqueta: 'Herramientas',
    titulo: 'Herramientas públicas',
    texto: 'Son las herramientas que el Grupo Corazones Cruzados ofrece sin costo a sus candidatos y miembros, para resolver tareas que se presentan en el trabajo y en la vida diaria.',
    beneficios: [
      { icono: 'Repeat2', titulo: 'Convertir archivos', texto: 'Convierte archivos de audio y video (M4A, MP4, WAV, OGG) a MP3 y a otros formatos.' },
      { icono: 'Captions', titulo: 'Transcribir audio', texto: 'Transcribe archivos de audio a texto usando inteligencia artificial.' },
      { icono: 'QrCode', titulo: 'Enlace a código QR', texto: 'Convierte un enlace en un código QR para descargarlo en PNG o SVG.' },
    ],
  },
  {
    id: 'ingresos',
    etiqueta: 'Crecimiento profesional',
    titulo: 'Crecimiento profesional',
    texto: 'El Grupo Corazones Cruzados es una organización en donde cada candidato demuestra mediante sus resultados lo que es capaz de hacer, y recibe las herramientas para presentarse como parte del proyecto.',
    beneficios: [
      { icono: 'Award', titulo: 'Talentos Certificados', texto: 'Los talentos de cada candidato se identifican según las tareas, tickets y proyectos que completes en tu búsqueda por descubrir tu talento y resolver tus problemas.' },
      { icono: 'Gauge', titulo: 'Evaluación Continua', texto: 'Analizamos y ofrecemos una ruta de desarrollo que pone a prueba su prospección, y mostrando  avances en valores, talentos, las dimensiones de desarrollo humano y su red de apoyo.' },
      { icono: 'Mail', titulo: 'Correo corporativo', texto: 'Todos los usuarios Candidatos y Miembros obtienen una cuenta de correo con el dominio @grupocc.org, cuando su postulación queda aceptada.' },
      { icono: 'Smartphone', titulo: 'App GCC World', texto: 'La aplicación para desktop y móvil publicadas en las tiendas de Google Play y Apple Store.' },
    ],
  },
  {
    id: 'emprendimiento',
    etiqueta: 'Emprendimiento',
    titulo: 'Recursos para emprender',
    texto: 'Las soluciones que el Grupo Corazones Cruzados ofrece a sus clientes, también van a estar disponibles para que los candidatos las contraten, y organicen y automaticen sus propios negocios.',
    beneficios: [
      { icono: 'Store', titulo: 'Productos del Grupo', texto: 'Ofrecemos productos personalizados, en mejora continua, y creados como sistemas para la gestión de diversos tipos o rubros de negocio, usando un precio módico por organización.' },
      { icono: 'Workflow', titulo: 'Automatizaciones', texto: 'Ofrecemos servicio de envío de postulaciones a puestos de trabajo de forma automática, y crear soluciones para automatizar tu negocio.' },
      { icono: 'Lightbulb', titulo: 'Impulsa tus Ideas', texto: 'Presenta tus ideas de negocio como un proyecto, y si es viable, otros pueden trabajar junto a ti para desarrollar una solución de valor.' },
    ],
  },
  {
    id: 'aprendizaje',
    etiqueta: 'Aprendizaje',
    titulo: 'Orientación y aprendizaje',
    texto: 'Nosotros queremos que cada conocimiento que tiene una persona pueda ser aprendido por otras, demostrado, y luego ofrecido en un mercado.',
    beneficios: [
      { icono: 'Compass', titulo: 'Orientación Vocacional', texto: 'Un informe que según los talentos demostrados, el horario de vida y la prospección, indica en qué piso y paso del Modelo 4P encaja cada candidato.' },
      { icono: 'GraduationCap', titulo: 'Sistema de Aprendizaje', texto: 'Preparamos cursos sobre un conocimiento que sirvió a uno de nuestros miembros, luego otros que quieran lo aprenden y luego lo demuestran en prácticas para finalmente ofrecerlo como talento o servicio en la plataforma.' },
      { icono: 'Coins', titulo: 'Ganar Educando', texto: 'Nuestros educadores obtienen ganancias por ofrecer planes de enseña a nuestros candidatos y miembros sobre conocimientos y habilidades enfocadas en un modelo práctico que busca resolver problemas y necesidades.' },
    ],
  },
  {
    id: 'miembros',
    etiqueta: 'Desarrollo Humano',
    titulo: 'Beneficios de los miembros',
    texto: 'Al ser aceptado como miembro del Grupo Corazones Cruzados, tu cuenta abre los sistemas de Centralizado y las herramientas para hacer crecer tu negocio:',
    beneficios: [
      { icono: 'HeartHandshake', titulo: 'Apoyo y Autoayuda', texto: 'Un sistema en donde recibes tareas para trabajar tu prospección, y plantear retos y estrategias de desarrollo que pueden resolver tus problemas.' },
      { icono: 'Clapperboard', titulo: 'Generación de contenido', texto: 'Integramos tus redes sociales y cuentas de tu negocio para automatizar la generación y la publicación de tu contenido, usando de base tus logros en la plataforma.' },
      { icono: 'Wallet', titulo: 'Ingresos, gastos', texto: 'Llevamos un control de tus ingresos, tus gastos, y recibes consejos de gestión financiera y tributaria para mejorar tu situación económica.' },
      { icono: 'Calculator', titulo: 'Cotizaciones con tus Soluciones', texto: 'Los clientes al ingresar a las soluciones que ofrecemos asociadas a tu talento, pueden cotizar con un Agente de IA y solicitar requerimientos que hayas trabajado antes.' },
      { icono: 'MessagesSquare', titulo: 'Cotizaciones en tu Perfil', texto: 'Desde el enlace de tu hoja de vida, los clientes pueden ingresar a tu perfil y cotizar directamente con tu perfil usando un Agente de IA, llegando a solicitar o negociar un precio sobre un requerimiento, que luego puedes aceptas o rechazar usando tu cuenta.' },
    ],
  },
];
