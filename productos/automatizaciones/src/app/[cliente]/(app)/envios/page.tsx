import { exigirContexto } from '@/lib/inquilino';
import { pool } from '@/lib/db';
import Envios, { type PlantillaVista, type ListaVista, type EnvioVista } from './Envios';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Envíos' };

/**
 * ENVÍOS MASIVOS POR PLANTILLA.
 *
 * WhatsApp no deja escribir a quien no te ha escrito en 24 h: para eso están las
 * plantillas, que Meta revisa una a una. Por eso esta pantalla enseña SIEMPRE el estado de
 * cada una — una en revisión no sale, y saberlo antes de pulsar ahorra el susto.
 */
export default async function PaginaEnvios({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const { inquilino, sesion } = await exigirContexto(cliente);

  const { rows: [canal] } = await pool.query(
    `SELECT id, numero_visible, estado FROM canales WHERE inquilino_id = $1 ORDER BY id LIMIT 1`,
    [inquilino.id],
  );

  const { rows: plantillas } = canal
    ? await pool.query(
        `SELECT id, nombre, idioma, categoria, estado, cuerpo, variables, motivo_rechazo
           FROM plantillas_agente WHERE canal_id = $1 ORDER BY nombre`,
        [canal.id],
      )
    : { rows: [] as any[] };

  const { rows: listas } = await pool.query(
    `SELECT l.id, l.nombre,
            (SELECT COUNT(*)::int FROM contactos_lista c
              WHERE c.lista_id = l.id AND c.telefono IS NOT NULL AND TRIM(c.telefono) <> '') con_telefono,
            (SELECT COUNT(*)::int FROM contactos_lista c WHERE c.lista_id = l.id) total
       FROM listas_contactos l WHERE l.inquilino_id = $1 ORDER BY l.nombre`,
    [inquilino.id],
  );

  const { rows: envios } = await pool.query(
    `SELECT e.id, e.estado, e.total, e.enviados, e.fallidos, e.creado_en, e.error,
            p.nombre plantilla, l.nombre lista, u.nombre lanzado_por
       FROM envios e
       JOIN plantillas_agente p ON p.id = e.plantilla_id
       LEFT JOIN listas_contactos l ON l.id = e.lista_id
       LEFT JOIN usuarios u ON u.id = e.lanzado_por_id
      WHERE e.inquilino_id = $1 ORDER BY e.creado_en DESC LIMIT 20`,
    [inquilino.id],
  );

  return (
    <Envios
      slug={cliente}
      numero={canal?.numero_visible ?? null}
      hayCanal={Boolean(canal)}
      plantillas={plantillas.map((p: any): PlantillaVista => ({
        id: p.id, nombre: p.nombre, idioma: p.idioma, categoria: p.categoria,
        estado: p.estado, cuerpo: p.cuerpo ?? '',
        variables: Array.isArray(p.variables) ? p.variables : [],
        motivoRechazo: p.motivo_rechazo,
      }))}
      listas={listas.map((l: any): ListaVista => ({
        id: l.id, nombre: l.nombre, conTelefono: l.con_telefono, total: l.total,
      }))}
      envios={envios.map((e: any): EnvioVista => ({
        id: e.id, estado: e.estado, total: e.total, enviados: e.enviados, fallidos: e.fallidos,
        plantilla: e.plantilla, lista: e.lista, lanzadoPor: e.lanzado_por,
        cuando: e.creado_en.toISOString(), error: e.error,
      }))}
      puedeOperar={sesion.rol !== 'CONSULTA'}
    />
  );
}
