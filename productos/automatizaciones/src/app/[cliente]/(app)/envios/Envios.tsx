'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw, Send, Users2, AlertTriangle } from 'lucide-react';
import { Boton, Campo, Selector, Insignia, Tarjeta, EstadoVacio, Confirmar } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { sincronizar, lanzar } from '@/acciones/envios';

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
  slug, numero, hayCanal, plantillas, listas, envios, puedeOperar,
}: {
  slug: string; numero: string | null; hayCanal: boolean;
  plantillas: PlantillaVista[]; listas: ListaVista[]; envios: EnvioVista[]; puedeOperar: boolean;
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
          detalle="Los envíos por plantilla salen desde tu número de WhatsApp. Cuando GCC lo conecte, aparecerán aquí."
        />
      </>
    );
  }

  return (
    <>
      <CabeceraPagina
        titulo="Envíos"
        descripcion={numero ?? undefined}
        acciones={
          puedeOperar && (
            <Boton
              variante="secundario"
              disabled={enCurso}
              onClick={() =>
                arranca(async () => {
                  const r = await sincronizar(slug);
                  if (!r.ok) { toast.error(r.error); return; }
                  toast.success(r.mensaje ?? 'Sincronizado.');
                  router.refresh();
                })
              }
            >
              <RefreshCw className="h-4 w-4" /> Sincronizar con Meta
            </Boton>
          )
        }
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
            <h2 className="text-[14px] font-semibold text-texto">Enviar una plantilla a una lista</h2>
            <p className="mb-3 text-[12px] leading-relaxed text-tenue">
              WhatsApp solo deja escribir libremente a quien te ha escrito en las últimas 24 horas.
              Para el resto hacen falta plantillas, y Meta las revisa una a una.
            </p>

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
                  <p className="mt-1.5 text-[11.5px] text-tenue">
                    Las variables se rellenan con: {plantilla.variables.join(', ')}. A quien le falte el dato le
                    llega un guion.
                  </p>
                )}
              </div>
            )}

            {lista && lista.conTelefono === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-error">
                <AlertTriangle className="h-3.5 w-3.5" /> «{lista.nombre}» no tiene ningún contacto con teléfono.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {listoParaEnviar && (
                <span className="text-[11.5px] text-tenue">Sale uno detrás de otro, no se puede deshacer.</span>
              )}
              <Boton disabled={!listoParaEnviar || enCurso} onClick={() => setConfirmar(true)}>
                <Send className="h-4 w-4" />
                {lista ? `Enviar a ${lista.conTelefono}` : 'Enviar'}
              </Boton>
            </div>
          </Tarjeta>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
        {/* ── Las plantillas y su estado ────────────────────────────────────── */}
        <Tarjeta className="p-4 sm:p-5">
          <h2 className="mb-2 text-[14px] font-semibold text-texto">Tus plantillas</h2>
          {plantillas.length === 0 ? (
            <p className="rounded border border-borde bg-realce px-3 py-6 text-center text-[13px] text-tenue">
              Todavía no hay ninguna. Pulsa «Sincronizar con Meta» para traerlas.
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {plantillas.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-texto">
                      {p.nombre} <span className="font-normal text-tenue">· {p.idioma} · {p.categoria}</span>
                    </p>
                    <p className="truncate text-[11.5px] text-tenue">{p.cuerpo.slice(0, 90)}</p>
                    {p.motivoRechazo && (
                      <p className="mt-0.5 text-[11.5px] text-error">Meta dice: {p.motivoRechazo}</p>
                    )}
                  </div>
                  <Insignia tono={TONO_ESTADO[p.estado] ?? 'neutro'}>
                    {ETIQUETA_ESTADO[p.estado] ?? p.estado}
                  </Insignia>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {/* ── Historial ─────────────────────────────────────────────────────── */}
        {envios.length > 0 && (
          <Tarjeta className="p-4 sm:p-5">
            <h2 className="mb-2 text-[14px] font-semibold text-texto">Envíos anteriores</h2>
            <ul className="divide-y divide-borde">
              {envios.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-texto">
                      {e.plantilla}
                      {e.lista ? <span className="text-tenue"> → {e.lista}</span> : null}
                    </p>
                    <p className="truncate text-[11.5px] text-tenue">
                      {new Date(e.cuando).toLocaleString('es-EC')}
                      {e.lanzadoPor ? ` · ${e.lanzadoPor}` : ''}
                    </p>
                    {e.error && <p className="text-[11.5px] text-error">{e.error}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Insignia tono="exito">{e.enviados} enviados</Insignia>
                    {e.fallidos > 0 && <Insignia tono="error">{e.fallidos} fallaron</Insignia>}
                  </div>
                </li>
              ))}
            </ul>
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
