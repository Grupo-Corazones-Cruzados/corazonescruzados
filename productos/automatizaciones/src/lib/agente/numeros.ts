import { pool } from '@/lib/db';

export type NumeroOpcion = { id: number; nombre: string };

/**
 * Los NÚMEROS del inquilino para elegir en Estudio y Envíos (varios desde 2026-11-10), y el
 * elegido por `?numero=`. Un id que no es del inquilino no se encuentra y se cae al primero.
 * Si ninguno tiene número todavía (alta a medias), se devuelve el primer canal como antes.
 */
export async function numerosYElegido(inquilinoId: number, param: string | string[] | undefined) {
  const { rows } = await pool.query<{ id: number; numero_visible: string | null; nombre_verificado: string | null; phone_number_id: string | null }>(
    `SELECT id, numero_visible, nombre_verificado, phone_number_id FROM canales WHERE inquilino_id = $1 ORDER BY id`,
    [inquilinoId],
  );
  const conNumero = rows.filter((r) => r.phone_number_id);
  const lista: NumeroOpcion[] = conNumero.map((r) => ({
    id: r.id,
    nombre: [r.numero_visible, r.nombre_verificado].filter(Boolean).join(' · ') || `Número ${r.id}`,
  }));
  const pedido = Number(Array.isArray(param) ? param[0] : param) || null;
  const elegido = (pedido && conNumero.find((r) => r.id === pedido)?.id) || conNumero[0]?.id || rows[0]?.id || null;
  return { numeros: lista, canalId: elegido };
}
