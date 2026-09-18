# Planificación de Clases

Cuarto **producto** del Grupo Corazones Cruzados: una herramienta para profesores
que **redacta planificaciones de unidad didáctica (PUD) por semanas** con un agente
de IA que trabaja como la docente de referencia, a partir de lo que el docente le
cuenta por micrófono y de los archivos que adjunta, eligiendo las destrezas del
currículo de una tabla, y lo descarga en PDF con el formato de la institución.
Mismo armazón que `productos/catering` (multi-inquilino, marca por institución,
mensualidad como puerta, área `/gcc`); lo propio son el agente, las plantillas y
las pantallas.

Nace de una idea (camino B de `/producto`) y de **diez planificaciones reales** de
una docente de Preparatoria (`Contenido de Profesor/`, en la raíz del repo), de las
que salió el perfil que encarna el agente.

**Desplegado:** https://planificaciones-production.up.railway.app
Contexto y decisiones: `MEMORIA.md` en la raíz del repositorio.

## Qué hace

| | |
|---|---|
| **Inicio** | Cuántas planificaciones hay, quién las ha hecho y de qué materia; el tope de la semana siempre a la vista |
| **Planificaciones** | Todo el módulo en una página: a la izquierda las planificaciones (las mías o las de todos), en el medio las semanas de la elegida, a la derecha los campos generados o la **vista previa** del formato entero. «Configurar» solo con una elegida. **Descargar en Word o en PDF** |
| **Nueva planificación** | **Materia (de las asignadas al docente en Unidades)**, ámbito, nivel (Preparatoria · Primaria · Secundaria), n.º y título de unidad, inicio y fin del PUD. Nace con la plantilla por defecto de la institución y con las destrezas de la materia |
| **Importar formato** | Sube el PDF o Word de un PUD ya hecho: el agente lo **transcribe** (cabecera, firmas, DECE y una semana por cada «SEMANA N», con sus destrezas) y crea la planificación con sus semanas. Cuentan en el tope semanal |
| **Nueva planificación semanal** | Botón **Dictar** (micrófono → texto en el cuadro), cuadro de indicaciones y hasta **5 adjuntos** (PDF, Word, texto) que se convierten en embeddings al subirlos. El agente redacta en segundo plano; la pantalla se actualiza sola |
| **Los diez campos** | Fecha inicio, fecha fin, tema, **n.º de periodos (las horas de esa materia en el horario del docente; no lo decide el agente)**, objetivos del tema, destrezas con criterio de desempeño (elegidas de la tabla, con su imagen), estrategias metodológicas (tres fases del ciclo ACC), recursos, técnica, instrumento. Se pueden **corregir** a mano y **regenerar** |
| **Configurar** | Plantilla, datos del formato (grado, paralelo, jornada, objetivos y criterios de la unidad), el **nombre del responsable del DECE**, las firmas —elaborado por, revisado por, aprobado por, con la fecha del día de la descarga— y el **registro de formato** del pie (título, quién elaboró y aprobó el formato y cuándo) |
| **Estudiantes** | Por cada grado en el que el docente tiene materias, sus estudiantes: nombre completo y si tienen **condición especial** (iniciales, condición reportada, nivel de ajuste razonable, enfoque). Por cada uno con condición, cada semana lleva una línea de **Ajustes razonables** cuya estrategia redacta el agente; los indicadores de evaluación quedan vacíos por ahora |
| **Mi perfil** | Nombre, **profesión** (la que sale en la casilla «Docente»), correo y contraseña; a la derecha el **horario de clases** (lunes a viernes, once periodos de 40 min de 07:10 a 15:00 con el receso 09:10–09:40): cada celda se pulsa y se elige una materia asignada o «Sin clase»; **Exportar / Importar Excel** con la plantilla y su lista desplegable |
| **Unidades** (solo el administrador) | **Grados** (cada uno con un **color de relleno** al azar, que se puede cambiar), sus **materias** y, por materia, descripción, **docentes asignados** y cantidad de unidades. De aquí salen las materias que cada docente puede planificar |
| **Usuarios** (solo el administrador) | Hasta 100 cuentas, todas de **profesor**; cuánto ha planificado cada una |
| **Negocio** (solo el administrador) | Lo que la institución lleva impreso en el formato: las **tres líneas de la cabecera**, el **año lectivo**, los **tres logos** (institución · organización principal · opcional); nombre y contacto |
| **Configuración** (solo el administrador) | Marca (logo de la aplicación, color, tema), plantilla por defecto y suscripción |

## El agente

`src/lib/generacion.ts` arma el encargo y `src/lib/ia.ts` lo corre contra OpenAI
`gpt-5.6-luna` por `/v1/responses`, con:

- la **búsqueda web integrada** de OpenAI (`web_search`), para canciones y videos
  de YouTube que van con su enlace debajo de la actividad que los usa;
- la herramienta **`buscar_en_adjuntos`**, que consulta los fragmentos (pgvector) de
  los archivos del docente; además recibe de entrada los seis más cercanos a las
  indicaciones;
- salida en **JSON con esquema estricto** (`src/plantillas/pud/esquema.ts`).

El **número de periodos** no lo decide el agente: son las horas de esa materia en el
horario del docente (`src/lib/horario.ts → periodosDe`), y el encargo le da las
sesiones (día y hora). **Las tres fases del ciclo ACC se aplican cada día de clase**
y las actividades van numeradas por sesión («1. », «2. », «2.1. »). Si en alguna fase
falta una sesión, `generacion.ts` le devuelve su JSON una vez para que lo complete.

Lo medido: una semana tarda 15–30 s, ~13–25 k tokens de entrada, ~1,3 k de salida.
`temperature`, `top_p` y `max_tokens` son 400 con este modelo: no se mandan.

Transcripción: `gpt-4o-mini-transcribe`. Embeddings: `text-embedding-3-small`.

## Las plantillas (formato + system prompt), en código

`src/plantillas/` — una plantilla es el formato del documento **y** la forma de
redactar. La primera es **`pud`**:

- `pud/perfil-docente.ts` — los **dieciocho rasgos** de la docente de referencia
  (cómo abre, cómo formula preguntas, cómo nombra los materiales, cómo cierra…).
- `pud/sistema.ts` — el system prompt: perfil + reglas campo por campo + un ejemplo
  real; y el encargo por corrida (unidad, semanas anteriores, destrezas, adjuntos,
  indicaciones). **Ni el docente ni el cliente lo ven.**
- `pud/documento.ts` — el modelo del documento (qué va en cada casilla) y **los colores del
  formato**, medidos sobre los PDF originales (rojo `#EF1230`, etiquetas `#BFBFBF`, cabecera
  de tabla `#D9D9D9`, bordes `#808080`, fase `#002060`, DUA verde/morado/celeste). **Nunca los
  del tema del inquilino** (Fernando, 2026-09-16). Lo dibujan `pud/pdf.ts` (PDFKit),
  `pud/word.ts` (docx) y `pud/VistaPrevia.tsx` (pantalla), así los tres dicen lo mismo.
- `pud/contenido-fijo.ts` — **lo que es el formato mismo y no se edita** (Fernando,
  2026-09-16): los ejes transversales de la pastoral educativa, las competencias y las
  inserciones curriculares con sus iconos incrustados (extraídos de los PDF de ejemplo)
  y la bibliografía. Lo variable de la cabecera (líneas, año lectivo, logos) es del
  inquilino y se edita en «Negocio»; el registro de formato es de cada planificación.

Lo que **se calcula y no se guarda**: el número de semanas, el total de periodos,
la fecha de las firmas (la del día de la descarga) y el nombre del docente
(profesión + nombre del perfil).

## Las destrezas

**Son de cada planificación** (Fernando, 2026-09-16): al crearla se copian del catálogo
las de su materia y nivel, y desde el botón **«Destrezas»** (a la izquierda de
«Configurar») el docente las ve en un panel lateral, las edita, las quita o añade
nuevas (código, descripción e **imagen o icono**, PNG/JPG hasta 300 KB, guardada como
`data:` URL). El agente elige **una** por semana según lo que el docente dicta, y el
formato enseña su imagen bajo el código, en la vista previa, el PDF y el Word.

El catálogo (`destrezas` sin `planificacion_id`) vive en `prisma/destrezas/*.json`:
las 21 de los diez ejemplos y las 10 de **Identidad y Autonomía** con sus iconos,
extraídas del PCA de la docente (`Destrezas1.pdf`, columna Preparatoria). Las demás
materias se cargan igual, archivo por archivo.

## Poner en marcha

```bash
cp .env.example .env      # DATABASE_URL (…?schema=planificaciones), JWT_SECRETO, OPENAI_API_KEY
npm install
npm run migrar            # sql/migraciones/ (incluye pgvector y los disparadores del escaparate)
DEMO_CLAVE=… npm run semilla   # plan, operador GCC, materias, destrezas y la institución «demo»
npm run dev               # http://localhost:3013
```

Direcciones: `/` portada · `/<codigo>/acceso` acceso · `/gcc` equipo GCC.

## Migraciones

**No se usa `prisma migrate`** (no atraviesa el proxy de Railway). Prisma genera el
SQL y lo aplica el runner propio:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
node scripts/migrar.mjs
```

La `001_inicial.sql` lleva además `CREATE EXTENSION vector`, la columna
`embedding vector(1536)` y su índice hnsw, que Prisma no modela.

## Desplegado en Railway

Servicio **`planificaciones`** del proyecto **Servidor-GCC**, sobre este mismo repositorio.

| Ajuste | Valor |
|---|---|
| Root Directory · Watch patterns | `productos/planificaciones` · `productos/planificaciones/**` |
| `DATABASE_URL` | referencia a `${{Postgres.*}}` por la red privada, con `?schema=planificaciones` |
| `JWT_SECRETO` · `OPENAI_API_KEY` | propios del servicio |

## El plan

**Estándar · 10 $/mes**: hasta **100 cuentas** y **40 planificaciones semanales
generadas por semana** para toda la institución (no por docente). Las que fallan
no cuentan; un reintento tras un fallo tampoco. Sin límite de histórico.

## El inquilino del grupo

La administración del Grupo Corazones Cruzados tiene un inquilino **ya comprado**
(`/grupo`, marcado `cortesia`): entra sin mensualidad, sin topes y sin purga. Lo pone y lo
quita el equipo GCC desde `/gcc` («Acceso del grupo»); todos los demás pasan por la
suscripción (Fernando, 2026-09-16).

## Lo que falta

- **Cargar las destrezas de las demás materias** (un `prisma/destrezas/*.json` por materia, con sus iconos).
- **Pasarela de pago**: hoy el cobro es por autoservicio desde `/gcc`.
- Cloudinary para subir el logo (mientras, se pega la dirección de una imagen), como en los otros productos.
