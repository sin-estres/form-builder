import { FormSchema, FormSection } from '../core/schemaTypes';
import { createElement } from '../utils/dom';
import { formStore } from '../core/useFormStore';
import { Section } from './Section';
import Sortable from 'sortablejs';

export class SectionList {
    private container: HTMLElement;
    private schema: FormSchema;
    private selectedFieldId: string | null;

    constructor(schema: FormSchema, selectedFieldId: string | null) {
        this.schema = schema;
        this.selectedFieldId = selectedFieldId;
        this.container = this.render();
    }

    public getElement(): HTMLElement {
        return this.container;
    }

    private render(): HTMLElement {
        const listContainer = createElement('div', {
            className: 'space-y-6 min-h-[200px] pb-20', // pb-20 for extra scrolling space
            id: 'sections-list',
            'data-drop-zone': 'sections'
        });

        if (this.schema.sections.length === 0) {
            // Root drop zone for when there are no sections
            // We can perhaps just make the whole container droppable?
            // Or render a "Default Section" placeholder?
            // The logic in FormBuilder.ts was adding a placeholder drop zone.

            const placeholder = createElement('div', {
                className: 'border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-[200px] bg-gray-50 dark:bg-gray-800/50',
            });
            placeholder.appendChild(createElement('div', { className: 'font-medium mb-2', text: 'Start Building Your Form' }));
            placeholder.appendChild(createElement('div', { className: 'text-sm text-gray-400', text: 'Drag fields from the sidebar or click "Add Section" below.' }));

            // We make this placeholder a valid drop target for fields too, which will create a section
            // But Sortable needs a list. 
            // We can attach a special Sortable to this placeholder or just handle it in the main list if we treat it as an empty list.

            // Actually, let's just leave the list empty but Sortable-ready.
            // But we need a visual cue.
            listContainer.appendChild(placeholder);
        }

        this.schema.sections.forEach(section => {
            const sectionComponent = new Section(section, (id) => id === this.selectedFieldId);
            listContainer.appendChild(sectionComponent.getElement());
        });

        this.initSectionSortable(listContainer);

        return listContainer;
    }

    private initSectionSortable(element: HTMLElement) {
        new Sortable(element, {
            group: {
                name: 'shared-sections',
                put: ['shared-templates'] // Allow dropping templates here
            },
            handle: '.section-handle',
            animation: 150,
            ghostClass: 'opacity-50',
            onAdd: (evt) => {
                // Handling Template Drop
                const item = evt.item;
                const templateId = item.getAttribute('data-template-id');

                if (templateId) {
                    const templates = formStore.getState().templates;
                    const template = templates.find(t => t.id === templateId);

                    item.remove(); // Remove ghost

                    if (template) {
                        // Import creates a new section at the end. 
                        // To respect drop index, we might need a specific action or just move it after import.
                        // For now, simple import is fine, or we can improve `importSection` to take an index.

                        // Let's assume importSection just appends.
                        // If we want precise position, we would need `addSection` with index.
                        // For this iteration, let's just append.
                        formStore.getState().importSection(template);
                    }
                }
            },
            onUpdate: (evt) => {
                // Reordering sections
                if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
                    formStore.getState().moveSection(evt.oldIndex, evt.newIndex);
                }
            }
        });
    }
}
