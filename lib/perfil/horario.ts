import { pool } from '@/lib/db';

/**
 * EL DOMINGO NO SE GUARDABA (2026-11-14). Todo lee `member_schedules.day_of_week` como 1 = lunes … 7 = domingo
 * (Configuración, el CV público), pero la regla de la tabla solo admitía 0…6: el domingo fallaba y, en Configuración,
 * fallaba DESPUÉS de borrar el horario anterior. Se corrige la regla a 1…7 (los datos que hay, 1…6, la cumplen).
 * Una vez por proceso, como el resto de cambios de esquema que se aplican solos.
 */
let preparado: Promise<unknown> | null = null;
export const prepararHorario = () => (preparado ??= pool.query(`
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_schedules_day_of_week_check'
                 AND pg_get_constraintdef(oid) LIKE '%>= 0%') THEN
      ALTER TABLE gcc_world.member_schedules DROP CONSTRAINT member_schedules_day_of_week_check;
      ALTER TABLE gcc_world.member_schedules ADD CONSTRAINT member_schedules_day_of_week_check CHECK (day_of_week BETWEEN 1 AND 7);
    END IF;
  END $$;`).catch((e: unknown) => { preparado = null; throw e; }));
