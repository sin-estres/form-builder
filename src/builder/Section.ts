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
        const fieldsGrid = createElement('div', {
            className: 'form-builder-grid p-4 min-h-[100px] fields-list',
            'data-section-id': this.section.id
        });

        if (this.section.fields.length === 0) {
            fieldsGrid.classList.add('flex', 'justify-center', 'items-center', 'border-2', 'border-dashed', 'border-gray-100', 'dark:border-gray-800', 'm-4', 'rounded');
            fieldsGrid.appendChild(createElement('div', { className: 'text-gray-400 text-sm py-4', text: 'Drop fields here' }));
        }

        this.section.fields.forEach((field: FormField) => {
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
                const fromSectionId = evt.from.getAttribute('data-section-id'); // ID of source section (if moving)
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
                }
            },
        });
    }
}
