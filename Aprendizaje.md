# Aprendizaje — Sistema "Gestión de Datos" (Centralizado · pilar · fundamentación)

> Documento vivo de la skill `/aprendizaje`. Acumula todas las preguntas técnicas y sus
> respuestas hasta dominar el problema y resolverlo sin fallos.
>
> **Estados de pregunta:** ❓ Abierta · 🔎 Investigando · ✅ Resuelta · ⏸ Bloqueada (espera al usuario)

---

## ⛔ REGLA DE MÉTODO, POR ENCIMA DE CUALQUIER OBJETIVO (2026-08-02)

**Las imágenes generadas las evalúa SOLO Fernando. Yo genero, entrego y paro.**

Textual: *"deja para siempre de estar calificando las imágenes, tú tienes mala capacidad para
distinguir detalles muy específicos… solo yo decido eso"*.

- **Prohibido** emitir un juicio sobre una imagen generada ("no es lo que pediste", "salió mal",
  "sigue sin coger la escala") y **prohibido regenerar apoyándose en ese juicio**.
- El ciclo del arte NO es "aprender iterando yo": es **generar una vez → entregar → esperar su
  veredicto → corregir con lo que él diga**. La iteración autónoma que esta skill fomenta para
  problemas técnicos **no aplica al arte**.
- **Dos motivos:** mi lectura de los detalles finos de un pixel-art no es fiable, y **cada tirada
  gasta créditos de prepago de su cuenta de Gemini** — iterar solo le cuesta dinero.
- **Sigue siendo válido comprobar lo objetivo** (eso no es opinión): que el `.png` se reescribió
  (md5), que no fue un 429/503, que la escena entra en `TRAMOS` donde toca, que el reparto de
  tiempos cuadra, que el `.import` está comprimido antes de publicar.
- **Origen:** con la estampa 115 encadené **5 tiradas seguidas** juzgando yo cada resultado, sin
  enseñarle ninguna. La norma ya existía en `godot/Videojuego.md` §6 y la incumplí.
- **Generalización para cualquier objetivo futuro:** cuando el criterio de aceptación sea
  **perceptivo** (cómo se ve, cómo suena, cómo se siente), el juez es Fernando y mi trabajo es
  producir y entregar. Cuando sea **verificable** (compila, cuadra, responde 200, el md5 cambió),
  el juez soy yo y debo comprobarlo antes de dar nada por hecho.

---

## Objetivo ACTUAL (declarado 2026-08-03) — LA WEB PÚBLICA QUE SE ENCUENTRA EN GOOGLE: diseño y contenido de `/negocio`, `/recursos` y `/contacto` · 🔎 60%

**Rol asumido:** *ingeniero de SEO técnico + estratega de contenido para una web corporativa
en Next.js App Router*. El trabajo tiene dos mitades que no se pueden separar —lo que la
página **dice** (contenido y palabras por las que quiere aparecer) y cómo el buscador lo
**lee** (HTML servido, datos estructurados, rendimiento, indexación)—, y una tercera que
manda sobre las dos: **lo que Fernando quiere presentar**.

**Orden acordado:** primero **`/negocio`**, después `/recursos` y `/contacto`.

### El punto de partida — lo que YA existe (auditado el 2026-08-03, contra el código)

No se parte de cero. La web pública se construyó el 2026-08-02 (`bb9f7f0`) para el rechazo
de verificación de Meta, y trae más SEO del que suele traer una web recién hecha:

| Pieza | Dónde | Estado |
|---|---|---|
| `metadataBase` + plantilla de título | `app/layout.tsx` | ✅ |
| `title`, `description`, `canonical`, `openGraph` por página | las tres `page.tsx` | ✅ |
| Mapa del sitio | `app/sitemap.ts` — portada, las tres páginas y los legales | ✅ |
| `robots.txt` | `app/robots.ts` — bloquea panel, API, sesión y portales | ✅ |
| Datos estructurados JSON-LD | `ProfessionalService` en `/negocio`, `AboutPage` en `/recursos`, `ContactPage` en `/contacto` | ✅ |
| Microdato `Organization` | `components/sitio/PieSitio.tsx` | ✅ |
| Render en HTML crudo | las tres son **Server Components**; solo `AltaCliente` es isla | ✅ |
| Contenido en fuente única | `lib/sitio/contenido.ts` (`SERVICIOS`, `PUBLICOS`, `CLIENTES`, `VIDEOS`) | ✅ |
| Identidad legal verificable | `lib/negocio/datos.ts` → RUC contrastable en el SRI | ✅ |

### Los ocho fallos que ya se ven sin preguntar nada

Encontrados leyendo el código; **ninguno depende de una respuesta de Fernando** para
afirmarse, aunque sí para decidir cómo se arreglan.

1. ~~**EL FALLO GRAVE — la portada no existe para un buscador.**~~ **❌ ESTO ERA FALSO, y lo
   comprobé el 2026-08-03 midiendo el HTML servido.** Escribí que `app/page.tsx`, por ser
   `'use client'`, servía un HTML vacío. **No es así:** `'use client'` no desactiva el
   render en servidor, solo añade hidratación. `curl https://www.grupocc.org/` devuelve
   **21.567 bytes** con su `<title>` correcto y un `<h1>` real. La portada **sí es
   indexable**.
   - **Lo que sí queda en pie, mucho más pequeño:** el `<h1>` de la portada es *«Un Corazón
     puede cruzar el mundo»* — no contiene «Grupo Corazones Cruzados» ni ninguna palabra por
     la que alguien busque, y el resto de la portada es la experiencia del juego, con poco
     texto de negocio. Es un problema de **qué dice**, no de si se puede leer.
   - **Lección:** no dar por hecho el comportamiento de un framework a partir de una
     directiva del código. Se mide.
2. **El dominio es `app.grupocc.org`.** Un subdominio llamado `app` se lee como "la
   aplicación", no como el sitio de la empresa; y el SEO de un subdominio **no suma** al del
   dominio raíz, se acumula aparte. Es la decisión más determinante de todas y es de negocio
   → P1.
3. **Ningún H1 contiene una palabra por la que alguien busque.** «Primero las personas. Lo
   demás sale de ahí.» es buena marca y cero búsqueda. Nadie teclea eso en Google. El H1 es
   la señal más fuerte de una página sobre de qué trata.
4. **No hay imagen de Open Graph.** `openGraph` no lleva `images`, así que al pegar el
   enlace en WhatsApp, LinkedIn o X sale una tarjeta gris sin imagen. No es ranking, pero sí
   es cuántos clics recibe un enlace compartido.
5. **`user-scalable=no, maximum-scale=1`** en el `<meta viewport>` de `app/layout.tsx`.
   Impide ampliar con los dedos: fallo de accesibilidad que Lighthouse marca y que pesa en
   la evaluación móvil, que es la que Google usa (mobile-first).
6. **`lastModified: new Date()`** en el mapa del sitio: cada rastreo dice que **todas** las
   páginas cambiaron hoy. Una fecha que siempre miente deja de ser una señal.
7. **`keywords` en el `metadata`.** Google las ignora desde 2009. No hacen daño; tampoco
   nada. Lo que sí funciona es que esas palabras estén **en el texto visible**.
8. **No hay verificación de Search Console ni analítica.** Sin Search Console se trabaja a
   ciegas: no se sabe por qué consultas aparece, ni si Google llegó a indexar las páginas.

### Y lo que falta de contenido, que es lo que de verdad posiciona

- **Poco texto y muy troceado.** Las páginas son tarjetas con viñetas de una línea. Para una
  consulta competida ("chatbot whatsapp ecuador") Google prefiere páginas que **desarrollan**
  el tema. Hoy no hay ni un párrafo largo en toda la web.
- **Sin página por servicio.** Los cinco servicios de cliente viven como tarjetas dentro de
  `/negocio`. Una URL por servicio —`/negocio/agente-whatsapp`, `/negocio/facturacion-sri`…—
  es lo que permite competir por cada búsqueda por separado en vez de con una sola página
  para todo.
- **Sin preguntas frecuentes** → sin `FAQPage`, que es lo que gana los recuadros de
  respuesta en los resultados.
- **Sin nada que atraiga a quien todavía no busca comprar.** No hay artículos ni guías.
- **La sección de clientes está vacía** (`CLIENTES: []`, a propósito, esperando su permiso) y
  la de vídeos también (`VIDEOS: []`, faltan las URLs).

### Preguntas · lo que NO se puede deducir del repo

#### PS1 — ¿Se queda la web en `app.grupocc.org` o hay dominio propio? · ✅ Resuelta (Fernando, 2026-08-03) + 🔎 investigado contra el DNS real
- **Por qué importa:** es la decisión de mayor impacto de todo el objetivo. Un subdominio
  `app.` acumula autoridad aparte del dominio raíz y se lee como "la aplicación", no como la
  web de la empresa.
- **Respuesta de Fernando:** quiere **`grupocc.org` para el sitio web** (negocio, contacto,
  recursos) y **`app.grupocc.org` para la plataforma y el videojuego**. Dos frenos que él
  mismo señala: (1) **ya hay solicitudes de verificación en Meta apuntando al subdominio**,
  y (2) el servicio de **Railway apunta hoy al subdominio** — no usó el dominio principal
  desde el principio porque «creo que no se podía o no supe hacerlo bien». Proveedor del
  dominio: **Microsoft / GoDaddy**.

- **🔎 LO QUE DICE EL DNS REAL (medido el 2026-08-03 con `dig` y `curl`, no de memoria):**

  | Consulta | Resultado |
  |---|---|
  | `grupocc.org` A | `216.198.79.1` → **Vercel**. `https://grupocc.org` responde **404 `DEPLOYMENT_NOT_FOUND`** |
  | `www.grupocc.org` | **no resuelve** — no existe el registro |
  | `app.grupocc.org` | CNAME → `cndr3q54.up.railway.app` → Railway ✅ |
  | Nameservers | `ns1..4.bdm.microsoftonline.com` → **el DNS lo gestiona Microsoft 365**, no GoDaddy |
  | MX | `smtp.google.com` → el **correo entra por Google Workspace** |
  | TXT | SPF `include:spf.protection.outlook.com include:amazonses.com` + `mscid=…` de Microsoft |

- **🚨 HALLAZGO GRAVE, y no lo sabíamos:** **ya existió un sitio en `grupocc.org` y sigue
  indexado.** Buscando `condiciología`, el **primer resultado es `https://www.grupocc.org/`**
  con contenido real («la condiciología se usa como base para estructurar, diseñar y
  gestionar acciones»). Pero ese sitio **hoy está caído**: `www` no resuelve y el apex
  devuelve el 404 de Vercel. O sea: **la marca ya tiene presencia en el índice de Google,
  en un dominio que ahora mismo está roto para cualquiera que lo abra.** Hay también una
  **página de empresa en LinkedIn** (`ec.linkedin.com/company/grupo-corazones-cruzados`,
  fundada en 2011), que es una señal externa que ya está trabajando a favor.

- **⚠️ EL OBSTÁCULO TÉCNICO REAL — y no es el que él pensaba:** no es que «no se pueda»,
  es una combinación concreta de dos limitaciones:
  1. **Railway no publica IP estática**, así que **no admite registros A**. Solo CNAME.
     Para un dominio raíz hace falta que el DNS soporte *CNAME flattening* / `ALIAS` /
     `ANAME`, porque el estándar de DNS no permite un CNAME en el apex.
  2. **El DNS de Microsoft 365 (`bdm.microsoftonline.com`) no ofrece ese aplanado.** Por eso
     el apex está hoy en Vercel: Vercel **sí** da una IP fija y con un registro A basta.
  → **Conclusión:** para poner `grupocc.org` en Railway hay que **mover los nameservers a
  Cloudflare** (gratis, el registrador sigue siendo el mismo; solo cambian los NS), que sí
  aplana el CNAME en el apex. La alternativa sin tocar NS es servir el sitio en
  **`www.grupocc.org`** (CNAME, eso sí se puede en el DNS de Microsoft) y dejar el apex
  redirigiendo — pero el apex necesita un redirector y ahí volvemos a depender de Vercel o
  de Cloudflare.

- **⚠️ Y AL MOVER EL DNS NO SE PUEDE ROMPER EL CORREO.** `lfgonzalezm0@grupocc.org` entra por
  **Google Workspace** (MX `smtp.google.com`). Migrar a Cloudflare obliga a **copiar todos
  los registros** —MX, SPF, el `mscid` de Microsoft, DKIM si lo hay, y el CNAME de `app`—
  antes de cambiar los NS. Un registro que se olvide es correo perdido.

- **✅ Y LO DE META NO ES UN PROBLEMA, es un orden.** `app.grupocc.org` **no se toca ni se
  apaga**: en Railway se **añade** `grupocc.org` al mismo servicio, así que las URLs
  declaradas a Meta siguen respondiendo exactamente igual. Lo que cambia es qué se sirve en
  cada dominio (enrutado por *hostname*) y a dónde apunta el `canonical` —a `grupocc.org`—
  para que Google no vea dos copias del mismo contenido. **La redirección permanente del
  subdominio al dominio, si se hace, se deja para DESPUÉS de que Meta apruebe.**

- **✅ RECOMENDACIÓN, tras preguntar Fernando si Railway es viable o conviene otro (2026-08-03):
  SE QUEDA EN RAILWAY. Lo que se cambia es el DNS, no el hosting.**
  - **Por qué Railway y no Vercel, para ESTA app:** no es preferencia, es que la app **no
    entra** en un hosting serverless. `next.config.ts` ya declara
    `serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'puppeteer']`; además hay firma SRI
    con el `.p12` de `data/`, PDFs, los archivos del juego de Godot con su cabecera de caché
    propia, y una Postgres con conexión persistente vía `pg`. En Vercel eso es pelear con
    límites de tiempo de ejecución y sin sistema de archivos persistente. **Railway es la
    elección correcta y no se toca.**
  - **Por qué tampoco conviene partirlo** (sitio público en un sitio, app en otro): el
    contenido vive en el mismo repo (`lib/sitio/contenido.ts`), la cabecera y el pie son
    compartidos, y `/negocio` tiene que seguir respondiendo en `app.grupocc.org` para Meta.
    Partirlo son dos despliegues y dos sitios donde se rompe lo mismo.
  - **El arreglo real: mover los nameservers a Cloudflare** (gratis; el registrador sigue
    siendo el mismo). Verificado el 2026-08-03: **Microsoft 365 no ofrece ALIAS/ANAME** —solo
    A, CNAME, TXT, MX, SRV— y **Cloudflare aplana el CNAME en el apex automáticamente en el
    plan Free**, sin interruptor que buscar y conviviendo con los MX.
  - **Beneficio extra que aquí no es adorno:** con Cloudflare delante, la web pública se
    sirve desde caché en toda Latinoamérica. Como el territorio elegido es **LatAm entera**
    (PS3) y Railway sirve desde **una sola región**, esto se nota en la velocidad de carga,
    que sí es un factor de posicionamiento.
  - **Canónico elegido: `grupocc.org` a secas** (con `www` redirigiendo). Se decide **una
    vez**: cambiar el canónico más tarde cuesta posicionamiento.
  - **Camino alternativo si NO quiere tocar nameservers:** servir el sitio en
    **`www.grupocc.org`** con un CNAME a Railway —eso sí se puede hoy en el DNS de
    Microsoft— y dejar el apex para después. Funciona, pero el apex seguiría roto y el
    canónico quedaría en `www`.

- **🔁 CORRECCIÓN IMPORTANTE (2026-08-03, al preguntar Fernando si yo podía hacer los
  cambios): CLOUDFLARE NO SE PUEDE HOY. El alternativo pasa a ser el plan principal.**
  - **El dato que lo cambia todo:** los nameservers son `ns1..4.bdm.microsoftonline.com`, y
    `bdm` = *Buy Domain Microsoft*. Es decir, **el dominio se compró a través de Microsoft
    365**. Y según la documentación de Microsoft, **los dominios comprados en Microsoft 365
    no admiten cambio de nameservers**. Sin cambio de NS **no hay Cloudflare**, y sin
    Cloudflare **no hay aplanado de CNAME**, así que **el apex `grupocc.org` no puede
    apuntar a Railway**. ⚠️ *Pendiente de que Fernando lo confirme en su panel: no tengo
    acceso a su tenant y esto lo sé por la documentación, no por haberlo visto.*
  - **Salir de ahí exige transferir el dominio a otro registrador** (código de autorización,
    no antes de 60 días desde la compra, ~5-7 días de trámite). Es una operación aparte y
    **no debe bloquear la web**.
  - **➡️ DECISIÓN: el canónico pasa a ser `https://www.grupocc.org`.** No es un apaño: para
    Google `www` y el apex valen **exactamente igual**, y así se evita el peor escenario —
    lanzar en `www`, transferir el dominio meses después y **cambiar el canónico**, que sí
    cuesta posicionamiento. Se elige una vez, y se elige `www`.
  - **Lo que queda para después, sin prisa:** que `grupocc.org` a secas redirija a `www`
    (necesita transferencia + Cloudflare, o algo con IP fija delante) y la caché de
    Cloudflare para LatAm. **Ninguna de las dos bloquea nada.**
  - **Lo que hay que hacer, y en este orden:**
    1. **Railway** — añadir `www.grupocc.org` al servicio que ya existe. Railway devuelve el
       **destino CNAME exacto**, que es el dato que hace falta para el paso 2.
    2. **Microsoft 365 → Dominios → `grupocc.org` → Registros DNS → Agregar:** un **CNAME**,
       host `www`, con el destino del paso 1. **Nada más se toca**: ni MX, ni SPF, ni el
       `mscid` — tocarlos es tumbar el correo de Google Workspace.
    3. El registro **A del apex que apunta a Vercel** se deja de momento. Quitarlo no
       arregla nada (pasa de dar 404 a no resolver) y se decide junto con la transferencia.
    4. **En código (esto sí es mío):** enrutado por *hostname*, `metadataBase` y `canonical`
       a `https://www.grupocc.org`, mapa del sitio y `robots` al día, y que
       `app.grupocc.org` siga sirviendo `/negocio` para Meta.
  - **¿Puedo hacerlo yo?** **No los pasos 1-3, y conviene saber por qué:**
    - **Microsoft:** su API (Graph) expone los registros DNS de un dominio de M365 **solo de
      lectura**; no hay forma de crear un CNAME personalizado por API. Es el centro de
      administración a mano, y son dos minutos.
    - **Railway:** sí tiene API, pero **no hay `RAILWAY_TOKEN` en el `.env` de este repo**
      (comprobado). Con un token suyo podría; sin él, es el panel.
    - **Regla que no se rompe:** una credencial que me pase se usa **desde el entorno**, no
      se escribe nunca en el repo ni en estos documentos.
  - **⚠️ Cautelas de la migración de DNS, por orden:** (1) copiar **todos** los registros
    actuales a Cloudflare **antes** de cambiar los NS —MX de Google Workspace, SPF, el
    `mscid` de Microsoft, DKIM si lo hay, y el CNAME de `app`—; (2) los registros de correo
    **nunca proxeados**; (3) **quitar el registro A que hoy apunta a Vercel**; (4) **no
    apagar `app.grupocc.org`** hasta que Meta apruebe.

- **✅ `www.grupocc.org` YA ESTÁ EN MARCHA (medido el 2026-08-03).** Fernando añadió los dos
  registros que pidió Railway y funcionan:

  | Registro | Valor | Estado |
  |---|---|---|
  | CNAME `www` | `o8b57xou.up.railway.app` → `69.46.46.79` | ✅ resuelve |
  | TXT `_railway-verify.www` | `railway-verify=35af23b1…` | ✅ presente |
  | `https://www.grupocc.org/negocio` | **200**, certificado válido, sirve el `<title>` correcto | ✅ |

- **⛔⛔ NO PULSAR «CORREGIR REGISTROS AUTOMÁTICAMENTE» DE MICROSOFT 365 (2026-08-03).**
  Fernando enseñó el diálogo. **Ese botón le deja sin correo.** Lo que hace:
  - **Quita el `MX @ → 1 SMTP.GOOGLE.COM`** y lo sustituye por
    `0 grupocc-org.mail.protection.outlook.com`. Es decir, **desvía TODO el correo entrante
    de `@grupocc.org` de Google Workspace a Exchange Online.** Sin buzones creados ahí, el
    correo se pierde o rebota.
  - **Quita el SPF que incluye `amazonses.com`** y lo deja en `v=spf1
    include:spf.protection.outlook.com -all`. Amazon SES es **por donde envía Resend**, que
    es el correo saliente de la aplicación (`RESEND_API_KEY`, `lib/integrations/email.ts`).
    Con `-all` y sin ese `include`, **los correos de la app fallarían la autenticación**.
  - Añade `autodiscover` y `enterpriseenrollment` (Outlook e Intune): inofensivos, pero no
    hacen falta.
  - **El aviso de «registros en mal estado» es cosmético**: Microsoft marca como enfermo
    cualquier dominio suyo que no tenga el correo apuntando a Microsoft. Como el correo es de
    Google **a propósito**, ese aviso **no se va a ir nunca** y **no pasa nada**.

- **🔎 PERO HAY UN FALLO REAL EN EL SPF, y es anterior a todo esto (medido con `dig`):**
  ```
  v=spf1 include:spf.protection.outlook.com include:amazonses.com -all
  ```
  **No incluye a Google**, y el correo lo recibe *y lo envía* Google Workspace (el MX es
  `smtp.google.com` y existe `google._domainkey.grupocc.org`). O sea: **lo que Fernando
  escribe desde Gmail con su dirección `@grupocc.org` falla SPF**, y con `-all` es fallo
  duro. Hoy no se nota porque **la firma DKIM de Google sí valida** y el DMARC está en
  `p=none` (`_dmarc` → `v=DMARC1; p=none; rua=mailto:postmaster@grupocc.org`), así que el
  mensaje pasa por DKIM. Es frágil: cualquier receptor que mire SPF de forma estricta lo
  marca.
  - **✅ VALOR FINAL DEL SPF (2026-08-03), después de dos correcciones sobre la marcha:**
    ```
    v=spf1 include:spf.protection.outlook.com include:_spf.google.com -all
    ```
    - **`spf.protection.outlook.com` se queda porque Microsoft NO deja quitarlo.** Fernando
      lo intentó y el panel respondió: *«No se puede editar ni quitar el registro SPF
      Microsoft 365: spf.protection.outlook.com»*. Es una condición del dominio comprado en
      M365, la misma familia de restricciones que impide cambiar los nameservers. **No
      importa**: solo autoriza a unos servidores que no se usan, y el recuento de consultas
      DNS del SPF sigue muy por debajo del límite de 10.
    - **`_spf.google.com` entra** — es lo que de verdad envía y lo que arregla el fallo.
    - **`amazonses.com` sale.** Fernando: *«ya no me interesa enviar con resend»*.
  - **🔎 Y RESEND YA ESTABA FUERA DEL CÓDIGO — comprobado, no supuesto (2026-08-03).**
    `lib/integrations/email.ts` lo dice en su cabecera: *«Envío de correo unificado por la
    **Gmail API** (cuenta corporativa grupocc.org)… Resend se eliminó por completo»*, y
    `deliver()` llama a `sendViaGmail` de `lib/integrations/google-workspace.ts`
    (`gmail.users.messages.send`, scope `gmail.send`). Las únicas menciones que quedan son
    **inofensivas**: dos comentarios que documentan el reemplazo, la columna
    `flow_campaign_sends.resend_id` —un nombre heredado— y decenas de `resend`/`Reenviar`
    de la interfaz, que son el verbo español, no el proveedor.
    → **Quitar `amazonses.com` del SPF no rompe absolutamente nada.** Opcionales y sin
    prisa: borrar el TXT `resend._domainkey` y la variable `RESEND_API_KEY` del `.env`.
  - **Lo que NO se toca:** el `MX` de Google, el `mscid` de Microsoft, el DKIM de Google
    (`google._domainkey`) y el `_dmarc`.
  - **Siguiente paso del correo, cuando esto lleve unas semanas estable:** el DMARC está en
    `p=none`. Con el SPF ya correcto y el DKIM de Google firmando, se puede subir a
    `p=quarantine`. No ahora.

- **🧹 LIMPIEZA COMPLETA DE LA ZONA DNS (2026-08-03).** Fernando pasó la lista entera de
  registros. Clasificación, con el porqué de cada uno:

  | Registro | Qué es de verdad | Acción |
  |---|---|---|
  | `MX send → feedback-smtp.sa-east-1.amazonses.com` | Rebotes de Amazon SES = **Resend**. Muerto | 🗑️ **Borrar** |
  | `TXT resend._domainkey` | Firma DKIM de Resend. Muerta | 🗑️ **Borrar** |
  | `CNAME lyncdiscover → webdir.online.lync.com` | **Skype for Business Online**, servicio retirado por Microsoft | 🗑️ **Borrar** |
  | `CNAME sip → sipdir.online.lync.com` | Ídem | 🗑️ **Borrar** |
  | `SRV _sip._tls` y `SRV _sipfederationtls._tcp` | Ídem — federación de Lync | 🗑️ **Borrar** |
  | `A @ → 216.198.79.1` | **Vercel**, con el despliegue borrado: sirve un 404 | 🗑️ **Borrar** (ver nota) |
  | `MX @ → 1 smtp.google.com` | **El correo entrante.** Google Workspace | 🔒 **Intocable** |
  | `TXT google._domainkey` | **DKIM de Google.** Hoy es lo único que hace pasar el DMARC | 🔒 **Intocable** |
  | `TXT _dmarc` | La política DMARC | 🔒 Conservar |
  | `TXT @` SPF | Ya corregido | 🔒 Conservar |
  | `TXT gmail-conection → google-site-verification=…` | **Verificación de propiedad ante Google.** Borrarla puede desverificar el dominio | 🔒 Conservar |
  | `CNAME xpsfz52om5hi → gv-….dv.googlehosted.com` | Otra verificación de Google (prefijo `gv-`) | 🔒 Conservar |
  | `CNAME app → cndr3q54.up.railway.app` | La plataforma **y lo que Meta tiene declarado** | 🔒 Intocable |
  | `CNAME www → o8b57xou.up.railway.app` | El sitio público | 🔒 Intocable |
  | `TXT _railway-verify.www` | Verificación de Railway | 🔒 Conservar |
  | `CNAME enterpriseregistration`, `selector1/2._domainkey` | Azure AD y DKIM de Microsoft. Inertes (no se envía por Microsoft) | ⬜ Da igual; dejarlos |
  | Sección **Microsoft Exchange** en «Error»: `MX @ → outlook`, `CNAME autodiscover`, `CNAME enterpriseenrollment` | Son lo que el «arreglo automático» quiere meter | ⛔ **Dejar en Error para siempre** |
  | `NS @ → ns1..4.bdm.microsoftonline.com` | Los nameservers. No se pueden cambiar | 🔒 No tocar |

  - **Nota sobre el `A` del apex:** borrarlo deja `grupocc.org` **sin resolver**; dejarlo, lo
    deja sirviendo un **404 de Vercel**. Ninguna de las dos es buena, y **no hay tercera
    opción desde aquí**: el DNS de Microsoft no hace redirecciones HTTP, y apuntar el apex a
    la IP de Railway **sería un error** —Railway no garantiza esa IP y el certificado no
    cubriría ese nombre—. Se borra porque al menos **elimina la dependencia de una cuenta de
    Vercel que no controlamos**. El arreglo de verdad —que `grupocc.org` redirija a `www`—
    **necesita transferir el dominio** fuera de Microsoft.
  - **🔎 PISTA PARA PS4 (Search Console):** existe un `google-site-verification` en la zona.
    Puede ser de Google Workspace **o de Search Console**. Hay que mirar si ya hay propiedad
    creada antes de crear otra.
  - **Propagación:** al comprobar con `dig` justo después, el SPF viejo seguía en caché (TTL
    de 1 hora). El panel ya lo daba por aplicado. Normal; se vuelve a medir más tarde.

#### PS2 — ¿Por qué búsquedas quiere aparecer, y para vender qué? · ✅ Resuelta (Fernando, 2026-08-03)
- **Respuesta:** **el proyecto de desarrollo humano.** No el agente de WhatsApp, ni el
  software a medida, ni la facturación. Lo que quiere que se encuentre es **el GCC en sí**.
- **Lo que eso significa, y es una estrategia distinta de la que yo tenía en la cabeza:**
  - **«Condiciología» es un término que inventó Fernando.** Nadie más compite por él: el
    resultado nº 1 hoy ya es suyo (el sitio viejo). Posicionar nº 1 ahí no es difícil, es
    **cuestión de que la página exista y funcione**. Lo que no tiene es volumen: nadie busca
    una palabra que no conoce. Sirve para **retener** a quien ya oyó el término, no para
    traer gente nueva.
  - **«Desarrollo humano» sí tiene volumen y es amplísimo** — compiten universidades, la
    ONU y el PNUD (el Índice de Desarrollo Humano se come el término). Competir por la
    palabra sola es perder. Se gana por **la cola larga**: las preguntas concretas que hace
    quien busca crecer, no la etiqueta.
  - **⚠️ Consecuencia sobre el orden de trabajo:** la página del proyecto de desarrollo
    humano es **`/recursos`**, no `/negocio`. `/negocio` es la comercial. → pregunta PS8.
- **Consecuencia sobre el resto:** el agente de WhatsApp y los demás servicios **no
  desaparecen** del SEO; pasan a segundo plano y se posicionan desde `/negocio`.

#### PS3 — ¿Hasta dónde llega el territorio: Guayaquil, Ecuador o fuera? · ✅ Resuelta (Fernando, 2026-08-03)
- **Respuesta:** **Latinoamérica / cualquier país hispanohablante.** Sin anclaje geográfico.
- **Qué cambia:** encaja con PS2 —un proyecto de desarrollo humano no se busca por ciudad—,
  pero es el escenario **más difícil**: se compite contra todo el continente y **no aplica**
  el atajo del SEO local (Perfil de Empresa de Google, ciudad en los titulares).
- **⚠️ Y choca con una cosa que sí es local:** los **servicios** sí son ecuatorianos —la
  facturación con el SRI no se le vende a un mexicano—. Se resuelve por página: `/recursos`
  sin territorio, `/negocio` con Ecuador donde toca. El `areaServed: 'EC'` del JSON-LD de
  `/negocio` se queda; el de `/recursos` se abre.

#### PS10 — «Busco Grupo Corazones Cruzados y no sale mi web» · 🔎 Abierta — mi medición NO era válida
- **⛔ CORRECCIÓN (2026-08-03): NO PUEDO MEDIR POSICIONES EN GOOGLE, y afirmé que sí.**
  Dije que `www.grupocc.org` salía **cuarto** al buscar el nombre. **Ese dato no vale.** Mi
  herramienta de búsqueda **no es Google**: es otro índice, y además con sesgo de Estados
  Unidos. Fernando, buscando desde Ecuador, **no encuentra el sitio** — solo ve
  `corazonescruzados.org`, que es otro negocio. **Su observación manda sobre la mía.**
  - Por el mismo motivo, el resultado nº 1 en «condiciología» que reporté antes tampoco
    prueba nada sobre Google: puede ser un rastreo antiguo de ese otro índice.
  - **Hipótesis de trabajo a partir de ahora: el sitio NO está indexado en Google.** Es la
    suposición prudente y la que lleva a hacer lo correcto.
  - **Cómo se sabe de verdad, y son las únicas dos formas:**
    1. Buscar en Google `site:grupocc.org`. Si no sale nada, no está indexado. Es la prueba
       rápida y la puede hacer Fernando en diez segundos.
    2. **Google Search Console** — la fuente oficial: qué URLs conoce, cuáles rechazó y por
       qué. Sin esto se trabaja a ciegas, y es lo que hay que montar ya.
  - **Lección de método:** una herramienta de búsqueda genérica sirve para **descubrir
    hechos** (que existe `corazonescruzados.org`, que hay una ficha de LinkedIn), **no para
    medir posiciones**. Para posiciones, Search Console o nada.
- **✅ RESPUESTA DEFINITIVA (2026-08-03), y es la peor y la más limpia a la vez:**
  `site:grupocc.org` → **«No se han encontrado resultados»**.
  `site:app.grupocc.org` → **«No se han encontrado resultados»**.
  **Google no tiene una sola página de ninguno de los dos dominios.** No es que estemos
  mal posicionados: **no existimos para Google.** Se parte de cero absoluto.
- **🔎 Y NO ES QUE ALGO LO BLOQUEE — comprobado uno por uno contra el sitio en vivo:**

  | Comprobación | Resultado |
  |---|---|
  | `<meta name="robots">` | `index, follow` ✅ |
  | Cabecera `X-Robots-Tag` | no existe ✅ |
  | `robots.txt` | `Allow: /`, solo bloquea panel/API/sesión ✅ |
  | HTML servido | completo, con título y encabezados ✅ |

  → **La puerta está abierta. Google simplemente nunca ha venido.**
- **La causa es el DESCUBRIMIENTO, no la técnica.** Google rastrea lo que encuentra
  enlazado o lo que se le envía. `app.grupocc.org` lleva **meses** en pie y tiene **cero**
  páginas indexadas: nadie lo enlaza desde fuera y nunca se dio de alta en Search Console.
  Un dominio que nadie enlaza y nadie envía es un dominio invisible, por bueno que sea.
- **La única lectura buena de esto:** partir de cero significa que **no hay nada que
  deshacer** — ni penalizaciones, ni contenido viejo compitiendo, ni redirecciones sucias.
- **➡️ ORDEN DE ACCIONES (importa, no es una lista suelta):**
  1. **Desplegar el cambio de dominio canónico.** Hasta que no se suba, el `sitemap.xml` y
     el `robots.txt` en producción siguen declarando `app.grupocc.org` — comprobado en vivo:
     `Sitemap: https://app.grupocc.org/sitemap.xml`. **Enviar el mapa antes de desplegar
     sería pedirle a Google que indexe el dominio equivocado.**
  2. **Search Console, propiedad de tipo «Dominio»** (no «prefijo de URL»): cubre
     `grupocc.org` y **todos** sus subdominios de una vez, y se verifica **con un registro
     TXT**, que es justo lo que Fernando puede añadir en Microsoft 365.
  3. **Enviar el mapa del sitio** `https://www.grupocc.org/sitemap.xml`.
  4. **Solicitar indexación** de `/`, `/negocio`, `/recursos` y `/contacto` una por una
     (Inspección de URLs → Solicitar indexación).
  5. **El enlace desde LinkedIn**, que es la vía por la que Google descubre dominios nuevos
     sin esperar.
- **Lo que sí sigue siendo cierto y él mismo confirma:** el nombre **no es exclusivo** —
  `corazonescruzados.org` es otra organización real y hoy es la que se ve.
- ~~Causas probables de que no esté indexado:~~ (resueltas arriba, se conservan por histórico)
  1. **El sitio nuevo lleva horas vivo.** Google no lo ha vuelto a rastrear. No hay nada roto.
  2. **Nadie le ha dicho a Google que existe.** Sin Search Console, sin mapa del sitio
     enviado y **sin enlaces externos** apuntando al dominio, el rastreo tarda semanas.
  3. **El nombre no es exclusivo.** Compiten `corazonescruzados.org` (una asociación civil
     real, apoyo a niños con cáncer), Instagram, Vimeo y hasta **un libro en Amazon**
     titulado *Corazones Cruzados*. Aparecer nº 1 por ese nombre **hay que ganarlo**.
- **Lo más rentable que se puede hacer hoy, y no es código:** la ficha de **LinkedIn ya sale
  nº 1 y nº 3 por el nombre**. Poner ahí el enlace a `www.grupocc.org` hace que Google
  descubra el sitio por una página que ya rastrea a menudo, y le pasa autoridad. Vale más
  que cualquier ajuste técnico de esta semana.
- **En código:** añadir `sameAs` al JSON-LD de `Organization` con LinkedIn, Vimeo e
  Instagram, para decirle a Google que **todos son la misma entidad**.

#### PS11 — «No se ha podido obtener» el sitemap en Search Console · ✅ Diagnosticado el 2026-08-03
- **Falsa alarma.** Comprobado desde fuera, el archivo es impecable:

  | Prueba | Resultado |
  |---|---|
  | `GET /sitemap.xml` | **200**, `content-type: application/xml` |
  | Con `User-Agent` de **Googlebot** | **200** — no hay bloqueo por agente |
  | Redirecciones | **0** |
  | `robots.txt` como Googlebot | **200** |
  | Tiempo de respuesta (3 medidas) | **0,29 s** de media |

- **La pista que lo explica: «Última lectura» está VACÍA.** Google **no ha intentado
  leerlo todavía**. Ese rojo no es un diagnóstico del archivo, es el estado inicial de un
  sitemap recién enviado en una propiedad recién creada. Se resuelve solo en 24-48 h.
- **⚠️ Lo que NO hay que hacer: reenviarlo ni borrarlo.** Reenviar reinicia la cola y
  retrasa el rastreo en vez de acelerarlo.
- **Segunda batería de pruebas (2026-08-04), porque Fernando volvió a preguntar.** Descartadas
  todas las causas clásicas de «no se ha podido leer el sitemap»:

  | Sospecha | Resultado |
  |---|---|
  | **BOM** o basura antes de `<?xml` | Los primeros bytes son `3c3f 786d 6c` = `<?xml` **limpio** ✅ |
  | XML mal formado | `xmllint --noout` **válido**, 968 bytes, 6 `<loc>` ✅ |
  | Codificación | ASCII / UTF-8 ✅ |
  | Solo habla HTTP/2 | `--http1.1` → **200** ✅ |
  | Falla comprimido | `Accept-Encoding: gzip` → **200** ✅ |
  | No responde a `HEAD` | **200** ✅ |

  **El archivo no tiene ni un fallo.** Queda confirmado que es el estado pendiente de Search
  Console.
- **Y el argumento que zanja la preocupación, del propio documento de Google que trajo
  Fernando:** *«enviar un sitemap es tan solo una recomendación: no garantiza que Google lo
  descargue ni que lo utilice para rastrear URLs del sitio»*. Además hay **dos canales más**
  ya abiertos que no dependen de él: la línea `Sitemap:` del `robots.txt` y la solicitud de
  indexación por Inspección de URLs.
- **Detalle menor detectado y NO corregido a propósito:** el `<loc>` de la portada va sin
  barra final (`https://www.grupocc.org`). Google lo normaliza y la propia página no declara
  `canonical`, así que no hay contradicción. Tocarlo tendría más riesgo que beneficio.
- **El sitemap no es un requisito, es un atajo.** La indexación puede ocurrir entera por
  **Inspección de URLs → Solicitar indexación**, que no depende de él. Y ahí está además el
  diagnóstico de verdad: **«Probar URL publicada»** hace que Googlebot descargue la página
  **en vivo** y enseña exactamente lo que ve.
- **❌ FALSA ALARMA MÍA — «EL CONTENEDOR SE DUERME». ERA MI PROPIO ORDENADOR (2026-08-04).**
  Vi que la primera petición tras un rato de silencio tardaba 6-9 s, lo diagnostiqué como
  arranque en frío de Railway y **mandé a Fernando a desactivar el App Sleeping**. No era
  eso. Al desglosar el tiempo con `curl`, todo estaba en el primer tramo:

  ```
  1ª tras 100 s:  dns=6,39s  conexión=6,45s  tls=6,52s  PRIMER_BYTE=6,66s
  2ª inmediata:   dns=0,004s conexión=0,15s  tls=0,22s  PRIMER_BYTE=0,37s
  ```

  **Los 6,4 segundos eran la resolución DNS**; la conexión se abría 0,06 s después y el
  servidor contestaba en 0,14 s más. Un archivo estático de `_next` tardó lo mismo, con el
  mismo reparto: el servidor nunca estuvo en la ecuación.

  Y midiendo **quién** tarda en resolver:

  | Resolutor | Tiempo |
  |---|---|
  | **8.8.8.8 — el de Google** | **0,12 s** |
  | 9.9.9.9 · 1.1.1.1 | 0,14 s · 0,34 s |
  | Los nameservers de Microsoft, directos | 0,10 – 0,21 s |
  | **El resolutor de mi máquina** | **2,15 s** (y 6,4 s desde `curl`) |

  → **El sitio está sano**: resuelve en 120 ms para Google y responde en 0,3 s.
  - **Consecuencia práctica:** el App Sleeping se desactivó sin motivo. Puede volver a
    activarse si le sube la factura — no hay evidencia de que hiciera daño.
  - **⛔ LECCIÓN, y es la que vale:** `time_starttransfer` **no es «lo que tarda el
    servidor»**: incluye DNS, conexión y TLS. Medí el total y acusé al último eslabón sin
    desglosarlo, cuando el culpable era el primero y estaba en mi mesa. **Antes de culpar a
    una infraestructura ajena, desglosar el tiempo y contrastar el resolutor propio contra
    `@8.8.8.8`.** Dos segundos de `dig` habrían evitado un cambio de configuración inútil en
    producción.

#### ⛔ REGLA DE MÉTODO PARA ESTE OBJETIVO — EL DISEÑO SE VE CON FERNANDO ANTES (2026-08-03)

Textual: *«no hagas nada en la página de negocio, no quiero que hagas el diseño por tu
cuenta porque tengo que ver contigo el diseño específico de esa página y todas otras»*.

**Manda sobre PS8 y sobre cualquier plan de contenido de este documento.** El trabajo del
sitio público se parte en dos, y solo una mitad es mía por iniciativa propia:

| | Qué incluye | Quién decide |
|---|---|---|
| **Fontanería** | Metadatos, `canonical`, mapa del sitio, `robots`, JSON-LD, dominio, rendimiento, accesibilidad, imagen al compartir | Propongo, hago y aviso |
| **Diseño y contenido visible** | Encabezados, secciones nuevas, textos, maquetación, qué se cuenta y en qué orden | **Fernando, conmigo, antes de escribir una línea** |

**Y no vale «te dejo una propuesta ya montada en el código».** Quiere verlo **antes de que
exista**. Todo lo de «reescribir la jerarquía de encabezados», «desarrollar el texto de cada
servicio», «añadir preguntas frecuentes» y «una URL por servicio» del plan de abajo **queda
en suspenso** hasta que lo acordemos.

**Es el mismo patrón que la regla del arte** (§ arriba, las imágenes las evalúa solo él):
cuando el criterio de aceptación es **lo que él quiere presentar**, el juez es él.

#### PS8 — ¿Empezamos por `/negocio` o por `/recursos`? · ⏸ ANULADA por la regla de arriba (2026-08-03)
*(Se conserva por histórico. Ya no la decido yo: el orden y el enfoque salen de la revisión
de diseño con Fernando.)*

#### PS8 (histórico) — ¿Empezamos por `/negocio` o por `/recursos`? · ~~Resuelto por decisión propia~~
- **Por qué se preguntaba:** él pidió empezar por `/negocio`, pero al elegir «el proyecto de
  desarrollo humano» como lo que quiere posicionar, la página que lleva ese contenido es
  **`/recursos`**.
- **Decisión, tras preguntarlo cuatro veces sin respuesta: se empieza por `/negocio`**, que
  es lo que pidió textualmente al abrir el objetivo. No hay contradicción real:
  - La elección de PS2 marca **qué palabras se persiguen**, no **qué página se toca antes**.
  - `/negocio` **ya abre con el encuadre de desarrollo humano** («Primero las personas. Lo
    demás sale de ahí.»), así que es coherente con lo que quiere posicionar.
  - `/recursos` es la siguiente, y es la que cargará el peso de «condiciología», «Modelo 4P»
    y «desarrollo humano».
- **Si Fernando lo corrige, se cambia el orden sin coste**: el contenido vive en
  `lib/sitio/contenido.ts` y las piezas en `components/sitio/piezas.tsx`; nada de lo que se
  haga para una página se tira al pasar a la otra.

#### PS9 — ¿De quién es el despliegue de Vercel que tiene hoy `grupocc.org`? · ⏸ Bloqueada (2026-08-03)
- **Por qué importa:** el apex apunta a una cuenta de Vercel con un despliegue borrado. Para
  llevar el dominio a Railway hay que **quitar ese registro A**, y para eso hace falta saber
  si esa cuenta es suya y si hay algo ahí que conservar (el contenido del sitio viejo que
  Google todavía indexa vale oro: son los textos que ya posicionan).
- **Respuesta:**

#### PS4 — ¿Existe Google Search Console / Analytics para el dominio? · ⏸ Bloqueada
- **Por qué importa:** sin Search Console no hay forma de saber si Google indexó nada ni por
  qué consultas aparece; y la verificación se hace con una etiqueta en el `metadata`, que es
  código de este repo.
- **Respuesta:**

#### PS5 — Los dos huecos a propósito: ¿qué clientes autorizan aparecer y cuáles son los vídeos? · ⏸ Bloqueada
- **Por qué importa:** `CLIENTES` y `VIDEOS` están vacíos y sus secciones **no se pintan**.
  Un cliente real con nombre es la prueba de credibilidad más fuerte que puede tener la
  página, y para Meta también.
- **Respuesta:**

#### PS6 — El diseño actual, ¿se conserva o se rehace? · ✅ Resuelta (Fernando, 2026-08-03)
- **Respuesta:** **se conserva y se amplía.** Se trabaja dentro del lenguaje visual que ya
  existe (`components/sitio/piezas.tsx`) y **las piezas nuevas se añaden ahí**, no sueltas
  dentro de una página. Documentado como estándar en `Diseño.md` → sección "Sitio público".

#### PS7 — ¿Se puede mover el candado del `/negocio` que revisa Meta? · 🔎 Investigando
- **Por qué importa:** `/negocio` está declarada a Meta como la web del negocio y su sección
  de identidad legal **no puede faltar** (ya se perdió una vez, `b8a70fd`). Cualquier
  rediseño de esa página tiene que conservarla, y si además se cambia de dominio (PS1) hay
  que actualizar la URL declarada en Meta antes de que caduque la revisión.
- **Respuesta parcial (del propio repo):** la restricción es real y está documentada en el
  comentario de `app/(sitio)/negocio/page.tsx` (líneas 209-215). Se respeta pase lo que pase.

### ✅ CIMIENTOS TÉCNICOS — hechos el 2026-08-03

| Qué | Dónde | Por qué |
|---|---|---|
| Dominio canónico `www.grupocc.org` | `lib/sitio/contenido.ts` | Commit `e2a1b90`, **desplegado y verificado en producción** |
| **Imagen de Open Graph** generada | `app/opengraph-image.tsx` (nuevo) | `openGraph` no llevaba `images`: al pegar un enlace salía una tarjeta gris. Se **dibuja** con `next/og` desde `contenido.ts` en vez de ser un `.png` que haya que rehacer a mano |
| **Zoom permitido en el sitio público** | `export const viewport` en `app/layout.tsx` + sobrescritura en `app/(sitio)/layout.tsx` | El `<meta viewport>` estaba **a mano en el `<head>`** con `user-scalable=no`. Tiene sentido en el juego, no en una página de leer. Como export sí se puede sobrescribir por ruta; como etiqueta a mano saldrían dos `<meta>` peleándose. **Los valores de la raíz son idénticos a los de antes: el juego no cambia** |
| **Fechas reales** en el mapa del sitio | `app/sitemap.ts` (`ULTIMO_CAMBIO`) | Llevaba `new Date()`, así que **cada despliegue juraba que las seis páginas habían cambiado**. Una fecha que siempre dice «hoy» deja de ser señal |
| **`sameAs`** con LinkedIn, Instagram y Facebook | `REDES` en `contenido.ts` → los 3 JSON-LD | Le dice al buscador que la web y los perfiles **son la misma organización**. Con un nombre tan repetido, deshace justo la confusión que hoy hace que se vea `corazonescruzados.org` y no a nosotros |

- **⚠️ Gotcha del `sameAs`:** Fernando pasó la de LinkedIn como
  `/company/91638038/admin/dashboard/`, que es **su panel de administración** — pide sesión,
  así que un buscador solo vería una pantalla de acceso. Se usa la **pública**
  (`/company/grupo-corazones-cruzados/`). Las tres comprobadas: **200 sin sesión**.
- **Gotcha de `next/og`:** lo dibuja Satori, que **no es un navegador**. Solo flexbox y un
  subconjunto de CSS; todo `div` con más de un hijo necesita `display: flex` explícito y no
  hay `gap` fiable. De ahí los márgenes a mano.
- Verificado: `npx tsc --noEmit` limpio y `npm run build` correcto.

- **⚠️ LECCIÓN — DOS DE LOS CUATRO CAMBIOS NO SURTIERON EFECTO, Y SOLO SE VIO MIDIENDO
  PRODUCCIÓN (2026-08-04).** `tsc` limpio, `build` correcto, desplegado… y al comprobar el
  HTML servido, el zoom seguía bloqueado y tres páginas seguían sin imagen. **Next hereda de
  dos maneras opuestas y yo di por hecho una sola:**

  | | Cómo hereda | Qué falló |
  |---|---|---|
  | `viewport` | **Se fusiona campo por campo** | El sitio público solo declaraba `width` e `initialScale`, así que `maximumScale: 1` y `userScalable: false` **seguían bajando de la raíz**. Hay que anular cada campo **explícitamente** |
  | `openGraph` | **Se sustituye entero** | Las tres páginas declaran el suyo con su título; al no llevar `images`, **perdían** la imagen de `app/opengraph-image.tsx` que sí tenía la portada. Hay que **nombrarla** en cada una |

  - Corregido en `0d5b87d` y **verificado contra producción**: `/negocio` sirve
    `maximum-scale=5, user-scalable=yes`, la portada sigue en `maximum-scale=1,
    user-scalable=no` (el juego intacto), y las tres páginas ya traen `og:image`.
  - **Generalización, que es lo que vale:** *compila* y *funciona* son cosas distintas, y
    con los metadatos de un framework la única prueba es **`curl` al HTML servido**. Es la
    misma familia de la regla de `gcc-tsc-no-basta`, aplicada al `<head>`.

### 🟢 SEARCH CONSOLE — el veredicto de Google (2026-08-03)
- **Prueba en tiempo real de `/negocio`: «La URL está disponible para Google» ✅ «La página
  se puede indexar» ✅.** Es la confirmación definitiva: **técnicamente no hay nada que
  arreglar**.
- **En el índice: «La página no está indexada: Google no reconoce esta URL»**, con
  `Último rastreo: N/D`. Y las dos líneas que lo explican todo:
  - *«Sitemaps: no se ha detectado ningún sitemap de referencia»* → el mapa aún no se ha
    leído (coherente con PS11).
  - *«Página de referencia: no se ha detectado ninguna»* → **cero enlaces entrantes**. Es
    Google diciendo, con sus palabras, que nadie enlaza el sitio. Confirma que el cuello de
    botella es el **descubrimiento**.
- **Acción:** «Solicitar indexación» de las cuatro páginas + el enlace desde LinkedIn.
- **Las tres condiciones que Google dice que la prueba NO comprueba**, contrastadas contra
  nuestro caso (2026-08-03):

  | Condición | Nuestra situación |
  |---|---|
  | Sin acciones manuales ni problemas de seguridad | Dominio recién estrenado, sin historial. **Se confirma en un clic**: Search Console → «Seguridad y Acciones manuales» |
  | No ser duplicado de otra página indexada | **Ya resuelto**: la misma aplicación se sirve en `www` **y** en `app.grupocc.org`, así que las dos servían `/negocio`. El `canonical` desplegado en `e2a1b90` apunta desde ambas a `www`, que es exactamente lo que Google pide |
  | **«Calidad suficiente»** | La única que no se arregla con fontanería. Es criterio de Google sobre el contenido, y hoy las páginas son tarjetas con viñetas de una línea. **Es justo lo que resolvería el trabajo de diseño y contenido — que ahora depende de Fernando** |

- **Dato útil del propio documento de Google:** *«la mejor opción para indexar muchas páginas
  es enviar un sitemap con las páginas marcadas con `<lastmod>`»*. Es literalmente lo que se
  hizo en `5defe52` al cambiar `new Date()` por fechas reales — **pero ese commit está sin
  publicar**, así que el `<lastmod>` que Google ve sigue siendo el falso.

### ✅ `/negocio`, REHECHA CON FERNANDO (2026-08-04)

Primera página de contenido acordada con él, ya bajo la regla de «el diseño se ve conmigo
antes». Lo que salió, y lo que enseñó:

| Decisión suya | Lo que aporté |
|---|---|
| Quitar el titular de marca y poner cinco tarjetas | Le advertí de que la página se quedaba **sin `<h1>`** y dictó uno |
| Primero una tira deslizante; luego, «que se repartan según el espacio» | `flex-wrap` centrado, **no `grid`**: la última fila se centra sola y el reparto no depende de que sean cinco |
| URLs por tarjeta | Le ofrecí **nombres frente a números** y eligió nombres. Es lo correcto: la URL que dice de qué va cuenta en el buscador y al compartir |
| Vaciar todo lo de debajo, identidad legal incluida | **Le paré antes de tocar**: es la URL declarada a Meta y ya se rechazó una vez. Decidió quitarla y **queda con dueño y fecha** en la cabecera del archivo |
| FAQs con tres paneles en el admin | Reusé el patrón «Explorador Azure» en vez de escribir otro; y saqué el `FAQPage`, que es lo que de verdad puede rendir en Google |

- **⚠️ LA LECCIÓN TÉCNICA DE LA JORNADA — «no funciona» hay que demostrarlo.** Vi que al
  pulsar una tarjeta la página se quedaba a 306 px cuando el detalle estaba a 588, lo di por
  roto y **escribí un componente de cliente para arreglarlo**. Midiendo después:
  `scrollFinal === scrollMáximoPosible` en las dos ventanas probadas. **306 era el fondo de
  la página**: el detalle aún no tiene contenido y no había más recorrido. El componente
  sobraba y se quitó.
  - Es **el mismo error de método** que el del «contenedor que se duerme», el mismo día: dar
    por diagnosticado un síntoma sin aislar la causa. Dos veces en una jornada.
  - **Regla:** antes de añadir código que corrige un comportamiento, **demostrar que el
    comportamiento es incorrecto** — no que se ve raro.

### Plan de solución (borrador — se concreta al cerrar PS1, PS2 y PS6)

1. **Cimientos técnicos** (no dependen de las respuestas, se pueden hacer ya): imagen de
   Open Graph, quitar `user-scalable=no`, `lastModified` con fechas reales, hueco para la
   verificación de Search Console.
2. **`/negocio`**: reescribir jerarquía de encabezados con las palabras de PS2, desarrollar
   el texto de cada servicio, añadir preguntas frecuentes con `FAQPage`, migas de pan con
   `BreadcrumbList`.
3. **Una URL por servicio** bajo `/negocio/<servicio>`, generadas desde `SERVICIOS` para que
   siga habiendo una sola fuente de contenido.
4. **La portada**: que el HTML servido diga quién es la empresa aunque la experiencia siga
   siendo el pixel art. Es el fallo nº 1 y probablemente merezca objetivo propio.
5. `/recursos` y `/contacto` después, con el mismo método.

### Riesgos

- **Romper la verificación de Meta** al tocar `/negocio` o al cambiar de dominio → la
  sección de identidad legal se conserva siempre y el cambio de dominio se coordina con la
  revisión.
- **Escribir para el buscador y perder la voz.** La corrección de Fernando del 2026-08-02
  ya fue exactamente esto al revés: el sitio se había escrito mirando a un revisor de Meta y
  presentaba al GCC como proveedor de tecnología en vez de como proyecto de desarrollo
  humano. **El SEO se mete dentro de lo que Fernando quiere decir, no encima.**
- **Prometer lo que no se puede medir.** Aparecer primero en Google no depende solo del
  código; se puede dejar la web impecable y tardar meses en posicionar. Lo que sí se
  garantiza es que nada del lado técnico lo impida.

---

## Objetivo ANTERIOR (declarado 2026-08-01) — FLUJO "AGENTE IA": GCC como PROVEEDOR DE TECNOLOGÍA de WhatsApp (coexistencia, multi-tenant) · ✅ 99% — TODO PROBADO CON WHATSAPP REAL; solo falta que Meta apruebe el App Review

### ⏱️ Estado al 2026-08-03 (fin de la jornada)

**Lo que se cerró hoy, y todo comprobado contra la API/base reales:**

| Pieza | Estado |
|---|---|
| Negocio verificado en Meta | ✅ aprobado tras tres intentos |
| Cadena completa con WhatsApp real | ✅ número de prueba `+1 555-666-6709` en el canal 33 |
| `whatsapp_business_management` | ✅ llamadas de prueba **Completado** |
| `whatsapp_business_messaging` | ✅ llamadas de prueba **Completado** |
| `public_profile` | ✅ `GET /me?fields=id,name` hecho (no requería) |
| Video del envío | ✅ grabado por Fernando |
| Video de la plantilla | ⏳ pendiente de grabar |
| Cuenta del revisor | ✅ `revisor.meta@grupocc.org`, ve **solo** el flujo 23 |
| Instrucciones del formulario | ✅ `app-review-instrucciones.txt`, campo por campo |

⚠️ **Cada prueba de la API solo vale 30 días.** Las de hoy caducan el **2 de septiembre de
2026**; si la solicitud se envía después, hay que repetirlas.

**Lo que se construyó hoy, más allá del alta:**
1. **Modelo de accesos por flujo** — responsable + clientes (`lib/flows/acceso.ts`). Tapó
   un agujero real: cualquiera con sesión veía todos los flujos.
2. **Pestaña de Plantillas** — crear, sincronizar con Meta, y enviar a listas de contactos
   reutilizando las del correo masivo. Es además la mejor evidencia del permiso de
   *management* para el revisor.
3. **Una puerta de acceso por tipo de cuenta** (`/auth/{cliente,miembro,candidato}`).

**Lo que queda, en orden:**
1. Grabar el video de la plantilla (`whatsapp_business_management`).
2. Enviar el App Review con los textos de `app-review-instrucciones.txt`.
3. Cuando aprueben: apagar `sin_doble_factor` del revisor, dar de alta el número de Peters
   Tours por Embedded Signup, y **comprobar con el cliente que su equipo sigue entrando a
   WhatsApp Web** — la única prueba válida de que la coexistencia quedó bien.
4. Migrar `EmailFlowWorkspace` a `PanelListasContactos` (hoy tiene su propia copia).
5. Rellenar los tres bloques de conocimiento vacíos del agente de GCC: `horario_atencion`,
   `servicios_empresas`, `cambios_reclamos`.

### 🧠 Las cinco lecciones de método de esta jornada

1. **`tsc` + `build` limpios no significan nada sobre el comportamiento.** Los tres fallos
   más caros del día —`fallbacks` no soportado, la restricción que no conocía `'plantilla'`,
   y el `NONE`— solo aparecen **llamando de verdad** a la API o a la base.
2. **Comprobar las CABECERAS, no el código de estado.** Un `200` puede ser HTML cacheado de
   hace dos despliegues (`x-nextjs-cache: HIT`). El arreglo estaba publicado y era
   invisible.
3. **Equivalente no es igual.** Escribir un control «parecido» al que ya existe se nota en
   cuanto alguien pone las dos pantallas juntas — pasó dos veces hoy (plantillas y acceso).
   Se usa el componente, o se extrae y se comparte.
4. **El orden de las comprobaciones es parte del diseño.** La exención del segundo factor
   puesta debajo del `validateOnly` no se ejecutaba nunca por el camino que importaba.
5. **Diagnosticar de más es tan malo como de menos.** Di el `NONE` por explicación del
   «error raro al enviar» y me quedé corto: eran dos fallos distintos, y el real —el que
   dejaba los mensajes fuera de la bandeja— seguía ahí.

**Rol asumido:** *arquitecto de integraciones + backend multi-tenant* — el problema no es "hacer un
bot", es montar la **infraestructura de proveedor ante Meta** y el aislamiento por cliente. La parte
de IA ya está resuelta en otro proyecto; lo que no está resuelto es la plataforma.

### Necesidad (palabras del usuario, 2026-08-01)
> "Necesito que en el módulo de automatizaciones empecemos a trabajar en el **tipo de flujo de agente
> IA**. Este flujo va a requerir una **infraestructura de Meta previa** para que el Grupo Corazones
> Cruzados sea un **proveedor de tecnología**. He llegado a esta conclusión debido al caso que estuve
> desarrollando de un proyecto. Ya quiero dar el servicio para los clientes y así **no tengo que crear
> un servicio web por cliente**: que el mismo GCC ofrezca el servicio y los clientes usen **nuestra
> app** para conectar sus números de WhatsApp Business y tener el agente IA funcionando **con
> coexistencia**."

### Fuente principal recibida
- **`guia-coexistencia-proveedor.html`** (raíz del repo, 2026-08-01). Traspaso técnico completo del
  agente de WhatsApp **que ya funciona en producción** dentro del sistema contable de **Peters Tours
  S.A.** (otro repo: `Grupo-Corazones-Cruzados/GCC---Sistema-de-Facturaci-n`, Railway proyecto
  `Servidor-Diego`). Contiene arquitectura medida, identificadores de Meta, el paso a paso del alta en
  coexistencia, y las lecciones/errores de dos días de puesta en marcha.
  **No es teoría: es un sistema verificado el 2026-08-01** (18 trabajos en cola, 0 errores; respuesta
  en 2–3 s; ~0,2 ¢ por mensaje).

### Lo que el documento deja CERRADO (no re-litigar)
1. **La app de Meta pertenece al portafolio de GCC** (`1000698870638078`), no al del cliente.
   Un portafolio **no puede darse de alta a sí mismo** por Embedded Signup ("This business portfolio
   owns [app]. You can only select other business portfolios"). Proveedor y cliente **tienen que ser
   portafolios distintos**. Esto se decide **al crear la app** y no se cambia después.
2. **Coexistencia** = el número vive **a la vez** en la app de WhatsApp Business del teléfono y en la
   Cloud API. Es la propuesta de valor ("no pierdes tu número ni tu WhatsApp de siempre"). **Solo se
   activa por Embedded Signup**, flujo *onboarding business app users*. No hay botón ni endpoint.
   ⚠️ `platform_type: CLOUD_API` **no** prueba coexistencia: eso se comprueba abriendo WhatsApp Web.
3. **API oficial de Meta, NO un BSP.** Reafirmado por el cliente el 2026-08-01, "ni como plan B".
   → **Consecuencia para este repo:** el tipo `chatbot` actual va por **YCloud** (BSP). Ver P3.
4. **Un solo nodo de IA con TRES herramientas** (`responder` / `no_responder` / `escalar_a_humano`),
   `tool_choice: "any"`, **sin bucle de tool-use**. Las cadenas de clasificadores dieron falsos
   positivos. Las herramientas **son** la decisión, no devuelven información.
5. **El conocimiento entra COMPLETO en el prompt cacheado**, nada de embeddings ni recuperación.
   Con 28.405 caracteres el prefijo cacheado son ~8.241 tokens > mínimo de caché de Haiku (4.096).
6. **El webhook no piensa:** persiste (idempotente por `wa_message_id`), encola con debounce y
   devuelve **200 siempre**. Un 500 hace que Meta reintente y acabe **deshabilitando el webhook**.
7. **Acceso estándar vs avanzado:** el estándar solo sirve con usuarios que **tienen rol en la app**.
   Para dar de alta **clientes** hace falta **acceso avanzado** ⇒ **App Review** + **verificación de
   proveedor de tecnología**. Con GCC como proveedor real eso deja de ser un obstáculo forzado.
8. **Los tokens pasan a la base cifrados.** Cada alta por Embedded Signup devuelve **un token por
   cliente**; la regla "los secretos solo viven en variables de entorno" **no escala a N clientes**.
   Es una decisión de arquitectura consciente, no un atajo.

### El estado REAL de este repo (investigado 2026-08-01, §6 de la skill)
| Pieza | Hoy en GCC World | Veredicto |
|---|---|---|
| Tipo `ai_agent` | **Solo una etiqueta.** `FlowDetail.tsx:144` lo manda al *workspace de correo* (`email · ai_agent · custom`) | **Todo por construir** |
| Tipo `chatbot` | `flow_chatbot_agents/knowledge/qa_lists/qa_items/conversations/messages` + `app/api/webhooks/chatbot/[agentId]/route.ts` | **Es el modelo VIEJO**: BSP YCloud, sin firma, sin cola |
| Tipo `whatsapp` | `WhatsAppFlowPanel` guarda `phone_number_id` + `access_token` **en claro** en `flows.config` (JSONB) | Campañas de plantillas, no conversacional |
| Cifrado de secretos | **No existe** ningún helper (`createCipheriv`/`ENCRYPTION_KEY` → 0 resultados) | **Hay que crearlo** |
| Cron / trabajo diferido | `lib/cron-auth.ts` + `scripts/frequent-cron.mjs` (cada ~10 min) → `/api/admin/flows/cron/send-scheduled` | Sirve de patrón; **10 min es demasiado lento** para chat |
| Migraciones | `sql/migrations/` restaurado, va por **026** | Las nuevas van aquí, numeradas |
| Acceso al dashboard | `middleware.ts` exige JWT staff para `/dashboard`; el cliente **aún no entra** | Bloquea la "bandeja del cliente" |

### Los 4 problemas que el modelo viejo (`chatbot`/YCloud) tiene y el nuevo NO puede heredar
1. **`setTimeout` en memoria del proceso** como debounce (`pendingTimers`, línea 5 del webhook): en
   Railway, un redeploy o un segundo contenedor **pierde el mensaje sin dejar rastro**. El modelo
   probado usa **una tabla `cola`** con índice único parcial + `ON CONFLICT` y `SKIP LOCKED`.
2. **Sin verificación de firma HMAC** (`X-Hub-Signature-256`): cualquiera con la URL puede inyectar
   conversaciones. El modelo probado **rechaza con 403** sin firma.
3. **`ai_api_key TEXT NOT NULL` por agente, en claro.** Guardar claves de terceros en la fila.
4. **Sin idempotencia por `wa_message_id`**: Meta reintenta y el mismo mensaje se procesa dos veces.

### Decisión de arquitectura que se propone (a confirmar con el usuario)
**Un flujo de tipo `ai_agent` = un canal = un número de un cliente.** Es exactamente el "canal" del
sistema probado, y el hallazgo del documento aplica igual aquí: *"un canal = un número y resulta que
un canal es exactamente un tenant"*. Así el aislamiento por cliente sale del modelo de datos, no de
un filtro en cada consulta.

### DÓNDE QUEDÓ AL CERRAR EL 2026-08-01 (20 de 23 pasos)

El tablero vivo es **`plan-agente-ia.html`**; aquí solo el resumen y lo que sigue abierto.

**Hecho y verificado en producción:**
- **Meta (F1–F9):** app `1426486649348985` en el portafolio de GCC, producto WhatsApp,
  configuración básica, Embedded Signup `1070995845869940` con plantilla de 60 días, JSSDK
  habilitado, usuario del sistema con token permanente, **webhook dado de alta y suscrito a
  `messages`** (comprobado contra la Graph API, no de palabra), y las seis variables en Railway.
- **Código (C1–C8):** esquema, cifrado, webhook + cola, runner, Estudio, bandeja, pantalla de
  alta y worker. **Cadena comprobada de punta a punta contra producción:** trabajo encolado →
  recogido por el worker desplegado **en 5 segundos** → runner → escalado correcto → constancia
  en el panel.
- **F13:** servicio `agente-worker` creado y corriendo en Railway, **sin tocar el panel**.
- **F10 + C10:** páginas legales con el rol al derecho (`/legal/whatsapp`) y la retención que hace
  cierto el plazo que prometen. Detalle abajo.
- **SRI:** el nombre comercial `GRUPO CORAZONES CRUZADOS` **ya consta** en el establecimiento 001.
- **Clave de IA de Peters Tours:** guardada y cifrada en su canal.

**Lo que falta:**
| | Quién | Qué |
|---|---|---|
| **F11** | Fernando | ⛔ **BLOQUEA C9.** Verificar el negocio del portafolio de GCC. Comprobado el 2026-08-02: sin la verificación, Meta no permite dar de alta **ningún** número, ni el propio — la ventana abre y responde «no puede registrar clientes en este momento». La suposición de que bastaba tener un rol en la app **era falsa**. |
| **C9** | los dos | El alta del número, en cuanto F11 esté. **Primero de ensayo con el número de GCC** (flujo `lfgonzalezm0`, id 23) y después el de Peters Tours (flujo 10, ya sembrado con sus 14 bloques y 3 prompts). ⚠️ Antes hay que confirmar que el número de ensayo está en **WhatsApp Business**, no en el WhatsApp normal: sin eso no hay coexistencia y el único camino se lleva el número del teléfono. |
| **F10** | Fernando | Solo queda **cambiar las tres URLs** en la configuración básica de la app de Meta, que siguen apuntando a `/legal`. Las páginas ya están publicadas. |
| **F11** | Fernando | Verificar el negocio del portafolio de GCC (nombre legal `GONZALEZ MUYULEMA LUIS FERNANDO`, ver `documentos-negocio/DATOS-NEGOCIO.md`). |
| **F12** | Fernando | App Review + verificación de proveedor de tecnología, para que un cliente pueda darse de alta **por su cuenta**. |

### EL ENSAYO EN SECO ENCONTRÓ AL AGENTE MUDO (2026-08-01) — lo más importante de la sesión

Antes de conectar ningún número se probó el agente **en seco**: preguntas reales por el camino de
verdad (cola → worker desplegado → runner), leyendo lo que habría contestado sin WhatsApp de por
medio. Las **seis preguntas devolvieron 400**:

> `Thinking may not be enabled when tool_choice forces tool use`

**El agente habría estado mudo al 100 %** con un cliente real escribiendo. No una respuesta pobre:
ninguna respuesta. Y no lo caza `tsc`, ni `next build`, ni una prueba contra la base — solo llamar
de verdad a la API.

**La matriz se midió, no se dedujo** (sonda directa contra la API):

| modelo | razonamiento | `tool_choice: any` |
|---|---|---|
| `claude-haiku-4-5` | ninguno | ✅ |
| `claude-haiku-4-5` | `budget_tokens` | ❌ 400 |
| `claude-haiku-4-5` | `adaptive` | ❌ 400 «not supported on this model» |
| `claude-sonnet-5` | `adaptive` | ✅ |
| `claude-opus-5` | `adaptive` | ✅ |

`adaptive` sí convive con forzar herramienta; `budget_tokens` no. Como la herramienta **es** la
decisión, forzarla no es negociable: lo que se cae es el razonamiento, y solo en esa rama.

**Repetido tras el arreglo, 6 de 6 correctas:** saludo → responde; pregunta por un servicio que no
existe («tour a Galápagos») → **dice que no lo ofrecen y reorienta, sin inventarse nada**; pagos y
horario → datos exactos del conocimiento; reclamo → `escalar_a_humano` con el motivo bien redactado;
«necesito hablar con una persona» → escala. Y el caché confirmado: la primera llamada escribió
10.401 tokens y las cinco siguientes los leyeron.

> **Lo que queda como regla:** el ensayo en seco (`scripts/agente-ensayo.mjs`) es la **cuarta
> verificación** del repo, junto a `tsc`, `next build` y la base real. **Ningún número se conecta
> sin pasarlo.** Y ante cualquier duda sobre el contrato de la API, se escribe una sonda que pruebe
> la matriz: deducirlo ha fallado tres veces de tres (mínimos de caché, `effort`, y esto).

### EL ROL LEGAL ES EL REVÉS DEL DE SIEMPRE (F10, 2026-08-01)

Lo que hacía obligatorio F10 no era publicar más texto: era que **el rol estaba invertido**.

- En `/legal`, **GCC es responsable**: decide para qué se tratan los datos de candidatos y miembros.
- En el servicio de WhatsApp, **GCC es encargado** y la **empresa cliente es la responsable**.
  Nosotros no decidimos nada — ejecutamos instrucciones suyas sobre datos de *sus* clientes.

**Por qué dos páginas y no una sección más.** El rol no es un matiz de redacción, es *quién decide*.
Un documento que dijera las dos cosas sería falso en una de ellas, y esto lo lee un revisor de Meta.
Así que `/legal` conserva su rol y ahora **declara su alcance y enlaza** a `/legal/whatsapp`, que
tiene tres partes: **A** privacidad (qué datos, para qué, con quién, cuánto), **B** condiciones del
servicio, **C** anexo de encargo — el contrato que la LOPDP exige entre responsable y encargado.

**Y de redactarla salió un fallo real.** `agente_eventos_webhook` guardaba **sin plazo** una copia
cruda del contenido de los mensajes: un duplicado de `agente_mensajes` que solo sirve para
diagnosticar. Nadie lo había notado porque nada lo miraba.

> **Regla que queda:** primero el código, después la promesa. Escribir «se borra a los 30 días» sin
> un borrado que lo cumpla es publicar algo falso. Se escribió `lib/agente/retencion.ts`, se
> comprobó contra la base real (sembradas filas de 31 y 29 días, murió solo la de 31) y **entonces**
> se publicó la frase.

Las conversaciones, en cambio, **no se purgan por tiempo a propósito**: son el historial de atención
de la empresa, que es la responsable y a quien le corresponde fijar el plazo. Se borran cuando lo
pide y en cascada al desconectar el canal.

### EL FALLO DE LA GUÍA, RESUELTO POR DISEÑO (lo más valioso de la sesión)

En Peters Tours, `reglas_negocio` lleva **escrita a mano** la lista de bloques `[PENDIENTE]`:
«pagos, cambios y reclamos, y horario de atención». El cliente ya rellenó pagos y horario, así
que **el agente escala a una persona preguntas que sabe contestar**, y nadie se entera.

Aquí esa lista **se calcula** del conocimiento (`avisoDePendientes()` en `conocimiento.ts`) y se
inyecta en las reglas al ensamblar el prompt. Si el cliente rellena un bloque, la instrucción de
escalar desaparece sola. Al sembrar Peters Tours se quitó la lista a mano; el cálculo real dice
hoy **solo «cambios y reclamos»**.

Regla general que deja: **un dato derivable no se guarda ni se escribe a mano** — el estado
«sin rellenar» de un bloque, los pendientes del prompt y los avisos del Estudio se calculan
todos, por el mismo motivo.

### CÓMO SE PROBÓ (nada se dio por bueno sin ejecutar)

~150 comprobaciones en total, todas contra la base **real** en transacción con `ROLLBACK`,
verificando el inventario antes y después. Lo que cazaron y no habría cazado ninguna revisión
a ojo: el `ON CONFLICT` sobre índice parcial, `users.name` inexistente, `user.id` en vez de
`userId`, el ayudante exportado desde un `route.ts`, y la burbuja saliéndose de la pantalla.

**Tres herramientas distintas cazan fallos distintos:** `tsc` (tipos), `next build`
(restricciones de Next), y **ejecutar contra la base** (todo lo demás). Ninguna sustituye a las
otras.

### Preguntas y respuestas

#### P1 — ¿Se reescribe el agente desde cero o se porta el de Peters Tours? · ✅ Resuelta — SE PORTA LA ARQUITECTURA
- **Por qué importa:** define semanas de trabajo. El otro repo **no usa el mismo stack**: allí es
  CSS Modules + `pg` directo + `iron-session`; aquí es Tailwind v4 + Prisma/`pg` + `jose`.
- **Respuesta (usuario, 2026-08-01):** *"debemos mantener una sola arquitectura, que sería la
  indicada en el mismo documento, y los mismos parámetros que esperen todos los chatbots que se
  creen a futuro."* ⇒ **la arquitectura del documento es la norma del producto**, no una referencia.
  Se porta la **lógica** (esquema, runner de 3 herramientas, cola, HMAC, ensamblaje del prompt) y se
  reescribe solo la **UI**, que aquí es Tailwind `.corp` y allí CSS Modules.

#### P2 — ¿Qué es el "cliente" de un agente dentro de GCC World? · ✅ Resuelta — v1: SOLO GCC opera
- **Respuesta (usuario, 2026-08-01):** **solo GCC** configura el agente y atiende la bandeja por
  cuenta del cliente. El cliente participa **una sola vez**: cuando conecta su número.
- **Consecuencia buena:** no se toca `middleware.ts` ni la autenticación de cliente al `/dashboard`
  (el pendiente de 2026-06-23 sigue pendiente, pero **deja de bloquear** esta entrega).
- **Consecuencia a no olvidar:** el aislamiento por `flow_id` hay que construirlo **igual de bien
  desde el día uno** — cuando el cliente entre, el modelo de datos ya tiene que estar listo.

#### P3 — ¿El nuevo `ai_agent` reemplaza al tipo `chatbot` (YCloud) o conviven? · ✅ Resuelta — SE ELIMINA
- **Respuesta (usuario, 2026-08-01):** *"no existe chatbot actualmente usado dentro de ese tipo de
  flujo, deberás eliminar el chatbot que está deprecado, y usar solo el agente IA."*
- **Alcance del borrado:** `ChatbotFlowPanel.tsx` · `app/api/webhooks/chatbot/[agentId]/route.ts` ·
  `app/api/admin/flows/[id]/agents/**` · el tipo `chatbot` del selector y de los mapas de tipos ·
  las tablas `flow_chatbot_*`. ⚠️ **Verificar filas en producción antes de soltar nada** (regla de
  oro del documento: inventario antes y después, migración en `BEGIN … ROLLBACK`).

#### P4 — ¿Quién paga la IA: la clave de GCC o la de cada cliente? · ✅ Resuelta — CADA CLIENTE LA SUYA
- **Respuesta (usuario, 2026-08-01):** cada cliente pone su propia clave.
- **Consecuencias de diseño:**
  1. La clave **se guarda cifrada** (AES-256-GCM con clave maestra en el entorno). El modelo viejo la
     tenía en `ai_api_key TEXT NOT NULL` **en claro**: eso no se repite.
  2. El alta del cliente tiene **dos credenciales**, no una: su número (Embedded Signup) y su clave
     de IA. La pantalla debe dejar claro cuál falta.
  3. **Un fallo de la clave del cliente no puede dejar al agente mudo en silencio**: si la API
     rechaza la clave hay que **escalar a humano y avisar en el panel**, no tragarse el error.
  4. `uso_modelo` sigue registrándose (es la traza del consumo y sirve para explicarle su gasto al
     cliente), pero **ya no es la base de la facturación de la IA**.

#### P5 — ¿La app de Meta de GCC ya está creada? · ✅ Resuelta — CREADA, todo lo demás pendiente
- **Respuesta (usuario, 2026-08-01):** *"recién creé la app, todo lo demás después de crearla no
  está hecho."* ⇒ **falta**: producto WhatsApp · configuración básica (+ Agregar plataforma → Sitio
  web) · configuración de Embedded Signup (plantilla de **token de 60 días**, no la de "Socio de
  medición") · **activar el JSSDK** (viene apagado) + dominios + OAuth · usuario del sistema con
  token de caducidad **Nunca** y solo `whatsapp_business_messaging` + `whatsapp_business_management`
  · webhook + **suscripción al campo `messages`**.
- ⚠️ **Comprobar que la app quedó en el portafolio de GCC** (`1000698870638078`): se elige al crear
  y **no se cambia después**. Si quedó en otro, hay que rehacerla ahora, no más tarde.

#### P6 — ¿Cómo corre el worker en este repo? · ✅ Resuelta — servicio aparte, ya desplegado
- **Por qué importa:** el chat necesita responder en 2–3 s. El cron actual pasa **cada ~10 minutos**:
  serviría para campañas, **no para conversar**.
- **Opciones:** (a) servicio worker aparte en Railway con bucle de 5 s, como en Peters Tours;
  (b) `scripts/frequent-cron.mjs` con un pase corto adicional; (c) procesar en el propio webhook tras
  responder 200 (**descartado**: en serverless el proceso puede morir al devolver la respuesta).
- **Respuesta (2026-08-01): (a), y ya está funcionando.** Servicio `agente-worker` en Railway con
  bucle de 5 s. Reutiliza `CRON_TOKEN` en vez de un secreto propio. Los trabajos se procesan **en
  serie**: cada corrida es una llamada al modelo con la clave del cliente, y varias a la vez se
  comen su límite de uso de golpe.

### La ARQUITECTURA ESTÁNDAR del agente (documento actualizado 2026-08-01, sección 6)
El usuario amplió `guia-coexistencia-proveedor.html` con «El agente por dentro»: es **la norma que
esperan todos los agentes que se creen a futuro**, no un ejemplo.

**Parámetros de ejecución (valores por defecto de todo agente nuevo):**
| Parámetro | Valor |
|---|---|
| Modelo | `claude-haiku-4-5` |
| `max_tokens` | 4096 — acota razonamiento **+** respuesta juntos |
| Esfuerzo | `medium` (**no se envía en Haiku**: el parámetro da 400) |
| Debounce | **8 s** — agrupa ráfagas en una sola corrida |
| Ventana de historial | **40 mensajes** + el resumen acumulado |

**Las tres herramientas** (`tool_choice: "any"`, `strict: true`, `additionalProperties: false`):
- `responder(texto)` — el mensaje al contacto. Breve (2–4 líneas), sin emojis.
- `no_responder(motivo)` — solo publicidad, cadenas, estafas, ofensas o mensajes sin intención.
  **En duda, RESPONDE**: callarse con un cliente real es peor error que contestar a un mensaje tonto.
- `escalar_a_humano(motivo, aviso)` — apaga el bot en ese chat. `aviso` es lo que ve el contacto;
  **cadena vacía = no enviar nada**.

**Los tres prompts, versionados por canal** (`perfil_agente` · `reglas_negocio` ·
`resumen_conversacion`): quién es el agente y cómo habla · cuándo usa cada herramienta · cómo
comprime la memoria larga.

**Ensamblaje del prompt — el orden IMPORTA:**
```
system: [ perfil_agente (cache) · CONOCIMIENTO completo (cache) · reglas_negocio ]
messages: [ ventana de 40 mensajes · resumen acumulado · mensaje entrante ]
tools: [ responder, no_responder, escalar_a_humano ]   tool_choice: "any"
```
Lo **estable va primero** para que el caché lo cubra; lo que cambia en cada llamada —el historial—
va al final. **Una sola función arma el bloque de conocimiento**, y la usan tanto el runner como la
pantalla de edición: si divergieran, lo que se ve no sería lo que recibe el modelo.

**El conocimiento** son bloques con clave + título + texto **descriptivo** (no pares
pregunta→respuesta: un carácter distinto rompía la coincidencia). Se marcan `[PENDIENTE]` los que el
cliente aún no rellenó.

**Respaldo del servidor:** bandera beta `server-side-fallback-2026-07-01` — si el modelo está
saturado, Anthropic reintenta con el recomendado dentro de la misma llamada. Se apaga con
`AGENTE_SIN_RESPALDO=1` y **se autodesactiva si la API rechaza la bandera**, para que un cambio de
contrato no deje al agente mudo.

#### P7 — El fallo del prompt desincronizado del conocimiento · ✅ Resuelta — se corrige por diseño
- **El fallo real (activo en Peters Tours):** `reglas_negocio` dice que escale porque el conocimiento
  está `[PENDIENTE]` en pagos y horario de atención — **pero el cliente ya los rellenó**. Resultado:
  el agente pasa a una persona preguntas que ya sabe contestar.
- **Lección del propio documento:** *"el prompt y el conocimiento se editan por separado y nada
  comprueba que sigan de acuerdo. En un sistema multi-tenant esto se multiplica por cada cliente."*
- **Decisión para GCC World:** la lista de bloques pendientes **se calcula del conocimiento** (los
  que contienen `[PENDIENTE]`) y se **inyecta** en el prompt al ensamblarlo. Nadie la escribe a mano.
  Es una línea de código que evita el fallo en los N clientes que vengan.

### Riesgos identificados
- **Paso irreversible:** en el Embedded Signup, elegir "dar de alta un número nuevo" en vez de
  **"conectar cuenta existente"** saca el número del teléfono y **el equipo del cliente pierde
  WhatsApp Web en el acto**. La pantalla propia debe hacer esa distinción imposible de confundir.
- **WABA de tipo SMB:** la del cliente puede haber nacido en la app del móvil ⇒ **cero socios**, sin
  `register` por API. Ante el primer síntoma raro, **comprobar el tipo de cuenta antes de seguir
  probando cosas** (esto costó una noche entera en Peters Tours).
- **Legal:** con GCC como proveedor, GCC pasa a ser **encargado del tratamiento** y el cliente el
  **responsable**. Hoy las políticas del repo están escritas al revés. Es el cambio conceptual más
  importante y condiciona el App Review.

---

## Objetivo ANTERIOR (declarado 2026-07-31) — DÓNDE SE EDITA: se acaba la edición "por encima" · ✅ RESUELTO 100% (detalle de proyecto)

**Rol asumido:** *diseñador de interacción del dashboard + frontend Next.js*.

### Necesidad (palabras del usuario, 2026-07-31)
> "En el detalle del proyecto, al editar un requerimiento que aparezca un **panel derecho con
> overlay**. Y que la edición **no sea por encima, no quiero más ediciones por encima**: guárdalo en
> aprendizaje, que siempre sea por **panel lateral derecho**, o **ventanita que aparezca en el centro
> solo cuando el campo a rellenar no sea un formulario y sean solo uno o dos campos**. Por ejemplo,
> al editar el cliente en la misma ventana de detalles de proyecto pasa lo mismo."
> Y a continuación: "asegúrate de que al editar los requerimientos se pueda editar también el campo
> de **plazas**."

### La regla (permanente, aplica a TODA la app)
1. **Prohibida la edición inline.** "Por encima" = sustituir el contenido que el usuario está mirando
   por sus inputs (la fila del requerimiento, el valor del rail, el título del `DetailHeader`).
2. **Formulario → panel lateral derecho con overlay.** Formulario = 3+ campos, o campos ricos
   (descripción larga, multi-select de talentos, listas).
3. **Uno o dos campos sueltos → ventanita centrada.** Es la excepción, no el caso general.
4. **Una sola definición** para las dos superficies, o la regla se vuelve a romper archivo por
   archivo: `components/ui/EditDialog.tsx`.

### Preguntas y respuestas

#### P1 — ¿Hace falta CSS nuevo para el panel derecho? · ✅ Resuelta — NO
- **Por qué importa:** un drawer a medida por pantalla es justo lo que produce diseños divergentes.
- **Respuesta:** `app/globals.css` ya convierte `PixelModal size="md"|"lg"` en panel deslizante desde
  la derecha dentro de `.corp` (644 px / 840 px, `panelSlideInRight`), y deja `size="sm"` como
  diálogo centrado. La regla del usuario **coincide exactamente** con esa distinción de tamaños, así
  que `EditDialog` solo envuelve `PixelModal` y añade el pie estándar.

#### P2 — ¿Qué se editaba "por encima" en el detalle de proyecto? · ✅ Resuelta — seis sitios
- **Respuesta:** requerimiento (la captura del usuario), **cliente**, **presupuesto** y **fecha
  límite** en el rail de propiedades (con botoncitos `OK`/`X` de 11 px), el **nombre** del proyecto
  (reemplazaba el `DetailHeader` entero) y la **subtarea** dentro del panel de Subtareas. Todas
  migradas.

#### P3 — ¿Se pueden editar talentos y plazas de un requerimiento? · ✅ Resuelta — el backend ya podía
- **Por qué importa:** el usuario lo pidió expresamente, y en la lista aparecía el aviso ámbar
  "plazas sin definir" sin ninguna forma de arreglarlo.
- **Respuesta:** el `PATCH` de `app/api/projects/[id]/requirements/route.ts` ya aceptaba `talents`
  (con `normalizeTalents`, exigiendo ≥1) y `slots` (`normalizeSlots`); lo que faltaba era el
  formulario. El panel de edición ahora tiene los cinco campos del alta (título, descripción, costo,
  talentos, plazas) y el catálogo de talentos se pide también al abrir la **edición**, no solo el
  alta (`useEffect` con `showReqModal || editingReqId != null`).

#### P4 — ¿Un desplegable dentro de la ventanita centrada se ve entero? · ✅ Resuelta — no, sin ayuda
- **Respuesta:** el cuerpo del diálogo es `overflow-y-auto`, así que si el alto lo pone el contenido
  (un solo campo), la lista del `ClientPicker` queda recortada. Se reserva alto con
  `min-h-[260px]`. Regla general: **ventanita centrada + selector con desplegable ⇒ reservar alto.**

#### P5 — ¿Se puede abrir una ventanita SOBRE un panel ya abierto? · ✅ Resuelta — sí
- **Respuesta:** editar una subtarea desde el panel "Subtareas" apila dos `<dialog showModal>`; el
  *top layer* del navegador gana a cualquier `z-index`, así que la segunda queda encima. Ya estaba
  documentado en `Diseño.md` para los `PixelModal` abiertos desde `FlowPanelShell`.

#### P6 — ¿Cómo se monta el panel estándar en una página que NO es del dashboard? · ✅ Resuelta
- **Por qué importa:** el portal del cliente y las páginas de tareas tienen su propio tema oscuro
  (`#1a1a1a`/`#2a2a2a`), y el panel derecho solo existe dentro del ámbito `.corp`.
- **Respuesta:** envolver el `EditPanel` en `<div className="corp dark corp-overlay contents">`.
  `corp-overlay` (ya existía para los modales de la landing) evita que la isla imponga fondo y
  `min-height`, y **`contents`** la saca del flujo para no romper el `space-y-*` del contenedor. El
  selector `.corp .modal-surface` sigue casando: el *top layer* cambia dónde se **pinta** el
  `<dialog>`, no dónde **vive** en el árbol DOM.

### Estado — ✅ barrido COMPLETO (2026-07-31)
Migrados y verificados (`tsc` + `next build`): `projects/[id]` (6 ediciones), `tickets/[id]` (días de
trabajo), `IncidentDetailPanel`, `app/portal/[projectId]` (portal del cliente, con gestión de
imágenes dentro del panel) y `(main)/tasks` = `(public)/panel/tasks` (archivos **idénticos**: se edita
uno y se copia). Única edición "en sitio" que queda, a propósito: el selector de premisas del panel
*glass* de `GestionDeDatosSystem` — es una selección dentro de la superficie de detalle, no un
formulario que tape lo que se está leyendo.

---

## Objetivo ANTERIOR (declarado 2026-07-29) — RECORDATORIOS DE REUNIÓN: por qué no salen solos + botón manual · ✅ RESUELTO 100%

**Rol asumido:** *integrador de sistemas (Google Workspace / Meet API v2) + backend*. El objetivo era mitad
**diagnóstico** (¿por qué no se generan?) y mitad **producto** (dar control manual al usuario).

### Necesidad (palabras del usuario, 2026-07-29)
Las reuniones **iniciadas desde `lfgonzalezm0@grupocc.org`** no generan recordatorio al terminar la sesión.
Pide (1) revisar por qué, y (2) un **botón en el módulo Recordatorios** que busque las reuniones **iniciadas
no agendadas** y permita **generar el recordatorio a mano** de las recientes que falten — explícitamente **no
automático**, "porque la forma automática para reuniones iniciadas no funciona".

### Preguntas y respuestas

#### P1 — ¿Falla el código del pase de reuniones instantáneas (Fase 3b)? · ✅ Resuelta — NO
- **Por qué importa:** si el bug estuviera en `runInstantMeetingReminderGeneration()`, el botón manual
  heredaría el mismo fallo y no resolvería nada.
- **Respuesta:** el código está bien y **ya funcionó una vez**: el recordatorio **#2** se creó el 2026-07-23
  desde la grabación huérfana `conferenceRecords/X1JTE3K9…` (`meet_orphan_records` lo registra como `done`).
  Lo que no se ejecuta es el **disparador**. (Fuente: `lib/reminders/meeting-gen.ts` + tablas `reminders`,
  `meet_orphan_records` de producción.)

#### P2 — ¿Está corriendo el cron de Railway? · ✅ Resuelta — NO, y es la causa raíz
- **Por qué importa:** los DOS pases automáticos y los correos escalados cuelgan del mismo runner
  (`scripts/frequent-cron.mjs`, cada 10 min).
- **Respuesta:** no corre. Tres pruebas independientes contra la BD de producción:
  1. Recordatorios **#3** (venció 2026-07-27) y **#4** (venció 2026-07-28) siguen `active` con
     `email_stage=NULL`, `last_email_at=NULL`, `expired_email_sent=false`. `/api/reminders/cron/notify` los
     habría marcado `expired` y enviado correo.
  2. `member_calendar_events.reminder_status` seguía **NULL** en eventos terminados el 27 y el 29 de julio —
     ese campo se escribe **en cada pase** aunque no haya transcripción (`'pending'`/`'skip'`), así que su
     `NULL` prueba que el pase no corrió.
  3. `meet_orphan_records` tenía **una sola fila, del 2026-07-23** (día de desarrollo, disparo manual), pese a
     existir reuniones instantáneas con transcripción lista del 24 y del 29.
- **Lección de método:** para "no se generó X automáticamente", primero comprobar si el cron corrió mirando
  los campos que el pase escribe SIEMPRE, no solo si el resultado existe.

#### P3 — ¿Google entrega bien las transcripciones de las reuniones de esa cuenta? · ✅ Resuelta — SÍ
- **Por qué importa:** descarta que el problema sea de scopes, delegación de dominio o impersonación.
- **Respuesta:** impersonando `lfgonzalezm0@grupocc.org` con la service account, la Meet API v2 devolvió
  **11 `conferenceRecords` en 14 días**, de los cuales **6 con transcripción `FILE_GENERATED`** (la de hoy,
  47 min, con 224 entradas / 29.995 caracteres). Scope `meetings.space.readonly` y delegación **correctos**.
  (Fuente: sonda directa contra la API con `data/google-sa.json`.)

#### P4 — ¿Por qué algunas reuniones no tienen transcripción? · ✅ Resuelta
- **Por qué importa:** determina si el botón manual podrá generar algo o no, y qué hay que explicarle al usuario.
- **Respuesta:** **la transcripción solo existe si estaba activada.** Los espacios que crea la app
  (`meet.spaces.create` con `artifactConfig`) auto-transcriben; una reunión abierta a mano en meet.google.com
  **no**, salvo que se active dentro de la reunión. Medido: 5 de 11 grabaciones **sin ninguna** transcripción
  → para esas **nunca** habrá recordatorio, ni manual ni automático. La UI lo dice explícitamente
  ("Sin transcripción") con el motivo en el pie del modal.

#### P5 — ¿Cómo se identifica una reunión sin duplicar ni ensuciar el listado? · ✅ Resuelta
- **Por qué importa:** es la clave de idempotencia del botón (no gastar IA dos veces, no crear duplicados).
- **Respuesta:** Meet crea **un `conferenceRecord` por CADA entrada a la sala**, y varias comparten el mismo
  `meetingCode`. Conclusiones: (a) la clave única es `conferenceRecords/<id>` → es lo que se guarda en
  `reminders.source_event_id`; (b) el `meetingCode` solo sirve para **emparejar con el evento del calendario**;
  (c) las grabaciones de **<1 min sin transcripción y sin recordatorio propio** son "falsos arranques" y se
  **descartan del listado** (11 grabaciones reales → 8 útiles).

#### P6 — ¿Cómo se garantiza que un miembro solo genere sobre SUS reuniones? · ✅ Resuelta
- **Por qué importa:** el endpoint recibe un `recordName` del cliente; sin control, se podría pedir el de otro.
- **Respuesta:** **la impersonación ES el permiso.** `getAuth(scopes, subject)` con el `workspace_email` del
  usuario que llama hace que `conferenceRecords.get` de una reunión ajena falle con 403/404 en Google. Se suma
  validación de formato del `recordName` (bloquea path traversal) y la idempotencia por `source_event_id`
  filtrada por `user_id`. Probado: 401 sin cookie · 400 formato inválido · 409 sin transcripción · idempotente.

#### P7 — ¿Botón manual en vez del pase automático, o los dos? · ✅ Resuelta — los dos
- **Por qué importa:** el usuario dijo "que no sea automático".
- **Respuesta:** se entiende como *"el botón debe ser manual"*, no *"borra el pase automático"*. El pase
  automático **se conserva** (es idempotente, y si algún día se arregla el cron sirve gratis) y se le suma el
  botón, que es el camino en el que el usuario **no depende de nada**. Ambos comparten la misma función
  `createMeetingReminder()` → el recordatorio sale idéntico por cualquier camino.

### Solución construida
- `lib/reminders/meeting-scan.ts` — `scanUserMeetings()` + `generateReminderFromRecord()` (nuevo).
- `lib/reminders/meeting-gen.ts` — extraída `createMeetingReminder()` como **definición única** (cron + manual).
- `lib/integrations/google-workspace.ts` — `withText` en `fetchRecentMeetTranscripts` (listar rápido),
  `fetchMeetRecord()`, `fetchMeetTranscriptText()`.
- `app/api/reminders/meetings/route.ts` — `GET` escanear · `POST` generar (auth de sesión).
- `recordatorios/page.tsx` — botón **"Buscar reuniones"** + modal con estados y acción por fila.

### Verificación en vivo (2026-07-29)
Generados de verdad contra la cuenta real: **#5** "Seguimiento a implementación de chatbot y página de
reservas" (instantánea, 47 min, 4 tareas, transcripción de 30.947 bytes adjunta) y **#6** "Seguimiento
configuración inicial de SharePoint" (agendada → marcó el evento `reminder_status='done'` y le añadió el
enlace en la descripción). `tsc` + `next build` OK.

### Riesgo abierto (no de código)
🔴 **El cron de Railway sigue apagado** → **los correos escalados de recordatorios no se envían**. Es
configuración del servicio `nightly-cron`, la aplica el usuario. Detalle en `MEMORIA.md` → Pendientes.

---

## Objetivo ANTERIOR (declarado 2026-07-26) — CÍRCULO DEL TALENTO: requerimientos con talento + filtro + el agente eligiendo

**Rol asumido:** *arquitecto de datos + integrador de agentes de IA* (Postgres/pgvector, embeddings, Agent SDK
sobre worker aislado, y el filtrado en las dos superficies donde la gente busca trabajo).

### Necesidad (resumen del usuario, 2026-07-26)
Que se pueda **encontrar proyectos por talento** en Marketplace y en Proyectos. El problema de partida: los
proyectos nunca pedían talentos a nivel del trabajo real. Solución acordada: **cada REQUERIMIENTO declara sus
talentos (obligatorio) y sus plazas**; el proyecto "pide" la unión de los talentos de sus requerimientos, y el
filtro se basa en eso. Además, el **agente de cotizaciones** debe elegir el talento de cada requerimiento
consultando la lista real, y **dejar las plazas vacías** (las pone una persona). El **GCC Bot** hereda ese
comportamiento por reanudar la misma sesión.

### Preguntas y respuestas

#### P1 — ¿Dónde vive el talento hoy y por qué no servía? · ✅ Resuelta
- **Por qué importa:** si ya existiera, no habría que crear nada.
- **Respuesta:** existía `projects.required_talents` (nivel PROYECTO, para *liderar*, junto a `open_for_talent`)
  y `tickets.required_talents`. No servía para el objetivo: describe quién lidera, no el trabajo a repartir.
  Se añadió el talento **a nivel de requerimiento**. (Fuente: `app/api/projects/route.ts`, esquema real de
  `project_requirements`.)

#### P2 — ¿Búsqueda por texto o embeddings para que el agente elija talento? · ✅ Resuelta — **MEDIDA, no opinada**
- **Por qué importa:** decide infraestructura, coste y calidad. Era la duda explícita del usuario.
- **Respuesta:** **embeddings**. Se probó primero lo barato (`pg_trgm`, ya disponible) y **falla justo en el caso
  real**: el agente describe el trabajo con sus palabras y no comparte términos con el nombre del talento.
  Medición (2026-07-26): `"app movil"`, `"pantallas bonitas"`, `"automatizar tareas repetitivas"` → **CERO
  resultados** con trigramas; con embeddings → *Desarrollo móvil*, *Diseño UX/UI*, *Automatización de procesos
  (0.74)*. **Tercera opción evaluada y descartada:** meter los 525 talentos en el prompt (9 358 caracteres ≈
  **2 600 tokens**) — funciona, pero es coste en CADA turno y la lista es editable y crece.
- **Elección concreta:** `text-embedding-3-small` (1536 dim; la clave de OpenAI ya estaba) + **pgvector**
  (extensión `vector` disponible, se habilitó; índice `hnsw`). Columna `embedding` en la propia `gd_talentos`.
  Indexar 525 talentos: ~2 min y centavos.

#### P3 — ¿El agente puede quedarse con el top-1 automático? · ✅ Resuelta — NO
- **Por qué importa:** determina si la herramienta decide o solo propone.
- **Respuesta:** **NO**. La herramienta devuelve **top-k con score** y el agente elige. Evidencia: `"guardar y
  consultar informacion"` devuelve como primero *"Conservas y encurtidos"* (falso amigo de "conservar") y como
  segundo el correcto, *"Administración de bases de datos"*. El prompt le exige **copiar el nombre exacto**
  devuelto por la herramienta (si no vino de ahí, no vale).

#### P4 — ¿Dónde se ejecuta la búsqueda: worker o app? · ✅ Resuelta
- **Por qué importa:** decide dónde viven las claves de IA y qué se rompe si algo cae.
- **Respuesta:** en la **app** (`POST /api/talentos/buscar`, autenticada con el token del worker). El worker
  llama por HTTP con `APP_URL`. Así **las claves de IA se quedan en un solo sitio** y el indexado/mantenimiento
  también. Si falta `APP_URL`, la herramienta **degrada a búsqueda por texto** en vez de romperse.

#### P5 — Renombrar un talento, ¿obliga a recalcular el embedding? · ✅ Resuelta — SÍ (duda del usuario)
- **Por qué importa:** un vector obsoleto envenena las búsquedas en silencio, sin error visible.
- **Respuesta:** **sí**, el vector representa el TEXTO. Y había un **hueco real**: la invalidación estaba solo en
  `updateListOption`, pero la pestaña **Fuentes edita `gd_talentos` directamente** y por ahí nadie se enteraba.
  Se cerró con la columna **`embedded_text`** (el texto exacto con el que se calculó el vector); lo pendiente es
  `embedding IS NULL OR embedded_text IS DISTINCT FROM nombre` → **detecta el cambio venga por donde venga**.

#### P6 — ¿Todas las vías de alta de requerimientos pueden exigir talento? · ✅ Resuelta — NO, y se decidió a conciencia
- **Por qué importa:** una validación ciega habría roto la generación de cotizaciones.
- **Respuesta:** hay **5 sitios** que insertan requerimientos (`/api/projects/[id]/requirements`,
  `/api/quotes/generate`, `/api/quotes/[id]/chat`, `lib/cotizaciones/data.ts`, compra de plantilla del
  marketplace). El talento es **obligatorio en el formulario manual**; las vías del agente lo rellenan ahora con
  la herramienta. **Queda pendiente**: la compra de plantilla del marketplace sigue insertando sin talentos.

#### P7 — ¿Cómo se despliega el worker del agente? · ✅ Resuelta — el README estaba equivocado
- **Por qué importa:** se creía que un push a `main` lo actualizaba; **no lo hace** y el cambio no llegaba nunca.
- **Respuesta:** el servicio `cotizador-worker` figura en Railway como **subida por CLI** (`source.repo = null`),
  a diferencia de `corazonescruzados` y `nightly-cron`, que sí salen del repo. Se despliega a mano:
  `cd services/cotizador-worker && railway up --service cotizador-worker --detach`. **`--detach` es obligatorio**:
  sin él la subida se cuelga y expira (probado con y sin sandbox; ni conectividad ni tamaño —84 KB— eran la causa).
  Para poder comprobar la versión viva sin gastar una cotización, `/health` ahora devuelve
  `{ ok, tools, talentSearch, model }`.

### Decisiones de diseño / arquitectura (firmes)
- **El talento vive en el REQUERIMIENTO**, no en el proyecto. El proyecto "pide" la unión de los de sus
  requerimientos (`talents && ARRAY[...]`, con índice GIN).
- **Las opciones del filtro las calcula el servidor** con los talentos que de verdad piden los proyectos
  visibles para ese usuario (respetando su control de acceso). Nunca se ofrecen los 525: así no existe una
  opción que devuelva cero resultados.
- **Las plazas admiten NULL** = "sin definir". El agente no las decide; la UI lo marca en ámbar.
- **La herramienta es la frontera**: si mañana se cambia el motor de búsqueda (otro modelo, otra base), solo
  cambia su interior; ni el agente ni el esquema se enteran.

### Riesgos y cómo se mitigan
- **Vector obsoleto en silencio** → `embedded_text` + trabajo nocturno *"Talentos · embeddings al día"*
  (`POST /api/talentos/cron/reindexar`, idempotente: sin pendientes no gasta API) + reindexado perezoso en la
  propia búsqueda.
- **El agente inventa un talento** → el prompt exige copiar el nombre exacto de la herramienta y el servidor
  normaliza; si aun así no coincide, el requerimiento simplemente no sale en el filtro (no rompe nada).
- **La app no responde** → la herramienta cae a búsqueda por texto en vez de fallar.
- **Coste** → indexar es una vez y unos centavos; el cron no gasta si no hay cambios.

### Estado
- **Implementado y verificado end-to-end** (2026-07-26): crear sin talentos se rechaza; con talento y 3 plazas
  se crea; el filtro devuelve 1 de 18 en Proyectos y 10 en Marketplace (0 con un talento inexistente); el
  worker en producción responde `{"tools":[...,"buscar_talentos"],"talentSearch":"app"}`.
- **PENDIENTE (no hecho):** generar una **cotización real** para ver al agente eligiendo talentos de punta a
  punta — consume una llamada a Opus y crea un proyecto, así que lo dispara el usuario. Y **quitar el dominio
  público** que se creó por error al worker (`cotizador-worker-production.up.railway.app`): el CLI no borra
  dominios, hay que hacerlo desde el panel. El worker es fail-closed (401 sin token), así que el riesgo está
  acotado.

---

## Objetivo ACTUAL (declarado 2026-07-22) — MÓDULO DE COTIZACIONES con Agente SDK de Claude (Opus)

**Rol asumido:** *arquitecto full-stack + integrador de agentes de IA* (Next.js/Postgres + Agent SDK de
Claude + worker de sesión persistente + acceso público por token). Cubre datos, IA, infra y seguridad externa.

### Necesidad (resumen del usuario, 2026-07-22)
En **Proyectos**, botón **"Nueva cotización"** (solo **candidatos/miembros**) → **panel lateral izquierdo**:
selector de **servicio** (de los del usuario, con su costo/hora), **detalle**, **instrucciones adicionales**
(precio preestablecido / tareas obligatorias / etc.), y **selector de agente** (hoy solo "Cotizaciones Software").
Botón **Generar cotización** → un **Agente SDK de Claude (Opus)** devuelve salida estructurada que rellena el
**detalle del proyecto**: **requerimientos + costo por requerimiento + subtareas**, **fecha límite** (la pone la
IA), **responsable = el usuario**, **cliente = pendiente**, **visibilidad = privado**. Costo en base al
**costo/hora del servicio**; si hay precio preestablecido en instrucciones, se respeta; si no, lo fija la IA.

- **Nuevo estado `cotizacion`** ANTES de `draft` (cotizaciones = proyectos aún no aprobados por el cliente; los de
  "Nuevo/Solicitar proyecto" ya tienen aprobación). Se añade al **rail de filtros**.
- **Sesión persistente del agente** (vía worker): tras generar, la sesión se conserva y queda disponible al entrar
  a la cotización mediante un **chat flotante "GCC Bot"** (mismo patrón que los chats flotantes existentes) para
  pedir cambios (agregar/quitar requerimientos, reformular, cambiar infraestructura…). Cada cambio → nueva
  **versión** (historial `v1, v2, …`, conservando la v1).
- **Tool del agente:** acceso a los **proyectos generados por el mismo usuario** (leer requerimientos, reconsiderar
  precios y desglose).
- **Compartir por token con expiración** (que fija el usuario) → se envía la **página de cotización por correo** al
  cliente; el externo la ve, **acepta/rechaza** (botones grandes), puede **chatear con GCC Bot** y **agregar
  observaciones**. El correo avisa que el agente puede ayudarle.
- **En estado `cotizacion`:** ocultar Imágenes/visibilidad y pestaña **DigiMundo** (solo admin/miembro/candidato);
  para cliente/externo, pestaña **"Observaciones"** (reusar el form de observaciones que antes venía de DigiMundo).
  **Los proyectos ya NO vienen de DigiMundo**, vienen de aquí; observaciones → futuras tareas/recordatorios.
- **Futuro (NO ahora):** múltiples agentes con distintas fuentes; panel para administrar prompts/tools/pipeline.
  Dejar la **lista de agentes** preparada (hoy 1).

### Hallazgos de exploración (2026-07-22)
- **Agente/chat (RESUELTO):** el núcleo es `app/api/chat/route.ts` = `spawn('claude')` del **CLI local** (NO Agent
  SDK ni API). Sesiones persistentes en `data/agent-sessions.json` por `sessionKey` + `--resume`. `ProformaChatPanel`
  ya es un **agente de cotización de software** (genera proforma HTML + doc técnico de 20 secciones, comparte sesión
  `project-{id}`). **Gateado a localhost**; `/api/chat` **sin auth**. `ChatDock` es solo humano-humano (no hay agente
  en el dock). → Para producción/externo hay que **migrar el núcleo a Agent SDK/API de Claude** (con key), mover
  sesión a Postgres, autenticar, y añadir lanzador "GCC Bot" al dock + endpoint conversacional público por token.
- **Tokens/correo/aceptar-rechazar (RESUELTO):** patrón token = columnas en `projects` (`proforma_token`,
  `proforma_token_expires_at`), `crypto.randomBytes(32).hex`, validación en ruta pública `?token=`. **NO existe
  `resend.ts`** — correo por **Gmail API** (`lib/integrations/email.ts` → `sendViaGmail`; helpers `emailShell`,
  `emailButton(url,label,variant)`, `emailBadge`, `emailInfoBox`). Flujo aceptar/rechazar existe en el calendario
  público (externo por token ↔ interno decide). Middleware solo protege `/dashboard` → `/cotizacion/*` público sin
  cambios. `createNotification(userId,{type,title,message,link})` solo a usuarios internos.

### Esquema de proyectos (RESUELTO 2026-07-22)
- **Estados** en `gcc_world.projects.status` (TEXT libre, sin enum → añadir `cotizacion` es seguro). Transiciones en
  `app/api/projects/[id]/route.ts` `VALID_TRANSITIONS`. Estado inicial se fija en `POST /api/projects`. UI en
  `projects/page.tsx` (`STATUS_TABS/STATUS_V/STATUS_LABEL`, ojo inconsistencia `in_review` vs `review`) y en
  `[id]/page.tsx`. Acceso `member` excluye `draft` (excluir también `cotizacion`). `counts` = GROUP BY status.
- **Requerimientos:** `project_requirements` (`title, description, cost, completed_at`) vía `POST .../requirements`.
  **Subtareas:** `requirement_items` (`requirement_id, title, sort_order, is_completed`) vía `.../requirements/items`.
  **Asignación/costo por miembro:** `requirement_assignments` (`proposed_cost, member_cost, status`), `syncFinalCost`.
- **Servicios:** `gcc_world.services` (`base_price, member_id, talent, is_active`) vía `GET /api/members/[id]/services?active=1`.
  ⚠️ `base_price` es **precio plano** (no hay "horas"). Decisión: tratar `base_price` como **tarifa/hora**; la IA estima
  horas por requerimiento → `cost = horas × base_price` (salvo precio fijado en instrucciones).
- **Creación:** modo `create` ya deja responsable=creador (`assigned_member_id`+`setResponsible {invited:false}`),
  `is_private=true`, y acepta `client_id=null` (cliente pendiente). Exactamente lo que pide la cotización.
- **Observaciones (DigiMundo):** hoy son `gcc_world."Incident"` (Prisma) ligadas al Project DigiMundo, no a
  `projects`. Para desacoplar de DigiMundo → **nueva tabla `project_observations`** ligada a `projects.id`.
- **Migraciones:** patrón idiomático = `ALTER TABLE ADD COLUMN IF NOT EXISTS` inline en el handler, o `ensureXxxTable()`
  en `lib/` para tablas nuevas. (No hay migraciones formales salvo 2 del juego.)

### DECISIONES DEL USUARIO (2026-07-22)
- **D1 · Runtime:** **Agent SDK en worker dedicado** long-running (sesión viva; reanudable por session-id persistido).
  La app web le habla por HTTP + token compartido (patrón Percepción). Nueva env: `COTIZADOR_WORKER_URL` +
  `COTIZADOR_WORKER_TOKEN`. La sesión se guarda en `quote_sessions.worker_session_id`.
- **D2 · Modelo:** **Opus 4.8** (`claude-opus-4-8`).
- **D3 · Entrega:** **por fases, núcleo primero**. **Fase 1** = estado `cotizacion` + filtro + panel "Nueva
  cotización" + generación IA (requerimientos/subtareas/costo/deadline; responsable=usuario, cliente pendiente,
  privado) + detalle con chat **GCC Bot interno** + pestaña **Observaciones** + ocultar Imágenes/DigiMundo en
  `cotizacion`. **Fase 2** = compartir por token + correo + aceptar/rechazar externo + chat externo + versionado.
- **Bloqueador activo:** `ANTHROPIC_API_KEY` no configurada; el worker no se puede probar end-to-end hasta que el
  usuario la provea (local + Railway) y despliegue el servicio worker. Construyo el andamiaje y verifico compilación.

### Estado del aprendizaje (2026-07-22) — COMPLETADO ✅
- **% de información:** **100%.** Objetivo CUMPLIDO. Fase 1 + Fase 2 + iteraciones construidas, verificadas
  (`tsc`+`next build`) y **desplegadas**. Worker `cotizador-worker` **corriendo en Railway** (red privada). Detalle
  vivo del módulo y todas las decisiones/gotchas en **`MEMORIA.md`** (buscar "MÓDULO COTIZACIONES"). Resumen de lo
  entregado:
  - Estado `cotizacion` (CHECK recreado idempotente), filtro + filtro "Cotiz. rechazadas".
  - Panel "Nueva cotización" (DERECHA) con servicio + cliente obligatorio + detalle + instrucciones + agente.
  - Worker Agent SDK Opus 4.8 (sesión reanudable; tool `list_my_projects`; **thinking OFF**; `canUseTool` en vez de
    `bypassPermissions` por el root de Railway). Salida: requerimientos+subtareas+costo+deadline + **costos
    adicionales** (proveedores).
  - Chat GCC Bot **interno** (dock, junto a Chat/Mis chats). Versionado `quote_versions`.
  - Compartir por token/vigencia + correo (Gmail API) + página pública `.corp` SOLO LECTURA con **Aceptar** (→ draft
    + presupuesto), **Rechazar** (→ filtro rechazadas), **Modificar presupuesto** (guarda + notifica, no cambia estado).
  - Observaciones (pestaña + endpoints). Costos adicionales editables en panel derecho + generados por la IA.
  - Header del detalle reformulado (Progreso/Imágenes como botones + panel; Acciones/Marketplace al ⋯; `trailing`).
- **Gotchas clave aprendidos:** (1) `bypassPermissions`/root en Railway → `canUseTool`. (2) `projects_status_check`
  bloqueaba `cotizacion` → recrear constraint. (3) `railway up` desde subcarpeta subía el repo raíz → usar
  `--path-as-root services/cotizador-worker`. (4) worker aislado por conflicto `zod3`(web)/`zod4`(SDK).
- **Objetivo del JUEGO** queda archivado abajo (histórico).

### Estado del aprendizaje (versión previa, 2026-07-22)
- **% de información:** ~95%. Exploraciones + decisiones + **Fase 1 CONSTRUIDA y verificada** (tsc+build) +
  **worker PROBADO end-to-end con Opus 4.8** (genera y chatea con reanudación de sesión).
- **Fase 1 entregada (commits):** estado `cotizacion` (b0fe508) · esquema+endpoint+panel (5c257e4) · worker
  (fe329fc) · chat GCC Bot + versionado + ocultar Imágenes/DigiMundo (538ebf1). Key de Claude guardada en
  `.env.local` (gitignore). Worker validado local: `services/cotizador-worker`.
- **Pendiente del usuario:** desplegar `services/cotizador-worker` como servicio Railway (Root Directory + envs) y
  poner `COTIZADOR_WORKER_URL`/`COTIZADOR_WORKER_TOKEN` en el servicio web. Sin eso, `/api/quotes/*` responde 503.
- **Fase 2 (siguiente):** `quote_token`+expiración en `projects` (patrón proforma) · correo (Gmail API) con botón ·
  página pública `/cotizacion/[id]?token=` (`.corp`) con Aceptar/Rechazar grandes · chat GCC Bot para externo
  (endpoint conversacional público por token) · pestaña **Observaciones** (tabla `project_observations` ya creada)
  para cliente/externo · notificación al responsable al decidir. Versionado ya existe (`quote_versions`).
  - **Aclaración del usuario (2026-07-22):** el enlace externo da acceso **SOLO LECTURA** de la cotización en la
    interfaz (sin ningún control de edición); el cliente **solo puede solicitar cambios a través del agente
    (GCC Bot)**, además de Aceptar/Rechazar. → La página pública renderiza la cotización read-only + GCC Bot
    (chat público por token) + botones grandes Aceptar/Rechazar (+ Observaciones).
- **Despliegue del worker (2026-07-22):** el usuario dio permiso; desplegando `cotizador-worker` como servicio
  Railway en `Servidor-GCC` (red PRIVADA `cotizador-worker.railway.internal:4610`, no público). Vars:
  ANTHROPIC_API_KEY, COTIZADOR_WORKER_TOKEN, COTIZADOR_MODEL, PORT=4610, DATABASE_URL=${{Postgres.DATABASE_URL}}.
  Falta setear en web (corazonescruzados): COTIZADOR_WORKER_URL + COTIZADOR_WORKER_TOKEN.
- **Bloqueadores conocidos:**
  - **P-A · Agent SDK + key:** NO instalado; solo `openai`. `ANTHROPIC_API_KEY` **comentada**. Hay que instalar
    `@anthropic-ai/claude-agent-sdk` (o `@anthropic-ai/sdk`) y **el usuario debe proveer la key** (o reusar la del
    worker de Percepción). (fuente: package.json/.env.local, 2026-07-22)
  - **P-B · Modelo:** el usuario dijo "Opus 4.6"; el más reciente hoy es **Opus 4.8** (`claude-opus-4-8`). Confirmar
    ID exacto. ⏸ espera al usuario.
  - **P-C · Infra de sesión persistente:** decidir reusar `WORLD_SERVER_URL`/patrón worker Percepción (Claude CLI +
    token) o servicio nuevo en Railway; o **replay de transcript** guardado en BD. ⏸ espera decisión.
- **Decisiones preliminares:** costo = `service.base_price`/h × horas estimadas por la IA (salvo precio fijado);
  salida JSON validada `{deadline, requirements:[{title,description,cost,hours,subtasks[]}], summary}`; tablas
  nuevas `quote_sessions`, `quote_versions`, `quote_shares(token+exp)`, `project_observations`; chat "GCC Bot" como
  tipo nuevo de `ChatDock`; acceso externo reusando patrón proforma/public-docs por token.
- **Plan por fases:** (1) estado `cotizacion` en UI+API; (2) esquema/ensurers; (3) servicios del usuario;
  (4) agente SDK Opus + tool "mis proyectos" + salida estructurada + worker de sesión; (5) panel "Nueva cotización";
  (6) detalle: chat GCC Bot + Observaciones + ocultar Imágenes/DigiMundo; (7) versionado; (8) compartir por token +
  correo + aceptar/rechazar + acceso externo.
- **Riesgo principal:** sesión persistente del Agent SDK en Railway (serverless no mantiene procesos) → worker
  long-running o replay de transcript. Coste/latencia de Opus por turno → acotar contexto + streaming. Seguridad del
  acceso externo → token expirable de alcance limitado + rate-limit.

> Detalle vivo de este objetivo abajo, al final del archivo, en la sección
> **"═══ COTIZACIONES (2026-07-22) — Preguntas y respuestas ═══"**. El objetivo del JUEGO queda **archivado** a
> continuación (histórico, no se borra).

---

## Objetivo ACTUAL (declarado 2026-07-19, 3ª parte) — JUEGO GCC WORLD: motor, librerías y arquitectura

**Rol asumido:** *arquitecto de motor de videojuego web + diseñador de sistemas/economía de juego.*
Elegido porque la decisión crítica no es artística sino de arquitectura: qué capa de render se
reemplaza, qué se conserva, y cómo se hace **autoritativa en servidor** una economía cuyas fichas
se canjean por productos y servicios REALES.

### Necesidad (verbatim del usuario, 2026-07-19)
Juego con finalidad de **enseñanza** y **retos**, con **economía de fichas internas** que luego se
aprovecha para ofrecer productos y servicios **gratuitos** a quien cumpla retos y gane fichas.
Aventura con **secretos y retos que involucran la vida real**, con datos que solo se encuentran
**investigando entre el mundo del juego y el `/dashboard` del usuario**. A ciertas etapas **solo se
avanza según los resultados REALES registrados en la app** o condiciones particulares. Jugabilidad
tipo **RPG que consume recursos de la cuenta del usuario**; ante el **fracaso**, el usuario debe
ganar recursos que **a veces no vienen del juego sino de tareas de los módulos del `/dashboard`**.
El usuario irá indicando dinámicas, misiones, etapas e historias. Encargo a Claude: **investigar
proyectos/librerías** para diseñar el juego, crear **secuencias/escenas programadas** y los ajustes
que requiere un videojuego. Es pixel art, pero **abierto a reformulaciones completas** para lograr
mejor imagen, sombras, rendimiento y edición de mundos.

### Hallazgo que reencuadra el encargo (auditoría del código, 2026-07-19)
El encargo asumía "hay que montar el juego". La realidad: **ya existen ~16.100 líneas de juego**, y
lo valioso NO es el código de dibujado (que es justo lo que un motor regala) sino **los editores
integrados en la app con auth y BD**, que ninguna herramienta estándar da:

| Archivo | Líneas | Qué es |
|---|---|---|
| `components/landing/world/MapEditor.tsx` | **6.341** | Editor de mapas completo en navegador |
| `components/landing/CharacterGameplay.tsx` | **2.590** | Runtime del juego A |
| `app/(main)/world/page.tsx` | 1.496 | Runtime del juego B (legacy, digimon) |
| `NpcEditor` / `CinematicEditor` / `SceneManagerEditor` / `items.ts` | ~3.650 | Editores + catálogo |

**Hay DOS juegos sin una línea compartida:** (A) "El Mundo" — LPC 64×64, tilemaps, NPCs, luces,
cinemáticas, en la landing; (B) "Digimundo" (`/world`) — canvas único, sprites generados con
fal.ai/OpenAI, afinidad 0-100. Dos sistemas de sprites, dos formatos de mundo, dos persistencias.

### Estado técnico real del juego A (verificado, con rutas)
- **Sin motor, sin WebGL.** Canvas 2D + **DOM/CSS**: los tiles son un `<canvas>` del **mundo entero**
  pintado 1 vez (`WorldMap.tsx:40`), pero el jugador y los NPCs son **~12 `<div>` apilados** por
  personaje con `background-position` (`CharacterCreator.tsx:848-1010`). Cámara = `translate` CSS.
- **No hay un game loop:** hay **4 RAF independientes + 2 `setInterval`**, todos disparando
  `setState` de React ⇒ **React ES el render loop**. El `fps` declarado por animación no se usa:
  todo avanza con un `setInterval(130ms)` global (`CharacterGameplay.tsx:611`).
- **Mapas:** tilemap **disperso** (array de tiles con coords absolutas), tile 32px ×2 en pantalla.
  El campo `s` es un **índice posicional** en `SHEETS` — reordenar el array **corrompe todos los
  mapas guardados** (advertido en `sheets.ts:1-2`).
- **Colisión de UN SOLO PUNTO** en los pies, sin AABB ni sweep; con `factor` capado a 5 hay
  desplazamientos de hasta 9,5px por paso ⇒ **tunneling**. Movimiento en 4 direcciones puras.
- **Iluminación:** gradientes radiales sin oclusión (la luz atraviesa muros), sin normal maps, sin
  sombras proyectadas (`GroundShadow` es un `div` con `radial-gradient`).
- **Cinemáticas = diapositivas**, no timeline: `{backdrop, characters[], dialog, duration}`, `<img>`
  estáticos en un stage 1280×720. Sin tweening ni animación de sprite.
- **Diálogos = `string[]` plano.** Sin ramas, sin condiciones, sin variables. **No hay quests.**

### ⚠️ Riesgos CRÍTICOS detectados (bloquean el objetivo del usuario)
1. **Economía inexistente Y falsificable.** Cero coincidencias de coin/ficha/reward/xp/score en todo
   el juego. Peor: `POST /api/world/inventory` acepta cualquier `{placementId, itemId}`
   **sin validar que ese placement exista ni que el jugador esté cerca** (`inventory/route.ts:29-45`).
   Como las fichas darán productos reales, esto es explotable con un `fetch` desde la consola.
2. **Canvas del mundo completo = bomba de memoria.** `WorldMap` crea un canvas de `width*32 ×
   height*32`. Con el máximo permitido (500×500 tiles) son **16000×16000px ≈ 1 GB de VRAM**, y se
   instancian **tres a la vez** (`below`, `above`, y `LightOverlay` a 64px ⇒ 32000×32000). Un mapa
   de 200×200 **ya revienta el límite de canvas de Safari/iOS**. Sin culling ni chunking.
3. **Progreso casi todo en `localStorage` o en memoria.** Cinemáticas vistas → `localStorage`
   (*"clearing browser data replays them"*, `events.ts:20-33`); triggers de props → `Set` en memoria.
   **No se guarda posición ni escena actual.** Incompatible con "avanzar según resultados reales".
4. **Esquema del juego NO versionado.** `sql/migrations/` **ya no existe** (verificado: `find` da 0
   archivos `.sql`) y el juego no está en Prisma. Las 4 tablas (`scenes`, `world_maps`, `npcs`,
   `lights`) solo existen en la BD de producción. Además hay **DDL en el hot path**: un
   `ALTER TABLE ADD COLUMN IF NOT EXISTS` **en cada GET y cada PUT** de `/api/world/map`.
   ⚠️ Esto **contradice `MEMORIA.md`**, que dice que las migraciones viven en `sql/migrations/`.
5. **Autorización de edición por email hardcodeado**: `ADMIN_EMAIL = 'lfgonzalezm0@outlook.com'`
   (`lib/world/auth.ts:5`).
6. **Sin soporte móvil/táctil**: el control es exclusivamente teclado.

### Decisión de arquitectura propuesta (investigación web, 2026-07-19)
**Reemplazo quirúrgico, NO migración total:** cambiar solo la capa de dibujado (~1.500 líneas) a
**Phaser 4**, y **conservar los ~14.500 de editores + las rutas API**, que siguen siendo React+Postgres.

- **Motor: Phaser 4.2.1** (MIT). Razón decisiva para este caso: **`sprite.setLighting(true)` con
  normal maps y self-shadows nativos** — exactamente el "mejores sombras" que pide el usuario, hoy
  imposible con gradientes radiales. Existe plantilla oficial Next 15 + Phaser 4 + React 19.
  ⚠️ *Aviso oficial:* activar lighting **rompe el batching** ⇒ aplicar selectivamente.
- **Descartados y por qué:** Godot/Unity/Cocos/Defold/GDevelop → producen un **iframe**, lo que
  **pierde el contexto de auth de la app** (inaceptable si las fichas dan productos reales) y pesa
  MB en vez de KB. `@pixi/react` → bugs abiertos con **React 19.2 + StrictMode + Next dev**
  (issues #630/#602/#648), sin push desde 2026-01. Kaplay → v4000 lleva 2 trimestres de retraso.
- **NO adoptar Tiled ni LDtk** (aunque sean "el estándar"): obligarían a instalar una app de
  escritorio y subir ficheros, **perdiendo el editor en navegador con auth y BD**, que es una
  ventaja de producto. (Dato: LDtk no tiene release estable desde enero de 2024.)
- **NO montar servidor de juego** (Colyseus/Nakama): un RPG single-player no tiene simulación
  adversarial en tiempo real; añadiría una **segunda fuente de verdad** para la economía sin quitar
  confianza al cliente. Bastan Route Handlers + Postgres.
- **NO ECS** (bitECS/Miniplex): decenas de entidades, no miles. Además el estado autoritativo debe
  ser **diffable y expresable como filas**; los TypedArrays SoA de bitECS pelean contra Postgres.
- **NO Howler**: congelado (v2.2.4 es de sept-2023; en nov-2025 el único commit **añadió publicidad
  de un patrocinador**; nadie respondió a la propuesta de fork de feb-2026). Usar el audio de Phaser,
  que es el único que maneja el estado **no estándar `'interrupted'`** de iOS y el backgrounding.

### Reencuadre clave para la economía (lo más importante del análisis)
**Las fichas no son una variable de juego: son un sistema de pagos.** Deben modelarse como
**libro contable append-only** (tabla `ficha_transaction` con clave de idempotencia + UNIQUE, saldo
**derivado**), no como una columna entera mutable. Eso da auditoría cuando se dispute un canje y
hace la duplicación **detectable a posteriori** en vez de invisible. Corolarios:
- El cliente manda **acciones** ("interactué con NPC 7 en el paso 3"), **nunca resultados**
  ("misión completa, págame"). Máquina de estados de misiones **en el servidor**.
- **Loguear el stream de acciones desde el día uno** — es el insumo para detectar anomalías y no se
  puede reconstruir retroactivamente.
- **Fricción en el canje, no durante el juego.** Topes diarios y rendimientos decrecientes: la
  amenaza real no es "tengo 10.000 fichas" (eso lo mata la autoridad del servidor) sino
  **"un script repite la misma misión legítima 400 veces de noche"** — eso es un ataque económico y
  se defiende con **diseño**, no con código cliente.
- La defensa en cliente es inútil, con evidencia: el speedhack es **una extensión de navegador** en
  la Chrome Web Store que sobreescribe `Date.now`/`performance.now`/`requestAnimationFrame`, y
  **falsea `Function.prototype.toString`** para seguir reportando `[native code]`. WASM tampoco
  salva (existe Cetus, un Cheat Engine para WASM).

### Paquetes a instalar (versiones VERIFICADAS contra el registro npm el 2026-07-19)
```bash
npm i phaser@4.2.1        # MIT — motor + lighting con normal maps + audio iOS-safe
npm i inkjs@2.4.0         # MIT, 0 deps — diálogos ramificados; ToJson()/LoadJson() serializa
                          #   TODO el estado narrativo ⇒ se persiste y revalida en Postgres
npm i pure-rand@8.4.2     # MIT — RNG con semilla y estado serializable (loot auditable)
npm i -D free-tex-packer-core@0.3.8   # MIT — exportador Phaser nativo
npm i -D @kayahr/aseprite@2.1.0       # MIT — tipos TS del JSON de Aseprite
# zustand@^5.0.0 YA está instalado → usar zustand/vanilla como puente Phaser↔React
```
Fuera de npm: **Aseprite** ($19.99) — Phaser tiene loader nativo (`this.load.aseprite`) y convierte
**los tags en animaciones automáticamente**; Pixi NO (declara `frameTags` pero nunca los lee).
Alternativa libre: Pixelorama 1.1.10.
**NO instalar:** `howler`, `use-sound`, `@pixi/react`, `bondage`/`yarn-bound` (lenguaje de 2020),
`react-game-engine` (archivado), ningún ECS, ningún framework de servidor de juego.

### Reglas de integración no negociables (Next 15 + React 19)
- `ssr:false` **no está permitido en Server Components** en Next 15 ⇒ hace falta un wrapper
  `'use client'` fino con `dynamic(..., { ssr:false })`.
- **React 19 StrictMode monta dos veces** y el `import()` es asíncrono ⇒ montaje idempotente con
  bandera `disposed`, o se filtra un juego huérfano sin cleanup (phaser#4305).
  **NO desactivar `reactStrictMode`** (dev-only; ocultaría bugs en TODA la app, no solo en `/world`).
- **Lo que cambia cada frame NO toca React jamás.** Posiciones/velocidades solo en Phaser; React
  solo pinta HUD, inventario y diálogo, leyendo de `zustand/vanilla`.
- **Riesgo de despliegue (alta probabilidad):** Railway con `output:'standalone'` **no copia
  `public/`** ⇒ todos los sprites y audios dan 404 en producción funcionando perfecto en local.
- **Phaser NO tree-shakea** (no hay campo `sideEffects` ni subpath exports; varios blogs afirman lo
  contrario y se equivocan) ⇒ ~347KB gz. Mitigación: split por ruta, solo carga en el juego.

### ADENDA (2026-07-19, tarde) — el usuario levanta la restricción del editor de escritorio
**Dijo:** que descargar algo a su PC y subirlo a la app "no lo veo tan mal", incluso "así sea Godot",
porque necesita "un buen motor para trabajar y poder diseñar lo que quiera sin tantas limitaciones
como quizás tengo actualmente con mi motor de edición muy inmaduro". Su única preocupación:
"asegurar que existan las validaciones de usuario y reglas de usuario".

**Corrección a mi análisis previo:** descarté Tiled/LDtk infiriendo que el editor en navegador era
intocable. **Esa inferencia era mía y era incorrecta.** Tiled pasa de descartado a **recomendado**.
La distinción que lo resuelve: **el editor de autoría y el runtime son capas separables**. La
objeción del `<iframe>`/auth aplica SOLO al runtime; jamás aplicó a la herramienta de autoría.

**Verificado por mí leyendo el tarball de `phaser@4.2.1`** (no búsqueda web):
- **25 archivos de parser de Tiled, cada uno con su test unitario.** Soporta mapas **infinitos por
  chunks** (`ParseTileLayers.js:46,101-135`) ⇒ **es la cura del canvas de 1 GB y del crash en iOS**;
  **tiles animados** con duración (`ParseTilesets.js:90-119`) ⇒ el agua congelada se animaría;
  **Wang sets** (`ParseWangsets.js`), object layers completos, group layers, image layers,
  Collection of Images, y las 4 orientaciones. Shaders de luz reales (`ApplyLighting.glsl`).
- ⚠️ **Corrijo un error de mi 1er informe:** dije que Phaser no soporta "Collection of Images". Eso
  era cierto en Phaser 3, **NO en Phaser 4**.
- ⚠️ **GOTCHA CRÍTICO — tilesets externos `.tsx` NO soportados** (`ParseTilesets.js:38`): el fallo es
  un `console.warn`, **no una excepción**. Un mapa exportado sin "Embed Tilesets" **carga sin sus
  tilesets, en silencio**. Debe ser regla del pipeline Y rechazo duro del validador.
- **Auto-tiling:** es ayuda de AUTORÍA. Tiled resuelve los tiles al pintar y exporta índices ya
  resueltos; el runtime no necesita entender nada. Phaser parsea los wangsets solo como extra.

**Godot 4.7.1 — números MEDIDOS (se descargó el `.tpz` oficial y se comprimió localmente):**
- `godot.wasm` sin hilos: **37,68 MiB crudo / 6,58 MiB brotli**. La cifra oficial que circula
  ("~5 MB en 4.3") está **desactualizada en un 31%**. Payload realista total: **9-19 MB**.
  Ratio contra Phaser: **24,4×**. **Suelo inamovible de ~7 MB.** Threads NO cuesta tamaño.
- ✅ **A favor, y corrige mi objeción del puente frágil:** `library_godot_fetch.js` (4.7-stable)
  construye `fetch(url,{method,headers,body})` **sin campo `credentials`** ⇒ por spec el default es
  `same-origin` ⇒ **servido desde `public/game/`, las cookies httpOnly de sesión viajan solas**.
  Es la integración más segura posible. Pero **obliga a same-origin para siempre** (un CDN de otro
  dominio rompe la auth de forma permanente). Se monta sin iframe con `new Engine({canvas,...})`.
- ❌ **`godot#76266` ABIERTO y SIN ASIGNAR:** la iluminación 2D se calcula **por píxel del viewport
  destino, no a resolución del arte** ⇒ en pixel art escalado los degradados rompen la estética de
  píxel. Calinou: *"nadie está trabajando en implementarlo"*. El workaround (buffer de baja
  resolución) **imposibilita zoom, paneo y movimiento suave**. Su ventaja de luz viene con asterisco
  justo en nuestro estilo.
- ❌ `godot#70621` (OOM en iOS por límite de 2 GB de wasm) **abierto, actualizado 2026-06-01**.

**Única ventaja visual REAL de Godot: sombras por oclusión** (`LightOccluder2D`+`OccluderPolygon2D`)
— que una columna proyecte sombra sobre el suelo. **Phaser 4 NO la trae**: hace `setSelfShadow()`
(relieve DENTRO de un sprite) pero no proyecta entre objetos. Es la **desventaja honesta** de la
opción A; implementable a mano (shadow casting 2D) pero es trabajo propio.

**Normal maps — la respuesta que faltaba, y reencuadra el objetivo del usuario:**
- **Laigter VIVO y gratis** (v1.13.1 2025-12-16, GPL-3, solo 4 issues abiertos). Verificado en su
  `main.cpp`: **CLI headless real** (`--no-gui --normal --specular --occlusion --parallax --preset`,
  recursivo por defecto) ⇒ **sí se automatiza un tileset entero en CI**.
- **PERO el coste es de ARTE, no de motor:** Cardboard Sword invirtió **~3 meses-persona** en normal
  maps a mano solo para los tilesets de *The Siege and the Sandfox*. La comunidad estima **2-4× el
  tiempo de arte base**. Las herramientas son **más flojas justo en animación**.
- ⇒ **"Las mejores sombras" es una partida de presupuesto de arte, no una elección de motor.**
  Elegir Godot por las sombras NO ahorra esos meses. **Plan: probar Laigter automático +
  `setSelfShadow()` sobre 2-3 assets reales ANTES de comprometer meses de arte o cambiar de motor.**

**Descartados con motivo nuevo:**
- **LDtk — por mantenimiento, no por diseño:** sin release estable desde **v1.5.3 (2024-01-15)**; los
  commits de 2026 son solo CI. Su UX (auto-layer rules, IntGrid) sigue siendo superior, pero el
  paquete de tipos de referencia está en un repo **archivado** apuntando al formato 0.8.
- **Híbrido "autoría en Godot → runtime Phaser" = TRAMPA.** No existe conversor (búsqueda: 9 repos,
  ninguno lo es). Motivo técnico: el `.tscn` es parseable pero **la carga útil del tilemap es un blob
  binario opaco y dependiente de versión** (G3 `PackedInt32Array` → G4 `PackedByteArray`); existe un
  conversor cuyo propósito literal es arreglar la **"pérdida silenciosa de datos de tiles"**. Sería
  montar el pipeline sobre la parte menos estable y no documentada del formato.

**Validación de mapas subidos (la preocupación explícita del usuario):**
- **Concepto clave:** un TMJ subido es **contenido de ADMIN**, no estado de jugador. Son dos niveles
  de confianza que no se mezclan. **Regla de oro: el mapa es geometría y decoración; JAMÁS premios
  ni saldos.** El mapa dice *dónde hay un cofre*, nunca *que este usuario tenga su contenido*.
  Con las recompensas acuñadas en servidor, un mapa malicioso rompe el render, no crea fichas.
- Capas, en orden: (1) límite de tamaño **antes** de parsear (un TMJ de 200 MB es DoS trivial contra
  el Node de Railway); (2) ruta con sesión de admin (`getAuthedClient()`); (3) Zod `.strict()` para
  forma y límites — **NO** validar el payload de tiles con `z.array(z.number())` sobre millones de
  gids (lentísimo); usar bucle plano para longitud y rango; (4) **rechazo duro de tilesets con
  propiedad `source`**; (5) allowlist de rutas de imagen (anti path-traversal/SSRF); (6) integridad
  referencial — **extender el patrón que YA existe en `lib/validation.ts` (`validateWorldConfig`)**;
  (7) guardar TMJ original + normalizado y versionar; (8) devolver errores agregados, no el primero.

⚠️ **Caveat de fuentes:** el sub-agente que investigó iluminación reportó que **Reddit estaba
bloqueado y agotó su presupuesto de búsqueda** ⇒ esa parte **no incluye a ningún desarrollador de
juego publicado hablando en primera persona**. Ausencia de evidencia con fuentes bloqueadas, no
evidencia de ausencia.

**Entregable:** propuesta en HTML para el usuario (artifact privado)
`https://claude.ai/code/artifact/921a0c67-b2da-4b6c-9b51-b523270c4e84`, fuente en scratchpad
`propuesta-motor-juego.html`. **El usuario aún NO ha decidido** — no hay aprobación de nada.

## Objetivo ACTUAL (declarado 2026-07-20, 4ª parte) — REINICIO desde 0, frontera app↔Godot y flujo de entrada

**Rol asumido:** arquitecto de la integración app↔motor de juego.

### Necesidad (verbatim del usuario)
Iniciar el desarrollo del juego **desde 0** (todo lo anterior eran pruebas para ver cómo
funcionaría). Poder **distinguir lo desarrollado a nivel de APP y lo desarrollado a nivel de MOTOR
Godot**. Mantener una **forma de trabajar** concreta para la entrada: al pulsar **"Entrar"** debe
ejecutarse una transición que **desvanece y oscurece la página hasta negro completo**; cuando la
pantalla está en negro, **inicia el videojuego en su primera escena**. Los **puntos de guardado**
sirven para que al pulsar "Entrar" el usuario **recupere su partida donde se quedó**. Hoy, al pulsar
"Entrar", la app hace la transición de **"se apaga la TV"** y aparece en el punto de guardado, **con
validación de usuario**: si el usuario no está validado y la página está recién refrescada, se le
**pide validación** (ya configurado); tras validar, **sigue el videojuego donde se quedó**. El
usuario quiere **mantener esa forma de trabajar** y que quede grabada.
**Ampliación (mismo día):** eliminar del proyecto Godot **todo el código de juego** y dejar **solo
las carpetas de assets**, para que el juego de Godot se desarrolle y despliegue sin confusiones.

### Hallazgo que explica "el juego sigue igual en producción" (auditoría 2026-07-20)
El usuario reporta que en producción entra al juego y **sigue igual, con el editor**. La causa,
verificada en el código:
- **Coexisten DOS (tres) juegos:** (A) el juego **viejo** = `components/landing/CharacterGameplay.tsx`,
  montado como **overlay dentro de la landing** (`app/page.tsx`, ~5.392 líneas). Incluye el
  **editor** (`SceneManagerEditor`). (B) **Godot** = `app/juego/page.tsx` + `GodotGame.tsx`, servido
  desde `public/game/`. (C) una versión intermedia en **Phaser** (`components/game/{GameClient,
  PhaserGame}.tsx`), **latente, no montada en ninguna ruta**.
- **El botón "Entrar" de la landing monta el juego VIEJO**, no Godot. **Godot vive en `/juego`, una
  URL SUELTA sin ningún enlace ni navegación hacia ella.** Por eso el usuario, que entra por la
  landing, **nunca ve Godot** y "el juego sigue igual". Yo desplegué Godot correctamente, pero en una
  ruta que el flujo de entrada no toca.
- **Esta es la confusión a eliminar:** un solo juego (Godot), enganchado al botón "Entrar".

### Los dos niveles (resumen; detalle en MEMORIA.md)
- **APP** = cáscara + autoridad: landing, "Entrar", transición, login/validación, dashboard, y todo
  lo autoritativo (fichas, etapas, progreso, validación de recogidas) en Postgres + `app/api/*`.
- **GODOT** = el videojuego: mundos, personaje, NPCs, diálogos, objetos, transiciones, cinemáticas.
  Consume las APIs de la app; no posee estado autoritativo.
- **Frontera:** la app valida y hace la transición, luego cede el control a Godot; Godot arranca
  leyendo el punto de guardado y reporta acciones que el servidor decide.

### Flujo de entrada canónico (a mantener) — ver MEMORIA.md para los 6 pasos
Entrar → (validar si no hay sesión) → transición a negro (apagado de TV) → montar Godot → Godot
recupera escena+posición del punto de guardado (o primera escena si es nuevo) → jugar.

### Estado y trabajo pendiente para ese flujo
- ⚠️ **Conectar "Entrar" → Godot** (hoy `/juego` está desconectado): es el cambio que hará que al
  entrar se vea Godot y no el juego viejo.
- ⚠️ **Recuperar partida NO existe:** `player_progress`/`savePosition`/`GET position` existen y Godot
  **guarda**, pero **nadie LEE** la posición al entrar. Falta: al iniciar la escena, leer
  `GET /api/world/position` y arrancar ahí (o en la primera escena si no hay guardado).
- ⚠️ **Retirar los juegos viejos** (CharacterGameplay overlay + Phaser latente) para no confundir.
- La transición `bulbOff` (CRT) ya existe en `globals.css:240-245` + `app/page.tsx`; decidir cómo se
  encadena con la navegación a `/juego` (página separada).

### PJ7 — ¿Alcance del "desde 0" en Godot: solo contenido o también los sistemas? · ⏸ Bloqueada (espera al usuario)
- **Por qué importa:** los scripts de Godot son de DOS tipos. **Contenido de prueba** (mundos
  `main`/`refugio`, objetos sembrados, `tools/sembrar_*`) — claramente desechable. Y **sistemas
  reutilizables** (`Personaje.gd` compone el personaje LPC, `Dialogo.gd`, `Objeto.gd`,
  `Transicion.gd`, y el pipeline `import_maps`/`export_manifest`) — funcionan y probamos. Borrarlos
  y reescribirlos sería desperdicio; conservarlos acelera el desarrollo real. TODO está en git
  (recuperable), así que la decisión no es irreversible.

### Preguntas abiertas para el usuario
### PJ1 — ¿Se unifican los dos juegos (A "El Mundo" y B "Digimundo") o B se retira? · ❓ Abierta
- **Por qué importa:** mantener dos motores, dos formatos de mundo y dos persistencias duplica todo
  el trabajo y ninguno de los dos hereda las mejoras del otro. Afecta al alcance de la migración.

### PJ2 — ¿Qué "resultados reales del `/dashboard`" desbloquean etapas, exactamente? · ❓ Abierta
- **Por qué importa:** es el corazón del diseño. Los módulos disponibles hoy son tickets, proyectos,
  calendario, finanzas, suscripciones, pensamientos, centralizado. Necesito saber qué eventos
  concretos (¿cerrar un ticket? ¿asistir a una reunión? ¿registrar pensamientos N días seguidos?)
  emiten señal al juego, para diseñar el bus de eventos y la máquina de estados server-side.

### PJ3 — ¿Qué son "los recursos de la cuenta" que consume el RPG? · ❓ Abierta
- **Por qué importa:** el usuario dice que la jugabilidad **consume recursos que el usuario tiene en
  su cuenta**. ¿Son las mismas fichas, o un recurso distinto (energía/tiempo)? De esto depende si el
  libro contable es uno o varios, y si el fracaso puede dejar a alguien bloqueado sin salida.

### PJ4 — ¿Las fichas se pueden transferir entre usuarios? · ❓ Abierta
- **Por qué importa:** si son transferibles, el riesgo pasa de "farming" a "mercado secundario" y
  cambia por completo el modelo antifraude (y posiblemente sus implicaciones legales/fiscales).

### PJ5 — ¿Se rehace el arte o se conserva LPC? · ❓ Abierta
- **Por qué importa:** las sombras con normal maps de Phaser 4 **exigen normal maps por asset**. El
  set LPC actual (19MB en `public/character/`) no los tiene. Generarlos o rehacer el arte es un coste
  real que hay que decidir antes de prometer "las mejores sombras".

### PJ6 — ¿Móvil es requisito? · ❓ Abierta
- **Por qué importa:** hoy el control es 100% teclado y el canvas de mundo completo **ya revienta en
  iOS**. Si móvil es requisito, el chunking del render deja de ser optimización y pasa a bloqueante.

## Objetivo ANTERIOR (declarado 2026-07-19, 2ª parte) — Módulo "Pensamientos" + etiquetado IA nocturno

**Rol asumido:** arquitecto full-stack + diseño de visualización de datos.

### Necesidad (base verbatim del usuario)
Módulo donde candidatos y miembros capturan pensamientos rápidamente (texto corto o lectura
amplia). Panel izquierdo con las fechas en que se escribió; al elegir una, sus pensamientos.
Modal con gráfico de puntos unidos = cantidad por fecha, más un indicador de **intensidad** basado
en la cantidad de texto. Otro gráfico con la **categoría** que una IA asigna **cada noche a la
01:00** a los pensamientos sin etiquetar: mental (filosófico/salud mental/reflexión de vida),
social (personas, realidad social), laboral (relaciones laborales, metas laborales o proyectos
personales), corporal (salud física, autocuidado, alimentación, medicación). Ese gráfico muestra
cantidad por tipo en el mes e intensidad mensual por caracteres.

### Hallazgos clave (verificados en el código)
- **Las 4 categorías YA EXISTEN**: son las `DIMENSIONS` de `lib/centralized/apoyo.ts:24-31`
  (laboral·corporal·mental·social, con color). Se reutilizan como fuente única en vez de inventar
  una lista nueva.
- **OpenAI**: el repo llama por `fetch` directo a `/v1/chat/completions` con
  `response_format: json_object` y valida a mano tras el `JSON.parse` (`lib/openai.ts`,
  `apa-extract/route.ts`). La dependencia `openai` solo se usa para audio.
- **NO hay ninguna infraestructura de tareas programadas**: sin `node-cron`, sin cola, sin
  `railway.json`/`Procfile`/`Dockerfile`. Producción arranca con `next start -p $PORT`.
  El patrón que sí existe es **endpoint protegido por secreto compartido** llamado desde fuera
  (`lib/centralized/percepcion-worker.ts`, cabecera `x-worker-token`, fail-closed).
- **No hay librería de gráficos** (solo `react-force-graph-2d` para el grafo). El repo dibuja a
  mano (`CriteriaSections.tsx`, `KnowledgeGraph.tsx`).
- **`DIM_ICON` estaba duplicado en 3 archivos** — habría sido la 4ª copia.

### Decisiones del usuario (2026-07-19) — ✅ resueltas
- **Cron:** servicio de tipo **Cron en Railway**. (Sí hace falta algo externo.)
- **Privacidad:** los pensamientos son **solo del autor**. *Matiz del usuario:* más adelante un
  sistema del Centralizado accederá a los de todos **por políticas internas de la organización**.
- **Alcance:** módulo **aislado** por ahora. *Matiz del usuario:* después, desde **Gestión Social →
  Recursos**, se usarán para dar una **valoración global** de talentos y valores (spec completa
  registrada en `MEMORIA.md` → "PENDIENTE acordado"). Ojo: esa puntuación es **fija, no
  acumulativa** (semántica distinta del ±1 de tareas).

### Construido y verificado (2026-07-19)
- `lib/centralized/pensamientos.ts` (puro: categorías, TZ, bandas de intensidad) ·
  `pensamientos-db.ts` (DDL + consultas + stats) · `pensamientos-ai.ts` (clasificador) ·
  `pensamientos-runner.ts` (trabajo nocturno) · `lib/cron-auth.ts` (`CRON_TOKEN`).
- Rutas `api/pensamientos/{,[id],stats,cron/etiquetar}` · página · `ThoughtCharts.tsx` ·
  `scripts/pensamientos-cron.mjs` · sidebar + `MODULE_ACCESS` + módulo bloqueable.
- `components/centralized/dimensionIcons.ts` (`DIMENSION_ICON` + `DIMENSION_SHAPE`) y **migradas
  las 3 copias duplicadas**.
- **Verificación:** `tsc` + `next build` OK · **IA contra OpenAI real 6/6** (incluye casos cortos y
  ambiguos) · **BD real 13/13 con ROLLBACK** (agrupación por día local, filtro por fecha, privacidad
  por fila, series mensuales, cola del nocturno, idempotencia de `setCategory`, limpieza de
  categoría al editar, bitácora). Tablas `pn_thoughts`/`pn_tagging_runs` **creadas en producción**
  (vacías, confirmado).

### Lección técnica — separar constantes puras de la capa de datos
`intensityOf` vivía en `pensamientos-db.ts`, que importa `pool`. Importarlo desde un componente
`'use client'` habría arrastrado Postgres al bundle del navegador. Se partió en `pensamientos.ts`
(puro) + `pensamientos-db.ts`, el mismo corte que ya existía en `apoyo.ts` / `apoyo-db.ts`.
**Regla:** toda constante que consuma el cliente vive en un módulo sin `pool`.

### Lección de visualización — el color se valida, no se opina
Al validar `DIMENSION_COLOR` con un comprobador de daltonismo: **mental ↔ corporal ΔE 3.7 en
deuteranopia** (mínimo 8) y dos colores por debajo de 3:1 de contraste en claro. No se cambió la
paleta (es canónica en media app); se compensó con **forma de marcador + icono + vista de tabla**.
También se evitó el error clásico de poner intensidad como **segundo eje Y**: va como tamaño de
punto o en un gráfico aparte.

### Infraestructura desplegada (2026-07-19) — Railway, hecho por mí a pedido del usuario
- Proyecto **Servidor-GCC**: creado el servicio **`pensamientos-cron`** (mismo repo) con
  `0 6 * * *` (UTC = 01:00 Ecuador), `node scripts/pensamientos-cron.mjs`, `restartPolicyType=NEVER`,
  **build anulado** (el disparador no usa dependencias) y `watchPatterns` acotado al script.
  `CRON_TOKEN` (43 car. aleatorios) en el servicio web y en el de cron; `APP_URL` en el de cron.
- El **CLI de Railway no expone `cronSchedule`/`startCommand`** → se usó su **API GraphQL**
  (`serviceInstanceUpdate`) con el token del propio CLI.
- **⚠️ Lección cara: cambiar el cron NO surte efecto sin REDESPLEGAR.** El despliegue vigente
  conserva el snapshot de configuración anterior. Dos disparos programados pasaron de largo con el
  horario ya cambiado; solo tras `serviceInstanceDeployV2` se ejecutó. Lo descubrí porque probé el
  disparo real en vez de darlo por bueno al ver la config correcta en la API.
- Docs de Railway: intervalo mínimo **5 minutos**, todo en **UTC**, y el servicio **debe terminar**
  (si sigue vivo, se salta la siguiente ejecución).
- **Verificado en producción:** 401 sin token · 401 con token inválido · 200 con el correcto ·
  4 pensamientos reales → **4/4 etiquetados por la IA** · disparo real del cron visto en sus logs ·
  datos de prueba borrados (`pn_thoughts` y `pn_tagging_runs` en 0).

### Progreso
- **% de información para el objetivo:** 100% — construido, desplegado y verificado de extremo a
  extremo en producción. Sin pendientes del usuario.

## Objetivo ACTUAL (declarado 2026-07-19) — Sistema "Gestión Social" (Centralizado · CONTROLADOR · gestión) + módulo "Experiencias"

**Rol asumido:** arquitecto full-stack de la plataforma GCC World (modelo de datos Postgres +
Next.js App Router + integración con el motor de puntuación de talentos/valores).

### Necesidad (base verbatim del usuario, 2026-07-19)
Dos piezas acopladas:
1. **Sistema "Gestión Social"** — nuevo sistema del Centralizado, piso **controlador**, paso
   **gestión** (celda **"Soluciones"**). Tres pestañas: **Eventos** (única funcional ahora),
   **Recursos** y **Discusión** (vacías, para futuro).
   - En Eventos se **generan eventos**; cada evento contiene un **conjunto de tareas**.
   - Cada tarea lleva **etiquetas de valores y talentos** (igual que el Horario de Vida) y una
     propiedad **plazas** = cuántas personas pueden tomarla.
   - El usuario del sistema marca **INICIO** del evento manualmente (aunque tenga fecha/hora
     asignada) y después marca **FIN**.
   - Al finalizar: se conservan las tareas marcadas **completadas**; las tomadas y **no**
     completadas pasan automáticamente a **no completado** (`failed`).
   - **Filtro de estado de eventos** con el patrón de rail de la app (icono + label + conteo).
2. **Módulo "Experiencias"** (dashboard, nuevo) — el miembro ve los eventos publicados, entra a
   uno, revisa sus tareas, **toma una tarea si quedan plazas** y confirma asistencia. Esa tarea
   se **auto-asigna en su "Mi día"**, con **etiqueta distintiva** de que viene de Gestión Social,
   y queda **bloqueada** (no puede marcar completada/fallida) mientras el evento no esté iniciado.

### Hallazgos de investigación en el repo (2026-07-19) — verificado leyendo el código

**A. Cómo se registra un sistema del Centralizado** (NO hay array de registro único; son 2 sitios):
- Ruta 100% dinámica: solo existen `app/(dashboard)/dashboard/centralized/page.tsx` y
  `app/(dashboard)/dashboard/centralized/[piso]/[paso]/[slug]/page.tsx`. Los pisos/pasos son
  constantes en `lib/centralized/systems.ts:9-21`; la celda sale de `CELL_MAP` (`systems.ts:49-54`).
  **`controlador` × `gestion` = celda "Soluciones"** ✅.
- **(1) Fila sembrada en Postgres**: `INSERT … WHERE NOT EXISTS` por slug dentro de `ensureTable()`
  en `app/api/centralized/systems/route.ts:30-132` (el de `percepcion-social` está en :111-117).
  Tabla `gcc_world.centralized_systems (id,name,description,piso,paso,cell_name,is_active,slug)`.
  **No hay columna `icon`.**
- **(2) Rama en el ternario** de `[piso]/[paso]/[slug]/page.tsx:110-141` que mapea slug → componente.
  Sin esa rama, un sistema creado en BD cae al fallback "La interfaz estará disponible pronto".
- Añadir un sistema = seed SQL + import/rama en el ternario + componente en
  `components/centralized/systems/` + `lib/centralized/<x>-db.ts` + rutas `app/api/centralized/<x>/`.
- **Control de acceso**: en `app/api/centralized/systems/route.ts:164-184` — un miembro ve los
  sistemas de **su piso y los pisos por debajo**, pero **solo en su paso exacto**
  (`pisosAtOrBelow`, `systems.ts:32-43`); admin lo salta todo; escape hatch =
  `centralized_member_access` (ShareAccessModal). ⚠️ Ese filtro vive SOLO en `systems/route.ts`;
  las rutas de datos de cada sistema solo comprueban `['admin','member']`.

**B. Cómo las tareas puntúan talentos y valores** (el corazón del acople):
- Listas canónicas (fuente única, hardcoded, NO son tablas):
  `lib/centralized/valores.ts` → `VALORES` = 9 `{key,label}`; `lib/centralized/talentos.ts` →
  `TALENTOS` ≈600 strings planos. Se eligen con **`components/ui/MultiSelectSearch.tsx`**
  (multi-select con buscador, chips debajo, tope `maxVisible=60`).
  ⚠️ **Los valores se guardan por `key`; los talentos por su string literal.**
- Motor único: **`getSubjectsProfileScores()` en `lib/centralized/horario-db.ts:304-353`**.
  - Une **dos fuentes con el MISMO formato** `(subject_id, status, value_tags, talent_tags)`,
    ambas filtradas a `status IN ('completed','failed')`:
    (1) `hv_schedule` JOIN `hv_task_labels`; (2) `cv_generated_tasks`.
  - Regla: `completed` = **+1** a **cada** etiqueta de la tarea; `failed` = **−1**;
    `pending` **no puntúa** (lo excluye el WHERE). **Sin pesos.**
  - Talentos: `net = c − f`, se descartan `net<=0`, top 10, y cada uno recibe
    `round(net/sum*100)` → **porcentaje RELATIVO al propio sujeto** (no comparable entre personas).
  - Valores: `valuesBalance[v] = {completed, failed}` en crudo (barra divergente).
- Consumo: `getSubjectsCriteria` (`lib/centralized/criteria.ts:11-26`) → `/api/admin/candidates`
  y `/api/admin/team` → `components/centralized/reclutamiento/CriteriaSections.tsx`.
  También ordena candidatos en `app/api/tickets/assignees/route.ts:44-70`.
- 🔑 **Punto de integración**: para que las tareas de Gestión Social puntúen basta con **añadir
  una TERCERA query** con ese mismo shape a `getSubjectsProfileScores`. Sin tocar la fórmula.

**C. Cómo se pintan las tareas FIJAS en "Mi día"** (plantilla exacta a calcar):
- Página: `app/(dashboard)/dashboard/mi-dia/page.tsx` (465 líneas, todo inline; **no hay
  componente TaskCard**). Rail de tareas en :393-424.
- Precedente perfecto = **Comandos Violeta**: tabla `cv_generated_tasks`
  (`lib/centralized/comandos-db.ts:53-76`) con `subject_kind/subject_id/title/detail/
  value_tags/talent_tags/all_day/start_time/end_time/day/status`. Sus filas aterrizan en Mi día
  como entradas **fijas** (el usuario solo cambia estado/etiquetas).
- Distintivo de origen en Mi día: **no hay columna `origin`** — se infiere por tabla/booleanos
  del view-model (`auto`, `gen`, `source`, `policyName`). Iconos: `ShieldCheck` violeta (política),
  `Lock` sky (ticket/proyecto). Color de borde por estado (:396).
- Estado: **`components/centralized/TaskStatusButtons.tsx`** (Completada/Fallida/Pendiente).
  ⚠️ **Hoy NO acepta `disabled`** — habrá que añadírselo (default `false`) para el bloqueo.
- Escritura de estado: 3 endpoints según origen (`/horario/schedule`, `/horario/auto-status`,
  `/horario/generated`), todos optimistas con rollback vía `loadHorario()`.
- ⚠️ Los endpoints de escritura exigen `['admin','member']` → **un candidato puede leer pero no
  marcar estado** (hueco latente ya existente).

**D. El filtro de estado que pidió el usuario (la captura)**
- Es el **"rail" del patrón "Explorador Azure"** (`Diseño.md:104-119`): tarjeta
  `bg-digi-card border border-digi-border rounded-lg p-2` + título
  `text-[10px] font-semibold text-digi-muted uppercase tracking-wide` + ítems
  `w-full flex items-center gap-2.5 px-3 py-2 rounded-md border-l-2`; activo =
  `bg-accent-light border-accent text-accent`; badge de conteo
  `text-[10px] px-1.5 py-0.5 rounded-full tabular-nums`.
- ⚠️ **NO es un componente compartido**: está duplicado inline en ~13 sitios (`RailItem` local en
  clients/tickets/projects/centralized/flows…). El canónico visualmente idéntico a la captura es
  `components/centralized/systems/ReclutamientoSystem.tsx:53-76`.
  → Contradice el principio de "diseño vinculado" de `Diseño.md`; ver Propuestas.

**E. "Experiencias" NO existe** (verificado: ni ruta, ni sidebar, ni componente). Alta de módulo =
  carpeta en `app/(dashboard)/dashboard/experiencias/` + `NavItem` en `NAV_GROUPS`
  (`components/dashboard/DashboardSidebar.tsx:16-58`) + entrada en `MODULE_ACCESS`
  (`lib/dashboard/access.ts:28-49`, roles `'candidate'|'client'|'member'|'admin'`).

### Arquitectura propuesta (borrador — a confirmar con las preguntas abiertas)
Prefijo de tablas **`gs_`**, en `lib/centralized/gestion-social-db.ts` con `ensure` de
**promise-singleton** (patrón de `percepcion-db.ts:20-30`, obligatorio: varios fetch en paralelo).

- **`gs_events`**: `id, name, description, event_date DATE, start_time, end_time, location,
  status ('draft'|'published'|'active'|'finished'|'cancelled'), started_at, ended_at,
  created_by, created_at`.
- **`gs_event_tasks`**: `id, event_id FK ON DELETE CASCADE, title, detail,
  value_tags TEXT[], talent_tags TEXT[], plazas INT, all_day, start_time, end_time, position`.
- **`gs_task_signups`**: `id, task_id FK CASCADE, event_id, subject_kind, subject_id,
  status ('pending'|'completed'|'failed'), signed_up_at,
  UNIQUE(task_id, subject_kind, subject_id)`.
  Plazas disponibles = `plazas − COUNT(signups)`; la toma debe ser **atómica** (ver Riesgos).

Ciclo de vida: `draft → published → (INICIO manual) active → (FIN manual) finished`.
Al pasar a `finished`: `UPDATE gs_task_signups SET status='failed' WHERE status='pending'`.
Bloqueo en Mi día: `TaskStatusButtons` deshabilitado mientras `gs_events.status <> 'active'`.

### Decisiones del usuario (2026-07-19) — todas ✅ resueltas
- **P1 · Una sola tarea por evento y persona.** Un miembro toma **máximo 1 tarea por evento**
  (reparte plazas, evita solapes en Mi día). → `UNIQUE (event_id, subject_kind, subject_id)`
  **además** del unique por tarea. *Por eso `gs_task_signups` lleva `event_id` denormalizado.*
- **P2 · Se puede soltar solo ANTES del inicio.** Con el evento en `published` el miembro puede
  liberar la plaza; con el evento `active` o posterior, ya no (queda comprometido).
- **P3 · Horario del evento, con override por tarea.** La tarea hereda `event_date` +
  `start_time`/`end_time` del evento; si la tarea define horario propio, ese manda
  (`COALESCE(t.start_time, e.start_time)`).
- **P4 · Miembros y candidatos.** Ambos ven Experiencias y pueden tomar tareas (para el candidato,
  demostrar valores es su meta de afiliación). ⚠️ Implica **habilitar la escritura de estado para
  candidatos** en el endpoint de estado de las tareas de Gestión Social (los endpoints de horario
  existentes exigen `['admin','member']`; el nuevo debe resolver el sujeto del logueado y permitir
  candidato **solo sobre sus propias filas**).

### Construido y verificado (2026-07-19)
**Backend**
- `lib/centralized/gestion-social-db.ts` — DDL (promise-singleton) de `gs_events`,
  `gs_event_tasks`, `gs_task_signups` + toda la lógica: listar/crear/editar/borrar eventos y
  tareas, `startEvent`/`finishEvent`, `takeTask`/`releaseTask`, `listEventsForSubject`,
  `getSubjectSocialTasks`, `setSocialTaskStatus`, `sanitizeTags`.
- `lib/centralized/subject.ts` — `resolveSubject()` **extraído** de la ruta de horario
  (definición única; ahora la usan Mi día y Experiencias).
- `lib/centralized/horario-db.ts` — **3ª fuente de scoring** añadida a
  `getSubjectsProfileScores` + `social[]` en `getSubjectHorario`.
- Rutas: `api/centralized/gestion-social/{eventos,eventos/[id],eventos/[id]/estado,
  eventos/[id]/tareas,tareas/[id]}`, `api/experiencias/{,[id],tareas/[id]}`,
  `api/centralized/horario/social`.
- Seed del sistema en `app/api/centralized/systems/route.ts` (slug `gestion-social`).

**Frontend**
- `components/centralized/systems/GestionSocialSystem.tsx` — pestañas Eventos/Recursos/
  Discusión; rail de filtro por estado; lista + panel de detalle; formularios de evento y de
  tarea (con `MultiSelectSearch` de valores/talentos y campo Plazas).
- `components/ui/FilterRail.tsx` — **NUEVO componente compartido** del rail de filtro.
- `app/(dashboard)/dashboard/experiencias/page.tsx` + sidebar + `MODULE_ACCESS` + módulo
  bloqueable en `comandos.ts`.
- `components/centralized/TaskStatusButtons.tsx` — prop `disabled` (para el bloqueo).
- Mi día: tarjeta ámbar punteada con `PartyPopper`, chip **"Gestión Social"**, nombre del
  evento, aviso "Bloqueada hasta que inicie el evento" y botones deshabilitados.

**Verificación**
- `tsc --noEmit` OK · `next build` OK (todas las rutas nuevas registradas).
- **Prueba E2E contra Postgres REAL con ROLLBACK: 23/23 ✅** — DDL idempotente, agregados de
  plazas, bloqueo en draft, una-tarea-por-evento (UNIQUE 23505), plazas agotadas, soltar solo
  en published, inicio/fin manuales, autorización por fila, auto-`failed` al finalizar, las
  3 fuentes de scoring, herencia de horario evento↔tarea, y CASCADE al borrar.
  Confirmado que el rollback no dejó ninguna tabla `gs_*`.

### Ampliación de la misma sesión (2026-07-19), a pedido del usuario
- **Bloques en el calendario:** las tomas se pintan en la grilla de Mi día como `EventInstance`
  sintéticos punteados (ámbar/verde/rojo), fuera del cómputo de horas, con popover de estado que
  respeta el bloqueo; y en el panel "Eventos" con `PartyPopper` + "· evento".
  `EventInstance` ganó **`taskKind: 'policy' | 'social'`** y `socialLocked` — `generated` pasó a
  significar "bloque sintético" y `taskKind` identifica el sistema de origen.
- **Tablas creadas en la BD real** (`gs_events`, `gs_event_tasks`, `gs_task_signups` + índices +
  los 2 unique) y **sistema sembrado** en `centralized_systems` (id 12). El DDL se aplicó
  **extrayendo el SQL del propio `gestion-social-db.ts`** (parseando sus template literals) para
  garantizar cero deriva entre el script y la librería.
- **Verificación extra:** 9/9 con datos reales insertados y luego borrados (ventana [from,to) del
  calendario, horario propio vs heredado, color por estado, `locked`, y que una tarea sin tomar no
  genera bloque en el calendario de nadie).

### Pendientes / notas
- `FilterRail` es nuevo; los ~13 rails duplicados inline siguen sin migrar (ver PROPUESTAS.md).

### Progreso
- **% de información para el objetivo:** 100% — construido y verificado contra BD real.

## Objetivo ANTERIOR (declarado 2026-07-17) — Sistema "Percepción Social" (Centralizado · piso COLABORADOR)

**Rol asumido:** arquitecto full-stack + integrador de IA de visión (Claude CLI local) para GCC World.

### Necesidad (base verbatim del usuario, 2026-07-17)
Primer sistema del **piso Colaborador** del Centralizado. El piso Colaborador permite que los colaboradores
**ejecuten tareas de sistemas delegados** o **generen registros que alimentarán sistemas futuros**.

**Sistema "Percepción Social" = capturar eventos del entorno del sujeto que usa la app:**
1. El usuario envía a la app su **ubicación actual** (GPS).
2. Con la **cámara del dispositivo** toma un **conjunto de fotos** del entorno.
3. Las fotos + un **prompt** se envían a una **IA** que analiza cada imagen y **distingue los elementos**
   presentes: **objetos, animales o personas**.
4. La IA entrega, por cada elemento, **todas las propiedades** que reconozca (color del árbol, raza del
   animal, tipo de cabello de la persona, etc.) — análisis libre, la IA decide qué propiedades reporta.
5. El resultado se **registra en la app**; luego, dentro del mismo sistema, se puede **acceder y revisar**
   lo interpretado por la IA.

**Backend IA:** un **servidor local conectado con el Claude CLI** recibe el conjunto de imágenes + prompt,
analiza y devuelve el resultado (MISMO patrón que el agente de Gestión de Datos — local-only).

**Propósito / futuro:** estos registros alimentarán a futuro un sistema que dibuja un **mapa real** y
**simula el mundo real** (objetos/animales/personas en los terrenos). Ese mundo virtual será una **pieza
clave del futuro Sistema de Control Psicosocial** (piso global · paso creación, celda "Control Psicosocial").

**Interfaz:** el usuario pide **creatividad** para navegar y acceder al contenido del sistema.

### Hallazgos de investigación en el repo (2026-07-17) — todo verificado por exploración del código
- **Cómo se agrega un sistema al Centralizado** (dirigido por datos, no páginas hardcodeadas):
  1. `lib/centralized/<sys>-db.ts` con `ensure<Sys>Tables()` (patrón `CREATE/ALTER/INDEX IF NOT EXISTS`,
     prefijo de tabla propio; **guard promise-singleton** anti-DDL-concurrente como `gestion-datos-db.ts:24-34`).
  2. `app/api/centralized/<sys>/.../route.ts` (llaman a `ensure<Sys>Tables()`; auth `getCurrentUser` + roles).
  3. `components/centralized/systems/<Sys>System.tsx` (recibe `{ system, isAdmin }`).
  4. Registrar el componente en el switch de `app/(dashboard)/dashboard/centralized/[piso]/[paso]/[slug]/page.tsx`.
  5. Sembrar el sistema con `INSERT ... WHERE NOT EXISTS` en `ensureTable()` de
     `app/api/centralized/systems/route.ts` (piso/paso/cell_name/slug exactos). `CELL_MAP` está **duplicado**
     en `lib/centralized/systems.ts` y en esa route → mantener en sync.
  - **Modelo 4P:** pisos = global/pilar/controlador/colaborador; pasos = fundamentacion/creacion/implementacion/
    gestion. `colaborador·fundamentacion = "Investigador"` (ya lo ocupa Dinámica Condiciológica; pueden coexistir
    varios sistemas por celda).
- **Patrón Claude CLI local** (a calcar de `lib/centralized/pesos-agent.ts`):
  - `execFile(claudeBin(), ['-p', input, '--output-format','json','--permission-mode','bypassPermissions', ...])`,
    `cwd` neutral, `maxBuffer` grande, `timeout`. `claudeBin()` = `CLAUDE_CLI_PATH` → `$HOME/.local/bin/claude` → `claude`.
  - Parseo de dos capas: `JSON.parse(stdout)` → `parsed.result` + `parsed.session_id`; luego `parseAction` extrae el
    JSON que el modelo escribió dentro de `result` (tolerante a fences/prosa).
  - Sesión: `claude_session_id` viaja al cliente y se reinyecta con `--resume`; `--system-prompt` (REEMPLAZA) solo
    en el 1er turno. Reencuadre "tarea de transformación de texto, tu salida es UN JSON" para quitar identidad de coder.
  - **Local-only:** el binario `claude` corre como `child_process` DENTRO del server Next.js local; **no funciona en
    Railway** (igual que el agente de pesos). Feature interna.
  - **CLAVE para imágenes:** hoy NINGUNA invocación pasa imágenes (todo texto). El Read tool de Claude Code **lee
    imágenes visualmente** → estrategia: **escribir las fotos a disco (rutas absolutas) y pasarlas en el prompt
    PERMITIENDO la tool `Read`** (el agente de pesos la deshabilita; aquí NO), con `cwd` = carpeta de esas fotos.
- **Imágenes/subida (reutilizable):** `lib/cloudinary.ts` (`uploadImage`/`uploadImages` → `secure_url`, fallback
  base64); patrón multipart `app/api/users/avatar/route.ts` (recibe `File`→arrayBuffer→base64→Cloudinary); multi-archivo
  por registro en `incidents/[id]/images` y `projects/[id]/images` (columna `TEXT[]`, POST append / GET / DELETE por índice,
  **array Postgres es 1-based**). Servido optimizado con `sharp`.
- **Cámara:** NO existe captura (`getUserMedia`/`capture=`) en el repo → se construye desde cero. HTTPS disponible
  (`server.cjs`, `npm run dev:https`) — requisito para cámara+GPS fuera de localhost.
- **Geolocalización:** NO existe (`navigator.geolocation` a cero) → desde cero. Sin columnas GPS en BD.
- **Mapas:** solo el mundo gamificado por tiles (grid discreto, no geográfico). **No hay librería de mapa geográfico**
  instalada (ni leaflet/maplibre/mapbox). Grafo canvas reutilizable: `react-force-graph-2d` (`GdGraph`/`KnowledgeGraph`/
  `PolicyGraph`) + `FloatingWindow` (arrastrable/redimensionable).
- **UI estándar:** patrón "Explorador Azure" (rail Pisos + lista + panel) y grafo canvas oscuro + panel glass (Diseño.md).

### Arquitectura propuesta (borrador, a confirmar con las preguntas abiertas)
- **Slug:** `percepcion-social`. **Piso:** colaborador. **Paso:** por confirmar (propuesta: `fundamentacion`, celda "Investigador").
- **Modelo de datos (prefijo `ps_`):**
  - `ps_capturas` (id, user_id, session_id, lat, lng, accuracy, direccion?, capturado_en, estado
    [pendiente|analizando|analizado|error], claude_session_id?, resumen?, notas?).
  - `ps_fotos` (id, captura_id FK, url [Cloudinary], orden, width?, height?).
  - `ps_elementos` (id, captura_id FK, categoria [objeto|animal|persona], nombre, confianza?, resumen?,
    propiedades JSONB [libres, lo que la IA reconozca], foto_indices? [en qué fotos aparece]).
- **Flujo:** cámara (getUserMedia) toma N fotos + GPS → POST multipart → server sube a Cloudinary (persistencia/UI)
  y **escribe copias a disco temporal** → invoca Claude CLI con prompt + rutas absolutas (tool Read habilitada) →
  la IA devuelve JSON `{ resumen, elementos:[{categoria,nombre,propiedades,foto_indices,confianza}] }` → server
  persiste elementos → estado `analizado`. Alcance forzado en server (solo las fotos de ESA captura).
- **UI (creativa):** (1) **Modo Captura** — botón grande "Nueva captura del entorno" → cámara + preview de fotos +
  GPS auto → enviar. (2) **Explorador** — rail (estado/fecha) + lista/galería de capturas georreferenciadas + panel de
  detalle. (3) **Detalle** — galería de fotos + elementos agrupados por categoría (objetos/animales/personas) con sus
  propiedades; opción de **grafo** captura→elementos→propiedades (motor reusable). (4) A futuro: pins en mapa real.

### Decisiones del usuario (2026-07-17) — todas resueltas
- **P1 — Paso:** ✅ **Gestión** → `colaborador/gestion`, celda **"Líder"**. URL `/dashboard/centralized/colaborador/gestion/percepcion-social`.
- **P2 — Captura de cámara:** ✅ **in-app con `getUserMedia`** (video en vivo + tomar varias fotos con preview/borrar). Requiere HTTPS fuera de localhost (`npm run dev:https`).
- **P3 — Mapa:** ✅ **solo coordenadas + link a Google Maps** por ahora (el mapa real se deja para el sistema futuro dedicado). NO se instala librería de mapas.
- **P4 — Visibilidad:** ✅ **privadas por colaborador** (cada quien ve las suyas; el admin ve todas). Alcance forzado en la capa DB (`ownerClause`) y en las rutas (`getCurrentUser` + rol).
- **P5 — Análisis por conjunto:** ✅ la IA analiza el **conjunto** de fotos y devuelve **UNA lista consolidada** de elementos con `foto_indices`.

### Construido y verificado (2026-07-17)
- **Backend:** `lib/centralized/percepcion-db.ts` (tablas `ps_capturas`/`ps_fotos`/`ps_elementos`, promise-singleton, CRUD con propiedad forzada) · `lib/centralized/percepcion-agent.ts` (Claude CLI local: escribe fotos a `mkdtemp`, `claude -p ... --allowedTools Read --system-prompt`, cwd=dir temporal, parseo 2 capas + normalizadores) · rutas `app/api/centralized/percepcion/capturas/{route,[id]/route,[id]/analyze/route}` (multipart→Cloudinary; analyze `maxDuration=300`).
- **Registro:** semilla en `systems/route.ts` `ensureTable` (colaborador·gestion·Líder·percepcion-social) + rama en el switch de `[piso]/[paso]/[slug]/page.tsx`.
- **Frontend:** `components/centralized/systems/PercepcionSocialSystem.tsx` — rail (Nueva captura + filtros con conteos) + galería de capturas + panel de detalle (fotos con `ImageGallery`, elementos agrupados por objeto/animal/persona con chips de propiedades, link Maps) + **overlay de cámara** (getUserMedia `facingMode:environment`, canvas→blob, GPS auto, tira de fotos). Auto-analiza tras guardar.
- **Verificación:** `tsc --noEmit` limpio · `next build` OK (3 rutas API registradas) · **PRUEBA EN VIVO DEL CLAUDE CLI VISION:** replicando los args del agente sobre `public/PaisajeVioleta1.png`, `claude` **leyó la imagen con Read** (2 turnos) y devolvió el JSON exacto esperado (`resumen` + 13 `elementos` con categoria/nombre/confianza/propiedades/foto_indices), `is_error:false`, ~36s. **El mecanismo de visión headless FUNCIONA.**
- **Lección técnica clave (visión con Claude CLI):** para que el modelo VEA imágenes en modo headless, hay que (1) escribirlas a disco, (2) pasar sus **rutas absolutas** en el `-p`, (3) **`--allowedTools Read`** (Claude Code lee imágenes visualmente), (4) `--system-prompt` que lo reencuadre como analista visual "tu única salida es UN JSON" (NO coder), (5) `cwd` = dir temporal de las fotos. Devuelve el JSON dentro de `parsed.result` → parseo de 2 capas.
- **Local-only (modelo inicial, DESCARTADO):** al principio el server ejecutaba `claude` in-process → solo funcionaba con Next local, no en Railway.

### REFACTOR a "worker local + app web" (decisión usuario 2026-07-18)
El usuario aclaró que quiere **capturar desde la web publicada** dejando un procesador local encendido. Se refactorizó al
modelo desacoplado que él había descrito al inicio ("servidor local conectado con claude cli"):
- La app (local/Railway) **solo guarda** capturas como `pendiente`. El **worker local** (`scripts/percepcion-worker.mjs`)
  sondea, reclama, analiza con `claude` y devuelve el resultado. Auth por **token compartido** `PERCEPCION_WORKER_TOKEN`.
- Cambios: se eliminó `percepcion-agent.ts` (server ya no ejecuta claude); `[id]/analyze` ahora **re-encola** (no spawnea);
  nuevos `worker/pending` (claim atómico `FOR UPDATE SKIP LOCKED` + re-reclamo de colgadas >10min con `claimed_at`) y
  `worker/result` (persiste); `percepcion-db.ts` ganó `claimForWorker`/`requeueCaptura`/columna `claimed_at`; el
  componente ahora **encola + hace polling** (pendiente="en cola", analizando=spinner, error=reintentar) en vez de
  análisis in-process. La lógica de visión vive ahora SOLO en el worker `.mjs` (autónomo, `--once` para cron).
- **HTTPS (aclaración al usuario):** la cámara/GPS exigen contexto seguro; la web (Railway) ya es HTTPS → funcionan. `dev:https`
  solo hace falta para pruebas locales desde otro dispositivo (no localhost). El HTTPS NO es la limitación; la limitación
  era el Claude CLI, ahora resuelta con el worker.
- **Config despliegue:** server (local+Railway) `PERCEPCION_WORKER_TOKEN`; worker `PERCEPCION_WORKER_TOKEN`+`PERCEPCION_APP_URL`
  (+opc `CLAUDE_CLI_PATH`/`PERCEPCION_POLL_MS`/`PERCEPCION_BATCH`) → `node scripts/percepcion-worker.mjs`.

### Progreso
- **% de información para el objetivo: 97%** — sistema construido y **verificado end-to-end**: `tsc`+`next build` OK (5 rutas
  API) + prueba REAL del worker (dev server con token → captura pendiente en BD → `worker --once` reclamó, llamó a `claude`,
  reconoció 18 elementos con propiedades y devolvió el resultado → captura `analizado`; datos de prueba borrados). Falta solo
  la **validación visual in-app** en el navegador (login + cámara + GPS), no realizable sin sesión/dispositivo.

---

## Objetivo ACTUAL (declarado 2026-07-12) — Agente IA (Claude CLI) que genera PESOS de una premisa desde Scopus

**Necesidad:** desde una **fuente premisa** seleccionada, lanzar un **agente conversacional** que:
- Lee el **contenido de la premisa** para entender QUÉ buscar.
- Busca en **Scopus** datos de los **últimos 5 años** (el agente decide cómo buscar/filtrar).
- Genera **pesos** (cantidad/cualidad) que refuerzan la premisa, **aprendiendo la redacción** de los pesos ya existentes.
- **Cada peso lleva su referencia bibliográfica** (Scopus/Crossref → gd_referencias).
- Sesión **conversacional que queda abierta**: pedirle más búsquedas/más pesos y **modificar** los pesos ya agregados EN ESTA sesión.
- **Alcance estricto:** la sesión solo trabaja sobre **los pesos que ella misma añade** a la premisa elegida; NO sobre pesos previos, ni otras premisas, ni pesos de otras premisas.
- **Backend IA:** NO usa la API key de OpenAI. Usa el **Claude CLI del servidor local** (headless).
- **UI:** botón en la premisa → **modal de chat arrastrable/redimensionable** (reusar `FloatingWindow`).

### Viabilidad verificada (2026-07-12)
- **Claude CLI** instalado (`~/.local/bin/claude`, v2.1.207) y **autenticado**. `claude -p "…" --output-format json --max-turns 1` → `{"result":"OK","session_id":…,"total_cost_usd":~0.10}`. Soporta `--resume <session_id>` (continuar sesión), `--mcp-config`, `--allowedTools`, `--append-system-prompt`, `--permission-mode bypassPermissions`, `--input/output-format stream-json`.
- **`FloatingWindow`** ya es **arrastrable + redimensionable** (barra move + 8 tiradores). Se reusa.
- **Scopus + Crossref**: ya integrados (`lib/centralized/scopus.ts`).
- Precedente de spawn de procesos: `lib/dev-servers.ts` (child_process).

### Arquitectura propuesta (decisión de diseño)
**Bucle de agente orquestado por NUESTRO servidor** (no MCP), para máximo control del alcance:
- Un turno = `claude -p --resume <sid> --output-format json` con un **system prompt** que le da el contexto (contenido de la premisa, ejemplos de estilo, pesos de la sesión) y le indica que responda con **acciones JSON**: `scopus_search`, `add_weight`, `update_weight`, `delete_weight`, `message`.
- NUESTRO servidor **ejecuta** cada acción (Scopus/Crossref/DB) — así el alcance ("solo pesos de esta sesión") se **fuerza en el servidor**, no confiamos en el modelo — y reanuda la sesión con el resultado hasta que el agente emita `message` final.
- **Scoping:** columna nueva `gd_fuentes.agent_session_id`; las acciones update/delete solo tocan pesos con ese `session_id` + esa premisa. Los pesos son reales (aplicados a la premisa vía `gd_fuente_pesos`), quedan tras la sesión.
- **Solo local:** el `claude` CLI vive en el equipo local; en Railway no está autenticado → feature **local-only** (herramienta interna). Coste ~$0.10/turno de la cuenta Claude del usuario.

### Decisiones del usuario (2026-07-12)
- **P-A1 Guardado:** se guardan **al momento** (pesos reales aplicados a la premisa, modificables en la sesión).
- **P-A2 Estilo:** aprende de **todos** los pesos existentes (muestra de 15, solo lectura).
- **P-A3 Credibilidad:** la **estima el agente** (recencia/revista/citas).

### Lección técnica clave — encuadre del Claude CLI como agente de protocolo JSON
- `claude -p` trae la **identidad de "agente de programación"** de Claude Code; con `--append-system-prompt` el
  modelo se confundía ("no tengo acceso al repo", inventaba acciones, decía "me faltan herramientas").
- **Fixes que lo resolvieron:** (1) **`--system-prompt`** (REEMPLAZA el prompt, no append) — quita la identidad
  de coder. (2) **NO** usar `--exclude-dynamic-system-prompt-sections` (causaba respuestas VACÍAS). (3) **cwd
  neutral** (`os.tmpdir()`) para no cargar el CLAUDE.md del repo. (4) **Reencuadre del prompt**: "TAREA DE
  TRANSFORMACIÓN DE TEXTO; no dispones de herramientas ni las necesitas; tu única salida es UN JSON en texto
  plano que un programa externo ejecuta; así 'buscas' y 'guardas'". (5) `--disallowedTools` de las tools del CLI.
  (6) recordatorio de acciones válidas en cada RESULTADO. Con esto el loop completa: reformula si no hay DOI,
  agrega pesos con DOI y termina con message. Verificado con Scopus real.
- **Solo local:** el `claude` CLI vive en el equipo local (no en Railway). Coste ~$0.10+/turno de la cuenta Claude.

### Progreso
- **% de información para el objetivo: 100%** — implementado y verificado (tsc+build; loop real claude+Scopus;
  alcance de sesión en BD con ROLLBACK). Falta solo la **validación visual en vivo** (login) del chat.

---

## Objetivo previo (declarado 2026-07-11) — Sistema "Gestión de Datos" en Centralizado

**Necesidad:** nuevo sistema en `/dashboard/centralized`, piso **pilar**, paso **fundamentación**
(slug propuesto `gestion-de-datos`). Gestiona y ordena los **datos recolectados** aplicando la
**condiciología** como método de clasificación de datos (para objetos/materias de conocimiento, no para
comportamientos). Interfaz **calcada de Comandos Violeta**: panel lateral izquierdo (aquí = lista de
**Problemáticas**) + panel derecho "universo de gráficos" (grafo) para operar toda la tubería de
clasificación. **UI genérica todavía por afinar; foco primero en el modelo de datos + motor de
nomenclatura correctos.**

### Rol asumido
**Arquitecto de datos + ingeniero full-stack (Next.js 15 App Router + Postgres crudo `pg`, schema
`gcc_world`)**, con foco en un **motor de nomenclatura/clasificación** determinista y en replicar el
patrón grafo+paneles de Comandos Violeta.

### La tubería de clasificación (9 niveles) — base verbatim del usuario (2026-07-11)
> La **condiciología** = estudio de las condiciones a través de instancias (evalúa comportamientos por
> factores generales, cada factor con causas específicas). Para **objetos/materias de conocimiento** la
> evaluación NO usa condiciones sino el **método de este sistema** (abajo).

**0. Problemática (carpeta raíz).** Se crea PRIMERO. Al crearla se le asigna una **referencia de máx. 4
letras** (p.ej. `NROF`) que heredarán sus fuentes de tipo premisa. Al seleccionarla se ve TODO el proceso
de gestión de datos de esa problemática. Dentro de una problemática seleccionada se puede: **agregar
fuentes**, **agregar problemas**, crear códigos, categorías, ver piezas, generar rompecabezas, subtemas,
temas.

**1. Fuente (entrada de datos).** Es la ENTRADA; hoy **manual**, a futuro robots/conexiones que buscan y
recolectan datos del tema. Cada fuente tiene **3 propiedades**:
  - **Nivel de confianza / credibilidad** (numérico).
  - **Tipo de dato:** `cantidad` (p.ej. "30 de cada 100 niños entran a escuela particular") | `cualidad`
    (p.ej. "se observó cómo los jóvenes se molestaban con el que alertaba a la profesora").
  - **Tipo de lógica:** `premisa` (aplica a una premisa lógica) | `peso` (aporta peso/credibilidad a otra
    fuente).
  - **Nomenclatura de fuente:**
    - premisa → `<REF>-<seq>`, con **seq por problemática** (p.ej. `NROF-1`, `NROF-23`).
    - peso → `Ref-<seq>`, con **seq GLOBAL** (independiente de la problemática; p.ej. si en la 1ª
      problemática llegué a `Ref-5`, la 1ª peso de la 2ª problemática es `Ref-6`).

**2. Código (premisa/verdad consecuente).** Resultado de **juntar premisas** (fuentes premisa) que por
lógica dan una **verdad consecuente** (= premisa lógica). Puede juntar **varias** premisas (no solo 2).
  - **Nomenclatura:** `COD-<REF>-<u1>/<u2>/…/<uN>`, donde cada `u` es una unidad-premisa de esa
    problemática. Ej.: `COD-NROF-1/23`, `COD-NROF-1.45/12`.
  - **Fuentes de tipo peso** sobre una fuente premisa: **no cambian** la nomenclatura de la premisa; ajustan
    su credibilidad (**promedio** entre ambas). Una fuente peso puede **sumar** o **contradecir**. Repetir la
    misma verdad ⇒ más creíble (a más repetición, mayor credibilidad).
  - **Enfrentamiento de dos premisas** (una premisa puede contradecir a otra SIN ser peso): se enfrentan dos
    fuentes premisa y por **credibilidad** una queda por encima; se **fusionan en UNA sola premisa** que junta
    la verdad de ambas (texto de la premisa combinada lo escribe **manualmente** el usuario). Nomenclatura de la
    premisa enfrentada: `<REF>-<ganadora>.<perdedora>` (p.ej. `NROF-1.45` → ganó 1, perdió 45). Usada en un
    código: `COD-NROF-1.45/12`.
  - **Verificación:** un código nace **NO verificado**. Se verifica con **pruebas empíricas** reales
    (estudios propios / demostración en vivo). Cada código tiene una **lista de eventos** (título + **url**:
    video grabado o streaming en vivo) que evidencian la demostración. Solo un código **verificado** puede
    pasar a **categorías**.

**3. Categoría.** Agrupa **códigos verificados** (para reutilizarse a futuro en el sistema "encuadre
condiciológico"). Tiene número secuencial (cat-1, 2, 3…). **Nomenclatura:** `CAT-<seq>-<nomenclatura del/los
código(s)>` (ej. `CAT-1-COD-NROF-1.45/12`).

**4. Pieza.** **NO se crea desde este sistema** (viene del futuro sistema "metodología condiciológica"),
pero **sí se visualiza** aquí. Un experto en condiciología **revisa o corrige** los códigos que llegan y
devuelve una pieza que puede juntar **varios códigos** o usar **solo uno**. Dos tipos:
  - `revisión` = **añade variables** a un código con datos fijos. Nomenclatura `PIE.REV-<nomencl. categoría>`
    (ej. `PIE.REV-CAT-1-COD-NROF-1.24/12`).
  - `corrección` = **convierte el código completo** en variables distintas. Nomenclatura `PIE.COR-…`
    (ej. `PIE.COR-CAT-1-COD-NROF-1.24/12`).
  - Las variables dependen de **3 factores globales**: `mental`, `corporal`, `ambiental`. Hay **variables
    fijas** y **variables que cambian**. Cada variable puede traer **restricciones** (definidas desde el
    sistema de metodología condiciológica): p.ej. "aplica más de uno", listado de variables NO aceptadas, o
    "solo se une con variables de ciertas categorías". Estas restricciones gobiernan el nivel siguiente.

**5. Rompecabezas.** Une **piezas** para responder a una **situación**; la **lógica valida** si las piezas
pueden unirse según las **restricciones** de sus variables. Es como una **fórmula/expresión** cuyos
parámetros son las variables de las piezas usadas; distintas uniones ⇒ distintas expresiones/realidades.
  - **Nomenclatura: NINGUNA codificada** → se le asigna un **nombre manual** (p.ej. "Evento laboral de
    Desesperación"), legible, para usarse a futuro en "dinámica condiciológica".
  - Al crear se elige: **situación** (categoría de una lista de "situaciones" que se compartirá luego) +
    **unión de piezas** + **nombre**.

**6. Subtema.** **Título** que agrupa rompecabezas en un **orden manual** para transmitir una idea = una o
más **hipótesis** (producto final del subtema). Al crear: **título** + **lista de hipótesis**. **Sin
nomenclatura.**

**7. Tema.** Agrupa **subtemas**; **describe toda la realidad en prosa** conectando el contenido de todos los
subtemas **sin inventar** lógicas nuevas — **excepto las hipótesis** de los subtemas, que deben quedar
**distinguidas** dentro del documento del tema. Tiene **título**. **Sin nomenclatura.** Se asocia a
**materias** y a **problemas**.

**8. Materia.** Área de conocimiento (física, psicología, química, software…). **Lista global** (como
"situaciones"). Un tema se asocia a las materias que usó como conocimiento.

**Problema.** Existe **dentro de la problemática** (se agrega en la interfaz junto a las fuentes). Un **tema**
se asocia a **problemas**; los problemas están conectados por origen a la problemática.

### Elementos GLOBALES (no por-problemática)
- **Secuencia de fuentes tipo peso** (`Ref-N`) — global.
- **Materias** — lista global.
- **Situaciones** (categorías de rompecabezas) — lista global (definición fina la comparte el usuario luego).

### Motor de nomenclatura (resumen determinista)
| Nivel | Nomenclatura | Secuencia |
|---|---|---|
| Problemática | `REF` (≤4 letras, manual) | — |
| Fuente premisa | `REF-<n>` | por problemática |
| Fuente peso | `Ref-<n>` | **global** |
| Premisa enfrentada | `REF-<ganó>.<perdió>` | usa seq de fuentes premisa |
| Código | `COD-REF-<u1>/<u2>/…` (u = `<n>` o `<g>.<p>`) | por problemática |
| Categoría | `CAT-<n>-<cod…>` | (¿global/por-problemática? → confirmar) |
| Pieza revisión | `PIE.REV-<cat…>` | — (viene de otro sistema) |
| Pieza corrección | `PIE.COR-<cat…>` | — |
| Rompecabezas | **nombre manual** | — |
| Subtema / Tema | **título** (sin nomenclatura) | — |

### Patrón técnico confirmado (Comandos Violeta, 2026-07-11) — a calcar
- **DB:** `lib/centralized/<sistema>-db.ts` importa `pool` de `@/lib/db` (pool `pg` global, `search_path=gcc_world,public`);
  `let ready=false` + `ensure<Sistema>Tables()` con `CREATE TABLE IF NOT EXISTS gcc_world.<prefijo>_*`; cada CRUD hace
  `await ensure...()` primero. SQL siempre calificado `gcc_world.`; params `$1`; jsonb `$n::jsonb`+`JSON.stringify`; `RETURNING`.
- **Dominio:** `lib/centralized/<sistema>.ts` tipos/constantes puras (meta de nodos color/forma, helpers de nomenclatura, keys de nodo).
- **API:** `app/api/centralized/<sistema>/**` con guard `getCurrentUser()` + `['admin','member']`, try/catch → `{error}`/500,
  éxito `{data}` (lecturas/creación) o `{ok:true}` (PATCH/DELETE).
- **Registro:** INSERT idempotente `… WHERE NOT EXISTS (slug)` en `ensureTable()` de `app/api/centralized/systems/route.ts`
  (name='Gestión de Datos', piso='pilar', paso='fundamentacion', cell_name='Academia', slug='gestion-de-datos'); dispatch
  ternario por slug en `app/(dashboard)/dashboard/centralized/[piso]/[paso]/[slug]/page.tsx` → `<GestionDeDatosSystem system isAdmin/>`.
- **UI:** `'use client'` en `components/centralized/systems/`, layout 3 zonas (aside izq + grafo + panel flotante absolute),
  constantes `mf/df`, `GLASS`/`GLASS_BTN`/`GLASS_INPUT`, fetch nativo + `sonner`, mutaciones optimistas, `PixelConfirm` para borrar,
  `FloatingWindow` para modales. Grafo `react-force-graph-2d` (import dinámico cliente, cache de nodos por key, `traceShape`/
  `shapeOf`/`colorOf`, leyenda hover-previsualiza+clic-fija). Panel izq usa clases `digi-*`; panel sobre grafo negro usa `GLASS`/blanco.
- **Ruta final:** `/dashboard/centralized/pilar/fundamentacion/gestion-de-datos`. Acceso: miembros piso global/pilar con paso
  fundamentación (`pisosAtOrBelow('pilar')=[pilar,controlador,colaborador]` incluye pilar; se exige paso exacto) + admin + shares.

### Decisiones de negocio (RESUELTAS 2026-07-11, por el usuario)
#### P1 — Secuencia de **categorías** · ✅ Resuelta → **por problemática** (CAT-n reinicia en cada problemática; agrupa códigos verificados de esa problemática).
#### P2 — **Piezas** · ✅ Resuelta → **solo visualización** (se modela la tabla + variables/restricciones, pero NO se crean desde este sistema; llegan del futuro sistema "metodología condiciológica". Los **rompecabezas quedan a la espera** de que existan piezas).
#### P3 — **Escala de credibilidad** · ✅ Resuelta → **0–100 %** (numérico). El promedio peso↔premisa y los enfrentamientos operan en esta escala.
#### P4 — **Alcance / orden** · ✅ Resuelta → **por fases verificables**:
  - **Fase A (núcleo lógico):** Problemática(+REF), Problemas, Fuentes (premisa/peso, credibilidad, seq premisa por-problemática / peso global),
    Pesos (promedio de credibilidad), Enfrentamientos (ganó.perdió + texto manual), Códigos (+ premisas juntadas + eventos de verificación
    título/url + estado verificado), Categorías (por problemática). + registro del sistema + shell UI/grafo.
  - **Fase B (síntesis):** Piezas (solo visualización + modelo variables mental/corporal/ambiental + restricciones), Situaciones (lista global),
    Rompecabezas (nombre manual + situación + unión de piezas validada por restricciones), Subtemas (+ hipótesis).
  - **Fase C (descriptivo):** Temas (prosa + asociación a materias y problemas), Materias (lista global).

### Preguntas ABIERTAS (surgidas al diseñar)
#### P5 — ¿La fuente peso puede **contradecir**? · ✅ RESUELTA (usuario, 2026-07-11) → **NO**.
- **Respuesta:** una fuente de tipo peso **SIEMPRE aumenta** la credibilidad de una premisa (promedio `(actual+peso)/2`). **No
  existe modo "contradice" en pesos.** La contradicción se aplica **solo enfrentando dos premisas** (gana la de mayor
  credibilidad efectiva). Se **eliminó** el `modo` de `gd_fuente_pesos`, de `aplicarPeso()`, de la ruta `/pesos` y del UI.
#### P6 — Nomenclatura de **categoría** con **varios** códigos: ¿`CAT-n-<cod1>_<cod2>…` o solo `CAT-n` + lista? · ⏸ (provisional: `CAT-n` como ref primaria + lista de códigos; el display concatena el 1º código como en el ejemplo).

### Progreso
- **% de información para el objetivo:** ~99% — **SISTEMA COMPLETO (Fases A+B+C) CONSTRUIDO Y VERIFICADO (2026-07-11)**:
  dominio+nomenclatura, capa DB (tablas `gd_`), **15 rutas API**, grafo `GdGraph.tsx` (**10 tipos de nodo**) y componente
  `GestionDeDatosSystem.tsx`. `tsc --noEmit` + `next build` OK. P5 resuelto (peso solo aumenta; contradicción = enfrentamiento).
  **Prueba END-TO-END contra la BD real de Railway (10/10, transacción con ROLLBACK):** 24 tablas DDL + flujo completo
  Problemática→…→Tema + secuencias + REF única. Solo falta **validación visual/UX en vivo** (requiere login).
  - **Fase A:** Problemática/Problemas/Fuentes/Enfrentamientos/Códigos(+eventos)/Categorías.
  - **Fase B:** Piezas (solo visualización), Situaciones/Materias (listas globales), Rompecabezas, Subtemas (+hipótesis).
  - **Fase C:** Temas (prosa + agrupa subtemas + asocia materias y problemas).
- **Pendiente:** **validación visual en vivo** (requiere login); probar contra Railway; alimentar piezas desde el futuro
  sistema de "metodología condiciológica" (hoy solo-visualización → rompecabezas a la espera de piezas reales).
- **Solución construida (A+B+C):** ver detalle en `MEMORIA.md` → "Decisiones recientes (feature) · Gestión de Datos".

### Cambio (2026-07-11): botón "Listas" ELIMINADO de Gestión de Datos
Las listas globales (situaciones, materias, **talentos, valores** y futuras) deben editarse desde un **espacio ÚNICO**:
el futuro sistema **Metodología Condiciológica**. Se quitó el botón "Listas" + `ListasModal`/`EditableList` de
`GestionDeDatosSystem.tsx`. Las tablas `gd_situaciones`/`gd_materias` y sus rutas API se **conservan** (los selectores de
rompecabezas/temas las leen); solo se quitó la edición desde aquí. Verificado tsc OK.

---

## ROADMAP — sistemas condiciológicos siguientes (capturado 2026-07-11, base verbatim del usuario)
> Visión detallada de los sistemas que siguen. **NO construido aún** — capturado para dominarlo antes de desarrollar.
> Nomenclatura de factores: el usuario ahora dice **cognitivo/corporal/ambiental** (antes "mental/corporal/ambiental" en
> las variables de pieza) — **reconciliar** al construir (probablemente mental≡cognitivo). Ver P7 abajo.

### Flujo global (cómo encajan los sistemas)
1. **Gestión de Datos** = motor que recolecta y analiza datos hasta crear **Categorías** (códigos verificados).
2. **Metodología Condiciológica** (sistema, "el lector") = aplica la metodología de **6 pasos** (Reconocer→Controlar→
   Predecir→Experimentar→Convertir→Cambiar) para obtener **condiciones** reconocibles y cambiables. Lee contenido de
   investigación de varios sistemas y **genera TAREAS** dentro de un **proyecto de investigación** para avanzar. Decide
   qué **códigos** convertir en **piezas** y lo solicita generando tareas → van a **Gestión de Condiciones**.
   **Es el ESPACIO ÚNICO donde se editan las listas globales** (situaciones, materias, talentos, valores, futuras).
3. **Gestión de Condiciones** (sistema NUEVO, para **miembros paso fundamentación · piso controlador**) = donde se
   **reconoce/controla/predice** un código para convertirlo en **pieza**, descubriendo **condiciones**. Devuelve la pieza
   (revisión/corrección + variables) a Metodología Condiciológica, que la adopta a su proyecto; luego la pieza se reutiliza
   en **Gestión de Datos** para justificar una problemática (rompecabezas).
4. **Dinámica Condiciológica** (sistema, referenciado) = investiga EXCLUSIVAMENTE los factores **cognitivo/corporal/
   ambiental**; cada factor tiene **causas**, cada causa tiene **variables**. Define (por análisis experto, según se estudia)
   qué variables existen y los métodos de recolección según las causas a monitorear. **Provee el listado factor→causa→
   variable** que usa Gestión de Condiciones.
5. **Laboratorio Condiciológico** (herramienta) = lugar donde los miembros lanzan las subtareas y hacen el **proceso de
   investigación de condiciones**: sobre un código, ejercicio en un espacio ambientado, luego analizan factores/causas/
   variables para determinar cuáles impactan el código. Las investigaciones se guardan como **registros de condiciones**.
6. **Alertas** (módulo FUTURO, debajo de "Mi día") = bandeja de notificaciones (invitaciones, eliminaciones, novedades)
   para **aprobar/rechazar** invitaciones/solicitudes.

### Sistema "Metodología Condiciológica" — interfaz
- **Panel izquierdo** (como el de Problemáticas de Gestión de Datos): crear **Proyectos de investigación**. Un proyecto de
  investigación **siempre tiene finalidad productiva** (su salida es un resultado usable, p.ej. construir un edificio,
  cambiar la infraestructura tecnológica de un barrio). Esa salida luego alimenta un **proyecto de creación** (paso
  creación) — la vinculación se explicará a futuro.
- **Panel derecho = 6 pestañas** (los 6 pasos): **Reconocer · Controlar · Predecir · Experimentar · Convertir · Cambiar**.
  Cada pestaña trae **fuentes de distintos sistemas**.
  - **Reconocer (definir ahora):** panel derecho con **todos los códigos VERIFICADOS** (de Gestión de Datos) por su
    referencia; seleccionar un código → otro panel a la derecha con su **detalle**: premisas asociadas, **fuentes de peso**
    de esas premisas (mostrar SOLO su nomenclatura + **burbuja al hover** con el detalle del peso) y premisas de
    **enfrentamiento**. Se pueden **seleccionar varios códigos** y revisarlos (¡pide creatividad!). Con un conjunto de
    códigos → **Generar tarea**: **título** + asociar al **proyecto de investigación** + campo **notas/observaciones**.
    La tarea va **directo a Gestión de Condiciones**.

### Sistema "Gestión de Condiciones" (NUEVO · piso controlador · paso fundamentación) — interfaz
- **Panel derecho:** todas las **tareas generadas**, seleccionables en **orden ascendente** (más antigua→reciente).
  Seleccionar tarea → panel a la derecha con su detalle. **Pestañas** en ese panel:
  - **Datos:** todos los **códigos asociados** + detalle de cada uno (pesos, enfrentamientos, etc.).
  - **Subtareas (requerimientos):** generar subtareas; cada subtarea puede incluir un conjunto de **tickets o proyectos**
    (sin límite de subtareas ni de tickets/proyectos por requerimiento). Al crearlos, el usuario es el **cliente**; luego
    puede: asignar un **miembro paso fundamentación** para que tome el ticket, o dejarlo **sin miembro y público**
    (candidatos/miembros lo ven, pero **solo miembros paso fundamentación lo pueden tomar**; el primero que lo toma lo
    ejecuta). Igual para **proyectos** (agregar miembros paso fundamentación como participantes, o público; solo miembro
    paso fundamentación entra como participante). **Diferencia clave vs tickets/proyectos normales:** la **autorización
    para entrar se SALTA** (se presume competencia). (A futuro, algo similar para los normales bajo ciertas condiciones.)
  - **Pieza (espacio de trabajo):** construir la pieza. Puede usar todos o algunos de los códigos verificados de la tarea
    (criterio del miembro). Usa el **MISMO universo de gráficos** de Gestión de Datos (mismos íconos de código/categoría/
    pieza): visualiza códigos y categorías ya definidos (con acceso a sus datos) y una **pieza precreada VACÍA**.
    - **La pieza se crea al crear la tarea** (en Metodología Condiciológica), nace **vacía**; mientras esté vacía, en
      Gestión de Datos se ve **INCOMPLETA** y su avance/detalle se refleja conforme avanza en Gestión de Condiciones.
      ⇒ **implica agregar `estado` a `gd_piezas`** (incompleta|completa/verificada) al construir esto.
    - Para **agregar una condición** al universo: seleccionar → panel derecho **"Condiciones"** con todas las condiciones
      creadas + botón **agregar condición**. Las condiciones se agregan por la gestión vía subtareas + el proceso de
      investigación registrado (hecho en el **Laboratorio Condiciológico**).
    - **Crear condición** → modal para agregar **variables fijas** y **variables del listado** de factores de **Dinámica
      Condiciológica** (factor→causa→variable). Panel derecho con todas las variables **agrupadas por causa y factor**;
      **universo de variables** donde se **arrastran** variables del panel izquierdo → significan que la condición está
      afectada por ellas (**NO verificadas**); + botón para **variables fijas**.
    - **Verificación de condición:** las variables (fijas o de factor) deben **verificarse demostrando que se expresan en
      la condición** → la condición tiene una **lista de eventos** (demostración de que existe). Verificada ⇒ se muestra
      **distinta** en el universo de la pieza (verificada vs no verificada).
    - Al agregar condiciones, la **pieza trae automáticamente las variables** de esas condiciones al universo (cada
      variable de cada condición visualizable). Variables **repetidas** entre condiciones ⇒ permiten reconocer **reglas**.
    - **Restricciones (3 funciones por ahora, se ampliarán):** (1) qué variables **no se pueden usar junto a** otra
      variable; + las ya comentadas (`aplicaMasDeUno`, `soloCategorias`). Se **añaden a nivel del universo de gráficos**
      sobre las condiciones existentes. Limitan el comportamiento de la pieza al unirse en **rompecabezas** (Gestión de Datos).
    - Al terminar → **marcar la tarea como completada** ⇒ la pieza queda **completa/verificada** y usable en Gestión de Datos.

### Preguntas abiertas del roadmap
#### P7 — Factores · ✅ RESUELTA (usuario 2026-07-11): los 3 factores son **mental, corporal, ambiental** (mi modelo era correcto). Tienen **causas**: mental→[cognitivo, social], corporal→[estructural, funcional], ambiental→[positivo, universo]. Cada causa tendrá **variables** (las define Dinámica Condiciológica). Registrado en `lib/centralized/condiciologia.ts` (`FACTORES`).
#### P8 — Piso/paso · ✅ PARCIAL (usuario 2026-07-11): **Metodología Condiciológica = global · fundamentación** (celda "Condiciología"). Gestión de Condiciones = **controlador · fundamentación**. **Dinámica Condiciológica** = por confirmar.

### Estado de construcción del roadmap (2026-07-11)
- **Dinámica Condiciológica — HECHA (2026-07-11):** colaborador·fundamentación (celda "Investigador", a confirmar piso/paso).
  Panel de 3 factores → variables agrupadas por causa → editar **nombre** + **herramienta de monitoreo**. Dueño de
  `dc_variables` (campo nuevo `herramienta_monitoreo`); en Gestión de Condiciones el catálogo quedó **solo lectura**. Ruta
  `dinamica/variables` (GET/POST/PATCH/DELETE). tsc+build OK + BD real 2/2. **Futuro:** campos que conectarán con Gestión de Datos.
  **Pendiente:** Laboratorio Condiciológico, módulo Alertas; pulidos finos de Gestión de Condiciones Fase 2.
- **Gestión de Condiciones — FASE 1 HECHA (2026-07-11):** controlador·fundamentación (celda "Conocimiento"). Bandeja de
  tareas + pestañas **Datos** (códigos con detalle) / Subtareas (placeholder) / **Pieza (workspace)**: condiciones con
  **variables** (fija factor/causa o del catálogo `dc_variables`), **eventos** de verificación, **restricciones** (3 tipos)
  y **"Completar tarea"** → `completeTask` **materializa `gd_pieza_variables`** (fija→fija, catálogo→cambia; restricciones
  volcadas) + pieza `completa` + tarea `completada` (reabrible). DB `condiciones-db.ts` (dc_/gc_) + 8 rutas API. Dominio
  `condiciologia.ts` (`RESTRICCION_TIPOS`). tsc + build OK + **BD real 8/8 (ROLLBACK)**.
  **FASE 2 HECHA (2026-07-11):** (a) **Subtareas** con integración REAL — requerimientos crean tickets/proyectos reales
  (usuario=cliente, marcados `source_system='condiciones'`/`source_paso='fundamentacion'`), asignar miembro paso-fundamentación
  o público, **tomar** con enforcement de paso, y **bypass** del gate de proyecto privado; (b) **universo de gráficos** en el
  workspace (toggle Panel/Universo, `GdGraph` con nodos código/pieza/condición/variable). tsc+build OK + **BD real 5/5** (INSERT
  ticket service_id NULL + proyecto público con columnas reales). Detalle en `MEMORIA.md`.
  **Pendiente:** botón "Tomar" en la UI de los módulos Tickets/Proyectos; drag-drop de variables al crear condición; sistemas
  **Dinámica Condiciológica** (catálogo real de variables) y **Laboratorio Condiciológico**, módulo **Alertas**.
- **Metodología Condiciológica — FASE 1 HECHA:** proyectos de investigación + 6 pestañas (solo **Reconocer** desarrollado:
  códigos verificados multi-selección + detalle premisas/pesos[hover]/enfrentadas + generar tarea) + gestión de listas
  globales (situaciones/materias) + `createTask` pre-crea **pieza vacía incompleta**. tsc + build OK + BD real 6/6 (ROLLBACK).
  Gestión de Datos refleja `gd_piezas.estado` (piezas incompletas atenuadas). Botón "Listas" quitado de Gestión de Datos.
  **Pendiente:** 5 pasos restantes; sistemas Gestión de Condiciones, Dinámica Condiciológica, Laboratorio; módulo Alertas;
  migrar talentos/valores a listas editables. **P9/P10** siguen abiertas (variables/condiciones; vinculación tarea↔pieza ya
  parcialmente resuelta con `mc_task_pieza` + estado incompleta).
#### P9 — Modelo de **variables** (Dinámica Condiciológica: factor→causa→variable) y de **condiciones** (registros con variables + eventos de verificación + restricciones): tablas nuevas + de dónde salen. · ⏸
#### P10 — Vinculación **tarea (Metodología)→pieza precreada vacía** y estados de pieza (`incompleta`) reflejados en Gestión de Datos. · ⏸

---

## Objetivo PREVIO (declarado 2026-07-08, ✅ CERRADO 100%) — Comandos Violeta: generación REAL de tareas al activar una política
**Necesidad:** cuando se activa una **política** que contiene una función **`generate_tasks`**, las tareas
programadas deben **materializarse y asignarse a los usuarios** (candidatos/miembros) para los que se
programaron, apareciendo en su **"Mi día"**. Hoy la autoría funciona (se guardan los `TaskProgram` en la
config de la función) pero **al activar NO pasa nada** (es el PENDIENTE (3) de enforcement documentado en
`MEMORIA.md`).

### Rol asumido
**Ingeniero full-stack (Next.js 15 App Router + Postgres crudo `pg`)** con foco en el modelo de datos del
Horario de Vida / Mi día y el enforcement de Comandos Violeta.

### Arquitectura de AUTENTICACIÓN (aprendido 2026-07-09) — clave para el flujo de candidatos
- **Dos mundos de cuentas:** (a) `gcc_world.users` = staff/clientes de negocio (miembro/admin/client) con
  **JWT `auth_token`** (`lib/auth/jwt.ts`, `createToken`, role client|member|admin); **`/dashboard` exige ese
  JWT** (`middleware.ts`, si no → redirige `/auth`). (b) `gcc_world.clients` = juego/reclutamiento (candidatos,
  `account_type`), con cookies **`gcc_player_auth`** (=`clients.auth_token`) y **`gcc_client_token`**
  (=`clients.client_token`).
- **Un candidato NO tiene fila en `users` ni JWT** → **NO puede entrar a `/dashboard`** tal como está. `complete-profile`
  setea `gcc_player_auth` (juego), no el JWT. `/api/auth/login` valida solo contra `users`.
- **RESUELTO (2026-07-09) — sesión de dashboard para candidatos (evita doble login):** decisión del usuario =
  darle la sesión de dashboard en el MISMO login (rol según el usuario; módulos gateados por rol). Helper
  **`lib/auth/candidateSession.ts` → `grantCandidateDashboardSession(email)`**: busca/crea la fila `gcc_world.users`
  (rol 'client' si es nueva; preserva el rol si ya existe), sincroniza la contraseña, **vincula
  `clients.user_id`** y emite el **JWT `auth_token`** (`createToken`+`setAuthCookie`). Se llama en
  **`complete-profile`** (al crear la cuenta) y en **`recover/verify`** (al iniciar sesión como candidato). Así,
  al ir a `/dashboard` ya hay JWT → NO rebota a `/auth` (un solo login). Es coherente con `passkey/login/finish`,
  que ya emitía el JWT del `users` enlazado por `clients.user_id`. Verificado tsc+build + SQL en Postgres (rollback).
- **Botón del ofrecimiento de passkey** (AccountRecoveryModal) ahora dice "…comenzar a colaborar" (destino
  dashboard) o "…entrar al juego" (destino juego) según `destination`.

### Progreso
- **% de información para el objetivo:** 100% — **IMPLEMENTADO Y VERIFICADO (2026-07-08)**. `tsc`+`next build`
  OK; expansión de días (weekdays con `EXTRACT(DOW)`) e idempotencia (`ON CONFLICT DO NOTHING`) probadas contra
  Postgres real dentro de una transacción con ROLLBACK (sin tocar datos). Detalle en `MEMORIA.md`.

### Solución construida (resumen)
- Tabla `cv_generated_tasks` + `materializePolicyTasks`/`removePolicyPendingTasks` enganchadas a `setPolicyActive`.
- `getSubjectGeneratedTasks` → `generated[]` en `getSubjectHorario`; se ven en Mi día y en el sistema Horario de
  Vida como entradas FIJAS (estilo auto de ticket/proyecto). Solo estado + etiquetas editables.
- `PATCH /api/centralized/horario/generated`; scoring incluye las generadas completadas/fallidas.

### Ampliaciones de la MISMA sesión (2026-07-08) — todas implementadas + verificadas (tsc/build/Postgres rollback)
Todo lo detallado en `MEMORIA.md`; aquí el arco de aprendizaje del objetivo, que fue creciendo:
1. **Alcance "todos los usuarios"** — `TaskProgram.scope` = `'user' | 'all'`. En `'all'`, la materialización
   expande a `getAllTaskSubjects()` (miembros activos + candidatos aprobados = quienes salen en `UsersList`),
   una fila por sujeto/día. Se resuelve **en la activación** (usuarios nuevos no la reciben salvo re-activar).
   Aprendizaje: el targeting por-usuario ya cuadraba; "todos" es solo fan-out sobre el mismo INSERT idempotente.
2. **Re-sync al editar función de política ACTIVA** — el bug real: editar la config guardaba pero NO re-materializaba
   (solo desactivar+activar lo hacía). Fix: `createFunction`/`updateFunctionConfig` → **`resyncFunctionTasks`**
   (si activa + `generate_tasks`: borra PENDIENTES de esa función y re-materializa; `ON CONFLICT DO NOTHING`
   conserva completadas/fallidas). Borrar la función limpia por FK `ON DELETE CASCADE`.
3. **Tareas de política como BLOQUES en el calendario de Mi día** — decisión del usuario: sí, además del rail;
   color por estado (verde/rojo/violeta); clic → popover con `TaskStatusButtons`. Técnica: `EventInstance`
   sintéticos (`generated:true`) fusionados en `allInstances` solo para el calendario; `CalendarView` gana
   `onGeneratedClick` y `dayTotals` los excluye de las horas.
4. **UI del modal Generar tareas** — panel de tareas a la DERECHA (estilo Horario de Vida: chip de etiquetas
   icono+contador con burbuja); **seleccionar tarjeta = editar** esa tarea en el formulario ("Guardar cambios").
5. **Fixes de diseño transversales**: tipo de evento **Laboral→Progreso** (rename de valor `work`→`progreso` +
   migración BD); campo "Tarea del horario" del EventModal ahora **solo-lectura** y solo vía "Registrar tiempo";
   indicador de **política activa = anillo esmeralda** (no punto verde) + **leyenda-filtros** (hover/pin) con
   Tipos + Estado; `MultiSelectSearch` con **chips debajo** del buscador.

### Decisiones del usuario (2026-07-08)
- **P5 · ✅ SÍ alimentan el perfil**: completar/fallar una tarea generada suma/resta a sus valores/talentos
  (igual que el Horario de Vida).
- **P6 · ✅ Al desactivar**: se **borran las pendientes** (pasadas y futuras sin resolver); se **conserva el
  historial** de completadas/fallidas. Re-activar **regenera** desde el nuevo `activated_at`, idempotente
  (ON CONFLICT DO NOTHING) para no duplicar días ya materializados.
- **P7 · ✅ Sin vista admin nueva**: aparecen en el **"Mi día"** de cada usuario asignado **Y** en el sistema
  **Horario de Vida**, comportándose **como las entradas auto de ticket/proyecto**: **fijas** (no se arrastran
  ni se quitan); el usuario **solo cambia estado y etiquetas** (etiquetas se editan en el sistema Horario de
  Vida). Feed de scoring incluido.

### Hallazgos (investigación en el código, 2026-07-08)
- **P1 — ¿La activación genera tareas? · ✅** NO. `PATCH /api/centralized/comandos/policies {active}` →
  `setPolicyActive()` solo pone `active`/`activated_at`. `getActiveEffects()` (`comandos-db.ts`) procesa
  `permanent_message`, `policy_terms` y `block_modules` pero **ignora `generate_tasks`**. No existe tabla ni
  código de materialización (grep confirmó: `generate_tasks` solo aparece en autoría/UI).
- **P2 — ¿El targeting de usuarios es correcto? · ✅ SÍ.** `TaskProgram.userKind`+`userId` (de `UsersList`)
  coincide exactamente con el sujeto que resuelve `GET /horario/me`:
  - candidato → `UsersList` usa `/api/admin/candidates` → `clients.id`; `/me` resuelve candidato = `clients.id`. ✔
  - miembro → `UsersList` usa `/api/admin/team` → `members.id`; `/me` resuelve miembro = `users.member_id`
    (y `member_id::bigint = members.id`). ✔
  Conclusión: la preocupación del usuario ("que se asignen a los usuarios correctos") está **cubierta en el
  targeting**; lo único que falta es **ejecutar** la generación.
- **P3 — ¿Dónde aterrizan las tareas? · 🔎 Mismatch de modelo.** El Horario/Mi día está atado al sistema
  **Apoyo**: una tarea = una **alternativa** (`aa_solutions` status='alternative') unida por problemas/
  situaciones; `hv_schedule.alternative_id` es `BIGINT NOT NULL`. La tarea generada es **libre**
  (título+detalle+etiquetas+horario), sin alternativa ni grafo psicosocial. Además `hv_schedule` es
  **granular por día** (no guarda hora), pero `TaskProgram` trae `allDay`/`startTime`/`endTime`.
  → **No se puede reusar `hv_schedule` tal cual.** Decisión de diseño: **store dedicado
  `cv_generated_tasks`** (instancias materializadas por usuario/día con estado+hora+política origen) y que el
  rail de "Mi día" **fusione** esa segunda fuente. (Alternativa descartada: crear alternativas sintéticas en
  el grafo de Apoyo — contamina el modelo psicosocial y no soporta hora.)
- **P4 — Expansión de presencia · ✅ decidido en MEMORIA.** Inicio = `activated_at`; ventana = `daysCount`
  días; `weekdays` (vacío=todos) filtra qué días dentro de la ventana; `allDay` o `startTime`/`endTime`.

### Preguntas ABIERTAS para el usuario (deciden el modelo de datos / comportamiento)
- **P5 — ⏸ ¿Las tareas generadas alimentan el PERFIL (scoring de valores/talentos)** igual que las del
  Horario de Vida? Llevan las mismas etiquetas, así que lo natural es que completarlas/fallarlas sume/reste.
- **P6 — ⏸ Ciclo de vida al DESACTIVAR la política:** ¿se **eliminan** las tareas pendientes/futuras (y se
  conserva el historial de las ya completadas/fallidas para el registro y el scoring), o quedan todas? ¿Y al
  **re-activar** se regeneran (idempotente por función+día para no duplicar)?
- **P7 — ⏸ ¿Se necesita una vista/gestión para el ADMIN** (previsualizar/depurar las tareas generadas por una
  política), o basta con que aparezcan en el "Mi día" de cada usuario?

### Plan de solución (borrador, a confirmar con P5–P7)
1. Tabla `gcc_world.cv_generated_tasks` (function_id, policy_id, subject_kind, subject_id, title, detail,
   value_tags[], talent_tags[], day DATE, all_day, start_time, end_time, status, created_at) + índice por
   sujeto y **UNIQUE (function_id, subject_kind, subject_id, day)** para idempotencia.
2. Al activar (`setPolicyActive(true)`): por cada función `generate_tasks` de la política, expandir cada
   `TaskProgram` sobre [activated_at, +daysCount) filtrando `weekdays`, e insertar filas (ON CONFLICT DO
   NOTHING). Al desactivar: según P6.
3. `getSubjectHorario`/`/horario/me` (o un endpoint nuevo) devuelve también las `cv_generated_tasks` del
   sujeto en la ventana; el rail de "Mi día" las fusiona con estado propio + `TaskStatusButtons`.
4. Scoring según P5. Verificar `tsc` + `next build`. Commit+push a main.

---

## Objetivo ACTUAL (declarado 2026-06-23) — Onboarding de candidato en la landing (8 sliders + postulación)
**Necesidad:** al pulsar "Entrar" en la landing, un visitante **nuevo** debe ver primero un modal tipo
carrusel ("deslizados") con **8 sliders** que le **dan a conocer el proyecto**, y al final un formulario
con la pregunta **"¿Por qué quieres ser candidato de este proyecto?"** (postulación), antes de ingresar al
juego/mundo.
- **% de información para el objetivo:** ~30% — **sliders 1 y 2 totalmente especificados e implementados**;
  **sliders 3–8 pendientes** (el usuario los dictará uno a uno); persistencia de la postulación en backend
  **sin definir** (hoy solo `localStorage`).
- **Contenido recibido (verbatim en `MEMORIA.md` → "Fundamentos del proyecto"):**
  - **Slider 1 · Modelo de Grupo** = Modelo 4P (4 pisos: Global, Pilar, Controlador, Colaborador; 4 pasos:
    Fundamentación, Creación, Implementación, Gestión). Cada paso contiene los 4 pisos.
  - **Slider 2 · Herramientas** = Metodología Condiciológica (6 pasos; Condiciología = estudio de las
    condiciones, de L. F. González Muyulema), Sistema de Control Psicosocial, Proyecto Centralizado, Violeta.
- **Implementado:** `components/landing/OnboardingSlidersModal.tsx` (data-driven, estilo pixelart, acordeón
  en slider 2, animaciones) + hook en `app/page.tsx` (estado `onboardingOpen`, intercepta "Entrar" para
  nuevos, `onComplete` arranca el flujo original y guarda la motivación en localStorage). `tsc` OK, sin commitear.
- **Preguntas abiertas para el usuario:** (1) contenido de los sliders 3–8; (2) ¿la postulación se guarda en
  BD / se asocia al personaje creado? ¿hay revisión/aprobación de candidatos?; (3) ¿el modal debe poder
  saltarse o es obligatorio? (hoy tiene "✕" que cancela y vuelve a la landing).

### Ampliación 2026-06-23 — Candidato vs Cliente, cuentas, aprobación y marketplace (DISEÑO acordado)
El usuario definió el flujo completo (ver `MEMORIA.md` → feature onboarding):
- Tras "Entrar": **modal de elección** Candidato/Cliente (`EntryChoiceModal`). **HECHO** (UI + ruteo + `gcc_account_type`).
- **Candidato:** sliders → motivación → creación de cuenta (datos personales en `SignupForm`) → verificación correo.
  **PENDIENTE (backend):** aprobación por **admin Global** + correo de aprobación antes de poder ingresar al juego.
- **Cliente:** sin sliders ni motivación → creación de cuenta (`account_type='client'`) → verificación correo.
  **PENDIENTE (backend):** inicio = **marketplace**; **/dashboard restringido** (Marketplace, Tickets, Proyectos,
  Suscripciones, Automatizaciones, Perfil/Config); publica requerimientos de tickets/proyectos; ve suscripciones
  asignadas; automatizaciones solo-ver-compartido (no crea flujos).
- **HECHO:** `SignupForm` pide nombre/correo/país/dirección/teléfono + contraseña; `signup` persiste
  `full_name/country/address/phone/account_type` en `gcc_world.clients`; checkbox de marketing opcional en la
  postulación; se quitó el texto "Slider N".
- **HECHO (propuestas 2026-06-23):** tabla `gcc_world.candidate_proposals` + `POST/GET /api/candidate/proposal`
  (bloqueo de correo UNIQUE, `ip_hash`, estado `pending`) + verificación de correo (`/api/candidate/verify`) +
  `ProposalPendingModal` (espera de aprobación) + reconocimiento por IP al elegir "candidato". El candidato NO
  entra al juego tras postularse; queda en espera.
- **RESUELTO — Flujo del candidato APROBADO en la landing (2026-07-09):** al volver a "Entrar", si el visitante
  (reconocido por `PROPOSAL_COOKIE`/ip en `GET /api/candidate/proposal`) tiene la postulación **`status='approved'`**,
  el `EntryChoiceModal` muestra una opción **verde** "¡Tu postulación fue aprobada!" (antes decía siempre "en proceso").
  Al pulsarla → `ProposalPendingModal` en **variante aprobada** (icono 🎉, etiqueta **verde** "aceptado por el
  administrador", botón **"Continuar"** en vez de "Entendido"). "Continuar" abre **`CandidateAccountModal`** (nuevo,
  `components/landing/`) = formulario nombre/país/dirección/teléfono/contraseña que POSTea a
  `/api/character/auth/complete-profile` (reemplaza la contraseña temporal, `profile_completed=true`, borra la
  propuesta, deja sesión de juego activa) → recarga `/`. **Clave backend:** el `GET` de propuesta, cuando está
  aprobada, **setea el `CLIENT_COOKIE`** con el `client_token` del candidato (por email) para que `complete-profile`
  lo identifique (el token se creó en el navegador del admin al aprobar, no en el del candidato); además el fallback
  por ip de `complete-profile` ahora acepta candidatos aprobados **sin personaje**. Verificado tsc+build + estado real
  en Postgres. (Nota: `/dashboard` exige JWT `auth_token`; el candidato queda con `gcc_player_auth` del juego, por eso
  se recarga a `/`, no a `/dashboard`.)
- **PENDIENTE / preguntas:** (a) ¿confirmas que clientes y candidatos comparten `gcc_world.clients` con
  `account_type`, o quieres tabla física separada?; (b) flujo de **aprobación de candidato** (estado en BD +
  endpoint admin + correo); (c) gating de **acceso del cliente** al juego (no debe entrar) y redirección a
  marketplace tras verificar; (d) permisos del `/dashboard` para rol cliente; (e) el `SignupForm` hoy vive
  dentro del juego (requiere personaje) — para el cliente habría que ofrecer creación de cuenta SIN pasar por
  el juego (rework de flujo, a definir).

---

## Objetivo / necesidad (declarado 2026-06-11)
Nuevo módulo **Suscripciones**, ubicado en el sidebar **justo debajo de Proyectos**. Permite al
miembro/usuario llevar el control de **cobros mensuales recurrentes** a clientes por productos/servicios
de costo mensual. Funcionalidad:
- Crear una suscripción definiendo: **cliente** (a quien se cobra), **título/razón** del cobro,
  **costo mensual** y **fecha de inicio** (que fija el **día de corte** mensual; ej. inicio 11-jun-2026 ⇒
  se cobra el **11 de cada mes**).
- **Tabla principal** con las suscripciones creadas; debe **alertar** cuando el día de corte esté
  **cerca** de la fecha actual.
- Al **seleccionar** una suscripción, en un **panel lateral derecho** aparece el **listado de meses**
  que debieron pagarse desde la fecha de inicio hasta hoy. **Si empieza un nuevo mes calendario, ese mes
  ya aparece** en la lista aunque no haya llegado el día de corte.
- En ese panel el miembro **marca meses como pagados / no pagados**.
- Al **marcar un mes como pagado** se dispara automáticamente:
  1. **Generar factura** SRI para el cliente con sus datos.
  2. **Enviar email** al cliente con su factura (PDF adjunto).
  3. La factura **aparece en la tabla de Facturas**.
  4. El **ingreso** se registra en el **dashboard en el mes del día en que se marca pagada** la cuota.
- **Diseño:** replicar **exactamente** las reglas de estilo del `/dashboard` (tema corporativo `.corp`).

## Rol asumido
**Ingeniero full-stack (Next.js 15 App Router + Postgres/SQL crudo `pg` + Prisma 7) con foco en
facturación electrónica SRI Ecuador** y en el sistema de diseño corporativo `.corp` del dashboard.

## Progreso
- **% de información para el objetivo:** 98% — **IMPLEMENTADO** y verificado con `tsc --noEmit` OK
  (build de Next en validación). Falta solo prueba funcional en vivo (login + factura real SRI/email).
- **Decisiones del usuario (2026-06-11):** (1) modelo de cobro **por mes calendario** (vencimiento =
  día de corte de cada mes); (2) roles **admin + member**; (3) IVA: el costo mensual es **precio final,
  IVA 15% incluido** (se desglosa hacia atrás: base = total/1.15); (4) **alerta 7 días** antes del corte.
- **Resumen del estado actual:** Módulo completo construido: tablas `subscriptions` +
  `subscription_payments`, lib de lógica de meses/alertas, 3 endpoints API, función SRI
  `createManualInvoiceFromSubscription`, wrapper de ingreso, NavItem en sidebar y página UI `.corp` con
  tabla principal (alertas) + panel lateral de meses con marcado de pago.

## Fuentes recibidas / consultadas (2026-06-11)
- `MEMORIA.md` — contexto del proyecto, stack, tema `.corp`, decisiones SRI, vínculo factura→origen.
- `components/dashboard/DashboardSidebar.tsx` — `NAV_ITEMS` (label/href/icon Lucide/roles opcional);
  item "Proyectos" en L24 (`{ label:'Proyectos', href:'/dashboard/projects', icon:FolderKanban }`); filtro
  `!item.roles || item.roles.includes(user.role)`. **Aquí se inserta "Suscripciones" debajo de Proyectos.**
- `app/(dashboard)/dashboard/projects/page.tsx` — patrón de módulo de lista: `ModuleToolbar` (tabs+buscador+acción)
  + `PixelDataTable` (columns/data/onRowClick/paginación) + `PixelModal` (panel lateral derecho) + estados +
  `fetch('/api/...')`. Constantes `pf`/`mf` (fuentes), `STATUS_V` (variantes de badge).
- `app/(dashboard)/layout.tsx` — shell con `.corp`; `<main className="flex-1 ml-0 lg:ml-56 …">`.
- `lib/integrations/sri/index.ts` — `createManualInvoiceFromTicket(opts)` (L407): inserta en
  `gcc_world.invoices` con `is_manual=true`, **`source_type`/`source_id`** (vínculo a origen),
  datos `client_*_sri`, items en `invoice_items_sri`; retorna `{invoiceId, total}`. `sendInvoiceToSri(id)`
  firma + envía a SRI + genera PDF (`pdf_data` BYTEA) y retorna `{ok, authorized, authNumber?, error?}`.
- `app/api/invoices/from-ticket/route.ts` — endpoint de referencia del flujo completo: crea factura →
  `addTicketIncomeToFinance` → `sendInvoiceToSri` → (si autorizado) email Resend con PDF adjunto (BCC a
  `lfgonzalezm0@grupocc.org`), HTML con tabla de items. Item shape: `{description, quantity, unitPrice, ivaRate, discount}`.
- `app/api/invoices/route.ts` (GET) — lista `gcc_world.invoices` (ORDER BY created_at DESC). **Si inserto
  por el mismo mecanismo, la factura aparece automáticamente.** No filtra por source.
- `lib/finance.ts` — `addIncomeToFinance(sourceType, sourceId, description, amount, date?)`: idempotente vía
  `gcc_world.finance_source_log`; `ensureMonth(year, month)` por `date`; inserta en `finance_items` y
  `recalcMonth`. El **mes del ingreso = `date`** que se pase (para "mes del día en que se marca pagado" ⇒
  pasar `new Date()` del momento de marcar). `addProjectIncomeToFinance`/`addTicketIncomeToFinance` son wrappers.
- `app/api/clients/route.ts` (GET) — `SELECT id, name, email FROM gcc_world.clients ORDER BY name`. La tabla
  `clients` tiene además `ruc`, `address` (ADD COLUMN IF NOT EXISTS). Datos SRI completos del adquirente viven
  en `invoices.client_*_sri`; endpoint `GET /api/invoices/clients-history` devuelve adquirentes ya facturados
  con `id_type` inferido (patrón "Cliente previo").

## Preguntas y respuestas

### P1 — ¿Cómo se inserta el módulo en el sidebar bajo Proyectos? · ✅ Resuelta
- **Por qué importa:** ubicación exacta pedida ("debajo de Proyectos").
- **Respuesta:** Añadir un `NavItem` en `NAV_ITEMS` (`DashboardSidebar.tsx`) inmediatamente después del de
  Proyectos (L24): `{ label:'Suscripciones', href:'/dashboard/subscriptions', icon:<Lucide>, roles?:[...] }`.
  El icono es un `LucideIcon` (candidatos: `RefreshCw`, `CalendarClock`, `Repeat`). (Fuente: código.)

### P2 — ¿Cómo se genera la factura programáticamente y aparece en Facturas? · ✅ Resuelta
- **Por qué importa:** requisito (a) y (c).
- **Respuesta:** `createManualInvoiceFromTicket`-style → inserta en `gcc_world.invoices` con
  `source_type='subscription'`, `source_id='<subId>-<YYYY-MM>'`, `is_manual=true`, datos `client_*_sri` e items.
  Reutilizaré/extraeré una función análoga (`createManualInvoiceFromSubscription`) o usaré la genérica. La
  tabla de Facturas (`GET /api/invoices`) lista todas las de `invoices`, así que **aparece sola**. (Fuente: `sri/index.ts`, `invoices/route.ts`.)

### P3 — ¿Cómo se envía el email con la factura? · ✅ Resuelta
- **Por qué importa:** requisito (b).
- **Respuesta:** Resend (`getResend().emails.send`) con `from=EMAIL_FROM`, `to=client_email`, BCC interno,
  `subject` con nº de factura, HTML con items y **PDF adjunto** desde `invoices.pdf_data` (tras `sendInvoiceToSri`
  autorizado). Copiar el bloque de `from-ticket/route.ts`. (Fuente: código.)

### P4 — ¿Cómo se registra el ingreso en el mes correcto del dashboard? · ✅ Resuelta
- **Por qué importa:** requisito (d) — "ingreso en el mes del día en que se marca pagada".
- **Respuesta:** `addIncomeToFinance('subscription', '<subId>-<YYYY-MM>', '<título> <mes>', total, new Date())`.
  Es **idempotente** (no duplica si se re-marca). El **mes** lo fija la `date`: para "el mes del día en que se
  marca pagado" se pasa la fecha actual (`new Date()`). (Fuente: `lib/finance.ts`.)

### P5 — ¿Qué tablas nuevas se necesitan? · ✅ Resuelta (diseño propio)
- **Por qué importa:** persistencia del módulo.
- **Respuesta (propuesta):** Dos tablas en `gcc_world` (vía `ensure...Columns()` con `CREATE TABLE IF NOT EXISTS`,
  patrón del repo tras eliminar migraciones SQL):
  - `gcc_world.subscriptions`: `id`, `client_id` (FK clients, nullable), datos `client_*_sri` snapshot (id_type,
    ruc, name, email, phone, address) para facturar sin re-preguntar, `title`, `monthly_cost`, `iva_rate`,
    `currency`, `start_date` (DATE; fija el día de corte), `status` ('active'/'paused'/'cancelled'),
    `created_by`, `created_at`, `updated_at`.
  - `gcc_world.subscription_payments`: `id`, `subscription_id` FK, `period` (DATE = primer día del mes
    facturado, ej. 2026-06-01), `paid` (bool), `paid_at`, `invoice_id` (FK invoices, nullable), `created_at`.
    Único `(subscription_id, period)`. Una fila por mes marcado pagado (los no pagados se derivan en runtime).

### P6 — ¿Qué meses se listan en el panel lateral y cómo se calcula el vencimiento? · ✅ Resuelta (modelo propuesto, a confirmar en P10)
- **Por qué importa:** lógica central del panel.
- **Respuesta (modelo):** Una fila por **mes calendario** desde el mes de `start_date` hasta el **mes actual**
  inclusive. Vencimiento del mes = **día de corte** (= `start_date.getDate()`) de ese mes, *clamp* al último día
  si el mes es más corto (p.ej. corte 31 → 28/29 feb). Un mes aparece **en cuanto empieza el mes calendario**
  (aunque falte el día de corte). Estado del mes: **pagado** (existe fila en `subscription_payments` con
  `paid=true`) o **pendiente**. (Fuente: requisito del usuario; confirmar P10.)

### P7 — ¿Cuándo y cómo alertar "día de corte cerca"? · ⏸ Bloqueada (espera al usuario, P12)
- **Por qué importa:** requisito de la tabla principal.
- **Respuesta:** Falta definir la **ventana** (días antes del corte) y si la alerta es por suscripción con
  el **próximo mes impago** cuyo vencimiento esté dentro de la ventana o ya vencido. Propuesta por defecto:
  alerta ámbar si faltan ≤ N días, roja si ya venció e impago.

### P8 — ¿Qué roles acceden al módulo? · ⏸ Bloqueada (espera al usuario, P11)
- **Por qué importa:** define `roles` del NavItem y los checks en la API.
- **Respuesta:** Pendiente (Proyectos/Tickets permiten `member`+`admin`; Suscripciones probablemente igual o
  solo `admin`). 

### P9 — ¿IVA en la factura de la cuota mensual? · ⏸ Bloqueada (espera al usuario, P13)
- **Por qué importa:** define el `unitPrice`/`ivaRate` del item SRI y el total cobrado. Ecuador: IVA 15%.
- **Respuesta:** Pendiente: ¿el `monthly_cost` definido es **precio final con IVA incluido**, se le **suma 15%**,
  o es **configurable** (`iva_rate` por suscripción)? Propuesta: `iva_rate` configurable, default a decidir.

## Preguntas para el usuario (negocio — no deducibles del repo) · ✅ todas resueltas (2026-06-11)
- **P10 (modelo de cobro):** ✅ por **mes calendario**, vencimiento = día de corte de cada mes.
- **P11 (roles):** ✅ **admin + member** (`roles:['member','admin']` en NavItem y checks de API).
- **P12 (alerta):** ✅ **7 días** antes (`ALERT_WINDOW_DAYS=7`): ámbar ≤7d, roja si venció e impago.
- **P13 (IVA):** ✅ **CORREGIDO 2026-06-11 → SIN IVA (0%)**. El usuario aclaró que GCC todavía no cobra IVA;
  el costo mensual es el **valor neto** (ej. $5 son netos, no recalcular $0.65 como IVA). `iva_rate=0` por
  defecto (tabla/POST/UI). Se conserva la columna `iva_rate` por suscripción por si en el futuro se activa.
  Suscripciones existentes actualizadas a 0% vía UPDATE. (La 1ª factura #30 ya se emitió con IVA y quedó
  autorizada en SRI; su total $5 es correcto, revertir el desglose requeriría nota de crédito.)

## Anular factura de suscripción → revertir el mes (2026-06-11)
Requisito del usuario: al **anular** (nota de crédito) una factura que provino de una suscripción, el mes
correspondiente debe volver a **pendiente de pago**. Implementado: `POST /api/invoices/[id]/void`, tras
autorizar la NC y marcar la factura `voided`, si `source_type='subscription'` llama
`revertSubscriptionPaymentForVoidedInvoice(invoiceId)` → borra la marca de pago (mes → pendiente) y
`removeIncomeFromFinance('subscription','<subId>-<YYYY-MM>')` (quita el ingreso del dashboard + log).
Esto cierra el ciclo: anular → mes pendiente → se puede volver a cobrar (nueva factura + ingreso limpios).

## Decisión sobre DESMARCAR un mes (política fiscal)
Una factura electrónica **autorizada por el SRI no se puede anular** sin nota de crédito. Por eso:
- "Marcar pagado" genera la factura, la envía por email y registra el ingreso **solo si el SRI autoriza**
  (si rechaza, no se marca pagado y se muestra el error; la factura queda en estado `generated`).
- "Desmarcar" está **permitido solo si el mes NO tiene factura emitida** (caso borde). Si ya tiene
  `invoice_id`, el endpoint responde 409 con mensaje "requiere nota de crédito". (Revisable a futuro.)

## Decisiones de diseño / arquitectura (firmes)
- **2 tablas nuevas** (`subscriptions`, `subscription_payments`) creadas con `CREATE TABLE IF NOT EXISTS`
  dentro de un `ensureSubscriptionTables()` invocado por los endpoints (patrón del repo, sin migraciones SQL).
- **Snapshot de datos SRI del cliente** en la suscripción (al crear, reusando patrón "Cliente previo" +
  `/api/clients`) → al marcar pagado se factura sin volver a pedir datos.
- **Reutilizar el flujo de `from-ticket`**: crear factura (`source_type='subscription'`) → registrar ingreso
  (`addIncomeToFinance`, fecha = hoy) → `sendInvoiceToSri` → email Resend con PDF. Idempotencia por `source_log`
  y por `(subscription_id, period)` único.
- **Marcar pagado** solo se confirma si la factura **SRI queda autorizada** (consistente con tickets); si falla,
  se informa y no se marca (o se permite reintento). La fila `subscription_payments` guarda `invoice_id`.
- **UI 100% `.corp`**: `ModuleToolbar` + `PixelDataTable` (tabla principal) + panel lateral derecho propio para
  los meses (puede ser un `PixelModal` md/lg, que ya es panel derecho, o un panel sticky tipo `PropertyRail`).
  Fuentes `var(--font-display)`/`var(--font-body)`, badges `PixelBadge`, sin hex hardcodeado.

## Plan de solución (se concreta al cerrar P10–P13)
1. **BD:** `ensureSubscriptionTables()` (subscriptions + subscription_payments).
2. **API:** `GET/POST /api/subscriptions` (listar/crear, con alerta calculada), `GET /api/subscriptions/[id]`
   (detalle + meses derivados), `POST /api/subscriptions/[id]/pay` (marcar mes pagado → factura+email+ingreso),
   `POST /api/subscriptions/[id]/unpay` (desmarcar; decidir si anula factura o solo quita el flag — a definir),
   `PATCH/DELETE /api/subscriptions/[id]`.
3. **Lib:** `createManualInvoiceFromSubscription` (o reusar genérica) + helper de email compartido.
4. **UI:** `app/(dashboard)/dashboard/subscriptions/page.tsx` (tabla + toolbar + modal crear + panel meses) y
   NavItem en el sidebar. Estilo `.corp` calcado de `projects/page.tsx`.
5. **Verificar:** `tsc --noEmit`, compilación, y prueba del flujo (factura/email/ingreso) en caso real.

## Riesgos y cómo se mitigan
- **Doble cobro / doble ingreso** al re-marcar → unicidad `(subscription_id, period)` + idempotencia de
  `addIncomeToFinance` (source_log).
- **SRI rechaza la factura** (datos de cliente inválidos) → exigir datos SRI válidos al crear la suscripción;
  no marcar pagado si no se autoriza; mostrar el error de SRI.
- **Mes corto (feb) con corte 29/30/31** → clamp del día de corte al último día del mes.
- **Zona horaria en cálculo de meses/vencimientos** → calcular con fechas locales del servidor de forma
  consistente (igual que el resto del repo); `period` se guarda como primer día del mes (date sin hora).
- **Desmarcar un mes ya facturado** → una factura SRI autorizada no se puede "borrar" sin nota de crédito;
  definir política (probablemente: desmarcar solo si no estaba facturado, o requerir anulación manual).

---

## Histórico — objetivo anterior (✅ cerrado 2026-06-07)
**Rediseño del `/dashboard` de pixelart → corporativo (Microsoft/Fluent, scope `.corp`).** Implementado y
verificado estáticamente (tsc OK, compila); pendiente solo confirmación visual del usuario. Todo el detalle
de fases (1–9: tokens `.corp`, controles/modales Fluent, formularios como panel lateral derecho, contraste,
quitar título+descripción, `ModuleToolbar`, sidebar lucide, páginas de detalle estilo Monday) está registrado
en **`MEMORIA.md`** (sección "Lecciones técnicas → Theming corporativo") y en el historial de git. Objetivos
previos (feature "Cliente previo") también en MEMORIA.md/git.

## Aprendizaje técnico — Grafo tipo Obsidian con `react-force-graph` (2026-07-07)
Contexto: sistema **Apoyo y Autoayuda** (Centralizado) — visualizar Situación→Problemas→Causas y
Soluciones→Problemas+Causas como un *graph view* estilo Obsidian. Detalle de diseño en `Diseño.md`.

### P — ¿Qué usa Obsidian y cómo replicarlo en open source? · ✅ Resuelta
Obsidian es **cerrado**; su graph = **d3-force** (física/layout) + **PIXI.js/WebGL** (render). La forma
open-source equivalente es **`react-force-graph`** (vasturiano), mismo motor `d3-force` con render en
canvas/WebGL. Elegido **`react-force-graph-2d`** (canvas 2D).

### P — ¿Cómo integrarlo en Next.js (SSR) conservando el `ref`? · ✅ Resuelta
La lib usa `window/canvas` → no puede importarse en SSR. **`next/dynamic` NO reenvía refs** (y el `ref`
es necesario para `d3Force`, `zoomToFit`, `zoom`). Solución: cargar la lib con `import('react-force-graph-2d')`
dentro de un `useEffect`, guardarla en `useState` y **renderizar el componente real** con `ref` normal;
placeholder mientras carga. Medir ancho/alto del contenedor con `ResizeObserver`.

### P — Gotchas de rendering en canvas · ✅ Resuelta
- `createRadialGradient` **lanza** si `x/y/r` no son finitos → en los primeros frames `node.x/y` pueden
  ser `NaN` (antes de que la física posicione). **Guardar** con `Number.isFinite` al inicio de
  `nodeCanvasObject`/`nodePointerAreaPaint`.
- Formas por tipo: trazar el path en canvas (`traceShape`) y usar `nodePointerAreaPaint` con la misma
  forma para que el hit-test coincida.

### P — ¿Cómo evitar el "salto"/lentitud al cambiar aristas? · ✅ Resuelta
Dos causas: (1) **refetch completo** del grafo por cada cambio; (2) recrear los objetos-nodo cambia su
identidad → react-force-graph **reinicia el layout** y pierde posiciones. Solución: **actualización
optimista** del estado local (sync en 2º plano, revertir si falla) + **cachear los objetos-nodo por key**
(useRef Map) para conservar `x/y`; y disparar `zoomToFit` **solo cuando cambia el conjunto de nodos**
(firma `nodes.map(n=>n.key).join()`), no al cambiar aristas.

### Lecciones de diseño (del usuario, iterando) · ✅
- Fondo **negro** puro (sin nebulosa morada). Color oscuro de marca (`#4B2D8E`) **no se distingue** sobre
  negro → subir a violeta vivo `#8b5cf6`. Nodos **sin núcleo blanco** (se ve "infantil"): orbe saturado +
  halo. Distinción por **forma + tamaño**, no solo color. Panel de detalle **transparente** con bloques
  "glass" (`bg-black/40 backdrop-blur`) para leerse sobre el canvas sin taparlo; **anclado abajo-derecha**;
  incluir **referencias a conexiones** (chips navegables).

---

## Objetivo (2026-07-08) — Sistema "Comandos Violeta" (políticas organizacionales activables)
**Rol asumido:** arquitecto de plataforma + ingeniero full-stack (modelado de datos, grafo, enforcement transversal).

**Necesidad:** un sistema (Centralizado, global · creación) donde el usuario global crea **políticas** agrupadas por
**categoría**, activables/desactivables; cada política contiene **funciones** que, al activarse, generan **acciones en toda
la app**: mensaje permanente (header), bloqueo de módulos (seguridad), generación de tareas, y **detalle/términos** (documento
textual compartible). Interfaz espejada del sistema Apoyo (categorías izq → grafo → panel de detalle), con formas de grafo NO
usadas en Apoyo.

- **% de información para el objetivo:** ~90% — AUTORÍA completa + enforcement de mensaje y bloqueo HECHOS y verificados; **falta
  la generación real de tareas** en Mi día al activar (la lógica de presencia ya está especificada: ver TaskProgram en MEMORIA).
- **Resumen del estado:** modelo Categoría→Política→Función en tablas `cv_*`; grafo con 3 formas (estrella/pentágono/documento);
  4 tipos de función; banner flotante por pestañas con visor de detalle; bloqueo real de módulos para no-admin.

### Preguntas y decisiones · ✅
- **P — ¿Dónde vive y cómo aparece el sistema sin crearlo a mano?** → Es built-in por slug (`comandos-violeta`); se **siembra
  idempotente** dentro de `ensureTable()` de la ruta de `systems` (se llama en cada carga de Centralizado). Sembrarlo solo en su
  propia `comandos-db` NO basta: hay huevo-y-gallina (el despacho busca el sistema por slug antes de renderizar el componente).
- **P — ¿El banner dónde va para no romper el layout?** → Un banner en el flujo de `<main>` empuja el contenido y **recalcula** los
  componentes que miden su `top` (`innerHeight − top`). Solución: **fixed, fuera del flujo, sin reservar espacio**
  (`pointer-events-none` salvo el card). Ubicación final: flotante arriba, tipo pestañas.
- **P — ¿Cómo mostrar varias políticas activas sin amontonar?** → **Pestañas** (una por política; solo se ve el contenido de la
  seleccionada). Header morado + zona inferior color tarjeta; la pestaña activa toma el color de la zona inferior (tipo navegador).
- **P — Presencia de la tarea generada.** → El usuario aclaró: NO son opciones excluyentes ni hace falta recurrencia. Inicio =
  **fecha de activación** (fijo); `daysCount` = ventana/límite; `weekdays[]` = días presentes (recurrencia dentro de la ventana);
  `allDay` + `startTime`/`endTime`. (Ver TaskProgram en MEMORIA.)

### Lecciones técnicas · ✅
- **Multiselect dentro de panel flotante con `overflow-y-auto`**: el dropdown de `MultiSelectSearch` se **recorta**. Para listas
  cortas (módulos), usar **chips toggle** en vez de dropdown.
- **`bg-white` bajo `.corp` (modo oscuro)** puede quedar pisado → una pestaña "blanca" salía oscura. Para colores garantizados en
  cualquier tema, usar **estilos inline** (`style={{ background:'#fff', color:'#4c1d95' }}`), no utilidades Tailwind de color.
- **Grafo reusable pero con formas propias**: se copió el motor de `KnowledgeGraph` a `PolicyGraph` (formas por `shapeOf`, color por
  `colorOf`/`FUNCTION_TYPE_META`) en vez de generalizar el de Apoyo (riesgo de regresión). Documento = rect con esquina doblada.
- **Efectos "serios"**: se quitó la "luz que se movía" (sweep) del banner; queda un flotado sutil. Menos fantasía, más profesional.
- **Enforcement transversal**: un `PolicyEffectsProvider` en el layout provee {policies, blockedModules} a banner + sidebar + guard;
  refresca por `pathname` y por `visibilitychange`.

---

## Objetivo (2026-07-16/17) — Integración Google Workspace (Meet + correo + cuentas) + Responsividad total · ✅ RESUELTO

> Objetivo previo (agente de pesos, 2026-07-12) quedó resuelto. Esta sección acumula los aprendizajes de la
> sesión del 2026-07-16/17. El detalle de implementación vive en `MEMORIA.md`; aquí van las **preguntas técnicas
> y sus respuestas/descubrimientos** (lo que costó averiguar).

### Rol asumido
Integrador de sistemas / arquitecto cloud (Google Workspace Admin SDK, Calendar/Meet/Gmail API) + front responsive.

### Preguntas y respuestas (aprendizajes clave)

#### P1 — ¿Se puede grabar/transcribir un Google Meet automáticamente por API? · ✅ Resuelta
- **Respuesta:** Sí, con la **Meet REST API v2** (`meet.spaces.create`) y `config.artifactConfig`:
  `recordingConfig.autoRecordingGeneration=ON`, `transcriptionConfig.autoTranscriptionGeneration=ON`,
  `smartNotesConfig.autoSmartNotesGeneration=ON` (notas Gemini). Se **adjunta** el space al evento de Calendar
  con `conferenceData` importada (conferenceId + entryPoints) → el evento queda con el Meet nativo que auto-graba.
  Requiere scope `meetings.space.created`. Verificado en vivo: el plan de GCC soporta las tres. (fuente: pruebas
  con la cuenta real)

#### P2 — ¿Un miembro puede tener Gmail `@dominio` gratis? · ✅ Resuelta (NO)
- **Respuesta:** **No.** Gmail/Calendar propios de un dominio **exigen licencia PAGADA** (Business Standard+ para
  grabar). **Cloud Identity es GRATIS** pero solo da **identidad + perfil (nombre/foto/teléfono)** — sin Gmail,
  sin Calendar, sin grabación. Unirse a un Meet sí es gratis. → Decisión: cuentas de miembros = Cloud Identity
  gratis (identidad+perfil); las reuniones las organiza y **graba la cuenta del líder** (una sola licencia).

#### P3 — ¿Se puede evitar por código la licencia pagada auto-asignada? · ✅ Resuelta (NO)
- **Respuesta:** **No.** La org tenía **auto-asignación de licencias ON** → cada usuario nuevo recibe Business
  Standard; `licenseAssignments.delete` no la quita (y la auto-asignación la re-pone). La ÚNICA vía limpia es
  **desactivar la auto-asignación** (Admin → Facturación), idealmente **por unidad organizativa** (se creó `/Candidatos`).
  Durante el **trial** no se puede desactivar hasta pasar a pago. (fuente: pruebas creando/borrando usuarios de test)

#### P4 — Crear la clave JSON de la service account estaba bloqueado · ✅ Resuelta
- **Respuesta:** Política "segura por defecto" `iam.disableServiceAccountKeyCreation`. Se sobrescribe con
  `gcloud org-policies set-policy` (enforce=false a nivel proyecto), teniendo `roles/orgpolicy.policyAdmin`.

#### P5 — Bug de zona horaria en el formulario del calendario público · ✅ Resuelta
- **Respuesta:** `zonedWallclockToUTC` usaba `new Date(string)` → **dependía de la zona del navegador** y daba
  horas erróneas. Se reescribió con `Intl.formatToParts` (independiente de la zona local; verificado en
  UTC/Ecuador/Madrid/Tokyo). Decisión de UX: el calendario público SIEMPRE en horario del miembro (Ecuador).

#### P6 — Patrón de responsividad reutilizable para toda la app · ✅ Resuelta
- **Respuesta:** 3 piezas: (1) `hideOnMobile` por columna en `PixelDataTable` (`hidden sm:table-cell`);
  (2) `DetailHeader` con acciones que **envuelven** (`flex-wrap`); (3) apilar-con-altura-condicional:
  `flex-col lg:flex-row` + `w-full lg:w-[Npx]` + `max-h-[..]/min-h-[..] lg:…-none/0`, y en calendarios,
  forzar **vista de Día** en `<768px`. Aplicado a TODO el dashboard. Excepción: editores de canvas del mundo.

### Estado
- **% de información para el objetivo: 100%** — todo implementado y verificado en vivo (Gmail/Meet reales,
  cuentas de prueba, BD ROLLBACK, tsc+build). **Pendiente NO técnico:** env `GOOGLE_SA_KEY`/`GOOGLE_WORKSPACE_ORGANIZER`
  en Railway (prod) y, al pasar el trial, excluir `/Candidatos` de la auto-asignación de licencias.

---

## Tema (2026-07-24) — HERRAMIENTA DE TRANSCRIPCIÓN de audio: fallos con audios largos

**Rol asumido:** *ingeniero de plataforma / diagnóstico de fiabilidad en producción (Railway + Cloudflare + Next.js)*.

### Necesidad
La herramienta `/dashboard/tools → Transcribir Audio` (`POST /api/tools/transcribe`, Whisper) fallaba al
transcribir un audio **largo (~1.5 h)**; el usuario valora la UX actual (una sola petición + barra de progreso)
y no le importa mantener la app abierta. Objetivo: que funcione sin cambiar esa UX.

### Preguntas y respuestas
#### P1 — ¿Por qué salía `Transcribe error: aborted`? · ✅ Resuelta
- **Respuesta:** en un primer episodio, **falta de créditos en OpenAI** → Whisper devolvía `aborted`. (fuente: usuario)
  **Lección:** ante `aborted`/errores de API opacos, **verificar créditos/cuota del proveedor ANTES** de asumir
  causas de infraestructura.

#### P2 — ¿El `SIGTERM`/reinicio del contenedor era por despliegue o por OOM? · ✅ Resuelta (ninguno)
- **Respuesta:** se descartó con evidencia. (a) **Deploy:** el historial de `corazonescruzados` mostró que NO
  hubo despliegue durante los fallos del usuario (el activo era de horas antes). (b) **OOM:** hipótesis
  razonable (el código cargaba todo el archivo en RAM), pero no era la causa. (c) **ReDoS:** las regex de
  dedup se probaron y corrían en **0 ms** con entradas sintéticas → hipótesis retirada. **Lección:** verificar
  cada hipótesis (historial de deploys por `railway deployment list --service <web>`, benchmark de regex)
  en vez de encadenar suposiciones.

#### P3 — ¿Cuál era la causa REAL? · ✅ Resuelta
- **Respuesta:** **tope duro de ~300 s por petición en la plataforma** (Railway/Cloudflare — se vio Cloudflare
  `172.66.x.x` en el network log). El HTTP log lo delató: `POST /api/tools/transcribe → 499 → 4min59s/5min`
  (≈300 s exactos). **`export const maxDuration` NO lo sube** (se probó 600 y siguió cortando en 300). Con
  un audio de 1.5 h, la transcripción **secuencial** no cabía en 300 s.

#### P4 — ¿Cómo hacerlo caber en <300 s sin cambiar la UX? · ✅ Resuelta (funcionó en vivo)
- **Respuesta:** tres optimizaciones invisibles al usuario:
  1. **Troceo con input seeking** (`-ss` **antes** de `-i` en ffmpeg): evita re-decodificar desde el inicio en
     cada segmento; el troceo pasa de minutos a segundos.
  2. **Transcripción en PARALELO** (concurrencia 5, pool de workers, ensamblado por índice) en vez de uno por uno.
  3. **Dedup lineal/acotado** (`collapseWordRuns`/`collapseSentenceRuns`) en vez de regex con backreference que
     en transcripts reales largos podían colgar la CPU.
  **Verificado en vivo:** el usuario confirmó que "al fin pudo finalizar" con un audio de ~1.5 h.

### Decisión de proceso (importante)
Se intentó una **reescritura a procesamiento en segundo plano** (job + polling + persistencia por segmento) que
**el usuario rechazó** porque le cambiaba/rompía la barra de progreso que ya le funcionaba. **Regla:** ante un
problema de fiabilidad, **optimizar primero dentro de la arquitectura existente** (que el usuario ya valida) y
solo ir a un rediseño mayor si de verdad no hay forma (p. ej. audios de 3+ h que ni optimizados entren en 300 s),
y aun así **conservando la UX** (barra vía sondeo).

### Estado
- **% de información para el objetivo: 100%** — causa raíz identificada (tope de ~300 s) y resuelta con
  optimizaciones dentro de la misma UX; **verificado en producción** por el usuario.

---

## Tema (2026-07-26) — "ENTRAR" debe pedir SIEMPRE iniciar sesión (no reconocer por cookie/IP)

**Rol asumido:** *ingeniero de autenticación y flujos de acceso (Next.js App Router + sesiones propias)*.

### Necesidad
En la landing, el botón **"Entrar"** metía **directo al juego** cuando el visitante era "reconocido"
(caché/cookie/IP). El usuario pide **eliminar ese atajo**: "Entrar" debe **exigir login siempre**,
igual que ya hace **"Colaborar"**.

### Preguntas y respuestas
#### P1 — ¿Qué reconocía al visitante y dónde se saltaba el login? · ✅ Resuelta (código)
- **Respuesta:** `GET /api/character/me` busca la fila de `gcc_world.clients` por **cookie
  `gcc_client_token`**, y si no hay, **por `ip_hash`** (y como último recurso por sesión de staff).
  Si devolvía personaje, `app/page.tsx` guardaba `savedCharacter`; el `onClick` de "Entrar" tenía la
  rama `if (savedCharacter) { gateGameEntry(); setWindAway(true) }` → el `useEffect` de retorno llamaba
  a `enterAsReturning()` → `location.href = '/juego'`. **Ese era el atajo**: cero credenciales.
- **Por qué importa:** era el comportamiento exacto a eliminar.

#### P2 — ¿Por qué "Colaborar" sí pedía login? · ✅ Resuelta (código)
- **Respuesta:** su handler no tiene rama de atajo: siempre `setEntryDestination('dashboard')` +
  `setEntryChoiceOpen(true)`. Los tres caminos del menú (`AccountRecoveryModal`, `ClientLoginModal`,
  `MemberLoginModal`) piden credenciales + código (o passkey) — **ninguno tiene auto-login**. La
  corrección es, literalmente, **igualar "Entrar" a "Colaborar"** cambiando solo `entryDestination`.

#### P3 — ¿Bastaba con arreglar el botón? · ✅ Resuelta (no)
- **Respuesta:** no. **`/juego` estaba abierta**: sin gate en `middleware.ts` (solo protege
  `/dashboard`) ni en la página. Escribir la URL, un marcador o el historial entraban al juego sin
  pasar por la landing → el "siempre pide login" se caía por ahí.

#### P4 — ¿Marca de sesión en cookie o en `sessionStorage`? · ✅ Resuelta (decisión de diseño)
- **Respuesta:** **`sessionStorage`** (`gcc_game_entry`, ver `lib/world/gameEntry.ts`). Una cookie de
  sesión duraría **todo el navegador** (varias pestañas, mucho tiempo); `sessionStorage` es **por
  pestaña**: sobrevive a **recargar el juego** (no expulsa a nadie a mitad de partida) pero no a una
  pestaña nueva ni a cerrar el navegador → volver al juego pasa siempre por la landing y el login.
  Si el navegador bloquea `sessionStorage`, `hasGameEntry()` devuelve `true` (**no** dejar a nadie
  fuera del juego por una restricción del navegador). Es **control de flujo, no seguridad**: los datos
  del jugador los siguen protegiendo las rutas `/api/character/*` con su cookie de sesión.

#### P5 — ¿Qué NO había que tocar? · ✅ Resuelta
- **Respuesta:** el reconocimiento por cookie/IP de `/api/character/me` **se conserva**: sigue haciendo
  falta para **recuperar el personaje después del login** y para que `CharacterCreator` no cree
  duplicados. Lo que se le quitó es el poder de **abrir la puerta**. Tampoco se tocó `gateGameEntry()`
  (aprobado + correo verificado) ni el enrutado por `entryDestination`.

#### P6 — ¿Había código vivo dependiendo del atajo? · ✅ Resuelta (era código muerto)
- **Respuesta:** `freshAuth`, `enteredAsMember` (y también `ipRole` con su `fetch('/api/auth/landing-role')`)
  estaban **declarados y asignados pero nunca leídos** — restos del juego viejo embebido
  (`CharacterGameplay`), retirado al pasar a Godot en `/juego`. Se eliminaron: describían justo la regla
  contraria a la nueva. **Lección:** al retirar un componente grande, sus banderas de estado quedan
  "vivas" en la página y **confunden el diagnóstico**; conviene borrarlas en el momento.

### Solución (implementada y verificada)
1. `app/page.tsx` — el `onClick` de "Entrar" solo abre el menú (`entryDestination='game'`); fuera la
   rama `savedCharacter`.
2. `lib/world/gameEntry.ts` (nuevo) — `markGameEntry()` / `hasGameEntry()` / `clearGameEntry()`.
3. `components/game/GameEntryGate.tsx` (nuevo) — portero de `/juego`: sin marca → `location.replace('/')`;
   mientras decide pinta negro (no descarga los ~10 MB del motor).
4. `app/juego/page.tsx` — envuelve `<GodotGame/>` en `<GameEntryGate>`.
5. La marca se acredita en los **dos** puntos que navegan al juego, ambos posteriores a un login real:
   `enterAsReturning()` y `CharacterCreator.onConfirm`.
- **Verificación:** `npx tsc --noEmit` limpio y `npm run build` OK (`/juego` compila).

### Estado
- **% de información para el objetivo: 100%** — atajo eliminado, ruta del juego cerrada y flujos de
  login intactos. Falta solo la comprobación en vivo del usuario (entrar, jugar, volver y confirmar
  que "Entrar" vuelve a pedir sesión).

### Continuación (2026-07-26) — el personaje debe pertenecer a la CUENTA que inicia sesión

**Petición del usuario:** *"el personaje debe ahora estar vinculado al usuario que está iniciando sesión"*
— consecuencia lógica de quitar el reconocimiento por IP: si la puerta la abre el login, la identidad
del jugador también tiene que salir de ahí.

#### P7 — ¿A qué estaba atado el personaje? · ✅ Resuelta (código)
- **Respuesta:** al **dispositivo**. `/api/character/me` buscaba por `client_token` (cookie) → `ip_hash`
  → y solo como último recurso por la cuenta. Y `/api/character/save`, sin sesión de staff, actualizaba
  la fila **de la cookie** o creaba un **invitado** con correo `alias-<timestamp>@guest.gcc-world.local`.
  Resultado: dos personas en la misma red se pisaban, y la misma persona en otro equipo "no existía".

#### P8 — ¿Tienen todos los jugadores una cuenta en `gcc_world.users` a la que vincular? · ✅ Resuelta
- **Respuesta:** **sí**. Miembro/admin y cliente inician sesión contra `users` (JWT); y al candidato se
  le crea/enlaza su fila `users` (rol `client`) + JWT en `grantCandidateDashboardSession()`, que corre
  tanto al **completar cuenta** (`complete-profile`) como al **iniciar sesión** (`recover/verify`).
  Por eso `user_id` sirve como identidad **única** para los cuatro tipos de jugador.

#### P9 — ¿Por qué el `user_id` del miembro salía NULL? · ✅ Resuelta (bug encontrado)
- **Respuesta:** `/api/character/save` leía **`user.id`** del payload del JWT, pero `getCurrentUser()`
  devuelve **`{ userId, email, role }`**. `user.id` era `undefined` → `node-pg` lo manda como NULL →
  `SET user_id = NULL` y el `WHERE user_id = $1` nunca casaba (solo salvaba el `OR` por correo).
  **No lo detectaba TypeScript** porque `TokenPayload extends JWTPayload` (jose) tiene índice
  `[propName: string]: unknown`, así que **cualquier propiedad compila**. **Lección:** con tipos que
  llevan index signature, un typo de campo pasa el typecheck; conviene leer los campos del token una
  sola vez en un helper (lo que ahora hace `getPlayerSession()`).

#### P10 — ¿Y el cliente, que no abre sesión de jugador? · ✅ Resuelta (segundo bug)
- **Respuesta:** el cliente inicia sesión en `/api/auth/login/verify`, que emite **JWT** pero **no**
  la cookie `gcc_player_auth`. `getAuthedClient()` exigía esa cookie → **todas** las rutas del juego
  (`/api/world/*`, `/api/game/stages`, `/api/character/layers`) le respondían **401**: entraba al juego
  y no cargaba ni su personaje. Se le añadió **fallback por JWT**.

#### P11 — ¿Cuánta gente rompe la migración? · ✅ Resuelta (consulta a la BD, 2026-07-26)
- **Respuesta:** **nadie**. `gcc_world.clients`: 16 filas, **2 con personaje y las 2 con `user_id`**;
  cero filas con personaje sin vincular y cero invitados. **Lección de proceso:** antes de cambiar el
  criterio de identidad, **contar en la BD** a cuántos deja fuera; si hubiera habido huérfanos habría
  hecho falta una migración (vincular por correo) antes de desplegar.

#### P12 — ¿Qué reconocimiento por IP se conserva y por qué? · ✅ Resuelta (decisión)
- **Respuesta:** solo `GET /api/candidate/proposal` y `/api/client/status`, que pintan las tarjetas
  informativas del menú ("tu postulación está en revisión"). Es el **único caso sin alternativa**: el
  postulante todavía **no tiene cuenta** con la que iniciar sesión. **No dan acceso a nada.** Queda
  anotado el riesgo: en una IP compartida podrían enseñar el correo de otra persona.

#### Solución (implementada, `npx tsc --noEmit` + `npm run build` OK)
`lib/world/player.ts` (`getPlayerSession()`, fuente única de identidad) · `/api/character/me` resuelve
por sesión · `/api/character/save` vincula `user_id`, 401 sin sesión y **sin invitados** ·
`getAuthedClient()` con fallback por JWT · la landing reabre el menú de ingreso si el guardado da 401.

---

## Tema (2026-07-27) — CREADOR DE PERSONAJE con assets generados por IA (estilo del prólogo)

**Rol asumido:** *artista técnico / pipeline de arte generativo para sprites 2D*.

### Necesidad (del usuario)
El creador debe permitir componer un personaje **con el aspecto de la estampa 01** (la aldeana), no
con una librería descargada (hoy usa LPC y por eso no pega). Rasgos elegibles: **sexo** (hombre/mujer),
**tono de piel**, **color de cabello**, **tipo de cejas**, **barba** (solo hombre), **grosor del torso**
(hombre) / **tipo de cuerpo** (mujer), **vestimenta superior e inferior por separado** y según el sexo,
y **accesorios de cabeza** (gorra, pañuelo…). La **edad NO se elige**: el protagonista es adolescente
de **17 años**. Estilos de vestimenta: rústica ahora; moderna / futurista / cavernícola más adelante.

### Preguntas y respuestas
#### P13 — ¿AI Studio o fal.ai? · ✅ Resuelta (pregunta mal planteada)
- **Respuesta:** **no son rivales**. El generador de sprites que teníamos llamaba a
  `fal-ai/nano-banana-pro`, y *nano-banana* **es el modelo de imagen de Google**: el mismo que usa
  `generar_estampas.py` vía AI Studio. fal solo aportaba la tubería (cola de trabajos + un modelo de
  recorte de fondo). Se elige **AI Studio directo** (`GEMINI_API_KEY`), para tener **una sola
  tubería de arte** con el prólogo. Con esa clave hay además modelos mejores disponibles:
  **`gemini-3-pro-image`** (el que se usa) frente al `gemini-2.5-flash-image` de las estampas.

#### P14 — ¿Puede el modelo dar hojas de sprites con NUESTRO estilo? · ✅ Resuelta (sí, verificado)
- **Respuesta:** sí, anclando con el recorte de la aldeana de `escena_01.png`. Devuelve las 4 vistas
  (frente, espalda, dos perfiles) en una fila, misma altura, misma línea de suelo, paleta y grosor de
  contorno correctos. Verificado generando las dos bases (hombre y mujer): `public/personajes/base/`.

#### P15 — ¿Se puede editar UNA sola cosa y conservar el resto? · ✅ Resuelta (sí, pero no al píxel)
- **Respuesta:** se le pidió a una hoja ya generada *"quítale el pañuelo, no cambies nada más"* y
  cumplió: misma postura, misma escala, misma ropa, mismos pies. **Pero no es fiel al píxel**: hay
  derivas de ±1 px y redibujados sutiles. ⇒ **NO se pueden extraer capas restando dos imágenes**
  (sale ruido). La solución es **normalizar por geometría**, no por resta (ver P17).

#### P16 — ¿Devuelve transparencia? · ✅ Resuelta (NO, y es una trampa)
- **Respuesta:** **no**. Aunque se pida "fondo transparente", el modelo **dibuja un cuadriculado gris
  imitándola** y entrega alfa 255 en toda la imagen (medido: 100 % de píxeles opacos). Por eso el
  flujo viejo de fal tenía un paso de `bria/background/remove`. Aquí se resuelve **sin gastar otra
  llamada**: relleno por color **desde los bordes** (nunca desde dentro, o se comería los blancos de
  la ropa). Con `gemini-3-pro-image` el fondo sale blanco liso, aún más fácil de quitar.

#### P17 — Entonces, ¿cómo se garantiza que las piezas encajen? · ✅ Resuelta (decisión de diseño)
- **Respuesta:** **recuadrando cada figura a una rejilla fija**. Tras quitar el fondo se localizan las
  4 figuras por sus huecos verticales, se reducen **todas por el mismo factor** (el que lleva la más
  alta a `ALTO_FIGURA`; si cada una se escalara por su cuenta, el personaje "encogería" al girar) y se
  pegan centradas y **apoyadas en la misma línea de suelo**. Eso **anula la deriva de ±1 px** y hace
  que piezas de tiradas distintas vuelvan a encajar. Celda actual: **96×128**, hoja de **384×128**.

### Plan de solución (por fases)
1. ✅ **Bases** — una hoja por sexo, ropa neutra, sin accesorios. HECHO y verificado.
2. **Prendas y rasgos** — una tirada por opción, *editando la base* ("ponle esta prenda, no cambies
   nada más") y pasándola por el mismo recuadrado. Superior e inferior por separado, por sexo.
3. **Color por código, no por IA** — tono de piel y color de cabello se resuelven **intercambiando
   paletas** sobre la pieza ya generada: es exacto, gratis y multiplica la variedad sin más tiradas.
4. **Grosor del torso / tipo de cuerpo** — estirando la banda del torso, como ya se hacía con LPC
   (que solo trae 3 siluetas para 5 niveles). Sin tiradas nuevas.
5. **Catálogo y creador** — sustituir `lib/game/lpc-catalog.ts` por el catálogo nuevo y que
   `CharacterCreator` componga estas hojas.
6. **Animación de caminar** — pendiente: hoy son poses estáticas. Es lo más delicado (fotogramas
   coherentes) y se aborda cuando el aspecto esté cerrado.

### Riesgos y cómo se mitigan
- **Cada tirada es distinta** ⇒ el script guarda el crudo y permite `--reprocesar` (afinar el
  post-proceso sin gastar generaciones) y `--forzar` (volver a tirar si el estilo no convence).
- **La coherencia entre piezas** se sostiene porque todas se generan **editando la misma base**, no
  desde cero.
- **La animación** puede obligar a repensar el recuadrado; por eso va al final.

### Estado
- **% de información para el objetivo: 85%** — técnica validada de punta a punta con dos bases reales
  en el repositorio. Falta acordar el catálogo concreto de prendas y resolver la animación.

#### P18 — ¿Cómo se eliminan del todo los restos del fondo? · ✅ Resuelta (2026-07-27, tras 3 intentos)
- **Síntoma:** el usuario seguía viendo rastros blancos en el contorno después de dos rondas de
  limpieza con umbrales cada vez más finos.
- **Diagnóstico real:** el problema no era la limpieza sino **la reducción**. El modelo dibuja cada
  píxel de arte como un bloque de ~5 px y deja 1–2 px de mezcla en el borde; al reducir con `nearest`
  se toma UN píxel de cada bloque, y cuando caía en el borde entraba ya contaminado. Peor: al medir
  los píxeles se vio que la mezcla del **contorno oscuro con el blanco da GRISES MEDIOS**
  (77,67,66 · 135,125,123) — ningún umbral de brillo puede separarlos del arte.
- **Solución (dos frentes, ambos en `reducirPorMayoria` / `paletaReal`):**
  1. **Reducir por mayoría de color**: cada bloque se resuelve al color dominante, así la mezcla
     —siempre minoría— nunca gana; y un bloque mayoritariamente fondo queda transparente entero.
  2. **Solo colores de la paleta real**, calculada del INTERIOR de la figura (a ≥2 px del vacío),
     donde por definición no hay contaminación. Lo que solo existe en el borde queda excluido.
- **Verificado:** 0 grises de mezcla y 0 píxeles semitransparentes en ambas hojas; silueta limpia
  sobre magenta. **Aprobado por el usuario.**
- **Lección:** cuando afinar un umbral no acaba de resolver algo, suele ser que el criterio es el
  equivocado. Aquí no había brillo que separase arte de mezcla, pero la **paleta** sí los separa.

#### P19 — ¿Cómo se eligen arriba y abajo por separado si no hay capas? · ✅ Resuelta (medido)
- **Respuesta:** **composición por bandas**. Cada prenda se genera editando la plantilla, y al medir
  una prenda superior contra la base se vio que **el cuerpo no se mueve**: los cambios se concentran
  entre y=42 e y=80 (el torso), mientras que la cabeza (y 10–30) y las piernas (y 85–118) difieren en
  ~30 px sobre ~2.000, es decir nada. ⇒ se corta a la altura de la **cintura (y=80** de la celda de
  128) y se pega la mitad de arriba de una prenda con la mitad de abajo de otra.
- **Verificado:** blusa verde de una tirada + falda de otra = personaje coherente, **costura
  invisible**. No hacen falta capas con alfa ni extracción por resta.
- **Ventaja añadida:** la pieza superior aporta cabeza y brazos, la inferior aporta pies; como todas
  salen de la misma plantilla, encajan siempre.

#### P20 — El modelo se satura · ✅ Resuelta
- **Respuesta:** `gemini-3-pro-image` devuelve **503 "high demand"** con frecuencia, y una tanda de
  14 prendas se topa con ello casi seguro. `generar()` reintenta con espera creciente (15 s, 30 s,
  60 s…) y cubre también caídas de red (`fetch failed`), porque la petición lleva la plantilla entera.

#### P21 — Peinados, tocados y barba: ¿tercera banda? · ✅ Resuelta (con un límite medido)
- **Sí para pelo y tocado.** Se generan igual que las prendas y se recortan por la banda de la
  **cabeza**. Medido: un peinado o un tocado cambia **230–250 px** dentro de y 0–42, mientras que
  torso y piernas se mueven 30–80, que es la deriva normal entre tiradas.
- **NO para la barba.** La barba incipiente cambia solo **64 px** en la cabeza y **100 en el torso**:
  es decir, el cambio real es *menor que la deriva*, así que resulta indistinguible del ruido. ⇒ La
  barba no puede ser una banda propia; hay que **hornearla en las piezas de pelo** (generar cada
  peinado con y sin barba) o tratarla como otra opción de la misma banda de cabeza.
- **Composición final: TRES bandas** — cabeza (0–42, la pone el peinado o el tocado), torso (42–80,
  la prenda de arriba con sus brazos) y piernas (80–128, la prenda de abajo con el calzado). El corte
  del cuello se puso en **42 y no en 44** para que el **cuello de la prenda** lo ponga entero la pieza
  de arriba; si no, dos filas del cuello de la base se colaban desde la pieza de cabeza.

#### P22 — Color de pelo y piel sin gastar generaciones · ✅ Resuelta (funciona)
- **Se puede porque están muy separados en la plantilla:** el pelo vive en luminancia **19–42** y la
  piel en **153–159**, y la piel es mucho más **saturada** (R−B ≈ 134) que la ropa cruda (R−B ≈ 41).
  La duda que yo había planteado —que un castaño y un tono de piel se confunden— no aplica aquí
  porque este pelo es oscuro.
- **Cómo:** no se sustituye el color, se le cambia **tono y saturación** y se **escala** el brillo,
  conservando el claroscuro. Por eso sigue leyéndose como pixel art. 6 colores de pelo × 5 tonos de
  piel sobre cualquier combinación de ropa, calculado en el navegador.
- ⚠️ **Límite:** el pelo se detecta por estar en la banda de la cabeza, así que **una melena larga
  que caiga sobre los hombros** quedaría fuera. Por eso esta tanda son cortes que no pasan del cuello.

#### P23 — El recoloreado manchaba la ropa y la cara · ✅ Resuelta (3 fallos, 3 causas distintas)
El usuario detectó tres cosas: piel oscura fea, rubio plano y **puntos en el cuerpo que cambiaban con
el color del pelo**, incluso estropeando una túnica que se veía bien con piel clara. Al medir:
1. **La ropa entraba en la mancha de piel.** Mi test era `luz>95 && r−b>70`, y la **túnica parda está
   en luz 95–107 con r−b 70–73** — justo dentro. La piel real está en **luz 153–159, r−b ≈ 130**.
   ⇒ Umbral **estricto para sembrar** (`luz>128 && r−b>105`) y **crecimiento por vecindad** con uno
   flojo. La vecindad es lo que de verdad lo arregla: la ropa no toca la cara, así que no entra
   aunque se le parezca; y los brillos y sombras de la piel sí entran, que sueltos salían como puntitos.
2. **Rotar el tono revienta en los extremos** (de ahí el rubio plano). ⇒ Cada color es una **rampa de
   cuatro tonos** y cada píxel se coloca en ella según su claroscuro relativo. Es cambiar la paleta,
   como haría un dibujante, en vez de empujar el color.
3. ⚠️ **Orden de aplicación:** teñir la piel primero hacía que el pelo se encontrara **una cara ya
   oscurecida**, la confundiera con pelo y la pintara de gris (con piel oscura la cara salía gris).
   ⇒ **Las dos manchas se calculan ANTES de teñir ninguna**, y además el pelo nunca pisa lo que ya es
   piel. Lección general: dos transformaciones que leen el mismo lienzo **no se pueden encadenar**.
- **Módulo reutilizable:** `lib/game/recolor.js` (lo usa el probador y lo usará el creador).

#### P24 — Las cejas se pintaban del color del pelo · ✅ Resuelta (4 reglas, todas de vecindad)
Con piel oscura + rubio, el usuario vio **cejas rubias** y **píxeles sueltos que ensuciaban la cara**.
Causa: yo sembraba el pelo en **todo píxel oscuro de la banda de la cabeza**, y las cejas, los ojos y
la boca *son exactamente eso*. Cuatro reglas, y ninguna mira el color: todas miran el **entorno**.
1. **Sembrar solo en la coronilla** (6 filas desde donde empieza la figura) y bajar desde ahí. Una
   ceja no toca la coronilla; el pelo sí.
2. **La cara entera como frontera**, no solo la piel: se **rellenan los huecos** de la mancha de piel
   (ojos, cejas, boca son islas dentro de ella). Sin esto el pelo se colaba por las sombras del
   rostro, que no llegan a contar como piel.
3. **Veto ceja/flequillo:** un píxel oscuro con **frente justo encima** es ceja; con **pelo encima**
   es flequillo. Es lo único que distingue los dos casos, y sin ello no hay umbral que valga.
4. **Quitar motas** (píxeles de pelo con menos de 2 vecinos) y **tapar huecos de 1–2 px** en la piel
   (brillos sueltos que se quedaban sin teñir y saltaban como puntitos claros en una cara oscura).
- ⚠️ **Límite conocido:** en el peinado *flequillo*, las greñas que caen sobre la cara son pelo de
  verdad, así que se tiñen. Con colores de mucho contraste (ceniza sobre piel oscura) eso se lee como
  ruido. No es del recoloreado: es cómo dibujó esa pieza el modelo. Se arregla regenerándola.

#### P25 — Mechones sobre la cara y accesorios teñidos de pelo · ✅ Resuelta
- **El chico seguía sucio** porque el modelo le dibuja mechones cayendo sobre la sien y la mejilla.
  Son pelo de verdad, pero teñidos de un color de mucho contraste (rubio sobre piel oscura) gritan.
  ⇒ **El pelo se aparta un píxel de la piel** (mirando las 8 direcciones): entre pelo y piel queda el
  contorno oscuro original, que es exactamente lo que dibujaría a mano un pixel artist. La cara queda
  limpia sin perder la silueta del peinado.
- **Los accesorios se teñían del color del pelo**, porque la semilla está en la coronilla y con un
  gorro puesto la coronilla *es el gorro*. ⇒ Si la pieza de cabeza es un **tocado**, no se aplica el
  color de pelo: gorra, capucha y pañuelo conservan el suyo. (El catálogo ya sabe de qué tipo es cada
  pieza, así que no hay que adivinarlo por color.)
- **Pendiente conocido:** con tocado puesto, el pelo que asome tampoco se tiñe. Si se quiere ambas
  cosas habrá que generar las combinaciones peinado + tocado.

#### P26 — ⚠️ ERROR DE ARQUITECTURA: peinado y accesorio no son la misma ranura · ✅ Corregido
- **Corrección del usuario (2026-07-27):** *"no podemos suponer que el peinado o un peinado + un
  accesorio son un mismo objeto, eso lo elige el usuario por separado"*. Tenía razón: yo había metido
  peinado y tocado en la **misma banda de cabeza**, así que elegir gorra borraba el peinado, y como
  parche desactivé el color de pelo al llevar tocado. Eso no es personalización de personaje: en un
  creador, **cada ranura es una capa independiente** y se dibujan por orden.
- **La pieza que faltaba: extraer el accesorio como CAPA con alfa** (`scripts/extraer-capa.mjs`). El
  modelo dibuja el personaje entero con el gorro puesto; se compara con la plantilla y **lo que cambió
  es el accesorio**. La resta cruda no vale (ruido de ±1 px entre tiradas), así que se limpia con lo
  ya aprendido: solo cambios de color grandes, se conserva **la masa conectada mayor de cada vista**
  (un accesorio es una mancha, no píxeles sueltos), se tapan sus huecos y se quitan las motas.
- **Orden de pintado:** bandas del cuerpo → **teñir pelo y piel** → **accesorio encima**, con su color.
  Así el pelo se tiñe de verdad aunque lleve capucha, y la capucha conserva el suyo.
- ⚠️ **Calidad desigual de la extracción:** la capucha y la gorra salen bien; el **pañuelo** peor,
  porque se generó con la instrucción *"cubre el pelo"* y el diff no distingue bien dónde acaba uno y
  empieza el otro. Para la próxima tanda de accesorios, la instrucción debe pedir **añadir el
  accesorio SIN tocar el pelo de debajo**: así el diff es exactamente la pieza.

#### P27 — Rasgos de la cara por SELLOS (ojos, boca, color de ojos) · 🔎 Funciona, falta afinar
- **Por qué sellos y no IA, con números:** medido en la plantilla, **un ojo son 7 px y una boca 2 px**,
  mientras que el ruido entre dos tiradas del modelo es de **30–80 px**. Pedirle "otra boca" produce un
  cambio *por debajo del ruido*: es justo lo que pasó con la barba. Por debajo de ~20 px, el rasgo se
  dibuja a mano y se coloca por coordenadas. Ésa es la frontera, y ahora está medida.
- **Los anclajes se detectan solos**, no se escriben a mano: los rasgos son **huecos CERRADOS** de la
  mancha de piel (islas rodeadas de cara). El pelo que baja por la sien se le parece en color pero
  nunca está cerrado —viene de fuera—, así que se descarta solo. Mismo criterio que arregló el color:
  no *qué eres*, sino *a qué tocas*.
- **Estado real:** ✅ **chica** por detección automática, en sus tres vistas con cara (de espaldas no
  toca nada, correcto). ✅ **chico** con **anclajes fijos** en el catálogo: su pelo llega a tocarle el
  ojo, y por ese puente de un píxel deja de estar cerrado. Se probó sellar el puente con un **cierre
  morfológico y NO vale**: esa operación *borra los huecos pequeños*, que son justo los rasgos.
  ⇒ `ANCLAJES` en `lib/game/sellos.js`, que además es como se hace en los creadores de verdad: los
  anclajes son parte del **rig** del personaje, no algo que se adivine en cada hoja.
- ⚠️ **Medir importa hasta en 3 píxeles:** los primeros anclajes del chico (y 24–26) caían sobre el
  **párpado**, no sobre el ojo, y el sello no se notaba. Leyendo la luminancia píxel a píxel se vio la
  anatomía: ceja en y=23, párpado claro en y=24, **ojo en y 25–27**. Con eso corregido, funciona.
- **7 tipos de ojo** (normales, grandes, rasgados, caídos, despiertos, dormilones, redondos) + **5
  colores de iris**. A 3×3 px las diferencias son sutiles por naturaleza: lo que cambia es la
  silueta (pupila arriba/abajo, párpado marcado, ancho), no el detalle. Para variedad facial mucho
  mayor habría que **doblar la resolución** de todo el catálogo.
- ⚠️ **Calidad:** el mecanismo está probado (5 variantes de ojos/boca/color renderizadas), pero **los
  patrones que dibujé son más toscos que el arte original**: son rejillas de 3×3 hechas de una
  sentada. Los sellos son trabajo de dibujo y hay que darles otra vuelta.
- **Módulo:** `lib/game/sellos.js` (OJOS, CEJAS, BOCAS, COLOR_OJOS + detección y estampado).

#### P28 — La falda ocre se teñía con el tono de piel · ✅ Resuelta (y el color NO era el criterio)
- **El dato que lo explica todo:** la **falda ocre tiene r−b = 140**; la **piel, 130**. Es decir, la
  prenda es *más "color de piel" que la piel*. Ningún umbral de color puede separarlas — la falda
  pasaba la semilla directamente, no era una fuga por vecindad.
- **Lo que sí las separa: posición y tamaño.** `filtrarManchasDePiel` descarta toda mancha que
  **no toque la banda de la cabeza** y ocupe **más de 90 px**. La cara toca la cabeza; las manos y los
  antebrazos son manchas pequeñas; una prenda es grande y está abajo.
- También se le puso **alcance máximo (6 px) al crecimiento**: sin él, la mancha viajaba de la cara al
  cuello, del cuello al chal granate —cálido también— y de ahí a la falda entera. La piel viene en
  manchas compactas; una prenda, no.
- **Verificado con números, no a ojo** (importante: la primera vez di por buena la corrección mirando
  la imagen y la medición decía que 666 de 1201 px de la falda seguían tiñéndose). Ahora: **10–17 px
  tocados de ~1.200 en seis conjuntos distintos** — y esos son las manos, que sí son piel.
- ⚠️ **Lección de proceso:** una de las correcciones "no se aplicó" porque mi reemplazo automático
  buscaba un comentario que ya había cambiado; el código compilaba y parecía bien. **Sin la medición
  no me habría enterado.** Comprobar el efecto, no la edición.

#### P29 — Complexión (grosor del torso / tipo de cuerpo) · ✅ Resuelta, sin generaciones
- **No se generan siluetas nuevas: se estira la banda del torso en horizontal.** Misma técnica que ya
  usaba el creador viejo con LPC (que solo trae 3 siluetas para 5 niveles). Dos ventajas: **cero
  generaciones** y **funciona sobre cualquier prenda**, incluidas las que se generen mañana, porque
  estira el resultado ya compuesto.
- **Se estira desde el CENTRO de cada figura, no de la celda:** cada vista tiene la figura ligeramente
  descentrada y estirar desde el sitio equivocado la desplazaría de lado al engordar.
- **La cabeza nunca se estira:** una cabeza más ancha no se lee como complexión, se lee como
  deformidad. En la mujer las caderas acompañan al torso a un 60 % del factor.
- **Límite honesto:** hasta ±18 % la silueta ensancha de forma creíble; más allá el dibujo se estira
  de forma visible (las rayas de la ropa se duplican). Por eso hay 5 niveles y no más.
- **Orden importante:** la complexión se aplica ANTES de teñir, para que el color se calcule sobre la
  silueta definitiva. `lib/game/complexion.js`.

#### P30 — Del probador a la APP: creador real y hoja para Godot · ✅ Hecho
- **Un solo módulo de composición** (`lib/game/componer.js`) que usan **las dos partes**: el creador en
  el navegador y el servidor al generar la hoja para Godot. Así lo que el jugador ve al crearse es
  exactamente lo que carga el juego, sin dos implementaciones que se desincronicen.
- **El orden de composición no es arbitrario**, cada paso depende del anterior: bandas → complexión
  (antes de teñir, para que el color se calcule sobre la silueta definitiva) → color → sellos (sobre
  la piel ya teñida) → accesorio encima con su color propio.
- **El catálogo se GENERA** (`scripts/catalogo-personaje.mjs` → `public/personajes/catalogo.json`): al
  añadir una prenda con el generador basta relanzarlo y aparece en el creador. No se mantiene a mano.
- **Se guarda la ELECCIÓN, no la imagen**: `{sexo, peinado, accesorio, arriba, abajo, complexion,
  pelo, piel, ojos, boca, colorOjos, nombre}`. Pesa nada, permite editar el personaje más adelante y
  —lo importante— **si mañana se corrige una pieza, los personajes existentes mejoran solos**.
- **`GET /api/character/hoja`** devuelve el PNG de 384×128 ya compuesto. Godot pide una imagen y
  listo: no tiene que saber de peinados, bandas ni rampas. Se compone al vuelo (unos ms) en vez de
  guardarse, justo para que la mejora de una pieza llegue sola.
- ⚠️ **PENDIENTE en Godot:** hoy el juego pide `/api/character/layers` (formato LPC). Hay que
  cambiarlo para que use `/api/character/hoja`. Los personajes creados con el creador VIEJO devuelven
  **409** en la hoja nueva: hay que volver a crearlos (o escribir una migración).

#### P31 — Llevar el personaje al juego (Godot) · ✅ Construido (falta armar la escena)
- **Godot NO tenía ninguna integración**: no había una sola llamada HTTP en el proyecto. No era
  "cambiar una ruta", era construir el puente entero.
- ⚠️ **La hoja NO la descarga Godot.** El endpoint exige sesión y la sesión vive en una **cookie del
  navegador**; las peticiones que hace Godot desde el export web **no la arrastran**, así que pedirla
  desde GDScript daría 401. ⇒ La descarga la app (que sí tiene sesión) y la **inyecta en el sistema de
  archivos del motor** con `copyToFS('/userfs/personaje.png')`, que Godot ve como `user://personaje.png`.
  Si falla, el juego arranca igual con el personaje del editor.
- **`godot/PersonajeJugador.gd`** (va en el AnimatedSprite2D del jugador): espera la hoja, la corta en
  las 4 vistas y arma el `SpriteFrames` en caliente. Reintenta unas cuantas veces porque la app copia
  el archivo justo después de arrancar el motor. Constante `FOTOGRAMAS_POR_VISTA = 1` — cuando la hoja
  traiga fotogramas de caminar, se cambia ese número y ya.
- **Migración de los personajes viejos** (`scripts/migrar-personajes.mjs`, ya aplicada a los 2 que
  había): traduce lo que **significa lo mismo** —sexo, tono de piel, color de pelo, complexión,
  nombre— y deja el resto por defecto. No se inventan equivalencias de prendas: los catálogos viejo y
  nuevo son dibujos distintos. El original queda guardado en `character_data_v1`.

---

## Tema (2026-07-27) — ANIMACIÓN Y EQUIPO estilo Guardian Tales (esqueleto + anclajes)

**Decisión del usuario:** hacerlo como Guardian Tales ⇒ **camino 2 + 3**: esqueleto para el cuerpo y
lo que se lleva puesto, anclajes para lo que se sujeta.

#### P32 — ¿Por qué esqueleto y no capas? · ✅ Decidido con el coste, no con el gusto
- **Capas** (Stardew/LPC): el motor sincroniza el fotograma, pero **el casco hay que dibujarlo en cada
  fotograma**. Barato de empezar, caro por pieza.
- **Esqueleto**: el casco se ata al hueso de la cabeza y se dibuja **UNA vez**; sirve para caminar,
  correr, atacar y para animaciones que aún no existen. Caro de montar, casi gratis por pieza.
- ⇒ Con un catálogo que va a crecer (armaduras, cascos, botas, collares), **manda el coste por pieza**.
- Documento con los tres caminos comparados: artifact "Animación y equipo: los tres caminos".

#### P33 — El esqueleto, medido sobre la silueta · ✅ `lib/game/esqueleto.js`
- Las cajas **no están puestas a ojo**: salen de medir la silueta fila a fila. En la chica el cuello se
  estrecha a 12 px en y≈39, los hombros abren en y 42, la cadera está en y 80 y las piernas se separan
  en y 108. Seis piezas: cabeza, torso, dos brazos, dos piernas, más `anclajeMano`.
- **Las mismas cajas valen para TODAS las piezas del catálogo** —cada prenda, cada peinado— porque todo
  se generó editando la misma plantilla y quedó recuadrado en la misma rejilla. Cortar una armadura
  nueva es aplicarle estas cajas, sin medir nada. Ésa es la recompensa de haber normalizado.
- Los brazos se solapan a propósito con el torso: si no, la manga deja hueco al levantarse.

#### P34 — ¿Aguanta el pixel art las rotaciones? · ✅ Sí, con ángulos cortos (verificado)
- Se generó una **caminata de 8 fotogramas rotando las piezas** (±11° piernas, ±9° brazos, rebote del
  torso), con rotación de vecino más cercano, que es lo que hará el motor. **Se lee bien**: a esos
  ángulos el borde aguanta. Era el riesgo que había que despejar antes de montar nada en Godot.
- ⚠️ **HALLAZGO — la falda no puede partirse en dos piernas.** Al rotar cada mitad por su lado, la
  falda se abre como si fueran pantalones: no es un fallo de la técnica, es que **el rig tiene que
  depender de la PRENDA**. Con pantalón, dos piernas; con falda, la falda debe ser una pieza con las
  piernas por debajo. Hay que separar `piernas` (cuerpo) de `faldón` (prenda) en el esqueleto.

#### P35 — El rig depende de la PRENDA · ✅ Corregido (hallazgo de mover el muñeco)
- Con dos piernas independientes, **la falda se abre en canal** al rotar cada mitad por su lado. No es
  un fallo de la técnica: es que el esqueleto no puede ser el mismo con pantalón que con falda.
- ⇒ `esqueletoPara(sexo, prendaAbajo)` devuelve **dos piernas** con pantalón, y con falda un **faldón
  entero** (que se mece 3°, porque la tela no dobla como una pierna) más **dos pies sueltos** que dan
  el paso por debajo. Verificado con las dos caminatas renderizadas.
- **Lección:** este problema no se ve en una imagen quieta. Montar la animación en Node antes de tocar
  Godot lo destapó en minutos.

#### P36 — El personaje articulado en Godot · ✅ Escrito (falta armarlo en la escena)
- `godot/PersonajeArticulado.gd`: **crea los sprites de cada parte al arrancar**, no hay que colocarlos
  a mano en la escena. Así, el día que cambie el rig no hay que rehacer nada.
- ⚠️ **El rig NO se copia a GDScript**: se **exporta** (`scripts/exportar-rig.mjs` →
  `godot/assets/rig-personaje.json`) desde el mismo módulo que usa la web. Copiar los números a mano
  es exactamente como se desincronizan las dos partes y el muñeco se descoyunta.
- Los ángulos del ciclo son **cortos a propósito** (≤12°): medido, es donde el pixel art aguanta la
  rotación sin que se vea el escalonado. El paso se apoya además en un rebote vertical, que no cuesta
  calidad.
- **Sintaxis validada con Godot 4.7** (`--check-only`). Falta el paso manual: colgar el nodo
  `Articulado` del jugador en la escena.

#### P37 — Montado y EJECUTADO en Godot · ✅ Verificado en el motor
- `godot/PruebaPersonaje.tscn` + `.gd`: **banco de pruebas**. Se abre y con F6 el personaje camina solo
  y va girando entre las cuatro vistas cada 3 s. Teclas: espacio para parar, ←→ para girar a mano.
- **Ejecutado de verdad** (`godot --script` con capturas de pantalla), no solo comprobada la sintaxis:
  las 9 piezas se montan (`brazoLejano, piernaIzq, piernaDer, faldon, pieIzq, pieDer, torso, cabeza,
  brazoCercano`) y el ciclo corre. Se ve bien.
- ⚠️ **Dos cosas que solo aparecen al ejecutar:**
  1. **La espera de la hoja no debe ser igual en escritorio que en web.** La hoja real la deja la app
     en `user://`, así que en el escritorio no llega nunca: esperaba 5 s con el personaje invisible.
     Ahora `OS.has_feature("web")` decide, y en escritorio se va directo a la hoja de prueba.
  2. **`Image.load()` no vale para `res://`.** Lo que viene de `user://` es un archivo suelto y se lee
     como imagen; lo que está en `res://` es un recurso importado y hay que pedirlo con `load()`, o el
     export lo deja fuera. Son dos caminos distintos y el motor avisa.
- **Hoja de prueba** (`godot/assets/personaje-prueba.png`): una chica CON FALDA, que es el caso que
  más exige al rig. Permite trabajar la animación sin levantar la web.

#### P38 — ⚠️ EL ERROR DE FONDO: recortar un dibujo plano no sirve · ✅ Corregido con DESPIECE
- **Corrección del usuario:** *"lo que estás intentando hacer con un solo dibujo no tiene sentido"*.
  Tenía razón. En un dibujo plano **el brazo no existe como pieza**: son unos píxeles pegados al torso.
  Al recortarlo y girarlo, el hombro se abre y quedan manos sueltas — que es justo lo que se veía.
- **Comprobado lo de la librería, y NO era como se recordaba:** una hoja LPC del cuerpo es
  **832×2944 = 13 columnas × 46 filas** de 64 px, y **en cada fotograma el cuerpo está dibujado
  entero**. LPC separa **capas de ropa** (cuerpo, pelo, camisa, pantalón, zapatos), no partes del
  cuerpo. Son ~600 fotogramas a mano por capa: ese camino no lo podemos recorrer.
- **La solución: pedirle al modelo el DESPIECE.** `scripts/despiezar.mjs` pide el personaje
  desmontado en piezas de marioneta: cabeza con cuello, torso sin brazos, brazos enteros, piernas
  enteras, faldón suelto — **con el extremo de la articulación redondeado y material de sobra en la
  unión**. Funciona a la primera y en las 4 vistas.
- `scripts/armar-piezas.mjs` las detecta como **manchas conectadas** (cada pieza es una isla), las
  **clasifica por posición y tamaño** (cabeza arriba, torso al centro, brazos a los lados…), calcula
  el **pivote** de cada una y las empaqueta en un atlas + JSON para Godot.
- ⚠️ **Los pivotes no son todos iguales, y confundirlos rompe el montaje:** lo que CUELGA (brazos,
  piernas, faldón) pivota por su **borde superior**; lo que se APOYA (cabeza sobre el cuello, torso
  sobre la cadera) pivota por el **inferior**. Con el faldón mal puesto, colgaba hacia arriba y tapaba
  el torso entero.
- **Los puntos de unión se calculan de las proporciones del torso**, no se escriben a mano: cada
  prenda da un torso de otro tamaño (una túnica es más ancha que una camisa).
- **Montado y ejecutado en Godot**: 7 piezas, jerarquía con el torso como raíz (inclinarlo arrastra
  cabeza y brazos), caminata por rotación. **La materia prima ya es la correcta.**

---

## Objetivo PARALELO (declarado 2026-08-04) — ¿SE PUEDEN CONSULTAR LAS FACTURAS DEL SRI Y TRAERLAS A UNA APP? · 🔎 75%

**Rol asumido:** *integrador de sistemas fiscales / ingeniero de conectores contra
administraciones tributarias*. La pregunta no es de UI ni de negocio: es de qué superficie
expone realmente el SRI y qué se puede construir encima sin romperse ni exponer al cliente.

**Contexto:** no es para GCC World. Fernando tiene otro proyecto que va a requerir *ingesta* de
comprobantes (hoy la herramienta solo **emite**), y quiere llegar a la conversación con ese
cliente sabiendo qué es posible.

📄 **La investigación completa vive en [`SRI-CONSULTA-COMPROBANTES.md`](SRI-CONSULTA-COMPROBANTES.md)**
(vías reales, autenticación del portal reverseada, arquitectura, riesgo legal, PoC y dudas
abiertas). Aquí solo queda lo que es **memoria transversal del stack**, porque sirve para
cualquier proyecto ecuatoriano futuro:

- **No existe API del SRI para "dame las facturas del RUC X".** Existen dos cosas: un **WS SOAP
  público sin autenticación** que devuelve el **XML completo de UN comprobante dada su clave de
  acceso** (verificado en vivo el 2026-08-04: responde 200 desde cualquier IP), y el **portal
  autenticado**, que es la única fuente del *listado*. Todo lo demás son intermediarios.
- **El login de SRI en Línea es Keycloak/RH-SSO 7.3.8** (`realm=Internet`,
  `client_id=app-tuportal-internet`, OIDC authorization code) y **no tiene captcha ni OTP**. La
  clave se envía transformada en cliente como **`md5(clave) ‖ sha512(clave)` en hex**, y el
  usuario adicional se codifica como `RUC[ad]CEDULA`. ⇒ **se puede automatizar con HTTP puro, sin
  navegador.**
- **REST público de catastro** (sin credenciales, requiere User-Agent de navegador):
  `srienlinea.sri.gob.ec/sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?&ruc=…`
  → razón social, régimen RIMPE, obligado a contabilidad, agente de retención, representantes.
  Sirve **ya** para validar RUCs de clientes y proveedores en cualquier app.
- **Gap encontrado en el módulo de GCC:** `consultarAutorizacion()`
  (`lib/integrations/sri/soap-client.ts:96-142`) declara `xmlAutorizado?: string` en su tipo pero
  **nunca lo rellena**. No estorba para emitir (solo interesa el estado), pero para consumir
  comprobantes ajenos hay que extraer el `<comprobante>` en CDATA de la respuesta.
- **La clave de acceso es la PK natural de todo comprobante ecuatoriano** (49 dígitos, DV módulo
  11, ya implementada en `access-key.ts`). Cualquier ingesta debe idempotentizar por ahí.

**Actualización 2026-08-04 — el caso real es OTRO y está acotado (🔎 70%).** No es "traer mis
compras": el titular es **representante legal de 3 empresas** y quiere que **su cliente entre,
ponga su RUC y vea las facturas que las 3 le han emitido**. Es **emitidos**, no recibidos.
Consecuencias, todas en §5.6 de `SRI-CONSULTA-COMPROBANTES.md`:

- **Hay que invertir el diseño: sincronizar de noche, no consultar en vivo.** La pantalla de
  emitidos se consulta **día a día** y **no muestra al adquirente** — para saber a quién se
  facturó hay que abrir el XML de cada comprobante. Consultar al SRI dentro del request del
  usuario es inviable. Se indexa en Postgres por `identificacion_comprador` y la plataforma solo
  lee de ahí.
- **Normalizar la identificación a la raíz de 10 dígitos** (a la misma persona se le factura unas
  veces con cédula y otras con RUC = cédula+`001`) y **excluir `9999999999999`** (consumidor final).
- **🚨 Riesgo LOPDP que hay que resolver antes de programar:** "pone su RUC y ve sus facturas" sin
  autenticar deja que cualquiera vea las compras de un tercero. Solución barata: **OTP al correo
  que ya consta en el XML** de las facturas emitidas a ese RUC.
- **Pregunta abierta que puede ahorrar medio proyecto:** ¿cómo emiten hoy esas 3 empresas? Si
  comparten sistema o proveedor, la fuente son sus XMLs y el SRI queda solo como conciliación.

**Especificación técnica escrita (2026-08-04):**
[`PROYECTO-CONSULTA-FACTURAS-SRI.md`](PROYECTO-CONSULTA-FACTURAS-SRI.md) — implementación completa
lista para cotizar y construir: DDL, conector Keycloak con código, patrón JSF/PrimeFaces, parser
de XML por versión de esquema y tipo de documento, orquestación (backfill reanudable · incremental
· revisión de anulaciones), OTP al correo del XML, API con el guard anti-fuga, seguridad de
credenciales, fases, riesgos y el **checklist de la sesión de reconocimiento (§14) que bloquea la
fase 2**.

---

## Jornada 2026-08-04 — tres incidentes de producción, y lo que enseñan para el proyecto del SRI

Los tres salieron el mismo día, uno detrás de otro, y **los tres tienen la misma raíz**: texto
generado por un agente entrando sin validar en un sistema de esquema estricto. Eso convierte lo
aprendido aquí en material de diseño para el objetivo del SRI, no en anécdota.

### 1 · La lista de proyectos se vació sola · ✅ Resuelto
`ARRAY_AGG(r.talents)` sobre una columna `text[]` construye una matriz 2-D y **Postgres exige que
todas las filas midan lo mismo**. El agente de cotizaciones generó requerimientos con 2 y con 3
talentos → la consulta entera murió. Regla: **desanidar antes de agregar**.

**Lo agravante, y lo que de verdad importa:** el `catch` del endpoint devolvía `{data: []}` con
**HTTP 200**, así que el fallo se veía como «no hay proyectos». Diagnóstico natural: «se borraron
los datos». Firma del bug: **el rail de conteos seguía bien mientras la tabla salía vacía** — esa
asimetría delata que la consulta gorda es la que revienta.
→ **Regla para cualquier proyecto: un fallo del servidor se declara (500 + `error`) y la UI lo
muestra. Nunca se finge un resultado vacío.**

### 2 · El SRI devolvió la factura: «ARCHIVO NO CUMPLE ESTRUCTURA XML» · ✅ Resuelto
Las 6 descripciones venían de una cotización del agente y medían 327–416 caracteres, contra el
**máximo de 300 del XSD**. Ningún campo de texto se estaba acotando.
→ Nuevo `lib/integrations/sri/text.ts`: `SRI_MAX` + `sriText()`, que **trunca y luego escapa** —
en ese orden, porque el validador del SRI **decodifica las entidades y cuenta caracteres reales**
(`&amp;` cuenta 1, no 5).

### 3 · El SRI devolvió la factura: «FIRMA INVALIDA» · ✅ Resuelto
**No era el certificado** (vigente hasta 2028-02-03) ni los datos del cliente. `escapeXml`
convertía `'` en `&apos;` dentro del **texto de los nodos**, donde XML no lo exige, y el
canonicalizador de `ec-sri-invoice-signer` lo **re-escapa** a `&amp;apos;`:

```
la librería firma sobre : y &amp;apos;Empacar y Facturar&amp;apos;.
el SRI verifica sobre   : y 'Empacar y Facturar'.
```

Funcionó durante meses porque **ninguna descripción había llevado nunca un apóstrofo**.
→ En texto de nodo: solo `&`, `<`, `>`. En atributo: `&`, `<`, `"` y nunca `'`.

### Lo que estos tres incidentes cambian en el plan del proyecto del SRI

1. **Un rechazo del SRI puede estar tapando otro.** El de estructura escondía el de firma: hasta
   que la estructura no pasó, la firma ni se llegaba a validar. **Tras corregir un rechazo, no dar
   por hecho que ya pasa.**
2. **El SRI dice literalmente qué falla; no hay que adivinar.** `sri_response` guardó
   `cvc-maxLength-valid: … length = '327' … maxLength '300' for type 'descripcion'`. Y para
   cualquier clave, `consultarAutorizacion()` devuelve el motivo exacto **sin credenciales**. En
   el proyecto nuevo, **guardar siempre la respuesta cruda del SRI** es tan importante como
   guardar el XML.
3. **La firma se puede verificar en local, sin enviar nada.** `c14nCanonicalize()` de la librería
   contra la canonicalización correcta (reescapar solo `&<>` sobre el texto real): si no
   coinciden, el digest no va a cuadrar. Así se descartó que «…» y «→» fueran culpables — por
   medición, no por intuición. **Esto debe ser un test del proyecto nuevo, no un script de
   emergencia.**
4. **Lo que genera un LLM hay que validarlo antes de que toque un esquema estricto.** Es la raíz
   común de los tres. En el proyecto del SRI aplica igual: descripciones, razones sociales y
   direcciones que vengan de fuera deben pasar por `sriText()`/longitudes **antes** de construir
   nada, y avisar en la UI en vez de recortar a escondidas.
5. **Avisar antes, no cortar después.** El panel «Editar y reintentar» ahora marca en rojo al
   pasar de 300 caracteres. El truncado automático queda como red de seguridad, no como
   comportamiento normal: una factura es un documento que ve el cliente y cortarla a mitad de
   frase es un defecto, aunque el SRI la acepte.

---

# Aprendizaje — Cambiar el modelo del agente de cotizaciones (y GCC Bot) de Anthropic a Kimi K2.6 (2026-08-04)

> Objetivo declarado por el usuario: *"al generar la cotización de un proyecto y al usar GCC Bot,
> cambiar el modelo de IA de Anthropic por Kimi K2.6, revisando si se puede sin afectar el
> funcionamiento del agente de cotizaciones"*.

## Rol asumido
**Integrador de sistemas / ingeniero de plataformas de LLM**: el problema no es de producto sino de
compatibilidad de contrato de API, variables de entorno, protocolo de tool-use y despliegue.

## Progreso
- **% de información para el objetivo: 95 %**
- **Estado:** decisión tomada (**reemplazo total**, Kimi K2.6 pasa a ser el modelo por defecto de
  los agentes futuros del proyecto — P10 ✅). Ruta A implementada y verificada en estático
  (`node --check`, `tsc`, `next build`). Falta **solo** la verificación 3 de
  [[gcc-tsc-no-basta]]: correr contra el endpoint real, que necesita `KIMI_API_KEY` (P11).

## Fuentes consultadas (2026-08-04)
- Código: `services/cotizador-worker/index.mjs`, `lib/cotizaciones/worker.ts`,
  `app/api/quotes/generate|[id]/chat|[id]/public/chat/route.ts`, `services/cotizador-worker/README.md`.
- `MEMORIA.md` §Worker de cotizaciones (líneas ~2150 y ~4381-4430): despliegue por CLI, gotcha de
  `bypassPermissions`, herramienta `buscar_talentos`, `/health` como sonda de configuración.
- SDK instalado: `@anthropic-ai/claude-agent-sdk@0.3.217` — `sdk.d.ts` confirma `options.model` y
  `options.env`; `sdk.mjs`/`bridge.mjs` leen `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`,
  `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL`,
  `CLAUDE_CODE_SUBAGENT_MODEL`.
- Docs de Kimi (`platform.kimi.ai/docs/guide/claude-code-kimi` y `/docs/models`), OpenRouter,
  issue MoonshotAI/Kimi-K2#129.

## Hallazgo central
El worker **no llama a la API de Anthropic directamente**: usa el **Claude Agent SDK**, que lanza el
binario de Claude Code. Ese binario habla el protocolo `/v1/messages` y **respeta `ANTHROPIC_BASE_URL`**.
Moonshot publica un **endpoint compatible con Anthropic** en `https://api.moonshot.ai/anthropic`.
→ El cambio de modelo es, en el caso feliz, **solo variables de entorno**: no se toca la lógica del
agente, ni el prompt, ni las herramientas MCP, ni la reanudación por `sessionId`.

## Preguntas y respuestas

### P1 — ¿Dónde vive exactamente el modelo hoy? · ✅ Resuelta
Dos sitios, ambos con el mismo default y ambos alimentados por `COTIZADOR_MODEL`:
`lib/cotizaciones/worker.ts:17` (la web lo manda en cada petición **y lo guarda en `quote_sessions`**)
y `services/cotizador-worker/index.mjs:22` (default del worker). "GCC Bot" es el mismo worker por
`/chat` reanudando la sesión → **un solo punto de cambio cubre generar + chatear**.

### P2 — ¿El Agent SDK deja apuntar a otro proveedor? · ✅ Resuelta
Sí. `options.env` existe y **reemplaza por completo** el entorno del subproceso (hay que esparcir
`process.env`). Más simple: poner las variables en el servicio de Railway y no tocar código.

### P3 — ¿Basta con cambiar el ID de modelo? · ✅ Resuelta — **NO**
Claude Code hace llamadas de **modelo pequeño** por su cuenta (compactación, títulos, subagentes) con
IDs de Claude. Contra Moonshot eso da *model not found*. Hay que fijar **todas** las variantes:
`ANTHROPIC_DEFAULT_OPUS_MODEL`, `..._SONNET_MODEL`, `..._HAIKU_MODEL`, `..._FABLE_MODEL` y
`CLAUDE_CODE_SUBAGENT_MODEL`. Es el fallo silencioso más probable si se hace a medias.

### P4 — ¿`ANTHROPIC_API_KEY` puede quedarse puesta? · ✅ Resuelta — **NO**
`ANTHROPIC_API_KEY` **gana** a `ANTHROPIC_AUTH_TOKEN` en el orden de resolución. Si se queda, el
worker mandaría la clave de Anthropic a Moonshot → 401. **Hay que borrarla** del servicio del worker.

### P5 — ¿Qué se pierde de contexto? · ✅ Resuelta
Opus 4.8 = 1 M tokens. **Kimi K2.6 = 262 k**. Generar una cotización cabe de sobra; **GCC Bot acumula
turnos** sobre la misma sesión. Kimi documenta `CLAUDE_CODE_AUTO_COMPACT_WINDOW` justo para esto.

### P6 — ¿Qué NO está garantizado en el endpoint compatible? · ⏸ Bloqueada (hay que medirlo)
El endpoint acepta `model, messages, system, tools, tool_choice, max_tokens, temperature, stream`.
**Sin especificación publicada** para: `count_tokens`, `cache_control`/cabeceras beta de caché
(Moonshot cachea solo, sin breakpoints) y `anthropic-version`. `WebFetch` está documentado como no
soportado — **no nos afecta**: `allowedTools` solo deja `list_my_projects` y `buscar_talentos`.
Impacto esperado: coste/latencia, no corrección. **Pendiente de prueba real.**

### P7 — ¿Cuál es el riesgo funcional de verdad? · ✅ Identificado
No es la conexión: es la **fidelidad del tool-use y del formato**. El agente tiene tres obligaciones
frágiles: (a) llamar `buscar_talentos` **por cada requerimiento**, (b) **copiar el nombre exacto**
devuelto (si lo inventa, la materialización queda coja) y (c) devolver **solo JSON** como mensaje
final. `parseJson()` ya es tolerante (extrae el primer `{…}`), pero (a) y (b) hay que verificarlos
sobre cotizaciones reales. `maxTurns: 14` puede quedarse corto con otro modelo.

### P8 — ¿Coste? · ✅ Resuelta
Opus 4.8: **$5 / $25** por millón (entrada/salida). Kimi K2.6: **$0,58 / $3,40**.
→ ~8,6× más barato en entrada y ~7,4× en salida.

### P9 — ¿Cómo se despliega el cambio? · ✅ Resuelta
El worker **no se despliega con push**: está subido por CLI. Si el cambio es **solo variables**, basta
con ponerlas en Railway (redespliega solo). Si se toca `index.mjs`:
`cd services/cotizador-worker && railway up --service cotizador-worker --detach` (el `--detach` es
obligatorio). `COTIZADOR_MODEL` hay que cambiarlo **también en el servicio web** (`corazonescruzados`),
porque la web manda el modelo en cada petición y lo persiste.

### P10 — ¿Reemplazo total o convivencia? · ❓ Abierta (decisión de negocio)
La UI ya tiene un **"selector de agente"** en el panel de nueva cotización (hoy con una sola opción).
Es el sitio natural si se quiere elegir modelo por cotización en vez de cambiarlo global.

### P11 — ¿Hay clave de Moonshot/Kimi en el proyecto? · ⏸ Bloqueada — hace falta que la dé Fernando

## Decisiones de diseño (propuestas, a confirmar)
- **Ruta A — proxy Anthropic-compatible (recomendada).** Solo variables de entorno. Cero código,
  conserva sesión/reanudación, herramientas MCP, prompt y `canUseTool`. **Reversible en un minuto.**
- **Ruta B — reescribir el worker sobre el SDK de OpenAI** contra `https://api.moonshot.ai/v1`.
  Quita la dependencia del binario de Claude Code, pero obliga a **reimplementar el bucle de tool-use
  y la persistencia de sesión** que hoy regala el SDK (`sessionId` es lo que sostiene GCC Bot).
  Mucho más trabajo y más superficie de fallo. Solo si la Ruta A falla en la prueba.

## Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Llamadas internas de modelo pequeño con ID de Claude | Fijar las 4 `ANTHROPIC_DEFAULT_*_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL` |
| `ANTHROPIC_API_KEY` residual gana al token de Kimi | Borrarla del servicio del worker |
| Contexto 262 k en sesiones largas de GCC Bot | `CLAUDE_CODE_AUTO_COMPACT_WINDOW` |
| Talentos inventados / no llama a la herramienta | Probar con cotizaciones reales antes de producción |
| Cotizaciones ya existentes con sesión de Opus | Las sesiones viejas no se pueden reanudar contra otro proveedor: probar qué hace `/chat` con una cotización antigua |
| Despliegue silencioso (worker no sale de `main`) | Comprobar `/health` → devuelve `model` |

## Plan de prueba (antes de tocar producción)
1. Local: levantar el worker con las variables apuntando a Moonshot y `COTIZADOR_MODEL=kimi-k2.6`.
2. `GET /health` → debe reportar `model: 'kimi-k2.6'`.
3. `POST /generate` con un detalle real → revisar que hay `requirements`, `talents` con nombres que
   existan de verdad en `gd_talentos`, `additional_costs` y `deadline`.
4. `POST /chat` con el `sessionId` devuelto → pedir un cambio y comprobar que devuelve la cotización
   completa y que se versiona.
5. Solo entonces mover las variables en Railway (web + worker).

## Primera prueba contra el endpoint real (2026-08-05)

**El cableado funciona; el bloqueo es de saldo, no técnico.**

`GET /health` → `{ model: "kimi-k2.6", baseUrl: "https://api.moonshot.ai/anthropic",
apiKey: "ok", talentSearch: "app" }`.

`POST /generate` → **HTTP 500** con el mensaje que devuelve Moonshot:
*"Request rejected (429) · Your account … is suspended due to insufficient balance, please
recharge your account"*.

**Qué prueba esto (y no es poco):** la clave se aceptó, el modelo `kimi-k2.6` se reconoció y la
petición llegó a Moonshot. El fallo es de **facturación de la cuenta**, no del contrato de API,
ni del ID de modelo, ni de la autenticación. Queda pendiente lo único que no se puede deducir:
la **fidelidad del tool-use** (P7).

### Hallazgo operativo — un 429 de saldo cuesta ~4 minutos, no un error rápido · ⚠️
La llamada tardó **3 min 38 s** antes de fallar: Claude Code **reintenta** el 429 por su cuenta.
El cliente de la web (`lib/cotizaciones/worker.ts`) tiene `TIMEOUT_MS = 280_000` (4 min 40 s), o
sea que sobrevive por poco. **Consecuencia en producción:** si la cuenta de Kimi se queda sin
saldo, el usuario ve un spinner ~4 minutos antes de enterarse. Con Anthropic no pasaba porque la
clave era de prepago de una cuenta con saldo.
→ **Pendiente de decidir:** si vale la pena cortar antes ante un 429 de saldo, o basta con
vigilar el saldo. No se toca todavía: primero hay que ver el comportamiento normal con saldo.

## Verificación end-to-end con saldo (2026-08-05) — ✅ FUNCIONA

Repetida la misma llamada tras recargar la cuenta de Moonshot:

- **`POST /generate` → HTTP 200 en 1 min 13 s.** 6 requerimientos, 160 h, **$2 400**, que es
  exactamente `160 × $15` (respetó la tarifa/hora). `deadline` coherente, 4 costos adicionales
  sensatos (hosting, dominio, **certificado de firma electrónica**, correo transaccional).
- **Los talentos son REALES: 13 de 13 verificados contra `gd_talentos`, ninguno inventado.**
  Era el riesgo grande (P7) y lo pasa: llamó a `buscar_talentos` por requerimiento y copió los
  nombres exactos. Comprobado con `SELECT nombre FROM gd_talentos WHERE nombre = ANY($1)`.
- **`POST /chat` → HTTP 200 en 52 s, reanudando el MISMO `sessionId`.** Se le pidió cuadrar a
  $1 800: devolvió 120 h / **$1 800** exactos (otra vez `120 × $15`), conservó los talentos
  reales y explicó qué recortó. **La reanudación de sesión sobrevive al cambio de proveedor**,
  que era la otra incógnita.
- El mensaje final fue **JSON limpio** en los dos casos.

### Única desviación observada (cosmética) · ❓ Abierta
El prompt pide **2-6 subtareas** por requerimiento. En `/generate`, dos de los seis salieron con
**1 subtarea** (en `/chat` todos quedaron dentro del rango). No rompe nada —`requirement_items`
admite las que haya— pero si se quiere apretar, es un ajuste de prompt, no de la migración.
**No se toca sin que Fernando lo pida.**

### Conclusión
La ruta A (endpoint compatible + entorno armado en el worker) queda **validada en local**.
Lo que faltaba medir ya está medido; el resto es despliegue.

---

# Objetivo (2026-08-11) — Que las facturas digan el régimen tributario REAL: RIMPE Negocio Popular

> Fernando: *"al generar facturas sale como si yo fuera «Contribuyente Regimen General», pero yo
> realmente soy «negocio popular» en el SRI"*. Objetivo: corregir el texto y arreglar **todos los
> documentos ya generados**.

## Rol asumido
Integrador de facturación electrónica del SRI (Ecuador): la corrección es de forma tributaria y
toca XML firmado, esquemas XSD y RIDE, así que manda lo que valida el SRI, no lo que se ve bonito.

## Progreso
- **% de información para el objetivo: 100 %** en lo que se implementó. Queda **una duda de
  negocio abierta** (P5), que es del contador y no del código.
- **Estado:** implementado y verificado (tsc + `next build` + XSD con `xmllint` + 41/41 RIDE
  regenerados en la BD real).

## Fuentes consultadas
- **Ficha Técnica de Comprobantes Electrónicos del SRI, ANEXO 22** (esquema offline, v2.22) —
  da el nombre de etiqueta, la ubicación y el texto literal de cada leyenda RIMPE. (2026-08-11)
- **XSD oficiales** `factura_V1.0.0.xsd`, `factura_V1.1.0.xsd`, `NotaCredito_V1.1.0.xsd`
  (tres copias independientes, coincidentes) — validación real con `xmllint`. (2026-08-11)
- **SRI, "RIMPE – Preguntas frecuentes"** — dice que en comprobantes electrónicos la leyenda del
  negocio popular va en *información adicional*. (2026-08-11)
- Código del repo: `lib/integrations/sri/*`, `app/api/invoices/*`; BD de producción (41 facturas
  autorizadas).

## Preguntas y respuestas

### P1 — ¿De dónde sale el texto «Contribuyente Regimen General»? · ✅ Resuelta
- **Por qué importa:** sin ubicar la fuente no se sabe si el error es de datos o de plantilla.
- **Respuesta:** estaba **hardcodeado** en `lib/integrations/sri/ride-pdf.ts:67`. No venía de la
  BD ni de la configuración: era una constante escrita en la plantilla del RIDE. Se movió a
  `SRI_CONFIG.contribuyenteRimpe` para que haya una sola fuente del texto. (fuente: código)

### P2 — ¿El XML enviado al SRI decía «negocio popular», como suponía Fernando? · ✅ Resuelta
- **Por qué importa:** determina si lo ya emitido está bien de fondo o solo mal impreso.
- **Respuesta:** **no.** El XML **no llevaba ninguna leyenda de régimen**: `regimenMicroempresas`
  estaba vacío y `<contribuyenteRimpe>` no se emitía. Es decir, el régimen no viajaba ni bien ni
  mal — sencillamente no constaba. (fuente: `xml-builder.ts` + XML almacenados)

### P3 — ¿Cuál es el texto exacto y dónde va en el XML? · ✅ Resuelta
- **Por qué importa:** un texto aproximado no cumple, y un campo mal puesto hace que el SRI
  devuelva el comprobante.
- **Respuesta:** `CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE` (45 caracteres, con tilde). La
  ficha lo pide en `<contribuyenteRimpe>`… **pero el XSD publicado restringe esa etiqueta a
  `CONTRIBUYENTE RÉGIMEN RIMPE`** (el del Emprendedor) y en factura 1.0.0 la etiqueta no existe.
  Se comprobó con `xmllint`: el texto de negocio popular **no valida**. Por eso la leyenda va como
  `<campoAdicional nombre="regimen">`, que es lo que el propio SRI indica para negocios populares
  y **sí valida**. (fuente: ficha técnica + XSD + preguntas frecuentes del SRI)

### P4 — ¿Se pueden corregir los comprobantes ya autorizados? · ✅ Resuelta
- **Por qué importa:** es literalmente lo que pidió Fernando.
- **Respuesta:** el **XML** ya autorizado, **no**: está firmado y sellado por la autorización del
  SRI; alterarlo rompe la firma. El **RIDE sí**, porque es representación impresa y se re-renderiza
  desde la BD. Se regeneraron **41/41**. Lo no rectificable es que en esos XML la leyenda nunca
  constó; corregirlo de verdad exigiría anular y refacturar, que es decisión de Fernando y su
  contador, no algo que hacer por iniciativa propia. (fuente: normativa SRI + código)

### P5 — ¿Un RIMPE Negocio Popular debe emitir facturas con IVA? · ⏸ Bloqueada (es del contador)
- **Por qué importa:** si la respuesta es "no", el problema de fondo es mayor que una leyenda.
- **Estado:** el sistema emite **facturas con IVA 15 % desglosado**; la doctrina general es que el
  negocio popular emite **notas de venta sin desglose de IVA**. **No se tocó nada** — está fuera de
  lo pedido y es una decisión tributaria. Debe confirmarlo el contador de Fernando.

## Decisiones de diseño
1. **Una sola fuente del texto** (`SRI_CONFIG.contribuyenteRimpe`): RIDE y XML lo leen de ahí. Si
   mañana Fernando cambia de categoría RIMPE, se toca **una línea**.
2. **Ganar la validación por encima de la literalidad de la ficha**: entre cumplir el ANEXO 22 al
   pie de la letra y que el SRI **acepte** el comprobante, manda lo segundo. Documentado en el
   código el porqué y cómo migrar si el SRI corrige el XSD.
3. **El backfill como endpoint reutilizable**, no como script de un solo uso: cada vez que cambie
   la plantilla del RIDE habrá que re-persistir los PDFs de los correos.

## Riesgos y cómo se mitigaron
- **Rechazo del SRI en producción** → validación con `xmllint` contra los XSD oficiales sobre el
  XML **que produce el builder real**, no sobre una réplica escrita a mano.
- **Estropear comprobantes autorizados** → el backfill escribe **solo** `pdf_data`; no toca
  `xml_signed`, `access_key` ni `authorization_number`.
- **Que el arreglo se vea en la web pero no en los correos** → por eso el backfill, y no solo el
  cambio de plantilla.

---

# Objetivo (2026-08-14) — CV PÚBLICO COMPARTIBLE POR TOKEN, para reclutadores · 🔎 55%

**Rol asumido:** *ingeniero de producto full-stack con foco en exposición pública segura de
datos personales* — la mitad del trabajo es Next.js/Postgres (token, campos, PDF) y la otra
mitad es **decidir qué de una persona sale a internet y con qué control**. Quien abre ese
enlace no es un usuario del sistema: es un reclutador externo, sin sesión, que puede reenviar
la URL a quien quiera.

## Objetivo / necesidad (verbatim resumido, 2026-08-14)
En **Configuración**, en el **panel de Perfil** (columna izquierda), un **botón que genera un
token de acceso público** para compartir el CV del usuario. La página pública debe mostrar:
**foto · información del CV · datos personales · proyectos del portafolio · disponibilidad ·
aspiración salarial**. Además:
- **Campo nuevo «Aspiración salarial»** en el panel de Perfil, con un **rango aproximado**, que
  también se ve en la página pública.
- **Descarga en PDF** de todo el contenido — **NO impresión de la página**: un **diseño
  específico para PDF**.
- Presentación **muy moderna**, con **transiciones y animaciones**, pero **todo el contenido
  accesible de un vistazo**.
- **Vistas especializadas** para computadora / teléfono / distintos tamaños de pantalla — en
  este caso en particular; hoy la app es **solo responsiva** y a futuro pedirá vistas
  personalizadas para el resto.

## ⛔ REGLA QUE MANDA SOBRE ESTE OBJETIVO (ya establecida, `Diseño.md` §«Sitio público»)
**El diseño y el contenido visible de cualquier página pública los decide Fernando, conmigo,
ANTES de escribir una línea** (2026-08-03, verbatim: *«no quiero que hagas el diseño por tu
cuenta porque tengo que ver contigo el diseño específico de esa página y todas otras»*), y
**no vale dejarle una propuesta ya montada**. Se parte en dos:
- **Fontanería** (token, modelo de datos, endpoints, PDF, metadatos, `noindex`): se propone,
  se hace y se avisa.
- **Diseño y contenido visible** (secciones, orden, qué se cuenta, maquetación, animaciones):
  **se acuerda antes**.
⇒ Este objetivo **no puede completarse sin una sesión de diseño con él**. La parte de
fontanería sí puede avanzar en paralelo. [[gcc-diseno-sitio-con-fernando]]

## Fuentes consultadas (2026-08-14, todo verificado contra el código actual)
| Fuente | Qué aportó |
|---|---|
| `app/(dashboard)/dashboard/settings/page.tsx` | Perfil fijo 400 px + pestañas CV·Disponibilidad·Portafolio; las pestañas solo si `user.member_id` |
| `components/settings/ProfilePanel.tsx` | Escribe en **`users`** vía `PUT /api/users/profile` (nombre, apellido, teléfono, redes) + avatar + sync Google. **Aquí va el botón y el campo nuevos** |
| `components/settings/CvPanel.tsx` | CV en `member_cv_profiles`: bio, skills, languages, linkedin_url, website_url, education/experience (legado global) y **`talents` JSONB** = `[{key, education[], experience[]}]`. Servicios = filas de `services` por talento |
| `components/settings/PortfolioPanel.tsx` | `member_portfolio_items` (project/product/automation) + proyectos del **equipo** del marketplace. Imágenes en **base64** en la fila |
| `components/settings/AvailabilityPanel.tsx` + `/api/users/availability` | Disponibilidad = **`member_schedules`** (día 1-7, `is_active`, `start_time`, `end_time`). Es un **horario semanal de atención**, no una «disponibilidad laboral» |
| `app/api/members/calendar/public-link/route.ts` | **PRECEDENTE EXACTO del token**: `members.calendar_public_token` + `_created_at`, `crypto.randomBytes(32).toString('hex')`, GET/POST(regenerar)/DELETE(revocar) |
| `lib/flows/contact-share.ts` + `app/lista-contactos/[token]` | Segundo precedente de enlace público con token (base64url, una sola puerta token→recurso) |
| `app/members/[id]/page.tsx` + `/api/members/[id]/public` | ⚠️ **YA EXISTE una página pública del miembro SIN token**, en pixel art, que expone nombre, foto, **teléfono**, correo, CV y portafolio a cualquiera que ponga el id |
| `lib/cotizaciones/pdf.ts` + `app/api/projects/[id]/proforma` | **Precedente del PDF con diseño propio**: se construye un HTML A4 dedicado y se convierte con **puppeteer** (`import` dinámico, `--no-sandbox`) |
| `lib/finance-pdf.ts`, `lib/integrations/sri/ride-pdf.ts` | Camino alternativo de PDF: **PDFKit** — el que sí está probado en producción (los RIDE de las facturas) |
| `Diseño.md` §«Sitio público» | Lenguaje visual de lo público: fondo `#0b0d14`, violeta `#7B5FBF`/`#a78bfa`, **Inter**, colores **literales** (no tokens), piezas en `components/sitio/piezas.tsx`, Server Components, animación por `animation-timeline: view()` **sin JavaScript** |
| `package.json` | `framer-motion` 11.15, `puppeteer` 24.40, `pdfkit` 0.18, `sharp` 0.34 disponibles |
| `sql/migrations/` | Última migración **033**. La nueva sería **034** (y va versionada, no `CREATE TABLE` en el código) |

## Preguntas y respuestas

### P1 — ¿Dónde vive el token y con qué forma? · ✅ Resuelta (por precedente)
- **Por qué importa:** inventar un mecanismo nuevo cuando ya hay uno probado rompe la regla
  «equivalente no es igual».
- **Respuesta:** se calca `calendar_public_token`: columnas **`cv_public_token`** +
  **`cv_public_token_created_at`** en `gcc_world.members`, índice único parcial, 32 bytes hex,
  y un endpoint con **GET (consultar) · POST (generar/regenerar) · DELETE (revocar)**. La
  resolución token→miembro vive en **un solo archivo** (`lib/members/cv-share.ts`), como
  `lib/flows/contact-share.ts`. (fuente: `app/api/members/calendar/public-link/route.ts`)

### P2 — ¿Qué pasa con `/members/[id]`, que YA es pública y sin token? · ⏸ Bloqueada (Fernando)
- **Por qué importa:** es **el punto crítico de todo el objetivo**. Pedir un token para
  proteger el CV mientras existe otra URL que enseña lo mismo —incluido el **teléfono**— con
  solo poner un número, deja la puerta de atrás abierta. Cualquier decisión de privacidad que
  tomemos en la página nueva es papel mojado si esa sigue viva.
- **Opciones:** (a) la nueva la sustituye y `/members/[id]` se retira o redirige; (b) conviven
  y se recorta lo que enseña la vieja; (c) se deja tal cual.
- **Respuesta:** —

### P3 — ¿Qué significa «disponibilidad» para un reclutador? · ⏸ Bloqueada (Fernando)
- **Por qué importa:** lo que hoy guarda la app (`member_schedules`) es un **horario semanal de
  atención** (Lun-Vie 09:00-17:00). Un reclutador no lee eso como disponibilidad: espera
  «inmediata / 15 días / a partir de tal fecha», «jornada completa o parcial», «remoto,
  híbrido o presencial». Si es lo segundo, hacen falta **campos nuevos**, no solo pintar el
  horario que ya existe.
- **Respuesta:** —

### P4 — Aspiración salarial: ¿en qué unidad y con qué forma? · ⏸ Bloqueada (Fernando)
- **Por qué importa:** determina el modelo de datos y cómo se lee. Un rango sin periodo
  («1.200 – 1.800») es ambiguo: no se sabe si es al mes, por hora o por proyecto.
- **A decidir:** periodo (mes / hora / proyecto / anual), moneda (¿siempre USD, como el resto
  de la app?), y si es **rango libre** (mín–máx) o **tramos** predefinidos.
- **Nota técnica:** el panel de Perfil escribe hoy en `users` y el CV vive en
  `member_cv_profiles`. La aspiración es dato de CV, así que **el campo se guarda en
  `member_cv_profiles`** aunque el formulario esté en Perfil, como pidió Fernando.
- **Respuesta:** —

### P5 — ¿Qué datos personales salen a la página pública? · ⏸ Bloqueada (Fernando)
- **Por qué importa:** el enlace se reenvía. Lo que se publica una vez, se publica para
  siempre. Correo y **teléfono** son los dos sensibles.
- **Propuesta a validar:** foto, nombre, cargo, ciudad/país, bio, talentos, skills, idiomas,
  LinkedIn/web **siempre**; correo y teléfono con **interruptor** en el panel de Perfil.
- **Respuesta:** —

### P6 — Del portafolio, ¿sale todo y con precios? · ⏸ Bloqueada (Fernando)
- **Por qué importa:** el portafolio guarda **precios** (`cost`) y servicios con tarifa. En una
  página dirigida a reclutadores, un precio junto a cada proyecto cambia el mensaje: pasa de
  «esto sé hacer» a «esto cobro». Y están los proyectos **del equipo** (marketplace), que no
  son suyos en exclusiva.
- **Respuesta:** —

### P7 — ¿El PDF se genera con puppeteer (HTML propio) o con PDFKit? · 🔎 Investigando
- **Por qué importa:** Fernando pidió explícitamente **un diseño hecho para PDF, no una
  impresión de la página**. Con HTML dedicado + puppeteer se consigue en una tarde; con PDFKit
  hay que dibujar a mano cada caja.
- **Lo que ya sé:** el repo tiene los dos caminos. `lib/cotizaciones/pdf.ts` construye un HTML
  A4 propio y `app/api/projects/[id]/proforma/route.ts` lo pasa por puppeteer
  (`import` dinámico, `--no-sandbox`). **PDFKit sí está probado en producción** (los RIDE de
  las facturas salen por ahí todos los días).
- ⚠️ **Riesgo a verificar antes de comprometerse:** en la Mac **el Chrome de puppeteer no está
  descargado** (quedó anotado en MEMORIA: se usa el Chrome del sistema con `executablePath`).
  Falta comprobar que en **Railway** el navegador existe y que la ruta de la proforma **funciona
  de verdad en producción** — que el código exista no prueba que se ejecute. Si no funciona,
  las salidas son: instalar el navegador en el build, `@sparticuz/chromium`, o dibujar el PDF
  con PDFKit.
- **Respuesta:** —

### P8 — ¿La página debe salir en Google? · ❓ Abierta (recomendación clara)
- **Por qué importa:** es un CV con datos personales detrás de un token. **Debe llevar
  `robots: noindex, nofollow` y quedar fuera de `app/sitemap.ts`.** Un token indexado deja de
  ser un token. Lo doy por hecho salvo que Fernando diga lo contrario.

### P9 — «Vistas especializadas» por tipo de pantalla: ¿qué las diferencia? · ⏸ Bloqueada (Fernando)
- **Por qué importa:** Fernando distingue esto de «responsivo», que es lo que la app ya hace.
  Una vista especializada de verdad significa **maquetación distinta**, no la misma columna
  estrechada: p. ej. en escritorio dos columnas con la foto fija a la izquierda y el contenido
  desplazándose; en teléfono, tarjetas apiladas con navegación por secciones. Sin saber qué
  espera ver, cualquier cosa que haga es adivinar — y esto entra de lleno en la regla de que el
  diseño se acuerda antes.
- **Respuesta:** —

## Decisiones de diseño ya firmes (fontanería, no necesitan acuerdo previo)
1. **Migración `034_cv_publico.sql`, versionada** — nada de `ALTER TABLE` escondido en un
   endpoint. Añade `cv_public_token`, `cv_public_token_created_at` a `members` y los campos de
   aspiración salarial a `member_cv_profiles`.
2. **Una sola puerta token→miembro**, en `lib/members/cv-share.ts`. La lección de
   `lib/flows/acceso.ts` es literal: una regla copiada en varias rutas es una regla que en
   alguna está mal y nadie lo nota.
3. **El endpoint público devuelve SOLO lo que se publica.** No se reusa
   `/api/members/[id]/public` ni se filtra en el cliente: lo que no debe verse **no sale del
   servidor**, porque el JSON de la respuesta se lee igual que la página.
4. **El PDF se arma en el SERVIDOR desde los datos**, no desde el DOM de la página. Es la única
   forma de que sea «un diseño para PDF» y no una captura, y de que el enlace del token
   devuelva el mismo documento siempre.
5. **`noindex` + fuera del sitemap.**
6. **Colores literales, no tokens `.corp`** — como el resto de lo público y las páginas
   legales: esta página la ve un tercero y no puede depender del tema del panel.

## Riesgos identificados
- **La puerta de atrás de `/members/[id]`** (P2) — el riesgo mayor, y es de privacidad, no técnico.
- **Puppeteer sin navegador en Railway** (P7) — se verifica antes de prometer el botón de PDF.
- **Imágenes del portafolio en base64 dentro de la fila.** Ya mordió dos veces en el marketplace
  (listas de 4,8 MB). La página pública **no puede** mandar base64: hay que servir miniaturas por
  endpoint con `sharp`, como hace `/api/marketplace/projects/[id]/image?w=`.
- **Animaciones que esconden el contenido.** Fernando pidió a la vez «muy moderna con
  animaciones» y «todo accesible de un vistazo». La regla del sitio público ya resuelve la
  tensión: animación **CSS ligada al scroll**, nunca opacidad 0 revelada por JavaScript.
- **Revocar tiene que revocar de verdad**: token borrado ⇒ 404 en la página **y** en el PDF.

## Respuestas de Fernando (2026-08-14) — decisiones cerradas
- **P2 · `/members/[id]` SE RETIRA.** La página pública sin token desaparece; la nueva, con token,
  la sustituye. Es lo que hace que el token signifique algo.
- **P3 · Disponibilidad = DISPONIBILIDAD LABORAL, con campos nuevos.** Inmediata / a partir de una
  fecha / no disponible · jornada completa o parcial · remoto, híbrido o presencial. El horario
  semanal de `member_schedules` es otra cosa y se muestra, si acaso, como detalle secundario.
- **P4 · Aspiración salarial = RANGO MENSUAL EN USD.** Mínimo–máximo al mes. Sin selector de
  periodo: una sola unidad, sin ambigüedad.
- **P-diseño · Fernando LEVANTA la regla para ESTA página** (2026-08-14): *«esta vez propón tú el
  diseño»*. ⚠️ Es una excepción **puntual y para esta página**; la regla general de
  `Diseño.md` (el diseño de lo público se acuerda antes) sigue vigente para todo lo demás.

### P7 — Motor del PDF · ✅ Resuelta: **PDFKit**, no puppeteer
- **Por qué importa:** el botón de descarga tiene que funcionar en producción el primer día.
- **Respuesta:** se usa **PDFKit**, que es el motor **probado en producción** (los RIDE de las
  facturas salen por ahí a diario). Se descarta **puppeteer** porque su navegador **no está
  descargado** (verificado: no hay `~/.cache/puppeteer` ni `.local-chromium`, y no hay ninguna
  variable `PUPPETEER_*`), así que la ruta de la proforma que lo usa **no está demostrada en
  Railway** — que el código exista no prueba que se ejecute. Además PDFKit **es** literalmente
  lo que pidió Fernando: un documento dibujado para PDF, no una captura de la página.

### P5 — Datos personales publicados · ✅ Resuelta (supuesto declarado)
- **Siempre:** foto, nombre, titular, ubicación, bio, talentos con su educación y experiencia,
  skills, idiomas, LinkedIn y web.
- **Con interruptor, apagados por omisión:** correo y teléfono. Un enlace se reenvía; publicar
  un teléfono no se deshace. El interruptor vive en el panel de Perfil, junto al botón.

### P6 — Portafolio en la página pública · ✅ Resuelta (supuesto declarado)
- Se publican los ítems del portafolio **sin precio**: es un CV, no una tienda, y un precio al
  lado de cada proyecto cambia el mensaje que lee un reclutador.
- **Las imágenes NUNCA salen en base64** (están así en la fila). Se sirven redimensionadas con
  `sharp` por un endpoint del token, como ya hace el marketplace.

## Progreso — ✅ 100 %, CONSTRUIDO Y VERIFICADO (2026-08-14)

Todas las preguntas críticas están resueltas y la solución está en pie. Lo entregado:
- Migración **034** (aplicada) · `lib/members/cv-share.ts` (puerta única) · `lib/members/cv-pdf.ts`
- `GET|POST|DELETE /api/members/cv/public-link` · `GET|PATCH /api/members/cv/publico`
- `GET /api/cv/[token]` · `/imagen` · `/pdf` · página `/cv/[token]` + su hoja de estilo
- `components/settings/CompartirCv.tsx` (bloque del panel de Perfil) · `components/ui/Interruptor.tsx`
  (extraído, ya no hay dos definiciones del switch) · disponibilidad laboral en `AvailabilityPanel`
- **Retirados** `app/members/[id]` y `app/api/members/[id]/public`
- `scripts/cv-ensayo.mjs` + `npm run cv:ensayo`

## Lo que encontró el ensayo y no habrían encontrado `tsc` ni `next build`
1. **El PDF daba 500 al incrustar cualquier imagen.** `pdfkit.standalone`, al empaquetarse, usa el
   `Buffer` del navegador; `Buffer.isBuffer(bufferDeNode)` da **false**, PDFImage cree que recibe
   una ruta y llama a `fs.readFileSync`, que es un módulo vacío. Se aisló con una sonda de seis
   casos contra el servidor compilado: todos los casos **sin imagen** pasaban. Solución: pasar la
   imagen como **`data:` URL**. Los PDF de facturas nunca lo sufrieron porque son solo texto.
2. **La página salía en blanco en móvil.** La animación ligada al scroll partía de `opacity: 0` y,
   cuando el recorrido no avanza, se queda ahí. Solución: animar **solo `translateY`**.
3. **El pie del PDF se partía en dos líneas** y la segunda se metía debajo del «1 / 1».
   `lineBreak: false` + `ellipsis` no lo impidieron; se mide con `widthOfString` y se recorta.

Ninguno de los tres lo ve el typecheck ni el build. Confirmado otra vez: **medir, no razonar.**

## Riesgos que quedan abiertos
- **`lib/cotizaciones/pdf.ts` + puppeteer no está demostrado en producción.** Su navegador no está
  descargado en el entorno; si la proforma en PDF alguna vez falla, es por aquí. **No se tocó** —
  está fuera de lo pedido—, pero queda anotado.
- **Las imágenes del portafolio siguen en base64 dentro de la fila.** La página pública ya no las
  manda (contador + endpoint con `sharp`), pero el problema de fondo sigue ahí para quien las lea
  en crudo.

## Segunda pasada — correcciones de Fernando sobre lo construido (2026-08-14)

Vio la página funcionando con sus datos y pidió cuatro cambios. Los cuatro están aplicados y
verificados.

1. **Tema CLARO.** *«El tema oscuro es propio interno de la app»*: lo que se comparte por un
   enlace va en claro. **Alcance acotado por él: solo `/cv`** — el resto «ya funciona bien con
   esa normalidad».
2. **El panel derecho enseña SOLO la pestaña activa** (Perfil · Trayectoria · Portafolio). El
   índice de anclas desaparece; `IndiceSecciones.tsx` se borró.
3. **Disponibilidad y Aptitudes bajan a la ficha izquierda**, con los datos personales.
4. **El portafolio incluye los proyectos de la app.** Decisión suya: **solo los COMPLETADOS en
   los que participó**, con **el nombre del cliente tal cual**. Borradores y cotizaciones
   fuera — no son trabajo hecho, son cartera comercial.

### P10 — ¿Qué es «trabajó en un proyecto»? · ✅ Resuelta (medido contra la base)
- **Por qué importa:** con un solo criterio se caen proyectos reales.
- **Respuesta:** son **dos** y hacen falta las dos: **puja aceptada** (`project_bids`, entró al
  proyecto) **o asignación de requerimientos aceptada** (`requirement_assignments`, hizo tareas
  dentro). En la cuenta de Fernando: 24 proyectos en la app · 14 con participación · **10
  completados**, que son los que salen. El endpoint del marketplace no servía: exige además
  `is_marketplace_published`, que es un criterio de escaparate, no de currículum.

### P11 — ¿Por qué reventó el build al mover la maqueta a un componente de cliente? · ✅ Resuelta
- **Respuesta:** `CvCuerpo` importaba `DIAS_SEMANA` y `textoSalario` de `cv-share.ts`, que
  importa `pg`. **Un `import type` se borra al compilar; una constante o una función no**: se
  lleva el módulo detrás, y `pg` en el navegador da *«Can't resolve 'fs' / 'dns' / 'net'»*.
  Solución: **`lib/members/cv-tipos.ts`**, módulo puro con tipos, etiquetas y `textoSalario`;
  `cv-share.ts` lo re-exporta para el servidor. Es el patrón que el repo ya usaba con los
  módulos puros del agente.

### Lo que volvió a encontrarse solo MIRÁNDOLO
- **Tarjetas sin imagen con un recuadro gris**: cuatro de once proyectos sin foto y la rejilla
  parecía rota. Ahora, sin imagen no se pinta nada.
- **El pie del panel colgado** a media pantalla en la pestaña «Perfil». `mt-auto`.
- **El ensayo exigía `image/webp` a las imágenes de proyecto**, pero las ya migradas a
  Cloudinary se sirven por **redirección** a su transformación de ancho: solo las que siguen
  en base64 pasan por `sharp`. La comprobación hacía fallar el camino más usado.
- **Dos trampas del paso oscuro → claro:** el violeta de texto tiene que cambiar (`#a78bfa` no
  llega a AA sobre blanco → `#5b3fa8`) y **hace falta sombra**, porque una tarjeta con solo
  borde no se despega del papel.

### Anotado, no tocado
- **El 401 de `/api/auth/me` en cualquier página pública** es del `AuthProvider` del layout
  raíz, preexistente y común a todo el sitio. Fernando dijo que el resto funciona bien.

## Tercera pasada — las redes sociales como enlaces (2026-08-14)

Fernando: *«hay un botón que dice LinkedIn que realmente no ayuda porque hacerle clic no me
lleva a mi perfil»*, y pidió reusar los campos de redes del perfil para que guarden **enlaces**
y salgan como botones en la página pública.

### P12 — ¿Por qué el botón de LinkedIn no llevaba al perfil? · ✅ Resuelta (y NO era el código)
- **Respuesta:** el valor guardado era `https://www.linkedin.com/feed/` — la dirección que sale
  al **abrir** LinkedIn, no la del perfil. El `href` era correcto y el enlace respondía 200; lo
  que estaba mal era el dato. Desde fuera se ve idéntico a un fallo de programación.
- **Lo que se hizo con eso:** un **aviso en ámbar** (`avisoDeCamino()`) cuando el enlace apunta
  a la portada o al muro de la red. **Avisa, no bloquea**: puede haber casos legítimos, y un
  formulario que impide guardar algo válido es peor que uno que avisa.

### P13 — ¿Se pueden reusar los campos `*_handle`? · ✅ Resuelta (verificado, no supuesto)
- **Por qué importa:** decían «se usarán al generar copy para promocionar tus proyectos». Si
  algún módulo los leía, cambiarlos de `@usuario` a URL rompería ese texto.
- **Respuesta:** **nadie los consume.** Los únicos usos son el `ALTER TABLE` que los crea,
  `/api/auth/me`, el tipo `User` y el propio panel. El generador de copy social de proyectos
  (`/api/projects/[id]/social`) **no los toca**. Reusarlos es seguro. Migración 035.

### Lo aprendido, transferible a cualquier campo de enlace
1. **Sin `https://` un `href` es una RUTA RELATIVA.** `www.x.com/y` acaba en
   `…/cv/<token>/www.x.com/y` → 404. No lo ve el typecheck ni el build: solo pulsando. El
   ensayo lo comprueba ahora con `!/href="www\\./`.
2. **Un campo de enlace sin comprobación de dominio es un agujero de presentación:** el botón
   de «Instagram» puede llevar a cualquier sitio delante de un tercero.
3. **Aceptar las tres formas en que la gente escribe** (URL entera, sin protocolo, `@usuario`)
   y guardar siempre una URL absoluta. Nadie copia la dirección completa.
4. **Devolver lo normalizado a la pantalla tras guardar**: quien escribió `@fulano` ve el
   enlace completo sin recargar, y entiende qué guardó el sistema.

## Cuarta pasada — dónde se edita cada cosa + enlace temporal (2026-08-14)

Fernando revisó el panel con la pantalla delante y dio indicaciones concretas. Todas aplicadas.

| Pedido | Resuelto |
|---|---|
| LinkedIn y sitio web, a «Redes sociales» del Perfil | Las **seis** redes juntas; `PUT .../cv` deja de escribirlas |
| Idiomas con el mismo control que Skills | `BotonChips` + modal, definición única |
| «Compartir CV» a la derecha de las pestañas | Botón como el «Compartir acceso» de un proyecto |
| Panel derecho con overlay y **acceso temporal** | `PanelCompartirCv`, calcado de `QuoteShareButton` · migración 036 |
| Aspiración salarial a «Mi CV» | Junto a skills e idiomas |
| Quitar «mostrar el rango» y los interruptores de contacto | Columnas **eliminadas** |
| Quitar los tres botones de ayuda | Hechos |
| Titular profesional a «Mi CV»; ubicación en Perfil | Hecho |
| Quitar la raya negra de la página pública | Era una barra de desplazamiento |
| Fuera las pestañas; perfil y trayectoria juntos; dos pestañas | Hecho |

### P14 — ¿Qué era la «raya negra»? · ✅ Resuelta
- **Respuesta:** la **barra de desplazamiento** de la ficha izquierda, que era
  `h-screen overflow-y-auto`. Con el tema oscuro del sistema se pinta oscura y parecía una
  línea dibujada a propósito. Se quita el scroll interno (`sticky` + `self-start`).
- **Regla que queda:** en una página de lectura, **un solo contenedor con scroll: el de la
  página**. Un panel con scroll propio no solo pinta una barra — también atrapa la rueda del
  ratón y rompe el gesto de leer de arriba abajo.

### P15 — ¿Interruptor de visibilidad o campo vacío? · ✅ Resuelta (regla de diseño)
- **Respuesta de Fernando:** el **campo vacío ES el interruptor**. Un dato que se rellena y
  luego se oculta con una casilla aparte son dos formas de decir lo mismo, y la segunda hay
  que descubrirla: se escribe el sueldo, no sale, y no se sabe por qué.
- **Vale para cualquier dato opcional que se publique.** Se borraron tres columnas.

### Lo que volvió a demostrar el ensayo
Al eliminar `salary_visible`, `share_email` y `share_phone` se quitaron **de la lógica pero no
del `SELECT`**: la página entera daba **500**. `tsc` limpio, `next build` limpio. Lo cazó
`npm run cv:ensayo` en el primer intento. **Tercera vez en este objetivo** que el fallo real
solo aparece ejecutando.

### Pendiente de comprobación visual
El **panel de Configuración (dashboard) no lo he podido ver en el navegador**: exige sesión con
contraseña y código al correo. Está verificado con typecheck, build y revisión del código, pero
la maqueta la tiene que mirar Fernando.

## Quinta pasada — desplazamiento y pestañas (2026-08-15)

| Pedido | Resuelto |
|---|---|
| Quitar el aviso de LinkedIn | Fuera la función, el campo `aviso` y sus pruebas |
| Las pestañas de Configuración se desbordan | Era un `overflow-x-auto` innecesario |
| Pestañas del CV público a la derecha, bajo las cifras, horizontales | Hecho, e iguales en todos los tamaños |
| Que la página pública no se desplace; que ruede el panel por dentro | Hecho **solo en escritorio** |

### P16 — ¿Por qué se desbordaba una barra con tres pestañas y sitio de sobra? · ✅ Resuelta
- **Respuesta:** un `overflow-x-auto` puesto de forma preventiva. El navegador reserva y pinta
  la barra horizontal **aunque no haya nada que desplazar**, y eso come alto y asoma en la
  esquina. **Regla: no se ponen contenedores de scroll «por si acaso».**

### P17 — ¿Cómo se hace que una columna ruede y la página no? · ✅ Resuelta (medido)
- `lg:h-screen lg:overflow-hidden` en la raíz, y **`h-full` + `min-h-0` en cada nivel** hasta
  el contenedor que rueda. Sin `min-h-0` el hijo flex no se encoge por debajo de su contenido
  y el scroll interno **no aparece nunca**.
- ⚠️ **Solo en escritorio.** Bloquear el scroll de la página en un teléfono la rompe. Se midió
  con el navegador en los dos tamaños en vez de darlo por bueno.
- **Y la barra hay que vestirla.** Volver a meter scroll interno reintroduce la «raya negra»
  si se deja la del navegador: `.cv-scroll` la deja fina y violeta. Se estiliza, **no se
  oculta** — una barra invisible esconde que hay más contenido.
