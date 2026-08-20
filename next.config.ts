import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * DÓNDE SE ESCRIBE EL BUILD — configurable, y hace falta (2026-08-17).
   *
   * `next dev` y `next build` usan el MISMO `.next` por defecto. Con el servidor de
   * desarrollo levantado, un `next build` en la misma carpeta se pisa con él y falla de
   * formas que no señalan al culpable: `PageNotFoundError: Cannot find module for page`
   * en páginas que nadie ha tocado, reglas CSS que «no aparecen» en el bundle, o un
   * servidor sirviendo un build que ya se borró debajo.
   *
   * Con esto, para comprobar un build sin parar el `npm run dev` de nadie:
   *
   *     NEXT_DIST_DIR=.next-build npm run build
   *
   * Por defecto no cambia nada, y Railway no pasa la variable: compila en `.next`.
   *
   * ⚠️ **Al usarla, Next REESCRIBE `next-env.d.ts` y `tsconfig.json`** apuntando al
   * directorio nuevo. Esos dos archivos **NO deben commitearse así**: dejarían el build
   * normal —el de Railway— buscando tipos en una carpeta que allí no existe. Después de un
   * build aislado: `git checkout -- next-env.d.ts tsconfig.json`.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'puppeteer'],

  /**
   * RENOMBRADOS DEL SITIO PÚBLICO, CON REDIRECCIÓN PERMANENTE.
   *
   * Fernando renombró la sección comercial. Las seis URLs viejas llevan publicadas desde el
   * 2026-08-04 y **una de ellas es la que se le declaró a Meta** para la verificación de
   * proveedor de tecnología. Cambiar la ruta a secas las dejaría en 404: enlaces rotos y el
   * posicionamiento ganado, a la basura.
   *
   * `permanent: true` emite un **308** (el 301 de toda la vida, conservando el método):
   * le dice a Google «esta página se mudó, pasa la autoridad a la nueva y olvida la vieja».
   * Un 307/302 diría lo contrario —«volveré»— y mantendría las dos URLs compitiendo.
   *
   * ⚠️ **La redirección evita el 404, pero no actualiza a Meta.** Hay que cambiar la URL
   * declarada en su formulario a `/soluciones`.
   *
   * ── POR QUÉ LA SEGUNDA REGLA ENUMERA LAS CINCO PUERTAS ─────────────────────────
   * No es manía: **las redirecciones se resuelven ANTES que los archivos de `public/`**. Un
   * `/negocio/:necesidad` genérico se tragaría también `/negocio/paso-1-publicas.webp` —las
   * seis ilustraciones de la puerta «Progreso»— y las mandaría a una ruta que no existe. Con
   * los cinco nombres escritos, solo se redirige lo que de verdad era una página; cualquier
   * otra cosa bajo `/negocio/` responde 404, que es lo que ya hacía (`dynamicParams = false`).
   * Las imágenes, además, se mudaron a `public/clientes/` (pasaron por `public/soluciones/`
   * el 2026-08-17, antes del intercambio de nombres del 08-18).
   *
   * Y por eso esta lista **no se sincroniza con `ACCESOS`**, aunque lo parezca: es la lista
   * cerrada de las URLs que llegaron a publicarse bajo `/negocio`. Una puerta nueva nacerá
   * ya en `/soluciones` y no necesita redirección de una dirección que nunca existió.
   */
  async redirects() {
    return [
      { source: '/negocio', destination: '/clientes', permanent: true },
      /**
       * ⚠️ `/soluciones` CAMBIÓ DE SIGNIFICADO EL 2026-08-18, y es lo delicado de este bloque.
       *
       * El 08-17 apuntaba a las cinco puertas; hoy apunta a los ámbitos, y las cinco puertas
       * se mudaron a `/clientes`. La dirección **se reutiliza**, así que NO se redirige
       * `/soluciones` a secas: hoy sirve otra página, a propósito.
       *
       * Lo que sí se redirige son **sus cinco hijas**, que sí eran de las puertas. Y aquí
       * enumerarlas importa el doble: bajo `/soluciones/` vive ahora la ruta dinámica de los
       * talentos, y un comodín se comería cualquier talento cuyo slug coincidiera.
       *
       * ⚠️ Consecuencia asumida: si algún día un talento se llamara «Marketplace», su slug
       * chocaría con esta lista y ganaría la redirección. Improbable, y preferible a romper
       * cinco URLs ya publicadas.
       */
      {
        source: '/soluciones/:necesidad(videojuego|marketplace)',
        destination: '/clientes/:necesidad',
        permanent: true,
      },
      /**
       * ⚠️ «AUTOMATIZACIÓN» YA NO ES UNA PUERTA DE CLIENTES (2026-08-18).
       *
       * Su tarjeta se retiró porque ese contenido se maneja ahora desde `/soluciones`. La
       * URL llevaba publicada desde el 2026-08-04 —primero como `/negocio/automatizacion`,
       * luego `/soluciones/automatizacion`, luego `/clientes/automatizacion`—, así que las
       * **tres** van a `/soluciones`, que es donde está lo que buscaban.
       *
       * Estas reglas van ANTES que las de las cinco puertas: la primera que casa gana, y
       * aquellas mandarían `automatizacion` a `/clientes/automatizacion`, que ya no existe.
       */
      { source: '/clientes/automatizacion', destination: '/soluciones', permanent: true },
      { source: '/soluciones/automatizacion', destination: '/soluciones', permanent: true },
      { source: '/negocio/automatizacion', destination: '/soluciones', permanent: true },

      // `/ambitos` → `/soluciones`: la página se mudó entera, con sus talentos dentro.
      { source: '/ambitos', destination: '/soluciones', permanent: true },
      { source: '/ambitos/:talento', destination: '/soluciones/:talento', permanent: true },
      /**
       * Dos secciones de Desarrollo Humano cambiaron de nombre al reescribirse el 2026-08-19:
       * `tu-talento` → `tu-progreso` y `como-se-crece` → `ser-miembro`. Los nombres viejos
       * describían la página anterior, no la que hay.
       *
       * Llevaban publicadas **menos de una hora**, así que redirigirlas no salva ningún enlace
       * de nadie. Se hace igual porque la regla del sitio no admite excepciones por tamaño:
       * ninguna URL publicada muere. La alternativa —«esta era muy nueva, da igual»— es la que
       * deja 404 sueltos que nadie recuerda haber creado.
       */
      { source: '/desarrollo-humano/tu-talento', destination: '/desarrollo-humano/tu-progreso', permanent: true },
      { source: '/desarrollo-humano/como-se-crece', destination: '/desarrollo-humano/ser-miembro', permanent: true },
      /**
       * `/contacto` → `/legal` (Fernando, 2026-08-20). Borró la página, y esa URL llevaba
       * publicada desde el principio: la enlazaba el pie, el menú y el aviso de enlace
       * caducado de `/proyecto/[id]`.
       *
       * Va a `/legal` y no a `/clientes` porque es lo único honesto: allí siguen **el RUC y
       * los correos**, que es lo que iba a buscar quien escribía «contacto». Mandarlo a la
       * página comercial sería llevarlo a otro sitio del que sí quería.
       */
      { source: '/contacto', destination: '/legal', permanent: true },
      // `/recursos` → `/desarrollo-humano` (Fernando, 2026-08-17). No tiene hijas y no hay
      // ninguna carpeta `public/recursos`, así que aquí no hace falta acotar nada.
      { source: '/recursos', destination: '/desarrollo-humano', permanent: true },
      {
        source: '/negocio/:necesidad(videojuego|marketplace)',
        destination: '/clientes/:necesidad',
        permanent: true,
      },

      /**
       * ── DOS TRAMOS QUE CAMBIARON DE NOMBRE EL 2026-08-19 ──────────────────────────
       * `requerimientos` → `progreso` y `votacion` → `democracia`: Fernando pidió que la
       * dirección se llame como la sección que enseña. Las viejas llevan publicadas desde el
       * 2026-08-04 bajo tres prefijos distintos —`/negocio`, `/soluciones` y `/clientes`—, así
       * que se redirigen **las seis, una por una y en un solo salto**.
       *
       * ⚠️ Un salto, no dos. Se podría dejar que `/negocio/requerimientos` cayera en la regla
       * genérica de arriba y de ahí en la de `/clientes`, pero encadenar redirecciones diluye
       * la señal que se le pasa a Google y añade una ida y vuelta a quien entra. Por eso la
       * regla genérica ya no menciona estos dos tramos: solo quedan `videojuego` y
       * `marketplace`, que no cambiaron de nombre.
       */
      /**
       * ⚠️ **ESTA SECCIÓN HA CAMBIADO DE NOMBRE DOS VECES EN DOS DÍAS.**
       * `requerimientos` (04-08) → `progreso` (08-19, mañana) → `plataforma` (08-19, tarde).
       *
       * Las cuatro direcciones apuntan **directamente** al destino final. Encadenar
       * —`requerimientos` → `progreso` → `plataforma`— sería lo cómodo y lo equivocado: cada
       * salto diluye la señal que se le pasa a Google y añade una ida y vuelta a quien entra.
       * Cuando cambie el nombre otra vez, hay que **reapuntar estas cuatro**, no añadir una
       * quinta detrás.
       *
       * `/soluciones/progreso` y `/negocio/progreso` NO se listan porque **nunca existieron**:
       * `progreso` nació ya bajo `/clientes`. Redirigir direcciones que nadie publicó es
       * inventarse tráfico que no hubo.
       */
      { source: '/clientes/progreso', destination: '/clientes/plataforma', permanent: true },
      { source: '/clientes/requerimientos', destination: '/clientes/plataforma', permanent: true },
      { source: '/soluciones/requerimientos', destination: '/clientes/plataforma', permanent: true },
      { source: '/negocio/requerimientos', destination: '/clientes/plataforma', permanent: true },
      { source: '/clientes/votacion', destination: '/clientes/democracia', permanent: true },
      { source: '/soluciones/votacion', destination: '/clientes/democracia', permanent: true },
      { source: '/negocio/votacion', destination: '/clientes/democracia', permanent: true },
    ];
  },

  // Los archivos del juego se revalidan en cada carga: al desplegar un mundo
  // nuevo, el navegador debe descargar la versión nueva y no servir la vieja de
  // caché. El equivalente en producción de lo que hace server.cjs en desarrollo.
  async headers() {
    return [
      {
        source: '/game/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
