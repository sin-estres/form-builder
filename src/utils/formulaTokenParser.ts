/**
 * formulaTokenParser.ts
 *
 * Token-based dual-representation parser for formula expressions.
 *
 * Supports two storage syntaxes:
 *  - 'bracket' mode  : {ref} placeholders  → used by the dedicated 'formula' field type
 *  - 'plain'   mode  : bare identifiers    → used by 'number' fields with valueSource='formula'
 *
 * Dual representation:
 *  - UI (display)   : human-readable labels  e.g.  "Length + Width"
 *  - Internal       : system-safe references e.g.  "{fieldA} + {fieldB}"  /  "fieldA + fieldB"
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormulaTokenType =
    | 'field'      // field reference ({ref} or bare identifier)
    | 'operator'   // +  -  *  /
    | 'percent'    // %
    | 'number'     // numeric literal  (integer or decimal)
    | 'paren'      // (  )
    | 'function'   // ROUND  ABS  MIN  MAX  FLOOR  CEIL  SQRT  POW
    | 'comma'      // ,
    | 'space'      // whitespace run
    | 'unknown';   // anything else (preserved as-is)

export type FormulaSyntaxMode = 'bracket' | 'plain';

export interface FieldInfo {
    /** Unique id of the field (short auto-generated id, e.g. "g471tj3") */
    id: string;
    /** API / storage key — fieldName property, falls back to id */
    fieldName: string;
    /** Human-readable display label e.g. "Product Length" */
    label: string;
}

export interface FormulaToken {
    type: FormulaTokenType;
    /** Display value — for 'field' tokens this is the human-readable label */
    value: string;
    /** Internal / storage value — for 'field' tokens this is the ref in storage format */
    rawValue: string;
    /**
     * For 'field' tokens: the reference key as it will be stored.
     * bracket mode → stored as `{fieldRef}`,  plain mode → stored as `fieldRef`
     */
    fieldRef?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FUNCTION_NAMES = new Set(['ROUND', 'ABS', 'MIN', 'MAX', 'FLOOR', 'CEIL', 'SQRT', 'POW']);
const OPERATOR_CHARS = new Set(['+', '-', '*', '/']);

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse an internal formula expression into a list of typed tokens.
 *
 * @param expression  Internal formula string  (e.g. "{fieldA} + {fieldB} * 1.18")
 * @param fieldMap    Map from any recognized ref key → FieldInfo
 * @param mode        'bracket' | 'plain'
 */
export function parseExpressionToTokens(
    expression: string,
    fieldMap: Map<string, FieldInfo>,
    mode: FormulaSyntaxMode
): FormulaToken[] {
    if (!expression) return [];

    const tokens: FormulaToken[] = [];
    let i = 0;
    const len = expression.length;

    while (i < len) {
        const ch = expression[i];

        // ── Whitespace ─────────────────────────────────────────────────────────
        if (/\s/.test(ch)) {
            let ws = '';
            while (i < len && /\s/.test(expression[i])) ws += expression[i++];
            tokens.push({ type: 'space', value: ws, rawValue: ws });
            continue;
        }

        // ── Bracket-mode field reference  {ref} ────────────────────────────────
        if (mode === 'bracket' && ch === '{') {
            i++; // consume '{'
            let ref = '';
            while (i < len && expression[i] !== '}') ref += expression[i++];
            if (i < len && expression[i] === '}') i++; // consume '}'
            const trimmedRef = ref.trim();
            const field = fieldMap.get(trimmedRef);
            tokens.push({
                type: 'field',
                value: field ? (field.label || field.fieldName || trimmedRef) : trimmedRef,
                rawValue: `{${trimmedRef}}`,
                fieldRef: trimmedRef,
            });
            continue;
        }

        // ── Operators ──────────────────────────────────────────────────────────
        if (OPERATOR_CHARS.has(ch)) {
            tokens.push({ type: 'operator', value: ch, rawValue: ch });
            i++;
            continue;
        }

        // ── Percent ────────────────────────────────────────────────────────────
        if (ch === '%') {
            tokens.push({ type: 'percent', value: '%', rawValue: '%' });
            i++;
            continue;
        }

        // ── Parentheses ────────────────────────────────────────────────────────
        if (ch === '(' || ch === ')') {
            tokens.push({ type: 'paren', value: ch, rawValue: ch });
            i++;
            continue;
        }

        // ── Comma ──────────────────────────────────────────────────────────────
        if (ch === ',') {
            tokens.push({ type: 'comma', value: ',', rawValue: ',' });
            i++;
            continue;
        }

        // ── Numeric literal ────────────────────────────────────────────────────
        if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(expression[i + 1]))) {
            let num = '';
            while (i < len && /[0-9.]/.test(expression[i])) num += expression[i++];
            tokens.push({ type: 'number', value: num, rawValue: num });
            continue;
        }

        // ── Identifier: function or plain-mode field ───────────────────────────
        if (/[a-zA-Z_]/.test(ch)) {
            let ident = '';
            while (i < len && /[a-zA-Z0-9_]/.test(expression[i])) ident += expression[i++];

            // Check for known math function names (case-insensitive)
            if (FUNCTION_NAMES.has(ident.toUpperCase())) {
                tokens.push({ type: 'function', value: ident, rawValue: ident });
                continue;
            }

            // Plain mode: bare identifier is a field reference
            if (mode === 'plain') {
                const field = fieldMap.get(ident);
                tokens.push({
                    type: 'field',
                    value: field ? (field.label || field.fieldName || ident) : ident,
                    rawValue: ident,
                    fieldRef: ident,
                });
                continue;
            }

            // Bracket mode: bare identifier is unknown text (shouldn't appear in valid expressions)
            tokens.push({ type: 'unknown', value: ident, rawValue: ident });
            continue;
        }

        // ── Unknown character (preserve as-is) ────────────────────────────────
        tokens.push({ type: 'unknown', value: ch, rawValue: ch });
        i++;
    }

    return tokens;
}

// ─── Serialisation / Deserialisation ─────────────────────────────────────────

/**
 * Convert a token array back to the internal storage expression.
 * Field tokens emit their `rawValue` (e.g. `{fieldA}` or `fieldA`).
 */
export function tokensToInternalExpression(tokens: FormulaToken[]): string {
    return tokens.map(t => t.rawValue).join('');
}

/**
 * Convert a token array to a plain human-readable display string.
 * Field tokens emit their label.  Useful for debugging / plain-text fallback.
 */
export function tokensToDisplayString(tokens: FormulaToken[]): string {
    return tokens.map(t => t.value).join('');
}

// ─── Field Map Builder ────────────────────────────────────────────────────────

/**
 * Build a Map keyed by every recognisable ref string for a field.
 * Each field is indexed by BOTH its `fieldName` AND its `id` (when they differ)
 * so that lookups work regardless of which key the stored expression uses.
 */
export function buildFieldMap(fields: FieldInfo[]): Map<string, FieldInfo> {
    const map = new Map<string, FieldInfo>();
    for (const f of fields) {
        if (f.fieldName) map.set(f.fieldName, f);
        if (f.id && f.id !== f.fieldName) map.set(f.id, f);
    }
    return map;
}

/**
 * Derive the canonical storage reference for a field.
 * Uses fieldName when it differs from id (meaningful name), otherwise falls back to id.
 */
export function getFieldRef(field: FieldInfo): string {
    return (field.fieldName && field.fieldName !== field.id) ? field.fieldName : field.id;
}
