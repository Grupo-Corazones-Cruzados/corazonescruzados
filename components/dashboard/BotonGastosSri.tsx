'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { KeyRound, RefreshCw } from 'lucide-react';
import MenuMas from '@/components/ui/MenuMas';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';

type Trabajo = { id: number; estado: 'pendiente' | 'en_curso' | 'hecho' | 'error' | 'captcha'; nuevos: number | null; mensaje: string | null; terminado_en: string | null };
type Estado = {
  claveConfigurada: boolean;
  trabajadorVistoEn: string | null;
  ultimo: Trabajo | null;
  pendientes: { year: number; month: number }[];
};

const enMarcha = (t?: Trabajo | null) => t?.estado === 'pendiente' || t?.estado === 'en_curso';
/** El M1 pregunta cada 30 s: si no ha preguntado en 2 minutos, no está atento. */
const m1Atento = (visto: string | null) => !!visto && Date.now() - new Date(visto).getTime() < 2 * 60_000;

/**
 * «ACTUALIZAR GASTOS DEL SRI» (Fernando, 2026-10-30). Deja un trabajo en la cola que recoge el M1
 * (ver `lib/finance-sri.ts`) y, mientras corre, pregunta cada 5 s cómo va. Al terminar avisa de
 * cuántos gastos nuevos llegaron y pide recargar los meses (`onActualizado`).
 *
 * Es UN botón con su menú (regla «Botón que despliega variantes»): actualizar, o cambiar la clave.
 * La clave se pide en una ventanita (un solo campo) la primera vez y cuando se quiere cambiar.
 */
export default function BotonGastosSri({ onActualizado, className = '' }: { onActualizado: () => void; className?: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [clave, setClave] = useState('');
  const [guardando, setGuardando] = useState(false);
  const anterior = useRef<Trabajo | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/finance/sri');
      if (!r.ok) return;
      const { data } = await r.json();
      setEstado(data);
    } catch {}
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Mientras hay un trabajo en marcha, se pregunta cada 5 s.
  useEffect(() => {
    if (!enMarcha(estado?.ultimo)) return;
    const t = window.setInterval(cargar, 5000);
    return () => window.clearInterval(t);
  }, [estado?.ultimo, cargar]);

  // Al pasar de «en marcha» a terminado: el aviso y recargar los meses.
  useEffect(() => {
    const u = estado?.ultimo ?? null;
    const a = anterior.current;
    anterior.current = u;
    if (!a || !u || a.id !== u.id || !enMarcha(a) || enMarcha(u)) return;
    if (u.estado === 'hecho') {
      toast.success(u.nuevos ? `${u.nuevos} ${u.nuevos === 1 ? 'gasto nuevo' : 'gastos nuevos'} del SRI` : 'Sin gastos nuevos en el SRI');
      if (u.nuevos) onActualizado();
    } else {
      toast.error(u.estado === 'captcha'
        ? 'El SRI pidió resolver el captcha. Vuelve a intentarlo en un rato.'
        : u.mensaje || 'No se pudo consultar el SRI.');
      if (u.nuevos) onActualizado();
    }
  }, [estado?.ultimo, onActualizado]);

  const actualizar = async () => {
    try {
      const r = await fetch('/api/finance/sri', { method: 'POST' });
      const d = await r.json();
      if (r.status === 409) { setPidiendoClave(true); return; }
      if (!r.ok) throw new Error(d.error || 'No se pudo pedir la actualización');
      setEstado(d.data);
      if (!m1Atento(d.data.trabajadorVistoEn)) toast.warning('El M1 no está conectado: se actualizará en cuanto vuelva.');
    } catch (e: any) { toast.error(e.message); }
  };

  const guardarClave = async () => {
    if (!clave.trim()) return;
    setGuardando(true);
    try {
      const r = await fetch('/api/finance/sri/clave', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clave }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar la clave');
      setPidiendoClave(false);
      setClave('');
      toast.success('Clave del SRI guardada');
      await actualizar();
    } catch (e: any) { toast.error(e.message); }
    finally { setGuardando(false); }
  };

  if (!estado) return null;
  const corriendo = enMarcha(estado.ultimo);
  const texto = !corriendo ? 'Gastos del SRI'
    : estado.ultimo?.estado === 'en_curso' ? 'Consultando el SRI…'
    : m1Atento(estado.trabajadorVistoEn) ? 'Enviando al M1…' : 'Esperando al M1';
  const porRevisar = estado.pendientes.length;

  return (
    <>
      <span className={className} data-sri-gastos>
        <MenuMas
          label={texto}
          boton={{ texto, icon: RefreshCw, className: `${BTN_SECONDARY} inline-flex items-center justify-center gap-1.5 ${corriendo ? '[&_svg:first-child]:animate-spin' : ''}` }}
          items={[
            {
              label: corriendo ? 'Actualización en curso' : `Actualizar ahora${porRevisar ? ` (${porRevisar} ${porRevisar === 1 ? 'mes' : 'meses'})` : ''}`,
              icon: RefreshCw, onClick: actualizar, disabled: corriendo,
            },
            { label: estado.claveConfigurada ? 'Cambiar clave del SRI' : 'Guardar clave del SRI', icon: KeyRound, onClick: () => setPidiendoClave(true) },
          ]}
        />
      </span>

      {/* La ventanita va al <body>: en el teléfono este botón vive dentro de la barra de abajo
          (`EnBarraAcciones`), que estira todos sus botones a lo ancho — también la X de cerrar. */}
      {typeof document !== 'undefined' && createPortal(
      <PixelModal open={pidiendoClave} onClose={() => !guardando && setPidiendoClave(false)} title="Clave del SRI" size="sm" busy={guardando}
        pie={<>
          <button onClick={() => setPidiendoClave(false)} disabled={guardando} className={BTN_SECONDARY}>Cancelar</button>
          <button onClick={guardarClave} disabled={guardando || !clave.trim()} className={BTN_PRIMARY}>Guardar y actualizar</button>
        </>}>
        <PixelInput label="Clave de SRI en Línea" type="password" autoComplete="off" value={clave}
          onChange={(e) => setClave(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') guardarClave(); }} />
      </PixelModal>, document.body)}
    </>
  );
}
