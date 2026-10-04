'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { toast } from 'sonner';
import { CircleCheck, TriangleAlert, ScanSearch, Loader2, MapPin } from 'lucide-react';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { EDIT_INPUT } from '@/components/ui/EditDialog';
import { TONO } from '@/components/ui/tonos';
import type { ResultadoContradicciones } from '@/lib/admin/contradicciones';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/** Lo mismo que el servidor: más largo ya no es un texto, es otro documento. */
const MAX_TEXTO = 20_000;

/**
 * Admin ▸ Prompts ▸ «Validar contradicciones» (Fernando, 2026-10-04). Panel lateral: el
 * texto nuevo (se abre con lo seleccionado en la hoja) se compara con el documento ENTERO
 * que hay en pantalla. Vacío, se revisa el documento contra sí mismo.
 *
 * Cada contradicción dice dónde (sección), las dos citas y por qué, y «Ver en el documento»
 * selecciona el pasaje en la hoja.
 */
export default function ValidarContradicciones({ open, onClose, editor, projectId, textoInicial }: {
  open: boolean;
  onClose: () => void;
  editor: Editor;
  projectId: number;
  textoInicial: string;
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [abiertoCon, setAbiertoCon] = useState(textoInicial);
  const [validando, setValidando] = useState(false);
  const [res, setRes] = useState<ResultadoContradicciones | null>(null);

  // Al volver a abrir con OTRA selección, el campo la toma; si no, se conserva lo escrito.
  if (open && textoInicial !== abiertoCon) {
    setAbiertoCon(textoInicial);
    if (textoInicial) { setTexto(textoInicial); setRes(null); }
  }

  const validar = async () => {
    setValidando(true);
    setRes(null);
    try {
      const r = await fetch(`/api/admin/prompts/${projectId}/contradicciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: editor.getHTML(), texto }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo validar.');
      setRes(j.data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setValidando(false);
    }
  };

  const verEnDocumento = (cita: string) => {
    const rango = buscarEnDocumento(editor, cita);
    if (!rango) { toast.error('No se encontró ese pasaje en el documento.'); return; }
    onClose();
    // Tras cerrar el panel, para que el foco vuelva a la hoja y no al diálogo.
    setTimeout(() => editor.chain().focus().setTextSelection(rango).scrollIntoView().run(), 50);
  };

  const ok = res && !res.hayContradiccion;

  return (
    <PixelModal open={open} onClose={onClose} title="Validar contradicciones" busy={validando}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Texto nuevo</label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
            rows={7}
            placeholder="Vacío: se revisa el documento completo contra sí mismo."
            className={`${EDIT_INPUT} resize-y`}
            style={mf}
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={validando} className={BTN_SECONDARY}>Cerrar</button>
          <button type="button" onClick={() => void validar()} disabled={validando} className={BTN_PRIMARY}>
            {validando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
            {validando ? 'Leyendo el documento…' : 'Validar'}
          </button>
        </div>

        {res && (
          <div className="flex flex-col gap-3 pt-3 border-t border-digi-border">
            <div className={`flex items-start gap-2.5 rounded-lg border p-3 ${TONO[ok ? 'exito' : 'aviso'].caja}`}>
              {ok
                ? <CircleCheck className={`w-5 h-5 shrink-0 ${TONO.exito.icono}`} />
                : <TriangleAlert className={`w-5 h-5 shrink-0 ${TONO.aviso.icono}`} />}
              <div className="min-w-0">
                <p className={`text-[13px] font-semibold ${TONO[ok ? 'exito' : 'aviso'].texto}`} style={df}>
                  {ok
                    ? 'No hay contradicciones'
                    : `${res.contradicciones.length} ${res.contradicciones.length === 1 ? 'contradicción' : 'contradicciones'}`}
                </p>
                <p className="text-[12.5px] text-digi-text mt-0.5" style={mf}>{res.resumen}</p>
              </div>
            </div>

            {res.contradicciones.map((c, i) => (
              <div key={i} className="rounded-lg border border-digi-border bg-digi-card p-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-[12px] text-digi-muted" style={mf}>
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate font-medium text-digi-text">{c.ubicacion}</span>
                </div>
                <Cita etiqueta="En el documento" texto={c.citaDocumento} />
                <Cita etiqueta={res.modo === 'texto' ? 'Texto nuevo' : 'Más adelante en el documento'} texto={c.citaNueva} />
                <div>
                  <p className="text-[11px] font-semibold text-digi-muted mb-0.5" style={df}>Por qué</p>
                  <p className="text-[13px] text-digi-text" style={mf}>{c.explicacion}</p>
                </div>
                <div className="flex justify-end gap-2">
                  {res.modo === 'documento' && c.citaNueva && (
                    <button type="button" onClick={() => verEnDocumento(c.citaNueva)} className={BTN_SECONDARY}>
                      Ver el segundo pasaje
                    </button>
                  )}
                  {c.citaDocumento && (
                    <button type="button" onClick={() => verEnDocumento(c.citaDocumento)} className={BTN_SECONDARY}>
                      Ver en el documento
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PixelModal>
  );
}

function Cita({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  if (!texto) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-digi-muted mb-0.5" style={df}>{etiqueta}</p>
      <blockquote className="border-l-2 border-digi-border pl-2.5 text-[13px] text-digi-text italic" style={mf}>
        «{texto}»
      </blockquote>
    </div>
  );
}

/**
 * Dónde está una cita en la hoja. El modelo cita sobre el Markdown, así que se le quitan
 * los símbolos (#, *, |, >, `) y se comparan los dos textos sin mayúsculas y con los
 * espacios colapsados. Si la cita entera no aparece (el modelo a veces retoca una
 * palabra), se prueba con su comienzo.
 */
function buscarEnDocumento(editor: Editor, cita: string): { from: number; to: number } | null {
  let plano = '';
  const pos: number[] = [];
  const pon = (ch: string, p: number) => {
    const c = /\s/.test(ch) ? ' ' : ch.toLowerCase();
    if (c === ' ' && (plano === '' || plano.endsWith(' '))) return;
    plano += c;
    pos.push(p);
  };
  editor.state.doc.descendants((node, p) => {
    if (node.isText) { const t = node.text ?? ''; for (let i = 0; i < t.length; i++) pon(t[i], p + i); }
    else if (node.isBlock) pon(' ', p);
  });

  const aguja = cita.replace(/[#*|>`_~]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/^[«"“]|[»"”]$/g, '');
  for (const largo of [aguja.length, 80, 40]) {
    const trozo = aguja.slice(0, largo).trim();
    if (trozo.length < 12 && largo !== aguja.length) continue;
    const i = plano.indexOf(trozo);
    if (i >= 0) return { from: pos[i], to: pos[i + trozo.length - 1] + 1 };
  }
  return null;
}
