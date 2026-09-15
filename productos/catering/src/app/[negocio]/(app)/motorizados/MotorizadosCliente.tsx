'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bike, Plus, Pencil, Trash2 } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Tarjeta, PanelLateral, Confirmar, Campo, Entrada, Selector, EstadoVacio, Insignia, Tabla } from '@/componentes/ui';
import { Aviso, Casilla, Punto } from '@/componentes/campos';
import { guardarMotorizado, eliminarMotorizado, asignarMotorizado } from '@/acciones/despacho';

type Motorizado = { id: number; nombre: string; celular: string | null; color: string | null; activo: boolean };
type Cliente = { id: number; nombre: string; direccion: string; direccion2: string | null; motorizadoId: number | null; motorizado2Id: number | null; colorIdentificador: string | null };

const COLORES = ['#0F6CBD', '#0F7B0F', '#CA5010', '#5C2D91', '#C42B1C', '#008272', '#B4009E', '#1B1A19'];

export default function MotorizadosCliente({ slug, veClientes, motorizados, clientes }: { slug: string; veClientes: boolean; motorizados: Motorizado[]; clientes: Cliente[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Motorizado | 'nuevo' | null>(null);
  const [activo, setActivo] = useState(true);
  const [color, setColor] = useState('#0F6CBD');
  const [borrar, setBorrar] = useState<Motorizado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  const activos = motorizados.filter((m) => m.activo);

  const abrir = (m: Motorizado | 'nuevo') => { setError(null); setActivo(m === 'nuevo' ? true : m.activo); setColor(m === 'nuevo' ? COLORES[motorizados.length % COLORES.length] : m.color ?? '#0F6CBD'); setPanel(m); };
  const asignar = (clienteId: number, cual: 1 | 2, v: string) =>
    arranca(async () => { const r = await asignarMotorizado(slug, clienteId, cual, Number(v) || null); if (!r.ok) { toast.error(r.error); return; } toast.success('Asignado'); router.refresh(); });

  return (
    <>
      <CabeceraPagina titulo="Motorizados" descripcion="Quién reparte, y a quién le lleva" acciones={<Boton icono={Plus} onClick={() => abrir('nuevo')}>Nuevo motorizado</Boton>} />
      <div className="space-y-4 p-4 sm:p-6">
        {motorizados.length === 0 ? (
          <Tarjeta><EstadoVacio icono={Bike} titulo="Sin motorizados" detalle="Crea el primero; su color sale en las etiquetas para separar los paquetes." accion={<Boton icono={Plus} onClick={() => abrir('nuevo')}>Nuevo motorizado</Boton>} /></Tarjeta>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {motorizados.map((m) => {
              const suyos = clientes.filter((c) => c.motorizadoId === m.id || c.motorizado2Id === m.id);
              return (
                <Tarjeta key={m.id} className={`p-4 ${m.activo ? '' : 'opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-borde" style={{ background: m.color ?? 'transparent' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{m.nombre}</p>
                      <p className="text-[12px] text-tenue">{m.celular ?? 'Sin celular'} · {suyos.length} cliente{suyos.length === 1 ? '' : 's'}</p>
                    </div>
                    {!m.activo && <Insignia tono="neutro">Inactivo</Insignia>}
                    <BotonIcono icono={Pencil} titulo="Editar" onClick={() => abrir(m)} />
                    <BotonIcono icono={Trash2} titulo="Eliminar" className="hover:bg-error-suave hover:text-error" onClick={() => setBorrar(m)} />
                  </div>
                </Tarjeta>
              );
            })}
          </div>
        )}

        <Tarjeta className="overflow-hidden">
          <div className="border-b border-borde px-4 py-3">
            <h2 className="text-[14px] font-semibold">Asignación por cliente</h2>
            <p className="text-[12px] text-tenue">Un motorizado por dirección. Los clientes sin motorizado salen en rojo en las rutas.</p>
          </div>
          <Tabla
            filas={clientes}
            claveFila={(c) => c.id}
            vacio={<EstadoVacio titulo="No hay clientes activos" />}
            columnas={[
              { clave: 'nombre', titulo: 'Cliente', render: (c) => <span className="flex items-center gap-2"><Punto color={c.colorIdentificador} />{veClientes ? <Link href={`/${slug}/clientes/${c.id}`} className="font-semibold hover:text-acento">{c.nombre}</Link> : <span className="font-semibold">{c.nombre}</span>}</span> },
              { clave: 'dir1', titulo: 'Dirección 1', render: (c) => <span className="text-[12px] text-tenue">{c.direccion}</span> },
              { clave: 'm1', titulo: 'Motorizado', ancho: '200px', render: (c) => (
                <Selector value={c.motorizadoId ?? ''} onChange={(e) => asignar(c.id, 1, e.target.value)} className={c.motorizadoId ? '' : 'border-error'}>
                  <option value="">Sin asignar</option>
                  {activos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </Selector>
              ) },
              { clave: 'dir2', titulo: 'Dirección 2', render: (c) => <span className="text-[12px] text-tenue">{c.direccion2 ?? '—'}</span> },
              { clave: 'm2', titulo: 'Motorizado 2', ancho: '200px', render: (c) => c.direccion2 ? (
                <Selector value={c.motorizado2Id ?? ''} onChange={(e) => asignar(c.id, 2, e.target.value)} className={c.motorizado2Id ? '' : 'border-error'}>
                  <option value="">Sin asignar</option>
                  {activos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </Selector>
              ) : <span className="text-tenue">—</span> },
            ]}
          />
        </Tarjeta>
      </div>

      <PanelLateral abierto={panel !== null} alCerrar={() => setPanel(null)} titulo={panel === 'nuevo' ? 'Nuevo motorizado' : 'Editar motorizado'} ancho="sm"
        pie={<><Boton variante="secundario" onClick={() => setPanel(null)} disabled={enCurso}>Cancelar</Boton><Boton type="submit" form="form-moto" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton></>}>
        {panel && (
          <form id="form-moto" action={(d) => arranca(async () => {
            setError(null); d.set('activo', activo ? 'true' : 'false'); d.set('color', color);
            const r = await guardarMotorizado(slug, panel === 'nuevo' ? null : panel.id, d);
            if (!r.ok) return setError(r.error);
            setPanel(null); toast.success('Motorizado guardado'); router.refresh();
          })} className="space-y-4">
            <Campo etiqueta="Nombre" requerido><Entrada name="nombre" defaultValue={panel === 'nuevo' ? '' : panel.nombre} required autoFocus /></Campo>
            <Campo etiqueta="Celular"><Entrada name="celular" defaultValue={panel === 'nuevo' ? '' : panel.celular ?? ''} inputMode="numeric" /></Campo>
            <Campo etiqueta="Color en las etiquetas">
              <div className="flex flex-wrap items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded border border-borde bg-tarjeta p-1" />
                {COLORES.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-texto' : 'border-borde'}`} style={{ background: c }} title={c} />)}
              </div>
            </Campo>
            <Casilla etiqueta="Activo" descripcion="Un motorizado inactivo no se puede asignar; lo ya asignado se conserva." marcado={activo} alCambiar={setActivo} />
            {error && <Aviso texto={error} />}
          </form>
        )}
      </PanelLateral>

      <Confirmar abierto={borrar !== null} titulo="Eliminar el motorizado" mensaje={`«${borrar?.nombre}» dejará de existir. Si tiene clientes asignados, la aplicación se negará.`} ocupado={enCurso}
        alCerrar={() => setBorrar(null)}
        alAceptar={() => arranca(async () => { if (!borrar) return; const r = await eliminarMotorizado(slug, borrar.id); setBorrar(null); if (!r.ok) { toast.error(r.error); return; } toast.success('Motorizado eliminado'); router.refresh(); })} />
    </>
  );
}
