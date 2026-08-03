-- ─────────────────────────────────────────────────────────────────────────────
-- QUÉ LISTAS USA CADA PLANTILLA
--
-- Es el mismo modelo que ya tiene el correo masivo entre campañas y listas, y por la misma
-- razón: **una lista sirve para varias plantillas y una plantilla se manda a varias
-- listas**. Atarlas una a una obligaría a duplicar los contactos cada vez que se quiere
-- mandar otra cosa a la misma gente.
--
-- La casilla de cada lista, en la columna del medio, escribe y borra filas de aquí.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gcc_world.agente_plantilla_listas (
  plantilla_id INT NOT NULL REFERENCES gcc_world.agente_plantillas(id) ON DELETE CASCADE,
  lista_id     INT NOT NULL REFERENCES gcc_world.flow_contact_lists(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plantilla_id, lista_id)
);

CREATE INDEX IF NOT EXISTS agente_plantilla_listas_lista_idx
  ON gcc_world.agente_plantilla_listas (lista_id);

COMMENT ON TABLE gcc_world.agente_plantilla_listas IS
  'Listas de contactos asociadas a cada plantilla. Igual que flow_campaign_lists en el correo masivo.';
