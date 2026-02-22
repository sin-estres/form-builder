import { FormField, FormSchema } from '../core/schemaTypes';

/** Allowed operators and parentheses in formula expressions */
const FORMULA_OPERATORS = ['+', '-', '*', '/', '(', ')'];
const FORMULA_OPERATOR_REGEX = /[\+\-\*\/\(\)]/g;

/**
 * Extracts field references (identifiers) from a formula expression.
 * Supports identifiers: alphanumeric, underscores (e.g. quantity, field_a, price2)
 */
export function parseFormulaDependencies(formula: string): string[] {
    if (!formula || typeof formula !== 'string') return [];
    // Replace operators and parentheses with spaces, then split on whitespace
    const tokens = formula
        .replace(FORMULA_OPERATOR_REGEX, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const seen = new Set<string>();
    const deps: string[] = [];
    for (const t of tokens) {
        const trimmed = t.trim();
        if (trimmed && !seen.has(trimmed)) {
            seen.add(trimmed);
            deps.push(trimmed);
        }
    }
    return deps;
}

/**
 * Validates formula syntax and field references.
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateFormula(
    formula: string,
    availableFieldIds: string[],
    availableFieldNames: string[],
    currentFieldId?: string
): { valid: true } | { valid: false; error: string } {
    if (!formula || typeof formula !== 'string') {
        return { valid: false, error: 'Formula cannot be empty' };
    }
    const trimmed = formula.trim();
    if (!trimmed) {
        return { valid: false, error: 'Formula cannot be empty' };
    }
    const deps = parseFormulaDependencies(trimmed);
    const validRefs = new Set([...availableFieldIds, ...availableFieldNames]);
    for (const dep of deps) {
        if (!validRefs.has(dep)) {
            return { valid: false, error: `Unknown field reference: "${dep}"` };
        }
    }
    // Basic syntax check: balanced parentheses, valid token sequence
    let open = 0;
    for (const c of trimmed) {
        if (c === '(') open++;
        else if (c === ')') {
            open--;
            if (open < 0) return { valid: false, error: 'Unbalanced parentheses' };
        }
    }
    if (open !== 0) return { valid: false, error: 'Unbalanced parentheses' };
    return { valid: true };
}

/**
 * Detects circular dependency: if formulaField depends on fields that (transitively) depend on formulaField.
 */
export function detectCircularDependency(
    schema: FormSchema,
    formulaFieldId: string,
    formula: string,
    dependencies: string[]
): boolean {
    const visited = new Set<string>();
    const resolveFieldByRef = (ref: string): FormField | undefined => {
        for (const s of schema.sections) {
            for (const f of s.fields) {
                if (f.id === ref || f.fieldName === ref) return f;
            }
        }
        return undefined;
    };
    const hasCycle = (fieldId: string): boolean => {
        if (visited.has(fieldId)) return true;
        visited.add(fieldId);
        const field = resolveFieldByRef(fieldId);
        if (!field || field.type !== 'number' || field.valueSource !== 'formula' || !field.formula) {
            visited.delete(fieldId);
            return false;
        }
        const deps = field.dependencies ?? parseFormulaDependencies(field.formula);
        for (const dep of deps) {
            const depField = resolveFieldByRef(dep);
            if (!depField) continue;
            const depId = depField.id;
            if (depId === formulaFieldId) {
                visited.delete(fieldId);
                return true;
            }
            if (hasCycle(depId)) {
                visited.delete(fieldId);
                return true;
            }
        }
        visited.delete(fieldId);
        return false;
    };
    for (const dep of dependencies) {
        const depField = resolveFieldByRef(dep);
        if (!depField) continue;
        if (depField.id === formulaFieldId) return true;
        if (hasCycle(depField.id)) return true;
    }
    return false;
}

/**
 * Evaluates a formula with given values.
 * Handles: +, -, *, /, parentheses.
 * Empty/missing values are treated as 0.
 * Divide-by-zero returns NaN (caller should handle).
 */
export function evaluateFormula(
    formula: string,
    values: Record<string, number | string | undefined>
): number {
    if (!formula || typeof formula !== 'string') return NaN;
    const trimmed = formula.trim();
    if (!trimmed) return NaN;

    const getValue = (ref: string): number => {
        const v = values[ref];
        if (v === undefined || v === null || v === '') return 0;
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return isNaN(n) ? 0 : n;
    };

    // Tokenize: identifiers and operators
    const tokens: string[] = [];
    let i = 0;
    while (i < trimmed.length) {
        const c = trimmed[i];
        if (/\s/.test(c)) {
            i++;
            continue;
        }
        if (/[\+\-\*\/\(\)]/.test(c)) {
            tokens.push(c);
            i++;
            continue;
        }
        if (/[a-zA-Z_0-9]/.test(c)) {
            let ident = '';
            while (i < trimmed.length && /[a-zA-Z0-9_]/.test(trimmed[i])) {
                ident += trimmed[i++];
            }
            tokens.push(ident);
            continue;
        }
        i++;
    }

    // Simple recursive descent for: +, -, *, /, (), identifiers
    let pos = 0;
    const parseExpr = (): number => {
        let left = parseTerm();
        while (pos < tokens.length) {
            const op = tokens[pos];
            if (op === '+') {
                pos++;
                left += parseTerm();
            } else if (op === '-') {
                pos++;
                left -= parseTerm();
            } else break;
        }
        return left;
    };
    const parseTerm = (): number => {
        let left = parseFactor();
        while (pos < tokens.length) {
            const op = tokens[pos];
            if (op === '*') {
                pos++;
                left *= parseFactor();
            } else if (op === '/') {
                pos++;
                const right = parseFactor();
                if (right === 0) return NaN;
                left /= right;
            } else break;
        }
        return left;
    };
    const parseFactor = (): number => {
        if (pos >= tokens.length) return NaN;
        const t = tokens[pos];
        if (t === '(') {
            pos++;
            const v = parseExpr();
            if (pos < tokens.length && tokens[pos] === ')') pos++;
            return v;
        }
        if (t === '-') {
            pos++;
            return -parseFactor();
        }
        if (t === '+') {
            pos++;
            return parseFactor();
        }
        const n = parseFloat(t);
        if (!isNaN(n)) {
            pos++;
            return n;
        }
        // Identifier - lookup value
        pos++;
        return getValue(t);
    };

    try {
        const result = parseExpr();
        return isNaN(result) ? NaN : result;
    } catch {
        return NaN;
    }
}

/**
 * Get all numeric fields from schema (excluding the given field) for formula selection.
 * Returns fields that can be used in formulas.
 */
export function getNumericFieldsForFormula(
    schema: FormSchema,
    excludeFieldId?: string
): { id: string; fieldName: string; label: string }[] {
    const result: { id: string; fieldName: string; label: string }[] = [];
    for (const section of schema.sections) {
        for (const field of section.fields) {
            if (field.type !== 'number') continue;
            if (excludeFieldId && field.id === excludeFieldId) continue;
            // Exclude formula fields that would create circular refs when used as dependency
            // (Actually formula fields CAN be used - e.g. A = B + C, D = A * 2 - but we must avoid cycles)
            const fieldName = field.fieldName ?? field.id;
            result.push({
                id: field.id,
                fieldName,
                label: field.label || fieldName
            });
        }
    }
    return result;
}
