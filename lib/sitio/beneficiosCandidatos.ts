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
 * `icono` es el nombre de un icono de lucide; lo resuelve `BeneficiosCandidatos`.
 */

export interface Beneficio { titulo: string; texto: string; icono: string; proximamente?: boolean }
export interface GrupoBeneficios { id: string; etiqueta: string; titulo: string; texto: string; beneficios: Beneficio[]; proximamente?: boolean }

export const BENEFICIOS_INTRO = {
  etiqueta: 'Beneficios',
  titulo: 'Beneficios de los candidatos',
  texto:
    'Los candidatos que son aceptados en el proyecto del Grupo Corazones Cruzados, reciben acceso a los módulos de la plataforma "Progreso", al videojuego "GCC World" y a las herramientas públicas, con el fin de impulsar su "Desarrollo Humano" mientras demuestran los valores de la organización. Algunos de estos beneficios se encuentran en desarrollo, y se indican como "Próximamente". A continuación te presento los beneficios que tendrás como candidato:',
};

export const GRUPOS_BENEFICIOS: GrupoBeneficios[] = [
  {
    id: 'progreso',
    etiqueta: 'Progreso',
    titulo: 'Módulos de Progreso',
    texto: '"Progreso" es la plataforma en donde los candidatos y miembros organizan su trabajo, y registran las acciones que demuestran su avance dentro del proyecto.',
    beneficios: [
      { icono: 'CalendarDays', titulo: 'Mi día', texto: 'El horario de vida de cada candidato, con las tareas de cada día asociadas a sus valores, talentos, tickets y proyectos.' },
      { icono: 'PartyPopper', titulo: 'Experiencias', texto: 'Los eventos de Gestión Social abiertos a candidatos y miembros, en donde participar es parte de demostrar los valores.' },
      { icono: 'BrainCircuit', titulo: 'Pensamientos', texto: 'Un cuaderno personal y privado para escribir lo que piensas y sientes cada día.' },
      { icono: 'AlarmClock', titulo: 'Recordatorios', texto: 'Los recordatorios que se envían a tu correo según la fecha y la hora que definas.' },
      { icono: 'Ticket', titulo: 'Tickets y Proyectos', texto: 'Los requerimientos de nuestros clientes, en donde los candidatos con el talento para hacerse cargo pueden ofrecer su propuesta.' },
      { icono: 'ReceiptText', titulo: 'Facturas', texto: 'El registro de los trabajos realizados y de los pagos recibidos por ellos.' },
      { icono: 'Store', titulo: 'Marketplace', texto: 'Las soluciones, productos y servicios publicados por los talentos del grupo.' },
      { icono: 'IdCard', titulo: 'Hoja de vida y portafolio', texto: 'La hoja de vida, el portafolio y la disponibilidad de cada candidato, con un enlace para compartirlos.' },
    ],
  },
  {
    id: 'videojuego',
    etiqueta: 'Videojuego',
    titulo: 'Videojuego GCC World',
    texto: '"GCC World" es un videojuego que se encuentra en desarrollo, y que va a permitir a los candidatos y miembros participar en el proyecto mediante retos, misiones y eventos. Esto es lo que se tiene pensado ofrecer:',
    proximamente: true,
    beneficios: [
      { icono: 'Swords', titulo: 'Misiones cooperativas', texto: 'Cumplir un rol en el progreso de misiones, enfrentar pruebas de estrategia, puzzles y decisiones difíciles junto a otros candidatos y miembros.' },
      { icono: 'Coins', titulo: 'GCC Coins', texto: 'Participar para obtener GCC Coins, y ganar acceso a servicios y productos gratuitos.' },
      { icono: 'Users', titulo: 'Eventos comunitarios', texto: 'Participar en eventos comunitarios del videojuego para ganar puntos, conocer perfiles, y socializar con nuestros talentos.' },
      { icono: 'Sparkles', titulo: 'Personaje', texto: 'El personaje del videojuego es la misma cuenta de la plataforma, y lo que se logra jugando acompaña el progreso dentro del proyecto.' },
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
      { icono: 'Printer', titulo: 'Formatos de impresión para Excel', texto: 'Corrige la impresión de un libro de Excel (papel, márgenes, títulos y número de página) y lo descarga en Excel o PDF.' },
      { icono: 'QrCode', titulo: 'Enlace a código QR', texto: 'Convierte un enlace en un código QR para descargarlo en PNG o SVG.' },
    ],
  },
  {
    id: 'ingresos',
    etiqueta: 'Crecimiento profesional',
    titulo: 'Crecimiento profesional',
    texto: 'El Grupo Corazones Cruzados es una organización en donde cada candidato demuestra mediante sus resultados lo que es capaz de hacer, y recibe las herramientas para presentarse como parte del proyecto.',
    beneficios: [
      { icono: 'Award', titulo: 'Talentos demostrados', texto: 'Los talentos de cada candidato se miden según las tareas, tickets y proyectos que completa, y no según lo que declara.' },
      { icono: 'Gauge', titulo: 'Evaluación continua', texto: 'La prospección de cada candidato muestra su avance en valores, talentos, dimensiones de desarrollo humano y red de apoyo.' },
      { icono: 'Mail', titulo: 'Correo corporativo', texto: 'Una cuenta de correo con el dominio @grupocc.org, que el aprobador asigna al aceptar la postulación.' },
      { icono: 'Smartphone', titulo: 'App GCC World', texto: 'La aplicación para el teléfono, con acceso mediante llave de seguridad (passkey) sin necesidad de contraseña.' },
    ],
  },
  {
    id: 'acompanamiento',
    etiqueta: 'Acompañamiento',
    titulo: 'Acompañamiento y seguridad',
    texto: 'Son los sistemas que el Grupo Corazones Cruzados va a abrir a sus candidatos para acompañar su desarrollo humano y proteger su integridad.',
    proximamente: true,
    beneficios: [
      { icono: 'ShieldCheck', titulo: 'Control Psicosocial', texto: 'Un botón de auxilio, puntos de reunión y el recorrido compartido con consentimiento, para la seguridad física de cada candidato.' },
      { icono: 'UserCheck', titulo: 'Mentoría', texto: 'Un miembro con el mismo talento que acompaña al candidato en su proceso dentro del proyecto.' },
    ],
  },
  {
    id: 'emprendimiento',
    etiqueta: 'Emprendimiento',
    titulo: 'Recursos para emprender',
    texto: 'Las soluciones que el Grupo Corazones Cruzados ofrece a sus clientes, también van a estar disponibles para que los candidatos organicen y automaticen sus propios negocios.',
    proximamente: true,
    beneficios: [
      { icono: 'Store', titulo: 'Productos del grupo', texto: 'Gestión de Reservas, Pedidos, Catering y Planificación de Clases, para el negocio o el trabajo de cada candidato.' },
      { icono: 'Workflow', titulo: 'Automatizaciones', texto: 'Los flujos de trabajo y el agente de inteligencia artificial para WhatsApp, para automatizar los procesos de cada candidato.' },
      { icono: 'Lightbulb', titulo: 'Impulso a tus ideas', texto: 'Presentar una idea de negocio como un proyecto, y si es viable, trabajarla con la metodología del "Progreso Horizontal".' },
    ],
  },
  {
    id: 'aprendizaje',
    etiqueta: 'Aprendizaje',
    titulo: 'Orientación y aprendizaje',
    texto: 'Nosotros queremos que cada conocimiento que tiene una persona pueda ser aprendido por otras, demostrado, y luego ofrecido en un mercado.',
    proximamente: true,
    beneficios: [
      { icono: 'Compass', titulo: 'Orientación vocacional', texto: 'Un informe que según los talentos demostrados, el horario de vida y la prospección, indica en qué piso y paso del Modelo 4P encaja cada candidato.' },
      { icono: 'GraduationCap', titulo: 'Sistema de aprendizaje', texto: 'Quien domina un conocimiento crea un curso, otros lo aprenden y lo demuestran con prácticas, y luego lo ofrecen como servicio en el Marketplace.' },
      { icono: 'Coins', titulo: 'Ganar enseñando', texto: 'Cada curso funciona como una suscripción, y quien lo enseña recibe los ingresos de las personas que lo toman.' },
    ],
  },
  {
    // ⇒ PERTENECER AL GRUPO (Fernando, 2026-11-12). Textos de partida: los corrige Fernando y se trasladan literales.
    id: 'miembros',
    etiqueta: 'Miembros',
    titulo: 'Beneficios de los miembros',
    texto: 'Al ser aceptado como miembro del Grupo Corazones Cruzados, tu cuenta abre los sistemas de Centralizado y las herramientas para hacer crecer tu negocio:',
    beneficios: [
      { icono: 'HeartHandshake', titulo: 'Apoyo y Autoayuda', texto: 'Un sistema en donde recibes tareas para mejorar tu situación personal y profesional.' },
      { icono: 'Clapperboard', titulo: 'Generación de contenido', texto: 'Integras las cuentas de tu negocio para automatizar la generación y la publicación de tu contenido.' },
      { icono: 'Wallet', titulo: 'Ingresos, gastos y oportunidades', texto: 'Gestionas tus ingresos y tus gastos, y recibes oportunidades de trabajo en tickets y proyectos.' },
      { icono: 'Calculator', titulo: 'Cotizaciones con tu historial', texto: 'Los clientes cotizan desde la página de Soluciones con base en los registros históricos de tu trabajo.' },
      { icono: 'MessagesSquare', titulo: 'Consultas y cotizaciones en tu hoja de vida', texto: 'Desde el enlace de tu hoja de vida, los clientes consultan sobre tu perfil y te cotizan directamente; las cotizaciones o tickets que crean los aceptas desde tu perfil.', proximamente: true },
    ],
  },
];
