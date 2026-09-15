'use client';

import { useState } from 'react';
import { Campo, Entrada, AreaTexto, Selector } from '@/componentes/ui';
import { Chips, Casilla } from '@/componentes/campos';
import {
  DIAS_SEMANA, ETIQUETA_DIA, ETIQUETA_COMIDA, ETIQUETA_GENERO, ETIQUETA_ACTIVIDAD, RESTRICCIONES_DESPACHO,
} from '@/lib/catalogo';
import type { TipoComida, DiaSemana, Genero, Actividad } from '@/generated/prisma/enums';

/**
 * LOS CAMPOS DE LA FICHA DEL CLIENTE, una sola vez. Los usan el alta a mano, la
 * edición por el personal y «Mi perfil» / «Mi dirección» del portal; cada uno
 * enseña las secciones que le tocan. Tres formularios parecidos escritos tres
 * veces es la forma de que uno valide y los otros no.
 */
export type DatosCliente = {
  nombre: string;
  celular: string;
  edad: number | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  altura: number | null;
  peso: number | null;
  genero: Genero | null;
  frecuenciaActividad: Actividad | null;
  direccion: string;
  edificio: string | null;
  piso: string | null;
  referencias: string | null;
  colorIdentificador: string | null;
  direccion2: string | null;
  edificio2: string | null;
  piso2: string | null;
  referencias2: string | null;
  colorIdentificador2: string | null;
  diasDireccion2: DiaSemana[];
  tiposComida: TipoComida[];
  sinAgua: boolean;
  sinFruta: boolean;
  sinCubiertos: boolean;
  envasesPropios: boolean;
  motorizadoId: number | null;
  motorizado2Id: number | null;
};

export const CLIENTE_VACIO: DatosCliente = {
  nombre: '', celular: '', edad: null, facebook: null, instagram: null, tiktok: null,
  altura: null, peso: null, genero: null, frecuenciaActividad: null,
  direccion: '', edificio: null, piso: null, referencias: null, colorIdentificador: null,
  direccion2: null, edificio2: null, piso2: null, referencias2: null, colorIdentificador2: null,
  diasDireccion2: [], tiposComida: [], sinAgua: false, sinFruta: false, sinCubiertos: false, envasesPropios: false,
  motorizadoId: null, motorizado2Id: null,
};

type Seccion = 'personales' | 'nutricion' | 'direccion' | 'despacho';

export function CamposCliente({
  datos,
  comidas,
  motorizados,
  secciones = ['personales', 'nutricion', 'direccion', 'despacho'],
}: {
  datos: DatosCliente;
  /** Las comidas que ofrece el negocio: las únicas que se pueden marcar. */
  comidas: TipoComida[];
  /** Si viene, el personal puede asignar motorizados (el cliente no). */
  motorizados?: { id: number; nombre: string }[];
  secciones?: Seccion[];
}) {
  const [tiposComida, setTiposComida] = useState<TipoComida[]>(datos.tiposComida);
  const [diasDir2, setDiasDir2] = useState<DiaSemana[]>(datos.diasDireccion2);
  const [dir2, setDir2] = useState(datos.direccion2 ?? '');
  const hay = (s: Seccion) => secciones.includes(s);

  return (
    <div className="space-y-6">
      {hay('personales') && (
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Datos personales</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre" requerido><Entrada name="nombre" defaultValue={datos.nombre} required /></Campo>
            <Campo etiqueta="Celular" requerido><Entrada name="celular" defaultValue={datos.celular} required inputMode="numeric" /></Campo>
            <Campo etiqueta="Edad"><Entrada name="edad" type="number" min={1} max={120} defaultValue={datos.edad ?? ''} /></Campo>
          </div>
          <Campo etiqueta="Comidas que le interesan">
            <Chips nombre="tiposComida" opciones={comidas} etiquetas={ETIQUETA_COMIDA} valor={tiposComida} alCambiar={setTiposComida} />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Instagram"><Entrada name="instagram" defaultValue={datos.instagram ?? ''} placeholder="@usuario" /></Campo>
            <Campo etiqueta="Facebook"><Entrada name="facebook" defaultValue={datos.facebook ?? ''} /></Campo>
            <Campo etiqueta="TikTok"><Entrada name="tiktok" defaultValue={datos.tiktok ?? ''} placeholder="@usuario" /></Campo>
          </div>
        </section>
      )}

      {hay('nutricion') && (
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Información nutricional (opcional)</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo etiqueta="Altura (m)"><Entrada name="altura" type="number" step="0.01" min={0.5} max={2.5} defaultValue={datos.altura ?? ''} placeholder="1.70" /></Campo>
            <Campo etiqueta="Peso (kg)"><Entrada name="peso" type="number" step="0.1" min={20} max={300} defaultValue={datos.peso ?? ''} /></Campo>
            <Campo etiqueta="Género">
              <Selector name="genero" defaultValue={datos.genero ?? ''}>
                <option value="">—</option>
                {(Object.keys(ETIQUETA_GENERO) as Genero[]).map((g) => <option key={g} value={g}>{ETIQUETA_GENERO[g]}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Actividad física">
              <Selector name="frecuenciaActividad" defaultValue={datos.frecuenciaActividad ?? ''}>
                <option value="">—</option>
                {(Object.keys(ETIQUETA_ACTIVIDAD) as Actividad[]).map((a) => <option key={a} value={a}>{ETIQUETA_ACTIVIDAD[a]}</option>)}
              </Selector>
            </Campo>
          </div>
        </section>
      )}

      {hay('direccion') && (
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Dirección de entrega</h3>
          <Campo etiqueta="Dirección" requerido><Entrada name="direccion" defaultValue={datos.direccion} required /></Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Edificio / conjunto"><Entrada name="edificio" defaultValue={datos.edificio ?? ''} /></Campo>
            <Campo etiqueta="Piso / depto."><Entrada name="piso" defaultValue={datos.piso ?? ''} /></Campo>
            <Campo etiqueta="Color identificador">
              <div className="flex items-center gap-2">
                <input type="color" name="colorIdentificador" defaultValue={datos.colorIdentificador ?? '#4B2D8E'} className="h-[34px] w-12 cursor-pointer rounded border border-borde bg-tarjeta p-1" />
                <span className="text-[11px] text-tenue">Para reconocer el paquete</span>
              </div>
            </Campo>
          </div>
          <Campo etiqueta="Referencias"><AreaTexto name="referencias" rows={2} defaultValue={datos.referencias ?? ''} placeholder="Frente al parque, portón negro, timbre 3…" /></Campo>
          {motorizados && (
            <Campo etiqueta="Motorizado que reparte">
              <Selector name="motorizadoId" defaultValue={datos.motorizadoId ?? ''}>
                <option value="">Sin asignar</option>
                {motorizados.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </Selector>
            </Campo>
          )}

          <div className="rounded-md border border-borde bg-realce/50 p-3 space-y-3">
            <h4 className="text-[12px] font-semibold">Segunda dirección (opcional)</h4>
            <p className="text-[11px] text-tenue">Para quien come en la oficina unos días y en casa otros. Marca los días en que se usa.</p>
            <Campo etiqueta="Dirección 2"><Entrada name="direccion2" value={dir2} onChange={(e) => setDir2(e.target.value)} placeholder="Déjala vacía si no aplica" /></Campo>
            {dir2 && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo etiqueta="Edificio / conjunto"><Entrada name="edificio2" defaultValue={datos.edificio2 ?? ''} /></Campo>
                  <Campo etiqueta="Piso / depto."><Entrada name="piso2" defaultValue={datos.piso2 ?? ''} /></Campo>
                  <Campo etiqueta="Color identificador">
                    <input type="color" name="colorIdentificador2" defaultValue={datos.colorIdentificador2 ?? '#0F6CBD'} className="h-[34px] w-12 cursor-pointer rounded border border-borde bg-tarjeta p-1" />
                  </Campo>
                </div>
                <Campo etiqueta="Referencias"><AreaTexto name="referencias2" rows={2} defaultValue={datos.referencias2 ?? ''} /></Campo>
                <Campo etiqueta="Días en que se usa la dirección 2">
                  <Chips nombre="diasDireccion2" opciones={DIAS_SEMANA} etiquetas={ETIQUETA_DIA} valor={diasDir2} alCambiar={setDiasDir2} />
                </Campo>
                {motorizados && (
                  <Campo etiqueta="Motorizado para la dirección 2">
                    <Selector name="motorizado2Id" defaultValue={datos.motorizado2Id ?? ''}>
                      <option value="">Sin asignar</option>
                      {motorizados.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </Selector>
                  </Campo>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {hay('despacho') && (
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Restricciones de despacho</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {RESTRICCIONES_DESPACHO.map(([clave, etiqueta]) => (
              <CasillaDespacho key={clave} nombre={clave} etiqueta={etiqueta} inicial={datos[clave]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CasillaDespacho({ nombre, etiqueta, inicial }: { nombre: string; etiqueta: string; inicial: boolean }) {
  const [v, setV] = useState(inicial);
  return <Casilla nombre={nombre} etiqueta={etiqueta} marcado={v} alCambiar={setV} />;
}

/** Los campos de dirección y despacho, escondidos con su valor actual, para que un formulario parcial no los borre. */
export function CamposOcultosDireccion({ datos, que = 'direccion' }: { datos: DatosCliente; que?: 'direccion' | 'personales' }) {
  const h = (n: string, v: string | number | null | undefined) => <input key={n} type="hidden" name={n} value={v ?? ''} />;
  if (que === 'direccion')
    return (
      <>
        {h('direccion', datos.direccion)}{h('edificio', datos.edificio)}{h('piso', datos.piso)}{h('referencias', datos.referencias)}{h('colorIdentificador', datos.colorIdentificador)}
        {h('direccion2', datos.direccion2)}{h('edificio2', datos.edificio2)}{h('piso2', datos.piso2)}{h('referencias2', datos.referencias2)}{h('colorIdentificador2', datos.colorIdentificador2)}
        {datos.diasDireccion2.map((d) => <input key={d} type="hidden" name="diasDireccion2" value={d} />)}
        {datos.sinAgua && h('sinAgua', 'true')}{datos.sinFruta && h('sinFruta', 'true')}{datos.sinCubiertos && h('sinCubiertos', 'true')}{datos.envasesPropios && h('envasesPropios', 'true')}
      </>
    );
  return (
    <>
      {h('nombre', datos.nombre)}{h('celular', datos.celular)}{h('edad', datos.edad)}{h('facebook', datos.facebook)}{h('instagram', datos.instagram)}{h('tiktok', datos.tiktok)}
      {h('altura', datos.altura)}{h('peso', datos.peso)}{h('genero', datos.genero)}{h('frecuenciaActividad', datos.frecuenciaActividad)}
      {datos.tiposComida.map((t) => <input key={t} type="hidden" name="tiposComida" value={t} />)}
    </>
  );
}
