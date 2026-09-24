import { exigirContexto } from '@/lib/inquilino';
import { EXIGE_ROL } from '@/lib/modulos';
import { pool } from '@/lib/db';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { EstadoVacio } from '@/componentes/ui';
import { Bot } from 'lucide-react';
import Estudio, { type CanalVista, type Instruccion, type Bloque } from './Estudio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Estudio del agente' };

/**
 * EL ESTUDIO: lo que el agente sabe, cómo habla y cuándo calla.
 *
 * Es ADMIN porque cambiar aquí una línea cambia lo que el agente le dice a cada cliente
 * del negocio. Un operador atiende conversaciones; no reescribe al agente.
 */
export default async function PaginaEstudio({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const { inquilino } = await exigirContexto(cliente, EXIGE_ROL.estudio, 'estudio');

  const { rows: [canal] } = await pool.query(
    `SELECT id, numero_visible, nombre_verificado, estado, bot_activo, coexistencia_verificada,
            modelo, razonamiento, debounce_segundos, ventana_mensajes, ultimo_error, ultimo_error_en
       FROM canales WHERE inquilino_id = $1 ORDER BY id LIMIT 1`,
    [inquilino.id],
  );

  if (!canal) {
    return (
      <>
        <CabeceraPagina titulo="Estudio del agente" />
        <EstadoVacio
          icono={Bot}
          titulo="Todavía no hay un número conectado"
          detalle="Cuando GCC conecte tu número de WhatsApp, aquí podrás editar lo que el agente sabe y cómo responde."
        />
      </>
    );
  }

  const { rows: prompts } = await pool.query(
    `SELECT tipo, contenido, version FROM prompts WHERE canal_id = $1 AND activo`,
    [canal.id],
  );
  const { rows: bloques } = await pool.query(
    `SELECT clave, titulo, contenido, orden, activo FROM conocimiento
      WHERE canal_id = $1 ORDER BY orden, clave`,
    [canal.id],
  );
  const { rows: [versiones] } = await pool.query(
    `SELECT COUNT(*)::int n FROM prompts WHERE canal_id = $1`, [canal.id]);

  const vista: CanalVista = {
    numero: canal.numero_visible,
    nombreVerificado: canal.nombre_verificado,
    estado: canal.estado,
    botActivo: canal.bot_activo,
    coexistencia: canal.coexistencia_verificada,
    modelo: canal.modelo,
    razonamiento: canal.razonamiento,
    debounce: canal.debounce_segundos,
    ventana: canal.ventana_mensajes,
    ultimoError: canal.ultimo_error,
    ultimoErrorEn: canal.ultimo_error_en ? canal.ultimo_error_en.toISOString() : null,
  };

  const instrucciones: Instruccion[] = prompts.map((p: any) => ({
    tipo: p.tipo, contenido: p.contenido ?? '', version: p.version,
  }));

  return (
    <Estudio
      slug={cliente}
      canal={vista}
      instrucciones={instrucciones}
      bloques={bloques as Bloque[]}
      versionesGuardadas={versiones?.n ?? 0}
    />
  );
}
