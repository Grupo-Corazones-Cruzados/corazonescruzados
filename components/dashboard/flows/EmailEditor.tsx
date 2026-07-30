'use client';

/**
 * Editor del correo de una campaña: asunto, cuerpo y pie, con **variables del contacto**
 * insertables (estilo Power Automate) y vista previa.
 *
 * Las variables (`{{nombre}}`, `{{correo}}`, `{{telefono}}`, `{{puesto}}`) se sustituyen al
 * enviar, una vez por destinatario, con `lib/flows/variables.ts` — el MISMO módulo que usa
 * el endpoint de envío, así que la vista previa no puede desviarse del resultado real.
 */

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CONTACT_VARIABLES, previewTemplate, type ContactVariable } from '@/lib/flows/variables';
import { FIELD, LABEL, BTN_ROW, FileRow, formatSize } from '@/components/dashboard/flows/FlowPanelUI';
import { BTN_SECONDARY } from '@/components/ui/Button';
import {
  Bold, Italic, Underline, Heading1, Heading2, Pilcrow, Link2, Image as ImageIcon,
  Minus, MousePointerClick, Eye, Code2, Braces, Paperclip, User, AtSign, Phone, Briefcase,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const VAR_ICON: Record<string, any> = { nombre: User, correo: AtSign, telefono: Phone, puesto: Briefcase };

/** Envoltura del correo para la vista previa (neutra, sin marca). */
export function buildPreviewHtml(bodyHtml: string, footerHtml: string): string {
  const footer = footerHtml
    ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e0e0e0;">${footerHtml}</div>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>body{margin:0;padding:0;}</style></head>
<body style="font-family:Arial,Helvetica,sans-serif;background-color:#f5f5f5;margin:0;padding:24px 16px;color:#333333;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;overflow:hidden;border-radius:4px;">
  <div style="padding:32px;font-size:15px;line-height:1.6;color:#333333;">
    ${bodyHtml}
    ${footer}
  </div>
</div></body></html>`;
}

/* ─── Selector de variables ─── */
/**
 * Botón "Variables" + desplegable con el catálogo. Al elegir una, se inserta su token en el
 * campo que tenga el foco lógico (el que pasó su `onInsert`). Mismo gesto que el panel de
 * contenido dinámico de Power Automate: se ve la lista, se hace clic y queda puesta.
 */
export function VariablePicker({ onInsert, label = 'Variables' }: { onInsert: (token: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className={BTN_ROW}
        title="Insertar un dato del contacto"
      >
        <Braces className="w-3.5 h-3.5" /> {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-[264px] rounded-lg border border-digi-border bg-digi-card shadow-xl overflow-hidden">
          <p className="text-[11px] text-digi-muted px-3 pt-2.5 pb-1.5" style={mf}>
            Datos del contacto. Se reemplazan al enviar, uno por destinatario.
          </p>
          <div className="pb-1.5">
            {CONTACT_VARIABLES.map((v: ContactVariable) => {
              const Icon = VAR_ICON[v.key] || Braces;
              return (
                <button
                  key={v.key}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onInsert(v.token); setOpen(false); }}
                  className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-accent-light transition-colors"
                >
                  <Icon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-medium text-digi-text" style={mf}>{v.label}</span>
                    <span className="block text-[11px] text-digi-muted truncate" style={mf}>{v.hint}</span>
                  </span>
                  <code className="text-[10px] text-accent shrink-0 mt-0.5">{v.token}</code>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Campo de una línea con selector de variables (asunto) ─── */
export function SubjectField({
  value, onChange, label = 'Asunto', placeholder,
}: {
  value: string; onChange: (v: string) => void; label?: string; placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const insert = (token: string) => {
    const el = ref.current;
    if (!el) { onChange(`${value}${token}`); return; }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    setTimeout(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    }, 0);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className={`${LABEL} mb-0`}>{label}</label>
        <VariablePicker onInsert={insert} />
      </div>
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={FIELD} style={mf} />
      {value.includes('{{') && (
        <p className="text-[11px] text-digi-muted mt-1 truncate" style={mf}>
          Ejemplo: <span className="text-digi-text">{previewTemplate(value, { html: false })}</span>
        </p>
      )}
    </div>
  );
}

/* ─── Editor HTML con barra de formato + variables ─── */
export function HtmlEditor({
  value, onChange, placeholder, rows = 6, label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const insertTag = (openTag: string, closeTag: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    onChange(`${value.substring(0, start)}${openTag}${selected}${closeTag}${value.substring(end)}`);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + openTag.length;
      ta.selectionEnd = start + openTag.length + selected.length;
    }, 0);
  };

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) { onChange(`${value}${text}`); return; }
    const start = ta.selectionStart;
    onChange(`${value.substring(0, start)}${text}${value.substring(start)}`);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    }, 0);
  };

  const handleInsertLink = () => {
    const url = prompt('URL del enlace:');
    if (!url) return;
    const text = prompt('Texto del enlace:', 'Clic aquí') || 'Clic aquí';
    insertAtCursor(`<a href="${url}" style="color:#4B2D8E;text-decoration:underline;">${text}</a>`);
  };

  const handleInsertImage = () => {
    const url = prompt('URL de la imagen:');
    if (!url) return;
    const alt = prompt('Texto alternativo:', 'imagen') || 'imagen';
    insertAtCursor(`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;" />`);
  };

  const toolbarBtns: { Icon: any; title: string; action: () => void }[] = [
    { Icon: Bold, title: 'Negrita', action: () => insertTag('<strong>', '</strong>') },
    { Icon: Italic, title: 'Cursiva', action: () => insertTag('<em>', '</em>') },
    { Icon: Underline, title: 'Subrayado', action: () => insertTag('<u>', '</u>') },
    { Icon: Heading1, title: 'Título 1', action: () => insertTag('<h1 style="color:#222222;font-size:22px;font-weight:600;margin:0 0 12px;">', '</h1>') },
    { Icon: Heading2, title: 'Título 2', action: () => insertTag('<h2 style="color:#222222;font-size:18px;font-weight:600;margin:0 0 10px;">', '</h2>') },
    { Icon: Pilcrow, title: 'Párrafo', action: () => insertTag('<p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 12px;">', '</p>') },
    { Icon: Link2, title: 'Enlace', action: handleInsertLink },
    { Icon: ImageIcon, title: 'Imagen', action: handleInsertImage },
    { Icon: Minus, title: 'Línea separadora', action: () => insertAtCursor('<hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0;" />') },
    { Icon: MousePointerClick, title: 'Botón', action: () => {
      const url = prompt('URL del botón:') || '#';
      const text = prompt('Texto del botón:', 'Clic aquí') || 'Clic aquí';
      insertAtCursor(`<div style="text-align:center;margin:20px 0;"><a href="${url}" style="display:inline-block;background:#4B2D8E;color:#fff;text-decoration:none;padding:12px 32px;font-weight:600;font-size:14px;border-radius:4px;">${text}</a></div>`);
    } },
  ];

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className={`${LABEL} mb-0`}>{label}</label>
          <VariablePicker onInsert={insertAtCursor} />
        </div>
      )}

      <div className="border border-digi-border rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-digi-card border-b border-digi-border">
          {toolbarBtns.map((btn) => (
            <button key={btn.title} type="button" onClick={btn.action} title={btn.title} aria-label={btn.title}
              className="w-7 h-7 flex items-center justify-center rounded-md text-digi-muted hover:bg-accent-light hover:text-accent transition-colors">
              <btn.Icon className="w-4 h-4" />
            </button>
          ))}
          <div className="flex-1" />
          <button type="button" onClick={() => setPreview(!preview)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium transition-colors ${
              preview ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text'
            }`} style={mf}>
            {preview ? <><Code2 className="w-3.5 h-3.5" /> Código</> : <><Eye className="w-3.5 h-3.5" /> Vista previa</>}
          </button>
        </div>

        {preview ? (
          // La vista previa resuelve las variables con datos de ejemplo, para que se vea
          // cómo va a quedar el correo de verdad y no los tokens crudos.
          <div
            className="px-3 py-2.5 bg-digi-darker text-sm text-digi-text min-h-[120px] overflow-auto"
            style={{ ...mf, maxHeight: rows * 24 }}
            dangerouslySetInnerHTML={{ __html: previewTemplate(value) || '<span style="opacity:.6;">Sin contenido</span>' }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-3 py-2.5 bg-digi-darker text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none resize-none border-0"
            style={mf}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Adjuntos ─── */
export function AttachmentsManager({
  attachments, onChange,
}: {
  attachments: { filename: string; content: string; size: number }[];
  onChange: (a: { filename: string; content: string; size: number }[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAdding(true);
    try {
      const next: { filename: string; content: string; size: number }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} supera el límite de 10MB`); continue; }
        const buffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
        next.push({ filename: file.name, content: base64, size: file.size });
      }
      onChange([...attachments, ...next]);
    } catch { toast.error('Error al leer los archivos'); }
    finally { setAdding(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const total = attachments.reduce((s, a) => s + a.size, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className={`${LABEL} mb-0`}>Archivos adjuntos</label>
        <div>
          <input ref={inputRef} type="file" multiple onChange={handleFiles} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={adding} className={BTN_SECONDARY}>
            <Paperclip className="w-4 h-4" /> {adding ? 'Cargando…' : 'Adjuntar'}
          </button>
        </div>
      </div>
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((a, i) => (
            <FileRow key={i} name={a.filename} meta={formatSize(a.size)}
              onRemove={() => onChange(attachments.filter((_, idx) => idx !== i))} />
          ))}
          <p className="text-[11px] text-digi-muted pt-0.5" style={mf}>
            {attachments.length} archivo{attachments.length > 1 ? 's' : ''} · {formatSize(total)} en total
          </p>
        </div>
      )}
    </div>
  );
}
