import { query } from "@/lib/db";

export const CRITERIOS_ENCUADRE = [
  "valor",
  "coraje",
  "pureza",
  "fe",
  "paciencia",
  "seriedad",
  "empatia",
  "espontaneidad",
  "autonomia",
] as const;

export type CriterioEncuadre = (typeof CRITERIOS_ENCUADRE)[number];

export type RolReclutamiento = "admin" | "reclutador" | "cliente";

export interface ReclutamientoAccess {
  rol: RolReclutamiento;
  idMiembro: number | null;
}

export async function getReclutamientoAccess(
  userId: string
): Promise<ReclutamientoAccess> {
  const userResult = await query(
    `SELECT rol, id_miembro FROM user_profiles WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return { rol: "cliente", idMiembro: null };
  }

  const { rol, id_miembro } = userResult.rows[0];

  if (rol === "admin") {
    return { rol: "admin", idMiembro: id_miembro };
  }

  if (rol === "miembro" && id_miembro) {
    // Check if this member is assigned to the reclutamiento system
    const sistemaResult = await query(
      `SELECT ms.id FROM miembros_sistemas ms
       JOIN sistemas s ON ms.id_sistema = s.id
       WHERE ms.id_miembro = $1 AND s.ruta = '/dashboard/proyecto/reclutamiento'`,
      [id_miembro]
    );

    if (sistemaResult.rows.length > 0) {
      return { rol: "reclutador", idMiembro: id_miembro };
    }
  }

  return { rol: "cliente", idMiembro: id_miembro };
}

// Check if a postulacion has an active restriction
export async function getActiveRestriction(postulacionId: number) {
  const result = await query(
    `SELECT * FROM restricciones_reclutamiento
     WHERE id_postulacion = $1 AND levantado = FALSE
       AND (tipo = 'permanente' OR (tipo = 'temporal' AND fecha_expiracion > NOW()))
     ORDER BY created_at DESC LIMIT 1`,
    [postulacionId]
  );
  return result.rows[0] || null;
}

// Check if a user has an active restriction via their postulacion
export async function getUserRestriction(userId: string) {
  const result = await query(
    `SELECT r.* FROM restricciones_reclutamiento r
     JOIN postulaciones p ON r.id_postulacion = p.id
     WHERE p.id_usuario = $1 AND r.levantado = FALSE
       AND (r.tipo = 'permanente' OR (r.tipo = 'temporal' AND r.fecha_expiracion > NOW()))
     ORDER BY r.created_at DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}
