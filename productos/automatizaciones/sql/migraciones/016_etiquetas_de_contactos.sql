-- 016 — ETIQUETAS DE LOS CONTACTOS (Fernando, 2026-11-08: «agregar etiquetas a los contactos y que
-- se pueda filtrar a esos contactos por su etiqueta»). Las etiquetas son del NEGOCIO (inquilino) y
-- un contacto lleva las que quiera. El nombre no se repite dentro de un negocio (sin distinguir
-- mayúsculas).

CREATE TABLE IF NOT EXISTS automatizaciones.etiquetas (
  id           serial PRIMARY KEY,
  inquilino_id integer NOT NULL REFERENCES automatizaciones.inquilinos(id) ON DELETE CASCADE,
  nombre       varchar(40) NOT NULL,
  creado_en    timestamptz(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS etiquetas_nombre_unico ON automatizaciones.etiquetas (inquilino_id, lower(nombre));

CREATE TABLE IF NOT EXISTS automatizaciones.contacto_etiquetas (
  contacto_id  integer NOT NULL REFERENCES automatizaciones.contactos(id) ON DELETE CASCADE,
  etiqueta_id  integer NOT NULL REFERENCES automatizaciones.etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (contacto_id, etiqueta_id)
);
CREATE INDEX IF NOT EXISTS contacto_etiquetas_por_etiqueta ON automatizaciones.contacto_etiquetas (etiqueta_id);
