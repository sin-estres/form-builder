import { formStore } from '../core/useFormStore';
import { createElement, getIcon } from '../utils/dom';
import { FIELD_TYPES, REGEX_PRESETS, RegexPreset } from '../core/constants';
import { FormRenderer } from '../renderer/FormRenderer';
import { FormSchema, FormSection, parseWidth, FieldWidth, ValidationObject } from '../core/schemaTypes';
import { cloneForm, cloneSection } from '../utils/clone';
import Sortable from 'sortablejs';
import { SectionList } from './SectionList';
import { MasterType } from '../core/useFormStore';

// Module-level state to track which fields have their Advanced CSS panel expanded
const advancedCssPanelState: Map<string, boolean> = new Map();


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
    moduleList?: string[]; // List of module names for Lookup source type
    lookupFieldOptionsMap?: {
        [lookupSource: string]: string[]; // Map lookup source to list of field names
    };
    // Angular integration outputs
    onGroupSelectionChange?: (event: { fieldId: string; groupEnumName: string }) => void;
    onDropdownValueChange?: (event: { fieldId: string; value: string }) => void;
    onLookupSourceChange?: (event: { fieldId: string; lookupSourceType: 'MODULE' | 'MASTER_TYPE'; lookupSource: string }) => void;
}

export class FormBuilder {
    private container: HTMLElement;
    private unsubscribe!: () => void;
    private options: FormBuilderOptions;

    private lastRenderedSchemaHash: string = ''; // Cache to detect meaningful changes

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
                // Deduplicate sections by title and merge their fields
                const sectionMap = new Map<string, FormSection>();
                extractedSections.forEach(section => {
                    const existingSection = sectionMap.get(section.title);
                    if (existingSection) {
                        // Merge fields, avoiding duplicates by field ID
                        const fieldIds = new Set(existingSection.fields.map(f => f.id));
                        section.fields.forEach(field => {
                            if (!fieldIds.has(field.id)) {
                                existingSection.fields.push(field);
                                fieldIds.add(field.id);
                            }
                        });
                    } else {
                        // Clone section to avoid mutating original
                        sectionMap.set(section.title, {
                            ...section,
                            fields: [...section.fields]
                        });
                    }
                });
                const deduplicatedSections = Array.from(sectionMap.values());
                console.log(`[FormBuilder] Loaded ${options.formTemplates.length} form templates, extracted ${extractedSections.length} sections, deduplicated to ${deduplicatedSections.length} unique templates`);

                // Merge with existing templates if reusableSections was also provided
                const existingTemplates = options.reusableSections || [];
                formStore.getState().setTemplates([...existingTemplates, ...deduplicatedSections]);
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

        // Store lookupFieldOptionsMap if provided
        if (options.lookupFieldOptionsMap) {
            formStore.getState().setLookupFieldOptionsMap(options.lookupFieldOptionsMap);
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

    public updateLookupFieldOptionsMap(lookupFieldOptionsMap: { [lookupSource: string]: string[] }) {
        formStore.getState().setLookupFieldOptionsMap(lookupFieldOptionsMap);
        // Re-render to update lookup field dropdowns
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
            // Deduplicate sections by title and merge their fields
            const sectionMap = new Map<string, FormSection>();
            extractedSections.forEach(section => {
                const existingSection = sectionMap.get(section.title);
                if (existingSection) {
                    // Merge fields, avoiding duplicates by field ID
                    const fieldIds = new Set(existingSection.fields.map(f => f.id));
                    section.fields.forEach(field => {
                        if (!fieldIds.has(field.id)) {
                            existingSection.fields.push(field);
                            fieldIds.add(field.id);
                        }
                    });
                } else {
                    // Clone section to avoid mutating original
                    sectionMap.set(section.title, {
                        ...section,
                        fields: [...section.fields]
                    });
                }
            });
            const deduplicatedSections = Array.from(sectionMap.values());
            console.log(`[FormBuilder] loadFormTemplates: extracted ${extractedSections.length} sections, deduplicated to ${deduplicatedSections.length} unique templates`);

            const currentTemplates = formStore.getState().templates;
            formStore.getState().setTemplates([...currentTemplates, ...deduplicatedSections]);
            // Re-render to update the templates tab
            this.render();
        }
    }


    private setupSubscriptions() {
        let lastPreviewMode: boolean | null = null;
        
        this.unsubscribe = formStore.subscribe(() => {
            // Note: Removed isInputUpdate optimization - the focus preservation logic
            // below already handles keeping focus on inputs during re-render, and
            // skipping the render prevented live canvas updates

            const state = formStore.getState();
            
            // Check if preview mode changed - always re-render on preview mode toggle
            const previewModeChanged = lastPreviewMode !== null && lastPreviewMode !== state.isPreviewMode;
            lastPreviewMode = state.isPreviewMode;

            // Generate hash of schema for change detection
            const schemaHash = JSON.stringify({
                sections: state.schema.sections.map(s => ({
                    id: s.id,
                    title: s.title,
                    fields: s.fields.map(f => ({
                        id: f.id,
                        type: f.type,
                        label: f.label,
                        // Exclude frequently changing text properties from hash
                        // to prevent re-renders on typing
                    }))
                })),
                selectedField: state.selectedFieldId,
                isPreviewMode: state.isPreviewMode // Include preview mode in hash
            });

            // Re-render if schema changed OR preview mode changed
            if (schemaHash !== this.lastRenderedSchemaHash || previewModeChanged) {
                this.lastRenderedSchemaHash = schemaHash;
                this.render();
            }
        });
    }

    public destroy() {
        this.unsubscribe();
        this.container.innerHTML = '';
    }

    private render() {
        const state = formStore.getState();

        // Preserve focus state and input values before clearing DOM
        const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
        let focusState: { id: string; selectionStart: number | null; selectionEnd: number | null; value?: string } | null = null;

        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            const focusId = activeElement.getAttribute('data-focus-id');
            if (focusId) {
                focusState = {
                    id: focusId,
                    selectionStart: activeElement.selectionStart,
                    selectionEnd: activeElement.selectionEnd,
                    value: activeElement.value // Preserve the current value
                };
            }
        }

        // Preserve scroll position before clearing DOM
        // Find scroll container in edit mode (canvasWrapper) or preview mode (previewContainer)
        // canvasWrapper has unique class 'form-builder-canvas'
        // previewContainer has 'overflow-y-auto' and 'bg-white' (toolbox/config don't have bg-white on scroll container)
        const canvasWrapper = this.container.querySelector('.form-builder-canvas') as HTMLElement | null;
        const previewContainer = this.container.querySelector('.flex-1.overflow-y-auto.bg-white') as HTMLElement | null;
        const configPanel = this.container.querySelector('#config-panel-body') as HTMLElement | null;
        const scrollContainer = canvasWrapper || previewContainer;
        const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        const savedConfigScrollTop = configPanel ? configPanel.scrollTop : 0;

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

                const previewContainer = createElement('div', { className: 'flex-1  p-4 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center' });
                const inner = createElement('div', { className: 'w-full' });
                new FormRenderer(inner, previewSchema, (data) => alert(JSON.stringify(data, null, 2)), this.options.onDropdownValueChange);
                previewContainer.appendChild(inner);
                main.appendChild(previewContainer);
            } else {
                const previewContainer = createElement('div', { className: 'flex-1 p-4 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center' });
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
            const configWrapper = createElement('div', { className: 'form-builder-config-wrapper w-full md:w-80 bg-white dark:bg-gray-900 border-l md:border-l border-t md:border-t-0 border-gray-200 dark:border-gray-800 overflow-hidden' });
            configWrapper.appendChild(this.renderConfigPanel(state, focusState));
            main.appendChild(configWrapper);
        }

        wrapper.appendChild(main);
        this.container.appendChild(wrapper);


        // Restore scroll position after DOM is rebuilt
        // Always run this, even if scroll is 0, to ensure we don't lose position
        // Use double requestAnimationFrame for more reliable timing after layout
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Restore canvas/preview scroll position
                const newCanvasWrapper = this.container.querySelector('.form-builder-canvas') as HTMLElement | null;
                const newPreviewContainer = this.container.querySelector('.flex-1.overflow-y-auto.bg-white') as HTMLElement | null;
                const newScrollContainer = newCanvasWrapper || newPreviewContainer;
                if (newScrollContainer && savedScrollTop > 0) {
                    newScrollContainer.scrollTop = savedScrollTop;
                }

                // Restore config panel scroll position
                const newConfigPanel = this.container.querySelector('#config-panel-body') as HTMLElement | null;
                if (newConfigPanel && savedConfigScrollTop > 0) {
                    newConfigPanel.scrollTop = savedConfigScrollTop;
                }
            });
        });

        // Restore focus state after DOM is rebuilt
        if (focusState) {
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
                const elementToFocus = document.querySelector(`[data-focus-id="${focusState!.id}"]`) as HTMLInputElement | HTMLTextAreaElement;
                if (elementToFocus && focusState) {
                    // Restore value if it exists (for textareas/inputs that might have unsaved changes)
                    if (focusState.value !== undefined) {
                        elementToFocus.value = focusState.value;
                    }
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
        const left = createElement('div', { className: 'flex items-center ' });
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
            className: `flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${state.isPreviewMode ? "bg-[#019FA2] text-white hover:bg-[#018a8d]" : "bg-[#3b497e] text-white hover:bg-[#2d3a62]"}`,
            onclick: (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                formStore.getState().togglePreview();
            },
            title: state.isPreviewMode ? 'Exit Preview' : 'Preview Form'
        }, [getIcon(state.isPreviewMode ? 'X' : 'Eye', 16)]);

        const saveBtn = createElement('button', {
            className: 'flex items-center px-3 py-2 text-sm font-medium text-white bg-[#019FA2]  rounded-md shadow-sm transition-colors',
            onclick: () => {
                const schema = formStore.getState().schema;

                // Log what we are sending to the app using this npm package
                console.log('[Form Builder] Schema being sent to app:', JSON.stringify(schema, null, 2));

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
        const toolbox = createElement('div', { className: 'bg-[#847dff1a] dark:bg-gray-900 flex flex-col h-full' });

        // Tabs
        const tabs = createElement('div', { className: 'flex border-b border-gray-200 dark:border-gray-800 p-1' });
        const createTab = (id: 'fields' | 'templates' | 'import', label: string) => {
            const isActive = this.activeTab === id;
            return createElement('button', {
                className: `flex-1 py-3 text-sm font-medium transition-colors ${isActive ? 'text-white bg-[#635bff] rounded ' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`,
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
        const content = createElement('div', { className: 'flex-1 overflow-y-auto p-4 bg-white' });

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
            className: 'flex-1 dark:bg-gray-950 p-4 md:p-8 overflow-y-auto',
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
            oninput: (e: Event) => {
                formStore.getState().setSchema({ ...state.schema, formName: (e.target as HTMLInputElement).value });
            }
        });
        inner.appendChild(formNameInput);

        // SectionList
        const sectionList = new SectionList(state.schema, state.selectedFieldId);
        inner.appendChild(sectionList.getElement());

        // Add Section Button
        const addSectionBtn = createElement('button', {
            className: 'w-full mt-6 py-3  dark:border-gray-700 rounded-lg text-gray-500 bg-[#635bff] max-w-[180px] shadow-[0_17px_20px_-8px_rgba(77,91,236,0.231372549)] text-white transition-colors flex items-center justify-center font-medium',
            onclick: () => formStore.getState().addSection()
        }, [getIcon('Plus', 20), createElement('span', { className: 'ml-2', text: 'Add Section' })]);

        inner.appendChild(addSectionBtn);
        canvas.appendChild(inner);
        return canvas;
    }

    // Helper method to create a modern checkbox field with better UX
    private createCheckboxField(label: string, checked: boolean, onChange: (checked: boolean) => void, id?: string): HTMLElement {
        const uniqueId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
        
        // Modern checkbox container with better spacing
        const container = createElement('div', { className: 'flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer' });
        
        // Checkbox input with larger size and better styling
        const checkbox = createElement('input', {
            type: 'checkbox',
            id: uniqueId,
            className: 'checkbox-custom flex-shrink-0',
            checked,
            onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked)
        }) as HTMLInputElement;
        
        // Label with better typography and clickable
        const labelElement = createElement('label', {
            htmlFor: uniqueId,
            className: 'text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none flex-1',
            text: label
        }) as HTMLLabelElement;
        
        container.appendChild(checkbox);
        container.appendChild(labelElement);
        
        // Make the entire container clickable
        container.addEventListener('click', (e: Event) => {
            if (e.target !== checkbox && e.target !== labelElement) {
                checkbox.checked = !checkbox.checked;
                onChange(checkbox.checked);
            }
        });
        
        return container;
    }

    private renderConfigPanel(state: any, focusState: { id: string; selectionStart: number | null; selectionEnd: number | null; value?: string } | null = null): HTMLElement {
        const panel = createElement('div', { className: ' dark:bg-gray-900 flex flex-col h-full overflow-y-auto' });

        // Get the latest field from state to ensure we have the most up-to-date data
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

        const body = createElement('div', { className: 'flex-1 overflow-y-auto p-4 space-y-6', id: 'config-panel-body' });

        // Label
        const labelGroup = createElement('div');
        labelGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Label' }));
        labelGroup.appendChild(createElement('input', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
            value: selectedField.label,
            'data-focus-id': `field-label-${selectedField.id}`,
            oninput: (e: Event) => {
                formStore.getState().updateField(selectedField.id, { label: (e.target as HTMLInputElement).value });
            }
        }));
        body.appendChild(labelGroup);

        // Placeholder
        const placeholderGroup = createElement('div');
        placeholderGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Placeholder' }));
        placeholderGroup.appendChild(createElement('input', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
            value: selectedField.placeholder || '',
            'data-focus-id': `field-placeholder-${selectedField.id}`,
            oninput: (e: Event) => {
                formStore.getState().updateField(selectedField.id, { placeholder: (e.target as HTMLInputElement).value });
            }
        }));
        body.appendChild(placeholderGroup);

        // Grid Span Selector (replaces width slider)
        const layoutGroup = createElement('div', { className: 'layout-span-group' });

        // Label with current value display
        const layoutLabelRow = createElement('div', { className: 'flex items-center justify-between mb-2' });
        layoutLabelRow.appendChild(createElement('label', { className: 'text-sm font-medium text-gray-700 dark:text-gray-300', text: 'Grid Span' }));

        // Get current span from layout, fallback to width conversion
        const currentSpan = selectedField.layout?.span !== undefined
            ? selectedField.layout.span
            : Math.max(1, Math.min(12, Math.round((parseWidth(selectedField.width || '100%') / 100) * 12)));

        // Value display badge
        const spanValueDisplay = createElement('span', {
            className: 'span-value-badge px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full',
            text: `${currentSpan}/12`,
            id: `span-value-${selectedField.id}`
            // const widthValueDisplay = createElement('span', {
            //     className: 'width-value-badge px-2 py-0.5 text-xs font-semibold bg-[#019FA2] text-white dark:bg-blue-900 dark:text-blue-200 rounded-full',
            //     text: `${currentWidth}%`,
            //     id: `width-value-${selectedField.id}`
        });
        layoutLabelRow.appendChild(spanValueDisplay);
        layoutGroup.appendChild(layoutLabelRow);

        // Grid span selector buttons (1-12 columns)
        const spanButtonsContainer = createElement('div', { className: 'grid grid-cols-6 gap-2 mt-2' });
        for (let span = 1; span <= 12; span++) {
            const isActive = currentSpan === span;
            const spanBtn = createElement('button', {
                type: 'button',
                className: `span-preset-btn px-2 py-1.5 text-xs rounded transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`,
                text: `${span}`,
                title: `${span} column${span > 1 ? 's' : ''} (${Math.round((span / 12) * 100)}%)`,
                onclick: () => {
                    const layout = selectedField.layout || { row: 0, column: 0 };
                    formStore.getState().updateField(selectedField.id, {
                        layout: { ...layout, span: span },
                        // Also update width for backward compatibility
                        width: Math.round((span / 12) * 100) as FieldWidth
                    });
                }
            });
            spanButtonsContainer.appendChild(spanBtn);
        }
        layoutGroup.appendChild(spanButtonsContainer);

        body.appendChild(layoutGroup);

        // Required
        body.appendChild(this.createCheckboxField(
            'Required',
            !!selectedField.required,
            (checked) => formStore.getState().updateField(selectedField.id, { required: checked }),
            `required-${selectedField.id}`
        ));

        // Enabled
        body.appendChild(this.createCheckboxField(
            'Enabled',
            selectedField.enabled !== false,
            (checked) => formStore.getState().updateField(selectedField.id, { enabled: checked }),
            `enabled-${selectedField.id}`
        ));

        // Visible
        body.appendChild(this.createCheckboxField(
            'Visible',
            selectedField.visible !== false,
            (checked) => formStore.getState().updateField(selectedField.id, { visible: checked }),
            `visible-${selectedField.id}`
        ));

        // --- Phone ISD Configuration (Phone fields only) ---
        if (selectedField.type === 'phone') {
            const isdHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Phone ISD Settings' });
            body.appendChild(isdHeader);

            // Get current ISD config with defaults
            const isdConfig = selectedField.isd || {
                enabled: true,
                defaultCode: '+91',
                showFlag: true,
                showCountryName: false,
                allowCustomCode: false
            };

            // Show Flag toggle
            body.appendChild(this.createCheckboxField(
                'Show Flag',
                isdConfig.showFlag !== false,
                (checked) => formStore.getState().updateField(selectedField.id, {
                    isd: { ...isdConfig, showFlag: checked }
                }),
                `show-flag-${selectedField.id}`
            ));

            // Allow Country Change toggle
            body.appendChild(this.createCheckboxField(
                'Allow Country Change',
                isdConfig.enabled !== false,
                (checked) => formStore.getState().updateField(selectedField.id, {
                    isd: { ...isdConfig, enabled: checked }
                }),
                `allow-country-change-${selectedField.id}`
            ));

            // Show Country Name toggle
            body.appendChild(this.createCheckboxField(
                'Show Country Name',
                isdConfig.showCountryName === true,
                (checked) => formStore.getState().updateField(selectedField.id, {
                    isd: { ...isdConfig, showCountryName: checked }
                }),
                `show-country-name-${selectedField.id}`
            ));
        }

        // --- Master List (Select/Dropdown only - shown when optionSource is MASTER) ---
        if (selectedField.type === 'select' && selectedField.optionSource === 'MASTER') {
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
                groupNameGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Master List' }));
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

        // --- Option Source (Select, Radio, Checkbox) ---
        if (['select', 'checkbox', 'radio'].includes(selectedField.type)) {
            const optionSourceHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Option Source' });
            body.appendChild(optionSourceHeader);

            const optionSourceGroup = createElement('div', { className: 'mb-4' });
            optionSourceGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Source Type' }));
            const optionSourceSelect = createElement('select', {
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: selectedField.optionSource || 'STATIC',
                onchange: (e: Event) => {
                    const source = (e.target as HTMLSelectElement).value as 'STATIC' | 'MASTER' | 'LOOKUP';
                    const updates: any = { optionSource: source };

                    // If switching to MASTER and no masterTypeName/groupName exists, keep existing or clear options
                    if (source === 'MASTER' && !selectedField.masterTypeName && !selectedField.groupName) {
                        // Don't clear options yet - user needs to select a master type
                    } else if (source === 'STATIC') {
                        // When switching to STATIC, ensure customOptionsEnabled is true
                        updates.customOptionsEnabled = true;
                    } else if (source === 'LOOKUP') {
                        // Clear lookup-related fields when switching to LOOKUP if not already set
                        if (!selectedField.lookupSourceType) {
                            updates.lookupSourceType = 'MODULE';
                        }
                    }

                    formStore.getState().updateField(selectedField.id, updates);
                    // Force re-render to update UI
                    this.render();
                }
            });
            optionSourceSelect.appendChild(createElement('option', { value: 'STATIC', text: 'STATIC (Custom Options)', selected: (selectedField.optionSource || 'STATIC') === 'STATIC' }));
            optionSourceSelect.appendChild(createElement('option', { value: 'MASTER', text: 'MASTER (From Master Types)', selected: selectedField.optionSource === 'MASTER' }));
            // LOOKUP option only available for select fields
            if (selectedField.type === 'select') {
                optionSourceSelect.appendChild(createElement('option', { value: 'LOOKUP', text: 'Lookup (Entity Fields)', selected: selectedField.optionSource === 'LOOKUP' }));
            }
            optionSourceGroup.appendChild(optionSourceSelect);
            body.appendChild(optionSourceGroup);

            // --- Lookup Configuration (for LOOKUP optionSource) ---
            if (selectedField.type === 'select' && selectedField.optionSource === 'LOOKUP') {
                // Lookup Source Type dropdown
                const lookupSourceTypeGroup = createElement('div', { className: 'mb-4' });
                lookupSourceTypeGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Source Type' }));
                const lookupSourceTypeSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                    value: selectedField.lookupSourceType || 'MODULE',
                    onchange: (e: Event) => {
                        const lookupSourceType = (e.target as HTMLSelectElement).value as 'MODULE' | 'MASTER_TYPE';
                        const updates: any = { lookupSourceType };
                        // Clear lookupSource when switching source type
                        if (lookupSourceType !== selectedField.lookupSourceType) {
                            updates.lookupSource = undefined;
                        }
                        formStore.getState().updateField(selectedField.id, updates);
                        this.render();
                    }
                });
                lookupSourceTypeSelect.appendChild(createElement('option', { value: 'MODULE', text: 'Module', selected: (selectedField.lookupSourceType || 'MODULE') === 'MODULE' }));
                lookupSourceTypeSelect.appendChild(createElement('option', { value: 'MASTER_TYPE', text: 'Master Type', selected: selectedField.lookupSourceType === 'MASTER_TYPE' }));
                lookupSourceTypeGroup.appendChild(lookupSourceTypeSelect);
                body.appendChild(lookupSourceTypeGroup);

                // Lookup Source dropdown (Module or Master Type)
                if (selectedField.lookupSourceType === 'MODULE') {
                    const moduleList = this.options.moduleList || [];
                    const lookupSourceGroup = createElement('div', { className: 'mb-4' });
                    lookupSourceGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Source' }));
                    const lookupSourceSelect = createElement('select', {
                        className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                        value: selectedField.lookupSource || '',
                        onchange: (e: Event) => {
                            const lookupSource = (e.target as HTMLSelectElement).value;
                            formStore.getState().updateField(selectedField.id, { lookupSource: lookupSource || undefined });
                            // Clear lookupValueField and lookupLabelField when source changes
                            if (lookupSource) {
                                formStore.getState().updateField(selectedField.id, { 
                                    lookupValueField: undefined,
                                    lookupLabelField: undefined
                                });
                            }
                            // Emit lookup source change event
                            if (this.options.onLookupSourceChange && lookupSource) {
                                this.options.onLookupSourceChange({
                                    fieldId: selectedField.id,
                                    lookupSourceType: 'MODULE',
                                    lookupSource: lookupSource
                                });
                            }
                            this.render();
                        }
                    });
                    lookupSourceSelect.appendChild(createElement('option', { value: '', text: 'Select Module', selected: !selectedField.lookupSource }));
                    moduleList.forEach(module => {
                        lookupSourceSelect.appendChild(createElement('option', { 
                            value: module, 
                            text: module, 
                            selected: selectedField.lookupSource === module 
                        }));
                    });
                    lookupSourceGroup.appendChild(lookupSourceSelect);
                    body.appendChild(lookupSourceGroup);
                } else if (selectedField.lookupSourceType === 'MASTER_TYPE') {
                    const masterTypes = formStore.getState().masterTypes;
                    const activeMasterTypes = masterTypes.filter(mt => mt.active === true);
                    const lookupSourceGroup = createElement('div', { className: 'mb-4' });
                    lookupSourceGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Source' }));
                    const lookupSourceSelect = createElement('select', {
                        className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                        value: selectedField.lookupSource || '',
                        onchange: (e: Event) => {
                            const lookupSource = (e.target as HTMLSelectElement).value;
                            formStore.getState().updateField(selectedField.id, { lookupSource: lookupSource || undefined });
                            // Clear lookupValueField and lookupLabelField when source changes
                            if (lookupSource) {
                                formStore.getState().updateField(selectedField.id, { 
                                    lookupValueField: undefined,
                                    lookupLabelField: undefined
                                });
                            }
                            // Emit lookup source change event
                            if (this.options.onLookupSourceChange && lookupSource) {
                                this.options.onLookupSourceChange({
                                    fieldId: selectedField.id,
                                    lookupSourceType: 'MASTER_TYPE',
                                    lookupSource: lookupSource
                                });
                            }
                            this.render();
                        }
                    });
                    lookupSourceSelect.appendChild(createElement('option', { value: '', text: 'Select Master Type', selected: !selectedField.lookupSource }));
                    activeMasterTypes.forEach(mt => {
                        const optionValue = mt.enumName || mt.id || mt.name;
                        lookupSourceSelect.appendChild(createElement('option', { 
                            value: optionValue, 
                            text: mt.displayName || mt.name, 
                            selected: selectedField.lookupSource === optionValue 
                        }));
                    });
                    lookupSourceGroup.appendChild(lookupSourceSelect);
                    body.appendChild(lookupSourceGroup);
                }

                // Lookup Value Field
                const lookupValueFieldGroup = createElement('div', { className: 'mb-4' });
                lookupValueFieldGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Value Field' }));
                const lookupValueFieldSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                    value: selectedField.lookupValueField || '',
                    disabled: !selectedField.lookupSource,
                    onchange: (e: Event) => {
                        const lookupValueField = (e.target as HTMLSelectElement).value;
                        formStore.getState().updateField(selectedField.id, { lookupValueField: lookupValueField || undefined });
                    }
                });
                lookupValueFieldSelect.appendChild(createElement('option', { value: '', text: selectedField.lookupSource ? 'Select Value Field' : 'Select Lookup Source first', selected: !selectedField.lookupValueField }));
                
                // Populate dropdown from lookupFieldOptionsMap
                if (selectedField.lookupSource) {
                    const lookupFieldOptionsMap = formStore.getState().lookupFieldOptionsMap;
                    const fieldOptions = lookupFieldOptionsMap[selectedField.lookupSource] || [];
                    fieldOptions.forEach(fieldName => {
                        lookupValueFieldSelect.appendChild(createElement('option', { 
                            value: fieldName, 
                            text: fieldName, 
                            selected: selectedField.lookupValueField === fieldName 
                        }));
                    });
                }
                
                lookupValueFieldGroup.appendChild(lookupValueFieldSelect);
                body.appendChild(lookupValueFieldGroup);

                // Lookup Label Field
                const lookupLabelFieldGroup = createElement('div', { className: 'mb-4' });
                lookupLabelFieldGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Label Field' }));
                const lookupLabelFieldSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                    value: selectedField.lookupLabelField || '',
                    disabled: !selectedField.lookupSource,
                    onchange: (e: Event) => {
                        const lookupLabelField = (e.target as HTMLSelectElement).value;
                        formStore.getState().updateField(selectedField.id, { lookupLabelField: lookupLabelField || undefined });
                    }
                });
                lookupLabelFieldSelect.appendChild(createElement('option', { value: '', text: selectedField.lookupSource ? 'Select Label Field' : 'Select Lookup Source first', selected: !selectedField.lookupLabelField }));
                
                // Populate dropdown from lookupFieldOptionsMap
                if (selectedField.lookupSource) {
                    const lookupFieldOptionsMap = formStore.getState().lookupFieldOptionsMap;
                    const fieldOptions = lookupFieldOptionsMap[selectedField.lookupSource] || [];
                    fieldOptions.forEach(fieldName => {
                        lookupLabelFieldSelect.appendChild(createElement('option', { 
                            value: fieldName, 
                            text: fieldName, 
                            selected: selectedField.lookupLabelField === fieldName 
                        }));
                    });
                }
                
                lookupLabelFieldGroup.appendChild(lookupLabelFieldSelect);
                body.appendChild(lookupLabelFieldGroup);

                // Visibility checkbox
                body.appendChild(this.createCheckboxField(
                    'Visibility',
                    selectedField.visible !== false,
                    (checked) => formStore.getState().updateField(selectedField.id, { visible: checked }),
                    `visibility-lookup-${selectedField.id}`
                ));

                // Enabled checkbox
                body.appendChild(this.createCheckboxField(
                    'Enabled',
                    selectedField.enabled !== false,
                    (checked) => formStore.getState().updateField(selectedField.id, { enabled: checked }),
                    `enabled-lookup-${selectedField.id}`
                ));
            }
        }

        // --- Multi-Select (Select fields only) ---
        if (selectedField.type === 'select') {
            body.appendChild(this.createCheckboxField(
                'Multi-Select',
                selectedField.multiSelect === true || selectedField.multiselect === true,
                (checked) => formStore.getState().updateField(selectedField.id, {
                    multiSelect: checked,
                    multiselect: checked // Also update legacy property
                }),
                `multi-select-${selectedField.id}`
            ));
        }

        // --- Custom Options Management (Dropdown, Checkbox, Radio) ---
        if (['select', 'checkbox', 'radio'].includes(selectedField.type)) {
            const optionsHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Options' });
            body.appendChild(optionsHeader);

            // Enable Custom Options checkbox (for dropdown) - only shown for STATIC optionSource
            if (selectedField.type === 'select' && (selectedField.optionSource === 'STATIC' || !selectedField.optionSource)) {
                body.appendChild(this.createCheckboxField(
                    'Enable Custom Options',
                    !!selectedField.customOptionsEnabled,
                    (checked) => {
                        formStore.getState().updateField(selectedField.id, { customOptionsEnabled: checked });
                        // Force re-render to show/hide options editor
                        this.render();
                    },
                    `custom-options-${selectedField.id}`
                ));
            }

            // Show options editor if:
            // - For select: customOptionsEnabled is true AND optionSource is STATIC
            // - For checkbox/radio: always show (they always use STATIC)
            const shouldShowOptions = selectedField.type === 'select'
                ? (selectedField.customOptionsEnabled && (selectedField.optionSource === 'STATIC' || !selectedField.optionSource))
                : true;

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
                        // Force re-render to show new option (scroll position will be preserved)
                        this.render();
                    }
                });
                body.appendChild(addOptionBtn);
            }
        }

        // --- Advanced Validation ---
        // Handle both array and object validation formats
        // Convert to object format (standard)
        const validationObj: ValidationObject = Array.isArray(selectedField.validation)
            ? (() => {
                const obj: ValidationObject = {};
                selectedField.validation.forEach((rule: any) => {
                    if (rule.type === 'required') obj.required = true;
                    else if (rule.type === 'pattern' && rule.regex) {
                        obj.regex = rule.regex;
                        obj.regexMessage = rule.message;
                    }
                    else if (rule.type === 'minLength' && typeof rule.value === 'number') obj.minLength = rule.value;
                    else if (rule.type === 'maxLength' && typeof rule.value === 'number') obj.maxLength = rule.value;
                    else if (rule.type === 'minSelected' && typeof rule.value === 'number') obj.minSelected = rule.value;
                    else if (rule.type === 'maxSelected' && typeof rule.value === 'number') obj.maxSelected = rule.value;
                    else if (rule.type === 'minDate' && typeof rule.value === 'string') obj.minDate = rule.value;
                    else if (rule.type === 'maxDate' && typeof rule.value === 'string') obj.maxDate = rule.value;
                });
                return obj;
            })()
            : (selectedField.validation as ValidationObject) || {};

        const updateValidation = (updates: Partial<ValidationObject>) => {
            const newValidation: ValidationObject = { ...validationObj, ...updates };
            // Remove undefined values
            Object.keys(newValidation).forEach(key => {
                if (newValidation[key as keyof ValidationObject] === undefined) {
                    delete newValidation[key as keyof ValidationObject];
                }
            });
            formStore.getState().updateField(selectedField.id, { validation: newValidation });
        };

        const getRuleValue = (key: keyof ValidationObject): string => {
            const value = validationObj[key];
            if (value === undefined || value === null) return '';
            if (typeof value === 'number') return String(value);
            if (typeof value === 'boolean') return String(value);
            return String(value);
        };

        // Collect validation rule elements
        const validationElements: HTMLElement[] = [];

        // Min/Max Length (Text/Textarea)
        if (['text', 'textarea', 'email', 'password'].includes(selectedField.type)) {
            const minLenGroup = createElement('div', { className: 'mb-3' });
            minLenGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Min Length' }));
            minLenGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('minLength') || '',
                placeholder: 'e.g. 3',
                onchange: (e: Event) => {
                    const value = (e.target as HTMLInputElement).value;
                    updateValidation({ minLength: value ? parseInt(value) : undefined });
                }
            }));
            validationElements.push(minLenGroup);

            const maxLenGroup = createElement('div', { className: 'mb-3' });
            maxLenGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Max Length' }));
            maxLenGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('maxLength') || '',
                placeholder: 'e.g. 100',
                onchange: (e: Event) => {
                    const value = (e.target as HTMLInputElement).value;
                    updateValidation({ maxLength: value ? parseInt(value) : undefined });
                }
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

            const currentRegex = validationObj.regex || '';

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
                            updateValidation({
                                regex: preset.pattern,
                                regexMessage: preset.errorMessage
                            });

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

                    updateValidation({
                        regex: val || undefined,
                        regexMessage: currentPreset?.errorMessage || validationObj.regexMessage || 'Invalid format'
                    });

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

        // Min/Max Value (Number) - Note: Number fields don't have min/max in validation object format
        // These are typically handled via HTML5 min/max attributes, but we can add them if needed
        // For now, skipping as they're not in the standard validation object

        // Min/Max Selected (Checkbox)
        if (selectedField.type === 'checkbox') {
            const minSelectedGroup = createElement('div', { className: 'mb-3' });
            minSelectedGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Min Selected' }));
            minSelectedGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('minSelected'),
                placeholder: 'e.g. 1',
                min: '0',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidation({ minSelected: val ? parseInt(val) : undefined });
                }
            }));
            validationElements.push(minSelectedGroup);

            const maxSelectedGroup = createElement('div', { className: 'mb-3' });
            maxSelectedGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Max Selected' }));
            maxSelectedGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: getRuleValue('maxSelected'),
                placeholder: 'e.g. 2',
                min: '1',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidation({ maxSelected: val ? parseInt(val) : undefined });
                }
            }));
            validationElements.push(maxSelectedGroup);
        }

        // Min/Max Date (Date)
        if (selectedField.type === 'date') {
            const minDateGroup = createElement('div', { className: 'mb-3' });
            minDateGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Minimum Date' }));
            minDateGroup.appendChild(createElement('input', {
                type: 'date',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: validationObj.minDate || '',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidation({ minDate: val || undefined });
                }
            }));
            validationElements.push(minDateGroup);

            const maxDateGroup = createElement('div', { className: 'mb-3' });
            maxDateGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Maximum Date' }));
            maxDateGroup.appendChild(createElement('input', {
                type: 'date',
                className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent',
                value: validationObj.maxDate || '',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidation({ maxDate: val || undefined });
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

        // --- CSS Styling (Field Level) ---
        const cssHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Styling' });
        body.appendChild(cssHeader);

        // Helper to get current style value
        const getStyleValue = (prop: string): string => selectedField.css?.style?.[prop] || '';

        // Helper to update a single style property - gets fresh state from store each time
        const updateStyleProp = (prop: string, value: string) => {
            // Get fresh field state from store to prevent stale closure issues
            const state = formStore.getState();
            const freshField = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === selectedField.id);
            if (!freshField) {
                return;
            }

            const currentStyle = freshField.css?.style || {};
            const newStyle = { ...currentStyle };
            if (value) {
                newStyle[prop] = value;
            } else {
                delete newStyle[prop];
            }

            // IMPORTANT: Only pass 'style' in the update, NOT the entire CSS object
            // This allows updateField to preserve the existing CSS class automatically
            // and prevents double-merging of styles
            const updatePayload = {
                css: {
                    style: Object.keys(newStyle).length > 0 ? newStyle : undefined
                    // Do NOT spread freshField.css here - let updateField preserve class
                }
            };

            state.updateField(selectedField.id, updatePayload);
        };

        // Padding dropdown
        const paddingGroup = createElement('div', { className: 'mb-3' });
        paddingGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Padding' }));
        const paddingSelect = createElement('select', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm',
            onchange: (e: Event) => {
                updateStyleProp('padding', (e.target as HTMLSelectElement).value);
            }
        });
        const paddingOptions = [
            { value: '', label: 'None' },
            { value: '4px', label: '4px - Tight' },
            { value: '8px', label: '8px - Normal' },
            { value: '12px', label: '12px - Comfortable' },
            { value: '16px', label: '16px - Spacious' },
            { value: '24px', label: '24px - Large' }
        ];
        paddingOptions.forEach(opt => {
            paddingSelect.appendChild(createElement('option', { value: opt.value, text: opt.label, selected: getStyleValue('padding') === opt.value }));
        });
        paddingGroup.appendChild(paddingSelect);
        body.appendChild(paddingGroup);

        // Background Color picker
        const bgColorGroup = createElement('div', { className: 'mb-3' });
        bgColorGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Background Color' }));
        const bgColorRow = createElement('div', { className: 'flex items-center gap-2' });
        const bgColorInput = createElement('input', {
            type: 'color',
            className: 'w-10 h-10 rounded border border-gray-300 cursor-pointer',
            value: getStyleValue('backgroundColor') || '#ffffff',
            onchange: (e: Event) => {
                const color = (e.target as HTMLInputElement).value;
                updateStyleProp('backgroundColor', color === '#ffffff' ? '' : color);
            }
        });
        const bgColorClear = createElement('button', {
            type: 'button',
            className: 'px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded',
            text: 'Clear',
            onclick: () => {
                (bgColorInput as HTMLInputElement).value = '#ffffff';
                updateStyleProp('backgroundColor', '');
            }
        });
        bgColorRow.appendChild(bgColorInput);
        bgColorRow.appendChild(bgColorClear);
        bgColorGroup.appendChild(bgColorRow);
        body.appendChild(bgColorGroup);

        // Text Alignment buttons
        const alignGroup = createElement('div', { className: 'mb-3' });
        alignGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Text Alignment' }));
        const alignButtonsRow = createElement('div', { className: 'flex gap-1' });
        const alignments = [
            { value: 'left', icon: 'AlignLeft' },
            { value: 'center', icon: 'AlignCenter' },
            { value: 'right', icon: 'AlignRight' }
        ];
        const currentAlign = getStyleValue('textAlign') || 'left';
        alignments.forEach(align => {
            const isActive = currentAlign === align.value;
            const btn = createElement('button', {
                type: 'button',
                className: `p-2 rounded border ${isActive ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`,
                title: `Align ${align.value}`,
                onclick: () => {
                    const newValue = align.value === 'left' ? '' : align.value;
                    updateStyleProp('textAlign', newValue);
                }
            }, [getIcon(align.icon, 16)]);
            alignButtonsRow.appendChild(btn);
        });
        alignGroup.appendChild(alignButtonsRow);
        body.appendChild(alignGroup);

        // CSS Class input (simplified)
        const cssClassGroup = createElement('div', { className: 'mb-3' });
        cssClassGroup.appendChild(createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1', text: 'Custom CSS Class' }));
        cssClassGroup.appendChild(createElement('input', {
            type: 'text',
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm',
            value: selectedField.css?.class || '',
            placeholder: 'e.g. my-custom-class',
            'data-focus-id': `field-css-class-${selectedField.id}`,
            oninput: (e: Event) => {
                const cssClass = (e.target as HTMLInputElement).value;
                // Get fresh state to prevent stale closure
                const state = formStore.getState();
                const freshField = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === selectedField.id);
                if (!freshField) return;

                // IMPORTANT: Only pass 'class' in the update, NOT 'style'
                // This allows updateField to preserve the existing style automatically
                state.updateField(selectedField.id, {
                    css: {
                        class: cssClass || undefined
                        // Do NOT spread freshField.css here - let updateField preserve style
                    }
                });
            }
        }));
        body.appendChild(cssClassGroup);

        // Advanced Mode toggle for raw CSS editing
        // Check if panel was previously expanded for this field
        const isPanelExpanded = advancedCssPanelState.get(selectedField.id) || false;

        const advancedToggleGroup = createElement('div', { className: 'mb-3' });
        const advancedToggle = createElement('button', {
            type: 'button',
            className: 'text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1',
            onclick: () => {
                const advancedPanel = document.getElementById(`advanced-css-${selectedField.id}`);
                if (advancedPanel) {
                    advancedPanel.classList.toggle('hidden');
                    const isHidden = advancedPanel.classList.contains('hidden');
                    advancedToggle.textContent = isHidden ? '▶ Show Advanced CSS' : '▼ Hide Advanced CSS';
                    // Save state to preserve across re-renders
                    advancedCssPanelState.set(selectedField.id, !isHidden);
                }
            }
        });
        // Set initial text based on preserved state
        advancedToggle.textContent = isPanelExpanded ? '▼ Hide Advanced CSS' : '▶ Show Advanced CSS';
        advancedToggleGroup.appendChild(advancedToggle);
        body.appendChild(advancedToggleGroup);

        // Advanced CSS panel (use preserved state for visibility)
        const advancedPanel = createElement('div', {
            className: isPanelExpanded ? 'mb-3' : 'mb-3 hidden',
            id: `advanced-css-${selectedField.id}`
        });
        advancedPanel.appendChild(createElement('label', { className: 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1', text: 'Raw CSS Style (JSON)' }));

        const cssStyleId = `field-css-style-${selectedField.id}`;

        // Always get the freshest field data from store to ensure we have the latest CSS style
        const freshState = formStore.getState();
        const freshFieldForInit = freshState.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === selectedField.id);

        // Use fresh field data if available, otherwise fall back to selectedField
        const fieldForCssStyle = freshFieldForInit || selectedField;
        let initialCssStyleValue = fieldForCssStyle.css?.style ? JSON.stringify(fieldForCssStyle.css.style, null, 2) : '';
        const preservedValue = focusState?.id === cssStyleId ? focusState.value : undefined;
        if (preservedValue !== undefined) {
            initialCssStyleValue = preservedValue;
        }


        const cssStyleTextarea = createElement('textarea', {
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-xs font-mono',
            rows: 3,
            placeholder: '{"padding": "8px", "backgroundColor": "#f0f0f0"}',
            'data-focus-id': cssStyleId,
            'data-was-focused': 'false',
            onfocus: (e: Event) => {
                const textarea = e.target as HTMLTextAreaElement;

                // Mark that this textarea has received genuine user focus
                textarea.setAttribute('data-was-focused', 'true');

                // DEBUG: Log when CSS style textarea gets focus
                const state = formStore.getState();
                const freshField = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === selectedField.id);

                // Safety check: If textarea is empty but store has CSS style, restore it
                if (!textarea.value.trim() && freshField?.css?.style && Object.keys(freshField.css.style).length > 0) {
                    const styleString = JSON.stringify(freshField.css.style, null, 2);
                    textarea.value = styleString;
                }
            },
            oninput: (e: Event) => {
                const styleText = (e.target as HTMLTextAreaElement).value;
                // Save on input to prevent data loss during re-renders
                const state = formStore.getState();
                const freshField = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === selectedField.id);
                if (!freshField) return;

                try {
                    if (styleText.trim()) {
                        const styleObj = JSON.parse(styleText);
                        state.updateField(selectedField.id, {
                            css: { ...freshField.css, style: styleObj }
                        });
                    }
                    // Don't clear on empty during oninput - only clear intentionally on blur when panel is visible
                } catch (err) {
                    // Invalid JSON during typing - ignore, will validate on blur
                }
            },
            onblur: (e: Event) => {
                const textarea = e.target as HTMLTextAreaElement;
                const styleText = textarea.value;

                // Only process blur if this textarea was genuinely focused by the user
                // This prevents spurious blur events from re-renders
                const wasFocused = textarea.getAttribute('data-was-focused') === 'true';
                if (!wasFocused) {
                    return;
                }

                // Reset the focus flag
                textarea.setAttribute('data-was-focused', 'false');

                // Defer blur processing to allow click events on fields to fire first
                // This prevents the double-click issue when clicking on fields after using the textarea
                setTimeout(() => {
                    // Check if this textarea is still in the DOM
                    if (!document.body.contains(textarea)) {
                        return;
                    }

                    // Check if the advanced panel is visible
                    const advPanel = document.getElementById(`advanced-css-${selectedField.id}`);
                    const isPanelVisible = advPanel && !advPanel.classList.contains('hidden');
                    if (!isPanelVisible) {
                        return;
                    }

                    // Get fresh state to prevent stale closure
                    const state = formStore.getState();
                    const freshField = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === selectedField.id);
                    if (!freshField) return;

                    try {
                        if (styleText.trim()) {
                            const styleObj = JSON.parse(styleText);
                            state.updateField(selectedField.id, {
                                css: { ...freshField.css, style: styleObj }
                            });
                        } else {
                            // Only clear if user explicitly cleared - check store first
                            if (freshField.css?.style && Object.keys(freshField.css.style).length > 0) {
                                // Store has data but textarea is empty - restore from store
                                textarea.value = JSON.stringify(freshField.css.style, null, 2);
                            } else {
                                // No data in store, clear is intentional
                                state.updateField(selectedField.id, {
                                    css: { ...freshField.css, style: undefined }
                                });
                            }
                        }
                    } catch (err) {
                        // Invalid JSON - restore from store if available
                        if (freshField.css?.style) {
                            textarea.value = JSON.stringify(freshField.css.style, null, 2);
                        }
                    }
                }, 0); // Defer to next event loop tick to allow click events to fire first
            }
        });

        // Set textarea value directly (textarea needs property, not attribute)
        // This must be done after createElement because textarea.value is a property, not an attribute
        cssStyleTextarea.value = initialCssStyleValue;

        advancedPanel.appendChild(cssStyleTextarea);
        body.appendChild(advancedPanel);

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
