import { FormSection, FormField } from '../core/schemaTypes';
import { createElement, getIcon } from '../utils/dom';
import { formStore } from '../core/useFormStore';
import { FieldWrapper } from './FieldWrapper';
import Sortable from 'sortablejs';

export class Section {
    private container: HTMLElement;
    private section: FormSection;
    private isSelectedField: (fieldId: string) => boolean;

    constructor(section: FormSection, isSelectedField: (fieldId: string) => boolean) {
        this.section = section;
        this.isSelectedField = isSelectedField;
        this.container = this.render();
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    private render(): HTMLElement {
        const sectionEl = createElement('div', {
            className: 'mb-6 rounded-lg border bg-white dark:bg-gray-900 shadow-sm transition-all border-[#e9e9e9] ',
            'data-id': this.section.id
        });

        // Header
        const header = createElement('div', { className: 'flex items-center justify-between  p-2 border-b border-gray-100 bg-white dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg' });
        const headerLeft = createElement('div', { className: 'flex items-center flex-1' });

        // Drag Handle for Section
        headerLeft.appendChild(createElement('div', { className: 'cursor-move mr-3 text-gray-400 hover:text-gray-600 section-handle' }, [getIcon('GripVertical', 20)]));

        // Title Input
        headerLeft.appendChild(createElement('input', {
            className: 'bg-transparent font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:border-b border-blue-500',
            value: this.section.title,
            'data-focus-id': `section-title-${this.section.id}`,
            oninput: (e: Event) => formStore.getState().updateSection(this.section.id, { title: (e.target as HTMLInputElement).value })
        }));
        header.appendChild(headerLeft);

        const actions = createElement('div', { className: 'flex items-center space-x-1' });

        // Grid Columns Selector
        const colSelect = createElement('select', {
            className: 'text-xs border rounded bg-transparent mr-2 p-1 text-gray-600',
            title: 'Section Columns',
            onchange: (e: Event) => {
                formStore.getState().updateSection(this.section.id, { columns: parseInt((e.target as HTMLSelectElement).value) as 1 | 2 | 3 });
            }
        });
        [1, 2, 3].forEach(c => {
            colSelect.appendChild(createElement('option', { value: c.toString(), text: `${c} Col`, selected: (this.section.columns || 1) === c }));
        });
        actions.appendChild(colSelect);

        // Delete Button
        actions.appendChild(createElement('button', {
            className: 'text-gray-600 hover:text-red-500 transition-colors p-1',
            onclick: () => {
                if (confirm('Delete this section and all its fields?')) {
                    formStore.getState().removeSection(this.section.id);
                }
            }
        }, [getIcon('Trash2', 18)]));

        header.appendChild(actions);
        sectionEl.appendChild(header);

        // Fields Grid (Sortable Area)
        // Apply section columns setting: prefer layout.columns, fallback to columns (legacy)
        const layoutColumns = this.section.layout?.columns || this.section.columns || 12;
        const columns = layoutColumns > 3 ? 12 : (layoutColumns as 1 | 2 | 3); // For legacy compatibility
        const fieldsGrid = createElement('div', {
            className: 'form-builder-grid p-4 min-h-[100px] fields-list !gap-4',
            'data-section-id': this.section.id
        });

        // Apply columns dynamically - use layout.columns if available, otherwise use legacy columns
        const gridColumns = this.section.layout?.columns || columns || 12;
        fieldsGrid.style.gridTemplateColumns = `repeat(${gridColumns}, minmax(0, 1fr))`;
        
        // Apply section layout gap if specified
        if (this.section.layout?.gap) {
            fieldsGrid.style.gap = this.section.layout.gap;
        }

        // Apply section-level CSS class
        if (this.section.css?.class) {
            this.section.css.class.split(' ').forEach(cls => {
                if (cls.trim()) fieldsGrid.classList.add(cls.trim());
            });
        }

        // Apply section-level CSS style
        if (this.section.css?.style) {
            Object.entries(this.section.css.style).forEach(([prop, value]) => {
                (fieldsGrid.style as any)[prop] = value;
            });
        }

        if (this.section.fields.length === 0) {
            fieldsGrid.classList.add('flex', 'justify-center', 'items-center', 'border-2', 'border-dashed', 'border-gray-100', 'dark:border-gray-800', 'm-4', 'rounded');
            fieldsGrid.appendChild(createElement('div', { className: 'text-gray-400 text-sm py-4 w-[300px]', text: 'Drop fields here' }));
        }

        // Sort fields by order before rendering
        const sortedFields = [...this.section.fields].sort((a, b) => {
            const orderA = a.order !== undefined ? a.order : 0;
            const orderB = b.order !== undefined ? b.order : 0;
            return orderA - orderB;
        });
        
        sortedFields.forEach((field: FormField) => {
            const isSelected = this.isSelectedField(field.id);
            fieldsGrid.appendChild(FieldWrapper.render(field, isSelected));
        });

        sectionEl.appendChild(fieldsGrid);

        // Initialize Sortable for this section's fields
        this.initFieldSortable(fieldsGrid);

        return sectionEl;
    }

    private initFieldSortable(element: HTMLElement) {
        new Sortable(element, {
            group: {
                name: 'shared-fields',
                put: ['shared-fields', 'shared-templates'] // Allow dropping templates to merge fields
            },
            handle: '.field-handle',
            animation: 150,
            ghostClass: 'bg-blue-50', // Class to apply to the drag ghost
            onAdd: (evt) => {
                const item = evt.item;
                const type = item.getAttribute('data-type');
                const _fromSectionId = evt.from.getAttribute('data-section-id'); // ID of source section (if moving)
                const toSectionId = this.section.id;

                // If dropped from toolbox (new field) or template
                if (type && !item.hasAttribute('data-id')) {
                    // Remove the cloned DOM element because store update will re-render everything
                    item.remove();

                    if (type === 'template-section') {
                        const templateId = item.getAttribute('data-template-id');
                        const templates = formStore.getState().templates;
                        const template = templates.find(t => t.id === templateId);

                        if (template) {
                            formStore.getState().addTemplateFields(toSectionId, template, evt.newIndex);
                        }
                        return;
                    }

                    formStore.getState().addField(toSectionId, type as any, evt.newIndex);
                }
                // If it has data-id, it's a move from another list (Sortable 'shared' group)
                else {
                    const fieldId = item.getAttribute('data-id');
                    if (fieldId) {
                        formStore.getState().moveField(fieldId, toSectionId, evt.newIndex!);
                        item.remove(); // Remove DOM immediately to prevent flicker before re-render
                    }
                }
            },
            onUpdate: (evt) => {
                // Sorting within the same list
                const item = evt.item;
                const fieldId = item.getAttribute('data-id');
                if (fieldId && evt.newIndex !== undefined) {
                    formStore.getState().moveField(fieldId, this.section.id, evt.newIndex);
                    // Update order for all fields in the section
                    const state = formStore.getState();
                    const section = state.schema.sections.find(s => s.id === this.section.id);
                    if (section) {
                        section.fields.forEach((field, index) => {
                            if (field.order !== index) {
                                state.updateField(field.id, { order: index });
                            }
                        });
                    }
                }
            },
        });
    }
}
