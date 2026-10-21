'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, Download, QrCode } from 'lucide-react';
import PixelSelect from '@/components/ui/PixelSelect';
import { EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Negro sobre blanco aunque la app esté en modo oscuro: es lo que leen todas las cámaras.
const COLOR = { dark: '#000000', light: '#ffffff' };
// Corrección «M» (15 %): aguanta una impresión regular sin volver el código demasiado denso.
const OPCIONES = { errorCorrectionLevel: 'M' as const, margin: 2, color: COLOR };

/** QR como imagen (data URL) con las opciones de la casa: lo usan también otras herramientas. */
export const qrImagen = (texto: string, ancho: number) => QRCode.toDataURL(texto, { ...OPCIONES, width: ancho });

const TAMANOS = [
  { value: '512', label: '512 px' },
  { value: '1024', label: '1024 px' },
  { value: '2048', label: '2048 px (impresión)' },
];

/** «grupocc.org/x» → «https://grupocc.org/x»; null si no es un enlace web. */
function normalizar(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(conEsquema);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch { return null; }
}

const nombreArchivo = (url: string, ext: string) => {
  const host = new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '');
  return `qr-${host || 'enlace'}.${ext}`;
};

function descargar(href: string, nombre: string) {
  const a = document.createElement('a');
  a.href = href; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
}

/**
 * ⇒ ENLACE A CÓDIGO QR (Herramientas → Edición; Fernando, 2026-10-20).
 * Se genera en el navegador (`qrcode`): el enlace no sale del equipo. PNG en el tamaño
 * elegido o SVG (vectorial, para imprenta), y copiar la imagen para pegarla donde sea.
 */
export default function GeneradorQR() {
  const [texto, setTexto] = useState('');
  const [tamano, setTamano] = useState('1024');
  const [vista, setVista] = useState<string | null>(null);
  const url = normalizar(texto);

  useEffect(() => {
    if (!url) { setVista(null); return; }
    let vivo = true;
    qrImagen(url, 320)
      .then((d) => { if (vivo) setVista(d); })
      .catch(() => { if (vivo) setVista(null); });
    return () => { vivo = false; };
  }, [url]);

  const png = () => qrImagen(url!, Number(tamano));

  const bajarPng = async () => {
    try { descargar(await png(), nombreArchivo(url!, 'png')); }
    catch { toast.error('No se pudo generar el PNG'); }
  };

  const bajarSvg = async () => {
    try {
      const svg = await QRCode.toString(url!, { ...OPCIONES, type: 'svg' });
      const href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      descargar(href, nombreArchivo(url!, 'svg'));
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch { toast.error('No se pudo generar el SVG'); }
  };

  const copiar = async () => {
    try {
      // La promesa va DENTRO del ClipboardItem: Safari exige crearlo en el mismo clic.
      const blob = png().then((d) => fetch(d)).then((r) => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Código QR copiado');
    } catch { toast.error('Este navegador no deja copiar imágenes; descárgalo en PNG'); }
  };

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>Pega un enlace y descarga su código QR.</p>
      <EditField label="Enlace">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} inputMode="url" autoComplete="off" spellCheck={false}
          placeholder="https://…" className={EDIT_INPUT} style={mf} />
      </EditField>
      {texto.trim() && !url && <p className="text-[11px] text-red-600" style={mf}>No parece un enlace web</p>}

      <div className="aspect-square w-full max-w-[260px] mx-auto rounded-lg border border-digi-border bg-white flex items-center justify-center overflow-hidden">
        {vista
          ? <img src={vista} alt={`Código QR de ${url}`} className="w-full h-full" />
          : <QrCode className="w-10 h-10 text-digi-muted/40" />}
      </div>
      {url && <p className="text-[11px] text-digi-muted text-center break-all" style={mf}>{url}</p>}

      <PixelSelect label="Tamaño del PNG" value={tamano} onChange={(e) => setTamano(e.target.value)} options={TAMANOS} />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={bajarPng} disabled={!url} className={`${BTN_PRIMARY} w-full disabled:opacity-50`}><Download className="w-4 h-4" /> PNG</button>
        <button onClick={bajarSvg} disabled={!url} className={`${BTN_SECONDARY} w-full disabled:opacity-50`}><Download className="w-4 h-4" /> SVG</button>
      </div>
      <button onClick={copiar} disabled={!url} className={`${BTN_SECONDARY} w-full disabled:opacity-50`}><Copy className="w-4 h-4" /> Copiar imagen</button>
    </div>
  );
}
