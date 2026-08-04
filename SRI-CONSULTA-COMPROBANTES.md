# Consultar comprobantes en el SRI y traerlos a una app — investigación técnica

> Investigación hecha el **2026-08-04** a partir de la integración SRI ya en producción en GCC
> World (`lib/integrations/sri/`) más sondeo en vivo de los servicios del SRI.
> **No es una funcionalidad a añadir a GCC World**: es el estudio de viabilidad para el proyecto
> nuevo que va a requerirla. Todo lo marcado ✅ está **verificado en vivo hoy**; lo marcado ⚠️
> es inferido de código de terceros o de la operativa conocida y **hay que confirmarlo con una
> sesión real del portal**.

---

## 1. Respuesta corta

**Sí se puede, y bien.** Pero hay que desmontar la expectativa de partida: **el SRI no tiene una
API que te entregue "las facturas de un RUC"**. No existe un endpoint tipo
`GET /facturas?ruc=X&mes=07`. Lo que existe es:

| Vía | Qué te da | Autenticación | Estado |
|---|---|---|---|
| **A. WS SOAP de autorización** | El **XML autorizado completo** de UN comprobante, dada su clave de acceso | **Ninguna** | ✅ verificado |
| **B. REST público de catastro** | Datos del contribuyente por RUC (razón social, régimen, estado…) | Ninguna | ✅ verificado |
| **C. Portal *SRI en Línea*** | El **listado** de comprobantes recibidos/emitidos + descarga de XML y RIDE | Clave del contribuyente | ✅ flujo verificado, ⚠️ pantalla interna sin sesión |
| **D. Correo del adquirente** | XML + RIDE que el emisor está obligado a enviarte | La del buzón | operativa conocida |

La **completitud** solo la da **C**. La **estructura de datos** la da **A**. El diseño correcto
las combina: *C descubre las claves de acceso · A (o el propio link del portal) materializa el
XML · D es la red de seguridad*.

---

## 2. Lo que el SRI expone realmente

### 2.1 Web services SOAP públicos ✅

Namespace `comprobantes-electronicos-ws`. Solo hay dos servicios y **los dos ya los usa GCC
World** (`lib/integrations/sri/soap-client.ts`, `config.ts`):

```
Producción  https://cel.sri.gob.ec/comprobantes-electronicos-ws/{Recepcion|Autorizacion}ComprobantesOffline
Pruebas     https://celcer.sri.gob.ec/comprobantes-electronicos-ws/{...}
```

El WSDL de `AutorizacionComprobantesOffline` responde 200 y declara **dos** operaciones:

- `autorizacionComprobante` — por **clave de acceso** (49 dígitos)
- `autorizacionComprobanteLote` — por **clave de acceso de LOTE**

> ⚠️ **Trampa habitual**: `autorizacionComprobanteLote` *no* sirve para consultar comprobantes
> de terceros en bloque. La "clave de lote" es la que devuelve el envío por lotes **del propio
> emisor**. No es un buscador.

**El hallazgo importante — probado hoy sin credenciales, desde una IP cualquiera:**

```bash
curl -X POST -H "Content-Type: text/xml;charset=UTF-8" -H "SOAPAction: " \
  --data-binary @soap.xml \
  https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline
```
```xml
<RespuestaAutorizacionComprobante>
  <claveAccesoConsultada>0408202601093009592200120010010000001231234567810</claveAccesoConsultada>
  <numeroComprobantes>0</numeroComprobantes>
  <autorizaciones/>
</RespuestaAutorizacionComprobante>
```

Respondió `HTTP 200`. `numeroComprobantes=0` porque esa clave es inventada. **Con una clave real
devuelve el comprobante entero**: `<estado>AUTORIZADO</estado>`, `numeroAutorizacion`,
`fechaAutorizacion` y `<comprobante><![CDATA[ …XML completo… ]]></comprobante>` — emisor,
adquirente, cada ítem con código, cantidad, precio y descuento, impuestos, formas de pago e
`infoAdicional`.

**Consecuencia de diseño:** *quien tiene la clave de acceso tiene la factura entera, sin
credenciales de nadie*. Ese es el camino más limpio, más legal y más estable de los cuatro. Todo
el problema se reduce entonces a **cómo conseguir las claves de acceso**.

La clave de acceso, además, no es opaca: es un formato fijo de 49 dígitos con dígito verificador
módulo 11 — `ddmmaaaa(8) + tipoComprobante(2) + rucEmisor(13) + ambiente(1) + serie(6) +
secuencial(9) + código numérico(8) + tipoEmisión(1) + DV(1)`. Ya está implementado en
`lib/integrations/sri/access-key.ts`. Es decir: **se puede validar una clave antes de gastar una
llamada al SRI**, y se puede leer de ella el RUC del emisor y la fecha sin consultar nada.

### 2.2 REST público de catastro de contribuyentes ✅

No es facturación, pero es el complemento natural (validar proveedores, autocompletar razón
social). Verificado hoy, sin credenciales:

```
GET /sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/obtenerPorNumerosRuc?&ruc=0993371255001
→ [{ numeroRuc, razonSocial, estadoContribuyenteRuc, actividadEconomicaPrincipal,
     tipoContribuyente, regimen ("RIMPE"), obligadoLlevarContabilidad, agenteRetencion,
     contribuyenteEspecial, informacionFechasContribuyente{…}, representantesLegales[…] }]

GET /sri-catastro-sujeto-servicio-internet/rest/ConsolidadoContribuyente/existePorNumeroRuc?numeroRuc=…
→ true | false

GET /sri-catastro-sujeto-servicio-internet/rest/Establecimiento/consultarPorNumeroRuc?numeroRuc=…
→ [{ nombreFantasiaComercial, tipoEstablecimiento, direccionCompleta, estado, numeroEstablecimiento, matriz }]
```

Host: `https://srienlinea.sri.gob.ec`. Requiere `User-Agent` de navegador (sin él devuelve
cuerpo vacío). No documentado oficialmente, pero es el que consume el propio portal: estable de
años y usado por medio Ecuador.

### 2.3 Portal *SRI en Línea* — la única fuente del listado ✅⚠️

Aquí está el listado de "Comprobantes electrónicos **recibidos**" y "**emitidos**". Es lo único
que responde a "¿qué me facturaron en julio?".

**Autenticación — verificado hoy, y es mejor noticia de lo esperado:**

Pedir cualquier página protegida redirige (302) a **Keycloak / RH-SSO 7.3.8.GA**:

```
https://srienlinea.sri.gob.ec/auth/realms/Internet/protocol/openid-connect/auth
  ?response_type=code&client_id=app-tuportal-internet&redirect_uri=…&scope=openid
```

El formulario de login (`<form id="kc-form-login" method="post"
action=".../login-actions/authenticate?session_code=…&execution=…&client_id=…&tab_id=…">`) tiene
exactamente cuatro campos y **ningún captcha, ningún reCAPTCHA, ningún OTP**:

| campo | contenido |
|---|---|
| `usuario` | RUC / cédula / pasaporte del titular |
| `ciAdicional` | cédula del **usuario adicional** (opcional) |
| `username` | oculto; lo compone el JS |
| `password` | oculto; lo transforma el JS |

El JS que los compone está en
`/auth/resources/7.3.8.ga/login/sri-template/js/script.js` y es trivial de replicar:

```js
username = usuarioAdicional ? usuario.toUpperCase() + '[ad]' + usuarioAdicional
                            : usuario.toUpperCase();
password = CryptoJS.MD5(clave) + jsSHA(clave).getHash('SHA-512','HEX');   // hex concatenado
```

**Es decir: la clave viaja como `md5(clave) ‖ sha512(clave)` en hex.** Esto significa que el
login se puede hacer con un **cliente HTTP puro (Node/Python + cookie jar)** — no hace falta
Selenium ni Playwright para autenticarse. Tras el POST, Keycloak devuelve el `code`, y el portal
propaga la sesión a la app JSF con
`tuportal-internet/GeneraToken.jsp?urlAplicacion=<url de la app>`.

**Las pantallas** (✅ existen y redirigen a Keycloak sin sesión; ⚠️ el DOM interno está tomado de
extensiones de terceros y hay que reconfirmarlo con una sesión real):

*Recibidos* — `comprobantes-electronicos-internet/pages/consultas/recibidos/comprobantesRecibidos.jsf`

- Filtros: `frmPrincipal:ano`, `frmPrincipal:mes`, `frmPrincipal:dia` (`0` = todos),
  `frmPrincipal:cmbTipoComprobante` (`1` Factura · `2` Liquidación de compra · `3` Nota de
  crédito · `4` Nota de débito · `5` Guía de remisión · `6` Comprobante de retención).
  **Un tipo y un mes por consulta** — no hay rango de fechas.
- Tabla PrimeFaces `frmPrincipal:tablaCompRecibidos_data`; por fila: nº, **RUC del emisor**,
  tipo + serie, **clave de acceso**, fecha de emisión.
- Cada fila trae `[id$=":lnkXml"]` y `[id$=":lnkPdf"]` → **descarga directa del XML autorizado y
  del RIDE**. En recibidos no hace falta ni pasar por el WS.
- Paginación PrimeFaces, texto `(X of Y)`.

*Emitidos* — `comprobantes-electronicos-internet/pages/consultas/emitidos/comprobantesEmitidos.jsf`

- Se consulta **por día suelto** (`frmPrincipal:calendarFechaDesde_input`, dd/mm/aaaa) + tipo.
  Recorrer un mes = 28-31 consultas.
- La tabla **no** tiene link de XML: solo RIDE. El XML se obtiene del WS público §2.1 con la
  clave de acceso de la fila. (Esto es exactamente lo que hace la extensión
  `rolansor/sri-downloader-extension`.)

**No hay descarga masiva nativa.** Todo el ecosistema de extensiones de Chrome, ejecutables de
escritorio y servicios de pago que existe en Ecuador para esto es la prueba: si hubiera API, no
existirían. Los que se anuncian como "se conecta por SOAP directamente al SRI y descarga todos
tus comprobantes" están describiendo el paso §2.1 **después** de haber sacado las claves del
portal — no un servicio que no existe.

### 2.4 Correo del adquirente

La normativa obliga al emisor a **entregar** el comprobante al adquirente (XML + RIDE), y en la
práctica casi todos lo hacen por email a la dirección que consta en el XML. Ingestar un buzón por
IMAP y parsear adjuntos `.xml`/`.zip` es la vía que **no depende del SRI en absoluto**: sin
credenciales fiscales, sin scraping, sin riesgo de que cambie un DOM. Su defecto es la
completitud: falta lo que no te enviaron o llegó a otro correo.

---

## 3. Las tres arquitecturas posibles, y cuál elegir

**A · Clave de acceso → XML** *(sin credenciales)*
Entra la clave (tecleada, leída del **QR o del código de barras del RIDE**, o extraída de un PDF)
y sale el comprobante estructurado.
✔ Legal, estable, cero custodia de secretos, cero mantenimiento.
✘ No descubre nada por sí sola: alguien tiene que aportar la clave.
→ **Siempre se implementa.** Es el motor de parseo de todo lo demás y, de paso, un feature con
mucho valor de UX (subir un RIDE y que la factura se cargue sola).

**B · Correo → XML**
✔ Independiente del SRI, sin credenciales fiscales, tiempo real.
✘ Incompleto; hay que lidiar con ZIPs, cuerpos HTML, remitentes creativos.
→ Complemento excelente. Aporta el "casi todo" de forma barata.

**C · Portal autenticado → listado + XML**
✔ **La única que garantiza completitud**: aparece todo lo que te emitieron, lo hayan enviado o
no, y además detecta anulaciones.
✘ Requiere credenciales del contribuyente (custodia, consentimiento, revocación), depende de que
el SRI no cambie el portal, y el SRI puede meter captcha/2FA cualquier día.
→ **Imprescindible si el cliente necesita cuadrar compras/IVA/ATS.** Si solo quiere "cargar
facturas cómodamente", A+B bastan y se ahorra todo el riesgo.

**La recomendación: C para descubrir, A para materializar, B como red.** Con C aislado en un
worker propio, para que si un día el portal cambia, el resto del sistema siga funcionando con A
y B mientras se arregla el conector.

---

## 4. Lo legal y el riesgo — sin adornos

Esto hay que hablarlo con el cliente **antes** de cotizarlo, porque condiciona el precio y el
contrato:

- **No hay prohibición** de automatizar el acceso del propio contribuyente a sus propios datos, y
  es lo que hace todo el software contable del país. Pero **no hay tampoco una bendición
  explícita del SRI**: no existe una API oficial que lo sustituya, se está usando el canal humano.
- **La clave del SRI es personal e intransferible.** Guardar la clave del titular en tu servidor
  te convierte en custodio de un secreto con el que se pueden presentar declaraciones. Mitigación
  correcta y barata: **usar un “usuario adicional”** del SRI (el campo `ciAdicional`, sufijo
  `[ad]`) con permiso acotado a *Facturación Electrónica*. El titular lo crea, lo delega y lo
  revoca cuando quiera, sin tocar su clave.
- **Cifrado y consentimiento**: credenciales cifradas en reposo con clave fuera de la base (KMS /
  libsodium con secreto en variable de entorno), nunca en logs, y un consentimiento firmado del
  cliente autorizando el acceso automatizado. Botón de "revocar" que borre la credencial.
- **Riesgo técnico a asumir en contrato**: si el SRI introduce captcha o MFA, el conector C cae.
  El plan B debe estar diseñado desde el día uno: **modo "sesión asistida"** — el usuario hace
  login en un navegador (embebido o extensión) y el sistema captura la cookie de sesión para
  hacer el barrido. Menos automático, pero inmune a captcha.
- **Cortesía técnica**: limitar a unas pocas peticiones por minuto y sincronizar de madrugada. No
  martillear el portal.

---

## 5. Diseño de la solución para el proyecto nuevo

### 5.1 Forma

Un **servicio `sri-sync` separado** de la app web (mismo patrón que `services/cotizador-worker/`
en GCC World). Motivos: el barrido es lento y por lotes, no puede vivir en un request de Next.js,
y aislarlo permite reintentarlo y desplegarlo sin tocar la app.

```
[app Next.js] ──lee──> [Postgres] <──escribe── [sri-sync worker]
                                                   ├─ conector PORTAL   (login Keycloak + JSF)
                                                   ├─ conector WS       (clave → XML)   ← el de GCC
                                                   └─ conector CORREO   (IMAP)
```

### 5.2 Datos

```sql
sri_credentials(id, tenant_id, ruc, usuario_adicional, clave_cifrada, estado, ultimo_ok, ultimo_error)
sri_sync_runs  (id, credential_id, periodo, tipo_comprobante, origen, encontrados, nuevos, estado, error, inicio, fin)

received_documents(
  clave_acceso        char(49) PRIMARY KEY,      -- idempotencia natural
  tenant_id, tipo_comprobante, ambiente,
  emisor_ruc, emisor_razon_social,
  serie, secuencial, fecha_emision, fecha_autorizacion, numero_autorizacion,
  subtotal_0, subtotal_iva, iva, ice, propina, total, moneda,
  estado,                                        -- AUTORIZADO | ANULADO | NO AUTORIZADO
  origen,                                        -- portal | correo | clave | carga_manual
  xml_raw text,                                  -- SIEMPRE, es el respaldo legal
  version_esquema, creado_en, actualizado_en
)
received_document_items(clave_acceso, linea, codigo_principal, codigo_auxiliar, descripcion,
                        cantidad, precio_unitario, descuento, precio_total_sin_impuesto)
received_document_taxes(clave_acceso, linea, codigo, codigo_porcentaje, tarifa, base_imponible, valor)
received_document_payments(clave_acceso, forma_pago, total, plazo, unidad_tiempo)
```

Siete decisiones que evitan los errores típicos:

1. **`clave_acceso` es la PK.** Es única e irrepetible en todo el Ecuador. Todo el sistema es
   idempotente gratis: reprocesar un mes entero no duplica nada.
2. **Guardar el `xml_raw` siempre.** Es el documento con validez legal y hay que conservarlo 7
   años. Si el parseo cambia, se reprocesa desde el crudo sin volver al SRI.
3. **Re-barrer los últimos 2–3 meses en cada corrida**, no solo el mes en curso. Llegan
   comprobantes atrasados y, sobre todo, **anulaciones**: una factura AUTORIZADA en julio puede
   estar ANULADA en septiembre y hay que detectarlo (reconsultar el WS por clave y actualizar
   `estado`). Este es el fallo número uno de las integraciones caseras.
4. **El XML viene doblemente envuelto**: la respuesta del WS trae `<autorizacion>` y dentro
   `<comprobante>` con el XML real **en CDATA**. Dos parseos. (En GCC World esto todavía no se
   hace: ver §6.)
5. **Versiones de esquema**: factura 1.0.0 / 1.1.0 / 2.0.0 / 2.1.0 conviven en la naturaleza. El
   parser debe leer `@version` y tolerar campos ausentes, no asumir la última.
6. **Retenciones (tipo 07) tienen esquema propio**, y la v2.0.0 cambió a `docSustento`. Si el
   proyecto necesita retenciones, es un parser aparte — presupuestarlo como tal.
7. **Notas de crédito/débito** referencian el documento modificado; hay que enlazarlas
   (`documento_modificado_clave`) o los totales de compras no cuadran nunca.

### 5.3 Ciclo del conector de portal

```
1. login Keycloak (cookie jar)   → sesión
2. GeneraToken.jsp?urlAplicacion=…comprobantesRecibidos.jsf
3. por cada (mes, tipo) del rango a sincronizar:
      POST JSF con ViewState → tabla → recorrer páginas
      extraer (ruc_emisor, tipo, serie, clave_acceso, fecha)
4. claves nuevas (las que no están en received_documents):
      recibidos → descargar XML por su lnkXml
      emitidos  → consultarAutorizacion(clave)      ← WS público
5. parsear, normalizar, insertar
6. reconsultar estado de las claves de los últimos 3 meses (detectar ANULADO)
```

Con backoff exponencial y un tope de peticiones/minuto. Si el paso 1 falla dos veces seguidas,
marcar la credencial y avisar al usuario en vez de reintentar en bucle.

### 5.4 Qué se reaprovecha de GCC World

Todo el trabajo duro de la parte SRI ya está hecho y probado en producción:

| Archivo | Qué aporta |
|---|---|
| `lib/integrations/sri/soap-client.ts` | `consultarAutorizacion()` con timeout, 2 reintentos y parseo de mensajes — **es exactamente el camino A** |
| `lib/integrations/sri/access-key.ts` | generación/validación de clave de acceso con DV módulo 11 |
| `lib/integrations/sri/config.ts` | endpoints, códigos de IVA, tipos de identificación, formas de pago |
| `lib/integrations/sri/ride-pdf.ts` | render del RIDE (útil si hay que regenerar el PDF de un XML recibido) |
| `lib/integrations/sri/xml-builder.ts` + `xades-signer.ts` | solo emisión, no aplica a consulta |

**Lo único que falta en el módulo actual para servir a este caso** — y es un detalle de una línea:
`consultarAutorizacion()` declara `xmlAutorizado?: string` en su tipo de retorno pero **nunca lo
rellena** (`lib/integrations/sri/soap-client.ts:96-142`); solo devuelve estado, número y fecha de
autorización. Para consumir comprobantes ajenos hay que extraer el bloque
`<comprobante>…CDATA…</comprobante>` de la respuesta. En GCC World no molesta porque allí solo
interesa saber si el SRI autorizó lo que se acaba de enviar.

### 5.5 PoC para enseñarle al cliente (medio día de trabajo)

1. `sri-login.mjs` — flujo Keycloak completo hasta tener sesión válida. Es el paso que decide si
   el proyecto es viable en servidor sin navegador; con lo verificado hoy, debería serlo.
2. `sri-recibidos.mjs` — consulta un mes y devuelve el JSON de claves de acceso.
3. `sri-xml.mjs` — clave de acceso → XML autorizado → JSON normalizado *(esto ya se puede
   demostrar HOY, sin credenciales de nadie, con una factura cualquiera de la que se tenga el
   RIDE)*.

Con 1+2+3 funcionando sobre un RUC real, la conversación con el cliente deja de ser hipotética.
**Y el paso 3 aislado ya es una demo vendible por sí sola.**

---

## 5.6 EL CASO REAL DEL PROYECTO (definido 2026-08-04)

No es el caso genérico de §3. El caso es:

> El titular de la plataforma es **representante legal de 3 empresas** y tiene acceso completo a
> las 3 en el SRI. En la plataforma entra **un cliente suyo**, pone **su RUC**, y debe ver
> **todas las facturas que cualquiera de las 3 empresas le ha emitido**.

Esto es **emitidos**, no recibidos. Y cambia tres cosas.

### El SRI aquí es la fuente CORRECTA, no un rodeo

Normalmente diría: *el emisor no necesita al SRI para saber qué facturó, ya lo sabe*. Pero con
**3 empresas que probablemente facturan con sistemas o proveedores distintos**, el SRI es el
**único lugar donde existen las tres juntas y normalizadas**. Ese es un motivo legítimo y sólido
para usarlo como fuente unificadora.

⚠️ **Pregunta que puede ahorrar la mitad del proyecto:** si las 3 empresas ya emiten con un mismo
sistema o proveedor (Dátil, Contífico, facturador propio…), la fuente correcta son **sus XMLs**, y
el SRI queda como conciliación. Hay que preguntarlo antes de diseñar nada.

### Hay que INVERTIR el diseño: sincronizar, no consultar en vivo

La tentación es "el usuario pone su RUC → consulto al SRI → muestro". **No se puede y no se debe:**

1. **El SRI no tiene un filtro "facturas de A hacia B".** La pantalla de emitidos se consulta
   **por día suelto** (`frmPrincipal:calendarFechaDesde_input`) + tipo de comprobante. Para
   responder "todo lo que le facturé a este RUC en 2 años" habría que barrer ~730 días × 3
   empresas **en el momento en que el usuario pulsa Buscar**.
2. **La tabla de emitidos no muestra al adquirente.** Sus columnas son *Nro · Tipo y serie · Clave
   de acceso · Fecha/hora autorización · Fecha emisión · Valor · IVA · Total · RIDE · Docs
   relacionados*. **Para saber a quién se le facturó hay que abrir el XML de cada comprobante.**
   Esto es lo que mata el enfoque en vivo. *(⚠️ Fuente: DOM observado por
   `rolansor/sri-downloader-extension`. Alguna guía menciona un filtro por identificación en
   emitidos — hay que confirmarlo con sesión real. Aunque exista, no cambia la arquitectura.)*
3. **Poner las credenciales fiscales de 3 empresas en la ruta crítica de cada visita** de un
   usuario externo es un despropósito operativo y de seguridad.

**La arquitectura correcta:**

```
[worker sri-sync]  ── nocturno, 3 credenciales ──>  [Postgres: issued_documents]
                                                          ▲ índice por identificacion_comprador
[plataforma web]  ── el usuario pone su RUC ──────────────┘   (consulta local, milisegundos)
```

El SRI se toca **una vez al día, de madrugada**. La consulta del usuario nunca sale de tu base.
Ventajas: instantáneo, funciona con el SRI caído, sin límites de tasa, y las credenciales jamás
se usan en respuesta a una acción de un tercero.

### Los números — sí es viable

| | Coste |
|---|---|
| **Backfill** de 2 años | 3 RUCs × 730 días × ~3 tipos ≈ **6.600 consultas** → a 1 cada 2 s, ~4 h de una sola vez |
| **XML de cada comprobante** (para saber el adquirente) | 1 llamada al WS público por factura; 500 fact/mes × 3 × 24 meses ≈ 36.000 → ~20 h de backfill, paralelizable |
| **Incremental diario** | 3 RUCs × 3 tipos = **9 consultas/día** + los XML del día. Trivial |

El backfill es duro pero es **una sola vez**. El régimen permanente es ridículo.

### Dos detalles que rompen el resultado si no se ven

- **`identificacionComprador` no es siempre el RUC.** A una misma persona se le puede haber
  facturado unas veces con **cédula (10)** y otras con **RUC (13, = cédula + `001`)`**. Hay que
  **normalizar a la raíz de 10 dígitos** para el índice de búsqueda, o al cliente le faltarán
  facturas suyas y jurará que el sistema no sirve.
- **Consumidor final = `9999999999999`.** Esas facturas no son atribuibles a nadie y hay que
  excluirlas explícitamente del índice, o cualquiera que teclee ese número se llevará miles.
- **Notas de crédito** emitidas a ese mismo RUC tienen que salir junto a sus facturas, o los
  saldos que vea el cliente estarán mal.

### 🚨 El problema serio: "pone su RUC y ve las facturas" es una brecha de datos

**Un RUC es público y adivinable.** Tal como está descrito, cualquiera podría teclear el RUC de
un tercero —un competidor, un vecino— y ver **qué compró, cuándo y por cuánto**. En Ecuador eso
cae de lleno en la **LOPDP**, con régimen sancionador vigente. Esto hay que resolverlo **antes**
de escribir la primera línea, y hay que planteárselo al cliente como requisito, no como opción.

La solución elegante, y casi gratis porque el dato ya lo tienes: **el XML de la factura trae el
correo del adquirente**. El usuario pone su RUC → el sistema envía un **código de un solo uso al
correo que consta en las facturas emitidas a ese RUC** → con el código, accede. Auto-servicio,
sin dar de alta a nadie a mano, y **matemáticamente imposible** ver facturas ajenas. Alternativas:
alta manual por parte del cliente, o verificación por dato compartido (número y monto de una
factura reciente).

### Credenciales: una por empresa, y que sean de usuario adicional

Son 3 RUCs ⇒ 3 filas en `sri_credentials`, 3 sesiones Keycloak independientes. El representante
legal debería crear en cada empresa un **usuario adicional** acotado a *Facturación Electrónica*
(campo `ciAdicional`, formato `RUC[ad]CEDULA`) en lugar de entregar las claves de titular de las
tres. Es la diferencia entre custodiar un permiso de lectura y custodiar la capacidad de declarar
impuestos de tres empresas.

### Regalo: el PDF sale gratis

Teniendo el XML, el RIDE se regenera con `lib/integrations/sri/ride-pdf.ts` (ya escrito y en
producción en GCC World). El cliente final puede descargar **XML y PDF** sin haber guardado
ningún PDF.

---

## 6. Lo que falta por confirmar

Ninguna de estas dudas invalida el diseño; afectan al esfuerzo y al alcance.

1. **El DOM y el POST JSF exactos de la pantalla de recibidos** — solo se ven con una sesión
   real. Los IDs de §2.3 vienen de dos proyectos de terceros y coinciden entre sí, pero hay que
   verificarlos. *Necesito un RUC de prueba autorizado por el cliente.*
2. **¿Hay REST detrás del JSF?** El portal es PrimeFaces, así que probablemente no; pero si lo
   hubiera, el conector se simplifica muchísimo. Se comprueba en 5 minutos con la pestaña de red
   una vez dentro.
3. **Cuántos resultados devuelve por consulta y si hay tope** — importa para clientes con cientos
   de comprobantes al mes.
4. **Si alguna cuenta tiene 2FA activo** en Keycloak (el flujo estándar no lo pide, pero puede
   estar habilitado por perfil).

5. **¿Filtra la pantalla de emitidos por identificación del receptor?** Si sí, el backfill se
   acorta mucho. Si no, hay que barrer día a día. No cambia la arquitectura (§5.6), solo el coste
   del backfill.
6. **¿Cuánto histórico guarda el portal en emitidos?** Define hasta dónde llega el backfill.

Y las que son del negocio (✅ = ya resueltas por Fernando el 2026-08-04):

7. ✅ **Emitidos**, de **3 RUCs**, consultables por el adquirente. Ver §5.6.
8. ⚠️ **¿Cómo emiten hoy esas 3 empresas?** Si comparten sistema o proveedor, la fuente correcta
   son sus XMLs y el SRI pasa a ser conciliación. **Es la pregunta que más puede cambiar el
   proyecto y sigue abierta.**
9. **¿Cuántas facturas al mes emite cada empresa y cuánto histórico se quiere?** Define el
   backfill (§5.6) y si hace falta cola o basta un cron.
10. **¿Cómo se autentica al cliente final?** Sin resolver esto el proyecto no puede salir a
    producción (§5.6, LOPDP). Mi recomendación: OTP al correo que consta en el XML.
11. **¿Acepta el representante legal crear un “usuario adicional”** por empresa en vez de
    entregar las 3 claves de titular? Es la decisión que más reduce el riesgo del proyecto.
12. **¿Alcanza a notas de crédito/débito y retenciones?** Las NC son obligatorias para que los
    saldos cuadren; retenciones son un parser aparte.

---

## 7. Fuentes

Sondeo en vivo (2026-08-04): WSDL y WS de autorización de producción, REST de catastro, redirección
OIDC del portal, `script.js` del tema de login de Keycloak, y verificación de las rutas JSF.

Código de terceros consultado para el DOM del portal:
[rolansor/sri-downloader-extension](https://github.com/rolansor/sri-downloader-extension) ·
[jonavez/sri-pro-downloader](https://github.com/jonavez/sri-pro-downloader) ·
[RogerVega33/Descargar-comprobantes-SRI](https://github.com/RogerVega33/Descargar-comprobantes-SRI) ·
[Innomaps-io/descargar-comprobantes-sri](https://github.com/Innomaps-io/descargar-comprobantes-sri)

Contexto operativo: [SRI — Comprobantes electrónicos](https://www.sri.gob.ec/en/comprobantes-electronicos) ·
[Dátil — descarga e importación de recibidos](https://docs.datil.com/es/articles/1944687-descarga-e-importa-comprobantes-recibidos-en-el-sri-a-tu-cuenta-datil) ·
[Contífico — cómo descargar facturas electrónicas](https://contifico.com/como-descargar-facturas-electronicas/)
