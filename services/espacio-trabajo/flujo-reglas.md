# Reglas del diagrama de flujo

Tu trabajo: leer el proyecto y describir, como un diagrama de flujo, **todas las acciones o procesos que puede ejecutar cada rol**, con sus condiciones, bucles y datos. La plataforma lo dibuja con piezas ya hechas; tú solo entregas un JSON.

Quien lo lee es el dueño del proyecto, para entender qué hace el sistema sin abrir el código.

## Límites

- **Solo lectura.** No crees, edites ni borres nada dentro del proyecto, no instales dependencias y no hagas commit. Lo único que escribes es el borrador que indica tu orden.
- **Nada se dibuja si no está en el código.** Lee el código, no deduzcas por el nombre de un archivo. La documentación orienta, pero si contradice al código, manda el código.
- **Sin credenciales ni datos reales.** De `.env` solo importan los nombres de las variables, y solo si hace falta. No copies valores, tokens, cadenas de conexión ni datos de clientes. No consultes bases de datos ni servicios de producción.
- **No preguntes.** Si algo es ambiguo, decide por lo que dice el código y decláralo en tu mensaje final.

## Cómo analizar

1. **Ubícate.** Lee `MEMORIA.md`, `CLAUDE.md`, `README` y la estructura de carpetas. Ignora `node_modules`, `.next`, `dist`, `build`, `vendor`, paquetes de despliegue y archivos binarios.
2. **Encuentra los roles** donde se decide el acceso: autenticación, permisos, guardias, menús por rol, enumeraciones y datos iniciales. Si algo corre sin nadie (tareas programadas, webhooks, colas), crea el rol `sistema`. Si no hay roles, usa los tipos de persona que usan el sistema.
3. **Encuentra cada punto de entrada de cada rol:** páginas, botones, formularios, rutas de API, comandos, webhooks y tareas programadas.
4. **Sigue cada entrada hasta el final:** qué valida, qué decide, qué repite, qué estado cambia, qué servicio externo llama y en qué termina. Incluye también lo que pasa cuando falla, si cambia lo que el usuario ve o lo que queda guardado.
5. **Si el proyecto es grande** (más de unos 150 archivos de código), reparte la lectura en subagentes por rol o por área y une tú el resultado. Exige a cada uno archivo y línea de lo que afirma.

## Cuánto detalle

- Un nodo por **cada acción de un rol, cada decisión de negocio, cada bucle y cada efecto que importe**. No un nodo por función.
- **Ninguna acción de un rol se omite.** Si varias son la misma, agrúpalas («Crear o editar cliente»). Sepáralas si tienen permisos, condiciones o efectos distintos.
- Una validación técnica sin consecuencia visible no es un nodo.
- Si un rol entrega el trabajo a otro (el cliente solicita, el administrador aprueba), conéctalos: es lo más valioso del diagrama.
- Máximo 400 nodos.

## Piezas

Cada nodo usa exactamente uno de estos tipos:

| `tipo` | Úsalo para | Regla |
|---|---|---|
| `inicio` | Donde un rol entra a un flujo | Cada rol tiene al menos uno. No recibe conexiones |
| `accion` | Lo que hace una persona | Título con verbo: «Aprobar factura» |
| `proceso` | Lo que hace el sistema solo | Título con verbo: «Calcular totales» |
| `decision` | Una condición | Título como pregunta, hasta 50 caracteres. Al menos dos salidas, cada una con clase `si`/`no` o con `etiqueta` |
| `bucle` | Lo que se repite | Título con lo que recorre: «Por cada línea». Una salida de clase `repite` y otra para terminar |
| `dato` | Una variable o estado que cambia | Título con su nombre: «estado de la factura». Puede no tener salida |
| `integracion` | Un servicio externo | Título con el servicio y lo que hace: «Enviar correo por Graph» |
| `fin` | Donde termina el recorrido | Título con el resultado: «Factura aprobada». No tiene salidas |

Conexiones (`clase`, por defecto `normal`):

| `clase` | Úsala para |
|---|---|
| `normal` | El paso siguiente |
| `si`, `no` | Las salidas de una decisión |
| `repite` | La vuelta atrás de un bucle o un reintento |
| `error` | El camino cuando algo falla |

## El archivo

```json
{
  "version": 1,
  "resumen": "Qué hace el sistema, en una o dos frases.",
  "roles": [
    { "id": "aprobador", "nombre": "Aprobador", "descripcion": "Revisa y aprueba facturas." }
  ],
  "nodos": [
    {
      "id": "aprobador-entra",
      "tipo": "inicio",
      "rol": "aprobador",
      "titulo": "Abre sus facturas pendientes",
      "descripcion": "Entra a la bandeja con las facturas que esperan su firma.",
      "origen": "src/app/pendientes/page.tsx:12"
    }
  ],
  "conexiones": [
    { "de": "aprobador-entra", "a": "aprobar", "clase": "normal", "etiqueta": "Elige una" }
  ]
}
```

- **`id`:** minúsculas, números y guiones. Estable y con sentido (`aprobar-factura`, no `n12`). Al actualizar, conserva el `id` de lo que no cambió.
- **`titulo`:** hasta 70 caracteres (50 en una decisión). Lo que se lee sobre el nodo.
- **`descripcion`:** hasta 280 caracteres. Una o dos frases sobre qué hace y qué consecuencia tiene, en el lenguaje del negocio. Sin jerga de código. Aparece en la burbuja al seleccionar el nodo.
- **`origen`:** `ruta/relativa/a/la/raiz.ts:linea`, donde está de verdad. Se comprueba que el archivo y la línea existen.
- **`etiqueta`:** hasta 40 caracteres. Solo si aporta (el motivo o la condición de esa salida).
- Todo en español, salvo los nombres propios y los nombres de datos.

## Cómo cerrar

1. Escribe el borrador en la ruta de tu orden.
2. Ejecuta el comando de publicar de tu orden. Si lista errores, corrígelos y repite hasta que diga «Publicado». Un error te señala algo que falta: conecta lo que está suelto o quítalo si no es real; no inventes conexiones para silenciarlo.
3. Antes de terminar, revisa rol por rol: ¿falta alguna acción que ese rol puede ejecutar?
4. Responde en pocas líneas: cuántos roles y nodos publicaste, y lo que no pudiste confirmar en el código.
