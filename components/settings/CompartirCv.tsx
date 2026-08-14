'use client';

/**
 * CV PÚBLICO — bloque del panel de Perfil: el enlace con token, la aspiración
 * salarial y qué datos de contacto se publican.
 *
 * ── POR QUÉ VIVE EN PERFIL Y NO EN LA PESTAÑA «MI CV» ─────────────────────────
 * Lo pidió Fernando ahí. Y tiene sentido: la pestaña Mi CV es donde se **escribe**
 * el contenido; esto es donde se decide **quién lo ve**, que es una decisión de la
 * cuenta, no del documento. El dato, en cambio, se guarda en `member_cv_profiles`
 * junto al resto del CV: si mañana el bloque se muda de panel, el dato no se muda.
 *
 * ── EL ENLACE SE GENERA Y SE REVOCA AL INSTANTE ───────────────────────────────
 * Generar, regenerar y revocar NO esperan al botón «Guardar cambios» del panel.
 * Revocar es una acción de seguridad: quien la pulsa quiere que el enlace deje de
 * servir ahora, no cuando se acuerde de guardar.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BotonAyuda from '@/components/ui/BotonAyuda';
import Interruptor from '@/components/ui/Interruptor';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { Share2, Copy, ExternalLink, RefreshCw, Trash2, Check, Link2 } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface AjustesCvPublico {
  headline: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_visible: boolean;
  share_email: boolean;
  share_phone: boolean;
}

export const AJUSTES_VACIOS: AjustesCvPublico = {
  headline: '', location: '', salary_min: null, salary_max: null,
  salary_visible: true, share_email: false, share_phone: false,
};

export default function CompartirCv({
  ajustes,
  onChange,
}: {
  ajustes: AjustesCvPublico;
  /** El guardado lo dispara el botón del panel de Perfil; aquí solo se edita. */
  onChange: (patch: Partial<AjustesCvPublico>) => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [confirmar, setConfirmar] = useState<'regenerar' | 'revocar' | null>(null);

  useEffect(() => {
    fetch('/api/members/cv/public-link')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setToken(d?.token ?? null))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  // El origen se lee en el navegador y no de una variable de entorno: así el enlace
  // que se copia es el del sitio desde el que se está trabajando, sin configurar nada.
  const url = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/cv/${token}` : '';

  const generar = async () => {
    setTrabajando(true);
    try {
      const res = await fetch('/api/members/cv/public-link', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setToken(d.token);
      toast.success(token ? 'Enlace regenerado. El anterior ya no funciona.' : 'Enlace público creado');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el enlace');
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  };

  const revocar = async () => {
    setTrabajando(true);
    try {
      const res = await fetch('/api/members/cv/public-link', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setToken(null);
      toast.success('Enlace revocado');
    } catch {
      toast.error('No se pudo revocar el enlace');
    } finally {
      setTrabajando(false);
      setConfirmar(null);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  const accion = 'inline-flex items-center justify-center gap-1.5 text-[12px] text-digi-text border border-digi-border rounded px-2.5 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-50';
  const num = (v: number | null) => (v == null ? '' : String(v));

  return (
    <div className="pt-3 border-t border-digi-border space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}>
          <Share2 className="w-3.5 h-3.5 text-accent" /> CV público
        </h4>
        <BotonAyuda titulo="CV público">
          <p>
            Genera un enlace con un código único para compartir tu CV con alguien que
            <strong> no tiene cuenta</strong> en el sistema — por ejemplo, una empresa de
            selección.
          </p>
          <p className="mt-2">
            Enseña tu foto, tus datos, tus talentos con su experiencia y formación, tu
            portafolio, tu disponibilidad y tu aspiración salarial. Quien lo abra puede
            descargarlo en PDF.
          </p>
          <p className="mt-2">
            <strong>Un enlace se reenvía.</strong> Por eso tu correo y tu teléfono no salen
            salvo que los enciendas aquí abajo, y por eso puedes revocarlo cuando quieras:
            deja de funcionar al instante, también el PDF.
          </p>
          <p className="mt-2">
            <strong>Regenerar</strong> crea uno nuevo y mata el anterior — es lo que hay que
            hacer si el enlace circuló de más.
          </p>
        </BotonAyuda>
      </div>

      {cargando ? (
        <div className="h-9 rounded-md bg-black/[0.04] animate-pulse" />
      ) : !token ? (
        <div className="space-y-2">
          <p className="text-[11.5px] text-digi-muted leading-relaxed" style={mf}>
            Todavía no compartes tu CV. Al generar el enlace, cualquiera que lo tenga podrá verlo.
          </p>
          <button type="button" onClick={generar} disabled={trabajando} className={`${BTN_PRIMARY} w-full`}>
            <Link2 className="w-4 h-4" /> {trabajando ? 'Generando…' : 'Generar enlace público'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 rounded-md border border-digi-border bg-digi-darker px-2.5 py-1.5">
            {/* De solo lectura y seleccionable: el token no se edita a mano, pero sí se
                copia con el teclado por quien no use el botón. */}
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-transparent text-[11.5px] text-digi-muted focus:outline-none" style={mf} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={copiar} className={accion} style={mf}>
              {copiado ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className={accion} style={mf}>
              <ExternalLink className="w-3.5 h-3.5" /> Abrir
            </a>
            <button type="button" onClick={() => setConfirmar('regenerar')} disabled={trabajando} className={accion} style={mf}>
              <RefreshCw className="w-3.5 h-3.5" /> Regenerar
            </button>
            <button type="button" onClick={() => setConfirmar('revocar')} disabled={trabajando}
              className="inline-flex items-center justify-center gap-1.5 text-[12px] text-digi-muted border border-digi-border rounded px-2.5 py-1.5 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50" style={mf}>
              <Trash2 className="w-3.5 h-3.5" /> Revocar
            </button>
          </div>
        </div>
      )}

      {/* ── Aspiración salarial ── */}
      <div className="pt-3 border-t border-digi-border space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[12px] font-medium text-digi-text" style={mf}>Aspiración salarial</label>
          <BotonAyuda titulo="Aspiración salarial">
            <p>
              Un <strong>rango mensual aproximado en dólares</strong>. Puedes dejar solo el
              mínimo («desde») o solo el máximo («hasta»).
            </p>
            <p className="mt-2">
              Se muestra en tu CV público y en el PDF. Si prefieres hablarlo en la entrevista,
              apaga el interruptor y no aparecerá — pero el dato se queda guardado aquí.
            </p>
          </BotonAyuda>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-digi-muted" style={mf}>Desde (USD/mes)</span>
            <input type="number" min={0} step={50} inputMode="numeric" value={num(ajustes.salary_min)}
              onChange={(e) => onChange({ salary_min: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="1200"
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-digi-muted" style={mf}>Hasta (USD/mes)</span>
            <input type="number" min={0} step={50} inputMode="numeric" value={num(ajustes.salary_max)}
              onChange={(e) => onChange({ salary_max: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="1800"
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
          </div>
        </div>
        <Fila etiqueta="Mostrar el rango en el CV público"
          activo={ajustes.salary_visible} onChange={(v) => onChange({ salary_visible: v })} />
      </div>

      {/* ── Qué más se publica ── */}
      <div className="pt-3 border-t border-digi-border space-y-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-digi-muted" style={mf}>Titular profesional</span>
          <input value={ajustes.headline} maxLength={120}
            onChange={(e) => onChange({ headline: e.target.value })}
            placeholder="Desarrollador full-stack"
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-digi-muted" style={mf}>Ubicación</span>
          <input value={ajustes.location} maxLength={120}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Guayaquil, Ecuador"
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
        </div>
        <Fila etiqueta="Publicar mi correo" activo={ajustes.share_email} onChange={(v) => onChange({ share_email: v })} />
        <Fila etiqueta="Publicar mi teléfono" activo={ajustes.share_phone} onChange={(v) => onChange({ share_phone: v })} />
      </div>

      <PixelConfirm
        open={confirmar === 'regenerar'}
        title="Regenerar el enlace"
        message="Se creará un enlace nuevo y el actual dejará de funcionar de inmediato, también para quien ya lo tenga. ¿Continuar?"
        confirmLabel="Sí, regenerar"
        onConfirm={generar}
        onCancel={() => setConfirmar(null)}
      />
      <PixelConfirm
        open={confirmar === 'revocar'}
        title="Revocar el enlace"
        message="Tu CV público dejará de estar accesible al instante, y también su PDF. Puedes generar un enlace nuevo cuando quieras."
        confirmLabel="Sí, revocar"
        danger
        onConfirm={revocar}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}

/** Fila «texto + interruptor», el patrón de esta columna angosta. */
function Fila({ etiqueta, activo, onChange }: { etiqueta: string; activo: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-digi-text" style={mf}>{etiqueta}</span>
      <Interruptor activo={activo} onChange={onChange} etiqueta={etiqueta} />
    </div>
  );
}
