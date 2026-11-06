'use client';

/**
 * EL INICIO DE LAS APPS — GCC Progreso, GCC Aventura y GCC Centralizado (Fernando, 2026-11-05: «debe
 * parecer una app móvil»). GCC World, en el navegador, no pasa por aquí.
 *
 * El lenguaje es el de la app de Motordesa: velo de arranque con el logo y las alas, cabecera de marca
 * y una hoja con Ingresar / Crear cuenta. Sin pestañas del sitio: en una app no se navega a las páginas
 * públicas. Los formularios son los diálogos de siempre (mismas condiciones, también el límite de un
 * registro cada 24 h por equipo), presentados como hoja inferior desde `app/globals.css`.
 */

import { useEffect, useState, type ComponentType } from 'react';
import { ChevronRight, FileText, UserPlus } from 'lucide-react';
import Segmentado from '@/components/ui/Segmentado';
import { abrirFuera } from '@/lib/movil/abrir-fuera';
import { nombreDeApp, type AppDeTelefono } from '@/lib/sitio/appDeTelefono';
import { horaDeReanudacion, useEstadoRegistro } from './estadoRegistro';
import { useOpcionesAcceso, type AccionesAcceso } from './opcionesAcceso';

const SUBTITULO: Record<AppDeTelefono, string> = {
  progreso: 'La plataforma del grupo',
  aventura: 'El videojuego del grupo',
  centralizado: 'Solo para miembros',
};

const ARRANQUE_MS = 1280;
const SALIDA_MS = 260;
const CLAVE_ARRANQUE = 'gcc-app-arrancada';

/** Tres barras inclinadas, como las de la marca de Motordesa. */
function Alas({ className }: { className: string }) {
  return <span className={`app-alas ${className}`} aria-hidden><i /><i /><i /></span>;
}

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
  const todas = useOpcionesAcceso(app === 'aventura' ? 'game' : 'dashboard', acciones);
  const opciones = app === 'centralizado' ? todas.filter((o) => o.clave === 'miembro') : todas;
  const registro = useEstadoRegistro();
  const pausa = registro?.bloqueado ? `En pausa hasta el ${horaDeReanudacion(registro.hasta)}` : null;

  // El arranque, una vez por apertura de la app. Si la portada ya cargó, se va al cumplir su tiempo.
  const [velo, setVelo] = useState<'entra' | 'sale' | 'fuera'>('entra');
  useEffect(() => {
    let ya = false;
    try { ya = sessionStorage.getItem(CLAVE_ARRANQUE) === '1'; sessionStorage.setItem(CLAVE_ARRANQUE, '1'); } catch { /* sin almacenamiento: se anima */ }
    if (ya || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVelo('fuera'); return; }
    const a = setTimeout(() => setVelo('sale'), ARRANQUE_MS);
    const b = setTimeout(() => setVelo('fuera'), ARRANQUE_MS + SALIDA_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  // Al entrar a la plataforma la página se va: el velo con su barra cubre esa espera.
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
      <header className="app-cabeza">
        <Alas className="app-alas-arriba" />
        <Alas className="app-alas-abajo" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="app-logo" src="/icono-512.png" alt="" />
        <h1>{nombreDeApp(app)}</h1>
        <p>{SUBTITULO[app]}</p>
      </header>

      <main className="app-hoja">
        {/* Centralizado es solo para miembros: ahí no se crean cuentas. */}
        {app !== 'centralizado' && (
          <Segmentado etiqueta="Cuenta" valor={modo} onChange={setModo}
            opciones={[{ valor: 'ingresar', texto: 'Ingresar' }, { valor: 'crear', texto: 'Crear cuenta' }]} />
        )}

        <div key={modo} className="app-filas">
          {modo === 'ingresar'
            ? opciones.map((o) => <Fila key={o.clave} Icono={o.Icono} titulo={o.titulo} texto={o.corta ?? o.descripcion} onClick={o.onClick} />)
            : (
              <>
                <Fila Icono={FileText} titulo="Postularme" texto={pausa ?? 'Conoce el proyecto y envía tu postulación.'} onClick={onPostular} />
                <Fila Icono={UserPlus} titulo="Cuenta de cliente" texto={pausa ?? 'Para tus productos y servicios.'} onClick={onCrearCuenta} />
              </>
            )}
        </div>

        <button type="button" className="app-legal" onClick={verLegal}>Legal y privacidad</button>
      </main>

      {(velo !== 'fuera' || saliendo) && (
        <div className={`app-velo${velo === 'sale' && !saliendo ? ' es-saliente' : ''}`} aria-hidden>
          <span className="app-velo-marca">
            <Alas className="app-velo-alas" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icono-512.png" alt="" />
          </span>
          {saliendo && <span className="app-barra"><i /></span>}
        </div>
      )}
    </div>
  );
}
