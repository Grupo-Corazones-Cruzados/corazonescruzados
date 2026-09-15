'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Apple, Plus, Pencil, Trash2 } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Buscador, Tabla, Insignia, Tarjeta, RailFiltro, PanelLateral, Confirmar, Campo, Entrada, Selector, EstadoVacio } from '@/componentes/ui';
import { Aviso, Casilla } from '@/componentes/campos';
import { CATEGORIAS, ETIQUETA_CATEGORIA } from '@/lib/catalogo';
import { guardarAlimento, eliminarAlimento } from '@/acciones/cocina';
import type { CategoriaAlimento } from '@/generated/prisma/enums';

type Alimento = { id: number; nombre: string; categoria: CategoriaAlimento; activo: boolean; enMenus: number; restricciones: number };

export default function AlimentosCliente({ slug, alimentos }: { slug: string; alimentos: Alimento[] }) {
  const router = useRouter();
  const [categoria, setCategoria] = useState<string>('TODAS');
  const [busca, setBusca] = useState('');
  const [panel, setPanel] = useState<Alimento | 'nuevo' | null>(null);
  const [activo, setActivo] = useState(true);
  const [borrar, setBorrar] = useState<Alimento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return alimentos.filter((a) => (categoria === 'TODAS' || a.categoria === categoria) && (!q || a.nombre.toLowerCase().includes(q)));
  }, [alimentos, categoria, busca]);

  const abrir = (a: Alimento | 'nuevo') => { setError(null); setActivo(a === 'nuevo' ? true : a.activo); setPanel(a); };

  return (
    <>
      <CabeceraPagina titulo="Alimentos" descripcion="El catálogo con el que se arman los menús y contra el que se declaran las restricciones" acciones={<Boton icono={Plus} onClick={() => abrir('nuevo')}>Nuevo alimento</Boton>} />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          titulo="Categoría"
          activo={categoria}
          alElegir={setCategoria}
          opciones={[{ valor: 'TODAS', etiqueta: 'Todas', icono: Apple, conteo: alimentos.length }, ...CATEGORIAS.map((c) => ({ valor: c, etiqueta: ETIQUETA_CATEGORIA[c], conteo: alimentos.filter((a) => a.categoria === c).length }))]}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <Buscador valor={busca} alCambiar={setBusca} marcador="Buscar alimento…" className="max-w-md" />
          <Tarjeta className="overflow-hidden">
            <Tabla
              filas={visibles}
              claveFila={(a) => a.id}
              vacio={<EstadoVacio icono={Apple} titulo="Sin alimentos" detalle="Carga los ingredientes que usas: pollo, arroz, brócoli…" accion={<Boton icono={Plus} onClick={() => abrir('nuevo')}>Nuevo alimento</Boton>} />}
              columnas={[
                { clave: 'nombre', titulo: 'Alimento', render: (a) => <span className={a.activo ? 'font-semibold text-texto' : 'text-tenue line-through'}>{a.nombre}</span> },
                { clave: 'categoria', titulo: 'Categoría', render: (a) => <Insignia tono="neutro">{ETIQUETA_CATEGORIA[a.categoria]}</Insignia> },
                { clave: 'uso', titulo: 'En menús', alinear: 'der', render: (a) => a.enMenus },
                { clave: 'restr', titulo: 'Restricciones', alinear: 'der', render: (a) => (a.restricciones ? <Insignia tono="aviso">{a.restricciones} cliente{a.restricciones === 1 ? '' : 's'}</Insignia> : <span className="text-tenue">0</span>) },
                { clave: 'estado', titulo: 'Estado', render: (a) => <Insignia tono={a.activo ? 'exito' : 'neutro'}>{a.activo ? 'Activo' : 'Inactivo'}</Insignia> },
                { clave: 'acc', titulo: '', alinear: 'der', render: (a) => (
                  <span className="flex justify-end gap-1">
                    <BotonIcono icono={Pencil} titulo="Editar" onClick={() => abrir(a)} />
                    <BotonIcono icono={Trash2} titulo="Eliminar" className="hover:bg-error-suave hover:text-error" onClick={() => setBorrar(a)} />
                  </span>
                ) },
              ]}
            />
          </Tarjeta>
        </div>
      </div>

      <PanelLateral abierto={panel !== null} alCerrar={() => setPanel(null)} titulo={panel === 'nuevo' ? 'Nuevo alimento' : 'Editar alimento'} ancho="sm"
        pie={<><Boton variante="secundario" onClick={() => setPanel(null)} disabled={enCurso}>Cancelar</Boton><Boton type="submit" form="form-alimento" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton></>}>
        {panel && (
          <form id="form-alimento" action={(d) => arranca(async () => {
            setError(null);
            d.set('activo', activo ? 'true' : 'false');
            const r = await guardarAlimento(slug, panel === 'nuevo' ? null : panel.id, d);
            if (!r.ok) return setError(r.error);
            setPanel(null); toast.success('Alimento guardado'); router.refresh();
          })} className="space-y-4">
            <Campo etiqueta="Nombre" requerido><Entrada name="nombre" defaultValue={panel === 'nuevo' ? '' : panel.nombre} required autoFocus /></Campo>
            <Campo etiqueta="Categoría" requerido>
              <Selector name="categoria" defaultValue={panel === 'nuevo' ? 'PROTEINA' : panel.categoria}>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>)}
              </Selector>
            </Campo>
            <Casilla etiqueta="Activo" descripcion="Un alimento inactivo no se ofrece al armar menús; lo que ya está en menús y restricciones se conserva." marcado={activo} alCambiar={setActivo} />
            {error && <Aviso texto={error} />}
          </form>
        )}
      </PanelLateral>

      <Confirmar abierto={borrar !== null} titulo="Eliminar el alimento" mensaje={`«${borrar?.nombre}» dejará de existir. Si está en menús o restricciones, la aplicación se negará y te dirá cuántos.`} ocupado={enCurso}
        alCerrar={() => setBorrar(null)}
        alAceptar={() => arranca(async () => { if (!borrar) return; const r = await eliminarAlimento(slug, borrar.id); if (!r.ok) { toast.error(r.error); setBorrar(null); return; } setBorrar(null); toast.success('Alimento eliminado'); router.refresh(); })} />
    </>
  );
}
