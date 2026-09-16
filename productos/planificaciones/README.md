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
| **Planificaciones** | Todo el módulo en una página: a la izquierda las planificaciones (las mías o las de todos), en el medio las semanas de la elegida, a la derecha los campos generados o la **vista previa** del formato entero. «Configurar» solo con una elegida. **Descargar PDF** |
| **Nueva planificación** | Materia, ámbito, nivel (Preparatoria · Primaria · Secundaria), n.º y título de unidad, inicio y fin del PUD. Nace con la plantilla por defecto de la institución |
| **Nueva planificación semanal** | Botón **Dictar** (micrófono → texto en el cuadro), cuadro de indicaciones y hasta **5 adjuntos** (PDF, Word, texto) que se convierten en embeddings al subirlos. El agente redacta en segundo plano; la pantalla se actualiza sola |
| **Los diez campos** | Fecha inicio, fecha fin, tema, n.º de periodos, objetivos del tema, destrezas con criterio de desempeño (elegidas de la tabla, con su imagen), estrategias metodológicas (tres fases del ciclo ACC), recursos, técnica, instrumento. Se pueden **corregir** a mano y **regenerar** |
| **Configurar** | Plantilla, datos del formato (grado, paralelo, jornada, objetivos y criterios de la unidad) y las firmas: elaborado por, revisado por, aprobado por, con la fecha del día de la descarga |
| **Mi perfil** | Nombre, **profesión** (la que sale en la casilla «Docente»), correo y contraseña |
| **Usuarios** (solo el administrador) | Hasta 100 cuentas, todas de **profesor**; cuánto ha planificado cada una |
| **Configuración** (solo el administrador) | Marca (nombre, logo, color, tema), plantilla por defecto y suscripción |

## El agente

`src/lib/generacion.ts` arma el encargo y `src/lib/ia.ts` lo corre contra OpenAI
`gpt-5.6-luna` por `/v1/responses`, con:

- la **búsqueda web integrada** de OpenAI (`web_search`), para canciones y videos
  de YouTube que van con su enlace debajo de la actividad que los usa;
- la herramienta **`buscar_en_adjuntos`**, que consulta los fragmentos (pgvector) de
  los archivos del docente; además recibe de entrada los seis más cercanos a las
  indicaciones;
- salida en **JSON con esquema estricto** (`src/plantillas/pud/esquema.ts`).

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
- `pud/documento.ts` — el modelo del documento (qué va en cada casilla). Lo dibujan
  `pud/pdf.ts` (PDFKit) y `pud/VistaPrevia.tsx` (pantalla), así los dos dicen lo mismo.
- `instituciones.ts` — **la configuración por institución, a nivel de código**:
  cabecera, año lectivo, logos, ejes transversales, competencias, inserciones,
  bibliografía, registro del formato. Se añade una entrada por `slug`.

Lo que **se calcula y no se guarda**: el número de semanas, el total de periodos,
la fecha de las firmas (la del día de la descarga) y el nombre del docente
(profesión + nombre del perfil).

## Las destrezas

Tabla `destrezas` (código, descripción, imagen, nivel, materia). `inquilino_id`
NULO = catálogo común. La semilla carga las 21 que aparecen en los diez ejemplos;
el currículo completo, materia por materia, se carga en un paso posterior.

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

## Lo que falta

- **Cargar las destrezas del currículo por materia** (Fernando lo dejó para el paso siguiente).
- **La configuración del formato de cada cliente real** en `src/plantillas/instituciones.ts`
  (logos, red educativa, ejes, registro) cuando llegue el primero.
- **Pasarela de pago**: hoy el cobro es por autoservicio desde `/gcc`.
- Cloudinary para subir el logo (mientras, se pega la dirección de una imagen), como en los otros productos.
