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
   * Dos nombres para lo mismo obligan a traducir mentalmente cada vez que se mira una URL, y
   * una dirección que no se parece a lo que enseña no se recuerda ni se teclea. Así que
   * `id` = el título en minúsculas y sin tildes, **siempre**.
   *
   * Esta sección ha cambiado de nombre dos veces en dos días, y las tres direcciones siguen
   * vivas: `requerimientos` (04-08) → `progreso` (08-19, mañana) → **`plataforma`** (08-19,
   * tarde).
   *
   * ⚠️ **Este `id` es TRES cosas a la vez**: el tramo de la URL (`/clientes/<id>`), la clave
   * con la que se guardan las preguntas frecuentes (`gcc_world.faqs.acceso_id`) y el valor de
   * `generateStaticParams`. Cambiarlo exige las tres: las redirecciones de las direcciones
   * viejas en `next.config.ts` —**todas en un salto**, sin encadenar— y una migración que
   * renombre las filas de `faqs` (046 para el primer cambio, 047 para este).
   *
   * ⚠️ **Ojo con el nombre: «Plataforma» ya existe en la barra de arriba**, como botón que
   * abre el acceso. Ahora hay dos cosas con ese nombre a la vista al mismo tiempo: la que
   * **explica** la plataforma (esta sección) y la que **entra** en ella (el botón). Fernando
   * lo eligió sabiendo cómo está la barra; queda anotado por si algún día confunde a alguien.
   */
  {
    id: 'plataforma', icono: 'ticket',
    titulo: 'Plataforma',
    texto: 'Gestiona tus requerimientos publicando tickets, o proyectos que necesitan en tu organización.',
    /**
     * ⚠️ **ESCRITA POR MÍ** (2026-08-19), a petición de Fernando —«una descripción más larga y
     * al mismo estilo que hemos usado en los otros temas»—, y está para que la corrija.
     *
     * Cada afirmación corresponde a algo que EXISTE y que además cuentan sus dos preguntas:
     * el ticket con su presupuesto y su fecha límite, el proyecto con su cotización y su
     * responsable, y el seguimiento desde el panel del cliente. Ni cifras ni plazos: la regla
     * de la página.
     *
     * Dice **«la plataforma»** con todas las letras a propósito. La sección se llama igual que
     * el botón violeta de la barra de arriba, y ahí hay una ambigüedad real: uno **explica** la
     * plataforma y el otro **entra** en ella. Nombrarla en la primera frase deja claro de qué
     * se está hablando antes de que nadie se lo pregunte.
     */
    descripcion:
      'La plataforma es donde vive tu trabajo con nosotros. Publicas lo que necesitas —un ticket suelto o un proyecto entero—, lo toma quien tiene el talento para resolverlo, y desde tu panel sigues el presupuesto, los plazos y a quién lo está haciendo, sin tener que perseguir a nadie.',
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
          'En vez de preguntarle a tu equipo cómo reaccionaría ante una situación, puedes mediante este videojuego, desarrollar los retos que quieres para evaluar a tus colaboradores y así generar espacios de reflexión, aprendizaje, analizar sus deciciones y entender cómo ellos resolverían un problema que planteas.',
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
            texto: 'Cada prueba va a generar un reporte según las decisiones tomadas, logros alcanzados, y criterios de evaluación aplicados en tus pruebas.',
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
        pregunta: '¿Te gustaría conocer nuestro talento, y encontrar personal con alto valor humano y profesional?',
        texto:
          'Puedes jugar con nosotros, enfrentar retos del videojuego, cumplir un rol en el progreso de misiones, enfrentar pruebas de estrategia, puzzles, decisiones difíciles. Aquí encontrarás diversión, y oportunidades para tu negocio.',
        pasos: [
          {
            titulo: 'Entras con tu cuenta',
            texto: 'La misma con la que se entra en la plataforma. Es la única puerta para los clientes.',
            icono: 'candado',
          },
          {
            titulo: 'Juega y gana',
            texto: 'Participa para obtener GCC Coins, y ganar acceso a servicios y productos gratuitos.',
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
   *
   * ── QUÉ CAMBIÓ EL 2026-08-19 ──────────────────────────────────────────────────
   * Fernando pidió que la descripción general y las de las preguntas dijeran **qué es este
   * sitio**, no solo qué se compra: *«un espacio donde todos los miembros publican sus
   * soluciones para que puedas adquirir diferentes tipos de productos, proyectos o
   * automatizaciones para tu organización»*.
   *
   * El matiz importa y no es de estilo: «compra productos» describe una tienda cualquiera;
   * «los miembros publican lo que saben hacer» describe **de dónde sale** lo que compras, que
   * es lo único que aquí no puede copiar un competidor. Es además coherente con `/soluciones`,
   * donde ese mismo trabajo aparece por talento.
   */
  {
    id: 'marketplace', icono: 'tienda',
    titulo: 'Marketplace',
    texto: 'Accede al marketplace y compra productos, automatizaciones y proyectos de los miembros y candidatos de la organización.',
    descripcion:
      'El marketplace es el espacio donde los miembros publican sus soluciones: lo que cada uno sabe hacer, ya construido y listo para usarse. Ahí puedes adquirir productos, proyectos y automatizaciones para tu organización, y detrás de cada uno está la persona que lo hizo.',
    enlaceExterno: { href: '/marketplace-publico', etiqueta: 'Ver el marketplace' },
    temas: [
      {
        id: 'que-hay-dentro',
        etiqueta: 'Catálogo',
        pregunta: '¿Qué se puede comprar aquí?',
        texto:
          'Encontrarás soluciones que publican los propios miembros; también productos, servicios, proyectos y acceso a automatizaciones que puedes implementar en tu organización.',
        pasos: [
          {
            titulo: 'Miras lo que hay publicado',
            texto: 'El catálogo está abierto: se recorre entero sin cuenta y sin registrarse para ver precios.',
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
      /**
       * ⭐ SEGUNDO TEMA DE MARKETPLACE — dictado por Fernando (2026-08-19).
       *
       * Sustituye a «¿Hace falta una cuenta para comprar?», que escribí yo el 08-18. Se
       * recupera con:
       *
       *     git show d92e77c:lib/sitio/contenido.ts
       *
       * No se pierde lo que aquel contaba: que el catálogo se ve sin cuenta y que para
       * adquirir hace falta una de cliente sigue dicho en los pasos 01 y 03 del tema de
       * arriba. Era la respuesta a una duda pequeña; esta responde a una grande.
       *
       * Su texto va **palabra por palabra**, con dos correcciones que no cambian lo que dice:
       *  · «GCC coins» → «GCC Coins», el acrónimo en mayúsculas como en el resto del proyecto.
       *  · «algún otro tipo de producto o servicios» → «…o servicio» (concordancia).
       *
       * **Las descripciones de los tres pasos son mías**, a petición suya —él dictó solo los
       * títulos— y están para que las corrija. Cada una dice lo que hace el paso y nada más:
       * ni cifras, ni comisiones, ni plazos, que es la regla de la página.
       *
       * ⚠️ El marketplace **entre clientes** —regalar, revender, permutar— no existe todavía.
       * Mismo aviso que en Retos CC y Talentos, y misma decisión suya. Y aquí aparece otra vez
       * el nombre de la moneda: **«GCC Coins» son las «fichas» de `MEMORIA.md`**, y esto es ya
       * el segundo sitio público donde se escribe. Cuanto antes se elija uno, mejor.
       */
      {
        id: 'vender-mis-consumos',
        etiqueta: 'Entre clientes',
        pregunta: '¿Puedo alquilar o vender cosas en esta tienda?',
        texto:
          'En esta plataforma puedes regalar, vender, o alquilar los recursos que hayas comprado a través del marketplace de clientes. Esta es una tienda dedicada para que puedes intercambiar tus propios productos y servicios con otros clientes usando dinero real, GCC Coins, o algún otro tipo de producto o servicio que ofrezca el otro cliente.',
        pasos: [
          {
            titulo: 'Publica lo que quieras vender',
            texto: 'Escoges, de lo que ya adquiriste, aquello que quieres traspasar. Le pones precio o lo dejas como regalo, y queda a la vista del resto de clientes.',
            icono: 'tienda',
          },
          {
            titulo: 'Negocia el costo final con tus clientes',
            texto: 'Quien se interese te escribe, y el precio se acuerda entre los dos. Nada se cierra hasta que ambos estén de acuerdo.',
            icono: 'acuerdo',
          },
          {
            titulo: 'Intercambia, compra o vende',
            texto: 'El pago puede ser dinero real, GCC Coins, o directamente otro producto o servicio del otro cliente. Los tres caminos valen, y cuál se usa forma parte del trato (La plataforma gestiona los traspasos).',
            icono: 'billetera',
          },
        ],
      },
    ],
  },
  /**
   * ⭐ DEMOCRACIA — resuelta el 2026-08-19, tras estar en pausa desde el 08-18.
   *
   * Quedó sin contenido a propósito por dos motivos que hay que dar por cerrados:
   *
   * 1. **El módulo sigue sin existir** (ni pantalla, ni tabla, ni endpoint). Es el mismo aviso
   *    que en Retos CC, Talentos y el marketplace entre clientes, y la misma decisión suya.
   * 2. **La contradicción aparente con el fundamento del proyecto, que YA NO LO ES.**
   *    `MEMORIA.md` dice *«el poder se construye, no se decide»*, con crítica explícita a la
   *    democracia por voto. Parecía chocar de frente con una sección llamada «Democracia», y
   *    por eso se paró a preguntar.
   *
   *    Fernando lo aclaró y la distinción es limpia: aquella crítica es a **elegir quién
   *    manda** por votación —el líder se gana moviendo a la gente, no en una urna—. Esto es
   *    otra cosa: **elegir entre opciones** de gestión, beneficios, concursos y qué eventos
   *    hacer. Votar el próximo evento no es votar un líder. Las dos ideas conviven sin
   *    tocarse, y conviene que quede escrito para que nadie lo lea como una incoherencia.
   *
   * **El contenido es mío**, a partir de lo que él describió —*«que los clientes sepan que
   * pueden votar en la organización para tomar decisiones de gestión organizacional,
   * beneficios, concursos para elegir qué eventos realizar, o entre diferentes opciones todos
   * puedan votar»*— y está para que lo corrija. No promete cifras, ni plazos, ni quórum.
   */
  {
    id: 'democracia', icono: 'voto',
    titulo: 'Democracia',
    texto: 'Sé parte de un sistema que te permite votar sobre las mejoras a realizar dentro de la organización.',
    descripcion:
      'Ser cliente aquí no es solo contratar. Sobre la gestión de la organización, los beneficios, los concursos y los eventos que se van a hacer se abren votaciones, y quien forma parte elige entre las opciones que hay sobre la mesa.',
    temas: [
      {
        id: 'tener-voz',
        etiqueta: 'Votaciones',
        pregunta: '¿Quieres tener voz en las decisiones de la organización?',
        texto:
          'Las decisiones que afectan a todos se abren a votación: cómo se gestiona la organización, qué beneficios se dan, qué concursos se convocan y qué eventos se hacen. Tu voto cuenta como el de cualquier otro.',
        pasos: [
          {
            titulo: 'Se abre la votación',
            texto: 'Cuando hay algo que decidir se publica con sus opciones y el plazo para votar, para que nadie se entere cuando ya está resuelto.',
            icono: 'lista',
          },
          {
            titulo: 'Eliges tu opción',
            texto: 'Entras con tu cuenta y votas la que prefieras. Un voto por cuenta, y sin tener que justificarlo ante nadie.',
            icono: 'voto',
          },
          {
            titulo: 'Se hace lo que se votó',
            texto: 'No es una encuesta de opinión: la opción elegida es la que se lleva a cabo, y después se cuenta cómo salió.',
            icono: 'verificado',
          },
        ],
      },
    ],
  },
];

/**
 * ═══════════ DESARROLLO HUMANO — las secciones para miembros y candidatos ═══════════
 *
 * Fernando (2026-08-19): *«aplicar el mismo diseño de interfaz que la de clientes, pero
 * orientada a los miembros o candidatos que quieran o sean parte de este proyecto»*.
 *
 * ── ⭐ NADA DE LO QUE HABÍA SE HA PERDIDO ─────────────────────────────────────
 * La página anterior tenía cinco bloques suyos —tres motivos, Condiciología, Modelo 4P, los
 * nueve valores y el violeta— y **están los cinco aquí, con su texto intacto**, repartidos
 * entre las cuatro secciones. Eligió esta opción sobre otras dos, y era la correcta: ese
 * contenido es lo único de la web que un competidor no puede copiar, y encima es lo que
 * sostiene el posicionamiento por «condiciología» y «Modelo 4P» que declara la página.
 *
 * Lo que se ha AÑADIDO es la mitad que faltaba: qué obtiene de verdad quien entra —cómo se
 * postula, cómo le llega trabajo, cómo vende lo que construye y cómo crece—. La página
 * contaba **quiénes somos** y no contaba **qué gana el que se acerca**.
 *
 * ⚠️ **Este contenido nuevo lo escribí yo** y está para que lo corrija. Cada afirmación sale
 * de algo que existe o que él ya dictó, y queda anotada su procedencia junto a cada sección.
 * Ni cifras, ni plazos, ni sueldos: la misma regla que en `/clientes`.
 *
 * ⚠️ Comparte tipo con `ACCESOS` (`Acceso`) **a propósito**: las dos ramas usan el mismo
 * explorador, y darles tipos distintos habría obligado a duplicarlo.
 */
export const DESARROLLO: Acceso[] = [
  /**
   * Los tres motivos y el violeta son **texto de Fernando, palabra por palabra**, rescatado
   * de la página anterior (`git show baaa033:app/(sitio)/desarrollo-humano/page.tsx`).
   */
  {
    id: 'el-proyecto', icono: 'pulso',
    titulo: 'El proyecto',
    texto: 'Por qué existe el Grupo Corazones Cruzados, y qué significa su color.',
    descripcion:
      'El Grupo Corazones Cruzados es un proyecto de desarrollo humano, no una empresa que además hace cosas buenas. De ahí sale todo lo demás: la plataforma, el videojuego, el marketplace y la forma de trabajar. Y por eso conviene empezar por aquí antes que por lo que se ofrece.',
    temas: [
      {
        id: 'tres-motivos',
        etiqueta: 'Por qué existe',
        pregunta: '¿Por qué existe este proyecto?',
        texto:
          'No son eslóganes: son las razones que le dan origen, y de las que sale todo lo demás.',
        pasos: [
          {
            titulo: 'Un corazón puede cruzar el mundo',
            texto: 'Crecemos en entornos diferentes, pero los valores deben ser compartidos. Una organización debe representar la alianza única que existe en la humanidad. Y lo que más necesitamos es una razón para trabajar juntos por un futuro mejor.',
            icono: 'pulso',
          },
          {
            titulo: 'Una realidad imposible, contra una disciplina centralizada',
            texto: 'Los jóvenes heredan las consecuencias de adultos que ignoraron las problemáticas sociales y prefirieron creerlas imposibles antes que intentarlo. La forma de confrontar esa realidad imposible es una disciplina centralizada: un sueño único y compartido, trabajado a diario.',
            icono: 'escudo',
          },
          {
            titulo: 'El poder se construye, no se decide',
            texto: 'Tener acceso a recursos no ganados es poder ilegítimo. El poder se construye y se obtiene cuando la gente reconoce a su líder, no cuando elige entre opciones que no la representan. Quien logra movilizar a las personas es líder nato.',
            icono: 'bandera',
          },
        ],
      },
      {
        id: 'el-violeta',
        etiqueta: 'Violeta',
        pregunta: '¿Por qué el violeta?',
        texto:
          'El violeta resulta de combinar dos colores distintos. Es decir: une lo distinto en uno solo para alcanzar algo más grande. Es el color que representa al grupo, y está en todos sus proyectos.',
        pasos: [
          {
            titulo: 'Marca',
            texto: 'El violeta está en todos los proyectos del grupo, sin importar de quién sean, para que se reconozcan como parte de él.',
            icono: 'paleta',
          },
          {
            titulo: 'Filosofía',
            texto: 'Cada persona debe sentirse afín a ese sentimiento de unión. No es obligatorio sentirlo, pero sí creer en él.',
            icono: 'idea',
          },
          {
            titulo: 'Acción',
            texto: 'Ayudar y esperar ser ayudado. El apoyo de hoy se devuelve mañana, y el conocimiento se comparte entre proyectos.',
            icono: 'acuerdo',
          },
        ],
      },
    ],
  },

  /**
   * **Las tres reglas y los nueve valores son de Fernando** (onboarding, slider 4; están
   * verbatim en `MEMORIA.md`). Los pasos de la postulación describen el flujo que YA existe:
   * `/auth/candidato`, el tipo de cuenta `candidate` y la conversión a miembro que decide un
   * miembro Global del paso de Implementación.
   *
   * ⚠️ Se dice que un fallo a los valores implica destitución porque **así está dictado**, y
   * callarlo sería más engañoso que decirlo: quien se postula tiene derecho a saberlo antes.
   */
  {
    id: 'como-se-entra', icono: 'acuerdo',
    titulo: 'Cómo se entra',
    texto: 'Cómo se postula alguien, qué se le pide y cómo pasa de candidato a miembro.',
    descripcion:
      'Se entra como candidato y se llega a miembro. No hay una prueba técnica ni una entrevista al uso: lo que se mira es si representas lo que el grupo dice ser, porque cada persona que entra pasa a ser la cara del proyecto ante los demás.',
    enlaceExterno: { href: '/', etiqueta: 'Postularme' },
    temas: [
      {
        id: 'postulacion',
        etiqueta: 'Postulación',
        pregunta: '¿Cómo se entra al proyecto?',
        texto:
          'La postulación se hace desde la portada y no cuesta nada. A partir de ahí tienes tu propia cuenta para seguir en qué punto está.',
        pasos: [
          {
            titulo: 'Te postulas',
            texto: 'Desde la portada, con tus datos y lo que sabes hacer. Entras como candidato y esa es tu puerta desde el primer día.',
            icono: 'bandera',
          },
          {
            titulo: 'Sigues tu postulación',
            texto: 'Tu cuenta de candidato te deja ver en qué punto estás, sin tener que preguntar a nadie cómo va.',
            icono: 'lista',
          },
          {
            titulo: 'Te conviertes en miembro',
            texto: 'Cuando representas los valores del grupo, un miembro Global del paso de Implementación decide convertirte en miembro. No es un plazo: es un reconocimiento.',
            icono: 'premio',
          },
        ],
      },
      {
        id: 'que-se-espera',
        etiqueta: 'Reglas y valores',
        pregunta: '¿Qué se espera de quien entra?',
        texto:
          'Nueve valores, y no son un cartel en la pared: Determinación, Coraje, Pureza, Fe, Paciencia, Seriedad, Espontaneidad, Autonomía y Empatía. Son el criterio con el que se entra y con el que se sigue, y se apoyan en tres reglas que aplican a todo el proyecto.',
        pasos: [
          {
            titulo: '¿Quiénes somos?',
            texto: 'Candidatos y miembros representan lo que el grupo es. Si quien entra miente, el grupo miente. Un solo fallo intencionado a los valores implica la salida; los no intencionales se evalúan.',
            icono: 'personas',
          },
          {
            titulo: 'Comandos',
            texto: 'La gobernanza escucha, decide y recibe correcciones DESPUÉS de un resultado. El comando se ejecuta, se mide, y solo se cambia si el resultado fue negativo.',
            icono: 'flujo',
          },
          {
            titulo: 'Opciones de crecimiento',
            texto: 'Todos pueden crecer desde el primer momento. El crecimiento se adapta a la necesidad de cada uno, valorando su talento y dándole los recursos que le hacen falta.',
            icono: 'tendencia',
          },
        ],
      },
    ],
  },

  /**
   * Todo lo de esta sección **existe y se puede comprobar en la app**: el CV público
   * organizado por talento (migración 037, `/cv/<token>`), los tickets con `required_talents`,
   * los proyectos que piden talentos en sus requerimientos, las pujas, y el marketplace donde
   * los miembros publican. Es la sección más verificable de la página, y a propósito.
   */
  {
    id: 'tu-talento', icono: 'estrella',
    titulo: 'Tu talento',
    texto: 'Cómo se declara lo que sabes hacer, cómo te llega trabajo y cómo vendes lo que construyes.',
    descripcion:
      'Aquí no se reparte trabajo por antigüedad ni por a quién conoces: se reparte por talento. Lo que declaras que sabes hacer es lo que hace que un ticket o un proyecto llegue hasta ti, y lo que construyes puedes venderlo con tu nombre encima.',
    temas: [
      {
        id: 'como-llega-el-trabajo',
        etiqueta: 'Talentos',
        pregunta: '¿Cómo llega el trabajo hasta ti?',
        texto:
          'Cada ticket y cada proyecto declara qué talento necesita. Si es el tuyo, lo ves y puedes tomarlo — no hay que esperar a que alguien se acuerde de ti.',
        pasos: [
          {
            titulo: 'Declaras tu talento',
            texto: 'Tu CV se organiza por talento, no por orden cronológico: se ve lo que sabes hacer antes que dónde estuviste.',
            icono: 'estrella',
          },
          {
            titulo: 'Tienes un CV que se comparte',
            texto: 'Tu currículum tiene su propio enlace público, con tu portafolio y tus datos de contacto. Tú decides qué aparece: lo que dejas vacío no se pinta.',
            icono: 'enlace',
          },
          {
            titulo: 'Tomas lo que encaja contigo',
            texto: 'Revisas el ticket abierto, miras tu disponibilidad frente a la fecha de entrega y defines el costo dentro del presupuesto del cliente.',
            icono: 'ticket',
          },
        ],
      },
      {
        id: 'vender-lo-tuyo',
        etiqueta: 'Marketplace',
        pregunta: '¿Puedes vender lo que construyes?',
        texto:
          'Sí, y es lo que hace el marketplace: lo que ya sabes hacer deja de ser un trabajo por encargo y pasa a ser algo que se publica una vez y se vende muchas.',
        pasos: [
          {
            titulo: 'Publicas tu solución',
            texto: 'Un producto terminado, una automatización o un proyecto que se pueda repetir. Con sus imágenes y su precio.',
            icono: 'tienda',
          },
          {
            titulo: 'Aparece con tu nombre',
            texto: 'Detrás de cada cosa publicada está quien la construyó, y el cliente lo ve. No es un catálogo anónimo.',
            icono: 'personas',
          },
          {
            titulo: 'Un cliente lo adquiere',
            texto: 'Lo encuentra en el catálogo, abre la ficha y lo solicita desde ahí. El seguimiento vive en el panel de los dos.',
            icono: 'carrito',
          },
        ],
      },
    ],
  },

  /**
   * Las cuatro dimensiones, la Condiciología y el Modelo 4P son **de Fernando**, verbatim en
   * `MEMORIA.md` y en la página anterior. Aquí solo cambian de sitio y ganan la pregunta que
   * las introduce.
   */
  {
    id: 'como-se-crece', icono: 'tendencia',
    titulo: 'Cómo se crece',
    texto: 'Las cuatro dimensiones del desarrollo humano, la Condiciología y el Modelo 4P.',
    descripcion:
      'Crecer aquí no es ascender de puesto. Se trabaja en cuatro dimensiones a la vez —laboral, corporal, social y mental—, se mide con un método propio, la Condiciología, y se organiza con una estructura donde cada uno sabe qué le toca: el Modelo 4P.',
    temas: [
      {
        id: 'cuatro-dimensiones',
        etiqueta: 'Dimensiones',
        pregunta: '¿En qué se crece exactamente?',
        texto:
          'En cuatro dimensiones, y no se avanza en una a costa de otra. Alguien que rinde en lo laboral pero se está rompiendo por dentro no está creciendo: está aguantando.',
        pasos: [
          { titulo: 'Laboral', texto: 'Lo que sabes hacer y hasta dónde puedes llevarlo dentro del proyecto.', icono: 'maletin' },
          { titulo: 'Corporal', texto: 'La salud y el estado físico, que sostienen todo lo demás cuando el trabajo aprieta.', icono: 'salud' },
          { titulo: 'Social', texto: 'Cómo te relacionas y cuánto aportas a quienes tienes cerca.', icono: 'personas' },
          { titulo: 'Mental', texto: 'La cabeza con la que enfrentas lo difícil, y la que decide si te rindes o no.', icono: 'idea' },
        ],
      },
      {
        id: 'condiciologia',
        etiqueta: 'El método',
        pregunta: '¿Cómo se decide qué hay que cambiar?',
        texto:
          'Con la Condiciología. Una condición es el conjunto de factores que se manifiestan en una instancia de la realidad. Lo que no se ha estudiado no es una condición: se convierte en una cuando se reconoce por qué ocurrió. Se aplica a personas, a proyectos y a ideas.',
        pasos: [
          { titulo: 'Reconocer', texto: 'Identificar las condiciones que intervienen.', icono: 'buscar' },
          { titulo: 'Controlar', texto: 'Establecer control sobre ellas.', icono: 'medidor' },
          { titulo: 'Predecir', texto: 'Anticipar cómo se comportarán.', icono: 'grafico' },
          { titulo: 'Experimentar', texto: 'Probar sobre ellas.', icono: 'destello' },
          { titulo: 'Convertir', texto: 'Transformarlas.', icono: 'flujo' },
          { titulo: 'Cambiar', texto: 'Cambiar la condición, y con ella el resultado.', icono: 'verificado' },
        ],
      },
      {
        id: 'modelo-4p',
        etiqueta: 'Modelo 4P',
        pregunta: '¿Cómo se organiza el trabajo?',
        texto:
          'Con cuatro pasos y cuatro pisos. Cada uno de los cuatro pasos contiene los cuatro pisos —Global, Pilar, Controlador y Colaborador—, y cada piso resuelve con su rol la necesidad de ese paso para hacer avanzar el proyecto.',
        pasos: [
          { titulo: 'Fundamentación', texto: 'Respalda el porqué y la base de conocimiento.', icono: 'libro' },
          { titulo: 'Creación', texto: 'Crea el planteamiento ya fundamentado.', icono: 'idea' },
          { titulo: 'Implementación', texto: 'Lo implanta dentro de la organización.', icono: 'herramienta' },
          { titulo: 'Gestión', texto: 'Publicación, marketing y monetización.', icono: 'altavoz' },
        ],
      },
    ],
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
