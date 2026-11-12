/**
 * Quién sale en la galería pública de miembros (formulario de postulación ▸ Modelo de Grupo): los
 * miembros activos, menos las cuentas de prueba (hoy «Miembro de Prueba»). Lo comparten la lista y la
 * ruta de la foto, para que la foto de alguien que no sale en la galería no se pueda pedir.
 */
export const MIEMBROS_VISIBLES = `
  FROM gcc_world.members m
  LEFT JOIN LATERAL (
    SELECT u.avatar_url FROM gcc_world.users u WHERE u.member_id = m.id ORDER BY u.id LIMIT 1
  ) u ON true
  LEFT JOIN gcc_world.positions p ON p.id = m.position_id
  WHERE m.is_active = true AND m.name !~* '\\mprueba\\M'`;
