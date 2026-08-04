# Portal de consulta de facturas — 3 empresas, SRI Ecuador
## Especificación técnica de implementación

> **Qué se construye:** una plataforma donde un cliente entra, se identifica con su RUC/cédula, y
> ve y descarga **todas las facturas que le han emitido las 3 empresas** del titular, en una sola
> lista unificada, con su XML y su PDF.
>
> Documento hermano: [`SRI-CONSULTA-COMPROBANTES.md`](SRI-CONSULTA-COMPROBANTES.md) — la
> investigación de qué expone el SRI y por qué esta arquitectura y no otra. Este documento asume
> aquellas conclusiones y va directo al **cómo**.
>
> Fecha: **2026-08-04**. Marcas: ✅ verificado en vivo · ⚠️ requiere la sesión de reconocimiento
> del §14 antes de darlo por bueno.

---

## 0. Antes de empezar: la pregunta que puede borrar la mitad de este documento

**¿Con qué emiten hoy las 3 empresas?**

- **Si comparten un sistema o proveedor** (Dátil, Contífico, facturador propio, el Facturador
  gratuito del SRI…) → **los XML ya existen del lado del cliente**. La fuente correcta es esa, y
  el conector del portal SRI (§4, el 60% del esfuerzo y el 90% del riesgo) **desaparece**. El SRI
  queda solo como conciliación mensual opcional.
- **Si cada empresa va por su lado** → el SRI es el denominador común y este documento aplica
  entero.

Todo lo demás —modelo de datos, parser, autenticación del cliente final, portal— es idéntico en
ambos escenarios. **Resuelve esto en la primera reunión.**

---

## 1. Arquitectura

```
┌──────────────────────────────────────────────────────────────────────┐
│  SRI                                                                 │
│  ├─ Portal SRI en Línea (Keycloak + JSF)  → LISTADO de emitidos      │
│  └─ WS SOAP público (sin auth)            → XML de cada comprobante  │
└──────────────────────────────────────────────────────────────────────┘
              ▲ 1 vez al día, 03:00 ECT, 3 credenciales
              │
┌─────────────┴────────────────┐        ┌──────────────────────────────┐
│  sri-sync  (worker Node)     │ escribe│  PostgreSQL                  │
│  ├─ conector-portal          ├───────►│  issued_documents            │
│  ├─ conector-ws              │        │   idx: identificacion_norm   │
│  ├─ parser-xml               │        │  issued_document_items       │
│  └─ orquestador              │        │  sri_credentials (cifradas)  │
└──────────────────────────────┘        │  sync_runs · access_codes    │
                                        └──────────┬───────────────────┘
                                                   │ lee (ms)
                                        ┌──────────┴───────────────────┐
                                        │  Plataforma (Next.js)        │
                                        │  · OTP al correo del XML     │
                                        │  · listado + filtros         │
                                        │  · descarga XML / PDF        │
                                        │  · panel admin del titular   │
                                        └──────────────────────────────┘
```

**La regla que gobierna todo el diseño: el SRI nunca se toca dentro de un request de un usuario.**
El worker es el único que habla con el SRI, de madrugada, y la plataforma solo lee Postgres. Esto
da: respuesta en milisegundos, funcionamiento con el SRI caído, cero riesgo de rate-limit, y las
credenciales fiscales jamás en la ruta crítica de un tercero.

### Stack

| Pieza | Tecnología | Por qué |
|---|---|---|
| Plataforma | **Next.js App Router + TypeScript + Tailwind** | estándar de la casa |
| Base | **PostgreSQL + Prisma** | ídem; el volumen es pequeño |
| Worker | **Node ESM** en proceso aparte (patrón `services/cotizador-worker/`) | el barrido es largo; no puede vivir en un request |
| Sesión del cliente final | **JWT (`jose`) en cookie httpOnly** | sin contraseñas que gestionar |
| Deploy | **Railway** (2 servicios: `web` y `sri-sync`) | ídem |
| PDF | **PDFKit**, reutilizando `lib/integrations/sri/ride-pdf.ts` | ya escrito y probado |

---

## 2. Modelo de datos

```sql
CREATE SCHEMA IF NOT EXISTS portal;

-- ─────────────────────────────────────────────────────────────────────
-- Las 3 empresas
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE portal.companies (
  id              SERIAL PRIMARY KEY,
  ruc             CHAR(13) NOT NULL UNIQUE,
  razon_social    TEXT     NOT NULL,
  nombre_comercial TEXT,
  logo_url        TEXT,
  activa          BOOLEAN  NOT NULL DEFAULT TRUE,
  creada_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credenciales SRI. clave_cifrada NUNCA en claro, NUNCA en logs.
CREATE TABLE portal.sri_credentials (
  id                SERIAL PRIMARY KEY,
  company_id        INT  NOT NULL REFERENCES portal.companies(id) ON DELETE CASCADE,
  usuario           TEXT NOT NULL,             -- RUC del titular
  ci_adicional      TEXT,                      -- cédula del usuario adicional (recomendado)
  clave_cifrada     BYTEA NOT NULL,            -- AES-256-GCM, ver §9
  clave_nonce       BYTEA NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'activa',  -- activa | invalida | revocada
  ultimo_login_ok   TIMESTAMPTZ,
  ultimo_error      TEXT,
  fallos_seguidos   INT  NOT NULL DEFAULT 0,
  UNIQUE (company_id)
);

-- ─────────────────────────────────────────────────────────────────────
-- Comprobantes emitidos.  La PK es la clave de acceso: única en todo
-- Ecuador ⇒ idempotencia gratis, reprocesar un mes no duplica nada.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE portal.issued_documents (
  clave_acceso        CHAR(49) PRIMARY KEY,
  company_id          INT  NOT NULL REFERENCES portal.companies(id),

  cod_doc             CHAR(2) NOT NULL,        -- 01 factura · 04 NC · 05 ND · 07 retención
  ambiente            CHAR(1) NOT NULL,        -- 1 pruebas · 2 producción
  version_esquema     TEXT,                    -- 1.0.0 / 1.1.0 / 2.0.0 / 2.1.0

  estab               CHAR(3) NOT NULL,
  pto_emi             CHAR(3) NOT NULL,
  secuencial          CHAR(9) NOT NULL,
  numero              TEXT GENERATED ALWAYS AS (estab||'-'||pto_emi||'-'||secuencial) STORED,

  fecha_emision       DATE NOT NULL,
  fecha_autorizacion  TIMESTAMPTZ,
  numero_autorizacion TEXT,
  estado              TEXT NOT NULL,           -- AUTORIZADO | ANULADO | NO AUTORIZADO
  estado_revisado_en  TIMESTAMPTZ,             -- última vez que se reconsultó el estado

  -- Adquirente
  tipo_id_comprador   CHAR(2),                 -- 04 RUC · 05 cédula · 06 pasaporte · 07 cons.final
  identificacion_comprador  TEXT NOT NULL,
  identificacion_norm TEXT NOT NULL,           -- ⚠ raíz de 10 dígitos. ÍNDICE DE BÚSQUEDA
  razon_social_comprador TEXT,
  email_comprador     TEXT,                    -- de infoAdicional; alimenta el OTP (§6)
  direccion_comprador TEXT,

  -- Importes (NUMERIC, jamás float)
  total_sin_impuestos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_descuento     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_iva           NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_ice           NUMERIC(14,2) NOT NULL DEFAULT 0,
  propina             NUMERIC(14,2) NOT NULL DEFAULT 0,
  importe_total       NUMERIC(14,2) NOT NULL DEFAULT 0,
  moneda              TEXT NOT NULL DEFAULT 'DOLAR',

  -- Solo NC/ND
  doc_modificado_cod  CHAR(2),
  doc_modificado_num  TEXT,
  doc_modificado_clave CHAR(49),
  motivo              TEXT,

  xml_raw             TEXT NOT NULL,           -- respaldo legal, 7 años. SIEMPRE.
  origen              TEXT NOT NULL DEFAULT 'sri_portal',  -- sri_portal | emisor | carga_manual
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- El índice que sirve la pantalla principal
CREATE INDEX idx_issued_lookup
  ON portal.issued_documents (identificacion_norm, fecha_emision DESC)
  WHERE estado = 'AUTORIZADO' AND identificacion_comprador <> '9999999999999';

CREATE INDEX idx_issued_company_fecha ON portal.issued_documents (company_id, fecha_emision DESC);
CREATE INDEX idx_issued_revision      ON portal.issued_documents (estado_revisado_en)
  WHERE estado = 'AUTORIZADO';

CREATE TABLE portal.issued_document_items (
  clave_acceso     CHAR(49) NOT NULL REFERENCES portal.issued_documents(clave_acceso) ON DELETE CASCADE,
  linea            INT      NOT NULL,
  codigo_principal TEXT,
  codigo_auxiliar  TEXT,
  descripcion      TEXT NOT NULL,
  cantidad         NUMERIC(18,6) NOT NULL,
  precio_unitario  NUMERIC(18,6) NOT NULL,
  descuento        NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_total_sin_impuesto NUMERIC(14,2) NOT NULL,
  iva_tarifa       NUMERIC(5,2),               -- ⚠ 0/5/8/12/14/15 conviven. Leer del XML.
  iva_valor        NUMERIC(14,2),
  PRIMARY KEY (clave_acceso, linea)
);

CREATE TABLE portal.issued_document_payments (
  clave_acceso  CHAR(49) NOT NULL REFERENCES portal.issued_documents(clave_acceso) ON DELETE CASCADE,
  linea         INT NOT NULL,
  forma_pago    CHAR(2),
  total         NUMERIC(14,2),
  plazo         INT,
  unidad_tiempo TEXT,
  PRIMARY KEY (clave_acceso, linea)
);

-- ─────────────────────────────────────────────────────────────────────
-- Operación
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE portal.sync_runs (
  id            SERIAL PRIMARY KEY,
  company_id    INT REFERENCES portal.companies(id),
  tipo          TEXT NOT NULL,               -- backfill | incremental | revision_estados
  desde         DATE,
  hasta         DATE,
  estado        TEXT NOT NULL,               -- corriendo | ok | error | parcial
  claves_vistas INT DEFAULT 0,
  nuevas        INT DEFAULT 0,
  actualizadas  INT DEFAULT 0,
  error         TEXT,
  inicio        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fin           TIMESTAMPTZ
);

-- Días ya barridos, para poder reanudar un backfill interrumpido
CREATE TABLE portal.sync_days (
  company_id INT     NOT NULL REFERENCES portal.companies(id),
  dia        DATE    NOT NULL,
  cod_doc    CHAR(2) NOT NULL,
  encontrados INT    NOT NULL DEFAULT 0,
  completado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, dia, cod_doc)
);

-- OTP del cliente final (§6)
CREATE TABLE portal.access_codes (
  id                SERIAL PRIMARY KEY,
  identificacion_norm TEXT NOT NULL,
  email             TEXT NOT NULL,
  codigo_hash       TEXT NOT NULL,           -- bcrypt; el código en claro no se guarda
  expira_en         TIMESTAMPTZ NOT NULL,
  intentos          INT NOT NULL DEFAULT 0,
  usado_en          TIMESTAMPTZ,
  ip                INET,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_codes_lookup ON portal.access_codes (identificacion_norm, creado_en DESC);

CREATE TABLE portal.access_log (       -- quién vio qué. Exigible bajo LOPDP.
  id SERIAL PRIMARY KEY,
  identificacion_norm TEXT NOT NULL,
  accion TEXT NOT NULL,                -- solicito_codigo | ingreso | listo | descargo
  clave_acceso CHAR(49),
  ip INET, user_agent TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### La normalización de identificación — el detalle que decide si el producto sirve

A la misma persona se le factura unas veces con **cédula (10 dígitos)** y otras con su **RUC
(13 = cédula + `001`)`**. Si indexas por el valor crudo, el cliente verá la mitad de sus facturas
y concluirá que el sistema está roto.

```ts
/** Raíz canónica de una identificación ecuatoriana, para búsqueda. */
export function normalizarIdentificacion(id: string): string {
  const s = (id ?? '').trim().toUpperCase();
  // RUC de persona natural: cédula(10) + 001  → la raíz es la cédula
  if (/^\d{13}$/.test(s) && s.endsWith('001') && s[2] !== '9') return s.slice(0, 10);
  // RUC de sociedad (tercer dígito 9) o público (6): no tiene raíz de cédula
  if (/^\d{13}$/.test(s)) return s;
  if (/^\d{10}$/.test(s)) return s;
  return s;                       // pasaporte / identificación del exterior
}
```

Y en la búsqueda se consulta por **ambas formas** para no perder nada:

```ts
const raiz = normalizarIdentificacion(input);
// WHERE identificacion_norm = $1 OR identificacion_comprador = $2
```

**Consumidor final (`9999999999999`) queda fuera del índice** por el `WHERE` parcial: esas
facturas no son atribuibles a nadie y sin ese filtro cualquiera que teclee ese número se llevaría
miles de comprobantes ajenos.

---

## 3. Códigos y catálogos (aquí se cometen los errores tontos)

### 3.1 Dos numeraciones distintas de tipo de comprobante ⚠

| Documento | `codDoc` en el XML | Valor del combo del portal |
|---|---|---|
| Factura | `01` | `1` |
| Liquidación de compra | `03` | `2` |
| Nota de crédito | `04` | `3` |
| Nota de débito | `05` | `4` |
| Guía de remisión | `06` | `5` |
| Comprobante de retención | `07` | `6` |

**No son lo mismo.** Confundirlas hace que pidas notas de crédito y guardes facturas. Una sola
tabla de mapeo, en un solo sitio:

```ts
export const TIPO_DOC = {
  factura:      { codDoc: '01', combo: '1', label: 'Factura' },
  liquidacion:  { codDoc: '03', combo: '2', label: 'Liquidación de compra' },
  notaCredito:  { codDoc: '04', combo: '3', label: 'Nota de crédito' },
  notaDebito:   { codDoc: '05', combo: '4', label: 'Nota de débito' },
  guiaRemision: { codDoc: '06', combo: '5', label: 'Guía de remisión' },
  retencion:    { codDoc: '07', combo: '6', label: 'Comprobante de retención' },
} as const;
```

Para este proyecto se sincronizan **`01`, `04` y `05`**. Las notas de crédito y débito **no son
opcionales**: sin ellas los saldos que ve el cliente están mal.

### 3.2 La tarifa de IVA cambia con el tiempo ⚠

Un backfill de 2 años atraviesa el cambio de **12% → 15%** (abril 2024) y las tarifas temporales
de **5%** y **8%** de feriados. `codigoPorcentaje`: `0`=0%, `2`=12%, `3`=14%, `4`=15%, `5`=5%,
`6`=No objeto, `7`=Exento, `8`=IVA diferenciado.

**Regla: nunca calcular el IVA ni asumir 15%. Leer `<tarifa>` y `<valor>` del XML y guardarlos.**
El XML es la verdad; cualquier recálculo introduce descuadres de céntimos que el cliente detecta.

### 3.3 Anatomía de la clave de acceso

```
ddmmaaaa │ tipoCbte │ rucEmisor    │ amb │ estab+ptoEmi │ secuencial │ códigoNum │ tipoEmi │ DV
   8     │    2     │     13       │  1  │      6       │     9      │     8     │    1    │ 1   = 49
```

Ya implementado en `lib/integrations/sri/access-key.ts` (dígito verificador módulo 11).
**Úsalo para validar antes de gastar una llamada al SRI**, y para extraer RUC emisor y fecha sin
consultar nada.

---

## 4. El conector del SRI

Tres piezas independientes. Las dos primeras son las que tocan al SRI; la tercera es pura CPU.

### 4.1 Login — Keycloak ✅ *(verificado en vivo el 2026-08-04)*

El portal usa **Keycloak / RH-SSO 7.3.8**, realm `Internet`, client `app-tuportal-internet`,
authorization-code flow. **No hay captcha ni OTP en el formulario.** La clave se transforma en
cliente antes de enviarse:

```
username = RUC.toUpperCase()                        // sin usuario adicional
username = RUC.toUpperCase() + '[ad]' + CEDULA_ADIC // con usuario adicional
password = md5(clave).hex + sha512(clave).hex       // concatenados, minúsculas
```

Esto permite autenticarse **con un cliente HTTP puro, sin navegador**:

```js
// worker/sri/login.mjs
import { createHash } from 'node:crypto';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import axios from 'axios';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const hex = (alg, s) => createHash(alg).update(s, 'utf8').digest('hex');

/**
 * Abre sesión en SRI en Línea y deja el cookie jar listo para la app JSF indicada.
 * @param {{usuario:string, ciAdicional?:string, clave:string}} cred
 * @param {string} urlDestino  URL de la app JSF a la que se quiere entrar
 * @returns {Promise<import('axios').AxiosInstance>} cliente con sesión viva
 */
export async function abrirSesionSri(cred, urlDestino) {
  const jar = new CookieJar();
  const http = wrapper(axios.create({
    jar, withCredentials: true, timeout: 30_000, maxRedirects: 10,
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-EC,es;q=0.9' },
    validateStatus: s => s < 400,
  }));

  // 1) Pedir la página protegida ⇒ Keycloak devuelve el formulario de login
  const pagina = await http.get(urlDestino);

  // 2) Extraer el action del <form id="kc-form-login">
  //    (lleva session_code, execution, client_id y tab_id, todos de un solo uso)
  const m = /<form[^>]*id="kc-form-login"[^>]*action="([^"]+)"/i.exec(pagina.data);
  if (!m) {
    // Ya había sesión viva: no hay formulario que rellenar
    if (!/kc-form-login/i.test(pagina.data)) return http;
    throw new Error('SRI: no se encontró el formulario de login (¿cambió el portal?)');
  }
  const action = m[1].replace(/&amp;/g, '&');

  // 3) Componer credenciales tal y como lo hace validarUsuario() del portal
  const username = cred.ciAdicional
    ? `${cred.usuario.toUpperCase()}[ad]${cred.ciAdicional}`
    : cred.usuario.toUpperCase();
  const password = hex('md5', cred.clave) + hex('sha512', cred.clave);

  // 4) POST del login. Keycloak solo lee username/password, pero se envía el
  //    formulario completo por fidelidad.
  const form = new URLSearchParams({
    username, password, login: 'Ingresar',
    usuario: cred.usuario.toUpperCase(), ciAdicional: cred.ciAdicional ?? '',
  });

  const res = await http.post(action, form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: pagina.request?.res?.responseUrl ?? urlDestino },
  });

  // 5) Si vuelve a aparecer el formulario, la credencial es mala.
  if (/kc-form-login/i.test(res.data)) {
    const err = /class="kc-feedback-text"[^>]*>([^<]+)</i.exec(res.data)?.[1]?.trim();
    throw new Error(`SRI: credenciales rechazadas${err ? ` — ${err}` : ''}`);
  }

  // Axios ya siguió la cadena: code → GeneraToken.jsp → app JSF.
  return http;
}
```

**Notas de operación:**
- Los parámetros `session_code`/`execution`/`tab_id` son **de un solo uso**: no se cachean, se
  extraen en cada login.
- La sesión JSF caduca (típicamente 20–30 min de inactividad). El conector debe **detectar la
  redirección a Keycloak a mitad del barrido y reautenticarse**, no morir.
- **Nunca** más de una sesión concurrente por RUC: el portal las invalida entre sí. Un barrido por
  empresa, secuencial.
- `fallos_seguidos >= 2` ⇒ marcar la credencial `invalida`, **dejar de reintentar** y avisar al
  titular. Un bucle de reintentos con clave mala termina en bloqueo de la cuenta.

### 4.2 Lectura del listado de emitidos ⚠ *(el DOM hay que confirmarlo — §14)*

```
https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/pages/consultas/emitidos/comprobantesEmitidos.jsf
```

Es **PrimeFaces sobre JSF**. Formulario `frmPrincipal`, con al menos:

| Componente | Contenido |
|---|---|
| `frmPrincipal:calendarFechaDesde_input` | fecha de emisión, `dd/mm/aaaa` — **un solo día** |
| `frmPrincipal:cmbTipoComprobante` | combo `1`…`6` (§3.1) |
| `frmPrincipal:btnConsultar` | disparador |
| `frmPrincipal:tablaCompEmitidos_data` | `<tbody>` de resultados |
| `.ui-paginator-current` | texto `(X of Y)` |

Columnas de la tabla: *Nro · Tipo y serie · **Clave de acceso** · Fecha/hora autorización · Fecha
emisión · Valor · IVA · Total · RIDE · Docs relacionados.*

> **⚠ Aquí está el hecho que gobierna la arquitectura: la tabla NO muestra al adquirente.** Para
> saber a quién se facturó hay que abrir el XML de cada comprobante (§4.3). Por eso no se puede
> consultar en vivo y por eso se sincroniza. *(Alguna guía menciona un filtro por identificación
> en emitidos; si existe, acorta el backfill pero no cambia nada de esto.)*

**Lo único que necesitamos de esta pantalla es la columna de clave de acceso.** No descargamos
ficheros del portal, no pulsamos el enlace del RIDE, no navegamos a detalles. Cuanto menos
superficie del portal se toque, menos se rompe cuando el SRI lo cambie.

**Un ciclo de consulta (patrón PrimeFaces AJAX):**

```js
// worker/sri/emitidos.mjs
const URL_EMITIDOS = 'https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet' +
                     '/pages/consultas/emitidos/comprobantesEmitidos.jsf';

/** Extrae el javax.faces.ViewState de un HTML o de una partial-response. */
function viewState(html) {
  return /id="j_id__v_0:javax\.faces\.ViewState:\d+"[^>]*value="([^"]+)"/.exec(html)?.[1]
      ?? /name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/.exec(html)?.[1]
      ?? /<update id="[^"]*ViewState[^"]*"><!\[CDATA\[([^\]]+)\]\]><\/update>/.exec(html)?.[1];
}

export async function consultarDia(http, { dia, combo }) {
  const pagina = await http.get(URL_EMITIDOS);
  const vs = viewState(pagina.data);
  if (!vs) throw new Error('SRI: sin ViewState (¿sesión caída?)');

  const body = new URLSearchParams({
    'javax.faces.partial.ajax': 'true',
    'javax.faces.source':  'frmPrincipal:btnConsultar',
    'javax.faces.partial.execute': '@all',
    'javax.faces.partial.render': 'frmPrincipal:tablaCompEmitidos frmPrincipal:messages',
    'frmPrincipal:btnConsultar': 'frmPrincipal:btnConsultar',
    'frmPrincipal': 'frmPrincipal',
    'frmPrincipal:calendarFechaDesde_input': dia,       // dd/mm/aaaa
    'frmPrincipal:cmbTipoComprobante': combo,
    'javax.faces.ViewState': vs,
  });

  const res = await http.post(URL_EMITIDOS, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Faces-Request': 'partial/ajax',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: URL_EMITIDOS,
    },
  });

  return { html: res.data, viewState: viewState(res.data) ?? vs };
}

/** Claves de acceso de la página actual de la tabla. */
export function extraerClaves(html) {
  // Las claves son 49 dígitos; en la partial-response vienen dentro de CDATA.
  return [...new Set(html.match(/\b\d{49}\b/g) ?? [])];
}
```

**Sobre la paginación:** el paginador de PrimeFaces se acciona con otro POST
(`javax.faces.source` = el id del datatable, `<datatable>_pagination=true`, `_first`, `_rows`).
Los nombres exactos se capturan en la sesión de reconocimiento. **Truco que evita el problema:
subir `_rows` al máximo que ofrezca el selector de filas por página** — con un día suelto rara vez
habrá más de una página.

> **Extraer las claves con un regex de 49 dígitos, y no parseando `<td>` por posición, es
> deliberado.** Si el SRI reordena o añade columnas, esto sigue funcionando. Se paga con tener que
> validar cada clave con el módulo 11 (§3.3) — barato y ya implementado.

**Plan B, decidido de antemano:** si el POST JSF resulta frágil o el SRI mete captcha, se cambia
`consultarDia()` por una implementación con **Playwright headless** manteniendo la misma firma.
El resto del sistema no se entera. Cuesta más CPU y RAM en Railway, y punto.

### 4.3 Obtener el XML — WS SOAP público ✅ *(verificado en vivo)*

Sin autenticación, desde cualquier IP. **Este código ya existe en GCC World**
(`lib/integrations/sri/soap-client.ts`) y solo hay que añadirle la extracción del XML, que hoy se
declara en el tipo pero no se rellena:

```js
// worker/sri/ws.mjs
const WS = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline';

export async function obtenerComprobante(claveAcceso) {
  const sobre = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await fetch(WS, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
    body: sobre,
    signal: AbortSignal.timeout(30_000),
  });
  const texto = await res.text();

  if (/<numeroComprobantes>0<\/numeroComprobantes>/.test(texto)) return null;

  const estado = /<estado>([^<]*)<\/estado>/.exec(texto)?.[1]?.trim() ?? 'DESCONOCIDO';
  // ⚠ El XML del comprobante viene ANIDADO Y EN CDATA. Doble parseo.
  const xml = /<comprobante><!\[CDATA\[([\s\S]*?)\]\]><\/comprobante>/.exec(texto)?.[1];

  return {
    estado,                                            // AUTORIZADO | NO AUTORIZADO
    numeroAutorizacion: /<numeroAutorizacion>([^<]*)</.exec(texto)?.[1]?.trim() ?? '',
    fechaAutorizacion:  /<fechaAutorizacion>([^<]*)</.exec(texto)?.[1]?.trim() ?? '',
    xml,                                               // ← el comprobante real
  };
}
```

**Cortesía y límites:** 1 petición cada 500 ms, máximo 2 en paralelo, reintento con backoff
exponencial (1 s, 3 s, 9 s) solo ante error de red o timeout — **nunca** ante una respuesta válida.
El WS es público pero no es gratis para el SRI; martillearlo es la forma más rápida de que lo
cierren para todos.

### 4.4 El parser

```js
// worker/sri/parser.mjs — usa fast-xml-parser
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false, attributeNamePrefix: '@_',
  parseTagValue: false,        // ⚠ TODO como string: los importes se convierten a mano
  trimValues: true,
});

const num = v => (v === undefined || v === null || v === '' ? 0 : Number(String(v).replace(',', '.')));
const arr = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const fecha = v => { const [d, m, a] = String(v).split('/'); return `${a}-${m}-${d}`; };

export function parsearComprobante(xml, meta) {
  const raiz = parser.parse(xml);
  const tipo = Object.keys(raiz).find(k => k !== '?xml');   // factura | notaCredito | notaDebito
  const doc  = raiz[tipo];
  const it   = doc.infoTributaria;
  const inf  = doc.infoFactura ?? doc.infoNotaCredito ?? doc.infoNotaDebito;

  // Email del adquirente: el SRI no tiene campo propio, viene en infoAdicional
  // con una etiqueta que cada emisor escribe a su manera.
  const adicionales = arr(doc.infoAdicional?.campoAdicional);
  const email = adicionales
    .find(c => /mail|correo/i.test(c['@_nombre'] ?? ''))?.['#text']
    ?.trim()?.toLowerCase() || null;

  const impuestos = arr(inf.totalConImpuestos?.totalImpuesto);
  const iva = impuestos.filter(i => i.codigo === '2').reduce((s, i) => s + num(i.valor), 0);
  const ice = impuestos.filter(i => i.codigo === '3').reduce((s, i) => s + num(i.valor), 0);

  return {
    clave_acceso: it.claveAcceso,
    cod_doc: it.codDoc, ambiente: it.ambiente,
    version_esquema: doc['@_version'] ?? null,
    estab: it.estab, pto_emi: it.ptoEmi, secuencial: it.secuencial,
    fecha_emision: fecha(inf.fechaEmision),
    fecha_autorizacion: meta.fechaAutorizacion || null,
    numero_autorizacion: meta.numeroAutorizacion || it.claveAcceso,
    estado: meta.estado,

    tipo_id_comprador: inf.tipoIdentificacionComprador ?? null,
    identificacion_comprador: inf.identificacionComprador,
    razon_social_comprador: inf.razonSocialComprador ?? null,
    direccion_comprador: inf.direccionComprador ?? null,
    email_comprador: email,

    total_sin_impuestos: num(inf.totalSinImpuestos),
    total_descuento: num(inf.totalDescuento),
    total_iva: iva, total_ice: ice,
    propina: num(inf.propina),
    importe_total: num(inf.importeTotal ?? inf.valorTotal ?? inf.valorModificacion),
    moneda: inf.moneda ?? 'DOLAR',

    // NC / ND
    doc_modificado_cod:  inf.codDocModificado ?? null,
    doc_modificado_num:  inf.numDocModificado ?? null,
    motivo: inf.motivo ?? null,

    items: arr(doc.detalles?.detalle).map((d, i) => {
      const imp = arr(d.impuestos?.impuesto).find(x => x.codigo === '2');
      return {
        linea: i + 1,
        codigo_principal: d.codigoPrincipal ?? d.codigoInterno ?? null,
        codigo_auxiliar: d.codigoAuxiliar ?? d.codigoAdicional ?? null,
        descripcion: d.descripcion,
        cantidad: num(d.cantidad),
        precio_unitario: num(d.precioUnitario),
        descuento: num(d.descuento),
        precio_total_sin_impuesto: num(d.precioTotalSinImpuesto),
        iva_tarifa: imp ? num(imp.tarifa) : null,     // ⚠ leído, jamás calculado
        iva_valor:  imp ? num(imp.valor)  : null,
      };
    }),

    pagos: arr(inf.pagos?.pago).map((p, i) => ({
      linea: i + 1, forma_pago: p.formaPago ?? null, total: num(p.total),
      plazo: p.plazo ? num(p.plazo) : null, unidad_tiempo: p.unidadTiempo ?? null,
    })),

    xml_raw: xml,
  };
}
```

**Diferencias por tipo de documento que hay que respetar:**

| | Factura `01` | Nota de crédito `04` | Nota de débito `05` |
|---|---|---|---|
| Raíz | `<factura>` | `<notaCredito>` | `<notaDebito>` |
| Bloque info | `infoFactura` | `infoNotaCredito` | `infoNotaDebito` |
| Total | `importeTotal` | `valorModificacion` | `valorTotal` |
| Detalles | `detalles/detalle` | `detalles/detalle` | **sin detalles** (`motivos/motivo`) |
| Referencia | — | `codDocModificado`, `numDocModificado` | ídem |

**Versiones de esquema:** `1.0.0`, `1.1.0`, `2.0.0` y `2.1.0` conviven en un backfill de 2 años.
`1.0.0` no trae `pagos`. **El parser lee lo que hay y no asume la última versión.** Guardar
`version_esquema` permite reprocesar más adelante desde `xml_raw` si se descubre un caso raro.

### 4.5 Enlazar las notas de crédito

`codDocModificado` + `numDocModificado` identifican la factura afectada dentro del mismo emisor.
Después de cada sincronización:

```sql
UPDATE portal.issued_documents nc
   SET doc_modificado_clave = f.clave_acceso
  FROM portal.issued_documents f
 WHERE nc.cod_doc IN ('04','05')
   AND nc.doc_modificado_clave IS NULL
   AND f.company_id = nc.company_id
   AND f.cod_doc    = nc.doc_modificado_cod
   AND f.numero     = nc.doc_modificado_num;
```

Sin esto, el cliente ve una nota de crédito huérfana y una factura que parece impaga.

---

## 5. Orquestación de la sincronización

### 5.1 Los tres trabajos

**A · Backfill** — una vez, al dar de alta cada empresa.

```
para cada empresa (secuencial, nunca 2 sesiones del mismo RUC a la vez):
  abrir sesión
  para cada día desde <fecha_inicio> hasta hoy:
    para cada codDoc en [01, 04, 05]:
      si (empresa, día, codDoc) ya está en sync_days → saltar     ← reanudable
      consultarDia() → claves
      registrar en sync_days
      encolar las claves que no estén ya en issued_documents
  procesar la cola de claves: obtenerComprobante() → parsear → insertar
```

Coste para 2 años: 3 empresas × 730 días × 3 tipos ≈ **6.600 consultas** al portal (a 1 cada 2 s,
~4 h) más 1 llamada al WS por comprobante. Con 500 facturas/mes por empresa son ~36.000 llamadas
(~5 h a 2 en paralelo). **Se lanza una vez, de noche, y es reanudable** gracias a `sync_days`.

**B · Incremental** — cron diario, 03:00 hora de Ecuador.

Barre los **últimos 7 días** (no solo ayer): hay comprobantes que se autorizan con retraso y días
que fallaron. 3 × 7 × 3 = **63 consultas**. Minutos.

> ⚠ **Zona horaria.** Ecuador es UTC-5 y el servidor de Railway va en UTC. Calcular "ayer" con
> `new Date()` sin ajustar produce el mismo bug que ya costó un rechazo del SRI en GCC World
> (*FECHA EMISION EXTEMPORANEA*, 2026-06-15). Usar siempre
> `new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' })` para obtener la fecha
> local, y formatear a `dd/mm/aaaa` para el portal.

**C · Revisión de estados** — cron semanal.

Una factura AUTORIZADA en julio puede estar **ANULADA** en septiembre, y el listado del portal no
lo refleja de forma fiable. Se reconsulta el WS para los comprobantes de los últimos 90 días con
`estado_revisado_en` más antiguo:

```sql
SELECT clave_acceso FROM portal.issued_documents
 WHERE estado = 'AUTORIZADO'
   AND fecha_emision > current_date - INTERVAL '90 days'
   AND (estado_revisado_en IS NULL OR estado_revisado_en < now() - INTERVAL '7 days')
 ORDER BY estado_revisado_en NULLS FIRST
 LIMIT 2000;
```

**Este es el fallo número uno de las integraciones caseras.** Sin él, el portal enseña facturas
anuladas como vigentes y el cliente reclama.

### 5.2 Escritura idempotente

```sql
INSERT INTO portal.issued_documents (clave_acceso, company_id, ...)
VALUES ($1, $2, ...)
ON CONFLICT (clave_acceso) DO UPDATE SET
  estado             = EXCLUDED.estado,
  fecha_autorizacion = EXCLUDED.fecha_autorizacion,
  estado_revisado_en = now(),
  actualizado_en     = now();
```

Los ítems se reemplazan en la misma transacción (`DELETE` + `INSERT`) solo si el documento es
nuevo o su `estado` cambió. **Reprocesar un mes entero no duplica ni corrompe nada** — esa es toda
la gracia de que la PK sea la clave de acceso.

### 5.3 Concurrencia y ritmo

| Recurso | Límite |
|---|---|
| Sesiones por RUC | **1** (el portal las invalida entre sí) |
| Empresas en paralelo | 1 (secuencial; son 3, no compensa el riesgo) |
| Peticiones al portal | 1 cada 2 s |
| Peticiones al WS | 2 en paralelo, 1 cada 500 ms |
| Reintentos | 3, backoff 1/3/9 s, **solo** ante error de red o timeout |
| Fallos de login seguidos | 2 ⇒ credencial `invalida`, parar y avisar |

---

## 6. Autenticación del cliente final — no es opcional

**El problema:** un RUC es público y adivinable. "Pon tu RUC y ve tus facturas" deja que
cualquiera vea las compras de un tercero. Bajo la **LOPDP** (sanciones vigentes en Ecuador) eso es
una brecha, y el responsable es el titular de la plataforma.

**La solución, que sale casi gratis porque el dato ya está en la base:** el XML de la factura trae
el correo del adquirente en `infoAdicional`. Se envía un **código de un solo uso a ese correo**.

### 6.1 Flujo

```
1. El usuario escribe su RUC/cédula.
2. Se normaliza (§2) y se buscan los correos distintos que aparecen en las facturas
   emitidas a esa identificación por cualquiera de las 3 empresas.
3. ¿Hay correos?
   SÍ  → se envía un código de 6 dígitos al más reciente; en pantalla se muestra
         enmascarado: "Enviamos un código a j••••z@empresa.com".
   NO  → "No podemos verificarte automáticamente. Escríbenos a …" (alta manual).
4. El usuario introduce el código → se emite un JWT (jose) en cookie httpOnly,
   Secure, SameSite=Lax, con { sub: identificacion_norm } y 8 h de vigencia.
5. Todas las consultas posteriores filtran por el `sub` del JWT.
   ⚠ NUNCA por un RUC que venga en el body o en la query.
```

### 6.2 Reglas duras

| | |
|---|---|
| Longitud / vigencia | 6 dígitos, **10 minutos** |
| Almacenamiento | **bcrypt**; el código en claro no se guarda ni se registra |
| Intentos | **5** por código; al sexto se invalida y hay que pedir otro |
| Ritmo | 3 solicitudes por identificación/hora · 10 por IP/hora |
| Enumeración | La respuesta del paso 3 es **idéntica** haya o no facturas: *"Si existen facturas a nombre de esa identificación, enviaremos un código al correo registrado."* Si no, el formulario se convierte en un oráculo de "¿este RUC es cliente de estas empresas?" |
| Correo mostrado | **Siempre enmascarado** |
| Auditoría | Todo a `access_log`: solicitud, ingreso, listado y cada descarga |

```ts
export function enmascararEmail(e: string): string {
  const [u, d] = e.split('@');
  const visible = u.length <= 2 ? u[0] : u.slice(0, 1) + '•'.repeat(Math.min(u.length - 2, 6)) + u.slice(-1);
  return `${visible}@${d}`;
}
```

### 6.3 Alta manual (fallback)

Facturas antiguas sin correo en `infoAdicional`, o clientes cuyo correo cambió. En el panel del
titular: buscar por identificación → registrar un correo verificado a mano → queda en
`portal.manual_contacts` y participa en el paso 2 con la misma prioridad. Sin esto, un porcentaje
real de clientes se queda fuera y el proyecto parece defectuoso.

---

## 7. La plataforma

### 7.1 API

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/acceso/solicitar` | `{identificacion}` → envía OTP. Respuesta siempre igual (§6.2) |
| `POST` | `/api/acceso/verificar` | `{identificacion, codigo}` → cookie de sesión |
| `POST` | `/api/acceso/salir` | borra la cookie |
| `GET` | `/api/facturas` | listado del `sub` del JWT. Filtros: `empresa`, `desde`, `hasta`, `tipo`, `q`, `page` |
| `GET` | `/api/facturas/[clave]` | detalle con ítems y pagos |
| `GET` | `/api/facturas/[clave]/xml` | descarga el `xml_raw` |
| `GET` | `/api/facturas/[clave]/pdf` | RIDE regenerado al vuelo |
| `GET` | `/api/facturas/export.csv` | todo lo filtrado, en CSV |

**La regla de oro de esta API:** cada endpoint de `/api/facturas/*` valida que
`documento.identificacion_norm === jwt.sub` **antes** de devolver nada. Un `WHERE` olvidado en el
endpoint de descarga convierte la clave de acceso en un identificador enumerable y expone todo.
Esto se cubre con un test automático, no con buena voluntad.

```ts
// lib/facturas/guard.ts — un único punto de verdad
export async function documentoDelUsuario(clave: string, sub: string) {
  const doc = await db.issuedDocument.findFirst({
    where: { clave_acceso: clave, identificacion_norm: sub, estado: 'AUTORIZADO' },
  });
  if (!doc) throw new HttpError(404, 'No encontrado');   // 404, no 403: no confirma existencia
  return doc;
}
```

### 7.2 Pantallas

**`/` — Entrar.** Un campo (RUC/cédula), un botón. Luego el campo de código.

**`/facturas` — Listado.** La pantalla del producto.
- Cabecera con el nombre del cliente (`razon_social_comprador` de su factura más reciente).
- **Filtro por empresa**: 3 pestañas o chips — *Todas · Empresa A · Empresa B · Empresa C*. Es la
  razón de ser del proyecto: verlas juntas.
- Filtros de rango de fechas, tipo de documento y búsqueda libre por número.
- Tabla: Fecha · Empresa · Tipo · Número · Total · Estado · acciones (XML, PDF).
- **Las notas de crédito se muestran ligadas a su factura**, con el importe en negativo y en otro
  color. Un total al pie que las reste.
- Estados vacíos honestos: *"No hay facturas en este período"* ≠ *"No encontramos facturas a
  nombre de esta identificación"*.
- Importes en formato **es-ES** (miles `.`, decimales `,`) usando `lib/format.ts`. ⚠ **Nunca** en
  el XML ni en el PDF del RIDE, que exigen punto decimal.

**`/facturas/[clave]` — Detalle.** Datos del emisor y del adquirente, tabla de ítems con cantidad,
precio, descuento e IVA por línea, totales, formas de pago, y los dos botones de descarga.

**`/admin` — Panel del titular** (con su propio login, separado). Estado de las 3 credenciales,
última sincronización de cada empresa, últimos `sync_runs` con sus errores, botón de
*resincronizar rango*, alta manual de correos, y el `access_log` consultable.

### 7.3 El PDF

`lib/integrations/sri/ride-pdf.ts` de GCC World genera el RIDE desde los datos del comprobante.
Adaptarlo para que reciba el objeto parseado en vez de la fila de `invoices`. **El RIDE se
regenera al vuelo, no se almacena**: el `xml_raw` es la fuente de verdad y guardar PDFs solo
añade coste de disco y una copia que se desincroniza.

⚠ Cuidado con el overflow de razones sociales largas — ya mordió en GCC World (2026-06-11).

---

## 8. Estructura del repositorio

```
/
├── app/
│   ├── (portal)/
│   │   ├── page.tsx                    ← entrar
│   │   ├── facturas/page.tsx
│   │   └── facturas/[clave]/page.tsx
│   ├── (admin)/admin/…
│   └── api/
│       ├── acceso/{solicitar,verificar,salir}/route.ts
│       └── facturas/…
├── lib/
│   ├── facturas/{consulta,guard,formato}.ts
│   ├── identidad/normalizar.ts         ← §2, con tests
│   ├── sri/{catalogos,access-key,ride-pdf}.ts   ← portados de GCC World
│   └── acceso/{otp,jwt,rate-limit}.ts
├── services/sri-sync/
│   ├── index.mjs                       ← cron + orquestador
│   ├── sri/{login,emitidos,ws,parser}.mjs
│   ├── repo.mjs                        ← escritura idempotente
│   └── package.json
├── prisma/{schema.prisma,migrations/}
└── scripts/
    ├── backfill.mjs                    ← manual, reanudable
    ├── reprocesar-xml.mjs              ← reparsea desde xml_raw, sin tocar el SRI
    └── probar-clave.mjs                ← clave → XML → JSON. Demo sin credenciales
```

---

## 9. Seguridad

**Las claves del SRI de 3 empresas son el activo más sensible del sistema.** Con ellas se pueden
presentar declaraciones. El tratamiento es no negociable:

1. **Usuario adicional, no titular.** El representante legal crea en cada empresa un usuario
   adicional acotado a *Facturación Electrónica* (campo `ciAdicional`, formato `RUC[ad]CEDULA`) y
   entrega **eso**. Puede revocarlo cuando quiera sin cambiar su clave. Es la diferencia entre
   custodiar un permiso de lectura y custodiar la capacidad de declarar impuestos de tres
   empresas. **Insistir hasta que se acepte.**
2. **Cifrado en reposo**, AES-256-GCM con clave en variable de entorno (`SRI_CRED_KEY`, 32 bytes
   aleatorios), **fuera de la base**. Quien roba un dump no obtiene nada.
3. **Nunca en logs.** Un `console.log(cred)` de depuración deja la clave en los logs de Railway
   para siempre. Redactar en el logger por lista de campos prohibidos.
4. **Nunca al navegador.** Las credenciales se introducen en el panel de admin y viajan una sola
   vez; no hay endpoint que las devuelva, ni siquiera enmascaradas.
5. **Consentimiento firmado** del titular autorizando el acceso automatizado, con alcance
   (lectura de comprobantes emitidos), finalidad y forma de revocación.
6. **Retención**: `xml_raw` 7 años (obligación tributaria); `access_log` 1 año; OTP usados, 30
   días.

```ts
// lib/cripto/credenciales.ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
const KEY = Buffer.from(process.env.SRI_CRED_KEY!, 'base64');   // 32 bytes

export function cifrar(claro: string) {
  const nonce = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', KEY, nonce);
  const data = Buffer.concat([c.update(claro, 'utf8'), c.final()]);
  return { cifrado: Buffer.concat([data, c.getAuthTag()]), nonce };
}

export function descifrar(cifrado: Buffer, nonce: Buffer) {
  const d = createDecipheriv('aes-256-gcm', KEY, nonce);
  d.setAuthTag(cifrado.subarray(-16));
  return Buffer.concat([d.update(cifrado.subarray(0, -16)), d.final()]).toString('utf8');
}
```

**Además:** cabeceras de seguridad en `middleware.ts` (CSP, HSTS, `X-Content-Type-Options`),
rate-limit en los endpoints de acceso, y `Content-Disposition: attachment` con nombre de fichero
saneado en las descargas.

---

## 10. Despliegue

Railway, dos servicios sobre la misma Postgres:

| Servicio | Arranque | Notas |
|---|---|---|
| `web` | `next start` | público |
| `sri-sync` | `node services/sri-sync/index.mjs` | sin puerto público; cron interno o Railway Cron |

Variables: `DATABASE_URL`, `SRI_CRED_KEY`, `JWT_SECRET`, `SMTP_*` (o Resend), `SRI_AMBIENTE=2`,
`TZ=America/Guayaquil`, `SYNC_ENABLED`, `SYNC_HORA=03:00`.

> El `startCommand` de cada servicio se fija **por la API de Railway**, que expone campos que la
> CLI no (lección de GCC World).

**Antes de cada despliegue: `tsc --noEmit`, `next build` y `eslint`.** Cada una caza fallos que
las otras dos no ven; un `tsc` limpio no basta.

---

## 11. Observabilidad

**Métricas por corrida** (`sync_runs`): duración, días barridos, claves vistas, nuevas,
actualizadas, fallos de WS, reautenticaciones.

**Alertas al titular** (correo):
- credencial `invalida` (2 fallos de login seguidos) → **acción inmediata**;
- corrida incremental fallida 2 días seguidos;
- 0 comprobantes nuevos en 3 días para una empresa que suele facturar a diario (síntoma silencioso
  de que el conector se rompió);
- tasa de error del WS > 20%.

**Health check** del worker: `GET /health` con la última corrida OK de cada empresa. Si la más
reciente tiene más de 36 h, responde 503.

---

## 12. Pruebas

**Unitarias** — no requieren SRI:
- `normalizarIdentificacion()`: cédula, RUC natural, RUC sociedad (3.er dígito 9), RUC público,
  pasaporte, cadenas sucias. **Es la función que decide si el cliente ve sus facturas.**
- Parser contra un corpus de XML reales: factura 1.0.0 / 1.1.0 / 2.1.0, con y sin descuentos, con
  IVA 0/12/15, nota de crédito, un ítem y cincuenta ítems.
- Validación de clave de acceso (módulo 11), casos límite incluidos.
- Enlace de NC ↔ factura.

**De integración:**
- Login contra el SRI con una credencial de prueba (verifica que el flujo Keycloak sigue vivo).
- `obtenerComprobante()` con una clave real conocida → compara con el XML esperado.
- Idempotencia: procesar el mismo día dos veces ⇒ `nuevas = 0` y ninguna fila duplicada.

**De seguridad — obligatorias:**
- Usuario A no puede leer una factura de B ni por `/api/facturas/[clave]`, ni por su XML, ni por
  su PDF. **Test automático, tres endpoints, sin excepciones.**
- `9999999999999` no devuelve absolutamente nada.
- El endpoint de solicitud de código responde igual para un RUC con facturas y para uno sin ellas.
- 6 códigos erróneos invalidan; el rate-limit corta.

**Aceptación con el cliente:** él elige 10 facturas reales de las 3 empresas; deben aparecer todas,
con importes idénticos al céntimo y el mismo PDF.

---

## 13. Fases

| # | Fase | Contenido | Depende de |
|---|---|---|---|
| **0** | **Reconocimiento** (§14) | Sesión real en el portal. **Bloquea todo.** | credenciales de 1 empresa |
| 1 | Núcleo sin SRI | Esquema, parser, normalización, tests, `scripts/probar-clave.mjs` | — |
| 2 | Conector | Login + emitidos + WS + orquestador + `sync_days` | 0, 1 |
| 3 | Backfill | Alta de las 3 empresas, carga histórica, validación de totales | 2 |
| 4 | Portal | OTP, listado, detalle, descargas | 1 |
| 5 | Admin y operación | Panel, alertas, crons, health | 2, 4 |
| 6 | Endurecimiento | Tests de seguridad, rate-limits, cabeceras, retención | 4 |

**La fase 1 no depende del SRI y se puede empezar hoy.** La fase 0 se puede hacer en una
videollamada de 30 minutos con el cliente compartiendo pantalla.

---

## 14. Sesión de reconocimiento — el checklist

Media hora con DevTools abierto y una credencial real. **Sin esto, la fase 2 es adivinar.**

1. Entrar a *Comprobantes electrónicos emitidos*. **Capturar el HAR completo** de una consulta.
2. Anotar los **ids exactos** del formulario: fecha, combo de tipo, botón, id del datatable.
3. **¿Hay filtro por identificación del receptor?** Si lo hay, el backfill se acorta muchísimo.
4. **¿Hay rango de fechas o solo día suelto?**
5. **¿Cuántos años atrás llega el selector?** Define el techo del histórico.
6. **Filas por página**: ¿cuál es el máximo? ¿Hay tope de resultados por consulta?
7. **¿Aparece el adquirente en alguna columna?** Si apareciera, se ahorra una llamada al WS por
   factura en el backfill (aunque el XML sigue haciendo falta para los ítems).
8. **¿Hay alguna llamada REST/JSON** en el HAR, o es todo `partial/ajax`? Si hubiera REST, el
   conector se simplifica radicalmente.
9. **Cuánto dura la sesión** sin actividad.
10. **¿La cuenta tiene 2FA?** El flujo estándar no lo pide, pero puede estar habilitado por perfil.
11. Guardar **3 XML reales** (factura, NC, y una factura antigua con IVA 12%) como corpus de test.

---

## 15. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El SRI cambia el portal | Alto | Superficie mínima (solo leer la columna de claves), extracción por regex y no por posición de columna, alerta de "0 nuevos en 3 días", conector aislado tras una interfaz |
| El SRI añade captcha o MFA | **Alto** | Contratarlo como riesgo conocido. Plan B: modo **sesión asistida** — el titular hace login en un navegador y el sistema captura la cookie para el barrido |
| Credenciales comprometidas | **Crítico** | Usuario adicional acotado, AES-256-GCM con clave fuera de la base, redacción en logs, sin endpoint de lectura |
| Fuga de facturas entre clientes | **Crítico** | Filtro por el `sub` del JWT en un único guard compartido + test automático en los tres endpoints |
| Facturas sin correo ⇒ cliente sin acceso | Medio | Alta manual de contactos en el panel (§6.3) |
| Backfill largo o interrumpido | Bajo | `sync_days` lo hace reanudable; se corre de noche |
| Anulaciones no detectadas | Medio | Cron semanal de revisión de estados (§5.1-C) |
| Descuadres de céntimos | Medio | `NUMERIC`, nunca float; IVA leído del XML, jamás calculado |
| Bug de zona horaria | Medio | `TZ=America/Guayaquil` + fechas vía `Intl` con `America/Guayaquil`. Ya mordió en GCC World |

---

## 16. Resumen de decisiones

1. **Sincronizar de noche, no consultar en vivo** — porque la pantalla de emitidos va día a día y
   no revela el adquirente.
2. **La clave de acceso es la PK** — idempotencia gratis.
3. **Guardar siempre el `xml_raw`** — respaldo legal y posibilidad de reparsear sin volver al SRI.
4. **Normalizar la identificación a la raíz de 10 dígitos** y excluir consumidor final.
5. **El SRI solo se lee, nunca se descarga del portal** — el XML viene del WS público.
6. **Autenticar al cliente final con OTP al correo del XML** — requisito, no opción.
7. **Usuario adicional del SRI, no clave de titular.**
8. **Notas de crédito desde el día uno** — sin ellas los saldos están mal.
9. **Conector aislado tras una interfaz**, con Playwright como plan B ya previsto.
10. **Antes de todo, preguntar cómo emiten hoy las 3 empresas** (§0) — puede eliminar el 60% de
    este documento.
