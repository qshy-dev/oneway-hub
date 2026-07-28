import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo2, Redo2, RemoveFormatting,
  Palette, Highlighter, ChevronDown, RotateCcw,
} from 'lucide-react';

const FONT_SIZES = [
  { label: '10', px: '10px' },
  { label: '12', px: '12px' },
  { label: '14', px: '14px' },
  { label: '16', px: '16px' },
  { label: '18', px: '18px' },
  { label: '20', px: '20px' },
  { label: '24', px: '24px' },
  { label: '28', px: '28px' },
  { label: '36', px: '36px' },
];

const TEXT_COLORS = [
  '#f1f5f9', '#ef4444', '#f59e0b', '#22c55e',
  '#3b82f6', '#a855f7', '#ec4899', '#94a3b8',
  '#ffffff', '#dc2626', '#d97706', '#16a34a',
  '#1d4ed8', '#7c3aed', '#be185d', '#475569',
];

const HIGHLIGHT_COLORS = [
  'transparent',
  '#fbbf24', '#34d399', '#60a5fa', '#f87171',
  '#c084fc', '#fde68a', '#a7f3d0', '#bfdbfe',
];

type Props = {
  value: string;
  onChange: (html: string) => void;
  onReset: () => void;
  placeholder: string;
  resetLabel: string;
};

function TBtn({ icon: Icon, onClick, active, title, disabled }: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      title={title}
      tabIndex={-1}
      className={`flex h-6 w-6 items-center justify-center rounded transition ${
        active ? 'bg-accent-500/20 text-accent-400' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Save the current browser selection as a range so we can restore it after a menu click. */
function saveSelection(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  return sel.getRangeAt(0).cloneRange();
}

function restoreSelection(range: Range | null) {
  if (!range) return;
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Apply a CSS font-size to the selection.
 * execCommand('fontSize') only accepts 1-7, so we use the font-tag trick:
 * set size "7" to get a unique marker, then replace all <font size="7"> with
 * <span style="font-size: Xpx">.
 */
function applyFontSize(editor: HTMLDivElement, px: string) {
  editor.focus();
  // Use a random marker value so we don't clobber other font tags
  const MARKER = '__sz__';
  document.execCommand('styleWithCSS', false, 'false');
  document.execCommand('fontSize', false, '7');
  // Now find every <font size="7"> inside the editor and replace with a styled span
  const fonts = Array.from(editor.querySelectorAll('font[size="7"]'));
  fonts.forEach((font) => {
    const span = document.createElement('span');
    span.style.fontSize = px;
    span.dataset.marker = MARKER;
    while (font.firstChild) span.appendChild(font.firstChild);
    font.parentNode?.replaceChild(span, font);
  });
  // Clean up marker attribute
  editor.querySelectorAll(`span[data-marker="${MARKER}"]`).forEach((el) => {
    (el as HTMLElement).removeAttribute('data-marker');
  });
}

export function RulesEditor({ value, onChange, onReset, placeholder, resetLabel }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const saveTimer = useRef<number | undefined>(undefined);
  const savedRangeRef = useRef<Range | null>(null);
  const [, setTick] = useState(0);
  const [showFloatBar, setShowFloatBar] = useState(false);
  const [floatPos, setFloatPos] = useState({ top: 0, left: 0 });
  const [colorMenu, setColorMenu] = useState<'text' | 'highlight' | null>(null);
  const [fontSizeMenu, setFontSizeMenu] = useState(false);

  // Sync from props when value changes externally (e.g. "New auction" resets template)
  const lastSyncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editorRef.current) return;
    if (lastSyncedRef.current === value) return;
    lastSyncedRef.current = value;
    editorRef.current.innerHTML = value;
    historyRef.current = [value];
    historyIdxRef.current = 0;
    setTick((t) => t + 1);
  }, [value]);

  const pushHistory = (html: string) => {
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    const trimmed = h.slice(0, idx + 1);
    if (trimmed[trimmed.length - 1] === html) return;
    trimmed.push(html);
    historyRef.current = trimmed.slice(-50);
    historyIdxRef.current = Math.min(idx + 1, 49);
    setTick((t) => t + 1);
  };

  const handleInput = () => {
    const html = editorRef.current?.innerHTML ?? '';
    lastSyncedRef.current = html;
    onChange(html);
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => pushHistory(html), 500);
  };

  const exec = (cmd: string, val?: string) => {
    restoreSelection(savedRangeRef.current);
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
    pushHistory(html);
    savedRangeRef.current = null;
  };

  const execColor = (cmd: 'foreColor' | 'hiliteColor', color: string) => {
    restoreSelection(savedRangeRef.current);
    if (cmd === 'foreColor') {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('foreColor', false, color);
    } else {
      // hiliteColor can be unreliable; wrap in a span with background-color inline
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        if (color === 'transparent') {
          // Remove highlights
          document.execCommand('hiliteColor', false, 'transparent');
        } else {
          const span = document.createElement('span');
          span.style.backgroundColor = color;
          try {
            range.surroundContents(span);
          } catch {
            // surroundContents fails for partial selections across elements — fallback
            document.execCommand('styleWithCSS', false, 'true');
            document.execCommand('hiliteColor', false, color);
          }
        }
      }
    }
    editorRef.current?.focus();
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
    pushHistory(html);
    savedRangeRef.current = null;
  };

  const undo = () => {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    historyIdxRef.current = idx - 1;
    const html = historyRef.current[idx - 1];
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
      onChange(html);
    }
    setTick((t) => t + 1);
  };

  const redo = () => {
    const idx = historyIdxRef.current;
    if (idx >= historyRef.current.length - 1) return;
    historyIdxRef.current = idx + 1;
    const html = historyRef.current[idx + 1];
    if (editorRef.current) {
      editorRef.current.innerHTML = html;
      onChange(html);
    }
    setTick((t) => t + 1);
  };

  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;

  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current) {
      setShowFloatBar(false);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setShowFloatBar(false);
      return;
    }
    // Save selection for color/size pickers that steal focus
    savedRangeRef.current = range.cloneRange();
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const rawTop = rect.top - containerRect.top - 44;
    const left = Math.max(4, Math.min(
      rect.left - containerRect.left + rect.width / 2 - 100,
      (containerRect.width || 288) - 210,
    ));
    setShowFloatBar(true);
    setFloatPos({ top: rawTop < 0 ? rect.bottom - containerRect.top + 4 : rawTop, left });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', checkSelection);
    return () => document.removeEventListener('selectionchange', checkSelection);
  }, [checkSelection]);

  // Close menus on outside click
  useEffect(() => {
    if (!colorMenu && !fontSizeMenu) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) return;
      setColorMenu(null);
      setFontSizeMenu(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [colorMenu, fontSizeMenu]);

  const clearFormat = () => {
    restoreSelection(savedRangeRef.current);
    document.execCommand('removeFormat');
    editorRef.current?.focus();
    const html = editorRef.current?.innerHTML ?? '';
    onChange(html);
    pushHistory(html);
    savedRangeRef.current = null;
  };

  const handleFontSize = (px: string) => {
    restoreSelection(savedRangeRef.current);
    if (editorRef.current) {
      applyFontSize(editorRef.current, px);
      const html = editorRef.current.innerHTML;
      onChange(html);
      pushHistory(html);
    }
    setFontSizeMenu(false);
    savedRangeRef.current = null;
  };

  return (
    <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col">
      {/* Main toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-0.5 border-b border-ink-800 pb-2">
        <TBtn icon={Undo2} onClick={undo} disabled={!canUndo} title="Undo" />
        <TBtn icon={Redo2} onClick={redo} disabled={!canRedo} title="Redo" />
        <TBtn icon={RotateCcw} onClick={onReset} title={resetLabel} />
        <div className="mx-1 h-4 w-px bg-ink-800" />
        <TBtn icon={AlignLeft} onClick={() => exec('justifyLeft')} title="Align left" />
        <TBtn icon={AlignCenter} onClick={() => exec('justifyCenter')} title="Align center" />
        <TBtn icon={AlignRight} onClick={() => exec('justifyRight')} title="Align right" />
        <TBtn icon={AlignJustify} onClick={() => exec('justifyFull')} title="Justify" />
        <div className="mx-1 h-4 w-px bg-ink-800" />
        <TBtn icon={List} onClick={() => exec('insertUnorderedList')} title="Bullet list" />
        <TBtn icon={ListOrdered} onClick={() => exec('insertOrderedList')} title="Ordered list" />
      </div>

      {/* Floating selection toolbar */}
      {showFloatBar && (
        <div
          className="absolute z-20 flex items-center gap-0.5 rounded-lg border border-ink-700 bg-ink-900 p-1 shadow-2xl"
          style={{ top: floatPos.top, left: floatPos.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <TBtn icon={Bold} onClick={() => exec('bold')} title="Bold" />
          <TBtn icon={Italic} onClick={() => exec('italic')} title="Italic" />
          <TBtn icon={Underline} onClick={() => exec('underline')} title="Underline" />
          <TBtn icon={Strikethrough} onClick={() => exec('strikeThrough')} title="Strikethrough" />
          <div className="mx-0.5 h-4 w-px bg-ink-700" />

          {/* Font size picker */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                savedRangeRef.current = saveSelection();
                setFontSizeMenu((v) => !v);
                setColorMenu(null);
              }}
              className="flex h-6 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold text-ink-400 hover:bg-ink-800 hover:text-ink-200"
            >
              Aa <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {fontSizeMenu && (
              <div className="absolute top-7 left-0 z-30 flex w-24 flex-col rounded-lg border border-ink-700 bg-ink-900 py-1 shadow-2xl">
                {FONT_SIZES.map(({ label, px }) => (
                  <button
                    key={px}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleFontSize(px); }}
                    className="flex items-center justify-between px-3 py-1 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                  >
                    <span style={{ fontSize: px }}>{label}</span>
                    <span className="text-[9px] text-ink-600">{label}px</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mx-0.5 h-4 w-px bg-ink-700" />

          {/* Text color picker */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                savedRangeRef.current = saveSelection();
                setColorMenu(colorMenu === 'text' ? null : 'text');
                setFontSizeMenu(false);
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              title="Text color"
            >
              <Palette className="h-3.5 w-3.5" />
            </button>
            {colorMenu === 'text' && (
              <div className="absolute top-7 left-0 z-30 grid grid-cols-4 gap-1 rounded-lg border border-ink-700 bg-ink-900 p-2 shadow-2xl">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execColor('foreColor', c); setColorMenu(null); }}
                    className="h-5 w-5 rounded border border-ink-600 transition hover:scale-110"
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Highlight/background color picker */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                savedRangeRef.current = saveSelection();
                setColorMenu(colorMenu === 'highlight' ? null : 'highlight');
                setFontSizeMenu(false);
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-ink-800 hover:text-ink-200"
              title="Highlight color"
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            {colorMenu === 'highlight' && (
              <div className="absolute top-7 left-0 z-30 grid grid-cols-3 gap-1 rounded-lg border border-ink-700 bg-ink-900 p-2 shadow-2xl">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execColor('hiliteColor', c); setColorMenu(null); }}
                    className="h-5 w-5 rounded border border-ink-600 transition hover:scale-110"
                    style={{
                      background: c === 'transparent'
                        ? 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 50% / 8px 8px'
                        : c,
                    }}
                    title={c === 'transparent' ? 'None' : c}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mx-0.5 h-4 w-px bg-ink-700" />
          <TBtn icon={RemoveFormatting} onClick={clearFormat} title="Clear formatting" />
        </div>
      )}

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="rules-editor min-h-0 flex-1 overflow-y-auto rounded-lg border border-ink-800 bg-ink-950 p-2.5 text-sm leading-relaxed text-ink-200 focus:border-accent-500/50 focus:outline-none"
        style={{ wordBreak: 'break-word' }}
      />
    </div>
  );
}
