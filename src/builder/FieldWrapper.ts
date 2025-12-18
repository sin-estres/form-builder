import { FormField } from '../core/schemaTypes';
import { createElement, getIcon } from '../utils/dom';
import { FIELD_TYPES } from '../core/constants';
import { FieldRenderer } from '../renderer/FieldRenderer';
import { formStore } from '../core/useFormStore';

export class FieldWrapper {
    static render(field: FormField, isSelected: boolean): HTMLElement {
        // Grid Span Logic (12 Cols Base)
        let spanClass = 'col-span-12';
        if (field.width === '50%') spanClass = 'col-span-6';
        else if (field.width === '33%') spanClass = 'col-span-4';
        else if (field.width === '25%') spanClass = 'col-span-3';
        else if (field.width === '66%') spanClass = 'col-span-8';
        else if (field.width === '75%') spanClass = 'col-span-9';

        const fieldWrapper = createElement('div', {
            className: `form-builder-field-wrapper ${isSelected ? 'selected-field' : ''} ${spanClass} relative group border border-transparent hover:border-blue-200 rounded-md transition-all`,
            'data-id': field.id,
            onclick: (e: Event) => {
                e.stopPropagation();
                formStore.getState().selectField(field.id);
            }
        });

        // Add visual indicator of selected state
        if (isSelected) {
            fieldWrapper.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/20');
        }

        // Drag Handle
        fieldWrapper.appendChild(createElement('div', {
            className: `absolute top-2 left-2 cursor-move p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity field-handle z-10 ${isSelected ? "opacity-100" : ""}`
        }, [getIcon('GripVertical', 16)]));

        // Delete Button
        fieldWrapper.appendChild(createElement('button', {
            className: `absolute top-2 right-2 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10 ${isSelected ? "opacity-100" : ""}`,
            onclick: (e: Event) => {
                e.stopPropagation();
                if (confirm('Delete this field?')) {
                    formStore.getState().removeField(field.id);
                }
            }
        }, [getIcon('Trash2', 16)]));

        // Render Field Content
        const content = createElement('div', { className: 'p-4 pointer-events-none' });

        // We need to pass dummy data or handle the renderer carefully since we are in builder mode
        // The FieldRenderer might expect values. We pass null for value.
        // We also want to disable interactivity of inputs in builder mode.
        content.appendChild(FieldRenderer.render(field, null, undefined, true));

        fieldWrapper.appendChild(content);

        return fieldWrapper;
    }
}
