import { FormField, FormSchema, FormulaConfig } from '../core/schemaTypes';

/** Operators and parentheses used in formula expressions */
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
    _currentFieldId?: string
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
    _formula: string,
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

// ─── Formula Field Type Utilities ─────────────────────────────────────────────
// These functions support the dedicated 'formula' field type, which uses
// {fieldName} placeholder syntax and supports ROUND, ABS, MIN, MAX functions.

/** Memoized token lists: expression string → token array */
const _tokenCache = new Map<string, string[]>();

/**
 * Tokenize an already-resolved expression string (no placeholders).
 * Supports: numbers, +  -  *  /  (  )  , and identifiers (function names).
 */
function _tokenize(expr: string): string[] {
    if (_tokenCache.has(expr)) return _tokenCache.get(expr)!;
    const tokens: string[] = [];
    let i = 0;
    while (i < expr.length) {
        const c = expr[i];
        if (/\s/.test(c)) { i++; continue; }
        if (/[+\-*/(),]/.test(c)) { tokens.push(c); i++; continue; }
        if (/[0-9.]/.test(c)) {
            let num = '';
            while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i++]; }
            tokens.push(num);
            continue;
        }
        if (/[a-zA-Z_]/.test(c)) {
            let ident = '';
            while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { ident += expr[i++]; }
            tokens.push(ident);
            continue;
        }
        i++;
    }
    _tokenCache.set(expr, tokens);
    return tokens;
}

/**
 * Evaluate a resolved expression string that may contain function calls.
 * Supported functions: ROUND, ABS, MIN, MAX, FLOOR, CEIL, SQRT, POW.
 */
function _evalResolved(expr: string): number {
    const tokens = _tokenize(expr);
    let pos = 0;

    const parseExpr = (): number => {
        let left = parseTerm();
        while (pos < tokens.length) {
            if (tokens[pos] === '+') { pos++; left += parseTerm(); }
            else if (tokens[pos] === '-') { pos++; left -= parseTerm(); }
            else break;
        }
        return left;
    };

    const parseTerm = (): number => {
        let left = parseFactor();
        while (pos < tokens.length) {
            if (tokens[pos] === '*') { pos++; left *= parseFactor(); }
            else if (tokens[pos] === '/') {
                pos++;
                const r = parseFactor();
                if (r === 0) return NaN; // divide-by-zero
                left /= r;
            } else break;
        }
        return left;
    };

    const parseArgs = (): number[] => {
        // Consumes until matching ')'
        const args: number[] = [];
        if (pos < tokens.length && tokens[pos] !== ')') {
            args.push(parseExpr());
            while (pos < tokens.length && tokens[pos] === ',') {
                pos++;
                args.push(parseExpr());
            }
        }
        return args;
    };

    const parseFactor = (): number => {
        if (pos >= tokens.length) return NaN;
        const t = tokens[pos];
        if (t === '(') { pos++; const v = parseExpr(); if (tokens[pos] === ')') pos++; return v; }
        if (t === '-') { pos++; return -parseFactor(); }
        if (t === '+') { pos++; return parseFactor(); }
        const n = parseFloat(t);
        if (!isNaN(n)) { pos++; return n; }
        // Function call: IDENT '(' ... ')'
        if (/^[a-zA-Z_]/.test(t) && pos + 1 < tokens.length && tokens[pos + 1] === '(') {
            const fn = t.toUpperCase();
            pos += 2; // consume funcName + '('
            const args = parseArgs();
            if (pos < tokens.length && tokens[pos] === ')') pos++;
            switch (fn) {
                case 'ROUND': return args.length >= 2
                    ? Math.round(args[0] * Math.pow(10, args[1])) / Math.pow(10, args[1])
                    : Math.round(args[0] ?? 0);
                case 'ABS':   return Math.abs(args[0] ?? 0);
                case 'MIN':   return args.length ? Math.min(...args) : NaN;
                case 'MAX':   return args.length ? Math.max(...args) : NaN;
                case 'FLOOR': return Math.floor(args[0] ?? 0);
                case 'CEIL':  return Math.ceil(args[0] ?? 0);
                case 'SQRT':  return Math.sqrt(args[0] ?? 0);
                case 'POW':   return Math.pow(args[0] ?? 0, args[1] ?? 2);
                default: return NaN;
            }
        }
        // Bare identifier (should already be resolved, treat as 0)
        pos++;
        return 0;
    };

    try {
        const result = parseExpr();
        return isNaN(result) ? NaN : result;
    } catch {
        return NaN;
    }
}

/**
 * Extracts `{fieldName}` placeholder references from a formula expression.
 * Returns unique field names in order of first appearance.
 */
export function extractBracketFields(expression: string): string[] {
    if (!expression) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of expression.matchAll(/\{([^}]+)\}/g)) {
        const name = m[1].trim();
        if (name && !seen.has(name)) { seen.add(name); out.push(name); }
    }
    return out;
}

/**
 * Evaluates a formula expression that uses `{fieldName}` placeholders.
 * Placeholders are resolved to numeric values from `values` before evaluation.
 * Missing/non-numeric values default to 0.
 * Returns NaN on divide-by-zero or syntax error.
 */
export function evaluateFormulaExpression(
    expression: string,
    values: Record<string, number | string | undefined>
): number {
    if (!expression?.trim()) return NaN;
    // Replace {fieldName} with resolved numeric string
    const resolved = expression.replace(/\{([^}]+)\}/g, (_, name) => {
        const v = values[name.trim()];
        if (v === undefined || v === null || v === '') return '0';
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return isNaN(n) ? '0' : String(n);
    });
    _tokenCache.delete(resolved); // invalidate cache for this resolved string (it may vary)
    return _evalResolved(resolved);
}

/**
 * Evaluates a complete FormulaConfig using the provided field values.
 * For `multiple` mode, `compareValue` is the current value of the compare field.
 * Returns `{ result, error? }`.
 */
export function evaluateFormulaConfig(
    config: FormulaConfig,
    values: Record<string, number | string | undefined>,
    compareValue?: string
): { result: number; error?: string } {
    if (!config) return { result: NaN, error: 'No formula config' };
    const dp = config.decimalPlaces ?? 2;
    try {
        let expression: string;
        if (config.mode === 'single') {
            expression = config.single?.expression ?? '';
            if (!expression.trim()) return { result: NaN, error: 'No expression defined' };
        } else {
            const cmpVal = compareValue ?? '';
            const matched = config.multiple?.conditions?.find(c => c.value === cmpVal);
            expression = matched?.expression ?? config.multiple?.fallbackExpression ?? '';
            if (!expression.trim()) return { result: NaN, error: 'No matching condition and no fallback' };
        }
        const raw = evaluateFormulaExpression(expression, values);
        if (isNaN(raw)) return { result: NaN, error: 'Expression evaluation failed (check syntax or divide-by-zero)' };
        const result = parseFloat(raw.toFixed(dp));
        return { result };
    } catch (e) {
        return { result: NaN, error: String(e) };
    }
}

/**
 * Validates a `{fieldName}` expression for the formula field type.
 * Checks that all `{ref}` names exist in `availableFieldNames` and parentheses are balanced.
 */
export function validateFormulaExpression(
    expression: string,
    availableFieldNames: string[]
): { valid: true } | { valid: false; error: string } {
    if (!expression?.trim()) return { valid: false, error: 'Expression cannot be empty' };
    const refs = extractBracketFields(expression);
    const known = new Set(availableFieldNames);
    for (const ref of refs) {
        if (!known.has(ref)) {
            return { valid: false, error: `Unknown field reference: "{${ref}}"` };
        }
    }
    // Basic parentheses balance check
    let open = 0;
    for (const c of expression) {
        if (c === '(') open++;
        else if (c === ')') { open--; if (open < 0) return { valid: false, error: 'Unbalanced parentheses' }; }
    }
    if (open !== 0) return { valid: false, error: 'Unbalanced parentheses' };
    return { valid: true };
}

/**
 * Get all fields usable as formula references for a 'formula' type field.
 * Includes numeric (number) and other formula-type fields (excluding the field itself).
 * Returns all non-excluded fields so users can reference any form value.
 */
export function getFieldsForFormula(
    schema: FormSchema,
    excludeFieldId?: string
): { id: string; fieldName: string; label: string }[] {
    const result: { id: string; fieldName: string; label: string }[] = [];
    const NUMERIC_TYPES = new Set(['number', 'formula']);
    for (const section of schema.sections) {
        for (const field of section.fields) {
            if (!NUMERIC_TYPES.has(field.type)) continue;
            if (excludeFieldId && field.id === excludeFieldId) continue;
            const fieldName = field.fieldName ?? field.id;
            result.push({ id: field.id, fieldName, label: field.label || fieldName });
        }
    }
    return result;
}

/**
 * Detects circular dependencies for a 'formula' type field.
 * Builds a dependency graph from all expression placeholders and checks for cycles.
 */
export function detectFormulaFieldCircularDependency(
    schema: FormSchema,
    formulaFieldId: string,
    config: FormulaConfig
): boolean {
    const resolveField = (ref: string): FormField | undefined => {
        for (const s of schema.sections) {
            for (const f of s.fields) {
                if (f.fieldName === ref || f.id === ref) return f;
            }
        }
        return undefined;
    };

    const getDepsFromConfig = (f: FormField): string[] => {
        if (f.type !== 'formula' || !f.formulaConfig) return [];
        const cfg = f.formulaConfig;
        const exprs: string[] = [];
        if (cfg.mode === 'single') { if (cfg.single?.expression) exprs.push(cfg.single.expression); }
        else {
            cfg.multiple?.conditions?.forEach(c => { if (c.expression) exprs.push(c.expression); });
            if (cfg.multiple?.fallbackExpression) exprs.push(cfg.multiple.fallbackExpression);
        }
        return exprs.flatMap(e => extractBracketFields(e));
    };

    const visited = new Set<string>();
    const hasCycle = (fieldId: string): boolean => {
        if (visited.has(fieldId)) return true;
        visited.add(fieldId);
        const field = resolveField(fieldId);
        if (!field || field.type !== 'formula' || !field.formulaConfig) { visited.delete(fieldId); return false; }
        for (const dep of getDepsFromConfig(field)) {
            const depField = resolveField(dep);
            if (!depField) continue;
            if (depField.id === formulaFieldId) { visited.delete(fieldId); return true; }
            if (hasCycle(depField.id)) { visited.delete(fieldId); return true; }
        }
        visited.delete(fieldId);
        return false;
    };

    // Collect deps from this field's config
    const thisField = resolveField(formulaFieldId);
    if (!thisField || !config) return false;
    const thisDeps = getDepsFromConfig({ ...thisField, formulaConfig: config });
    for (const dep of thisDeps) {
        const depField = resolveField(dep);
        if (!depField) continue;
        if (depField.id === formulaFieldId) return true;
        if (hasCycle(depField.id)) return true;
    }
    return false;
}
