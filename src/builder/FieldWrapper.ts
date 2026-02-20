import { FormField, getColSpanFromWidth } from '../core/schemaTypes';
import { createElement, getIcon } from '../utils/dom';
import { FieldRenderer } from '../renderer/FieldRenderer';
import { formStore } from '../core/useFormStore';

export class FieldWrapper {
    static render(field: FormField, isSelected: boolean): HTMLElement {
        // Check if field is visible (default to true if not specified)
        const isVisible = field.visible !== false;

        // Grid Span Logic - prioritize layout.span, fallback to width
        let spanClass: string;
        if (field.layout?.span !== undefined) {
            const span = Math.max(1, Math.min(12, field.layout.span));
            spanClass = `col-span-${span}`;
        } else {
            spanClass = getColSpanFromWidth(field.width || '100%');
        }

        const fieldWrapper = createElement('div', {
            className: `form-builder-field-wrapper ${isSelected ? 'selected-field' : ''} ${spanClass} relative group border border-gray-200 hover:border-blue-200 rounded-md transition-all ${!isVisible ? 'hidden' : ''}`,
            'data-id': field.id,
            onclick: (e: Event) => {
                e.stopPropagation();
                formStore.getState().selectField(field.id);
            }
        });

        // Apply field-level CSS class
        if (field.css?.class) {
            field.css.class.split(' ').forEach(cls => {
                if (cls.trim()) fieldWrapper.classList.add(cls.trim());
            });
        }

        // Apply field-level CSS style
        if (field.css?.style) {
            Object.entries(field.css.style).forEach(([prop, value]) => {
                (fieldWrapper.style as any)[prop] = value;
            });
        }

        // Add visual indicator of selected state
        if (isSelected) {
            fieldWrapper.classList.add('ring-2', 'bg-transparent', 'dark:bg-blue-900/20');
        }

        // Drag Handle
        fieldWrapper.appendChild(createElement('div', {
            className: `absolute top-[6px] bg-[#e7e7ff]  hover:bg-[#635bff] hover:text-white  right-8 cursor-move p-1 rounded  p-[2px] mr-1 text-[#635bff] group-hover:opacity-100 transition-opacity field-handle z-10 ${isSelected ? "opacity-100" : ""}`
        }, [getIcon('GripVertical', 20)]));

        // Delete Button
        fieldWrapper.appendChild(createElement('button', {
            className: `absolute top-[6px] right-2  rounded text-red-600 bg-[#f7a1a14d] text-red-500 p-1 hover:bg-[#ef2f2f] hover:text-white   group-hover:opacity-100  transition-opacity z-10 ${isSelected ? "opacity-100" : ""}`,
            onclick: (e: Event) => {
                e.stopPropagation();
                if (confirm('Delete this field?')) {
                    formStore.getState().removeField(field.id);
                }
            }
        }, [getIcon('Trash2', 16)]));

        // Render Field Content
        const content = createElement('div', { className: 'p-2  pointer-events-none ' });

        // We need to pass dummy data or handle the renderer carefully since we are in builder mode
        // The FieldRenderer might expect values. We pass null for value.
        // We also want to disable interactivity of inputs in builder mode.
        content.appendChild(FieldRenderer.render(field, null, undefined, true));

        fieldWrapper.appendChild(content);

        return fieldWrapper;
    }
}
