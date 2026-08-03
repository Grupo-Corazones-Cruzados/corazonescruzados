-- ─────────────────────────────────────────────────────────────────────────────
-- DE QUIÉN ES CADA FLUJO: UN RESPONSABLE DENTRO DE GCC + LOS CLIENTES QUE LO VEN
--
-- ── EL AGUJERO QUE CIERRA ─────────────────────────────────────────────────────
-- Hasta hoy `GET /api/admin/flows` devolvía TODOS los flujos a cualquier usuario con
-- sesión, y las rutas de detalle solo comprobaban que hubiera sesión — ninguna miraba de
-- quién era el flujo. Con un solo cliente no se notaba. Con dos, el cliente A entra en la
-- bandeja del cliente B y lee sus conversaciones de WhatsApp.
--
-- Salió a la luz al preparar la cuenta que va a usar el revisor de Meta: tiene que ver el
-- flujo `lfgonzalezm0` y NADA más. No se le puede entregar a Meta una cuenta desde la que
-- se leen las conversaciones de Peters Tours.
--
-- ── POR QUÉ DOS COSAS DISTINTAS Y NO UNA ──────────────────────────────────────
-- · **Responsable** (`responsable_user_id`): quién LLEVA el flujo dentro de GCC. Es uno.
--   Responde por él, y es quien lo ve en su lista de trabajo.
-- · **Clientes** (`flow_clients`): a quién PERTENECE lo que el flujo gestiona. Pueden ser
--   varios —una empresa con dos cuentas, un cliente y su agencia, un cliente y el revisor
--   de Meta—, y por eso es tabla y no columna. Decisión de Fernando, 2026-08-03.
--
-- Un flujo **sin clientes** es interno de GCC: solo lo ven administradores y su
-- responsable. Es el valor por defecto a propósito — al aplicar esta migración ningún
-- flujo existente se le abre a nadie por accidente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gcc_world.flows
  ADD COLUMN IF NOT EXISTS responsable_user_id UUID REFERENCES gcc_world.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS flows_responsable_idx ON gcc_world.flows (responsable_user_id);

COMMENT ON COLUMN gcc_world.flows.responsable_user_id IS
  'Quién lleva el flujo dentro de GCC. Distinto de los clientes, que son a quién pertenece lo gestionado.';

CREATE TABLE IF NOT EXISTS gcc_world.flow_clients (
  flow_id    INT    NOT NULL REFERENCES gcc_world.flows(id)   ON DELETE CASCADE,
  client_id  BIGINT NOT NULL REFERENCES gcc_world.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (flow_id, client_id)
);

-- Para responder «¿qué flujos ve este cliente?» sin recorrer la tabla entera: la clave
-- primaria ya sirve para el sentido flujo → clientes, pero no para el inverso, que es el
-- que se pregunta en cada carga de la lista.
CREATE INDEX IF NOT EXISTS flow_clients_client_idx ON gcc_world.flow_clients (client_id);

COMMENT ON TABLE gcc_world.flow_clients IS
  'Qué clientes ven cada flujo. Sin filas = flujo interno de GCC.';

-- Los flujos existentes los creó Fernando: queda como responsable de todos. Sin clientes,
-- o sea internos, hasta que se asignen a mano — que es lo correcto: abrirlos requiere una
-- decisión, no un valor por defecto.
UPDATE gcc_world.flows
   SET responsable_user_id = (SELECT id FROM gcc_world.users WHERE email = 'lfgonzalezm0@outlook.com')
 WHERE responsable_user_id IS NULL;
