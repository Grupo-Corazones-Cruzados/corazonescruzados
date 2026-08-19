/**
 * EL CONTENIDO DEL SITIO PÚBLICO — fuente única.
 *
 * Las páginas de `/clientes`, `/desarrollo-humano` y `/contacto` **no llevan texto escrito dentro**:
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
   * `/clientes` (antes `/negocio`, que es la URL declarada a Meta en las verificaciones y que sigue redirigiendo aquí).
   */
  url: 'https://www.grupocc.org',
  ciudad: 'Guayaquil',
  pais: 'Ecuador',
} as const;

/**
 * LA IMAGEN QUE SALE AL COMPARTIR — hay que nombrarla en cada página, y no es obvio.
 *
 * `app/opengraph-image.tsx` se aplica sola a la portada y a cualquier ruta que **no**
 * declare su propio `openGraph`. Pero `/clientes`, `/desarrollo-humano` y `/contacto` sí lo declaran
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
  /**
   * «Inicio» → «Violeta» → «Historia» (Fernando, 2026-08-17; el segundo cambio, el mismo día).
   *
   * ⚠️ **Solo cambia la ETIQUETA. La ruta sigue siendo `/`**, decidido por él después de
   * plantearle que mover la portada dejaría el dominio sin página en la raíz y obligaría a
   * tocar el logo, el panel, `/auth`, el marketplace y el mapa del sitio. Aquí no hay
   * ninguna redirección que añadir: no se ha movido nada, ni con «Violeta» ni ahora.
   */
  { href: '/', label: 'Historia' },
  /**
   * ⚠️ ESTAS DOS PESTAÑAS **INTERCAMBIARON SUS NOMBRES** EL 2026-08-18. Que conste el
   * orden, porque leer el historial sin esto despista:
   *
   *   | Página                          | 08-17        | 08-18 (hoy)  |
   *   |---------------------------------|--------------|--------------|
   *   | soluciones + trabajo terminado     | `/soluciones`   | `/soluciones`|
   *   | las cinco puertas               | `/soluciones`| `/clientes`  |
   *
   * Fernando: *«esta página en la que hemos estado trabajando realmente tiene el contenido
   * pensado para lo que sería de soluciones»*. El concepto interno de la primera sigue
   * llamándose **solución** —tabla `soluciones`, Admin → Soluciones—: lo que cambió es su nombre de
   * cara al público, no el modelo.
   */
  { href: '/soluciones', label: 'Soluciones' },
  /**
   * Las cinco puertas: «Negocios» (`/negocio`) → «Soluciones» (`/soluciones`) → **«Clientes»**
   * (`/clientes`). Las dos rutas viejas redirigen aquí desde `next.config.ts`.
   */
  { href: '/clientes', label: 'Clientes' },
  // La etiqueta ya decía «Desarrollo Humano» mientras la ruta seguía siendo `/recursos`, que
  // era el nombre viejo. El 2026-08-17 se igualaron: titular, pestaña, menú y URL dicen lo
  // mismo. La ruta vieja redirige (308) desde `next.config.ts`.
  { href: '/desarrollo-humano', label: 'Desarrollo Humano' },
  { href: '/contacto', label: 'Contacto' },
] as const;

/* ══════════════════════ ACCESOS — las cinco puertas de /clientes ══════════════════════ */

/**
 * LAS CINCO PUERTAS DE `/clientes` — dictadas por Fernando (2026-08-04).
 *
 * Sustituyeron al bloque que había («Primero las personas. Lo demás sale de ahí.») porque
 * no decía **qué puede hacer aquí** quien llega. Y desde el mismo día son además **cinco
 * páginas**: `/clientes/<id>` (colgaban de `/negocio/<id>` hasta el 2026-08-17).
 *
 * ── ⚠️ EL `id` ES LA URL. NO SE CAMBIA A LA LIGERA ─────────────────────────────
 * De aquí salen a la vez la tarjeta, la ruta, el mapa del sitio y el `canonical`. Cambiar
 * un `id` **rompe cualquier enlace ya publicado y tira el posicionamiento** que esa URL
 * hubiera ganado. Si algún día hay que renombrar uno, se hace con una **redirección
 * permanente** del viejo al nuevo, nunca a secas — que es exactamente lo que se hizo al
 * renombrar la sección entera el 2026-08-17.
 *
 * Fernando eligió nombres y no números (`/clientes/requerimientos` en vez de
 * `/clientes/necesidad1`): la URL dice de qué va, y eso cuenta tanto para el buscador
 * como para quien recibe el enlace por WhatsApp.
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
  /** El último tramo de la URL: `/clientes/<id>`. Ver el aviso de arriba. */
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
  /**
   * La frase CORTA. Se usa en tres sitios donde el espacio manda y donde un párrafo largo
   * hace daño: la tarjeta del panel izquierdo, la `description` de la pestaña —que Google
   * corta a ~160 caracteres— y los datos estructurados.
   */
  texto: string;
  /**
   * El párrafo LARGO, el que se lee bajo el título de la página. Opcional: sin él se pinta
   * `texto`, que es lo que hacían las cuatro secciones hasta el 2026-08-19.
   *
   * ⚠️ Nació porque Fernando dictó para Videojuego una descripción de cinco frases contando
   * la historia del juego. Puesta en `texto` habría reventado las tres cosas de arriba: una
   * tarjeta de navegación cuatro veces más alta que sus hermanas y una descripción de
   * buscador cortada a la mitad de una frase. Son dos textos porque son dos trabajos.
   */
  descripcion?: string;
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
  /** Galería de tarjetas pequeñas. Ver `Galeria`. */
  galeria?: Galeria;
  /**
   * `true` = su página NO repite el nombre de la puerta ni su frase en un bloque propio.
   *
   * Los decía ya la tarjeta abierta de la cabecera —que es la que lleva el `<h1>`— y
   * volvían a aparecer justo debajo. Fernando lo quitó de Automatización el 2026-08-06.
   */
  sinTitular?: boolean;
}

/**
 * UNA GALERÍA DE TARJETAS PEQUEÑAS — icono, título y una línea.
 *
 * Distinta de los `temas`: un tema **explica un flujo** con sus pasos; una galería
 * **enumera** lo que se ofrece. Cuando la lista es larga —once cosas en Automatización— un
 * bloque grande por cada una sería una página infinita, y una lista con viñetas no se lee.
 *
 * ⚠️ Los títulos los dictó Fernando (2026-08-04); **los textos los escribí yo** y están para
 * que los corrija. Cada uno dice qué es la cosa y para qué sirve, sin prometer resultados ni
 * dar cifras: la regla de la página sigue siendo que nada sea incomprobable.
 */
export interface Galeria {
  /**
   * Encabezado, **opcional**. Fernando lo quitó de Automatización el 2026-08-05: las once
   * tarjetas se explican solas y el titular solo repetía con más palabras lo que ya dice el
   * nombre de la puerta. Sin `titulo`, la galería se pinta a secas.
   */
  etiqueta?: string;
  titulo?: string;
  entradilla?: string;
  /**
   * `true` = las tarjetas cruzan la pantalla solas, de derecha a izquierda y en bucle
   * (Fernando, 2026-08-06). Se sale del ancho de lectura y ocupa el ancho completo.
   * Sin esto, se pintan quietas y envueltas en filas.
   */
  desliza?: boolean;
  items: ItemGaleria[];
}

/**
 * UNA TARJETA DE LA GALERÍA.
 *
 * `titulo` y `texto` son lo que se ve en la tarjeta; lo demás solo aparece al pulsarla.
 *
 * ⚠️ **El texto largo lo escribí yo** (2026-08-06) a partir de los once títulos que dictó
 * Fernando, y está para que lo corrija. Cada descripción dice **de qué se trata y para qué
 * le sirve a una empresa**, sin cifras ni promesas de resultado: la regla de la página sigue
 * siendo que nada sea incomprobable.
 */
export interface ItemGaleria {
  icono: string;
  titulo: string;
  /** La línea de la tarjeta. */
  texto: string;
  /** El párrafo de la ventana: qué es y para qué sirve. */
  descripcion?: string;
  /** Lo que gana la empresa. Tres, para que se lean de un vistazo. */
  beneficios?: string[];
  /** ⏳ Pendiente: la ilustración de la ventana, a la derecha del texto. */
  imagen?: { src: string; ancho: number; alto: number };
}

/**
 * UN TEMA — con su propio enlace.
 *
 * ── POR QUÉ ANCLA Y NO PÁGINA PROPIA (decisión de Fernando, 2026-08-04) ────────
 * Se enlazan como `/clientes/<puerta>#<id>`, no como `/clientes/<puerta>/<id>`. Los temas son
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
  /** El ancla: `/clientes/<puerta>#<id>`. No se cambia a la ligera. */
  id: string;
  /** Rótulo pequeño en versalitas, sobre la pregunta. */
  etiqueta: string;
  /** La pregunta grande. Es el gancho: tiene que sonar al problema de quien lee. */
  pregunta: string;
  /**
   * La respuesta, en una o dos frases. **Opcional desde el 2026-08-19.**
   *
   * Fernando dictó la pregunta de Videojuego y sus tres pasos, y dejó la respuesta como
   * «descripción pendiente». Se podía hacer dos cosas: inventar un párrafo de relleno o no
   * pintar ninguno. Se hace lo segundo, que es la regla del sitio —lo que no hay no deja
   * hueco— y además evita publicar texto que nadie ha escrito.
   *
   * ⚠️ Un tema sin `texto` **no entra en el `FAQPage`**: una pregunta declarada sin respuesta
   * es un dato falso.
   */
  texto?: string;
  /**
   * Los pasos, para que la promesa se vea concreta. Opcional.
   * `icono` es una clave de `ICONOS` (`components/sitio/piezas.tsx`) y se pinta **debajo**
   * del paso: da un ancla visual al final de cada columna y evita que las tres se lean como
   * tres párrafos sueltos.
   */
  pasos?: {
    titulo: string;
    texto: string;
    /** Clave de `ICONOS`. Solo se usa si el paso no trae `imagen`. */
    icono?: string;
    /**
     * Ilustración del paso, bajo `public/`. Manda sobre `icono`.
     * Son escenas, no pictogramas, así que ocupan el ancho de su columna.
     */
    imagen?: { src: string; ancho: number; alto: number };
  }[];
}

export const ACCESOS: Acceso[] = [
  /**
   * ⚠️ EL TRAMO SE LLAMA COMO LA SECCIÓN, Y ESO ES UNA REGLA (Fernando, 2026-08-19).
   *
   * Era `requerimientos` y la sección se llama **Progreso**; era `votacion` y la sección se
   * llama **Democracia**. Dos nombres para lo mismo obligan a traducir mentalmente cada vez
   * que se mira una URL, y una dirección que no se parece a lo que enseña no se recuerda ni
   * se teclea. Ahora `id` = el título en minúsculas y sin tildes, siempre.
   *
   * ⚠️ **Este `id` es TRES cosas a la vez**: el tramo de la URL (`/clientes/<id>`), la clave
   * con la que se guardan las preguntas frecuentes (`gcc_world.faqs.acceso_id`) y el valor de
   * `generateStaticParams`. Cambiarlo exige las tres: la redirección de la dirección vieja en
   * `next.config.ts`, y la migración 046 que renombra las filas de `faqs`.
   */
  {
    id: 'progreso', icono: 'ticket',
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
      etiqueta: 'Tickets',
      pregunta: '¿Necesitas ayuda para completar una tarea difícil?',
      texto:
        'Publícalo como ticket, y descubre nuevos talentos capaces de resolver tus problemas, y de sorprenderte con el aporte que pueden ofrecer a tu organización.',
      pasos: [
        {
          titulo: 'Lo publicas',
          texto: 'Un ticket con lo que necesitas desde tu perspectiva como cliente, tu presupuesto, la fecha límite de entrega, y configuras el talento que necesitas.',
          imagen: { src: '/clientes/paso-1-publicas.webp', ancho: 760, alto: 677 },
        },
        {
          titulo: 'Lo toma quien sabe hacerlo',
          texto: 'Un perfil con el talento requerido revisa el ticket abierto, analiza su disponibilidad según la fecha límite de entrega, y define el costo final en base a tu presupuesto.',
          imagen: { src: '/clientes/paso-2-lo-toma.webp', ancho: 760, alto: 753 },
        },
        {
          titulo: 'Lo sigues sin arrear',
          texto: 'El talento se hace responsable de establecer los días y horas de trabajo previo a la fecha límite de entrega, coordina reuniones, y tomará contacto hasta completar la tarea.',
          imagen: { src: '/clientes/paso-3-seguimiento.webp', ancho: 760, alto: 182 },
        },
      ],
    },
    /**
     * Segundo tema de Progreso, dictado por Fernando el 2026-08-04. Su texto va **tal
     * cual**; los pasos los propuse yo a partir de él, con su permiso: «los pasos agrégalos
     * tú, luego yo los arreglo según se requiera».
     *
     * Cómo salieron los tres: su párrafo describe cuatro momentos —hablar, cotizar,
     * negociar, ejecutar—, pero cotizar y hablar son el mismo gesto para quien lo vive
     * (escribes y te contestan con un precio), así que van juntos. Tres pasos, además,
     * es lo que cabe en la fila sin dejar una columna coja.
     */
    {
      id: 'de-idea-a-proyecto',
      etiqueta: 'Proyectos',
      pregunta: '¿Buscas hacer realidad tus ideas de proyectos?',
      texto:
        'Comunícate con cualquiera de nuestros talentos, recibe una cotización de tu proyecto, y negocia el presupuesto. En caso de aceptar, el miembro responsable tomará el control del proyecto para gestionar el presupuesto, los participantes, y completar todos sus requerimientos.',
      pasos: [
        {
          titulo: 'Hablas con un talento',
          texto: 'Eliges con quién y le cuentas la idea. Te devuelve una cotización con su alcance y su precio, para que sepas qué entra y qué no.',
          imagen: { src: '/clientes/proyecto-1-hablas.webp', ancho: 760, alto: 525 },
        },
        {
          titulo: 'Negocias el presupuesto',
          texto: 'Se ajusta hasta que cuadre para los dos. Nada se pone en marcha sin que tú lo aceptes.',
          imagen: { src: '/clientes/proyecto-2-negocias.webp', ancho: 760, alto: 601 },
        },
        {
          titulo: 'El responsable toma el control',
          texto: 'Gestiona el presupuesto y suma a los participantes que hagan falta hasta cubrir todos los requerimientos del proyecto.',
          imagen: { src: '/clientes/proyecto-3-responsable.webp', ancho: 760, alto: 763 },
        },
      ],
    }],
  },
  /* ── «AUTOMATIZACIÓN» SE RETIRÓ DE AQUÍ EL 2026-08-18 ──────────────────────────
     Fernando: *«la sección de automatización ya la estamos manejando desde la página de
     soluciones, así que quitemos esa tarjeta»*. Quedan cuatro puertas: Progreso,
     Videojuego, Marketplace y Democracia.

     ⚠️ **Su texto NO se ha perdido**: eran 132 líneas —los temas y la galería de once
     servicios, escritos por él— y siguen en el historial. Para recuperarlas:

         git show 61a7037:lib/sitio/contenido.ts

     Se retiran de aquí en vez de dejarlas sin usar porque un bloque de datos que no se
     pinta confunde a quien lo lea después: parece que sale en algún sitio y no sale.

     ⚠️ La URL `/clientes/automatizacion` llevaba publicada desde el 2026-08-04 (como
     `/negocio/automatizacion`). **No se deja en 404**: redirige a `/soluciones`, que es
     donde vive ahora ese contenido. Ver `next.config.ts`. */
  /**
   * ⭐ CONTENIDO DE FERNANDO, PALABRA POR PALABRA (2026-08-19).
   *
   * Sustituye entero a lo que yo había escrito el día anterior —dos preguntas sobre cómo se
   * entra y para qué sirve un juego—. Aquello está en el historial:
   *
   *     git show 6c99478:lib/sitio/contenido.ts
   *
   * La `descripcion` cuenta la historia del juego y NO se toca ni se acorta. Va en
   * `descripcion` y no en `texto` porque `texto` se usa además en la tarjeta del panel
   * izquierdo y en la descripción de la pestaña: cinco frases ahí dejarían una tarjeta cuatro
   * veces más alta que sus hermanas y un resultado de Google cortado a la mitad.
   *
   * ⚠️ **LA RESPUESTA LA ESCRIBÍ YO** (2026-08-19), a petición suya —*«puedes generar tú la
   * descripción según la intención que tenemos con esta función del videojuego, que realmente
   * se llama RETOS CC»*—, y está para que la corrija.
   *
   * De dónde sale, porque no es una frase de folleto: la intención del juego está en
   * `MEMORIA.md` —«enseñanza + retos + economía de fichas», con etapas que **solo se
   * desbloquean con resultados REALES registrados en la app»**— y el fundamento del proyecto
   * dice lo mismo aplicado a las personas: *«las elecciones no deberían basarse en votaciones
   * sino en acciones naturales»*, y los nueve valores del candidato se evalúan por resultados,
   * no por declaraciones. Retos CC es eso puesto al servicio de una empresa: en vez de
   * preguntar cómo reaccionaría alguien, se le pone en la situación. La frase dice justo eso y
   * no promete ningún resultado, que es la regla de la página.
   *
   * **La etiqueta pasó de «Pruebas» a «Retos CC»**: la primera era mía a falta de nombre; la
   * función tiene el suyo, y un rótulo inventado compitiendo con el nombre real solo confunde.
   *
   * ⚠️ **AVISO, dado y asumido.** Los pasos 2 y 3 describen cosas que HOY NO EXISTEN: el
   * juego está en el prólogo (`godot/Videojuego.md`), no hay creación de personaje con
   * tutorial de eventos ni informes por colaborador. Se le señaló antes de publicarlo y
   * decidió publicarlo así. Queda escrito porque esta página tiene la regla de que nada sea
   * incomprobable, y porque una verificación de Meta ya se rechazó una vez por anunciar lo
   * que no se podía comprobar.
   *
   * ⚠️ El 2026-08-19 **Fernando reescribió el paso 3 él mismo**: pasó de «podrá generar» a
   * «va a generar … según tus criterios de evaluación». Es decir, lo afirmó más, no menos.
   * Su decisión y su texto; se deja tal cual.
   *
   */
  {
    id: 'videojuego', icono: 'juego',
    titulo: 'Videojuego',
    texto: 'Adéntrate en una aventura a través del videojuego GCC World.',
    descripcion:
      'GCC World es un videojuego que cuenta la historia de un mundo que sufrió las peores consecuencias después de olvidar sus raíces. Tres niños que perdieron a sus padres durante una persecución en este mundo perdido, se lanzaron hacia un hoyo ancestral, el cual sin saberlo, fue el lugar de unión y prosperidad de sus antepasados. ¿Qué existirá en el fondo del hoyo?',
    temas: [
      {
        id: 'poner-a-prueba',
        etiqueta: 'Retos CC',
        pregunta: '¿Buscas poner a prueba a tus colaboradores?',
        texto:
          'En vez de preguntarle a tu equipo cómo reaccionaría ante una situación, puedes mediante este videojuego, desarrollar los retos que quieres para evaluar a tus colaboradores frente a una situación y así puedes generar espacios de reflexión, aprendizaje, analizar sus deciciones y entender cómo ellos resuelven un problema que les planteas.',
        pasos: [
          {
            titulo: 'Entras con tu cuenta',
            texto: 'La misma con la que se entra en la plataforma. Es la única puerta para los clientes.',
            icono: 'candado',
          },
          {
            titulo: 'Comparte fácil',
            texto: 'Inicias el prólogo, y creas tu personaje. Luego durante el tutorial vas a aprender a crear eventos y compartirlos por enlace a tus colaboradores.',
            icono: 'premio',
          },
          {
            titulo: 'Obtén los resultados',
            texto: 'Cada prueba va a generar un reporte según las decisiones y logros alcanzados según tus criterios de evaluación para cada colaborador que realizó la prueba.',
            icono: 'grafico',
          },
        ],
      },
      /**
       * ⭐ SEGUNDA FUNCIÓN DE VIDEOJUEGO: **Talentos** — dictada por Fernando (2026-08-19),
       * pregunta, respuesta y pasos.
       *
       * Su texto va **palabra por palabra**, con dos correcciones que no cambian nada de lo
       * que dice:
       *  · «gcc coins» → «GCC Coins». El acrónimo va en mayúsculas en todo el proyecto —GCC
       *    World, GCC Coins—, y en minúscula parecía una errata en una página pública.
       *  · «eventos comunitarios del videojuegos» → «del videojuego».
       *
       * ⚠️ **«GCC Coins» y «fichas» son la MISMA moneda con dos nombres.** `MEMORIA.md` la
       * llama «fichas» en todas partes —«se ganan SOLO jugando», «se gastarán en el
       * dashboard/marketplace por productos y servicios reales gratuitos»—, que es
       * exactamente lo que dice el paso 02. Aquí se respeta el nombre que Fernando usa de cara
       * al público, pero **hay que elegir uno solo antes de que el juego lo escriba en su
       * interfaz**: es el mismo problema que ya costó dos renombrados este mes (ámbito →
       * solución, requerimientos → progreso), y sale mucho más barato ahora.
       *
       * ⚠️ Los eventos comunitarios y el canje de monedas **no existen todavía** —el juego
       * está en el prólogo—. Mismo aviso que con Retos CC, y misma decisión suya. La
       * diferencia a su favor: aquí lo que se anuncia **ya estaba escrito como intención en
       * `MEMORIA.md`**, no es nuevo.
       *
       * Las 4 dimensiones que cita son las del proyecto (`MEMORIA.md`): laboral, corporal,
       * social y mental. Él las enumeró en otro orden y se respeta el suyo.
       *
       * El paso 01 es **el mismo que el de Retos CC**, a propósito y por petición suya: la
       * puerta de entrada no cambia según lo que vengas a hacer, y contarla distinto en cada
       * función haría dudar de si son dos accesos.
       */
      {
        id: 'talentos',
        etiqueta: 'Talentos',
        pregunta: '¿Necesitas conocer nuestro talento o buscas personal con alto valor humano y profesional?',
        texto:
          'Puedes jugar en los retos junto a nuestros jugadores, enfrentar retos del videojuego a nivel estratégico, puzzles, decisiones difíciles, desarrollo de valores, y participar junto a la plataforma que es donde trabajamos en progresar las 4 dimensiones del desarrollo humano (laboral, social, mental, corporal).',
        pasos: [
          {
            titulo: 'Entras con tu cuenta',
            texto: 'La misma con la que se entra en la plataforma. Es la única puerta para los clientes.',
            icono: 'candado',
          },
          {
            titulo: 'Juega y gana',
            texto: 'Participa para obtener GCC Coins, y así poder adquirir servicios y productos gratuitos o de pruebas.',
            icono: 'billetera',
          },
          {
            titulo: 'Conoce nuestro talento',
            texto: 'Participa en eventos comunitarios del videojuego para ganar puntos, conocer perfiles, y socializar con nuestros talentos.',
            icono: 'personas',
          },
        ],
      },
    ],
  },
  /**
   * ⚠️ **LOS DOS TEMAS DE MARKETPLACE LOS ESCRIBÍ YO** (2026-08-18), igual que los de
   * Videojuego y con el mismo permiso. De dónde sale cada afirmación:
   *  · «El catálogo se ve sin cuenta» y «para comprar hace falta una de cliente» → es
   *    literalmente lo que hace `app/marketplace-publico/page.tsx`: con sesión lleva al
   *    marketplace del panel; sin ella abre el aviso «Acceso solo para clientes».
   *  · «Si es un proyecto, se ven sus requerimientos» → el panel de detalle los pide a
   *    `GET /api/marketplace/projects/[id]/requirements`.
   */
  {
    id: 'marketplace', icono: 'tienda',
    titulo: 'Marketplace',
    texto: 'Accede al marketplace y compra productos, automatizaciones y proyectos de los miembros y candidatos de la organización.',
    enlaceExterno: { href: '/marketplace-publico', etiqueta: 'Ver el marketplace' },
    temas: [
      {
        id: 'que-hay-dentro',
        etiqueta: 'Catálogo',
        pregunta: '¿Qué se puede comprar aquí?',
        texto:
          'Productos, automatizaciones y proyectos hechos por los miembros y candidatos de la organización. No es un escaparate de terceros: cada cosa tiene detrás a quien la construyó.',
        pasos: [
          {
            titulo: 'Miras el catálogo',
            texto: 'Está abierto: se recorre entero sin cuenta y sin registrarse para ver precios.',
            icono: 'buscar',
          },
          {
            titulo: 'Abres la ficha',
            texto: 'Cada registro tiene su panel con las imágenes y el detalle. Si es un proyecto, además la lista de sus requerimientos.',
            icono: 'lista',
          },
          {
            titulo: 'Pides lo que te interesa',
            texto: 'La solicitud se hace desde la ficha, y a partir de ahí el seguimiento vive en tu panel.',
            icono: 'carrito',
          },
        ],
      },
      {
        id: 'hace-falta-cuenta',
        etiqueta: 'Acceso',
        pregunta: '¿Hace falta una cuenta para comprar?',
        texto:
          'Para mirar, no. Para comprar o solicitar, sí: hace falta una cuenta de cliente. Con ella el marketplace se abre completo dentro de tu panel, junto a tus tickets y tus proyectos.',
        pasos: [
          {
            titulo: 'Sin cuenta',
            texto: 'Ves el catálogo público y lo que ofrece cada registro. Nada te obliga a registrarte para mirar.',
            icono: 'web',
          },
          {
            titulo: 'Con cuenta de cliente',
            texto: 'La acción de comprar o solicitar se activa, y el marketplace pasa a estar dentro de tu panel.',
            icono: 'tarjeta',
          },
          {
            titulo: 'Todo en el mismo sitio',
            texto: 'Lo que pidas aquí se sigue desde donde ya sigues tus tickets y tus proyectos. No hay una segunda cuenta que recordar.',
            icono: 'maletin',
          },
        ],
      },
    ],
  },
  /**
   * ⏳ **DEMOCRACIA SE QUEDA SIN TEMAS A PROPÓSITO** (2026-08-18), y no por falta de tiempo.
   *
   * Fernando pidió que redactara dos preguntas para cada sección. Para esta **no se ha
   * hecho**, y conviene que quede escrito por qué:
   *
   * 1. **El módulo no existe.** No hay pantalla de votación en el panel, ni tabla, ni
   *    endpoint. Escribir «así votas» sería describir algo que no se puede usar, y esta
   *    página tiene una regla dura —nada que no sea verificable— que ya costó una
   *    verificación de Meta rechazada.
   * 2. **Y hay una contradicción de fondo que solo Fernando puede resolver.** La frase de
   *    esta tarjeta promete «un sistema que te permite votar»; `MEMORIA.md` recoge lo
   *    contrario como principio del proyecto: *«El poder se construye, no se decide»*, con
   *    crítica explícita a la democracia por voto y con las decisiones tomadas por el líder
   *    tras escuchar propuestas. Redactar cualquiera de las dos versiones sería decidir por
   *    él una cuestión que no es de diseño.
   *
   * Mientras tanto la sección funciona: aparece en el panel izquierdo, muestra su título y su
   * frase, y **el panel de preguntas simplemente no se pinta** — la regla del sitio, que lo
   * que no hay no deja hueco.
   */
  {
    id: 'democracia', icono: 'voto',
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
