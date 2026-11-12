/**
 * LOS BENEFICIOS DE SER CANDIDATO — bajo el botón «Postularme» de la página Candidatos (Fernando,
 * 2026-11-12). Versión inicial redactada desde lo que la cuenta de candidato abre hoy en el código
 * (`lib/dashboard/access.ts`, `lib/herramientas/catalogo.ts`) y lo que se tiene pensado para el
 * videojuego (`godot/Videojuego.md` §3-bis y los textos de Clientes ▸ Videojuego). Fernando los
 * corrige en el editor de textos y se trasladan literales.
 *
 * `icono` es el nombre de un icono de lucide; lo resuelve `BeneficiosCandidatos`.
 */

export interface Beneficio { titulo: string; texto: string; icono: string }
export interface GrupoBeneficios { id: string; etiqueta: string; titulo: string; texto: string; beneficios: Beneficio[]; proximamente?: boolean }

export const BENEFICIOS_INTRO = {
  etiqueta: 'Beneficios',
  titulo: 'Lo que recibes desde el primer día',
  texto:
    'Ser candidato del Grupo Corazones Cruzados no es esperar a ser aceptado: desde que recibes tu acceso puedes usar las mismas herramientas y sistemas con los que trabajan nuestros miembros, para ordenar tu vida, demostrar tus valores y hacer crecer tu talento.',
};

export const GRUPOS_BENEFICIOS: GrupoBeneficios[] = [
  {
    id: 'herramientas',
    etiqueta: 'Herramientas',
    titulo: 'Herramientas de uso libre',
    texto: 'Sin costo y sin límite de uso, para resolver tareas del día a día desde tu cuenta.',
    beneficios: [
      { icono: 'Repeat2', titulo: 'Convertir archivos', texto: 'Cambia el formato de tus audios y videos (M4A, MP4, WAV, OGG) a MP3 y otros formatos.' },
      { icono: 'Captions', titulo: 'Transcribir audio', texto: 'Convierte tus audios en texto con inteligencia artificial, para tus reuniones, clases o ideas.' },
      { icono: 'Printer', titulo: 'Formatos de impresión para Excel', texto: 'Corrige el papel, los márgenes, los títulos y la numeración de un libro de Excel y descárgalo listo en Excel o PDF.' },
      { icono: 'QrCode', titulo: 'Enlace a código QR', texto: 'Convierte cualquier enlace en un código QR para descargarlo en PNG o SVG.' },
    ],
  },
  {
    id: 'progreso',
    etiqueta: 'Progreso',
    titulo: 'Los módulos de Progreso',
    texto: 'La plataforma con la que se organiza el trabajo y el «Desarrollo Humano» de cada candidato y miembro.',
    beneficios: [
      { icono: 'CalendarDays', titulo: 'Mi día', texto: 'Tu horario de vida: las tareas de cada día asociadas a tus valores y talentos, y las de los tickets y proyectos en los que participas.' },
      { icono: 'PartyPopper', titulo: 'Experiencias', texto: 'Eventos de Gestión Social abiertos a candidatos y miembros, donde participar es parte de demostrar tus valores.' },
      { icono: 'BrainCircuit', titulo: 'Pensamientos', texto: 'Tu cuaderno personal y privado, para escribir lo que piensas y lo que sientes cada día.' },
      { icono: 'AlarmClock', titulo: 'Recordatorios', texto: 'Lo que no puedes olvidar, con avisos a tu correo según la fecha y la hora que elijas.' },
      { icono: 'Ticket', titulo: 'Tickets y Proyectos', texto: 'Los trabajos de nuestros clientes que buscan un talento como el tuyo, para ofrecer tu propuesta y hacerte cargo.' },
      { icono: 'ReceiptText', titulo: 'Facturas', texto: 'El registro de los trabajos que realizas y de lo que recibes por ellos.' },
      { icono: 'Store', titulo: 'Marketplace', texto: 'Las soluciones, productos y servicios publicados por los talentos del grupo.' },
      { icono: 'IdCard', titulo: 'Hoja de vida y portafolio', texto: 'Tu hoja de vida, tu portafolio y tu disponibilidad, con un enlace para compartirlos con quien quieras.' },
    ],
  },
  {
    id: 'videojuego',
    etiqueta: 'Videojuego',
    titulo: 'GCC World, el videojuego',
    texto: 'Un mundo en desarrollo donde el proyecto se vive jugando. Esto es lo que tenemos pensado ofrecer.',
    proximamente: true,
    beneficios: [
      { icono: 'Swords', titulo: 'Misiones cooperativas', texto: 'Cumple un rol en el progreso de las misiones junto a otros candidatos y miembros, con pruebas de estrategia, puzzles y decisiones difíciles.' },
      { icono: 'Coins', titulo: 'GCC Coins', texto: 'Participa para obtener GCC Coins y ganar acceso a servicios y productos gratuitos.' },
      { icono: 'Users', titulo: 'Eventos comunitarios', texto: 'Gana puntos, conoce perfiles y socializa con nuestros talentos en un lugar de reunión dentro del juego.' },
      { icono: 'Sparkles', titulo: 'Tu personaje', texto: 'Tu identidad en el juego es la misma de tu cuenta: lo que logras jugando acompaña tu progreso en el grupo.' },
    ],
  },
];
