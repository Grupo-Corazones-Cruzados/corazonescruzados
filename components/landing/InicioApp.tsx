'use client';

/**
 * EL INICIO DE LAS APPS — GCC Progreso, GCC Aventura y GCC Centralizado (Fernando, 2026-11-05: «debe
 * parecer una app móvil»). GCC World, en el navegador, no pasa por aquí.
 *
 * Encima sigue la portada de siempre: el corazón, el mundo, su cruce y el eslogan con su raya (no se
 * cambian: Fernando, 2026-11-05). Lo propio de la app es la hoja que sube con Ingresar / Crear cuenta y
 * sus transiciones. Sin pestañas del sitio: en una app no se navega a las páginas
 * públicas. Los formularios son los diálogos de siempre (mismas condiciones, también el límite de un
 * registro cada 24 h por equipo), presentados como hoja inferior desde `app/globals.css`.
 */

import { useEffect, useState, type ComponentType } from 'react';
import { ChevronRight, FileText, UserPlus } from 'lucide-react';
import BrandLoader from '@/components/ui/BrandLoader';
import Segmentado from '@/components/ui/Segmentado';
import { abrirFuera } from '@/lib/movil/abrir-fuera';
import type { AppDeTelefono } from '@/lib/sitio/appDeTelefono';
import { horaDeReanudacion, useEstadoRegistro } from './estadoRegistro';
import { useOpcionesAcceso, type AccionesAcceso } from './opcionesAcceso';

const SUBTITULO: Record<AppDeTelefono, string> = {
  progreso: 'La plataforma del grupo',
  aventura: 'El videojuego del grupo',
  centralizado: 'Solo para miembros',
};


function Fila({ Icono, titulo, texto, onClick }: {
  Icono: ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="app-fila" onClick={onClick}>
      <span className="app-fila-icono"><Icono className="w-5 h-5" /></span>
      <span className="app-fila-texto">
        <b>{titulo}</b>
        <span>{texto}</span>
      </span>
      <ChevronRight className="app-fila-ir" aria-hidden />
    </button>
  );
}

export default function InicioApp({ app, acciones, onPostular, onCrearCuenta }: {
  app: AppDeTelefono;
  acciones: AccionesAcceso;
  onPostular: () => void;
  onCrearCuenta: () => void;
}) {
  const [modo, setModo] = useState<'ingresar' | 'crear'>('ingresar');
  const todas = useOpcionesAcceso(acciones);
  const opciones = app === 'centralizado' ? todas.filter((o) => o.clave === 'miembro') : todas;
  const registro = useEstadoRegistro();
  const pausa = registro?.bloqueado ? `En pausa hasta el ${horaDeReanudacion(registro.hasta)}` : null;

  const [saliendo, setSaliendo] = useState(false);
  useEffect(() => {
    const irse = () => setSaliendo(true);
    const volver = () => setSaliendo(false);
    window.addEventListener('beforeunload', irse);
    window.addEventListener('pageshow', volver);
    return () => { window.removeEventListener('beforeunload', irse); window.removeEventListener('pageshow', volver); };
  }, []);

  const verLegal = async () => {
    const url = 'https://www.grupocc.org/legal';
    if (!(await abrirFuera(url).catch(() => null))) window.location.href = url;
  };

  return (
    <div className="corp app-inicio">
      <main className="app-hoja">
        <div className="app-hoja-marca">
          <h1>GCC World</h1>
          <p>{SUBTITULO[app]}</p>
        </div>
        {/* Aventura (el videojuego) se reinició desde cero el 2026-11-08: la app solo dice que llega pronto. */}
        {app === 'aventura' ? (
          <p className="roles-proximamente">Próximamente</p>
        ) : (<>
        {/* Centralizado es solo para miembros: ahí no se crean cuentas. */}
        {app !== 'centralizado' && (
          <Segmentado etiqueta="Cuenta" valor={modo} onChange={setModo}
            opciones={[{ valor: 'ingresar', texto: 'Ingresar' }, { valor: 'crear', texto: 'Crear cuenta' }]} />
        )}

        <div key={modo} className={`app-filas ${modo === 'crear' ? 'desde-derecha' : 'desde-izquierda'}`}>
          {modo === 'ingresar'
            ? opciones.map((o) => <Fila key={o.clave} Icono={o.Icono} titulo={o.titulo} texto={o.corta ?? o.descripcion} onClick={o.onClick} />)
            : (
              <>
                <Fila Icono={FileText} titulo="Postularme" texto={pausa ?? 'Conoce el proyecto y envía tu postulación.'} onClick={onPostular} />
                <Fila Icono={UserPlus} titulo="Cuenta de cliente" texto={pausa ?? 'Para tus productos y servicios.'} onClick={onCrearCuenta} />
              </>
            )}
        </div>
        </>)}

        <button type="button" className="app-legal" onClick={verLegal}>Legal y privacidad</button>
      </main>

      {/* Al entrar a la plataforma la página se va: el color de la app con el cargador de la web cubre esa espera. */}
      {saliendo && (
        <div className="app-velo" aria-hidden>
          <BrandLoader size="lg" />
        </div>
      )}
    </div>
  );
}
