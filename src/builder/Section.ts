import { FormSection, FormField } from '../core/schemaTypes';
import { createElement, getIcon } from '../utils/dom';
import { formStore } from '../core/useFormStore';
import { getChildSections } from '../utils/sectionHierarchy';
import { FieldWrapper } from './FieldWrapper';
import Sortable from 'sortablejs';

const SECTION_TITLE_DEBOUNCE_MS = 300;
const sectionTitleUpdateTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export class Section {
    private container: HTMLElement;
    private section: FormSection;
    private allSections: FormSection[];
    private isSelectedField: (fieldId: string) => boolean;
    private selectedSectionId: string | null;
    private depth: number;

    constructor(
        section: FormSection,
        isSelectedField: (fieldId: string) => boolean,
        selectedSectionId: string | null,
        allSections: FormSection[],
        depth = 0
    ) {
        this.section = section;
        this.allSections = allSections;
        this.isSelectedField = isSelectedField;
        this.selectedSectionId = selectedSectionId;
        this.depth = depth;
        this.container = this.render();
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    private render(): HTMLElement {
        const sectionVisible = this.section.visible !== false;
        const isSelectedSection = this.section.id === this.selectedSectionId;
        const marginClass = this.depth > 0 ? 'mb-4' : 'mb-6';
        const sectionEl = createElement('div', {
            className: `${marginClass} rounded-lg border bg-white dark:bg-gray-900 shadow-sm transition-all border-[#e9e9e9] ${!sectionVisible ? 'opacity-50' : ''} ${isSelectedSection ? 'ring-2 ring-[#635bff]' : ''} ${this.depth > 0 ? 'shadow-inner' : ''}`,
            'data-id': this.section.id,
            'data-section-id': this.section.id
        });

        // Header — click selects group in right panel (child controls stop propagation)
        const header = createElement('div', {
            className: 'flex items-center justify-between  p-2 border-b border-gray-100 bg-white dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg cursor-pointer',
            onclick: () => {
                formStore.getState().selectSection(this.section.id);
            }
        });
        const headerLeft = createElement('div', { className: 'flex items-center flex-1 min-w-0' });

        // Drag Handle for Section
        const dragHandle = createElement('div', { className: 'cursor-move mr-3 text-gray-400 hover:text-gray-600 section-handle flex-shrink-0' }, [getIcon('GripVertical', 20)]);
        dragHandle.addEventListener('mousedown', (e: Event) => e.stopPropagation());
        dragHandle.addEventListener('click', (e: Event) => e.stopPropagation());
        headerLeft.appendChild(dragHandle);

        // Title Input
        headerLeft.appendChild(createElement('input', {
            className: 'bg-transparent font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:border-b border-blue-500 min-w-0 flex-1',
            value: this.section.title,
            'data-focus-id': `section-title-${this.section.id}`,
            onclick: (e: Event) => e.stopPropagation(),
            oninput: (e: Event) => {
                const sid = this.section.id;
                const value = (e.target as HTMLInputElement).value;
                const existing = sectionTitleUpdateTimeouts.get(sid);
                if (existing) clearTimeout(existing);
                const timeoutId = setTimeout(() => {
                    sectionTitleUpdateTimeouts.delete(sid);
                    formStore.getState().updateSection(sid, { title: value, name: value });
                }, SECTION_TITLE_DEBOUNCE_MS);
                sectionTitleUpdateTimeouts.set(sid, timeoutId);
            }
        }));
        header.appendChild(headerLeft);

        const actions = createElement('div', { className: 'flex items-center space-x-1' });

        // Grid Columns Selector
        const colSelect = createElement('select', {
            className: 'text-xs border rounded bg-transparent mr-2 p-1 text-gray-600',
            title: 'Section Columns',
            onclick: (e: Event) => e.stopPropagation(),
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
            onclick: (e: Event) => {
                e.stopPropagation();
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

        const childSections = getChildSections(this.allSections, this.section.id);
        if (childSections.length > 0) {
            const nestedWrap = createElement('div', {
                className:
                    this.depth === 0
                        ? 'px-4 pb-4 pt-0 border-t border-dashed border-gray-200 dark:border-gray-700'
                        : 'pl-3 ml-2 mt-3 pt-3 border-l-2 border-[#635bff]/35 dark:border-[#635bff]/50 rounded-bl-md'
            });
            const nestedList = createElement('div', { className: 'space-y-4' });
            childSections.forEach((child) => {
                const childComponent = new Section(
                    child,
                    this.isSelectedField,
                    this.selectedSectionId,
                    this.allSections,
                    this.depth + 1
                );
                nestedList.appendChild(childComponent.getElement());
            });
            nestedWrap.appendChild(nestedList);
            sectionEl.appendChild(nestedWrap);
        }

        if (this.section.repeatable === true) {
            const addLabel =
                (this.section.addButtonLabel && this.section.addButtonLabel.trim()) || '+ Add';
            const footer = createElement('div', {
                className:
                    'px-4 pb-4 pt-2 flex justify-start border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30'
            });
            footer.appendChild(
                createElement('button', {
                    type: 'button',
                    className:
                        'px-4 py-2 text-sm font-medium rounded-md border border-[#019FA2] text-[#019FA2] dark:text-[#4dd4d6] dark:border-[#019FA2] bg-white dark:bg-gray-900 hover:bg-[#019FA2]/10 transition-colors',
                    text: addLabel,
                    onclick: (e: Event) => e.preventDefault()
                })
            );
            sectionEl.appendChild(footer);
        }

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
