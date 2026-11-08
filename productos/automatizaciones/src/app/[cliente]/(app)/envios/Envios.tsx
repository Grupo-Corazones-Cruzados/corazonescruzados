'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { RefreshCw, Send, Users2, AlertTriangle, Phone, Plug } from 'lucide-react';
import { Boton, Campo, Selector, Insignia, Tarjeta, EstadoVacio, Confirmar, Tabla, BOTON_PRIMARIO } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { sincronizar, lanzar } from '@/acciones/envios';
import { fechaHora } from '@/lib/formato';

export type PlantillaVista = {
  id: number; nombre: string; idioma: string; categoria: string; estado: string;
  cuerpo: string; variables: string[]; motivoRechazo: string | null;
};
export type ListaVista = { id: number; nombre: string; conTelefono: number; total: number };
export type EnvioVista = {
  id: number; estado: string; total: number; enviados: number; fallidos: number;
  plantilla: string; lista: string | null; lanzadoPor: string | null; cuando: string; error: string | null;
};

/** Solo una aprobada por Meta sale. El resto se enseña igual, con su motivo. */
const TONO_ESTADO: Record<string, 'exito' | 'aviso' | 'error' | 'neutro'> = {
  APPROVED: 'exito', PENDING: 'aviso', IN_APPEAL: 'aviso', REJECTED: 'error',
  PAUSED: 'aviso', DISABLED: 'error', ausente: 'neutro', local: 'neutro',
};
const ETIQUETA_ESTADO: Record<string, string> = {
  APPROVED: 'Aprobada', PENDING: 'En revisión', IN_APPEAL: 'En apelación', REJECTED: 'Rechazada',
  PAUSED: 'Pausada', DISABLED: 'Deshabilitada', ausente: 'Ya no está en Meta', local: 'Sin sincronizar',
};

export default function Envios({
  slug, numero, hayCanal, plantillas, listas, envios, puedeOperar, puedeConectar,
}: {
  slug: string; numero: string | null; hayCanal: boolean;
  plantillas: PlantillaVista[]; listas: ListaVista[]; envios: EnvioVista[]; puedeOperar: boolean;
  /** Solo un administrador entra a Configuración: a los demás no se les ofrece el enlace. */
  puedeConectar: boolean;
}) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [plantillaId, setPlantillaId] = useState<number | null>(null);
  const [listaId, setListaId] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const plantilla = plantillas.find((p) => p.id === plantillaId) ?? null;
  const lista = listas.find((l) => l.id === listaId) ?? null;
  const aprobadas = plantillas.filter((p) => p.estado === 'APPROVED');
  const listoParaEnviar = Boolean(plantilla?.estado === 'APPROVED' && lista && lista.conTelefono > 0);

  if (!hayCanal) {
    return (
      <>
        <CabeceraPagina titulo="Envíos" />
        <EstadoVacio
          icono={Send}
          titulo="Todavía no hay un número conectado"
          detalle={puedeConectar
            ? 'Los envíos por plantilla salen desde tu número de WhatsApp. Conéctalo en Configuración.'
            : 'Los envíos por plantilla salen desde tu número de WhatsApp. Pide a un administrador que lo conecte.'}
          accion={puedeConectar ? (
            <Link href={`/${slug}/configuracion?seccion=whatsapp`} className={`${BOTON_PRIMARIO} h-9 px-4 text-[13px]`}>
              <Plug className="h-4 w-4" /> Conectar WhatsApp
            </Link>
          ) : undefined}
        />
      </>
    );
  }

  return (
    <>
      {/*
        «Sincronizar con Meta» es SECUNDARIA: trae el estado de las plantillas, no decide nada.
        En el teléfono va dentro del «⋯» y en escritorio como botón con borde. La principal de
        la pantalla —«Enviar»— es el final del formulario de abajo y se queda ahí, junto a la
        vista previa que la justifica. El número es un dato: va en la burbuja (i).
      */}
      <CabeceraPagina
        titulo="Envíos"
        descripcion="WhatsApp solo deja escribir libremente a quien te ha escrito en las últimas 24 horas. Para el resto hacen falta plantillas, y Meta las revisa una a una."
        detalles={numero ? [{ icono: Phone, etiqueta: 'Número que envía', valor: numero, href: `tel:${numero.replace(/[^\d+]/g, '')}` }] : undefined}
        menu={puedeOperar ? [{
          etiqueta: 'Sincronizar con Meta',
          icono: RefreshCw,
          deshabilitado: enCurso,
          alPulsar: () =>
            arranca(async () => {
              const r = await sincronizar(slug);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(r.mensaje ?? 'Sincronizado.');
              router.refresh();
            }),
        }] : undefined}
      />

      {/*
        ⭐ SE APROVECHA EL ANCHO (Fernando, 2026-09-23). Sin `max-w`: en una pantalla de
        escritorio una columna estrecha deja media página en blanco y obliga a desplazarse
        por cosas que cabían de una vez.

        Y desde `xl` las plantillas y el historial van EN PARALELO, que es como se usan:
        se mira qué plantilla está aprobada y, al lado, cómo fue el último envío.
      */}
      <div className="space-y-4 px-4 py-5 sm:px-6">
        {/* ── Lanzar un envío ───────────────────────────────────────────────── */}
        {puedeOperar && (
          <Tarjeta className="p-4 sm:p-5">
            <h2 className="mb-3 text-[14px] font-semibold text-texto">Enviar una plantilla a una lista</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Plantilla">
                <Selector value={plantillaId ?? ''} onChange={(e) => setPlantillaId(Number(e.target.value) || null)}>
                  <option value="">Elige una…</option>
                  {aprobadas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} · {p.idioma}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Lista de contactos">
                <Selector value={listaId ?? ''} onChange={(e) => setListaId(Number(e.target.value) || null)}>
                  <option value="">Elige una…</option>
                  {listas.map((l) => (
                    <option key={l.id} value={l.id}>{l.nombre} · {l.conTelefono} con teléfono</option>
                  ))}
                </Selector>
              </Campo>
            </div>

            {aprobadas.length === 0 && (
              <p className="mt-2 text-[12px] text-aviso">
                No tienes ninguna plantilla aprobada. Sincroniza con Meta o pide una nueva.
              </p>
            )}

            {/* La vista previa es lo que evita el envío equivocado: se lee ANTES lo que
                van a recibir, con las variables marcadas. */}
            {plantilla && (
              <div className="mt-3 rounded border border-borde bg-realce px-3 py-2.5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">Lo que recibirán</p>
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-texto">{plantilla.cuerpo}</p>
                {plantilla.variables.length > 0 && (
                  <p className="mt-1.5 text-[11.5px] text-tenue">Variables: {plantilla.variables.join(', ')}</p>
                )}
              </div>
            )}

            {lista && lista.conTelefono === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-error">
                <AlertTriangle className="h-3.5 w-3.5" /> «{lista.nombre}» no tiene ningún contacto con teléfono.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <Boton disabled={!listoParaEnviar || enCurso} onClick={() => setConfirmar(true)}>
                <Send className="h-4 w-4" />
                {lista ? `Enviar a ${lista.conTelefono}` : 'Enviar'}
              </Boton>
            </div>
          </Tarjeta>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
        {/* ── Las plantillas y su estado: TABLA con recuento al pie ─────────────── */}
        <Tarjeta className="overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 text-[14px] font-semibold text-texto">Tus plantillas</h2>
          <Tabla
            filas={plantillas}
            claveFila={(p) => p.id}
            recuento={`${plantillas.length} ${plantillas.length === 1 ? 'plantilla' : 'plantillas'} · ${aprobadas.length} ${aprobadas.length === 1 ? 'aprobada' : 'aprobadas'}`}
            vacio={<EstadoVacio titulo="Todavía no hay ninguna plantilla" detalle="Pulsa «Sincronizar con Meta» para traerlas." />}
            columnas={[
              { clave: 'nombre', titulo: 'Plantilla', ancho: '42%', render: (p) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-texto">{p.nombre}</p>
                  <p className="truncate text-[11.5px] text-tenue" title={p.cuerpo}>{p.cuerpo}</p>
                  {p.motivoRechazo && <p className="mt-0.5 text-[11.5px] text-error">Meta dice: {p.motivoRechazo}</p>}
                </div>
              ) },
              { clave: 'idioma', titulo: 'Idioma', ancho: '14%', render: (p) => p.idioma },
              { clave: 'categoria', titulo: 'Categoría', ancho: '20%', render: (p) => <span className="truncate">{p.categoria}</span> },
              { clave: 'estado', titulo: 'Estado', ancho: '24%', render: (p) => (
                <Insignia tono={TONO_ESTADO[p.estado] ?? 'neutro'}>{ETIQUETA_ESTADO[p.estado] ?? p.estado}</Insignia>
              ) },
            ]}
          />
        </Tarjeta>

        {/* ── Historial ─────────────────────────────────────────────────────── */}
        {envios.length > 0 && (
          <Tarjeta className="overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 text-[14px] font-semibold text-texto">Envíos anteriores</h2>
            <Tabla
              filas={envios}
              claveFila={(e) => e.id}
              recuento={`${envios.length} ${envios.length === 1 ? 'envío' : 'envíos'}`}
              columnas={[
                { clave: 'plantilla', titulo: 'Envío', ancho: '40%', render: (e) => (
                  <div className="min-w-0">
                    <p className="truncate text-texto">{e.plantilla}{e.lista ? <span className="text-tenue"> → {e.lista}</span> : null}</p>
                    {e.error && <p className="text-[11.5px] text-error">{e.error}</p>}
                  </div>
                ) },
                { clave: 'cuando', titulo: 'Cuándo', ancho: '30%', render: (e) => (
                  <span className="text-tenue">
                    {fechaHora(e.cuando)}
                    {e.lanzadoPor ? ` · ${e.lanzadoPor}` : ''}
                  </span>
                ) },
                { clave: 'resultado', titulo: 'Resultado', ancho: '30%', render: (e) => (
                  <span className="flex flex-wrap items-center gap-x-3">
                    <Insignia tono="exito">{e.enviados} enviados</Insignia>
                    {e.fallidos > 0 && <Insignia tono="error">{e.fallidos} fallaron</Insignia>}
                  </span>
                ) },
              ]}
            />
          </Tarjeta>
        )}
        </div>

        {listas.length === 0 && (
          <p className="flex items-center gap-2 rounded border border-borde bg-realce px-3 py-2.5 text-[12.5px] text-tenue">
            <Users2 className="h-4 w-4 shrink-0" />
            Todavía no tienes listas de contactos. GCC te las prepara, o se llenan solas con el
            enlace para apuntarse.
          </p>
        )}
      </div>

      <Confirmar
        abierto={confirmar}
        alCerrar={() => setConfirmar(false)}
        titulo={`¿Enviar «${plantilla?.nombre}» a ${lista?.conTelefono} contactos?`}
        mensaje="Son mensajes de WhatsApp de verdad y no se pueden deshacer. Sale uno detrás de otro para no degradar tu número."
        textoAceptar="Enviar ahora"
        ocupado={enCurso}
        alAceptar={() =>
          arranca(async () => {
            if (!plantillaId || !listaId) return;
            const r = await lanzar(slug, plantillaId, listaId);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(r.mensaje ?? 'Enviado.');
            setConfirmar(false);
            router.refresh();
          })
        }
      />
    </>
  );
}
