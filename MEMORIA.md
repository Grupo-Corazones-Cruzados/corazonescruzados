# Memoria del proyecto — GCC World (gcc-world-manager)

> Fuente de verdad del contexto del proyecto. Se mantiene viva: cada decisión y
> aprendizaje importante se registra aquí en el momento.

## Objetivo
Plataforma interna de gestión para **Grupo Corazones Cruzados (GCC)** — estudio/agencia
de software en Ecuador. Centraliza documentación de proyectos, tickets/soporte,
facturación electrónica (SRI Ecuador), calendario/disponibilidad de miembros, portal de
clientes, y un "mundo" gamificado estilo Digimon (sprites, mapas, NPCs).

## Stack
Stack estándar de la casa, con particularidades de este repo:
- **App**: Next.js 15 (App Router) + TypeScript + React 19 + Tailwind v4.
- **Datos**: PostgreSQL. **Prisma 7** con adapter `@prisma/adapter-pg` **+ SQL crudo vía `pg`**.
  - Cliente Prisma generado en `lib/generated/prisma` (no el default `@prisma/client`).
  - **Schema de BD = `gcc_world`** (no `public`); `search_path=gcc_world,public`. Ver `lib/db.ts`.
  - Prisma `schema.prisma` solo modela Project/Module/Section/Subsection/Incident; el resto
    de tablas se gestionan con **migraciones SQL manuales en `sql/migrations/`** (001–020+).
- **Auth**: propia, **JWT (`jose`) + `bcryptjs`**, roles/permisos por sección. Passkeys
  (`@simplewebauthn`) para clientes.
- **Deploy**: Railway (nixpacks.toml). `build` corre `prisma generate && next build`.
- **Integraciones**: OpenAI + fal.ai (generación de sprites/IA), Resend (email),
  Puppeteer/PDFKit (PDFs), `ec-sri-invoice-signer` + node-forge/xadesjs (firma SRI con `data/firma.p12`).
- **Dev**: `npm run dev` → puerto 3002 (`-H 0.0.0.0`); `dev:https` vía `server.cjs`.

## Estado actual
- **Rama de trabajo y fuente de verdad: `main`** (confirmado por el usuario, 2026-06-07).
  Remote: `Grupo-Corazones-Cruzados/corazonescruzados`.
  La rama `rebuild/v2` fue **eliminada** del remoto el 2026-06-07 (rebuild descartado).
- Trabajo reciente (may-2026): módulo **Tickets** (admin completa/factura tickets, modal
  estandarizado con el de proyectos) y **Calendario** (disponibilidad de miembro, vista
  semanal 24h, hora actual, color "fuera de casa", calendario público con sincronización).

## Arquitectura y módulos
Rutas en `app/`, agrupadas por layout: `(auth)`, `(dashboard)`, `(main)`, `(public)`.
API en `app/api/` (~40 grupos). Lógica en `lib/`, componentes en `components/`.
Módulos principales:
- **Proyectos/Docs**: projects, modules, sections, public-docs, project-structures.
- **Tickets/Soporte**: tickets, support, incidents, requests.
- **Finanzas**: finance, invoices, proforma, exchange-rates — facturación electrónica SRI
  (`lib/finance.ts`, `lib/finance-pdf.ts`, firma `data/firma.p12`).
- **Calendario**: `app/calendario`, `lib/calendar`, `app/api/calendar` — disponibilidad,
  calendario público compartible.
- **Miembros/Clientes**: members, users, clients, portal (con passkeys).
- **Mundo gamificado (Digimon)**: world, digimundo, sprites, character, marketplace,
  citizens — mapas/NPCs/items/sprites generados con IA (`lib/world`, `lib/sprites`, fal/openai).
- **Agentes/Dev tooling**: agent-links, dev-server, open-vscode, tools — gestión de
  servidores de desarrollo (`data/agent-*.json`, `lib/dev-servers.ts`).

## Decisiones y reglas de negocio
- **BD multi-schema**: toda query (Prisma o `pg` cruda) opera sobre el schema `gcc_world`.
  Al crear tablas nuevas, hacerlo como migración SQL en `sql/migrations/` con numeración correlativa.
- **Facturación = Ecuador / SRI**: firma electrónica con `.p12`; respetar formato XML SRI.
- **Rebuild v2 descartado** (2026-06-07): el usuario confirmó que `main` de este repo es la
  versión correcta y en uso. Se eliminó la rama `origin/rebuild/v2`. El trabajo continúa aquí.

## Lecciones técnicas
- El cliente Prisma vive en `lib/generated/prisma` — importar desde `@/lib/generated/prisma/client`,
  NO desde `@prisma/client`.
- `prisma generate` corre en `postinstall` y en `build`; tras tocar `schema.prisma` regenerar.
- Las tablas que no están en Prisma se creaban con migraciones SQL manuales. Esas migraciones
  (`sql/migrations/`) se **eliminaron el 2026-06-07** (ya aplicadas en prod, no afectan runtime);
  el historial queda en git. Si necesitas el DDL de una tabla, recupéralo de git o de la BD.
- **Carga dinámica en todos lados** (¡cuidado al "limpiar archivos sin uso"!):
  - Assets `public/character/**`, `public/sounds/**`, `public/universal_assets/citizens/**`,
    `public/world/**` se cargan con rutas construidas en runtime (p.ej.
    `\`/character/body/${sheet}/${skin}.png\``). Un grep por nombre NO los encuentra → parecen
    "huérfanos" pero NO lo son.
  - Las rutas `app/api/**` se llaman con URLs dinámicas (`fetch(\`/api/projects/${id}/proforma\`)`).
    Un matcher que normaliza `[id]` da falsos positivos masivos. NO borrar rutas por "sin caller".
  - `data/*.json` son almacenamiento activo (no datos de prueba). NO borrar.
  - Para detectar código muerto real: solo es fiable sobre archivos **importados** (components/lib),
    verificando cada candidato a mano. Ver `Estado actual`.

## Pendientes / preguntas abiertas
- ¿Próximo foco? (último trabajo fue Tickets + Calendario en may-2026).
