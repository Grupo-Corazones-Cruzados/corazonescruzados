import { exigirContexto } from '@/lib/inquilino';
import { EXIGE_ROL } from '@/lib/modulos';
import { pool } from '@/lib/db';
import { contextoCanal, descifrarONulo } from '@/lib/agente/cifrado';
import { CabeceraPagina } from '@/componentes/Navegacion';
import Link from 'next/link';
import { BOTON_PRIMARIO, EstadoVacio } from '@/componentes/ui';
import { Bot, Plug } from 'lucide-react';
import { numerosYElegido } from '@/lib/agente/numeros';
import Estudio, { type CanalVista, type Instruccion, type Bloque } from './Estudio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Estudio' };

/**
 * EL ESTUDIO: lo que el agente sabe, cómo habla y cuándo calla.
 *
 * Es ADMIN porque cambiar aquí una línea cambia lo que el agente le dice a cada cliente
 * del negocio. Un operador atiende conversaciones; no reescribe al agente.
 */
export default async function PaginaEstudio({ params, searchParams }: {
  params: Promise<{ cliente: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { cliente } = await params;
  const { inquilino } = await exigirContexto(cliente, EXIGE_ROL.estudio, 'estudio');
  // Cada número tiene su propio agente (2026-11-10): se elige con `?numero=`.
  const { numeros, canalId } = await numerosYElegido(inquilino.id, (await searchParams).numero);

  const { rows: [canal] } = await pool.query(
    `SELECT id, numero_visible, nombre_verificado, estado, bot_activo, coexistencia_verificada,
            modelo, razonamiento, debounce_segundos, ventana_mensajes, retomar_minutos, ultimo_error, ultimo_error_en,
            ia_api_key_cifrada
       FROM canales WHERE inquilino_id = $1 AND id = $2`,
    [inquilino.id, canalId],
  );

  if (!canal) {
    return (
      <>
        <CabeceraPagina titulo="Estudio" />
        <EstadoVacio
          icono={Bot}
          titulo="Sin número conectado"
          detalle="Conecta tu número de WhatsApp para configurar el agente."
          accion={
            <Link href={`/${cliente}/configuracion?seccion=whatsapp`} className={`${BOTON_PRIMARIO} h-9 px-4 text-[13px]`}>
              <Plug className="h-4 w-4" /> Conectar WhatsApp
            </Link>
          }
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

  const vista: CanalVista = {
    id: canal.id,
    numero: canal.numero_visible,
    nombreVerificado: canal.nombre_verificado,
    estado: canal.estado,
    botActivo: canal.bot_activo,
    coexistencia: canal.coexistencia_verificada,
    modelo: canal.modelo,
    razonamiento: canal.razonamiento,
    debounce: canal.debounce_segundos,
    ventana: canal.ventana_mensajes,
    retomarMinutos: canal.retomar_minutos,
    ultimoError: canal.ultimo_error,
    ultimoErrorEn: canal.ultimo_error_en ? canal.ultimo_error_en.toISOString() : null,
    // Solo los cuatro últimos caracteres salen al navegador, para reconocerla.
    claveIAFin: (() => {
      const c = descifrarONulo(canal.ia_api_key_cifrada, contextoCanal(canal.id, 'ia_api_key'));
      return c ? c.slice(-4) : null;
    })(),
  };

  const instrucciones: Instruccion[] = prompts.map((p: any) => ({
    tipo: p.tipo, contenido: p.contenido ?? '', version: p.version,
  }));

  return (
    <Estudio
      slug={cliente}
      canal={vista}
      numeros={numeros}
      instrucciones={instrucciones}
      bloques={bloques as Bloque[]}
    />
  );
}
