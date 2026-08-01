# Datos reales del negocio — fuente de verdad

> Estos son los datos **certificados** del emisor. Cuando un trámite, un contrato, una factura
> o un formulario pida datos del negocio, se copian **de aquí**, no de memoria.
>
> Origen: `RUC-certificado-SRI-2026-08-01.pdf` — Certificado del Registro Único de Contribuyentes
> emitido por el SRI el **1 de agosto de 2026 a las 17:37**.
> Código de verificación: `RCR1785623856514981` (comprobable en SRI en línea o SRI Móvil).

## Identidad

| Dato | Valor |
|---|---|
| **Razón social / nombre legal** | `GONZALEZ MUYULEMA LUIS FERNANDO` |
| **Nombre comercial** | `GRUPO CORAZONES CRUZADOS` — ⚠️ **de uso propio, NO registrado en el SRI** (comprobado 2026-08-01). Ver abajo. |
| **RUC** | `0930095922001` |
| **Tipo de contribuyente** | PERSONAS NATURALES |
| **Régimen** | RIMPE — NEGOCIO POPULAR |
| **Estado** | ACTIVO |
| **Inicio de actividades** | 29/01/2025 |
| **Obligado a llevar contabilidad** | NO |
| **Agente de retención** | NO |
| **Contribuyente especial** | NO |
| **Actividad económica** | `S96090705` — Actividades de servicios diversos |
| **Establecimientos** | 1 abierto, 0 cerrados |
| **Obligaciones tributarias** | `1011` — Declaración de Impuesto a la Renta Personas Naturales |

## Domicilio tributario

| Dato | Valor |
|---|---|
| **Jurisdicción** | ZONA 8 / GUAYAS / GUAYAQUIL |
| **Provincia** | Guayas |
| **Cantón** | Guayaquil |
| **Parroquia** | Ximena |
| **Barrio** | 7 Lagos |
| **Calle** | Tabacundo |
| **Número** | 12 |
| **Intersección** | Guasmo Central |
| **Manzana** | 9 |
| **Referencia** | A dos cuadras del Titán |

**Dirección en una línea (para formularios):**
`Barrio 7 Lagos, calle Tabacundo #12 e intersección Guasmo Central, parroquia Ximena, Guayaquil, Ecuador`

⚠️ **«Tabacundo» es la CALLE, no la ciudad.** La ciudad es **Guayaquil**. Este error ya estaba
metido en `app/legal/page.tsx` (decía «Tabacundo, código postal 090102») y se corrigió el
2026-08-01. Si vuelve a aparecer en algún sitio, es el mismo malentendido.

⚠️ **El certificado no indica código postal.** Si un formulario lo exige, hay que averiguarlo, no
inventarlo: el `090102` que estaba en la página legal no viene de ningún documento.

## Medios de contacto registrados

| Dato | Valor |
|---|---|
| **Email registrado en el SRI** | `lfgonzalezm0@outlook.com` |
| **Celular registrado en el SRI** | `0992706933` → formato internacional **+593 99 270 6933** |

Nota: el correo corporativo del proyecto es `lfgonzalezm0@grupocc.org` (Google Workspace, dominio
`grupocc.org`). Son dos cosas distintas y **ninguna sustituye a la otra**: en trámites que cotejan
contra el RUC se usa el registrado en el SRI.

## ⚠️ El nombre comercial NO consta en este certificado

`lib/integrations/sri/config.ts` declara `nombreComercial: 'GRUPO CORAZONES CRUZADOS'` y así sale en
las facturas electrónicas. **Pero este certificado de RUC no lo muestra**: solo trae «Apellidos y
nombres». En Ecuador el nombre comercial se registra **por establecimiento**, y el detalle de los
establecimientos no aparece en este documento de 2 páginas — solo su conteo.

**Consecuencia práctica:** si un tercero (Meta, un banco, un cliente) pide una prueba oficial de que
«Grupo Corazones Cruzados» es el nombre comercial de este RUC, **este PDF no sirve**. Hay que
descargar del SRI en línea el reporte de **«Establecimientos registrados»**, que sí lista cada
establecimiento con su nombre comercial.

### El establecimiento YA existe — no hay que crear ninguno

El certificado dice **«Establecimientos: Abiertos 1»**, y está verificado en producción: hay
**30 facturas autorizadas por el SRI** con numeración **`001-001-000000024`** a
**`001-001-000000073`**. Ese primer `001` **es el código del establecimiento**; el segundo es el
punto de emisión. Sin un establecimiento abierto no se puede emitir ni una factura electrónica.

El establecimiento **001 (matriz)** se crea solo al inscribir el RUC. Coincide con
`SRI_CONFIG.establecimiento = '001'` en `lib/integrations/sri/config.ts`.

> ⛔ **NO crear un establecimiento nuevo.** Un `002` es para un **local físico distinto**: arrastra
> sus propios puntos de emisión y su propia secuencia de numeración. Si se emitiera desde él, la
> numeración de las facturas se rompería y habría que reconfigurar la facturación electrónica que
> hoy funciona. No hay ningún motivo para hacerlo.

### ⚠️ El nombre comercial NO está registrado en el SRI (comprobado 2026-08-01)

Consultado en *sri.gob.ec → Consultas → Consulta de RUC*, el establecimiento sale así:

| No. establecimiento | Nombre comercial | Ubicación | Estado |
|---|---|---|---|
| `001` | *(vacío)* | GUAYAS / GUAYAQUIL / XIMENA / TABACUNDO 12 Y GUASMO CENTRAL | ABIERTO |

**La columna «Nombre comercial» está vacía.** El nombre comercial es un dato **opcional** del
establecimiento, y este nunca se llenó.

Esto tiene dos consecuencias, y la segunda importa más que la primera:

1. **No existe ningún documento oficial que ligue «GRUPO CORAZONES CRUZADOS» a este RUC.** Ante Meta
   no es bloqueante —lo que se verifica es el nombre legal—, pero si alguna vez piden probar el
   nombre comercial, hoy no hay con qué.
2. **Las facturas electrónicas declaran un nombre comercial que no está registrado.**
   `lib/integrations/sri/config.ts` pone `nombreComercial: 'GRUPO CORAZONES CRUZADOS'` en el XML de
   cada comprobante. No ha causado rechazos —las 30 autorizadas lo demuestran, porque en el esquema
   del SRI ese campo es informativo— pero es un dato inexacto en un documento fiscal.

**Recomendado: registrar el nombre comercial en el establecimiento 001.** No es obligatorio y no
bloquea nada, pero resuelve las dos cosas de una vez y es gratis.

- [ ] **Actualizar el establecimiento 001** en *SRI en línea → RUC → actualización de datos /
      establecimientos*, poniendo `GRUPO CORAZONES CRUZADOS` como nombre comercial.
      **Es una actualización del establecimiento que ya existe, NO uno nuevo.**
- [ ] Después, volver a la Consulta de RUC, comprobar que la columna ya lo muestra y **guardar ese
      documento en esta carpeta** como prueba del nombre comercial.

## Dónde se usan estos datos en el código

| Sitio | Qué toma |
|---|---|
| `lib/integrations/sri/config.ts` | RUC, razón social, nombre comercial, dirección de matriz y establecimiento, régimen |
| `app/legal/page.tsx` | Responsable del tratamiento, RUC, dirección y contacto |
| Portafolio comercial de Meta | Nombre legal, dirección y teléfono para la verificación del negocio |

## Los archivos de esta carpeta no van al repositorio

Los PDF de `documentos-negocio/` están **excluidos por `.gitignore`**: son documentos personales
—con dirección y contacto— y el historial de git es permanente. **Este `DATOS-NEGOCIO.md` sí se
versiona**, porque es el que hace falta consultar a diario y sus datos ya estaban en el repo.
Los PDF viven solo en la máquina; guarda una copia donde corresponda.
