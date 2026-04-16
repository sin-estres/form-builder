/**
 * FormulaEditorWidget.ts  (v2)
 *
 * Rich contenteditable formula editor with:
 *  - Dual representation: chips (labels) in UI, {ref}/ref internally
 *  - High-contrast operators — never faded, always at full text contrast
 *  - Clear (×) button with animated visibility
 *  - Stable deserialization: always re-derives from the stored expression
 *  - `resolveFields` for resolving ALL schema refs (separate from insert-dropdown filtering)
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PUBLIC API                                                             │
 * │  setValue(expr)        load + render from internal expression          │
 * │  getValue()            current internal expression                     │
 * │  insertField(field)    cursor-aware chip insertion                     │
 * │  insertText(text)      cursor-aware text insertion                     │
 * │  clear()               wipe expression, fire onChange('')              │
 * │  setError(bool)        red-border validation state                     │
 * │  updateFields(fields)  refresh fieldMap + re-render                   │
 * │  focus()               focus the editable area                        │
 * │  getElement()          root DOM node to mount                         │
 * │  destroy()             remove from DOM                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import {
    FieldInfo,
    FormulaSyntaxMode,
    buildFieldMap,
    getFieldRef,
    parseExpressionToTokens,
} from '../utils/formulaTokenParser';

// ─── Style injection ──────────────────────────────────────────────────────────

let _stylesInjected = false;
const STYLE_ID = 'formula-editor-widget-styles-v2';

function injectStyles(): void {
    if (_stylesInjected && document.getElementById(STYLE_ID)) return;
    // Remove stale previous version if present (handles hot-reload scenarios)
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById('formula-editor-widget-styles')?.remove();
    _stylesInjected = true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* ══════════════════════════════════════════════════════════════════════════
   FormulaEditorWidget v2
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Container ────────────────────────────────────────────────────────────── */
.few-container {
  position: relative;
  width: 100%;
}

/* ── Editor ───────────────────────────────────────────────────────────────── */
/*
 * NOTE: color uses !important so it is never muted by
 * Angular ViewEncapsulation, host-element rules, or global resets.
 * This ensures operators/numbers always render at full text contrast.
 */
.few-editor {
  display: block;
  width: 100%;
  min-height: 38px;
  padding: 6px 32px 6px 12px;   /* right padding reserves space for clear btn */
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
  font-size: 13px;
  font-weight: 700 !important;   /* ← operators/numbers always bold */
  line-height: 1.7;
  color: rgb(213, 12, 65) !important;  /* operator/text color — chips override with their own !important */
  caret-color: #635bff;
  background: transparent;
  outline: none;
  word-break: break-word;
  white-space: pre-wrap;
  cursor: text;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}

.few-editor:focus {
  border-color: #635bff;
  box-shadow: 0 0 0 3px rgba(99, 91, 255, 0.15);
}

.few-editor.few-has-error {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

/* ── Placeholder ──────────────────────────────────────────────────────────── */
.few-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 32px;  /* don't overlap clear button */
  bottom: 0;
  padding: 6px 0 6px 12px;
  font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: #94a3b8;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Field chip ───────────────────────────────────────────────────────────── */
.few-chip {
  display: inline-flex;
  align-items: center;
  padding: 0px 7px 1px 6px;
  margin: 0 2px;
  font-size: 11.5px;
  font-weight: 600 !important;   /* explicit !important so the editor's 700 !important doesn't cascade in */
  font-family: ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.01em;
  border-radius: 4px;
  background: rgba(99, 91, 255, 0.10);
  color: #635bff !important;     /* chip label always purple — not inherited */
  border: 1px solid rgba(99, 91, 255, 0.28);
  cursor: default;
  user-select: none;
  vertical-align: middle;
  line-height: 1.6;
  white-space: nowrap;
  transition: background 0.1s;
}

.few-chip:hover {
  background: rgba(99, 91, 255, 0.17);
}

.few-chip-unknown {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626 !important;
  border-color: rgba(239, 68, 68, 0.25);
}

/* ── Clear (×) button ─────────────────────────────────────────────────────── */
.few-clear-btn {
  position: absolute;
  top: 50%;
  right: 7px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: #94a3b8;
  color: #ffffff;
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s, background 0.15s;
  z-index: 2;
}

.few-clear-btn:hover {
  background: #475569;
}

/* Shown only when the editor has content */
.few-container.few-has-content .few-clear-btn {
  opacity: 1;
  pointer-events: auto;
}

/* ── Dark mode (media query) ──────────────────────────────────────────────── */
@media (prefers-color-scheme: dark) {
  .few-editor {
    border-color: #334155;
    /* operator color is set via inline !important — not overridden here */
  }
  .few-editor:focus {
    border-color: #635bff;
    box-shadow: 0 0 0 3px rgba(99, 91, 255, 0.25);
  }
  .few-placeholder { color: #64748b; }
  .few-chip {
    background: rgba(99, 91, 255, 0.18);
    color: #a5b4fc !important;
    border-color: rgba(99, 91, 255, 0.38);
  }
  .few-chip-unknown {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171 !important;
    border-color: rgba(239, 68, 68, 0.35);
  }
  .few-clear-btn {
    background: #64748b;
    color: #f1f5f9;
  }
  .few-clear-btn:hover { background: #475569; }
}

/* ── Dark mode (Tailwind class strategy) ──────────────────────────────────── */
.dark .few-editor {
  border-color: #334155;
  /* operator color is set via inline !important — not overridden here */
}
.dark .few-editor:focus {
  border-color: #635bff;
  box-shadow: 0 0 0 3px rgba(99, 91, 255, 0.25);
}
.dark .few-placeholder { color: #64748b; }
.dark .few-chip {
  background: rgba(99, 91, 255, 0.18);
  color: #a5b4fc !important;
  border-color: rgba(99, 91, 255, 0.38);
}
.dark .few-chip-unknown {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171 !important;
  border-color: rgba(239, 68, 68, 0.35);
}
.dark .few-clear-btn {
  background: #64748b;
  color: #f1f5f9;
}
.dark .few-clear-btn:hover { background: #475569; }
    `;
    document.head.appendChild(style);
}

// ─── Options ──────────────────────────────────────────────────────────────────

export interface FormulaEditorWidgetOptions {
    /**
     * Syntax mode:
     *  'bracket' → {fieldRef} placeholders   (formula-type field)
     *  'plain'   → bare identifiers           (number field with valueSource='formula')
     */
    mode: FormulaSyntaxMode;

    /**
     * Fields available in the fieldMap for LABEL RESOLUTION when deserializing
     * a stored expression.  Pass ALL schema fields here (not just numeric) so
     * that any previously-saved ref can always be shown with its label.
     *
     * The insert-dropdown filtering logic lives in FormBuilder, not here.
     */
    availableFields: FieldInfo[];

    /** Stored expression used to pre-populate the editor on construction. */
    initialValue?: string;

    /** Placeholder shown when editor is empty. */
    placeholder?: string;

    /**
     * Called whenever the internal expression changes (user edit or chip insert).
     * Receives the new raw internal expression string (not the display string).
     */
    onChange?: (internalExpression: string) => void;
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export class FormulaEditorWidget {
    private _container: HTMLDivElement;
    private _editor: HTMLDivElement;
    private _placeholderEl: HTMLDivElement;
    private _clearBtn: HTMLButtonElement;
    private _options: FormulaEditorWidgetOptions;
    private _fieldMap: Map<string, FieldInfo>;

    /**
     * The canonical internal expression — SINGLE SOURCE OF TRUTH.
     * The DOM is always derived from this; never the reverse.
     * Updated by _onEditorInput() (user edits) and setValue() (programmatic).
     */
    private _internalValue: string = '';

    constructor(options: FormulaEditorWidgetOptions) {
        injectStyles();

        this._options = { ...options };
        this._fieldMap = buildFieldMap(options.availableFields);

        // ── Container ──────────────────────────────────────────────────────────
        this._container = document.createElement('div');
        this._container.className = 'few-container';

        // ── Placeholder ────────────────────────────────────────────────────────
        this._placeholderEl = document.createElement('div');
        this._placeholderEl.className = 'few-placeholder';
        this._placeholderEl.textContent = options.placeholder ?? 'Enter formula…';

        // ── Editor ─────────────────────────────────────────────────────────────
        this._editor = document.createElement('div');
        this._editor.className = 'few-editor';
        this._editor.contentEditable = 'true';
        this._editor.spellcheck = false;
        this._editor.setAttribute('autocomplete', 'off');
        this._editor.setAttribute('autocorrect', 'off');
        this._editor.setAttribute('autocapitalize', 'off');
        this._editor.setAttribute('data-formula-editor', 'true');
        // Force operator/text color and bold weight via inline !important — beats
        // any Angular ViewEncapsulation rule that lands after our injected <style>.
        this._editor.style.setProperty('color', 'rgb(213, 12, 65)', 'important');
        this._editor.style.setProperty('font-weight', '700', 'important');
        this._editor.style.setProperty('caret-color', '#635bff', 'important');

        // ── Clear button ───────────────────────────────────────────────────────
        this._clearBtn = document.createElement('button');
        this._clearBtn.type = 'button';
        this._clearBtn.className = 'few-clear-btn';
        this._clearBtn.title = 'Clear formula';
        this._clearBtn.textContent = '×';
        this._clearBtn.addEventListener('mousedown', (e) => {
            // Use mousedown + preventDefault so the editor doesn't lose focus
            // before we clear it (avoids caret-position races).
            e.preventDefault();
            this.clear();
        });

        this._container.appendChild(this._placeholderEl);
        this._container.appendChild(this._editor);
        this._container.appendChild(this._clearBtn);

        this._attachEvents();

        // Deserialize initial value → chips + text nodes
        if (options.initialValue) {
            this.setValue(options.initialValue);
        } else {
            this._syncUI();
        }
    }

    // ─── Internal event wiring ───────────────────────────────────────────────

    private _attachEvents(): void {
        // input: fired after every DOM change in the contenteditable
        this._editor.addEventListener('input', () => this._onEditorInput());

        // keydown: block Enter (no multi-line formulas) + handle Backspace on chips
        this._editor.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); return; }
            if (e.key === 'Backspace') this._handleBackspaceOnChip(e);
        });

        // paste: strip rich content, insert plain text
        this._editor.addEventListener('paste', (e: ClipboardEvent) => {
            e.preventDefault();
            const text = e.clipboardData?.getData('text/plain') ?? '';
            if (text) {
                this._insertTextAtCaret(text);
                this._onEditorInput();
            }
        });

        // block drag-drop to prevent stray HTML from entering the editor
        this._editor.addEventListener('dragover', (e) => e.preventDefault());
        this._editor.addEventListener('drop', (e) => e.preventDefault());
    }

    // ─── Core edit cycle ─────────────────────────────────────────────────────

    private _onEditorInput(): void {
        this._normaliseDom();
        const newValue = this._readInternalExpression();
        const changed = newValue !== this._internalValue;
        this._internalValue = newValue;
        this._syncUI();
        if (changed) {
            this._options.onChange?.(newValue);
        }
    }

    /**
     * Remove browser-inserted artefacts (<br>, stray <div>/<span>) that some
     * browsers inject into a contenteditable.  Chips (data-field-ref) are kept.
     */
    private _normaliseDom(): void {
        for (const node of Array.from(this._editor.childNodes)) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = node as HTMLElement;
            if (el.hasAttribute('data-field-ref')) continue; // keep chips
            if (el.tagName === 'BR') { el.remove(); continue; }
            // Unwrap any other element into a plain text node
            const textNode = document.createTextNode(el.textContent ?? '');
            this._editor.replaceChild(textNode, el);
        }
    }

    /**
     * Backspace immediately before a chip should delete the whole chip, not
     * step into its non-editable content.
     */
    private _handleBackspaceOnChip(e: KeyboardEvent): void {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return; // selection present — let browser handle

        let prev: ChildNode | null = null;

        if (range.startContainer === this._editor) {
            if (range.startOffset > 0) prev = this._editor.childNodes[range.startOffset - 1];
        } else if (range.startContainer.nodeType === Node.TEXT_NODE) {
            if (range.startOffset === 0) prev = range.startContainer.previousSibling;
        }

        if (prev && (prev as HTMLElement).hasAttribute?.('data-field-ref')) {
            e.preventDefault();
            prev.remove();
            this._onEditorInput();
        }
    }

    // ─── Serialisation: DOM → internal expression ────────────────────────────

    private _readInternalExpression(): string {
        let result = '';
        for (const node of Array.from(this._editor.childNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
                result += node.textContent ?? '';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const ref = el.getAttribute('data-field-ref');
                if (ref !== null) {
                    result += this._options.mode === 'bracket' ? `{${ref}}` : ref;
                } else {
                    result += el.textContent ?? '';
                }
            }
        }
        return result;
    }

    // ─── Deserialization: internal expression → DOM ──────────────────────────

    /**
     * Load an internal expression string.
     *
     * This is the ONLY path that populates the editor with chips.
     * It does NOT fire onChange (programmatic set ≠ user edit).
     *
     * Design invariant: the DOM is ALWAYS fully rebuilt from _internalValue,
     * never from user-visible text.  This guarantees correct state on re-render
     * after field switches, undo/redo, or hot-reload.
     */
    setValue(internalExpression: string): void {
        this._internalValue = internalExpression ?? '';
        this._editor.innerHTML = '';

        if (this._internalValue.trim()) {
            const tokens = parseExpressionToTokens(
                this._internalValue,
                this._fieldMap,
                this._options.mode
            );

            for (const token of tokens) {
                if (token.type === 'field' && token.fieldRef !== undefined) {
                    // Resolve ref → FieldInfo (fallback to raw ref if unknown)
                    const field = this._fieldMap.get(token.fieldRef) ?? {
                        id: token.fieldRef,
                        fieldName: token.fieldRef,
                        label: token.fieldRef,       // shows raw ref — still readable
                    };
                    const isUnknown = !this._fieldMap.has(token.fieldRef);
                    this._editor.appendChild(this._createChipEl(field, isUnknown));
                } else {
                    // Operator / number / paren / function / space → plain text node
                    // Text nodes inherit color from .few-editor (always high-contrast)
                    this._editor.appendChild(document.createTextNode(token.value));
                }
            }
        }

        this._syncUI();
    }

    /** Return the current stored expression. Always reflects live DOM state. */
    getValue(): string {
        return this._readInternalExpression();
    }

    // ─── Public mutation ─────────────────────────────────────────────────────

    /**
     * Insert a field chip at the caret (or append if editor lacks focus).
     * Handles spacing automatically so chips never run into adjacent text.
     */
    insertField(field: FieldInfo): void {
        this._editor.focus();
        const chip = this._createChipEl(field, false);

        const sel = window.getSelection();
        const inEditor = sel && sel.rangeCount > 0
            && this._editor.contains(sel.getRangeAt(0).commonAncestorContainer);

        if (inEditor) {
            const range = sel!.getRangeAt(0);
            range.deleteContents();

            if (this._needsSpaceBefore(range)) {
                range.insertNode(document.createTextNode(' '));
                range.collapse(false);
            }

            range.insertNode(chip);

            const spaceAfter = document.createTextNode(' ');
            range.setStartAfter(chip);
            range.setEndAfter(chip);
            range.insertNode(spaceAfter);
            range.setStartAfter(spaceAfter);
            range.setEndAfter(spaceAfter);

            sel!.removeAllRanges();
            sel!.addRange(range);
        } else {
            this._appendAtEnd(chip);
        }

        this._onEditorInput();
    }

    /**
     * Insert plain text at the caret (operators, function names, parens).
     * Operators rendered by this path are text nodes and always inherit
     * .few-editor's high-contrast color.
     */
    insertText(text: string): void {
        this._editor.focus();
        this._insertTextAtCaret(text);
        this._onEditorInput();
    }

    /**
     * Clear the entire formula expression.
     * Fires onChange('') so the store is updated immediately.
     */
    clear(): void {
        this._editor.innerHTML = '';
        this._internalValue = '';
        this._syncUI();
        this._options.onChange?.('');
    }

    // ─── Visual state ────────────────────────────────────────────────────────

    /** Toggle error (red border) state. */
    setError(hasError: boolean): void {
        this._editor.classList.toggle('few-has-error', hasError);
    }

    /**
     * Refresh the field map with a new field list (e.g. schema changed).
     * Re-renders from _internalValue so stale labels / unknowns are resolved.
     */
    updateFields(fields: FieldInfo[]): void {
        this._options.availableFields = fields;
        this._fieldMap = buildFieldMap(fields);
        this.setValue(this._internalValue);
    }

    /** Return the root element to mount. */
    getElement(): HTMLElement { return this._container; }

    /** Focus the editable area. */
    focus(): void { this._editor.focus(); }

    /** Remove from DOM. */
    destroy(): void { this._container.remove(); }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private _insertTextAtCaret(text: string): void {
        const sel = window.getSelection();
        const inEditor = sel && sel.rangeCount > 0
            && this._editor.contains(sel.getRangeAt(0).commonAncestorContainer);

        if (inEditor) {
            const range = sel!.getRangeAt(0);
            range.deleteContents();
            const tn = document.createTextNode(text);
            range.insertNode(tn);
            range.setStartAfter(tn);
            range.setEndAfter(tn);
            sel!.removeAllRanges();
            sel!.addRange(range);
        } else {
            this._editor.appendChild(document.createTextNode(text));
        }
    }

    private _appendAtEnd(chip: HTMLElement): void {
        const last = this._editor.lastChild;
        if (last) {
            if (last.nodeType === Node.TEXT_NODE) {
                const txt = last.textContent ?? '';
                if (txt.length > 0 && !/\s$/.test(txt)) {
                    this._editor.appendChild(document.createTextNode(' '));
                }
            } else if ((last as HTMLElement).hasAttribute?.('data-field-ref')) {
                this._editor.appendChild(document.createTextNode(' '));
            }
        }
        this._editor.appendChild(chip);
        this._editor.appendChild(document.createTextNode(' '));
    }

    private _needsSpaceBefore(range: Range): boolean {
        const { startContainer, startOffset } = range;
        if (startContainer.nodeType === Node.TEXT_NODE) {
            const text = startContainer.textContent ?? '';
            const ch = text[startOffset - 1];
            return startOffset > 0 && ch !== undefined && !/[\s(]/.test(ch);
        }
        if (startContainer === this._editor && startOffset > 0) {
            const prev = this._editor.childNodes[startOffset - 1];
            return (prev as HTMLElement)?.hasAttribute?.('data-field-ref') ?? false;
        }
        return false;
    }

    private _createChipEl(field: FieldInfo, isUnknown: boolean): HTMLElement {
        const chip = document.createElement('span');
        chip.contentEditable = 'false';
        chip.setAttribute('data-field-ref', getFieldRef(field));
        chip.textContent = field.label || field.fieldName || field.id;
        chip.className = isUnknown ? 'few-chip few-chip-unknown' : 'few-chip';
        chip.title = this._options.mode === 'bracket'
            ? `{${getFieldRef(field)}}`
            : getFieldRef(field);
        return chip;
    }

    /**
     * Synchronise all purely-visual state:
     *  - placeholder visibility
     *  - clear-button visibility (few-has-content on container)
     */
    private _syncUI(): void {
        const hasContent = this._internalValue.trim().length > 0
            || !!this._editor.querySelector('[data-field-ref]');

        this._placeholderEl.style.display = hasContent ? 'none' : 'block';
        this._container.classList.toggle('few-has-content', hasContent);

        // Re-enforce inline !important color and weight on every sync cycle.
        // Angular's change detection can re-apply scoped host styles after DOM
        // mutations, so we keep our inline rules authoritative at all times.
        this._editor.style.setProperty('color', 'rgb(213, 12, 65)', 'important');
        this._editor.style.setProperty('font-weight', '700', 'important');
    }
}
