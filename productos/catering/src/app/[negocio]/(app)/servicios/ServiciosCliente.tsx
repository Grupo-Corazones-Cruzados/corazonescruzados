'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Package, Plus, Clock } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Buscador, Tabla, Insignia, Tarjeta, RailFiltro, PanelLateral, Campo, Selector, EstadoVacio } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { CamposServicio } from '@/componentes/FormularioServicio';
import { ETIQUETA_COMIDA, DIA_CORTO } from '@/lib/catalogo';
import { ETIQUETA_SITUACION, TONO_SITUACION, type ResumenServicio } from '@/lib/servicios';
import { fechaCorta } from '@/lib/fechas';
import { crearServicio } from '@/acciones/servicios';
import type { EstadoServicio, TipoComida, DiaSemana } from '@/generated/prisma/enums';

export type ServicioFila = {
  id: number;
  clienteId: number;
  cliente: string;
  celular: string;
  motorizado: string | null;
  estado: EstadoServicio;
  diasTotales: number;
  fechaInicio: string;
  tiposComida: TipoComida[];
  diasSemana: DiaSemana[];
  renovaciones: number;
  resumen: ResumenServicio;
};

const FILTROS = ['vigentes', 'por-vencer', 'suspendidos', 'vencidos', 'todos'] as const;
type Filtro = (typeof FILTROS)[number];

export default function ServiciosCliente({
  slug, hoy, filas, filtroInicial, comidas, diasNegocio, porcentajeDefecto, sinServicio,
}: {
  slug: string;
  hoy: string;
  filas: ServicioFila[];
  filtroInicial: string;
  comidas: TipoComida[];
  diasNegocio: DiaSemana[];
  porcentajeDefecto: number;
  sinServicio: { id: number; nombre: string; tiposComida: TipoComida[] }[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>((FILTROS as readonly string[]).includes(filtroInicial) ? (filtroInicial as Filtro) : 'vigentes');
  const [busca, setBusca] = useState('');
  const [alta, setAlta] = useState(false);
  const [clienteId, setClienteId] = useState<number>(sinServicio[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const pasa = (s: ServicioFila, f: Filtro) =>
    f === 'todos' ? true
      : f === 'vigentes' ? s.estado !== 'VENCIDO'
        : f === 'por-vencer' ? s.estado === 'ACTIVO' && s.resumen.diasRestantes > 0 && s.resumen.diasRestantes <= 5
          : f === 'suspendidos' ? s.estado === 'SUSPENDIDO'
            : s.estado === 'VENCIDO';
  const conteo = (f: Filtro) => filas.filter((s) => pasa(s, f)).length;
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas
      .filter((s) => pasa(s, filtro) && (!q || `${s.cliente} ${s.celular}`.toLowerCase().includes(q)))
      .sort((a, b) => (filtro === 'por-vencer' ? a.resumen.fechaFin.localeCompare(b.resumen.fechaFin) : a.cliente.localeCompare(b.cliente)));
  }, [filas, filtro, busca]);

  const elegido = sinServicio.find((c) => c.id === clienteId);

  return (
    <>
      <CabeceraPagina
        titulo="Servicios"
        descripcion={`${conteo('vigentes')} vigentes · ${conteo('por-vencer')} por vencer`}
        acciones={<Boton icono={Plus} onClick={() => { setError(null); setAlta(true); }} disabled={!sinServicio.length} title={sinServicio.length ? undefined : 'Todos los clientes activos ya tienen servicio'}>Nuevo servicio</Boton>}
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          titulo="Ver"
          activo={filtro}
          alElegir={(v) => setFiltro(v as Filtro)}
          opciones={[
            { valor: 'vigentes', etiqueta: 'Vigentes', icono: Package, conteo: conteo('vigentes') },
            { valor: 'por-vencer', etiqueta: 'Por vencer', icono: Clock, conteo: conteo('por-vencer'), pista: '5 días o menos' },
            { valor: 'suspendidos', etiqueta: 'Suspendidos', conteo: conteo('suspendidos') },
            { valor: 'vencidos', etiqueta: 'Vencidos', conteo: conteo('vencidos') },
            { valor: 'todos', etiqueta: 'Todos', conteo: filas.length },
          ]}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <Buscador valor={busca} alCambiar={setBusca} marcador="Buscar cliente…" className="max-w-md" />
          <Tarjeta className="overflow-hidden">
            <Tabla
              filas={visibles}
              claveFila={(s) => s.id}
              alPulsarFila={(s) => router.push(`/${slug}/clientes/${s.clienteId}`)}
              vacio={<EstadoVacio icono={Package} titulo="No hay servicios aquí" />}
              columnas={[
                { clave: 'cliente', titulo: 'Cliente', render: (s) => <span><span className="block font-semibold text-texto">{s.cliente}</span><span className="block text-[11px] text-tenue">{s.celular}{s.motorizado ? ` · ${s.motorizado}` : ''}</span></span> },
                { clave: 'estado', titulo: 'Estado', render: (s) => <span className="flex items-center gap-1.5"><Insignia tono={TONO_SITUACION[s.resumen.situacion]}>{ETIQUETA_SITUACION[s.resumen.situacion]}</Insignia>{s.renovaciones > 0 && <span className="text-[11px] text-tenue">×{s.renovaciones}</span>}</span> },
                { clave: 'dias', titulo: 'Días', render: (s) => <span><strong>{s.resumen.diasRestantes}</strong> <span className="text-tenue">de {s.diasTotales}</span></span> },
                { clave: 'fin', titulo: 'Termina', render: (s) => <span className={s.resumen.fechaFin < hoy ? 'text-tenue' : ''}>{fechaCorta(s.resumen.fechaFin)}</span> },
                { clave: 'comidas', titulo: 'Comidas', render: (s) => <span className="text-[12px]">{s.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(' + ')}</span> },
                { clave: 'diasSemana', titulo: 'Semana', render: (s) => <span className="font-mono text-[11px] text-tenue">{s.diasSemana.map((d) => DIA_CORTO[d]).join(' ')}</span> },
                { clave: 'canc', titulo: 'Cancel.', alinear: 'der', render: (s) => <span className={s.resumen.cancelacionesUsadas >= s.resumen.maxCancelaciones ? 'font-semibold text-error' : ''}>{s.resumen.cancelacionesUsadas}/{s.resumen.maxCancelaciones}</span> },
              ]}
            />
          </Tarjeta>
        </div>
      </div>

      <PanelLateral
        abierto={alta}
        alCerrar={() => setAlta(false)}
        titulo="Nuevo servicio"
        descripcion="Solo clientes activos sin servicio vigente."
        pie={
          <>
            <Boton variante="secundario" onClick={() => setAlta(false)} disabled={enCurso}>Cancelar</Boton>
            <Boton type="submit" form="form-nuevo-servicio" disabled={enCurso || !elegido}>{enCurso ? 'Guardando…' : 'Crear servicio'}</Boton>
          </>
        }
      >
        <form
          id="form-nuevo-servicio"
          action={(d) => arranca(async () => {
            setError(null);
            const r = await crearServicio(slug, d);
            if (!r.ok) return setError(r.error);
            setAlta(false);
            toast.success('Servicio creado');
            router.refresh();
          })}
          className="space-y-4"
        >
          <Campo etiqueta="Cliente" requerido>
            <Selector name="clienteId" value={clienteId} onChange={(e) => setClienteId(Number(e.target.value))}>
              {sinServicio.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
          </Campo>
          {elegido && (
            <CamposServicio
              key={elegido.id}
              datos={{ diasTotales: 20, fechaInicio: hoy, tiposComida: elegido.tiposComida.filter((t) => comidas.includes(t)), diasSemana: diasNegocio, porcentajeCancelacion: porcentajeDefecto, notas: null }}
              comidas={comidas}
              diasNegocio={diasNegocio}
            />
          )}
          {error && <Aviso texto={error} />}
        </form>
      </PanelLateral>
    </>
  );
}
