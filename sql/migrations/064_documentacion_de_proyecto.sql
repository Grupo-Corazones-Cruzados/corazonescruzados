-- ─────────────────────────────────────────────────────────────────────────────
-- 064 · Admin ▸ «Prompts»: la documentación de cada proyecto (Fernando, 2026-10-01)
-- ─────────────────────────────────────────────────────────────────────────────
-- «una página o entrada de texto va a ser el espacio para escribir todo el contenido que
-- quiera», como en Word. UN documento por proyecto: la fila cuelga de `projects.id`.
--
-- Se guarda dos veces lo mismo, con dos fines:
--   · `content_html` — lo que abre el editor (TipTap) tal cual se dejó, con su formato.
--   · `content_md`   — el mismo texto en Markdown, generado en el servidor al guardar. Es
--                      lo que se copia como prompt o lee un agente: nadie tiene que
--                      convertir nada a mano.
-- `updated_at` es también el control de concurrencia: dos pestañas abiertas sobre el
-- mismo proyecto no se pisan en silencio (el PUT trae la fecha que conoce).
CREATE TABLE IF NOT EXISTS gcc_world.project_prompts (
  project_id   BIGINT PRIMARY KEY REFERENCES gcc_world.projects(id) ON DELETE CASCADE,
  content_html TEXT NOT NULL DEFAULT '',
  content_md   TEXT NOT NULL DEFAULT '',
  char_count   INT  NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT
);
