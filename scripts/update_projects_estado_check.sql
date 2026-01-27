-- Update projects estado CHECK constraint to include new states
-- (planificado, and all close states from the extended projects module)

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_estado_check;
ALTER TABLE projects ADD CONSTRAINT projects_estado_check
  CHECK (estado IN (
    'borrador',
    'publicado',
    'planificado',
    'en_progreso',
    'completado',
    'completado_parcial',
    'no_completado',
    'cancelado',
    'cancelado_sin_acuerdo',
    'cancelado_sin_presupuesto',
    'no_pagado',
    'no_completado_por_miembro'
  ));
