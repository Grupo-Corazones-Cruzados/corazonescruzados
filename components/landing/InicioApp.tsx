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

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { ChevronRight, FileText, UserPlus, X } from 'lucide-react';
import BrandLoader from '@/components/ui/BrandLoader';
import PensamientosCielo from './PensamientosCielo';
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

export default function InicioApp({ app, acciones, onPostular, onCrearCuenta, onVolver }: {
  app: AppDeTelefono;
  acciones: AccionesAcceso;
  onPostular: () => void;
  onCrearCuenta: () => void;
  /** Solo en la web, donde a esta hoja se llega eligiendo un mundo: vuelve a la elección (2026-11-08). */
  onVolver?: () => void;
}) {
  const [modo, setModo] = useState<'ingresar' | 'crear'>('ingresar');
  const todas = useOpcionesAcceso(acciones);
  const opciones = app === 'centralizado' ? todas.filter((o) => o.clave === 'miembro') : todas;
  const registro = useEstadoRegistro();
  const pausa = registro?.bloqueado ? `En pausa hasta el ${horaDeReanudacion(registro.hasta)}` : null;

  /**
   * LA HOJA OCUPA DEL ESLOGAN HACIA ABAJO (Fernando, 2026-11-08/09), en la web y en las apps: arriba, el
   * hueco donde se centra el pensamiento (si no cabe entero, no sale); abajo, la hoja. En la web termina
   * bajo el pie, del que parece salir. Se mide dónde acaba el eslogan.
   */
  const [tope, setTope] = useState<number | null>(null);
  useEffect(() => {
    const medir = () => {
      const e = document.querySelector('.eslogan-linea');
      if (e) setTope(Math.round(e.getBoundingClientRect().bottom + 12));
    };
    medir();
    const t = window.setTimeout(medir, 700);
    window.addEventListener('resize', medir);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', medir); };
  }, []);

  /**
   * EL TAMAÑO DE LA HOJA EN LA WEB (Fernando, 2026-11-09): con pantalla de sobra crece (hasta ×1,25), y en
   * una ancha pero baja encoge (hasta ×0,88), siempre para llenar el hueco entre el eslogan y el pie: antes crecía por el alto de la ventana
   * y el pie cortaba «Miembro». Se mide su alto natural (a ×1) y el hueco; el pensamiento ocupa lo que
   * sobre y, si no cabe, no sale. Si ni a ×1 cabe, el contenedor se desplaza en vez de cortar.
   */
  const contRef = useRef<HTMLDivElement | null>(null);
  const hojaRef = useRef<HTMLElement | null>(null);
  const [escala, setEscala] = useState(1);
  const [sinSitio, setSinSitio] = useState(false);
  useLayoutEffect(() => {
    const cont = contRef.current, hoja = hojaRef.current;
    if (!onVolver || tope === null || !cont || !hoja) return;
    const medir = () => {
      const previa = hoja.style.zoom;
      hoja.style.zoom = '1';
      const natural = hoja.offsetHeight;
      hoja.style.zoom = previa;
      const disponible = cont.clientHeight;
      const ancho = window.innerWidth >= 600;
      const maxima = !ancho ? 1 : window.innerHeight >= 1150 ? 1.25 : window.innerHeight >= 980 ? 1.12 : 1;
      // Con poco alto también se reduce un poco (hasta el 88 %) antes que quedar cortada.
      const minima = 0.88;
      const e = Math.max(minima, Math.min(maxima, (disponible - 8) / natural));
      setEscala(e);
      setSinSitio(natural * e > disponible);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cont);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, [onVolver, tope]);

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
    <div ref={contRef} className={`corp app-inicio ${onVolver ? 'app-inicio-web' : ''} ${tope !== null ? 'con-tope' : ''} ${sinSitio ? 'sin-sitio' : ''}`} style={tope !== null ? { top: tope } : undefined}>
      {/* EL PENSAMIENTO, SOLO AQUÍ (Fernando, 2026-11-08): aparece y desaparece justo encima del formulario,
          bajo el corazón-mundo de la portada. Igual en la web y en las apps: es la misma pantalla. */}
      <div className="app-pensamiento"><PensamientosCielo lugar="acceso" tono={app === 'progreso' ? 'dia' : 'noche'} visible /></div>
      <main ref={hojaRef} className="app-hoja" style={escala !== 1 ? { zoom: escala } : undefined}>
        <div className="app-hoja-marca">
          {onVolver && (
            <button type="button" className="app-volver" onClick={onVolver} aria-label="Cerrar y elegir otro mundo" title="Elegir otro mundo">
              <X aria-hidden />
            </button>
          )}
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

        {/* En la web ya está en el pie de la portada (Fernando, 2026-11-08): solo en las apps. */}
        {!onVolver && <button type="button" className="app-legal" onClick={verLegal}>Legal y privacidad</button>}
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
