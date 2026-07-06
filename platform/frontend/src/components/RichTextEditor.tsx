"use client";

import { useEffect, useRef } from "react";
import {
  descriptionToHtml,
  hasRichTextContent,
  sanitizeRichText,
} from "@/lib/richText";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const toolbarButton =
  "h-8 w-8 shrink-0 rounded-md border border-outline-variant/20 bg-surface-container-lowest text-xs font-semibold text-on-surface shadow-sm transition hover:border-primary/30 hover:bg-primary-fixed/20 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const nextHtml = descriptionToHtml(value);
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
  }, [value]);

  const sync = (replaceEditor = false) => {
    const editor = editorRef.current;
    if (!editor) return;
    const clean = sanitizeRichText(editor.innerHTML);
    onChange(hasRichTextContent(clean) ? clean : "");
    if (replaceEditor) editor.innerHTML = hasRichTextContent(clean) ? clean : "";
  };

  const run = (command: string, commandValue?: string) => {
    if (disabled) return;
    const editor = editorRef.current;
    editor?.focus();
    document.execCommand(command, false, commandValue);
    sync();
  };

  return (
    <div className={`rich-editor-shell ${className}`}>
      <div className="rich-editor-toolbar" aria-hidden={disabled}>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("formatBlock", "p")}
          aria-label="Paragraph"
          title="Paragraph"
        >
          ¶
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("formatBlock", "h3")}
          aria-label="Heading"
          title="Heading"
        >
          H
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("bold")}
          aria-label="Bold"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("italic")}
          aria-label="Italic"
          title="Italic"
        >
          <span className="italic">I</span>
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("underline")}
          aria-label="Underline"
          title="Underline"
        >
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("insertUnorderedList")}
          aria-label="Bullet list"
          title="Bullet list"
        >
          •
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("insertOrderedList")}
          aria-label="Numbered list"
          title="Numbered list"
        >
          1.
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run("formatBlock", "blockquote")}
          aria-label="Quote"
          title="Quote"
        >
          “
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            run("removeFormat");
            run("formatBlock", "p");
          }}
          aria-label="Clear formatting"
          title="Clear formatting"
        >
          Tx
        </button>
      </div>
      <div
        ref={editorRef}
        className="rich-editor-content"
        contentEditable={!disabled}
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
        onInput={() => sync()}
        onBlur={() => sync(true)}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          sync();
        }}
      />
    </div>
  );
}
