import { formStore } from '../core/useFormStore';
import { createElement, getIcon } from '../utils/dom';
import { FIELD_TYPES } from '../core/constants';
import { FormRenderer } from '../renderer/FormRenderer';
import { FormSchema, FormSection } from '../core/schemaTypes';
import { cloneForm, cloneSection } from '../utils/clone';
import Sortable from 'sortablejs';
import { SectionList } from './SectionList';
import { MasterType } from '../core/useFormStore';


export interface FormBuilderOptions {
    existingForms?: FormSchema[];
    reusableSections?: FormSection[];
    formTemplates?: FormSchema[]; // Form templates (FormSchema[]) - sections will be extracted and loaded into templates
    mode?: 'create' | 'edit';
    formJson?: FormSchema;
    onSave?: (schema: FormSchema) => void;
    onClone?: (schema: FormSchema) => void;
    onSectionImported?: (section: FormSection) => void;
    onTemplateSave?: (template: FormSection) => void;
    data?: {
        masterTypes?: MasterType[];
    };
    // Angular integration inputs
    masterTypeGroups?: {
        id: string;
        displayName: string;
        enumName: string;
    }[];
    dropdownOptionsMap?: {
        [groupEnumName: string]: {
            label: string;
            value: string;
        }[];
    };
    // Angular integration outputs
    onGroupSelectionChange?: (event: { fieldId: string; groupEnumName: string }) => void;
    onDropdownValueChange?: (event: { fieldId: string; value: string }) => void;
}

export class FormBuilder {
    private container: HTMLElement;
    private unsubscribe!: () => void;
    private options: FormBuilderOptions;

    constructor(container: HTMLElement, options: FormBuilderOptions = {}) {
        if (!container) {
            throw new Error('Builder container not found. Please ensure the container element exists before initializing FormBuilder.');
        }
        this.container = container;
        this.options = options;

        // Initialize Store
        if (options.existingForms) {
            formStore.getState().setExistingForms(options.existingForms);
        }
        if (options.reusableSections) {
            formStore.getState().setTemplates(options.reusableSections);
        }
        // Handle formTemplates - extract sections from FormSchema[] and load into templates
        if (options.formTemplates) {
            const extractedSections: FormSection[] = [];
            options.formTemplates.forEach(form => {
                if (form.sections && Array.isArray(form.sections)) {
                    extractedSections.push(...form.sections);
                }
            });
            if (extractedSections.length > 0) {
                // Merge with existing templates if reusableSections was also provided
                const existingTemplates = options.reusableSections || [];
                formStore.getState().setTemplates([...existingTemplates, ...extractedSections]);
            }
        }

        // Load formJson if provided (for edit mode or when explicitly passing form data)
        if (options.formJson) {
            formStore.getState().setSchema(options.formJson);
        } else if (options.mode === 'create') {
            // Ensure fresh state if needed, though store defaults to new form
            // formStore.getState().setSchema(INITIAL_SCHEMA); 
        }

        // Store masterTypes configuration if provided
        if (options.data?.masterTypes) {
            formStore.getState().setMasterTypes(options.data.masterTypes);
        }

        // Store masterTypeGroups if provided (for Angular integration)
        if (options.masterTypeGroups) {
            // Convert masterTypeGroups to MasterType format for internal use
            const masterTypes: MasterType[] = options.masterTypeGroups.map(group => ({
                id: group.id,
                name: group.displayName.toLowerCase().replace(/\s+/g, '-'), // Generate name from displayName
                displayName: group.displayName,
                enumName: group.enumName,
                indexes: [],
                active: true
            }));
            formStore.getState().setMasterTypes(masterTypes);
        }

        // Store dropdownOptionsMap if provided
        if (options.dropdownOptionsMap) {
            formStore.getState().setDropdownOptionsMap(options.dropdownOptionsMap);
        }

        this.render();
        this.setupSubscriptions();
    }

    // Public API
    public loadForm(json: FormSchema) {
        formStore.getState().setSchema(json);
    }

    public cloneForm(json: FormSchema) {
        const cloned = cloneForm(json);
        formStore.getState().setSchema(cloned);
        this.options.onClone?.(cloned);
    }

    public importSection(section: FormSection) {
        formStore.getState().importSection(section);
        this.options.onSectionImported?.(section);
    }

    public saveSectionAsTemplate(section: FormSection) {
        // In a real app this might save to API. 
        // Here we update local state and callback.
        const template = cloneSection(section); // Clone to detach
        const currentTemplates = formStore.getState().templates;
        formStore.getState().setTemplates([...currentTemplates, template]);
        this.options.onTemplateSave?.(template);
    }

    public applyTemplate(template: FormSection) {
        this.importSection(template);
    }

    public updateExistingForms(forms: FormSchema[]) {
        formStore.getState().setExistingForms(forms);
        // Re-render to update the import dropdown
        this.render();
    }

    public updateTemplates(templates: FormSection[]) {
        formStore.getState().setTemplates(templates);
        // Re-render to update the templates tab
        this.render();
    }

    public updateDropdownOptionsMap(dropdownOptionsMap: { [groupEnumName: string]: { label: string; value: string }[] }) {
        formStore.getState().setDropdownOptionsMap(dropdownOptionsMap);
        // Re-render to update dropdown options
        this.render();
    }

    public updateMasterTypeGroups(masterTypeGroups: { id: string; displayName: string; enumName: string }[]) {
        // Convert masterTypeGroups to MasterType format for internal use
        const masterTypes: MasterType[] = masterTypeGroups.map(group => ({
            id: group.id,
            name: group.displayName.toLowerCase().replace(/\s+/g, '-'), // Generate name from displayName
            displayName: group.displayName,
            enumName: group.enumName,
            indexes: [],
            active: true
        }));
        formStore.getState().setMasterTypes(masterTypes);
        // Re-render to update Group dropdown
        this.render();
    }

    public loadFormTemplates(formTemplates: FormSchema[]) {
        // Extract sections from FormSchema[] and add to templates
        const extractedSections: FormSection[] = [];
        formTemplates.forEach(form => {
            if (form.sections && Array.isArray(form.sections)) {
                extractedSections.push(...form.sections);
            }
        });
        if (extractedSections.length > 0) {
            const currentTemplates = formStore.getState().templates;
            formStore.getState().setTemplates([...currentTemplates, ...extractedSections]);
            // Re-render to update the templates tab
            this.render();
        }
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

        const main = createElement('div', { className: 'flex flex-col md:flex-row flex-1 overflow-hidden' });

        if (state.isPreviewMode) {
            // Ensure options are populated from master types before rendering preview
            const masterTypes = state.masterTypes;
            if (masterTypes && masterTypes.length > 0 && state.schema.sections) {
                // Helper function to convert master type indexes to options format
                const convertIndexesToOptions = (indexes: any[]): { label: string; value: string }[] => {
                    if (!indexes || !Array.isArray(indexes) || indexes.length === 0) {
                        return [];
                    }
                    return indexes.map((item, index) => {
                        if (typeof item === 'string') {
                            return { label: item, value: item };
                        }
                        if (typeof item === 'object' && item !== null) {
                            const label = item.label || item.name || item.displayName || item.text || `Option ${index + 1}`;
                            const value = item.value || item.id || item.name || String(index);
                            return { label, value };
                        }
                        return { label: String(item), value: String(item) };
                    });
                };

                // Helper function to check if options are default placeholder options
                const areDefaultOptions = (options: any[]): boolean => {
                    if (!options || options.length === 0) return true;
                    return options.every((opt, idx) => 
                        opt.label === `Option ${idx + 1}` && 
                        (opt.value === `opt${idx + 1}` || opt.value === `Option ${idx + 1}`)
                    );
                };

                // Create a schema with populated options for preview
                const previewSchema = {
                    ...state.schema,
                    sections: state.schema.sections.map(section => ({
                        ...section,
                        fields: section.fields.map(field => {
                            if (field.type === 'select' && field.groupName) {
                                const masterType = masterTypes.find(mt => 
                                    mt.active === true && 
                                    (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                                );
                                if (masterType && masterType.indexes && masterType.indexes.length > 0) {
                                    if (!field.options || field.options.length === 0 || areDefaultOptions(field.options)) {
                                        const options = convertIndexesToOptions(masterType.indexes);
                                        return { ...field, options };
                                    }
                                }
                            }
                            return field;
                        })
                    }))
                };
                
                const previewContainer = createElement('div', { className: 'flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center' });
                const inner = createElement('div', { className: 'w-full max-w-3xl' });
                new FormRenderer(inner, previewSchema, (data) => alert(JSON.stringify(data, null, 2)), this.options.onDropdownValueChange);
                previewContainer.appendChild(inner);
                main.appendChild(previewContainer);
            } else {
                const previewContainer = createElement('div', { className: 'flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center' });
                const inner = createElement('div', { className: 'w-full max-w-3xl' });
                new FormRenderer(inner, state.schema, (data) => alert(JSON.stringify(data, null, 2)), this.options.onDropdownValueChange);
                previewContainer.appendChild(inner);
                main.appendChild(previewContainer);
            }
        } else {
            // Wrap toolbox for mobile collapsibility
            const toolboxWrapper = createElement('div', { className: 'form-builder-toolbox-wrapper w-full md:w-80 bg-white dark:bg-gray-900 border-r md:border-r border-b md:border-b-0 border-gray-200 dark:border-gray-800' });
            toolboxWrapper.appendChild(this.renderToolbox());
            main.appendChild(toolboxWrapper);

            // Canvas wrapper
            const canvasWrapper = createElement('div', { className: 'form-builder-canvas flex-1 overflow-y-auto' });
            canvasWrapper.appendChild(this.renderCanvas(state));
            main.appendChild(canvasWrapper);

            // Wrap config panel for mobile collapsibility
            const configWrapper = createElement('div', { className: 'form-builder-config-wrapper w-full md:w-80 bg-white dark:bg-gray-900 border-l md:border-l border-t md:border-t-0 border-gray-200 dark:border-gray-800' });
            configWrapper.appendChild(this.renderConfigPanel(state));
            main.appendChild(configWrapper);
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



        // Initialize SortableJS
        if (!state.isPreviewMode) {
            this.initSidebarSortables();
        }
    }

    private renderToolbar(state: any): HTMLElement {
        const toolbar = createElement('div', { className: 'flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800' });

        // Left
        const left = createElement('div', { className: 'flex items-center space-x-2' });
        left.appendChild(createElement('h1', { className: 'text-xl font-semibold mb-2 text-primary  mr-4', text: 'FormBuilder Pro' }));

        // Form Selection Dropdown
        if (state.existingForms && state.existingForms.length > 0) {
            const formSelect = createElement('select', {
                className: 'px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm mr-2',
                onchange: (e: Event) => {
                    const formId = (e.target as HTMLSelectElement).value;
                    if (formId) {
                        formStore.getState().loadForm(formId);
                    }
                }
            });

            // Add current form as option if not in existing forms (e.g. new form)
            const currentInList = state.existingForms.find((f: any) => f.id === state.schema.id);
            if (!currentInList) {
                formSelect.appendChild(createElement('option', { value: state.schema.id, text: state.schema.formName || 'New Form', selected: true }));
                formSelect.appendChild(createElement('option', { disabled: true, text: '---' }));
            }

            state.existingForms.forEach((f: any) => {
                formSelect.appendChild(createElement('option', {
                    value: f.id,
                    text: f.formName || f.title,
                    selected: f.id === state.schema.id
                }));
            });
            left.appendChild(formSelect);

            // Clone Button
            const cloneBtn = createElement('button', {
                className: 'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600',
                title: 'Clone Form',
                onclick: () => this.cloneForm(state.schema)
            }, [getIcon('Copy', 18)]);
            left.appendChild(cloneBtn);
        }

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
                if (this.options.onSave) {
                    this.options.onSave(schema);
                }
            }
        }, [getIcon('Save', 16), createElement('span', { className: 'ml-2', text: 'Save' })]);

        right.appendChild(clearBtn);
        right.appendChild(previewBtn);
        right.appendChild(saveBtn);
        toolbar.appendChild(right);

        return toolbar;
    }

    private activeTab: 'fields' | 'templates' | 'import' = 'fields';

    private renderToolbox(): HTMLElement {
        const toolbox = createElement('div', { className: 'bg-white dark:bg-gray-900 flex flex-col h-full' });

        // Tabs
        const tabs = createElement('div', { className: 'flex border-b border-gray-200 dark:border-gray-800' });
        const createTab = (id: 'fields' | 'templates' | 'import', label: string) => {
            const isActive = this.activeTab === id;
            return createElement('button', {
                className: `flex-1 py-3 text-sm font-medium transition-colors ${isActive ? 'text-[#019FA2] border-b-2 border-[#019FA2]' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`,
                text: label,
                onclick: () => {
                    this.activeTab = id;
                    this.render(); // Re-render to show new tab content
                }
            });
        };
        tabs.appendChild(createTab('fields', 'Fields'));
        tabs.appendChild(createTab('templates', 'Templates'));
        tabs.appendChild(createTab('import', 'Import'));
        toolbox.appendChild(tabs);

        // Content
        const content = createElement('div', { className: 'flex-1 overflow-y-auto p-4' });

        if (this.activeTab === 'fields') {
            const list = createElement('div', { className: 'grid grid-cols-2 gap-3', id: 'toolbox-list' });
            FIELD_TYPES.forEach(field => {
                const item = createElement('div', {
                    className: 'grid justify-center items-center p-3 bg-[#f2f3f7] dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-move hover:border-secondary hover:shadow-sm transition-all toolbox-item mt-0',
                    'data-type': field.type
                });
                item.appendChild(createElement('span', { className: ' text-gray-500 mb-1 dark:text-gray-400 inline-flex mx-auto bg-[#019FA2] text-white w-9 h-9 rounded-sm p-1 justify-center items-center' }, [getIcon(field.icon, 16)]));
                item.appendChild(createElement('span', { className: 'text-xs font-semibold text-gray-700 dark:text-gray-200', text: field.label }));
                list.appendChild(item);
            });
            content.appendChild(list);
        } else if (this.activeTab === 'templates') {
            const templates = formStore.getState().templates;
            if (templates.length === 0) {
                content.appendChild(createElement('div', { className: 'text-sm text-gray-500 text-center mt-4', text: 'No templates saved.' }));
            } else {
                const templatesList = createElement('div', { id: 'templates-list', className: 'space-y-3' });
                templates.forEach(t => {
                    const item = createElement('div', {
                        className: 'p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-move hover:border-blue-500 hover:shadow-sm transition-all template-item',
                        'data-template-id': t.id,
                        'data-type': 'template-section'
                    });

                    // Title
                    item.appendChild(createElement('div', {
                        className: 'font-semibold text-sm text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2'
                    }, [
                        getIcon('DocumentText', 16), // Small icon
                        createElement('span', { text: t.title })
                    ]));

                    // Fields Summary
                    const fieldNames = t.fields.map(f => f.label).join(', ');
                    item.appendChild(createElement('div', {
                        className: 'text-xs text-gray-500 truncate',
                        text: `Fields: ${fieldNames}`
                    }));

                    templatesList.appendChild(item);
                });
                content.appendChild(templatesList);
            }
        } else if (this.activeTab === 'import') {
            const existingForms = formStore.getState().existingForms;

            const select = createElement('select', {
                className: 'w-full px-3 py-2 mb-4 border rounded bg-transparent',
                onchange: (e: Event) => {
                    const formId = (e.target as HTMLSelectElement).value;
                    this.renderImportList(content, formId);
                }
            });
            select.appendChild(createElement('option', { text: 'Select a form...', value: '' }));
            existingForms.forEach(f => select.appendChild(createElement('option', { value: f.id, text: f.formName })));
            content.appendChild(select);

            // Container for sections list
            const sectionsList = createElement('div', { id: 'import-sections-list' });
            content.appendChild(sectionsList);
        }

        toolbox.appendChild(content);
        return toolbox;
    }

    private renderImportList(container: HTMLElement, formId: string) {
        const listContainer = container.querySelector('#import-sections-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        const form = formStore.getState().existingForms.find(f => f.id === formId);
        if (!form) return;

        form.sections.forEach(section => {
            const item = createElement('div', {
                className: 'flex items-center justify-between p-3 mb-2 bg-gray-50 dark:bg-gray-800 border rounded'
            });
            item.appendChild(createElement('span', { className: 'text-sm font-medium', text: section.title }));
            item.appendChild(createElement('button', {
                className: 'text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200',
                text: 'Import',
                onclick: () => this.importSection(section)
            }));
            listContainer.appendChild(item);
        });
    }

    private renderCanvas(state: any): HTMLElement {
        const canvas = createElement('div', {
            className: 'flex-1 bg-white dark:bg-gray-950 p-4 md:p-8 overflow-y-auto',
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

        // SectionList
        const sectionList = new SectionList(state.schema, state.selectedFieldId);
        inner.appendChild(sectionList.getElement());

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
        const panel = createElement('div', { className: 'bg-white dark:bg-gray-900 flex flex-col h-full' });

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
        ['25%', '33%', '50%', '66%', '75%', '100%'].forEach(w => {
            widthSelect.appendChild(createElement('option', { value: w, text: w, selected: selectedField.width === w }));
        });
        widthGroup.appendChild(widthSelect);
        body.appendChild(widthGroup);

        // Required
        const requiredGroup = createElement('div', { className: 'flex items-center justify-between mb-4' });
        requiredGroup.appendChild(createElement('label', { className: 'text-sm text-gray-700 dark:text-gray-300', text: 'Required' }));
        requiredGroup.appendChild(createElement('input', {
            type: 'checkbox',
            className: 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
            checked: !!selectedField.required,
            onchange: (e: Event) => formStore.getState().updateField(selectedField.id, { required: (e.target as HTMLInputElement).checked })
        }));
        body.appendChild(requiredGroup);

        // Enabled
        const enabledGroup = createElement('div', { className: 'flex items-center justify-between mb-4' });
        enabledGroup.appendChild(createElement('label', { className: 'text-sm text-gray-700 dark:text-gray-300', text: 'Enabled' }));
        enabledGroup.appendChild(createElement('input', {
            type: 'checkbox',
            className: 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
            checked: selectedField.enabled !== false, // Default to true if not specified
            onchange: (e: Event) => formStore.getState().updateField(selectedField.id, { enabled: (e.target as HTMLInputElement).checked })
        }));
        body.appendChild(enabledGroup);

        // Visible
        const visibleGroup = createElement('div', { className: 'flex items-center justify-between mb-4' });
        visibleGroup.appendChild(createElement('label', { className: 'text-sm text-gray-700 dark:text-gray-300', text: 'Visible' }));
        visibleGroup.appendChild(createElement('input', {
            type: 'checkbox',
            className: 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
            checked: selectedField.visible !== false, // Default to true if not specified
            onchange: (e: Event) => formStore.getState().updateField(selectedField.id, { visible: (e.target as HTMLInputElement).checked })
        }));
        body.appendChild(visibleGroup);

        // --- Group Name (Select/Dropdown only) ---
        if (selectedField.type === 'select') {
            const masterTypes = formStore.getState().masterTypes;
            const activeMasterTypes = masterTypes.filter(mt => mt.active === true);
            const dropdownOptionsMap = formStore.getState().dropdownOptionsMap;
            
            // Helper function to convert master type indexes to options format
            const convertIndexesToOptions = (indexes: any[]): { label: string; value: string }[] => {
                if (!indexes || !Array.isArray(indexes) || indexes.length === 0) {
                    return [];
                }
                
                return indexes.map((item, index) => {
                    // If item is a string, use it as both label and value
                    if (typeof item === 'string') {
                        return { label: item, value: item };
                    }
                    // If item is an object, try to extract label and value
                    if (typeof item === 'object' && item !== null) {
                        const label = item.label || item.name || item.displayName || item.text || `Option ${index + 1}`;
                        const value = item.value || item.id || item.name || String(index);
                        return { label, value };
                    }
                    // Fallback
                    return { label: String(item), value: String(item) };
                });
            };
            
            if (activeMasterTypes.length > 0) {
                const groupNameGroup = createElement('div', { className: 'mb-4' });
                groupNameGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Group Name' }));
                const groupNameSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                    onchange: (e: Event) => {
                        const selectedEnumName = (e.target as HTMLSelectElement).value;
                        if (selectedEnumName) {
                            const selectedMasterType = activeMasterTypes.find(mt => mt.enumName === selectedEnumName);
                            if (selectedMasterType) {
                                // Check if dropdownOptionsMap has options for this enumName
                                let options: { label: string; value: string }[] = [];
                                
                                if (dropdownOptionsMap && dropdownOptionsMap[selectedEnumName]) {
                                    // Use options from dropdownOptionsMap (Angular integration)
                                    options = dropdownOptionsMap[selectedEnumName];
                                } else if (selectedMasterType.indexes && selectedMasterType.indexes.length > 0) {
                                    // Fallback to indexes from master type
                                    options = convertIndexesToOptions(selectedMasterType.indexes);
                                }
                                
                                formStore.getState().updateField(selectedField.id, {
                                    groupName: {
                                        id: selectedMasterType.id,
                                        name: selectedMasterType.name
                                    },
                                    options: options.length > 0 ? options : undefined
                                });
                                
                                // Emit groupSelectionChange event (Angular integration)
                                if (this.options.onGroupSelectionChange) {
                                    this.options.onGroupSelectionChange({
                                        fieldId: selectedField.id,
                                        groupEnumName: selectedEnumName
                                    });
                                }
                            }
                        } else {
                            formStore.getState().updateField(selectedField.id, { 
                                groupName: undefined,
                                options: undefined // Clear options when groupName is cleared
                            });
                        }
                    }
                });
                
                // Add empty option for clearing selection
                groupNameSelect.appendChild(createElement('option', { 
                    value: '', 
                    text: 'None', 
                    selected: !selectedField.groupName 
                }));
                
                // Add options from active masterTypes - use enumName as value, displayName as text
                activeMasterTypes.forEach(mt => {
                    const isSelected = selectedField.groupName && 
                        (selectedField.groupName.id === mt.id || selectedField.groupName.name === mt.name);
                    // Use enumName as value for Angular integration
                    const optionValue = mt.enumName || mt.id || mt.name;
                    groupNameSelect.appendChild(createElement('option', { 
                        value: optionValue, 
                        text: mt.displayName || mt.name, 
                        selected: !!isSelected 
                    }));
                });
                
                groupNameGroup.appendChild(groupNameSelect);
                body.appendChild(groupNameGroup);
                
                // If field already has a groupName but no options, check dropdownOptionsMap first, then master type indexes
                if (selectedField.groupName && (!selectedField.options || selectedField.options.length === 0)) {
                    const currentMasterType = activeMasterTypes.find(mt => 
                        mt.id === selectedField.groupName?.id || mt.name === selectedField.groupName?.name
                    );
                    if (currentMasterType) {
                        let options: { label: string; value: string }[] = [];
                        
                        // Check dropdownOptionsMap first (Angular integration)
                        if (currentMasterType.enumName && dropdownOptionsMap && dropdownOptionsMap[currentMasterType.enumName]) {
                            options = dropdownOptionsMap[currentMasterType.enumName];
                        } else if (currentMasterType.indexes && currentMasterType.indexes.length > 0) {
                            // Fallback to indexes from master type
                            options = convertIndexesToOptions(currentMasterType.indexes);
                        }
                        
                        if (options.length > 0) {
                            formStore.getState().updateField(selectedField.id, { options });
                        }
                    }
                }
            }
        }

        // --- Advanced Validation ---
        const validationHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Validation Rules' });
        body.appendChild(validationHeader);

        const validations = selectedField.validation || [];
        const updateValidation = (rule: any) => {
            // Very basic replacement logic for demo
            const newValidations = validations.filter((v: any) => v.type !== rule.type);
            if (rule.value !== undefined && rule.value !== '') {
                newValidations.push(rule);
            }
            formStore.getState().updateField(selectedField.id, { validation: newValidations });
        };

        const getRuleValue = (type: string) => validations.find((v: any) => v.type === type)?.value || '';

        // Min/Max Length (Text/Textarea)
        if (['text', 'textarea', 'email', 'password'].includes(selectedField.type)) {
            const minLenGroup = createElement('div', { className: 'mb-3' });
            minLenGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Min Length' }));
            minLenGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('minLength'),
                placeholder: 'e.g. 3',
                onchange: (e: Event) => updateValidation({ type: 'minLength', value: parseInt((e.target as HTMLInputElement).value) })
            }));
            body.appendChild(minLenGroup);

            const maxLenGroup = createElement('div', { className: 'mb-3' });
            maxLenGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Max Length' }));
            maxLenGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('maxLength'),
                placeholder: 'e.g. 100',
                onchange: (e: Event) => updateValidation({ type: 'maxLength', value: parseInt((e.target as HTMLInputElement).value) })
            }));
            body.appendChild(maxLenGroup);

            // Regex
            const regexGroup = createElement('div', { className: 'mb-3' });
            regexGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Regex Pattern' }));
            regexGroup.appendChild(createElement('input', {
                type: 'text',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: validations.find((v: any) => v.type === 'pattern')?.regex || '',
                placeholder: 'e.g. ^[A-Z]+$',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    const existing = validations.find((v: any) => v.type === 'pattern');
                    const newValidations = validations.filter((v: any) => v.type !== 'pattern');
                    if (val) {
                        newValidations.push({ type: 'pattern', regex: val, message: existing?.message || 'Invalid format' });
                    }
                    formStore.getState().updateField(selectedField.id, { validation: newValidations });
                }
            }));
            body.appendChild(regexGroup);
        }

        // Min/Max Value (Number)
        if (selectedField.type === 'number') {
            const minValGroup = createElement('div', { className: 'mb-3' });
            minValGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Min Value' }));
            minValGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('min'),
                onchange: (e: Event) => updateValidation({ type: 'min', value: parseInt((e.target as HTMLInputElement).value) })
            }));
            body.appendChild(minValGroup);

            const maxValGroup = createElement('div', { className: 'mb-3' });
            maxValGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Max Value' }));
            maxValGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('max'),
                onchange: (e: Event) => updateValidation({ type: 'max', value: parseInt((e.target as HTMLInputElement).value) })
            }));
            body.appendChild(maxValGroup);
        }

        // --- Async Options (Select/Radio) ---
        if (['select', 'radio'].includes(selectedField.type)) {
            const optionsHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Options Source' });
            body.appendChild(optionsHeader);

            const sourceGroup = createElement('div', { className: 'mb-4' });
            sourceGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Source Type' }));
            const sourceSelect = createElement('select', {
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                onchange: (e: Event) => {
                    const isAsync = (e.target as HTMLSelectElement).value === 'api';
                    if (isAsync) {
                        formStore.getState().updateField(selectedField.id, {
                            optionsSource: { api: 'https://', method: 'GET', labelKey: 'name', valueKey: 'id' }
                        });
                    } else {
                        formStore.getState().updateField(selectedField.id, { optionsSource: undefined });
                    }
                    // Force re-render of panel to show fields
                    this.render();
                }
            });
            sourceSelect.appendChild(createElement('option', { value: 'static', text: 'Static Options', selected: !selectedField.optionsSource }));
            sourceSelect.appendChild(createElement('option', { value: 'api', text: 'API Endpoint', selected: !!selectedField.optionsSource }));
            sourceGroup.appendChild(sourceSelect);
            body.appendChild(sourceGroup);

            if (selectedField.optionsSource) {
                // API URL
                const apiGroup = createElement('div', { className: 'mb-3' });
                apiGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'API URL' }));
                apiGroup.appendChild(createElement('input', {
                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                    value: selectedField.optionsSource.api,
                    oninput: (e: Event) => formStore.getState().updateField(selectedField.id, { optionsSource: { ...selectedField.optionsSource!, api: (e.target as HTMLInputElement).value } })
                }));
                body.appendChild(apiGroup);

                // Label/Value Key (Row)
                const keysRow = createElement('div', { className: 'flex gap-2 mb-3' });
                const labelKeyGroup = createElement('div', { className: 'flex-1' });
                labelKeyGroup.appendChild(createElement('label', { className: 'block text-xs font-medium text-gray-500 mb-1', text: 'Label Key' }));
                labelKeyGroup.appendChild(createElement('input', {
                    className: 'w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm',
                    value: selectedField.optionsSource.labelKey,
                    oninput: (e: Event) => formStore.getState().updateField(selectedField.id, { optionsSource: { ...selectedField.optionsSource!, labelKey: (e.target as HTMLInputElement).value } })
                }));

                const valueKeyGroup = createElement('div', { className: 'flex-1' });
                valueKeyGroup.appendChild(createElement('label', { className: 'block text-xs font-medium text-gray-500 mb-1', text: 'Value Key' }));
                valueKeyGroup.appendChild(createElement('input', {
                    className: 'w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm',
                    value: selectedField.optionsSource.valueKey,
                    oninput: (e: Event) => formStore.getState().updateField(selectedField.id, { optionsSource: { ...selectedField.optionsSource!, valueKey: (e.target as HTMLInputElement).value } })
                }));

                keysRow.appendChild(labelKeyGroup);
                keysRow.appendChild(valueKeyGroup);
                body.appendChild(keysRow);
            }
        }

        panel.appendChild(body);
        return panel;
    }

    private initSidebarSortables() {
        // Toolbox (Fields)
        const toolboxList = document.getElementById('toolbox-list');
        if (toolboxList) {
            new Sortable(toolboxList, {
                group: {
                    name: 'shared-fields', // Matches the group in Section.ts
                    pull: 'clone',
                    put: false
                },
                sort: false,
                animation: 150
            });
        }

        // Templates List (Draggable)
        const templatesList = document.getElementById('templates-list');
        if (templatesList) {
            new Sortable(templatesList, {
                group: {
                    name: 'shared-templates',
                    pull: 'clone',
                    put: false
                },
                sort: false,
                animation: 150,
                draggable: '.template-item',
                forceFallback: true
            });
        }
    }
}
