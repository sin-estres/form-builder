import { formStore } from '../core/useFormStore';
import { createElement, getIcon } from '../utils/dom';
import { FIELD_TYPES } from '../core/constants';
import { FieldRenderer } from '../renderer/FieldRenderer';
import { FormRenderer } from '../renderer/FormRenderer';
import Sortable from 'sortablejs';
import { createIcons, icons } from 'lucide';

export class FormBuilder {
    private container: HTMLElement;
    private unsubscribe!: () => void;
    private onSave?: (schema: any) => void;

    constructor(container: HTMLElement, options?: { onSave?: (schema: any) => void }) {
        this.container = container;
        this.onSave = options?.onSave;
        this.render();
        this.setupSubscriptions();
    }

    private setupSubscriptions() {
        this.unsubscribe = formStore.subscribe(() => {
           
            // Optimization: We could diff, but for now full re-render is safer for migration.
            // We need to be careful not to kill drag states if we re-render mid-drag.
            // Ideally we only re-render if schema changed in a way that affects DOM structure.
            this.render();
        });
    }

    public destroy() {
        this.unsubscribe();
        this.container.innerHTML = '';
    }

    private render() {
        const state = formStore.getState();

        // Preserve focus state before clearing DOM
        const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
        let focusState: { id: string; selectionStart: number | null; selectionEnd: number | null } | null = null;

        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            const focusId = activeElement.getAttribute('data-focus-id');
            if (focusId) {
                focusState = {
                    id: focusId,
                    selectionStart: activeElement.selectionStart,
                    selectionEnd: activeElement.selectionEnd
                };
            }
        }

        this.container.innerHTML = '';

        const wrapper = createElement('div', { className: 'flex flex-col h-screen ' });

        // Toolbar
        wrapper.appendChild(this.renderToolbar(state));

        const main = createElement('div', { className: 'flex flex-1 overflow-hidden' });

        if (state.isPreviewMode) {
            const previewContainer = createElement('div', { className: 'flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center' });
            const inner = createElement('div', { className: 'w-full max-w-3xl' });
            new FormRenderer(inner, state.schema, (data) => alert(JSON.stringify(data, null, 2)));
            previewContainer.appendChild(inner);
            main.appendChild(previewContainer);
        } else {
            main.appendChild(this.renderToolbox());
            main.appendChild(this.renderCanvas(state));
            main.appendChild(this.renderConfigPanel(state));
        }

        wrapper.appendChild(main);
        this.container.appendChild(wrapper);

        // Restore focus state after DOM is rebuilt
        if (focusState) {
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
                const elementToFocus = document.querySelector(`[data-focus-id="${focusState.id}"]`) as HTMLInputElement | HTMLTextAreaElement;
                if (elementToFocus) {
                    elementToFocus.focus();
                    if (focusState.selectionStart !== null && focusState.selectionEnd !== null) {
                        elementToFocus.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
                    }
                }
            }, 0);
        }

        // Initialize Lucide icons
        createIcons({ icons });

        // Initialize SortableJS
        if (!state.isPreviewMode) {
            this.initSortable();
        }
    }

    private renderToolbar(state: any): HTMLElement {
        const toolbar = createElement('div', { className: 'flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800' });

        // Left
        const left = createElement('div', { className: 'flex items-center space-x-2' });
        left.appendChild(createElement('h1', { className: 'text-xl font-semibold mb-2 text-primary  mr-4', text: 'FormBuilder Pro' }));

        const undoBtn = createElement('button', {
            className: 'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            title: 'Undo',
            disabled: !formStore.getState().canUndo(),
            onclick: () => formStore.getState().undo()
        }, [getIcon('Undo', 18)]);

        const redoBtn = createElement('button', {
            className: 'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
            title: 'Redo',
            disabled: !formStore.getState().canRedo(),
            onclick: () => formStore.getState().redo()
        }, [getIcon('Redo', 18)]);

        left.appendChild(undoBtn);
        left.appendChild(redoBtn);
        toolbar.appendChild(left);

        // Right
        const right = createElement('div', { className: 'flex items-center space-x-2' });

        const clearBtn = createElement('button', {
            className: 'flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors',
            onclick: () => {
                if (confirm('Are you sure?')) {
                    formStore.getState().setSchema({ id: 'new', title: 'New Form', formName: 'newForm', sections: [] });
                }
            }
        }, [getIcon('Trash2', 16), createElement('span', { className: 'ml-2', text: 'Clear' })]);

        const previewBtn = createElement('button', {
            className: `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${state.isPreviewMode ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"}`,
            onclick: () => formStore.getState().togglePreview()
        }, [getIcon('Eye', 16), createElement('span', { className: 'ml-2', text: state.isPreviewMode ? 'Edit' : 'Preview' })]);

        const saveBtn = createElement('button', {
            className: 'flex items-center px-4 py-2 text-sm font-medium text-white bg-[#019FA2] hover:bg-[#3B497E] rounded-md shadow-sm transition-colors',
            onclick: () => {
                const schema = formStore.getState().schema;
                console.log('Schema saved:', schema);

                // Call the callback if provided
                if (this.onSave) {
                    this.onSave(schema);
                }
            }
        }, [getIcon('Save', 16), createElement('span', { className: 'ml-2', text: 'Save' })]);

        right.appendChild(clearBtn);
        right.appendChild(previewBtn);
        right.appendChild(saveBtn);
        toolbar.appendChild(right);

        return toolbar;
    }

    private renderToolbox(): HTMLElement {
        const toolbox = createElement('div', { className: 'w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 overflow-y-auto h-full' });
        toolbox.appendChild(createElement('h2', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4', text: 'Form Fields' }));

        const list = createElement('div', { className: ' grid grid-cols-2 gap-3', id: 'toolbox-list' });

        FIELD_TYPES.forEach(field => {
            const item = createElement('div', {
                className: 'grid justify-center items-center p-3 bg-[#f2f3f7] dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-move hover:border-secondary hover:shadow-sm transition-all toolbox-item mt-0',
                'data-type': field.type
            });
            item.appendChild(createElement('span', { className: ' text-gray-500 mb-1 dark:text-gray-400 inline-flex mx-auto bg-[#019FA2] text-white w-9 h-9 rounded-sm p-1 justify-center items-center' }, [getIcon(field.icon, 16)]));
            item.appendChild(createElement('span', { className: 'text-xs font-semibold text-gray-700 dark:text-gray-200', text: field.label }));
            list.appendChild(item);
        });

        toolbox.appendChild(list);
        return toolbox;
    }

    private renderCanvas(state: any): HTMLElement {
        const canvas = createElement('div', {
            className: 'flex-1 bg-white dark:bg-gray-950 p-8 overflow-y-auto h-full',
            onclick: (e: Event) => {
                if (e.target === canvas || e.target === canvas.firstElementChild) {
                    formStore.getState().selectField(null);
                }
            }
        });

        const inner = createElement('div', { className: 'mx-auto' });

        // Form Name Input
        const formNameInput = createElement('input', {
            className: 'text-lg border border-gray-200 dark:border-gray-700 rounded-md border-gray-200 p-2 bg-[#f2f3f7]  focus:outline-none focus:ring-0 w-full text-gray-600 dark:text-gray-400 mb-8',
            value: state.schema.formName,
            placeholder: 'formName (e.g., contactForm)',
            'data-focus-id': 'form-name',
            oninput: (e: Event) => formStore.getState().setSchema({ ...state.schema, formName: (e.target as HTMLInputElement).value })
        });
        inner.appendChild(formNameInput);

        // Sections Container
        const sectionsContainer = createElement('div', { className: 'space-y-6 min-h-[200px]', id: 'sections-list' });

        state.schema.sections.forEach((section: any) => {
            const sectionEl = createElement('div', {
                className: 'mb-6 rounded-lg border bg-white dark:bg-gray-900 shadow-sm transition-all border-gray-200 dark:border-gray-800',
                'data-id': section.id
            });

            // Header
            const header = createElement('div', { className: 'flex items-center justify-between  p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg' });
            const headerLeft = createElement('div', { className: 'flex items-center flex-1' });
            headerLeft.appendChild(createElement('div', { className: 'cursor-move mr-3 text-gray-400 hover:text-gray-600 section-handle' }, [getIcon('GripVertical', 20)]));
            headerLeft.appendChild(createElement('input', {
                className: 'bg-transparent font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:border-b border-blue-500',
                value: section.title,
                'data-focus-id': `section-title-${section.id}`,
                oninput: (e: Event) => formStore.getState().updateSection(section.id, { title: (e.target as HTMLInputElement).value })
            }));
            header.appendChild(headerLeft);
            header.appendChild(createElement('button', {
                className: 'text-gray-600 hover:text-red-500 transition-colors p-1',
                onclick: () => formStore.getState().removeSection(section.id)
            }, [getIcon('Trash2', 18)]));
            sectionEl.appendChild(header);

            // Fields Grid
            const fieldsGrid = createElement('div', {
                className: 'form-builder-grid p-4 min-h-[100px] fields-list',
                'data-section-id': section.id
            });

            section.fields.forEach((field: any) => {
                const isSelected = state.selectedFieldId === field.id;
                const span = field.width === '100%' ? 'col-span-4' : field.width === '50%' ? 'col-span-2' : 'col-span-1';

                const fieldWrapper = createElement('div', {
                    className: `form-builder-field-wrapper ${isSelected ? 'selected' : ''} ${span}`,
                    'data-id': field.id,
                    onclick: (e: Event) => {
                        e.stopPropagation();
                        formStore.getState().selectField(field.id);
                    }
                });

                // Drag Handle
                fieldWrapper.appendChild(createElement('div', {
                    className: `absolute top-2 left-2 cursor-move p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity field-handle ${isSelected ? "opacity-100" : ""}`
                }, [getIcon('GripVertical', 16)]));

                // Delete
                fieldWrapper.appendChild(createElement('button', {
                    className: `absolute top-2 right-2 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? "opacity-100" : ""}`,
                    onclick: (e: Event) => {
                        e.stopPropagation();
                        formStore.getState().removeField(field.id);
                    }
                }, [getIcon('Trash2', 16)]));

                const content = createElement('div', { className: 'p-4 pointer-events-none' });
                content.appendChild(FieldRenderer.render(field, null, undefined, true));
                fieldWrapper.appendChild(content);

                fieldsGrid.appendChild(fieldWrapper);
            });

            sectionEl.appendChild(fieldsGrid);
            sectionsContainer.appendChild(sectionEl);
        });

        inner.appendChild(sectionsContainer);

        // Add Section Button
        const addSectionBtn = createElement('button', {
            className: 'w-full mt-6 py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center font-medium',
            onclick: () => formStore.getState().addSection()
        }, [getIcon('Plus', 20), createElement('span', { className: 'ml-2', text: 'Add Section' })]);

        inner.appendChild(addSectionBtn);
        canvas.appendChild(inner);
        return canvas;
    }

    private renderConfigPanel(state: any): HTMLElement {
        const panel = createElement('div', { className: 'w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full' });

        const selectedField = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === state.selectedFieldId);

        if (!selectedField) {
            panel.appendChild(createElement('div', { className: 'p-6 text-center text-gray-500', text: 'Select a field to configure' }));
            return panel;
        }

        // Header
        const header = createElement('div', { className: 'flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800' });
        header.appendChild(createElement('h2', { className: 'font-semibold text-gray-900 dark:text-white', text: 'Field Settings' }));
        header.appendChild(createElement('button', {
            className: 'text-gray-500 hover:text-gray-700',
            onclick: () => formStore.getState().selectField(null)
        }, [getIcon('X', 20)]));
        panel.appendChild(header);

        const body = createElement('div', { className: 'flex-1 overflow-y-auto p-4 space-y-6' });

        // Label
        const labelGroup = createElement('div');
        labelGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Label' }));
        labelGroup.appendChild(createElement('input', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
            value: selectedField.label,
            'data-focus-id': `field-label-${selectedField.id}`,
            oninput: (e: Event) => formStore.getState().updateField(selectedField.id, { label: (e.target as HTMLInputElement).value })
        }));
        body.appendChild(labelGroup);

        // Placeholder
        const placeholderGroup = createElement('div');
        placeholderGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Placeholder' }));
        placeholderGroup.appendChild(createElement('input', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
            value: selectedField.placeholder || '',
            'data-focus-id': `field-placeholder-${selectedField.id}`,
            oninput: (e: Event) => formStore.getState().updateField(selectedField.id, { placeholder: (e.target as HTMLInputElement).value })
        }));
        body.appendChild(placeholderGroup);

        // Width
        const widthGroup = createElement('div');
        widthGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Width' }));
        const widthSelect = createElement('select', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
            onchange: (e: Event) => formStore.getState().updateField(selectedField.id, { width: (e.target as HTMLSelectElement).value as any })
        });
        ['25%', '50%', '100%'].forEach(w => {
            widthSelect.appendChild(createElement('option', { value: w, text: w, selected: selectedField.width === w }));
        });
        widthGroup.appendChild(widthSelect);
        body.appendChild(widthGroup);

        // Required
        const requiredGroup = createElement('div', { className: 'flex items-center justify-between' });
        requiredGroup.appendChild(createElement('label', { className: 'text-sm text-gray-700 dark:text-gray-300', text: 'Required' }));
        requiredGroup.appendChild(createElement('input', {
            type: 'checkbox',
            className: 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
            checked: !!selectedField.required,
            onchange: (e: Event) => formStore.getState().updateField(selectedField.id, { required: (e.target as HTMLInputElement).checked })
        }));
        body.appendChild(requiredGroup);

        panel.appendChild(body);
        return panel;
    }

    private initSortable() {
        // Toolbox
        const toolboxList = document.getElementById('toolbox-list');
        if (toolboxList) {
            new Sortable(toolboxList, {
                group: {
                    name: 'shared',
                    pull: 'clone',
                    put: false
                },
                sort: false,
                animation: 150
            });
        }

        // Sections (Reorder)
        const sectionsList = document.getElementById('sections-list');
        if (sectionsList) {
            new Sortable(sectionsList, {
                handle: '.section-handle',
                animation: 150,
                onEnd: (evt) => {
                    if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
                        formStore.getState().moveSection(evt.oldIndex, evt.newIndex);
                    }
                }
            });
        }

        // Fields (Reorder & Drop from Toolbox)
        const fieldLists = document.querySelectorAll('.fields-list');
        fieldLists.forEach(list => {
            new Sortable(list as HTMLElement, {
                group: 'shared',
                handle: '.field-handle',
                animation: 150,
                onAdd: (evt) => {
                    const item = evt.item;
                    const type = item.getAttribute('data-type');
                    const sectionId = list.getAttribute('data-section-id');

                    // If dropped from toolbox
                    if (type && sectionId) {
                        // Remove the cloned DOM element because store update will re-render everything
                        item.remove();
                        formStore.getState().addField(sectionId, type as any, evt.newIndex);
                    } else if (sectionId) {
                        // Moved from another section
                        const fieldId = item.getAttribute('data-id');
                        if (fieldId) {
                            // We need to handle moveField. 
                            // Since we re-render on store update, we just need to call the action.
                            // However, SortableJS might have already moved the DOM.
                            // To avoid conflict, we can remove the item and let render handle it, 
                            // OR we rely on the fact that moveField updates state which triggers render.
                            // But we need to know the source section.
                            // SortableJS 'onAdd' means it came from another list.
                            // 'onUpdate' means same list.

                            // Actually, for simplicity in this migration:
                            // We can just use the DOM state to calculate new index?
                            // No, better to use the event indices.

                            // We need to know where it came FROM.
                            // SortableJS doesn't easily give us the source list ID in onAdd without some setup.
                            // But we can find the field in the store to know its previous section.

                            // Let's just trigger the move.
                            // item.remove(); // Remove DOM, let store re-render.
                            // formStore.getState().moveField(fieldId, sectionId, evt.newIndex);
                        }
                    }
                },
                onUpdate: (evt) => {
                    // Same list reorder
                    const item = evt.item;
                    const fieldId = item.getAttribute('data-id');
                    const sectionId = list.getAttribute('data-section-id');
                    if (fieldId && sectionId && evt.newIndex !== undefined) {
                        formStore.getState().moveField(fieldId, sectionId, evt.newIndex);
                    }
                },
                onEnd: (evt) => {
                    // This fires for both move within list and move to other list.
                    // But we handled onAdd/onUpdate.
                    // Actually, for cross-list move, onAdd fires on target, onRemove fires on source.
                    // We need to be careful not to double update.

                    // Strategy:
                    // If we use `onEnd` on the source list, we know where it went?
                    // SortableJS is tricky with React/VirtualDOM, but here we are doing full re-renders.
                    // So if we modify state, the whole DOM gets trashed and rebuilt.
                    // This might break the drag operation if we are not careful.
                    // But `onEnd` happens AFTER drag.

                    // For cross-list:
                    // `onAdd` on target list is best place to handle "Toolbox -> Canvas" and "Section -> Section".

                    // Let's refine `onAdd`:
                    const item = evt.item;
                    const fromList = evt.from;
                    const toList = evt.to;

                    // If it was a move between sections
                    if (fromList !== toList && fromList.classList.contains('fields-list') && toList.classList.contains('fields-list')) {
                        const fieldId = item.getAttribute('data-id');
                        const targetSectionId = toList.getAttribute('data-section-id');
                        if (fieldId && targetSectionId && evt.newIndex !== undefined) {
                            // We need to prevent Sortable from leaving the DOM in a weird state before our re-render?
                            // Actually, just updating store is enough.
                            formStore.getState().moveField(fieldId, targetSectionId, evt.newIndex);
                        }
                    }
                }
            });
        });
    }
}
