'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extensions';
import {
  Undo2, Redo2, Pilcrow, Heading1, Heading2, Heading3, Bold, Italic, Underline, Strikethrough,
  Highlighter, Code, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  ListChecks, Quote, SquareCode, Minus, Link2, ImagePlus, Table as TableIcon, RemoveFormatting,
  Rows3, Columns3, Trash2, Copy, Download,
} from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { EDIT_INPUT, EditField, QuickEditDialog } from '@/components/ui/EditDialog';
import { htmlToMarkdown } from '@/lib/admin/prompts-md';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** Pausa tras la última pulsación antes de guardar. */
const ESPERA_MS = 1200;

export interface DocumentoEditorHandle {
  /** Guarda YA lo pendiente. `false` = quedó algo sin guardar (error o conflicto). */
  flush: () => Promise<boolean>;
}

type Estado =
  | { k: 'guardado'; at: string | null }
  | { k: 'pendiente' }
  | { k: 'guardando' }
  | { k: 'error'; msg: string }
  | { k: 'conflicto'; at: string | null };

/**
 * La hoja de un proyecto en Admin ▸ Prompts: editor con formato (TipTap) y guardado
 * automático. Se monta con `key={projectId}`: cada proyecto, su editor.
 *
 * Guardado: tras `ESPERA_MS` sin escribir se manda el HTML entero con la fecha del
 * documento que se abrió; si otro guardó después, el servidor responde 409 y aquí se
 * ofrece recargar o quedarse con lo propio — nunca se pisa en silencio.
 */
const DocumentoEditor = forwardRef<DocumentoEditorHandle, {
  projectId: number;
  title: string;
  initialHtml: string;
  initialUpdatedAt: string | null;
  onSaved: (chars: number, updatedAt: string) => void;
  onReload: () => void;
}>(function DocumentoEditor({ projectId, title, initialHtml, initialUpdatedAt, onSaved, onReload }, ref) {
  const [estado, setEstado] = useState<Estado>({ k: 'guardado', at: initialUpdatedAt });
  const baseRef = useRef<string | null>(initialUpdatedAt);
  const sucioRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enCursoRef = useRef<Promise<void> | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const guardar = useCallback(async (forzar = false): Promise<void> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Un guardado a la vez: si hay uno en vuelo, se espera y se vuelve a mirar.
    if (enCursoRef.current) { await enCursoRef.current; }
    const ed = editorRef.current;
    if (!ed || (!sucioRef.current && !forzar)) return;
    sucioRef.current = false;
    setEstado({ k: 'guardando' });
    const p = (async () => {
      try {
        const res = await fetch(`/api/admin/prompts/${projectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: ed.getHTML(), baseUpdatedAt: baseRef.current }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.status === 409) {
          sucioRef.current = true;
          setEstado({ k: 'conflicto', at: j.updatedAt ?? null });
          return;
        }
        if (!res.ok) throw new Error(j.error || 'No se pudo guardar.');
        baseRef.current = j.data.updatedAt;
        onSaved(j.data.chars, j.data.updatedAt);
        setEstado(sucioRef.current ? { k: 'pendiente' } : { k: 'guardado', at: j.data.updatedAt });
      } catch (e: any) {
        sucioRef.current = true;
        setEstado({ k: 'error', msg: e.message || 'No se pudo guardar.' });
      }
    })();
    enCursoRef.current = p;
    await p;
    enCursoRef.current = null;
    // Lo escrito mientras volaba el guardado sale en el siguiente.
    if (sucioRef.current && !timerRef.current) programar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, onSaved]);

  const programar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; void guardar(); }, ESPERA_MS);
  }, [guardar]);

  const subirImagen = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const t = toast.loading('Subiendo imagen…');
    try {
      const res = await fetch('/api/admin/prompts/imagen', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo subir la imagen.');
      editorRef.current?.chain().focus().setImage({ src: j.data.url, alt: file.name }).run();
      toast.success('Imagen añadida', { id: t });
    } catch (e: any) {
      toast.error(e.message, { id: t });
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Placeholder.configure({ placeholder: 'Escribe aquí la documentación del proyecto…' }),
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: { spellcheck: 'true', lang: 'es' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => void subirImagen(f));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => void subirImagen(f));
        return true;
      },
    },
    onUpdate: () => {
      sucioRef.current = true;
      setEstado((e) => (e.k === 'conflicto' ? e : { k: 'pendiente' }));
      programar();
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  useImperativeHandle(ref, () => ({
    flush: async () => { await guardar(); return !sucioRef.current; },
  }), [guardar]);

  // Cerrar la pestaña con algo sin guardar: el navegador pregunta.
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (sucioRef.current || enCursoRef.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', aviso);
    return () => {
      window.removeEventListener('beforeunload', aviso);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const markdown = () => {
    const cuerpo = htmlToMarkdown(editor?.getHTML() ?? '');
    return `# ${title}\n\n${cuerpo}`.trim() + '\n';
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(markdown());
      toast.success('Copiado como prompt (Markdown)');
    } catch {
      toast.error('El navegador no dejó copiar.');
    }
  };

  const descargar = () => {
    const blob = new Blob([markdown()], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `proyecto-${projectId}`;
    a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* ⚠️ La barra y el contador se montan cuando el editor YA existe: `useEditorState`
          arrancado con `null` no se recalcula hasta la primera transacción, y la barra
          salía vacía hasta tocar la hoja. */}
      {editor ? <BarraFormato editor={editor} onImagen={subirImagen} /> : <div className="shrink-0 h-[45px] border-b border-digi-border" />}

      {/* La hoja: página blanca centrada; el scroll es de esta zona, no de la página. */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-digi-dark px-2 py-4 sm:px-6 sm:py-8">
        <div
          className="doc-hoja mx-auto w-full max-w-[816px] bg-digi-card border border-digi-border rounded-sm shadow-sm px-5 py-8 sm:px-16 sm:py-14 cursor-text"
          onClick={(e) => { if (e.target === e.currentTarget) editor?.chain().focus('end').run(); }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Pie: lo que pasa con el guardado a la izquierda, las acciones abajo a la derecha. */}
      <div className="shrink-0 px-3 py-2 border-t border-digi-border flex flex-wrap items-center gap-2">
        <EstadoGuardado estado={estado} onReintentar={() => void guardar(true)} onReload={onReload}
          onSobrescribir={() => { if (estado.k === 'conflicto') { baseRef.current = estado.at; void guardar(true); } }} />
        {editor && <Contador editor={editor} />}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={descargar} className={BTN_SECONDARY} title="Descargar el documento en Markdown">
            <Download className="w-4 h-4" /> Descargar .md
          </button>
          <button type="button" onClick={copiar} className={BTN_PRIMARY}>
            <Copy className="w-4 h-4" /> Copiar como prompt
          </button>
        </div>
      </div>
    </div>
  );
});

export default DocumentoEditor;

function Contador({ editor }: { editor: Editor }) {
  const chars = useEditorState({
    editor,
    selector: ({ editor: e }) => e.getText().replace(/\s+/g, ' ').trim().length,
  });
  return (
    <span className="text-[11.5px] text-digi-muted tabular-nums" style={mf}>
      {chars.toLocaleString('es-ES')} caracteres
    </span>
  );
}

function EstadoGuardado({ estado, onReintentar, onReload, onSobrescribir }: {
  estado: Estado; onReintentar: () => void; onReload: () => void; onSobrescribir: () => void;
}) {
  const base = 'text-[11.5px]';
  if (estado.k === 'guardando') return <span className={`${base} text-digi-muted`} style={mf}>Guardando…</span>;
  if (estado.k === 'pendiente') return <span className={`${base} text-digi-muted`} style={mf}>Cambios sin guardar</span>;
  if (estado.k === 'error') {
    return (
      <span className={`${base} text-red-600 flex items-center gap-2`} style={mf}>
        {estado.msg}
        <button type="button" onClick={onReintentar} className="font-medium underline">Reintentar</button>
      </span>
    );
  }
  if (estado.k === 'conflicto') {
    return (
      <span className={`${base} text-amber-700 flex flex-wrap items-center gap-2`} style={mf}>
        Este documento se guardó en otra ventana.
        <button type="button" onClick={onReload} className="font-medium underline">Cargar esa versión</button>
        <button type="button" onClick={onSobrescribir} className="font-medium underline">Quedarme con la mía</button>
      </span>
    );
  }
  const hora = estado.at
    ? new Date(estado.at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;
  return <span className={`${base} text-digi-muted`} style={mf}>{hora ? `Guardado · ${hora}` : 'Sin documento todavía'}</span>;
}

/* ─────────────────────────── Barra de formato ─────────────────────────── */

const TB = 'inline-flex shrink-0 items-center justify-center w-8 h-8 rounded transition-colors disabled:opacity-35 disabled:pointer-events-none';
const SEP = <span aria-hidden className="w-px h-5 bg-digi-border mx-1 shrink-0" />;

function Btn({ on, label, Icon, onClick, disabled }: {
  on?: boolean; label: string; Icon: React.ComponentType<{ className?: string }>; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`${TB} ${on ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-black/[0.05]'}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function BarraFormato({ editor, onImagen }: { editor: Editor; onImagen: (f: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [enlace, setEnlace] = useState<string | null>(null);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      return {
        undo: e.can().undo(), redo: e.can().redo(),
        p: e.isActive('paragraph'), h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }), h3: e.isActive('heading', { level: 3 }),
        bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'),
        strike: e.isActive('strike'), mark: e.isActive('highlight'), code: e.isActive('code'),
        left: e.isActive({ textAlign: 'left' }), center: e.isActive({ textAlign: 'center' }),
        right: e.isActive({ textAlign: 'right' }), justify: e.isActive({ textAlign: 'justify' }),
        ul: e.isActive('bulletList'), ol: e.isActive('orderedList'), task: e.isActive('taskList'),
        quote: e.isActive('blockquote'), pre: e.isActive('codeBlock'), link: e.isActive('link'),
        table: e.isActive('table'),
      };
    },
  });

  const c = () => editor.chain().focus();

  const abrirEnlace = () => setEnlace((editor.getAttributes('link').href as string | undefined) ?? '');
  const guardarEnlace = () => {
    const url = (enlace ?? '').trim();
    if (!url) c().extendMarkRange('link').unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run();
    setEnlace(null);
  };

  return (
    // En el teléfono, UNA fila que se desliza: partida en cuatro se comía un tercio de la hoja.
    <div className="shrink-0 px-2 py-1.5 border-b border-digi-border flex flex-nowrap sm:flex-wrap items-center gap-0.5 overflow-x-auto">
      <Btn label="Deshacer" Icon={Undo2} onClick={() => c().undo().run()} disabled={!s.undo} />
      <Btn label="Rehacer" Icon={Redo2} onClick={() => c().redo().run()} disabled={!s.redo} />
      {SEP}
      <Btn label="Texto normal" Icon={Pilcrow} on={s.p} onClick={() => c().setParagraph().run()} />
      <Btn label="Título 1" Icon={Heading1} on={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} />
      <Btn label="Título 2" Icon={Heading2} on={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} />
      <Btn label="Título 3" Icon={Heading3} on={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} />
      {SEP}
      <Btn label="Negrita (Ctrl+B)" Icon={Bold} on={s.bold} onClick={() => c().toggleBold().run()} />
      <Btn label="Cursiva (Ctrl+I)" Icon={Italic} on={s.italic} onClick={() => c().toggleItalic().run()} />
      <Btn label="Subrayado (Ctrl+U)" Icon={Underline} on={s.underline} onClick={() => c().toggleUnderline().run()} />
      <Btn label="Tachado" Icon={Strikethrough} on={s.strike} onClick={() => c().toggleStrike().run()} />
      <Btn label="Resaltar" Icon={Highlighter} on={s.mark} onClick={() => c().toggleHighlight().run()} />
      <Btn label="Código en línea" Icon={Code} on={s.code} onClick={() => c().toggleCode().run()} />
      {SEP}
      <Btn label="Alinear a la izquierda" Icon={AlignLeft} on={s.left} onClick={() => c().setTextAlign('left').run()} />
      <Btn label="Centrar" Icon={AlignCenter} on={s.center} onClick={() => c().setTextAlign('center').run()} />
      <Btn label="Alinear a la derecha" Icon={AlignRight} on={s.right} onClick={() => c().setTextAlign('right').run()} />
      <Btn label="Justificar" Icon={AlignJustify} on={s.justify} onClick={() => c().setTextAlign('justify').run()} />
      {SEP}
      <Btn label="Lista con viñetas" Icon={List} on={s.ul} onClick={() => c().toggleBulletList().run()} />
      <Btn label="Lista numerada" Icon={ListOrdered} on={s.ol} onClick={() => c().toggleOrderedList().run()} />
      <Btn label="Lista de tareas" Icon={ListChecks} on={s.task} onClick={() => c().toggleTaskList().run()} />
      {SEP}
      <Btn label="Cita" Icon={Quote} on={s.quote} onClick={() => c().toggleBlockquote().run()} />
      <Btn label="Bloque de código" Icon={SquareCode} on={s.pre} onClick={() => c().toggleCodeBlock().run()} />
      <Btn label="Línea divisoria" Icon={Minus} onClick={() => c().setHorizontalRule().run()} />
      <Btn label="Enlace" Icon={Link2} on={s.link} onClick={abrirEnlace} />
      <Btn label="Imagen" Icon={ImagePlus} onClick={() => fileRef.current?.click()} />
      <Btn label="Insertar tabla" Icon={TableIcon} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={s.table} />
      {s.table && (
        <>
          {SEP}
          <Btn label="Fila debajo" Icon={Rows3} onClick={() => c().addRowAfter().run()} />
          <Btn label="Columna a la derecha" Icon={Columns3} onClick={() => c().addColumnAfter().run()} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteRow().run()}
            className="shrink-0 whitespace-nowrap px-2 h-8 rounded text-[11.5px] text-digi-muted hover:text-digi-text hover:bg-black/[0.05]" style={mf}>Quitar fila</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteColumn().run()}
            className="shrink-0 whitespace-nowrap px-2 h-8 rounded text-[11.5px] text-digi-muted hover:text-digi-text hover:bg-black/[0.05]" style={mf}>Quitar columna</button>
          <Btn label="Eliminar tabla" Icon={Trash2} onClick={() => c().deleteTable().run()} />
        </>
      )}
      {SEP}
      <Btn label="Quitar formato" Icon={RemoveFormatting} onClick={() => c().unsetAllMarks().clearNodes().run()} />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImagen(f); e.target.value = ''; }}
      />

      <QuickEditDialog
        open={enlace !== null}
        title="Enlace"
        onClose={() => setEnlace(null)}
        onSave={guardarEnlace}
        saveLabel={enlace && !enlace.trim() && s.link ? 'Quitar enlace' : 'Aplicar'}
      >
        <EditField label="Dirección">
          <input className={EDIT_INPUT} value={enlace ?? ''} onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://…" autoFocus />
        </EditField>
      </QuickEditDialog>
    </div>
  );
}
