'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { fmtNum } from '@/lib/format';
import { qrImagen } from '@/components/herramientas/GeneradorQR';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Version = { version_name: string; version_code: number; tamano: number; publicada_en: string };

/**
 * ⇒ FICHA DE UNA APP PARA EL TELÉFONO (Herramientas; Fernando, 2026-10-21). `lib/herramientas/apps.ts`.
 * En el teléfono: el botón baja el APK. En el computador: además un QR que abre esta misma
 * herramienta en el teléfono, donde se inicia sesión y se descarga.
 */
export default function AppMovil({ slug, descripcion, pasos }: { slug: string; descripcion: string; pasos: string[] }) {
  const [version, setVersion] = useState<Version | null | undefined>(undefined);
  const [qr, setQr] = useState<string | null>(null);
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/herramientas/apps/${slug}`).then((r) => r.json()).then((d) => { if (vivo) setVersion(d.data ?? null); })
      .catch(() => { if (vivo) setVersion(null); });
    setEsMovil(/Android|iPhone|iPad/i.test(navigator.userAgent));
    qrImagen(`${window.location.origin}/dashboard/tools?herramienta=${slug}`, 280).then((d) => { if (vivo) setQr(d); }).catch(() => {});
    return () => { vivo = false; };
  }, [slug]);

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>{descripcion}</p>

      {version === undefined ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p>
      ) : version === null ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Aún no hay una versión publicada.</p>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]" style={mf}>
            <dt className="text-digi-muted">Versión</dt><dd className="text-digi-text">{version.version_name}</dd>
            <dt className="text-digi-muted">Tamaño</dt><dd className="text-digi-text">{fmtNum(version.tamano / 1e6, 0)} MB</dd>
            <dt className="text-digi-muted">Sistema</dt><dd className="text-digi-text">Android 10 o superior</dd>
          </dl>
          <a href={`/api/herramientas/apps/${slug}/apk`} className={`${BTN_PRIMARY} w-full`}>
            <Download className="w-4 h-4" /> Descargar para Android
          </a>
        </>
      )}

      {!esMovil && qr && (
        <div className="rounded-lg border border-digi-border p-3 flex items-center gap-3">
          <img src={qr} alt="Código QR para abrir esta herramienta en el teléfono" className="w-24 h-24 rounded bg-white shrink-0" />
          <p className="text-[12px] text-digi-text inline-flex items-start gap-1.5" style={mf}>
            <Smartphone className="w-4 h-4 text-accent shrink-0 mt-px" />
            Escanéalo con el teléfono para descargarla allí.
          </p>
        </div>
      )}

      <div>
        <p className="text-[12px] font-semibold text-digi-text mb-1" style={mf}>Cómo instalarla</p>
        <ol className="list-decimal pl-4 space-y-0.5 text-[12px] text-digi-muted" style={mf}>
          {pasos.map((p) => <li key={p}>{p}</li>)}
        </ol>
      </div>
    </div>
  );
}
