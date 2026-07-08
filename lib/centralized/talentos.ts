/**
 * Lista canónica de TALENTOS (profesiones, oficios, habilidades y roles) de la
 * organización. Fuente única de verdad: cualquier lugar que ofrezca elegir talentos
 * (etiquetas de tareas, criterios de reclutamiento, etc.) DEBE importar desde aquí.
 *
 * A futuro esta lista será editable por el usuario; por ahora se estandariza. Está
 * agrupada por categoría para facilitar la búsqueda/agrupación en los selectores; la
 * lista plana `TALENTOS` es la que se usa para el multi-select con buscador.
 */

export interface TalentoGroup {
  category: string;
  items: string[];
}

export const TALENTOS_BY_CATEGORY: TalentoGroup[] = [
  {
    category: 'Deportes y actividad física',
    items: [
      'Jugar fútbol', 'Jugar baloncesto', 'Jugar voleibol', 'Jugar tenis', 'Jugar béisbol',
      'Jugar rugby', 'Jugar hockey', 'Jugar bádminton', 'Jugar ping-pong', 'Jugar pádel',
      'Natación', 'Atletismo', 'Ciclismo', 'Ciclismo de montaña', 'Running de fondo',
      'Boxeo', 'Artes marciales mixtas', 'Karate', 'Judo', 'Taekwondo',
      'Escalada deportiva', 'Montañismo', 'Senderismo', 'Surf', 'Skateboarding',
      'Patinaje sobre hielo', 'Patinaje artístico', 'Esquí', 'Snowboard', 'Buceo',
      'Gimnasia artística', 'Yoga', 'Pilates', 'CrossFit', 'Levantamiento de pesas',
      'Halterofilia', 'Golf', 'Equitación', 'Arquería', 'Esgrima',
      'Entrenamiento personal', 'Preparación física', 'Arbitraje deportivo', 'Remo', 'Kayak',
    ],
  },
  {
    category: 'Cocina y gastronomía',
    items: [
      'Cocinar', 'Cocina internacional', 'Cocina ecuatoriana', 'Cocina italiana', 'Cocina asiática',
      'Repostería', 'Panadería', 'Pastelería', 'Chocolatería', 'Heladería',
      'Barismo (café)', 'Coctelería', 'Enología (vinos)', 'Parrilla y asados', 'Cocina vegana',
      'Cocina saludable', 'Decoración de tortas', 'Sushi', 'Charcutería', 'Catering',
      'Gestión de restaurante', 'Cata de alimentos', 'Conservas y encurtidos', 'Cocina molecular', 'Comida callejera',
    ],
  },
  {
    category: 'Oficios y construcción',
    items: [
      'Carpintería', 'Ebanistería', 'Albañilería', 'Plomería', 'Electricidad residencial',
      'Soldadura', 'Herrería', 'Cerrajería', 'Pintura de casas', 'Enyesado y estucado',
      'Instalación de pisos', 'Instalación de cerámica', 'Techado', 'Vidriería', 'Tapicería',
      'Reparación de electrodomésticos', 'Aire acondicionado y refrigeración', 'Instalación eléctrica industrial', 'Montaje de muebles', 'Restauración de muebles',
      'Colocación de drywall', 'Impermeabilización', 'Mantenimiento de piscinas', 'Instalación de paneles solares', 'Fontanería industrial',
    ],
  },
  {
    category: 'Textil, moda y costura',
    items: [
      'Coser ropa', 'Costura a máquina', 'Confección de prendas', 'Diseño de modas', 'Patronaje',
      'Bordado', 'Bordado a mano', 'Tejido a crochet', 'Tejido a dos agujas', 'Sastrería',
      'Modistería', 'Diseño de calzado', 'Marroquinería (cuero)', 'Serigrafía textil', 'Estampado de telas',
      'Modelaje', 'Estilismo de moda', 'Diseño de accesorios', 'Reparación de ropa', 'Tejido en telar',
    ],
  },
  {
    category: 'Artes plásticas y manualidades',
    items: [
      'Dibujo', 'Pintura al óleo', 'Acuarela', 'Ilustración', 'Caricatura',
      'Escultura', 'Cerámica', 'Alfarería', 'Grabado', 'Muralismo',
      'Origami', 'Bisutería', 'Joyería artesanal', 'Orfebrería', 'Tallado en madera',
      'Tallado en piedra', 'Vitrales', 'Mosaico', 'Encuadernación', 'Caligrafía',
      'Lettering', 'Manualidades con reciclaje', 'Velas artesanales', 'Jabones artesanales', 'Decoración de interiores',
    ],
  },
  {
    category: 'Música y sonido',
    items: [
      'Tocar guitarra', 'Tocar piano', 'Tocar batería', 'Tocar bajo', 'Tocar violín',
      'Tocar saxofón', 'Tocar trompeta', 'Tocar flauta', 'Tocar acordeón', 'Tocar charango',
      'Canto', 'Dirección de coro', 'Composición musical', 'Producción musical', 'DJ',
      'Ingeniería de sonido', 'Mezcla y masterización', 'Lectura de partituras', 'Arreglos musicales', 'Locución',
    ],
  },
  {
    category: 'Artes escénicas y espectáculo',
    items: [
      'Actuación', 'Teatro', 'Danza contemporánea', 'Ballet', 'Danza folclórica',
      'Baile salsa', 'Baile urbano', 'Coreografía', 'Malabarismo', 'Magia e ilusionismo',
      'Circo', 'Acrobacia', 'Presentación de eventos', 'Comedia y stand-up', 'Mimo',
      'Doblaje de voz', 'Animación de fiestas', 'Improvisación teatral', 'Titiritería', 'Performance',
    ],
  },
  {
    category: 'Tecnología y desarrollo',
    items: [
      'Programación web', 'Desarrollo frontend', 'Desarrollo backend', 'Desarrollo móvil', 'Programación en Python',
      'Programación en JavaScript', 'Programación en Java', 'Bases de datos SQL', 'Administración de servidores', 'DevOps',
      'Ciberseguridad', 'Ethical hacking', 'Inteligencia artificial', 'Machine learning', 'Ciencia de datos',
      'Análisis de datos', 'Automatización de procesos', 'Desarrollo de videojuegos', 'Diseño UX/UI', 'Cloud computing',
      'Soporte técnico', 'Redes y telecomunicaciones', 'Reparación de computadoras', 'Reparación de celulares', 'Blockchain',
      'Robótica', 'Impresión 3D', 'Domótica', 'Testing de software', 'Administración de bases de datos',
    ],
  },
  {
    category: 'Diseño y multimedia',
    items: [
      'Diseño gráfico', 'Diseño de logotipos', 'Diseño editorial', 'Animación 2D', 'Animación 3D',
      'Modelado 3D', 'Edición de video', 'Motion graphics', 'Fotografía', 'Fotografía de retrato',
      'Fotografía de producto', 'Fotografía de eventos', 'Fotografía de naturaleza', 'Retoque fotográfico', 'Cinematografía',
      'Dirección de arte', 'Diseño de packaging', 'Diseño web', 'Diseño de personajes', 'Storyboard',
    ],
  },
  {
    category: 'Comunicación, marketing y ventas',
    items: [
      'Ventas', 'Ventas B2B', 'Telemarketing', 'Atención al cliente', 'Negociación comercial',
      'Marketing digital', 'Gestión de redes sociales', 'Community management', 'Publicidad', 'Copywriting',
      'Redacción de contenidos', 'SEO', 'Email marketing', 'Marketing de influencia', 'Relaciones públicas',
      'Branding', 'Investigación de mercado', 'Comercio electrónico', 'Gestión de marca', 'Estrategia de contenidos',
      'Oratoria', 'Presentaciones efectivas', 'Storytelling', 'Prospección de clientes', 'Cierre de ventas',
    ],
  },
  {
    category: 'Negocios, administración y finanzas',
    items: [
      'Contabilidad', 'Auditoría', 'Análisis financiero', 'Gestión de presupuestos', 'Tesorería',
      'Facturación', 'Nómina', 'Emprendimiento', 'Planificación estratégica', 'Gestión de proyectos',
      'Administración de empresas', 'Gestión de recursos humanos', 'Reclutamiento y selección', 'Logística', 'Gestión de inventarios',
      'Compras y abastecimiento', 'Control de calidad', 'Consultoría de negocios', 'Análisis de riesgos', 'Inversiones y bolsa',
      'Gestión bancaria', 'Comercio exterior', 'Gestión de la cadena de suministro', 'Modelado de negocios', 'Gestión de operaciones',
    ],
  },
  {
    category: 'Legal y administración pública',
    items: [
      'Asesoría legal', 'Derecho civil', 'Derecho penal', 'Derecho laboral', 'Derecho mercantil',
      'Mediación y conciliación', 'Redacción de contratos', 'Trámites notariales', 'Propiedad intelectual', 'Cumplimiento normativo',
      'Gestión documental', 'Archivo y digitalización', 'Asistencia administrativa', 'Secretariado', 'Gestión pública',
    ],
  },
  {
    category: 'Salud y bienestar',
    items: [
      'Primeros auxilios', 'Enfermería', 'Cuidado de adultos mayores', 'Cuidado de personas con discapacidad', 'Fisioterapia',
      'Masaje terapéutico', 'Nutrición', 'Psicología', 'Consejería', 'Odontología',
      'Optometría', 'Farmacia', 'Laboratorio clínico', 'Terapia ocupacional', 'Fonoaudiología',
      'Podología', 'Quiropráctica', 'Acupuntura', 'Medicina general', 'Paramédico',
      'Salud mental', 'Meditación y mindfulness', 'Instrucción de yoga terapéutico', 'Rehabilitación física', 'Cuidado infantil',
    ],
  },
  {
    category: 'Belleza y estética',
    items: [
      'Peluquería', 'Barbería', 'Colorimetría capilar', 'Manicura y pedicura', 'Uñas acrílicas',
      'Maquillaje', 'Maquillaje artístico', 'Maquillaje de novias', 'Cosmetología', 'Depilación',
      'Cuidado de la piel', 'Diseño de cejas', 'Extensiones de pestañas', 'Peinados', 'Spa y tratamientos',
    ],
  },
  {
    category: 'Educación y formación',
    items: [
      'Enseñanza', 'Tutoría académica', 'Enseñanza de matemáticas', 'Enseñanza de ciencias', 'Enseñanza de historia',
      'Educación infantil', 'Educación especial', 'Coaching educativo', 'Diseño instruccional', 'Formación corporativa',
      'Enseñanza de música', 'Enseñanza de arte', 'Enseñanza deportiva', 'Alfabetización', 'Orientación vocacional',
    ],
  },
  {
    category: 'Idiomas y traducción',
    items: [
      'Inglés', 'Español', 'Francés', 'Alemán', 'Italiano',
      'Portugués', 'Mandarín', 'Japonés', 'Quechua', 'Lengua de señas',
      'Traducción', 'Interpretación simultánea', 'Corrección de estilo', 'Enseñanza de idiomas', 'Subtitulado',
    ],
  },
  {
    category: 'Ciencia e investigación',
    items: [
      'Investigación científica', 'Física', 'Química', 'Biología', 'Matemáticas aplicadas',
      'Estadística', 'Astronomía', 'Geología', 'Ecología', 'Microbiología',
      'Análisis de laboratorio', 'Redacción científica', 'Experimentación', 'Modelado matemático', 'Bioquímica',
    ],
  },
  {
    category: 'Ingeniería y técnica',
    items: [
      'Ingeniería civil', 'Ingeniería mecánica', 'Ingeniería eléctrica', 'Ingeniería industrial', 'Ingeniería electrónica',
      'Dibujo técnico', 'Diseño CAD', 'Topografía', 'Mantenimiento industrial', 'Mecatrónica',
      'Automatización industrial', 'Control de procesos', 'Diseño de maquinaria', 'Instrumentación', 'Metalurgia',
    ],
  },
  {
    category: 'Automotriz y mecánica',
    items: [
      'Mecánica automotriz', 'Mecánica de motos', 'Electricidad automotriz', 'Enderezado y pintura', 'Diagnóstico automotriz',
      'Mecánica diésel', 'Reparación de llantas', 'Lubricación y mantenimiento', 'Tuning de vehículos', 'Mecánica de maquinaria pesada',
    ],
  },
  {
    category: 'Transporte y logística',
    items: [
      'Conducción de auto', 'Conducción de camión', 'Conducción de bus', 'Conducción de motocicleta', 'Manejo de montacargas',
      'Reparto y mensajería', 'Gestión de flotas', 'Planificación de rutas', 'Operación de grúa', 'Navegación marítima',
    ],
  },
  {
    category: 'Agricultura, ganadería y naturaleza',
    items: [
      'Agricultura', 'Horticultura', 'Jardinería', 'Paisajismo', 'Cultivo de hortalizas',
      'Fruticultura', 'Cafeticultura', 'Cacao y poscosecha', 'Ganadería', 'Ordeño y lechería',
      'Avicultura', 'Apicultura', 'Piscicultura', 'Cuidado de caballos', 'Veterinaria',
      'Adiestramiento canino', 'Riego y sistemas hídricos', 'Compostaje', 'Cultivo hidropónico', 'Manejo forestal',
    ],
  },
  {
    category: 'Turismo, hospitalidad y servicio',
    items: [
      'Guía turística', 'Recepción de hotel', 'Gestión hotelera', 'Servicio de meseros', 'Bartender',
      'Organización de eventos', 'Planificación de bodas', 'Animación turística', 'Ecoturismo', 'Gestión de reservas',
      'Atención en aerolíneas', 'Cruceros y hospitalidad', 'Camarería (housekeeping)', 'Conserjería', 'Turismo de aventura',
    ],
  },
  {
    category: 'Seguridad y emergencias',
    items: [
      'Seguridad física', 'Vigilancia', 'Rescate y salvamento', 'Combate de incendios', 'Manejo de emergencias',
      'Socorrismo acuático', 'Defensa personal', 'Investigación privada', 'Control de multitudes', 'Protección ejecutiva',
    ],
  },
  {
    category: 'Hogar y cuidado personal',
    items: [
      'Limpieza del hogar', 'Organización de espacios', 'Planchado', 'Lavandería', 'Cuidado de niños',
      'Cuidado de mascotas', 'Peluquería canina', 'Cocina doméstica', 'Administración del hogar', 'Compras y provisiones',
    ],
  },
  {
    category: 'Escritura y contenidos',
    items: [
      'Escritura creativa', 'Redacción periodística', 'Guionismo', 'Poesía', 'Blogging',
      'Edición de textos', 'Reportería', 'Investigación documental', 'Escritura técnica', 'Podcasting',
    ],
  },
  {
    category: 'Habilidades personales y liderazgo',
    items: [
      'Liderazgo de equipos', 'Trabajo en equipo', 'Resolución de conflictos', 'Toma de decisiones', 'Pensamiento crítico',
      'Creatividad e innovación', 'Gestión del tiempo', 'Empatía y escucha activa', 'Mentoría', 'Facilitación de grupos',
      'Adaptabilidad', 'Inteligencia emocional', 'Planificación', 'Análisis de problemas', 'Motivación de personas',
    ],
  },
  {
    category: 'Medios, prensa y entretenimiento',
    items: [
      'Presentación de televisión', 'Radiodifusión', 'Camarógrafo', 'Guion de cine', 'Dirección de cine',
      'Producción audiovisual', 'Reportería gráfica', 'Streaming y creación de contenido', 'Edición de podcast', 'Gestión de canal de YouTube',
      'Locución comercial', 'Narración de audiolibros', 'Crítica cultural', 'Curaduría de arte', 'Gestión de eventos culturales',
    ],
  },
  {
    category: 'Comercio, oficios de servicio y otros',
    items: [
      'Atención en tienda', 'Cajero', 'Reposición de mercadería', 'Escaparatismo (vitrinas)', 'Gestión de bodega',
      'Cobranzas', 'Digitación de datos', 'Traducción de documentos', 'Encuestador', 'Promotor de ventas',
      'Reparación de calzado', 'Relojería', 'Afilado de herramientas', 'Fumigación y control de plagas', 'Recolección y reciclaje',
    ],
  },
];

/** Lista plana de talentos (fuente para el selector con buscador). */
export const TALENTOS: string[] = TALENTOS_BY_CATEGORY.flatMap((g) => g.items);

/** Conjunto para validación/lookup rápido. */
export const TALENTOS_SET = new Set(TALENTOS);
