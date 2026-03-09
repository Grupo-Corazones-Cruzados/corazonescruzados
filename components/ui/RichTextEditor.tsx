"use client";

import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import styles from "./RichTextEditor.module.css";

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  label,
  value,
  onChange,
  placeholder = "Escribe el contenido del email...",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    immediatelyRender: false,
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: { class: styles.editor },
    },
  });

  if (!editor) return null;

  return (
    <div>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.wrapper}>
        <Toolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ---- Toolbar ----

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  const setLink = useCallback(() => {
    if (!editor || !linkUrl) {
      setShowLinkInput(false);
      return;
    }
    const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkUrl("");
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!editor || !imageUrl) {
      setShowImageInput(false);
      return;
    }
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl("");
    setShowImageInput(false);
  }, [editor, imageUrl]);

  if (!editor) return null;

  return (
    <div className={styles.toolbar}>
      {/* Text type */}
      <div className={styles.toolGroup}>
        <select
          className={styles.toolSelect}
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v === "p") editor.chain().focus().setParagraph().run();
            else if (v === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
            else if (v === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (v === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
        >
          <option value="p">Párrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
      </div>

      <span className={styles.divider} />

      {/* Inline formatting */}
      <div className={styles.toolGroup}>
        <ToolButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrita"
        >
          <b>B</b>
        </ToolButton>
        <ToolButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Cursiva"
        >
          <i>I</i>
        </ToolButton>
        <ToolButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Subrayado"
        >
          <u>U</u>
        </ToolButton>
      </div>

      <span className={styles.divider} />

      {/* Text color */}
      <div className={styles.toolGroup}>
        <input
          type="color"
          className={styles.colorInput}
          title="Color de texto"
          onInput={(e) =>
            editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()
          }
          value={editor.getAttributes("textStyle").color || "#000000"}
        />
      </div>

      <span className={styles.divider} />

      {/* Alignment */}
      <div className={styles.toolGroup}>
        <ToolButton
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Alinear izquierda"
        >
          <AlignLeftIcon />
        </ToolButton>
        <ToolButton
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Centrar"
        >
          <AlignCenterIcon />
        </ToolButton>
        <ToolButton
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Alinear derecha"
        >
          <AlignRightIcon />
        </ToolButton>
      </div>

      <span className={styles.divider} />

      {/* Lists */}
      <div className={styles.toolGroup}>
        <ToolButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista con viñetas"
        >
          <BulletListIcon />
        </ToolButton>
        <ToolButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <OrderedListIcon />
        </ToolButton>
      </div>

      <span className={styles.divider} />

      {/* Block elements */}
      <div className={styles.toolGroup}>
        <ToolButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Cita"
        >
          <QuoteIcon />
        </ToolButton>
        <ToolButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Línea horizontal"
        >
          —
        </ToolButton>
      </div>

      <span className={styles.divider} />

      {/* Link */}
      <div className={styles.toolGroup}>
        {showLinkInput ? (
          <>
            <input
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setLink()}
              style={{
                height: 32,
                padding: "0 8px",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-xs)",
                width: 180,
              }}
              autoFocus
            />
            <ToolButton active={false} onClick={setLink} title="Aplicar enlace">
              ✓
            </ToolButton>
            <ToolButton active={false} onClick={() => setShowLinkInput(false)} title="Cancelar">
              ✕
            </ToolButton>
          </>
        ) : (
          <>
            <ToolButton
              active={editor.isActive("link")}
              onClick={() => {
                if (editor.isActive("link")) {
                  editor.chain().focus().unsetLink().run();
                } else {
                  setShowLinkInput(true);
                }
              }}
              title="Enlace"
            >
              <LinkIcon />
            </ToolButton>
          </>
        )}
      </div>

      {/* Image */}
      <div className={styles.toolGroup}>
        {showImageInput ? (
          <>
            <input
              type="url"
              placeholder="URL de imagen..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addImage()}
              style={{
                height: 32,
                padding: "0 8px",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-xs)",
                width: 180,
              }}
              autoFocus
            />
            <ToolButton active={false} onClick={addImage} title="Insertar imagen">
              ✓
            </ToolButton>
            <ToolButton active={false} onClick={() => setShowImageInput(false)} title="Cancelar">
              ✕
            </ToolButton>
          </>
        ) : (
          <ToolButton
            active={false}
            onClick={() => setShowImageInput(true)}
            title="Imagen"
          >
            <ImageIcon />
          </ToolButton>
        )}
      </div>
    </div>
  );
}

// ---- Tool Button ----

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ""}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

// ---- SVG Icons (16×16) ----

function AlignLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3h12M2 6.5h8M2 10h12M2 13.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3h12M4 6.5h8M2 10h12M4 13.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 3h12M6 6.5h8M2 10h12M6 13.5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="4" r="1" fill="currentColor" />
      <circle cx="3" cy="8" r="1" fill="currentColor" />
      <circle cx="3" cy="12" r="1" fill="currentColor" />
      <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <text x="1.5" y="5.5" fill="currentColor" fontSize="5" fontWeight="700">1</text>
      <text x="1.5" y="9.5" fill="currentColor" fontSize="5" fontWeight="700">2</text>
      <text x="1.5" y="13.5" fill="currentColor" fontSize="5" fontWeight="700">3</text>
      <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 12V7.5a3 3 0 013-3M10 12V7.5a3 3 0 013-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6.5 9.5a3.5 3.5 0 005 0l2-2a3.5 3.5 0 00-5-5l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 6.5a3.5 3.5 0 00-5 0l-2 2a3.5 3.5 0 005 5l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 11l3.5-3 3 2.5 2-1.5 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
