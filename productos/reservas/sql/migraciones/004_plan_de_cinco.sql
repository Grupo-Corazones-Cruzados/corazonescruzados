-- EL PLAN QUEDA DEFINIDO (Fernando, 2026-08-25).
--
-- Textual: «los dos productos se ofrecen por suscripción 5 $ para uso, pueden crear
-- hasta máximo 100 usuarios, y no hay límite de suites o de mesas, la única
-- restricción es que se eliminan los datos al fin de mes».
--
-- Así que el precio deja de estar a cero —ya no hay nada que inventar—, el tope de
-- cuentas pasa a 100 y los demás quedan en NULO, que aquí significa «sin límite» y
-- NO «cero».

UPDATE "planes"
   SET "nombre"          = 'Estándar',
       "descripcion"     = 'Todo el sistema, sin límite de ubicaciones ni de suites. Se conserva un mes de histórico.',
       "precio_mensual"  = 5,
       "max_usuarios"    = 100,
       "max_ubicaciones" = NULL,
       "max_suites"      = NULL,
       "meses_retencion" = 1,
       "caracteristicas" = ARRAY[
         'Ubicaciones y suites sin límite',
         'Hasta 100 cuentas de usuario',
         'Agenda, panel de ocupación y reportes',
         'Exportación a Excel',
         'Marca propia (nombre, logo, color y tema)',
         'Un mes de histórico: lo anterior se borra a fin de mes'
       ],
       "actualizado_en"  = now()
 WHERE "slug" = 'estandar';
