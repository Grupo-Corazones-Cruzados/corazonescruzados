'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Users, UserPlus, Clock, Copy, Save } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Buscador, Tabla, Insignia, Tarjeta, SelectorEstado, PanelLateral, PieAcciones, Campo, Entrada, EstadoVacio, Ventanita } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { CamposCliente, CLIENTE_VACIO } from '@/componentes/FormularioCliente';
import { ETIQUETA_ESTADO_CLIENTE, TONO_ESTADO_CLIENTE } from '@/lib/catalogo';
import { ETIQUETA_SITUACION, TONO_SITUACION, type ResumenServicio } from '@/lib/servicios';
import { fechaCorta } from '@/lib/fechas';
import { crearCliente } from '@/acciones/clientes';
import type { EstadoCliente, TipoComida } from '@/generated/prisma/enums';

export type ClienteFila = {
  id: number;
  nombre: string;
  email: string;
  celular: string;
  estado: EstadoCliente;
  direccion: string;
  motorizado: string | null;
  restricciones: number;
  creado: string;
  servicio: { situacion: ResumenServicio['situacion']; diasRestantes: number; diasTotales: number; fechaFin: string } | null;
};

const FILTROS = ['TODOS', 'PENDIENTE', 'ACTIVO', 'POR_VENCER', 'SIN_SERVICIO', 'INACTIVO', 'RECHAZADO'] as const;
type Filtro = (typeof FILTROS)[number];

export default function ClientesCliente({
  slug,
  filas,
  filtroInicial,
  comidas,
  motorizados,
}: {
  slug: string;
  filas: ClienteFila[];
  filtroInicial: string;
  comidas: TipoComida[];
  motorizados: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>((FILTROS as readonly string[]).includes(filtroInicial) ? (filtroInicial as Filtro) : 'TODOS');
  const [busca, setBusca] = useState('');
  const [alta, setAlta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claveNueva, setClaveNueva] = useState<{ email: string; clave: string } | null>(null);
  const [enCurso, arranca] = useTransition();

  const conteo = (f: Filtro) => filas.filter((c) => pasa(c, f)).length;
  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filas.filter((c) => pasa(c, filtro) && (!q || `${c.nombre} ${c.email} ${c.celular} ${c.direccion}`.toLowerCase().includes(q)));
  }, [filas, filtro, busca]);

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPagina
        titulo="Clientes"
        acciones={<Boton icono={UserPlus} onClick={() => { setError(null); setAlta(true); }}>Nuevo cliente</Boton>}
      />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <SelectorEstado
            etiqueta="Ver"
            className="w-full lg:w-auto lg:min-w-0"
            activo={filtro}
            alElegir={(v) => setFiltro(v as Filtro)}
            opciones={[
              { valor: 'TODOS', etiqueta: 'Todos', icono: Users, conteo: filas.length },
              { valor: 'PENDIENTE', etiqueta: 'Por aprobar', conteo: conteo('PENDIENTE') },
              { valor: 'ACTIVO', etiqueta: 'Activos', conteo: conteo('ACTIVO') },
              { valor: 'POR_VENCER', etiqueta: 'Por vencer', icono: Clock, conteo: conteo('POR_VENCER'), pista: '5 días o menos' },
              { valor: 'SIN_SERVICIO', etiqueta: 'Activos sin servicio', conteo: conteo('SIN_SERVICIO') },
              { valor: 'INACTIVO', etiqueta: 'Inactivos', conteo: conteo('INACTIVO') },
              { valor: 'RECHAZADO', etiqueta: 'Rechazados', conteo: conteo('RECHAZADO') },
            ]}
          />
          <Buscador valor={busca} alCambiar={setBusca} marcador="Nombre, correo, celular o dirección…" className="w-full lg:w-72 lg:shrink-0" />
        </div>
        {/* La tarjeta de la lista llega hasta el pie (regla 2026-11-08). */}
        <Tarjeta className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Tabla
              filas={visibles}
              claveFila={(c) => c.id}
              alPulsarFila={(c) => router.push(`/${slug}/clientes/${c.id}`)}
              recuento={`${visibles.length === filas.length ? filas.length : `${visibles.length} de ${filas.length}`} ${filas.length === 1 ? 'cliente' : 'clientes'}`}
              vacio={<div className="flex flex-1 items-center justify-center"><EstadoVacio icono={Users} titulo="Sin clientes" /></div>}
              columnas={[
                {
                  clave: 'nombre', titulo: 'Cliente',
                  render: (c) => (
                    // Sin el punto del color identificador (Fernando, 2026-10-22): solo lo tienen
                    // algunos clientes y descuadraba los nombres. El color sirve en la etiqueta, la
                    // ruta y la ficha, no en la lista.
                    <span>
                      <span className="block font-semibold text-texto">{c.nombre}</span>
                      <span className="block text-[11px] text-tenue">{c.email} · {c.celular}</span>
                    </span>
                  ),
                },
                { clave: 'estado', titulo: 'Estado', render: (c) => <Insignia tono={TONO_ESTADO_CLIENTE[c.estado]}>{ETIQUETA_ESTADO_CLIENTE[c.estado]}</Insignia> },
                {
                  clave: 'servicio', titulo: 'Servicio',
                  render: (c) => c.servicio ? (
                    <span className="flex items-center gap-2">
                      <Insignia tono={TONO_SITUACION[c.servicio.situacion]}>{ETIQUETA_SITUACION[c.servicio.situacion]}</Insignia>
                      <span className="text-[12px] text-tenue">{c.servicio.diasRestantes} de {c.servicio.diasTotales} · hasta {fechaCorta(c.servicio.fechaFin)}</span>
                    </span>
                  ) : <span className="text-[12px] text-tenue">—</span>,
                },
                { clave: 'motorizado', titulo: 'Motorizado', render: (c) => c.motorizado ?? <span className="text-tenue">—</span> },
                { clave: 'restricciones', titulo: 'Restr.', alinear: 'der', render: (c) => (c.restricciones ? <Insignia tono="aviso">{c.restricciones}</Insignia> : <span className="text-tenue">0</span>) },
                { clave: 'creado', titulo: 'Registro', render: (c) => <span className="text-tenue">{fechaCorta(new Date(c.creado))}</span> },
              ]}
            />
        </Tarjeta>
      </div>

      <PanelLateral
        abierto={alta}
        alCerrar={() => setAlta(false)}
        titulo="Nuevo cliente"
        ancho="lg"
        pie={
          <PieAcciones>
            <Boton variante="secundario" onClick={() => setAlta(false)} disabled={enCurso}>Cancelar</Boton>
            <Boton type="submit" form="form-alta-cliente" icono={Save} disabled={enCurso}>{enCurso ? 'Creando…' : 'Crear'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-alta-cliente"
          action={(d) => arranca(async () => {
            setError(null);
            const r = await crearCliente(slug, d);
            if (!r.ok) return setError(r.error);
            setAlta(false);
            toast.success('Creado.');
            if (r.clave) setClaveNueva({ email: String(d.get('email')), clave: r.clave });
            else router.push(`/${slug}/clientes/${r.id}`);
            router.refresh();
          })}
          className="space-y-6"
        >
          <section className="space-y-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Acceso al portal</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Correo" requerido><Entrada name="email" type="email" required autoFocus /></Campo>
              <Campo etiqueta="Contraseña"><Entrada name="clave" type="text" placeholder="Se genera sola" minLength={8} /></Campo>
            </div>
          </section>
          <CamposCliente datos={CLIENTE_VACIO} comidas={comidas} motorizados={motorizados} />
          {error && <Aviso texto={error} />}
        </form>
      </PanelLateral>

      <Ventanita abierto={claveNueva !== null} alCerrar={() => setClaveNueva(null)} titulo="Contraseña generada"
        pie={<Boton onClick={() => setClaveNueva(null)}>Entendido</Boton>}>
        <p className="text-[13px] text-tenue">Se enseña una sola vez.</p>
        <div className="mt-3 flex items-center gap-2 rounded border border-borde bg-realce px-3 py-2 font-mono text-[13px]">
          <span className="min-w-0 flex-1 truncate">{claveNueva?.email} · {claveNueva?.clave}</span>
          <button type="button" className="text-tenue hover:text-texto" title="Copiar" onClick={() => { navigator.clipboard.writeText(claveNueva?.clave ?? ''); toast.success('Copiada.'); }}>
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </Ventanita>
    </div>
  );
}

function pasa(c: ClienteFila, f: Filtro) {
  switch (f) {
    case 'TODOS': return true;
    case 'POR_VENCER': return !!c.servicio && c.servicio.diasRestantes > 0 && c.servicio.diasRestantes <= 5 && c.servicio.situacion !== 'VENCIDO';
    case 'SIN_SERVICIO': return c.estado === 'ACTIVO' && !c.servicio;
    default: return c.estado === f;
  }
}
