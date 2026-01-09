import { formStore } from '../core/useFormStore';
import { createElement, getIcon } from '../utils/dom';
import { FIELD_TYPES, REGEX_PRESETS, RegexPreset } from '../core/constants';
import { FormRenderer } from '../renderer/FormRenderer';
import { FormSchema, FormSection, parseWidth, FieldWidth } from '../core/schemaTypes';
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

        // Preserve scroll position before clearing DOM
        // Find scroll container in edit mode (canvasWrapper) or preview mode (previewContainer)
        // canvasWrapper has unique class 'form-builder-canvas'
        // previewContainer has 'overflow-y-auto' and 'bg-white' (toolbox/config don't have bg-white on scroll container)
        const canvasWrapper = this.container.querySelector('.form-builder-canvas') as HTMLElement | null;
        const previewContainer = this.container.querySelector('.flex-1.overflow-y-auto.bg-white') as HTMLElement | null;
        const scrollContainer = canvasWrapper || previewContainer;
        const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

        this.container.innerHTML = '';

        const wrapper = createElement('div', { className: 'flex flex-col h-screen ' });

        // Toolbar
        wrapper.appendChild(this.renderToolbar(state));

        const main = createElement('div', { className: 'flex flex-col md:flex-row flex-1 overflow-hidden ' });

        if (state.isPreviewMode) {
            // Ensure options are populated from master types before rendering preview
            const masterTypes = state.masterTypes;
            const dropdownOptionsMap = state.dropdownOptionsMap;
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
                            // Hydrate dropdown fields that have masterTypeName or groupName
                            if (field.type === 'select') {
                                let masterType: MasterType | undefined;

                                // Case 1: Field has masterTypeName - find master type by enumName
                                if (field.masterTypeName) {
                                    masterType = masterTypes.find(mt =>
                                        mt.active === true &&
                                        mt.enumName === field.masterTypeName
                                    );
                                }
                                // Case 2: Field has groupName - find master type by groupName
                                else if (field.groupName) {
                                    masterType = masterTypes.find(mt =>
                                        mt.active === true &&
                                        (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                                    );
                                }

                                if (masterType) {
                                    let options: { label: string; value: string }[] = [];

                                    // Priority 1: Check dropdownOptionsMap first (Angular integration)
                                    if (masterType.enumName && dropdownOptionsMap && dropdownOptionsMap[masterType.enumName]) {
                                        options = dropdownOptionsMap[masterType.enumName];
                                    }
                                    // Priority 2: Use master type indexes
                                    else if (masterType.indexes && masterType.indexes.length > 0) {
                                        options = convertIndexesToOptions(masterType.indexes);
                                    }

                                    // For preview, always use master type options if available
                                    // This ensures dropdowns with masterTypeName show correct options in preview
                                    if (options.length > 0) {
                                        // If field has masterTypeName, always use master type options (masterTypeName wins)
                                        // Otherwise, only update if options are missing, empty, or default
                                        if (field.masterTypeName || !field.options || field.options.length === 0 || areDefaultOptions(field.options)) {
                                            return { ...field, options };
                                        }
                                    }
                                }
                            }
                            return field;
                        })
                    }))
                };

                const previewContainer = createElement('div', { className: 'flex-1  p-8 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center' });
                const inner = createElement('div', { className: 'w-full' });
                new FormRenderer(inner, previewSchema, (data) => alert(JSON.stringify(data, null, 2)), this.options.onDropdownValueChange);
                previewContainer.appendChild(inner);
                main.appendChild(previewContainer);
            } else {
                const previewContainer = createElement('div', { className: 'flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center' });
                const inner = createElement('div', { className: 'w-full ' });
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

        // Restore scroll position after DOM is rebuilt
        if (savedScrollTop > 0) {
            // Use requestAnimationFrame to ensure DOM is fully laid out before restoring scroll
            requestAnimationFrame(() => {
                // Find the scroll container in the newly rendered DOM
                // canvasWrapper has unique class 'form-builder-canvas'
                // previewContainer has 'overflow-y-auto' and 'bg-white' (toolbox/config don't have bg-white on scroll container)
                const newCanvasWrapper = this.container.querySelector('.form-builder-canvas') as HTMLElement | null;
                const newPreviewContainer = this.container.querySelector('.flex-1.overflow-y-auto.bg-white') as HTMLElement | null;
                const newScrollContainer = newCanvasWrapper || newPreviewContainer;
                if (newScrollContainer) {
                    newScrollContainer.scrollTop = savedScrollTop;
                }
            });
        }

        // Restore focus state after DOM is rebuilt
        if (focusState) {
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
                const elementToFocus = document.querySelector(`[data-focus-id="${focusState!.id}"]`) as HTMLInputElement | HTMLTextAreaElement;
                if (elementToFocus && focusState) {
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
        left.appendChild(createElement('h1', { className: 'text-xl font-semibold mb-2 text-primary hidden  mr-4', text: '' }));

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
            className: 'flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-500 text-white rounded-md transition-colors',
            onclick: () => {
                if (confirm('Are you sure?')) {
                    formStore.getState().setSchema({ id: 'new', title: 'New Form', formName: 'newForm', sections: [] });
                }
            }
        }, [getIcon('Trash2', 16), createElement('span', { className: '', title: 'Clear', })]);

        const previewBtn = createElement('button', {
            className: `flex items-center px-3 py-2 text-sm bg-[#3b497e] text-white font-medium rounded-md transition-colors ${state.isPreviewMode ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "text-gray-700 dark:text-gray-200 "}`,
            onclick: () => formStore.getState().togglePreview()
        }, [getIcon('Eye', 16), createElement('span', { className: '', text: state.isPreviewMode ? '' : '' })]);

        const saveBtn = createElement('button', {
            className: 'flex items-center px-3 py-2 text-sm font-medium text-white bg-[#019FA2]  rounded-md shadow-sm transition-colors',
            onclick: () => {
                const schema = formStore.getState().schema;
                console.log('Schema saved:', schema);

                // Call the callback if provided (schema is already cleaned by setSchema)
                if (this.options.onSave) {
                    this.options.onSave(schema);
                }
            }
        }, [getIcon('Save', 16), createElement('span', { className: '', text: '' })]);

        right.appendChild(clearBtn);
        right.appendChild(previewBtn);
        right.appendChild(saveBtn);
        toolbar.appendChild(right);

        return toolbar;
    }

    private activeTab: 'fields' | 'templates' | 'import' = 'fields';

    private renderToolbox(): HTMLElement {
        const toolbox = createElement('div', { className: 'bg-[#f8faff] dark:bg-gray-900 flex flex-col h-full' });

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
                    className: 'grid justify-center items-center p-2 bg-white  dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-move hover:border-secondary hover:shadow-sm transition-all toolbox-item mt-0',
                    'data-type': field.type
                });
                item.appendChild(createElement('span', { className: ' text-sm  dark:text-gray-400 inline-flex mx-auto  text-bg-secondary w-8 h-8 rounded-sm p-1 justify-center items-center' }, [getIcon(field.icon, 16)]));
                item.appendChild(createElement('span', { className: 'text-xs  text-gray-700 dark:text-gray-200', text: field.label }));
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
            className: 'flex-1 bg-[#f8faff] dark:bg-gray-950 p-4 md:p-8 overflow-y-auto',
            onclick: (e: Event) => {
                if (e.target === canvas || e.target === canvas.firstElementChild) {
                    formStore.getState().selectField(null);
                }
            }
        });

        const inner = createElement('div', { className: 'mx-auto' });

        // Form Name Input
        const formNameInput = createElement('input', {
            className: 'text-base border border-gray-200 dark:border-gray-700 rounded-md border-gray-200 p-2   focus:outline-none focus:ring-0 w-full text-gray-600 dark:text-gray-400 mb-8',
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
            className: 'w-full mt-6 py-3  dark:border-gray-700 rounded-lg text-gray-500 bg-[#3b497e] text-white transition-colors flex items-center justify-center font-medium',
            onclick: () => formStore.getState().addSection()
        }, [getIcon('Plus', 20), createElement('span', { className: 'ml-2', text: 'Add Section' })]);

        inner.appendChild(addSectionBtn);
        canvas.appendChild(inner);
        return canvas;
    }

    private renderConfigPanel(state: any): HTMLElement {
        const panel = createElement('div', { className: 'bg-[#f8faff]  dark:bg-gray-900 flex flex-col h-full' });

        const selectedField = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === state.selectedFieldId);

        if (!selectedField) {
            panel.appendChild(createElement('div', { className: 'p-4 text-center text-gray-500', text: 'Select a field to configure' }));
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

        // Width Slider
        const widthGroup = createElement('div', { className: 'width-slider-group' });

        // Label with current value display
        const widthLabelRow = createElement('div', { className: 'flex items-center justify-between mb-2' });
        widthLabelRow.appendChild(createElement('label', { className: 'text-sm font-medium text-gray-700 dark:text-gray-300', text: 'Width' }));

        // Get current width as number
        const currentWidth = parseWidth(selectedField.width);

        // Value display badge
        const widthValueDisplay = createElement('span', {
            className: 'width-value-badge px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full',
            text: `${currentWidth}%`,
            id: `width-value-${selectedField.id}`
        });
        widthLabelRow.appendChild(widthValueDisplay);
        widthGroup.appendChild(widthLabelRow);

        // Slider container with breakpoint markers
        const sliderContainer = createElement('div', { className: 'relative mt-1' });

        // Breakpoint markers
        const breakpoints = [25, 33, 50, 66, 75, 100];
        const markersContainer = createElement('div', { className: 'width-slider-markers flex justify-between absolute w-full pointer-events-none', style: { top: '-4px', left: '0', right: '0' } });

        // Calculate marker positions (10-100 range maps to 0-100% of slider)
        breakpoints.forEach(bp => {
            const position = ((bp - 10) / 90) * 100; // Map 10-100 to 0-100%
            const marker = createElement('div', {
                className: `width-slider-marker absolute w-1 h-1 rounded-full ${currentWidth === bp ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`,
                style: { left: `${position}%`, transform: 'translateX(-50%)' },
                title: `${bp}%`
            });
            markersContainer.appendChild(marker);
        });
        sliderContainer.appendChild(markersContainer);

        // Range slider input
        const widthSlider = createElement('input', {
            type: 'range',
            min: '10',
            max: '100',
            value: String(currentWidth),
            className: 'width-slider w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer',
            'aria-label': 'Field width percentage',
            'data-focus-id': `field-width-${selectedField.id}`,
            oninput: (e: Event) => {
                const value = parseInt((e.target as HTMLInputElement).value);

                // Update the display immediately
                const display = document.getElementById(`width-value-${selectedField.id}`);
                if (display) {
                    display.textContent = `${value}%`;
                }
            },
            onchange: (e: Event) => {
                let value = parseInt((e.target as HTMLInputElement).value);

                // Snap to nearest breakpoint if within 3% range (optional snapping)
                const snapThreshold = 3;
                for (const bp of breakpoints) {
                    if (Math.abs(value - bp) <= snapThreshold) {
                        value = bp;
                        (e.target as HTMLInputElement).value = String(value);
                        break;
                    }
                }

                // Update the display
                const display = document.getElementById(`width-value-${selectedField.id}`);
                if (display) {
                    display.textContent = `${value}%`;
                }

                // Update the field with numeric width
                formStore.getState().updateField(selectedField.id, { width: value as FieldWidth });
            },
            onkeydown: (e: KeyboardEvent) => {
                const slider = e.target as HTMLInputElement;
                const currentVal = parseInt(slider.value);
                const step = e.shiftKey ? 5 : 1; // Shift+Arrow for larger steps

                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const newVal = Math.min(100, currentVal + step);
                    slider.value = String(newVal);
                    slider.dispatchEvent(new Event('input'));
                    slider.dispatchEvent(new Event('change'));
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const newVal = Math.max(10, currentVal - step);
                    slider.value = String(newVal);
                    slider.dispatchEvent(new Event('input'));
                    slider.dispatchEvent(new Event('change'));
                }
            }
        });
        sliderContainer.appendChild(widthSlider);

        // Breakpoint labels below slider
        const labelsContainer = createElement('div', { className: 'flex justify-between mt-1 text-xs text-gray-400 dark:text-gray-500' });
        labelsContainer.appendChild(createElement('span', { text: '10%' }));
        labelsContainer.appendChild(createElement('span', { text: '100%' }));
        sliderContainer.appendChild(labelsContainer);

        widthGroup.appendChild(sliderContainer);

        // Quick preset buttons
        const presetsContainer = createElement('div', { className: 'flex flex-wrap gap-1 mt-3' });
        breakpoints.forEach(bp => {
            const isActive = currentWidth === bp;
            const presetBtn = createElement('button', {
                type: 'button',
                className: `width-preset-btn px-2 py-1 text-xs rounded transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`,
                text: `${bp}%`,
                onclick: () => {
                    formStore.getState().updateField(selectedField.id, { width: bp as FieldWidth });
                }
            });
            presetsContainer.appendChild(presetBtn);
        });
        widthGroup.appendChild(presetsContainer);

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
                                    masterTypeName: selectedEnumName,
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
                                masterTypeName: undefined,
                                options: undefined // Clear options when groupName is cleared
                            });
                        }
                    }
                });

                // Determine which master type is currently selected
                // Priority: masterTypeName > groupName
                let currentMasterType: MasterType | undefined;
                if (selectedField.masterTypeName) {
                    currentMasterType = activeMasterTypes.find(mt => mt.enumName === selectedField.masterTypeName);
                } else if (selectedField.groupName) {
                    currentMasterType = activeMasterTypes.find(mt =>
                        mt.id === selectedField.groupName?.id || mt.name === selectedField.groupName?.name
                    );
                }

                // Add empty option for clearing selection
                groupNameSelect.appendChild(createElement('option', {
                    value: '',
                    text: 'None',
                    selected: !currentMasterType
                }));

                // Add options from active masterTypes - use enumName as value, displayName as text
                activeMasterTypes.forEach(mt => {
                    // Check if this master type is selected by comparing enumName or groupName
                    const isSelected = currentMasterType && (
                        (selectedField.masterTypeName && mt.enumName === selectedField.masterTypeName) ||
                        (selectedField.groupName && (mt.id === selectedField.groupName?.id || mt.name === selectedField.groupName?.name))
                    );
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

                // If field has masterTypeName or groupName but no options, hydrate options
                if (currentMasterType && (!selectedField.options || selectedField.options.length === 0)) {
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

                    // If groupName is missing but masterTypeName exists, set groupName
                    if (selectedField.masterTypeName && !selectedField.groupName) {
                        formStore.getState().updateField(selectedField.id, {
                            groupName: {
                                id: currentMasterType.id,
                                name: currentMasterType.name
                            }
                        });
                    }
                }
            }
        }

        // --- Custom Options Management (Dropdown, Checkbox, Radio) ---
        if (['select', 'checkbox', 'radio'].includes(selectedField.type)) {
            const optionsHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Options' });
            body.appendChild(optionsHeader);

            // Enable Custom Options checkbox (for dropdown)
            if (selectedField.type === 'select') {
                const customOptionsGroup = createElement('div', { className: 'flex items-center justify-between mb-4' });
                customOptionsGroup.appendChild(createElement('label', { className: 'text-sm text-gray-700 dark:text-gray-300', text: 'Enable Custom Options' }));
                customOptionsGroup.appendChild(createElement('input', {
                    type: 'checkbox',
                    className: 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                    checked: !!selectedField.customOptionsEnabled,
                    onchange: (e: Event) => {
                        const enabled = (e.target as HTMLInputElement).checked;
                        formStore.getState().updateField(selectedField.id, { customOptionsEnabled: enabled });
                        // Force re-render to show/hide options editor
                        this.render();
                    }
                }));
                body.appendChild(customOptionsGroup);

                // Multiselect toggle (for dropdown)
                const multiselectGroup = createElement('div', { className: 'flex items-center justify-between mb-4' });
                multiselectGroup.appendChild(createElement('label', { className: 'text-sm text-gray-700 dark:text-gray-300', text: 'Multiselect' }));
                multiselectGroup.appendChild(createElement('input', {
                    type: 'checkbox',
                    className: 'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                    checked: !!selectedField.multiselect,
                    onchange: (e: Event) => {
                        formStore.getState().updateField(selectedField.id, { multiselect: (e.target as HTMLInputElement).checked });
                    }
                }));
                body.appendChild(multiselectGroup);
            }

            // Show options editor if custom options enabled or if checkbox/radio (always show for these)
            const shouldShowOptions = selectedField.type === 'select' ? selectedField.customOptionsEnabled : true;

            if (shouldShowOptions) {
                const options = selectedField.options || [];

                const optionsList = createElement('div', { className: 'space-y-2 mb-3' });

                options.forEach((opt: { label: string; value: string }, index: number) => {
                    const optionRow = createElement('div', { className: 'flex gap-2 items-center' });

                    const labelInput = createElement('input', {
                        type: 'text',
                        className: 'flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm',
                        value: opt.label,
                        placeholder: 'Option label',
                        'data-focus-id': `field-option-label-${selectedField.id}-${index}`,
                        oninput: (e: Event) => {
                            const newOptions = [...options];
                            newOptions[index] = { ...newOptions[index], label: (e.target as HTMLInputElement).value };
                            formStore.getState().updateField(selectedField.id, { options: newOptions });
                        }
                    });

                    const valueInput = createElement('input', {
                        type: 'text',
                        className: 'flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm',
                        value: opt.value,
                        placeholder: 'Option value',
                        'data-focus-id': `field-option-value-${selectedField.id}-${index}`,
                        oninput: (e: Event) => {
                            const newOptions = [...options];
                            newOptions[index] = { ...newOptions[index], value: (e.target as HTMLInputElement).value };
                            formStore.getState().updateField(selectedField.id, { options: newOptions });
                        }
                    });

                    const deleteBtn = createElement('button', {
                        className: 'p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors',
                        title: 'Delete option',
                        onclick: () => {
                            const newOptions = options.filter((_: { label: string; value: string }, i: number) => i !== index);
                            formStore.getState().updateField(selectedField.id, { options: newOptions });
                        }
                    }, [getIcon('Trash2', 14)]);

                    optionRow.appendChild(labelInput);
                    optionRow.appendChild(valueInput);
                    optionRow.appendChild(deleteBtn);
                    optionsList.appendChild(optionRow);
                });

                body.appendChild(optionsList);

                // Add Option button
                const addOptionBtn = createElement('button', {
                    type: 'button',
                    className: 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                    text: 'Add Option',
                    onclick: () => {
                        const newOptions = [...(selectedField.options || []), { label: `Option ${(selectedField.options || []).length + 1}`, value: `opt${(selectedField.options || []).length + 1}` }];
                        formStore.getState().updateField(selectedField.id, { options: newOptions });
                        // Force re-render to show new option
                        this.render();
                    }
                });
                body.appendChild(addOptionBtn);
            }
        }

        // --- Advanced Validation ---
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

        // Collect validation rule elements
        const validationElements: HTMLElement[] = [];

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
            validationElements.push(minLenGroup);

            const maxLenGroup = createElement('div', { className: 'mb-3' });
            maxLenGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Max Length' }));
            maxLenGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('maxLength'),
                placeholder: 'e.g. 100',
                onchange: (e: Event) => updateValidation({ type: 'maxLength', value: parseInt((e.target as HTMLInputElement).value) })
            }));
            validationElements.push(maxLenGroup);

            // Regex (with preset support for text fields, special handling for email fields)
            const regexGroup = createElement('div', { className: 'mb-3' });
            regexGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Regex Pattern' }));

            // Helper function to update examples based on preset or custom regex
            const updateExamples = (examplesList: HTMLElement, regex: string, preset?: RegexPreset) => {
                examplesList.innerHTML = '';

                let testCases: { value: string; label: string }[] = [];

                if (preset) {
                    // Use preset examples
                    testCases = [
                        ...preset.validExamples.map(v => ({ value: v, label: 'Valid' })),
                        ...preset.invalidExamples.map(v => ({ value: v, label: 'Invalid' }))
                    ];
                } else if (selectedField.type === 'email') {
                    // Default email examples
                    testCases = [
                        { value: 'user@example.com', label: 'Valid' },
                        { value: 'test.email@domain.co.uk', label: 'Valid' },
                        { value: 'invalid.email', label: 'Invalid' },
                        { value: '@domain.com', label: 'Invalid' },
                        { value: 'user@', label: 'Invalid' }
                    ];
                }

                if (testCases.length === 0) return;

                let hasError = false;
                testCases.forEach(({ value, label }) => {
                    if (hasError) return;
                    try {
                        const regexObj = new RegExp(regex);
                        const isValid = regexObj.test(value);
                        const exampleItem = createElement('div', {
                            className: `text-xs flex items-center gap-2 ${isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`
                        });
                        exampleItem.appendChild(createElement('span', { text: isValid ? '✓' : '✗', className: 'font-bold' }));
                        exampleItem.appendChild(createElement('span', { text: `${value} (${label})` }));
                        examplesList.appendChild(exampleItem);
                    } catch (err) {
                        if (!hasError) {
                            hasError = true;
                            const exampleItem = createElement('div', {
                                className: 'text-xs text-yellow-600 dark:text-yellow-400'
                            });
                            exampleItem.appendChild(createElement('span', { text: '⚠ Invalid regex pattern' }));
                            examplesList.appendChild(exampleItem);
                        }
                    }
                });
            };

            // Live examples container (for text fields with presets or email fields)
            let examplesList: HTMLElement | null = null;
            const shouldShowExamples = selectedField.type === 'text' || selectedField.type === 'email';
            if (shouldShowExamples) {
                const examplesContainer = createElement('div', { className: 'mt-2 space-y-1' });
                const examplesLabel = createElement('label', { className: 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1', text: 'Live Examples' });
                examplesContainer.appendChild(examplesLabel);
                examplesList = createElement('div', { className: 'space-y-1' });
                examplesContainer.appendChild(examplesList);
                regexGroup.appendChild(examplesContainer);
            }

            const currentRegex = validations.find((v: any) => v.type === 'pattern')?.regex || '';

            // Find current preset based on regex pattern
            const findPresetByRegex = (regex: string): RegexPreset | undefined => {
                return REGEX_PRESETS.find(preset => preset.pattern === regex);
            };

            let currentPreset: RegexPreset | undefined = currentRegex ? findPresetByRegex(currentRegex) : undefined;
            let selectedPresetId: string = currentPreset?.id || '';

            // Declare regexInput variable first so it can be referenced in presetSelect handler
            let regexInput: HTMLElement;

            // Regex Presets dropdown (only for text fields)
            if (selectedField.type === 'text') {
                const presetGroup = createElement('div', { className: 'mb-2' });
                presetGroup.appendChild(createElement('label', { className: 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1', text: 'Regex Presets (Optional)' }));

                const presetSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm',
                    value: selectedPresetId,
                    onchange: (e: Event) => {
                        const presetId = (e.target as HTMLSelectElement).value;
                        selectedPresetId = presetId;
                        const preset = REGEX_PRESETS.find(p => p.id === presetId);

                        if (preset) {
                            const newValidations = validations.filter((v: any) => v.type !== 'pattern');
                            newValidations.push({
                                type: 'pattern',
                                regex: preset.pattern,
                                message: preset.errorMessage
                            });
                            formStore.getState().updateField(selectedField.id, { validation: newValidations });

                            // Update regex input
                            (regexInput as HTMLInputElement).value = preset.pattern;

                            // Update examples
                            currentPreset = preset;
                            if (examplesList) {
                                updateExamples(examplesList, preset.pattern, preset);
                            }
                        } else {
                            // Clear preset selection
                            currentPreset = undefined;
                            if (examplesList && currentRegex) {
                                updateExamples(examplesList, currentRegex);
                            }
                        }
                    }
                });

                // Add "None" option
                const noneOption = createElement('option', { value: '', text: 'None (Custom Regex)' });
                presetSelect.appendChild(noneOption);

                // Add preset options
                REGEX_PRESETS.forEach(preset => {
                    const option = createElement('option', {
                        value: preset.id,
                        text: preset.label,
                        title: preset.description,
                        selected: selectedPresetId === preset.id
                    });
                    presetSelect.appendChild(option);
                });

                presetGroup.appendChild(presetSelect);
                regexGroup.appendChild(presetGroup);
            }

            regexInput = createElement('input', {
                type: 'text',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: currentRegex,
                placeholder: selectedField.type === 'email' ? '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' : 'e.g. ^[A-Z]+$',
                'data-focus-id': `field-regex-${selectedField.id}`,
                oninput: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    const existing = validations.find((v: any) => v.type === 'pattern');
                    const newValidations = validations.filter((v: any) => v.type !== 'pattern');

                    // Check if the new regex matches a preset (only for text fields)
                    if (selectedField.type === 'text') {
                        const matchingPreset = val ? findPresetByRegex(val) : undefined;
                        if (matchingPreset) {
                            currentPreset = matchingPreset;
                            selectedPresetId = matchingPreset.id;
                            // Update preset dropdown if it exists
                            const presetSelectEl = regexGroup.querySelector('select');
                            if (presetSelectEl) {
                                (presetSelectEl as HTMLSelectElement).value = matchingPreset.id;
                            }
                        } else {
                            currentPreset = undefined;
                            selectedPresetId = '';
                            // Clear preset dropdown if it exists
                            const presetSelectEl = regexGroup.querySelector('select');
                            if (presetSelectEl) {
                                (presetSelectEl as HTMLSelectElement).value = '';
                            }
                        }
                    }

                    if (val) {
                        newValidations.push({
                            type: 'pattern',
                            regex: val,
                            message: existing?.message || currentPreset?.errorMessage || 'Invalid format'
                        });
                    }
                    formStore.getState().updateField(selectedField.id, { validation: newValidations });

                    // Update live examples
                    if (examplesList) {
                        if (currentPreset) {
                            updateExamples(examplesList, val, currentPreset);
                        } else if (selectedField.type === 'email') {
                            updateExamples(examplesList, val || '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
                        } else if (val) {
                            updateExamples(examplesList, val);
                        }
                    }
                }
            });
            regexGroup.insertBefore(regexInput, regexGroup.firstChild?.nextSibling || null);

            // Initial render of examples
            if (examplesList && currentRegex) {
                if (currentPreset) {
                    updateExamples(examplesList, currentRegex, currentPreset);
                } else if (selectedField.type === 'email') {
                    updateExamples(examplesList, currentRegex || '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
                } else {
                    updateExamples(examplesList, currentRegex);
                }
            }

            validationElements.push(regexGroup);
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
            validationElements.push(minValGroup);

            const maxValGroup = createElement('div', { className: 'mb-3' });
            maxValGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Max Value' }));
            maxValGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('max'),
                onchange: (e: Event) => updateValidation({ type: 'max', value: parseInt((e.target as HTMLInputElement).value) })
            }));
            validationElements.push(maxValGroup);
        }

        // Min/Max Date (Date)
        if (selectedField.type === 'date') {
            const getDateRuleValue = (type: string) => {
                const rule = validations.find((v: any) => v.type === type);
                return rule?.value ? (typeof rule.value === 'string' ? rule.value : String(rule.value)) : '';
            };

            const minDateGroup = createElement('div', { className: 'mb-3' });
            minDateGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Minimum Date' }));
            minDateGroup.appendChild(createElement('input', {
                type: 'date',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getDateRuleValue('minDate'),
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    const newValidations = validations.filter((v: any) => v.type !== 'minDate');
                    if (val) {
                        newValidations.push({ type: 'minDate', value: val, message: 'Date must be after the minimum date' });
                    }
                    formStore.getState().updateField(selectedField.id, { validation: newValidations });
                }
            }));
            validationElements.push(minDateGroup);

            const maxDateGroup = createElement('div', { className: 'mb-3' });
            maxDateGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Maximum Date' }));
            maxDateGroup.appendChild(createElement('input', {
                type: 'date',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getDateRuleValue('maxDate'),
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    const newValidations = validations.filter((v: any) => v.type !== 'maxDate');
                    if (val) {
                        newValidations.push({ type: 'maxDate', value: val, message: 'Date must be before the maximum date' });
                    }
                    formStore.getState().updateField(selectedField.id, { validation: newValidations });
                }
            }));
            validationElements.push(maxDateGroup);
        }

        // Only show Validation Rules header and elements if there are validation rules
        if (validationElements.length > 0) {
            const validationHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Validation Rules' });
            body.appendChild(validationHeader);
            validationElements.forEach(el => body.appendChild(el));
        }

        // --- Async Options (Select/Radio) ---
        // COMMENTED OUT: Options Source and Source Type functionality
        /*
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
        */

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
