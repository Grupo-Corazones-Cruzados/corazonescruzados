-- EL PLAN QUEDA DEFINIDO (Fernando, 2026-08-25). Mismo trato que el otro producto:
-- 5 $ al mes, hasta 100 cuentas, sin límite de mesas ni de productos, y un mes de
-- histórico. NULO significa «sin límite», no «cero».

UPDATE "planes"
   SET "nombre"          = 'Estándar',
       "descripcion"     = 'Todo el sistema, sin límite de mesas ni de productos. Se conserva un mes de histórico.',
       "precio_mensual"  = 5,
       "max_usuarios"    = 100,
       "max_mesas"       = NULL,
       "max_productos"   = NULL,
       "meses_retencion" = 1,
       "caracteristicas" = ARRAY[
         'Mesas, zonas y carta sin límite',
         'Hasta 100 cuentas de usuario',
         'Pantalla de cocina y control de estados',
         'Cobro con método de pago e IVA configurable',
         'Reservas de mesa',
         'Reportes con exportación a Excel',
         'Marca propia (nombre, logo, color y tema)',
         'Un mes de histórico: lo anterior se borra a fin de mes'
       ],
       "actualizado_en"  = now()
 WHERE "slug" IN ('esencial', 'estandar');
