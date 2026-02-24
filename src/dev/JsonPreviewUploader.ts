// DEV-ONLY: JSON preview uploader — do not export
// This module is for local development only. It must not be imported from src/index.ts
// or any code that is bundled for the npm package. It is tree-shaken out of production builds.

import { createElement, getIcon } from '../utils/dom';
import { formStore } from '../core/useFormStore';
import { FormRenderer } from '../renderer/FormRenderer';
import type { FormSchema, FormSection, FormField } from '../core/schemaTypes';

const DEV_BUTTON_ATTR = 'data-dev-json-upload';

/** API form shape: root fields array + sections/groups with fieldIds (source of truth = form.fields). */
interface ApiFormShape {
    id: string;
    title: string;
    formName: string;
    fields?: Array<Record<string, unknown>>;
    sections?: Array<{ id?: string; title?: string; fieldIds?: string[]; fields?: unknown[]; order?: number }>;
    groups?: Array<{ id?: string; title?: string; fieldIds?: string[]; fields?: unknown[]; order?: number }>;
}

function isApiFormShape(o: Record<string, unknown>): o is ApiFormShape {
    return (
        typeof o.id === 'string' &&
        typeof o.title === 'string' &&
        typeof o.formName === 'string' &&
        Array.isArray(o.fields) &&
        o.fields.length >= 0
    );
}

/**
 * Basic structure validation. Accepts standard FormSchema or API form (form.fields + sections/groups).
 */
function validateFormJson(obj: unknown): string | null {
    if (obj === null || typeof obj !== 'object') {
        return 'JSON must be an object';
    }
    const o = obj as Record<string, unknown>;
    if (typeof o.id !== 'string') return 'Missing or invalid "id" (string)';
    if (typeof o.title !== 'string') return 'Missing or invalid "title" (string)';
    if (typeof o.formName !== 'string') return 'Missing or invalid "formName" (string)';

    if (isApiFormShape(o)) {
        if (!Array.isArray(o.fields)) return 'Missing or invalid "fields" (array)';
        const sections = o.sections ?? o.groups ?? [];
        for (let i = 0; i < sections.length; i++) {
            const s = sections[i] as Record<string, unknown>;
            if (!s || typeof s !== 'object') return `sections[${i}]: must be an object`;
            if (typeof s.title !== 'string') return `sections[${i}]: missing or invalid "title" (string)`;
        }
        return null;
    }

    if (!Array.isArray(o.sections)) return 'Missing or invalid "sections" (array)';
    for (let i = 0; i < o.sections.length; i++) {
        const s = o.sections[i] as Record<string, unknown>;
        if (!s || typeof s !== 'object') return `sections[${i}]: must be an object`;
        if (typeof s.title !== 'string') return `sections[${i}]: missing or invalid "title" (string)`;
        if (!Array.isArray(s.fields)) return `sections[${i}]: missing or invalid "fields" (array)`;
    }
    return null;
}

/**
 * Unwrap API-style payloads: { data: { form: FormSchema } } or { form: FormSchema } -> FormSchema.
 * Returns the form object if found, otherwise the root.
 */
function unwrapFormPayload(parsed: unknown): unknown {
    if (parsed === null || typeof parsed !== 'object') return parsed;
    const o = parsed as Record<string, unknown>;
    if (o.data && typeof o.data === 'object' && (o.data as Record<string, unknown>).form) {
        return (o.data as Record<string, unknown>).form;
    }
    if (o.form && typeof o.form === 'object') {
        return o.form;
    }
    return parsed;
}

/**
 * Normalize API form to FormSchema: root form.fields as source of truth; sections get fields by fieldIds (no duplicate fields).
 * Sort section.fields by order for layout fallback when row/column conflict.
 */
function normalizeApiFormToSchema(apiForm: ApiFormShape): FormSchema {
    const rootFields = apiForm.fields ?? [];
    const rootFieldsById = new Map(rootFields.map((f: Record<string, unknown>) => [String(f.id), f]));
    const sectionsSource = apiForm.sections ?? apiForm.groups ?? [];

    const sections: FormSection[] = sectionsSource
        .map((s: Record<string, unknown>) => {
            const fieldIds: string[] = Array.isArray(s.fieldIds)
                ? s.fieldIds.map(String)
                : Array.isArray(s.fields)
                  ? (s.fields as Record<string, unknown>[]).map((f) => String(f.id))
                  : [];
            const fields = fieldIds
                .map((id) => rootFieldsById.get(id))
                .filter(Boolean) as Record<string, unknown>[];
            fields.sort((a, b) => (Number(a.order) ?? 0) - (Number(b.order) ?? 0));
            return {
                id: String(s.id ?? s.groupId ?? ''),
                title: String(s.title ?? s.groupName ?? ''),
                fields: fields as FormSchema['sections'][0]['fields'],
                order: Number(s.order) ?? 0
            };
        })
        .filter((s) => s.fields.length > 0);

    sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (sections.length === 0 && rootFields.length > 0) {
        const sorted = [...rootFields].sort((a, b) => (Number(a.order) ?? 0) - (Number(b.order) ?? 0));
        sections.push({
            id: 'default',
            title: (apiForm as Record<string, unknown>).title ? String((apiForm as Record<string, unknown>).title) : 'Form',
            fields: sorted as FormSchema['sections'][0]['fields'],
            order: 0
        });
    }

    return {
        id: apiForm.id,
        title: apiForm.title,
        formName: apiForm.formName,
        sections
    };
}

/** Field-like shape for preview generation (id, type, fieldName, options, validation, placeholder). */
type FieldLike = {
    id: string;
    type?: string;
    fieldName?: string;
    options?: { value: string }[];
    validation?: { minDate?: string; maxDate?: string };
    placeholder?: string;
};

/**
 * Generate dummy preview data from root form.fields only. Keyed by fieldName (model key).
 * TEXT/EMAIL/PHONE → dummy string; SELECT → first option value; DATE → valid date in min/max; BOOLEAN → false; TEXTAREA → placeholder; FILE → mock metadata.
 */
function generatePreviewModel(fields: FieldLike[]): Record<string, any> {
    const model: Record<string, any> = {};
    const missing: string[] = [];

    for (const field of fields) {
        const key = field.fieldName ?? field.id;
        if (!field.fieldName && field.id) {
            missing.push(field.id);
        }

        const type = (field.type ?? 'text').toLowerCase();
        const validation = field.validation && typeof field.validation === 'object' ? field.validation : {};
        const minDate = validation.minDate;
        const maxDate = validation.maxDate;

        switch (type) {
            case 'text':
            case 'email':
            case 'phone':
                model[key] = field.placeholder || 'Sample value';
                break;
            case 'select':
                const opts = field.options ?? [];
                model[key] = opts.length > 0 ? opts[0].value : '';
                break;
            case 'date': {
                let dateStr: string;
                if (minDate || maxDate) {
                    const min = minDate ? new Date(minDate).getTime() : 0;
                    const max = maxDate ? new Date(maxDate).getTime() : Date.now() + 365 * 24 * 60 * 60 * 1000;
                    const mid = min + (max - min) / 2;
                    dateStr = new Date(mid).toISOString().slice(0, 10);
                } else {
                    dateStr = new Date().toISOString().slice(0, 10);
                }
                model[key] = dateStr;
                break;
            }
            case 'checkbox':
            case 'radio':
            case 'boolean':
                model[key] = false;
                break;
            case 'textarea':
                model[key] = field.placeholder || 'Sample long text for preview...';
                break;
            case 'file':
                model[key] = { name: 'sample.pdf', size: 1024 };
                break;
            case 'image':
                model[key] = (field as { imageUrl?: string }).imageUrl ?? '';
                break;
            case 'number':
                model[key] = 0;
                break;
            case 'toggle':
                model[key] = false;
                break;
            default:
                model[key] = field.placeholder || 'Sample value';
        }
    }

    if (missing.length > 0) {
        console.warn('[FormBuilder Dev] missing fieldName warnings:', missing);
    }
    console.log('[FormBuilder Dev] generated preview model:', model);
    return model;
}

/**
 * Safely parse JSON and validate. Returns [normalized FormSchema, parsedRoot, null] or [null, null, errorMessage].
 * Accepts raw FormSchema or wrapped payloads; normalizes API form (root fields as source of truth).
 */
function parseAndValidateFormJson(text: string): [FormSchema | null, unknown, string | null] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return [null, null, 'Invalid JSON'];
    }
    const formCandidate = unwrapFormPayload(parsed);
    const err = validateFormJson(formCandidate);
    if (err) return [null, null, err];

    const raw = formCandidate as Record<string, unknown>;
    if (isApiFormShape(raw)) {
        const schema = normalizeApiFormToSchema(raw);
        return [schema, parsed, null];
    }
    return [formCandidate as FormSchema, parsed, null];
}

/**
 * Find the toolbar's right-side button group (same structure as FormBuilder.renderToolbar).
 */
function findToolbarRight(container: HTMLElement): HTMLElement | null {
    const toolbar = container.querySelector('.flex.items-center.justify-between.p-4.border-b');
    if (!toolbar || toolbar.children.length < 2) return null;
    return toolbar.children[1] as HTMLElement;
}

/**
 * Find the preview area inner div (flex-1 overflow-y-auto bg-white > div.w-full).
 */
function findPreviewInner(container: HTMLElement): HTMLElement | null {
    const previewContainer = container.querySelector('.flex-1.overflow-y-auto.bg-white');
    if (!previewContainer || !previewContainer.firstElementChild) return null;
    return previewContainer.firstElementChild as HTMLElement;
}

let devContainerRef: HTMLElement | null = null;

/**
 * Build preview data from schema only (no backend). Uses root fields as source of truth;
 * flattens section.fields and generates dummy values by type, keyed by fieldName.
 */
function buildPreviewDataFromSchema(schema: FormSchema): Record<string, any> {
    const allFields = schema.sections.flatMap((s) => s.fields);
    const byId = new Map<string, FormField>();
    allFields.forEach((f) => byId.set(f.id, f));
    const rootFieldsList = Array.from(byId.values());
    return generatePreviewModel(rootFieldsList as FieldLike[]);
}

function loadSchemaIntoPreview(container: HTMLElement, schema: FormSchema, _parsedPayload?: unknown): void {
    const initialData = buildPreviewDataFromSchema(schema);
    console.log('[FormBuilder Dev] patched form values:', initialData);

    if (!formStore.getState().isPreviewMode) {
        formStore.getState().togglePreview();
    }
    requestAnimationFrame(() => {
        const inner = findPreviewInner(container);
        if (!inner) {
            alert('Preview area not found. Try toggling Preview first.');
            return;
        }
        inner.innerHTML = '';
        new FormRenderer(
            inner,
            schema,
            (data) => alert(JSON.stringify(data, null, 2)),
            undefined,
            initialData
        );
    });
}

function openJsonPastePopup(container: HTMLElement): void {
    devContainerRef = container;

    const overlay = createElement('div', {
        className: 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4',
        onclick: (e: Event) => {
            if (e.target === overlay) close();
        }
    });

    const errorEl = createElement('div', {
        className: 'text-sm text-red-600 dark:text-red-400 hidden',
        id: 'dev-json-upload-error'
    });

    const textarea = createElement('textarea', {
        className: 'w-full h-64 p-3 text-sm font-mono rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y min-h-[200px]',
        placeholder: 'Paste form JSON here…',
        id: 'dev-json-upload-textarea'
    }) as HTMLTextAreaElement;

    function close() {
        overlay.remove();
    }

    const loadBtn = createElement('button', {
        type: 'button',
        className: 'px-4 py-2 text-sm font-medium text-white bg-[#019FA2] rounded-md hover:bg-[#018a8d] transition-colors',
        text: 'Load & Preview',
        onclick: () => {
            const text = textarea.value.trim();
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
            if (!text) {
                errorEl.textContent = 'Please paste JSON data.';
                errorEl.classList.remove('hidden');
                return;
            }
            const [schema, parsed, err] = parseAndValidateFormJson(text);
            if (err) {
                errorEl.textContent = `Invalid form JSON: ${err}`;
                errorEl.classList.remove('hidden');
                return;
            }
            if (!schema || !devContainerRef) return;
            close();
            loadSchemaIntoPreview(devContainerRef, schema, parsed ?? undefined);
        }
    });

    const cancelBtn = createElement('button', {
        type: 'button',
        className: 'px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors',
        text: 'Cancel',
        onclick: close
    });

    const card = createElement('div', {
        className: 'bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col',
        onclick: (e: Event) => e.stopPropagation()
    });

    const header = createElement('div', { className: 'flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700' });
    header.appendChild(createElement('h2', { className: 'text-lg font-semibold text-gray-900 dark:text-white', text: 'Paste form JSON' }));
    header.appendChild(createElement('button', {
        type: 'button',
        className: 'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500',
        title: 'Close',
        onclick: close
    }, [getIcon('X', 20)]));

    const body = createElement('div', { className: 'p-4 flex-1 overflow-hidden flex flex-col' });
    body.appendChild(errorEl);
    body.appendChild(createElement('label', {
        className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mt-2 mb-1',
        text: 'Form JSON'
    }));
    body.appendChild(textarea);

    const footer = createElement('div', { className: 'flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700' });
    footer.appendChild(cancelBtn);
    footer.appendChild(loadBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    textarea.focus();
}

function createUploadButton(container: HTMLElement): HTMLElement {
    const btn = createElement('button', {
        type: 'button',
        className: 'flex items-center justify-center absolute top-2 right-[16%] px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
        title: 'Upload JSON (dev only)',
        [DEV_BUTTON_ATTR]: 'true',
        onclick: () => openJsonPastePopup(container)
    }, [getIcon('Upload', 16), createElement('span', { className: 'ml-1.5', text: 'Upload JSON' })]);

    return btn;
}

function tryInjectButton(container: HTMLElement): void {
    if (container.querySelector(`[${DEV_BUTTON_ATTR}="true"]`)) return;
    const right = findToolbarRight(container);
    if (!right) return;
    const btn = createUploadButton(container);
    right.insertBefore(btn, right.firstChild);
}

/**
 * Attach the dev-only "Upload JSON" button to the form builder container.
 * Call only when running locally (e.g. import.meta.env.DEV). Re-injects the button
 * after store-driven re-renders so it stays visible.
 */
export function attachDevJsonUploader(container: HTMLElement): void {
    tryInjectButton(container);
    formStore.subscribe(() => {
        setTimeout(() => tryInjectButton(container), 0);
    });
}
