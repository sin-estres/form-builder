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
            className: 'space-y-6 min-h-[200px] ', // pb-20 for extra scrolling space
            id: 'sections-list',
            'data-drop-zone': 'sections'
        });

        const hasNoSections = this.schema.sections.length === 0;

        if (hasNoSections) {
            // Root drop zone for when there are no sections
            const placeholder = createElement('div', {
                className: 'border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 flex flex-col items-center justify-center min-h-[200px] bg-gray-50 dark:bg-gray-800/50 empty-fields-dropzone',
                id: 'empty-fields-dropzone'
            });
            placeholder.appendChild(createElement('div', { className: 'font-medium mb-2', text: 'Start Building Your Form' }));
            placeholder.appendChild(createElement('div', { className: 'text-sm text-gray-400', text: 'Drag fields from the sidebar or click "Add Section" below.' }));

            listContainer.appendChild(placeholder);
        }

        this.schema.sections.forEach(section => {
            const sectionComponent = new Section(section, (id) => id === this.selectedFieldId);
            listContainer.appendChild(sectionComponent.getElement());
        });

        this.initSectionSortable(listContainer, hasNoSections);

        return listContainer;
    }

    private initSectionSortable(element: HTMLElement, hasNoSections: boolean) {
        if (hasNoSections) {
            // When there are no sections, make the placeholder a drop zone for fields
            const emptyDropzone = element.querySelector('#empty-fields-dropzone');
            if (emptyDropzone) {
                new Sortable(emptyDropzone as HTMLElement, {
                    group: {
                        name: 'shared-fields',
                        put: ['shared-fields', 'shared-templates']
                    },
                    animation: 150,
                    ghostClass: 'bg-blue-50',
                    onAdd: (evt) => {
                        const item = evt.item;
                        const type = item.getAttribute('data-type');
                        const templateId = item.getAttribute('data-template-id');

                        item.remove(); // Remove the cloned DOM element

                        if (templateId) {
                            // Handle template drop - creates a new section
                            const templates = formStore.getState().templates;
                            const template = templates.find(t => t.id === templateId);
                            if (template) {
                                formStore.getState().importSection(template);
                            }
                        } else if (type && !item.hasAttribute('data-id')) {
                            // Handle new field drop - pass null to create a section automatically
                            formStore.getState().addField(null, type as any, evt.newIndex);
                        } else {
                            // Handle field move - pass null to create a section automatically
                            const fieldId = item.getAttribute('data-id');
                            if (fieldId) {
                                formStore.getState().moveField(fieldId, null, evt.newIndex || 0);
                            }
                        }
                    }
                });
            }
        } else {
            // When sections exist, initialize sortable for section reordering and template drops
            new Sortable(element, {
                group: {
                    name: 'shared-sections',
                    put: ['shared-templates'] // Allow dropping templates here
                },
                handle: '.section-handle',
                animation: 150,
                ghostClass: 'opacity-50',
                onAdd: (evt) => {
                    // Handle template drops on section list
                    const item = evt.item;
                    const templateId = item.getAttribute('data-template-id');

                    if (templateId) {
                        const templates = formStore.getState().templates;
                        const template = templates.find(t => t.id === templateId);

                        item.remove(); // Remove ghost

                        if (template) {
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
}
