import { notFound } from 'next/navigation';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cargarServicios } from '@/lib/servicios-db';
import { fechaCorta, fechaLarga, hoyEn } from '@/lib/fechas';
import { ETIQUETA_COMIDA, ETIQUETA_DIA, ETIQUETA_GENERO, ETIQUETA_ACTIVIDAD, RESTRICCIONES_DESPACHO, ETIQUETA_ESTADO_CLIENTE } from '@/lib/catalogo';
import { ETIQUETA_SITUACION } from '@/lib/servicios';
import BotonImprimir from '@/componentes/BotonImprimir';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ficha del cliente' };

/**
 * La ficha para imprimir. Es una página normal con estilos de impresión: el
 * navegador hace el PDF, que es lo que hacía el proyecto de referencia con una
 * librería de 470 líneas.
 */
export default async function PaginaFichaImprimible({ params }: { params: Promise<{ negocio: string; id: string }> }) {
  const { negocio, id } = await params;
  const { inquilino } = await exigirContexto(negocio, 'clientes');
  const c = await prisma.cliente.findFirst({
    where: { id: Number(id), inquilinoId: inquilino.id },
    include: { motorizado: true, motorizado2: true, restricciones: { include: { alimento: true } } },
  });
  if (!c) notFound();
  const servicios = await cargarServicios(inquilino, { clienteId: c.id });
  const vigente = servicios.find((s) => s.estado !== 'VENCIDO');

  const Fila = ({ e, v }: { e: string; v: React.ReactNode }) => (
    <div className="flex gap-3 py-1 text-[12px]">
      <dt className="w-36 shrink-0 text-tenue">{e}</dt>
      <dd className="min-w-0 flex-1 font-medium">{v || '—'}</dd>
    </div>
  );
  const Bloque = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
    <section className="break-inside-avoid rounded border border-borde p-4">
      <h2 className="mb-2 border-b border-borde pb-1 text-[12px] font-semibold uppercase tracking-wide text-tenue">{titulo}</h2>
      <dl>{children}</dl>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl p-6 print:max-w-none print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-[12px] text-tenue">Vista para imprimir. Con «Guardar como PDF» del navegador queda el archivo.</p>
        <BotonImprimir />
      </div>
      <header className="mb-4 flex items-end justify-between border-b-2 border-texto pb-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-tenue">{inquilino.nombre}</p>
          <h1 className="text-[22px] font-semibold">{c.nombre}</h1>
          <p className="text-[12px] text-tenue">{c.email} · {c.celular} · {ETIQUETA_ESTADO_CLIENTE[c.estado]}</p>
        </div>
        <p className="text-[11px] text-tenue">Ficha del cliente · {fechaLarga(hoyEn(inquilino.zonaHoraria))}</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Bloque titulo="Datos personales">
          <Fila e="Edad" v={c.edad} />
          <Fila e="Género" v={c.genero && ETIQUETA_GENERO[c.genero]} />
          <Fila e="Altura / peso" v={[c.altura && `${c.altura} m`, c.peso && `${c.peso} kg`].filter(Boolean).join(' · ')} />
          <Fila e="Actividad" v={c.frecuenciaActividad && ETIQUETA_ACTIVIDAD[c.frecuenciaActividad]} />
          <Fila e="Redes" v={[c.instagram, c.facebook, c.tiktok].filter(Boolean).join(' · ')} />
          <Fila e="Comidas" v={c.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(', ')} />
        </Bloque>
        <Bloque titulo="Servicio vigente">
          {vigente ? (
            <>
              <Fila e="Estado" v={ETIQUETA_SITUACION[vigente.resumen.situacion]} />
              <Fila e="Días" v={`${vigente.resumen.diasConsumidos} consumidos de ${vigente.diasTotales} · ${vigente.resumen.diasRestantes} restantes`} />
              <Fila e="Desde / hasta" v={`${fechaCorta(vigente.fechaInicio)} → ${fechaCorta(vigente.resumen.fechaFin)}`} />
              <Fila e="Comidas" v={vigente.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(', ')} />
              <Fila e="Días de la semana" v={vigente.diasSemana.map((d) => ETIQUETA_DIA[d]).join(', ')} />
              <Fila e="Cancelaciones" v={`${vigente.resumen.cancelacionesUsadas} de ${vigente.resumen.maxCancelaciones}`} />
            </>
          ) : (
            <p className="text-[12px] text-tenue">Sin servicio vigente.</p>
          )}
        </Bloque>
        <Bloque titulo="Dirección 1">
          <Fila e="Dirección" v={c.direccion} />
          <Fila e="Edificio / piso" v={[c.edificio, c.piso].filter(Boolean).join(' · ')} />
          <Fila e="Referencias" v={c.referencias} />
          <Fila e="Motorizado" v={c.motorizado?.nombre} />
          <Fila e="Color" v={c.colorIdentificador && <span className="inline-flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full border" style={{ background: c.colorIdentificador }} />{c.colorIdentificador}</span>} />
        </Bloque>
        <Bloque titulo="Dirección 2">
          {c.direccion2 ? (
            <>
              <Fila e="Dirección" v={c.direccion2} />
              <Fila e="Edificio / piso" v={[c.edificio2, c.piso2].filter(Boolean).join(' · ')} />
              <Fila e="Referencias" v={c.referencias2} />
              <Fila e="Días" v={c.diasDireccion2.map((d) => ETIQUETA_DIA[d]).join(', ')} />
              <Fila e="Motorizado" v={c.motorizado2?.nombre} />
            </>
          ) : (
            <p className="text-[12px] text-tenue">No tiene.</p>
          )}
        </Bloque>
        <Bloque titulo="Restricciones de despacho">
          <p className="text-[12px]">{RESTRICCIONES_DESPACHO.filter(([k]) => c[k]).map(([, e]) => e).join(', ') || 'Ninguna (estándar)'}</p>
        </Bloque>
        <Bloque titulo="Restricciones de cocina">
          {c.restricciones.length ? (
            <ul className="text-[12px]">
              {c.restricciones.map((r) => (
                <li key={r.id} className="py-0.5">
                  <strong>Sin {r.alimento.nombre.toLowerCase()}</strong>
                  {r.tiposComida.length > 0 && <span className="text-tenue"> · solo en {r.tiposComida.map((t) => ETIQUETA_COMIDA[t].toLowerCase()).join(', ')}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-tenue">Ninguna.</p>
          )}
        </Bloque>
      </div>
      <p className="mt-6 text-[10px] text-tenue">Gestión de Catering · un producto del Grupo Corazones Cruzados</p>
    </div>
  );
}
