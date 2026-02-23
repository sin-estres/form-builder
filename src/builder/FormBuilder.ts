import { formStore } from '../core/useFormStore';
import { createElement, getIcon } from '../utils/dom';
import { FIELD_TYPES, REGEX_PRESETS, VALIDATION_TYPE_PRESETS, RegexPreset } from '../core/constants';
import {
    parseFormulaDependencies,
    validateFormula,
    detectCircularDependency,
    getNumericFieldsForFormula
} from '../utils/formula';
import { FormRenderer } from '../renderer/FormRenderer';
import { FormSchema, FormSection, parseWidth, FieldWidth, ValidationObject, FieldValidations } from '../core/schemaTypes';
import { cloneForm, cloneSection } from '../utils/clone';
import Sortable from 'sortablejs';
import { SectionList } from './SectionList';
import { MasterType } from '../core/useFormStore';

// Module-level state to track which fields have their Advanced CSS panel expanded
const advancedCssPanelState: Map<string, boolean> = new Map();

// Debounced label updates to prevent flickering when typing
const LABEL_DEBOUNCE_MS = 300;
const labelUpdateTimeouts = new Map<string, ReturnType<typeof setTimeout>>();


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
    onProfileClick?: () => void; // Callback for profile icon click
    onSettingsClick?: () => void; // Callback for settings icon click
}

export class FormBuilder {
    private container: HTMLElement;
    private unsubscribe!: () => void;
    private options: FormBuilderOptions;

    private lastRenderedSchemaHash: string = ''; // Cache to detect meaningful changes
    private pendingRenderId: number | null = null; // For requestAnimationFrame debouncing

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

        const performRender = () => {
            this.pendingRenderId = null;
            const state = formStore.getState();

            // Check if preview mode changed - always re-render on preview mode toggle
            const previewModeChanged = lastPreviewMode !== null && lastPreviewMode !== state.isPreviewMode;
            lastPreviewMode = state.isPreviewMode;

            // Generate hash of schema for change detection (exclude title to prevent re-renders on section name typing)
            const schemaHash = JSON.stringify({
                sections: state.schema.sections.map((s) => ({
                    id: s.id,
                    // Exclude title - prevents re-renders on section name typing
                    fields: s.fields.map((f) => ({
                        id: f.id,
                        type: f.type,
                        label: f.label,
                        layout: f.layout,
                        width: f.width,
                        css: f.css
                    }))
                })),
                selectedField: state.selectedFieldId,
                isPreviewMode: state.isPreviewMode
            });

            // Re-render if schema changed OR preview mode changed
            if (schemaHash !== this.lastRenderedSchemaHash || previewModeChanged) {
                this.lastRenderedSchemaHash = schemaHash;
                this.render();
            }
        };

        this.unsubscribe = formStore.subscribe(() => {
            // Debounce: schedule a single render for the next frame so multiple
            // store updates in quick succession result in one render (fixes flickering)
            if (this.pendingRenderId == null) {
                this.pendingRenderId = requestAnimationFrame(() => performRender.call(this));
            }
        });
    }

    public destroy() {
        if (this.pendingRenderId != null) {
            cancelAnimationFrame(this.pendingRenderId);
            this.pendingRenderId = null;
        }
        labelUpdateTimeouts.forEach((id) => clearTimeout(id));
        labelUpdateTimeouts.clear();
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
            const toolboxWrapper = createElement('div', { className: 'form-builder-toolbox-wrapper w-full md:w-[14rem] bg-white dark:bg-gray-900 border-r md:border-r border-b md:border-b-0 border-gray-200 dark:border-gray-800' });
            toolboxWrapper.appendChild(this.renderToolbox());
            main.appendChild(toolboxWrapper);

            // Canvas wrapper
            const canvasWrapper = createElement('div', { className: 'form-builder-canvas flex-1 overflow-y-auto' });
            canvasWrapper.appendChild(this.renderCanvas(state));
            main.appendChild(canvasWrapper);

            // Wrap config panel for mobile collapsibility
            const configWrapper = createElement('div', { className: 'form-builder-config-wrapper w-full md:w-[17rem] bg-white dark:bg-gray-900 border-l md:border-l border-t md:border-t-0 border-gray-200 dark:border-gray-800 overflow-hidden' });
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
        const toolbar = createElement('div', { className: 'flex items-center justify-between p-2 pl-[95px] border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800' });

        // Left
        const left = createElement('div', { className: 'flex items-center ' });
        left.appendChild(createElement('h1', { className: 'text-xl font-semibold mb-2 text-primary hidden  mr-4', text: '' }));

        // Form Selection Dropdown
        if (state.existingForms && state.existingForms.length > 0) {
            const formSelect = createElement('select', {
                className: 'px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent text-sm mr-2',
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

        // Profile Icon Button
        const profileBtn = createElement('button', {
            className: 'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400',
            title: 'Profile',
            onclick: () => {
                if (this.options.onProfileClick) {
                    this.options.onProfileClick();
                }
            }
        }, [getIcon('User', 20)]);
        right.appendChild(profileBtn);

        // Settings Icon Button
        const settingsBtn = createElement('button', {
            className: 'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400',
            title: 'Settings',
            onclick: () => {
                if (this.options.onSettingsClick) {
                    this.options.onSettingsClick();
                }
            }
        }, [getIcon('Cog', 20)]);
        right.appendChild(settingsBtn);

        const clearBtn = createElement('button', {
            className: 'flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-[#f7a1a14d] text-red-500 rounded-md transition-colors',
            onclick: () => {
                if (confirm('Are you sure?')) {
                    formStore.getState().setSchema({ id: 'new', title: 'New Form', formName: 'newForm', sections: [] });
                }
            }
        }, [getIcon('Trash2', 16), createElement('span', { className: '', title: 'Clear', })]);

        const previewBtn = createElement('button', {
            className: `flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${state.isPreviewMode ? "text-[#635bff] bg-[#e7e7ff] " : "text-[#635bff] bg-[#e7e7ff]"}`,
            onclick: (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                formStore.getState().togglePreview();
            },
            title: state.isPreviewMode ? 'Exit Preview' : 'Preview Form'
        }, [getIcon(state.isPreviewMode ? 'X' : 'Eye', 16)]);

        const saveBtn = createElement('button', {
            className: 'flex items-center px-3 py-2 text-sm font-medium text-[#635bff] bg-[#e7e7ff]  rounded-md shadow-sm transition-colors',
            onclick: () => {
                const schema = formStore.getState().schema;

                // Validate formula fields before save
                const numericFields = schema.sections.flatMap(s => s.fields).filter((f: any) => f.type === 'number');
                const allIds = numericFields.map((f: any) => f.id);
                const allNames = numericFields.map((f: any) => f.fieldName ?? f.id);
                for (const field of schema.sections.flatMap(s => s.fields)) {
                    if (field.type === 'number' && field.valueSource === 'formula' && field.formula) {
                        const validation = validateFormula(field.formula, allIds, allNames, field.id);
                        if (!validation.valid) {
                            alert(`Formula error in "${field.label}": ${validation.error}`);
                            return;
                        }
                        const deps = field.dependencies ?? parseFormulaDependencies(field.formula);
                        if (detectCircularDependency(schema, field.id, field.formula, deps)) {
                            alert(`Circular dependency in formula for "${field.label}"`);
                            return;
                        }
                    }
                }

                // Debug: Log validation state for number fields before save
                schema.sections.forEach((section: any) => {
                    section.fields?.forEach((field: any) => {
                        if (field.type === 'number' && field.validations) {
                            console.log('[Form Builder] Number field validations before save:', {
                                fieldId: field.id,
                                label: field.label,
                                validations: field.validations,
                                hasMin: 'min' in field.validations,
                                hasMax: 'max' in field.validations
                            });
                        }
                    });
                });

                // Log what we are sending to the app using this npm package
                console.log('[Form Builder] Schema being sent to app:', JSON.stringify(schema, null, 2));

                // Call the callback if provided (schema is already cleaned by setSchema)
                if (this.options.onSave) {
                    this.options.onSave(schema);
                }
            }
        }, [ createElement('span', { className: '', text: 'Save' })]);

        right.appendChild(clearBtn);
        right.appendChild(previewBtn);
        right.appendChild(saveBtn);
        toolbar.appendChild(right);

        return toolbar;
    }

    private activeTab: 'fields' | 'templates' | 'import' = 'fields';

    private renderToolbox(): HTMLElement {
        const toolbox = createElement('div', { className: ' dark:bg-gray-900 flex flex-col h-full' });

        // Tabs
        const tabs = createElement('div', { className: 'flex border-b border-gray-200 dark:border-gray-800 ' });
        /**
         * createTab: builds a tab button with optional icon and tooltip (title).
         * - icon defaults to 'ListBullet' when not provided
         * - tooltip (title) is shown on hover by the browser
         */
        const createTab = (id: 'fields' | 'templates' | 'import', label: string, icon?: string, tooltip?: string) => {
            const isActive = this.activeTab === id;

            const btn = createElement('button', {
                className: `flex-1 flex items-center justify-center  py-3 text-base font-bold transition-colors ${isActive ? 'text-[#635bff] bg-[#e7e7ff]  ' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`,
                title: tooltip || label,
                'aria-label': tooltip || label,
                onclick: () => {
                    this.activeTab = id;
                    this.render(); // Re-render to show new tab content
                }
            }, [
                getIcon(icon || 'ListBullet', 16),
                createElement('span', { className: 'hidden sm:inline-block', text: label })
            ]);

            return btn;
        };

        // Tabs with icons + hover tooltips
        tabs.appendChild(createTab('fields', '', 'ListBullet', 'Field types'));
        tabs.appendChild(createTab('templates', '', 'DocumentText', 'Saved templates'));
        tabs.appendChild(createTab('import', '', 'Upload', 'Import sections'));
        toolbox.appendChild(tabs);

        // Content
        const content = createElement('div', { className: 'flex-1 overflow-y-auto p-4 bg-[#e7e7ff]' });

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
            className: 'flex-1 dark:bg-gray-950 p-4 md:p-4 overflow-y-auto',
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
            className: 'w-full mt-6 py-3  dark:border-gray-700 rounded-md text-sm text-gray-500 bg-[#635bff] max-w-[180px]  text-white transition-colors flex items-center justify-center font-medium',
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
        const container = createElement('div', { className: 'flex items-center gap-3 py-1 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer' });
        
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

        const body = createElement('div', { className: 'flex-1 overflow-y-auto p-4 px-2 space-y-3', id: 'config-panel-body' });

        // Label
        const labelGroup = createElement('div');
        labelGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Label' }));
        labelGroup.appendChild(createElement('input', {
            className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
            value: selectedField.label,
            'data-focus-id': `field-label-${selectedField.id}`,
            oninput: (e: Event) => {
                const fieldId = selectedField.id;
                const value = (e.target as HTMLInputElement).value;
                const existing = labelUpdateTimeouts.get(fieldId);
                if (existing) clearTimeout(existing);
                const timeoutId = setTimeout(() => {
                    labelUpdateTimeouts.delete(fieldId);
                    formStore.getState().updateField(fieldId, { label: value });
                }, LABEL_DEBOUNCE_MS);
                labelUpdateTimeouts.set(fieldId, timeoutId);
            }
        }));
        body.appendChild(labelGroup);

        // --- Number field: Value Source (Manual / Formula) ---
        if (selectedField.type === 'number') {
            const valueSourceHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4', text: 'Value Source' });
            body.appendChild(valueSourceHeader);
            const valueSourceGroup = createElement('div', { className: 'mb-3' });
            valueSourceGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Source' }));
            const valueSourceSelect = createElement('select', {
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: selectedField.valueSource || 'manual',
                onchange: (e: Event) => {
                    const source = (e.target as HTMLSelectElement).value as 'manual' | 'formula';
                    const updates: Partial<typeof selectedField> = { valueSource: source };
                    if (source === 'manual') {
                        updates.formula = undefined;
                        updates.dependencies = undefined;
                    } else if (source === 'formula') {
                        updates.formula = selectedField.formula || '';
                        updates.dependencies = selectedField.dependencies || [];
                    }
                    formStore.getState().updateField(selectedField.id, updates);
                    this.render();
                }
            });
            valueSourceSelect.appendChild(createElement('option', { value: 'manual', text: 'Manual', selected: (selectedField.valueSource || 'manual') === 'manual' }));
            valueSourceSelect.appendChild(createElement('option', { value: 'formula', text: 'Formula', selected: selectedField.valueSource === 'formula' }));
            valueSourceGroup.appendChild(valueSourceSelect);
            body.appendChild(valueSourceGroup);

            // Formula configuration (when valueSource === 'formula')
            if (selectedField.valueSource === 'formula') {
                const schema = formStore.getState().schema;
                const numericFields = getNumericFieldsForFormula(schema, selectedField.id);
                const availableIds = numericFields.map(f => f.id);
                const availableNames = numericFields.map(f => f.fieldName);

                const formulaGroup = createElement('div', { className: 'mb-3' });
                formulaGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Formula' }));
                const formulaInput = createElement('input', {
                    type: 'text',
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent font-mono text-sm',
                    value: selectedField.formula || '',
                    placeholder: 'e.g. quantity * price',
                    'data-focus-id': `field-formula-${selectedField.id}`,
                    oninput: (e: Event) => {
                        const formula = (e.target as HTMLInputElement).value.trim();
                        const deps = parseFormulaDependencies(formula);
                        const validation = validateFormula(formula, availableIds, availableNames, selectedField.id);
                        const hasCircular = deps.length > 0 && detectCircularDependency(schema, selectedField.id, formula, deps);
                        const errEl = formulaGroup.querySelector('.formula-error') as HTMLElement | null;
                        if (errEl) {
                            if (validation.valid && !hasCircular) {
                                errEl.textContent = '';
                                errEl.classList.add('hidden');
                            } else {
                                errEl.textContent = !validation.valid ? validation.error : 'Circular dependency detected';
                                errEl.classList.remove('hidden');
                            }
                        }
                        formStore.getState().updateField(selectedField.id, { formula, dependencies: deps });
                    }
                }) as HTMLInputElement;
                formulaGroup.appendChild(formulaInput);
                const formulaError = createElement('div', { className: 'text-xs text-red-600 dark:text-red-400 mt-1 formula-error hidden' });
                formulaGroup.appendChild(formulaError);
                body.appendChild(formulaGroup);

                // Insert field dropdown - quick insert into formula
                const insertGroup = createElement('div', { className: 'mb-3' });
                insertGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Insert Field' }));
                const insertSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                    onchange: (e: Event) => {
                        const sel = e.target as HTMLSelectElement;
                        const ref = sel.value;
                        if (!ref) return;
                        const current = selectedField.formula || '';
                        const insert = current ? ` ${ref} ` : ref;
                        const newFormula = current + insert;
                        formStore.getState().updateField(selectedField.id, {
                            formula: newFormula,
                            dependencies: parseFormulaDependencies(newFormula)
                        });
                        formulaInput.value = newFormula;
                        sel.value = '';
                        this.render();
                    }
                });
                insertSelect.appendChild(createElement('option', { value: '', text: 'Select field to insert...', selected: true }));
                numericFields.forEach(f => {
                    const ref = f.fieldName !== f.id ? f.fieldName : f.id;
                    insertSelect.appendChild(createElement('option', { value: ref, text: `${f.label} (${ref})` }));
                });
                insertGroup.appendChild(insertSelect);
                body.appendChild(insertGroup);

                const hintEl = createElement('p', {
                    className: 'text-xs text-gray-500 dark:text-gray-400 mb-2',
                    text: 'Use +, -, *, / and parentheses. Reference fields by their name or ID.'
                });
                body.appendChild(hintEl);
            }
        }

        // Placeholder (skip for image - uses Image section instead)
        if (selectedField.type !== 'image') {
            const placeholderGroup = createElement('div');
            placeholderGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Placeholder' }));
            placeholderGroup.appendChild(createElement('input', {
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: selectedField.placeholder || '',
                'data-focus-id': `field-placeholder-${selectedField.id}`,
                oninput: (e: Event) => {
                    formStore.getState().updateField(selectedField.id, { placeholder: (e.target as HTMLInputElement).value });
                }
            }));
            body.appendChild(placeholderGroup);
        }

        // Image field: upload, preview, remove
        if (selectedField.type === 'image') {
            const imageUrl = selectedField.imageUrl ?? selectedField.defaultValue;
            const imageGroup = createElement('div', { className: 'mb-4' });
            imageGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-2', text: 'Image' }));

            const previewWrap = createElement('div', {
                className: 'rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden min-h-[80px] flex items-center justify-center mb-2'
            });
            if (imageUrl) {
                const img = createElement('img', {
                    src: imageUrl,
                    alt: selectedField.label || 'Image',
                    className: 'max-h-32 max-w-full object-contain'
                }) as HTMLImageElement;
                img.onerror = () => {
                    previewWrap.innerHTML = '';
                    previewWrap.appendChild(createElement('p', { className: 'text-xs text-red-500 p-2', text: 'Failed to load' }));
                };
                previewWrap.appendChild(img);
            } else {
                previewWrap.appendChild(createElement('p', { className: 'text-xs text-muted-foreground p-2', text: 'No image' }));
            }
            imageGroup.appendChild(previewWrap);

            const btnRow = createElement('div', { className: 'flex gap-2' });
            const fileInput = createElement('input', {
                type: 'file',
                accept: 'image/jpeg,image/png,image/gif,image/webp',
                className: 'hidden',
                id: `config-image-${selectedField.id}`
            }) as HTMLInputElement;
            fileInput.onchange = (e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file || !file.type.match(/^image\/(jpeg|png|gif|webp)$/)) return;
                if (file.size > 5 * 1024 * 1024) {
                    alert('Image must be under 5MB');
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result as string;
                    if (base64) formStore.getState().updateField(selectedField.id, { imageUrl: base64, defaultValue: base64 });
                };
                reader.readAsDataURL(file);
                (e.target as HTMLInputElement).value = '';
            };
            btnRow.appendChild(fileInput);
            btnRow.appendChild(createElement('button', {
                type: 'button',
                className: 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800',
                text: imageUrl ? 'Replace' : 'Upload',
                onclick: () => fileInput.click()
            }));
            btnRow.appendChild(createElement('button', {
                type: 'button',
                className: 'px-3 py-2 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20',
                text: 'Remove',
                disabled: !imageUrl,
                onclick: () => formStore.getState().updateField(selectedField.id, { imageUrl: undefined, defaultValue: undefined })
            }));
            imageGroup.appendChild(btnRow);
            body.appendChild(imageGroup);
        }

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
        const fieldId = selectedField.id;
        for (let span = 1; span <= 12; span++) {
            const isActive = currentSpan === span;
            const spanBtn = createElement('button', {
                type: 'button',
                className: `span-preset-btn px-2 py-1.5 text-xs rounded transition-colors cursor-pointer ${isActive ? 'bg-[#e7e7ff] text-[#635bff] font-semibold' : 'bg-white border-2 border-[#e7e7ff] dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`,
                text: `${span}`,
                title: `${span} column${span > 1 ? 's' : ''} (${Math.round((span / 12) * 100)}%)`
            });
            spanBtn.addEventListener('click', (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                const state = formStore.getState();
                const field = state.schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === fieldId);
                if (field) {
                    const layout = field.layout || { row: 0, column: 0 };
                    state.updateField(fieldId, {
                        layout: { ...layout, span },
                        width: Math.round((span / 12) * 100) as FieldWidth
                    });
                }
            });
            spanButtonsContainer.appendChild(spanBtn);
        }
        layoutGroup.appendChild(spanButtonsContainer);

        body.appendChild(layoutGroup);

        // Required (sync with validations.required)
        body.appendChild(this.createCheckboxField(
            'Required',
            !!selectedField.required || !!selectedField.validations?.required,
            (checked) => {
                const currentValidations = selectedField.validations || {};
                formStore.getState().updateField(selectedField.id, {
                    required: checked,
                    validations: { ...currentValidations, required: checked }
                });
            },
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

        // --- Option Source (Select, Radio, Checkbox) ---
        if (['select', 'checkbox', 'radio'].includes(selectedField.type)) {
            const optionSourceHeader = createElement('h3', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 mt-6', text: 'Option Source' });
            body.appendChild(optionSourceHeader);

            const optionSourceGroup = createElement('div', { className: 'mb-4' });
            optionSourceGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Source Type' }));
            const optionSourceSelect = createElement('select', {
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: selectedField.optionSource || 'STATIC',
                onchange: (e: Event) => {
                    const source = (e.target as HTMLSelectElement).value as 'STATIC' | 'MASTER' | 'LOOKUP';
                    const updates: any = { optionSource: source };

                    if (source === 'MASTER') {
                        // Master List will appear; keep existing or clear if none selected
                    } else if (source === 'STATIC') {
                        // When switching to STATIC, ensure customOptionsEnabled is true
                        updates.customOptionsEnabled = true;
                        // Clear Master List values when switching away from MASTER
                        updates.groupName = undefined;
                        updates.masterTypeName = undefined;
                        updates.options = undefined;
                    } else if (source === 'LOOKUP') {
                        // Clear lookup-related fields when switching to LOOKUP if not already set
                        if (!selectedField.lookupSourceType) {
                            updates.lookupSourceType = 'MODULE';
                        }
                        // Clear Master List values when switching away from MASTER
                        updates.groupName = undefined;
                        updates.masterTypeName = undefined;
                        updates.options = undefined;
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

            // --- Master List (Select/Dropdown only - shown when Source Type = MASTER) ---
            if (selectedField.type === 'select' && selectedField.optionSource === 'MASTER') {
                const masterTypes = formStore.getState().masterTypes;
                const activeMasterTypes = masterTypes.filter(mt => mt.active === true);
                const dropdownOptionsMap = formStore.getState().dropdownOptionsMap;

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

                if (activeMasterTypes.length > 0) {
                    const groupNameGroup = createElement('div', { className: 'mb-4' });
                    groupNameGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Master List' }));
                    const groupNameSelect = createElement('select', {
                        className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                        onchange: (e: Event) => {
                            const selectedEnumName = (e.target as HTMLSelectElement).value;
                            if (selectedEnumName) {
                                const selectedMasterType = activeMasterTypes.find(mt => mt.enumName === selectedEnumName);
                                if (selectedMasterType) {
                                    let options: { label: string; value: string }[] = [];
                                    if (dropdownOptionsMap && dropdownOptionsMap[selectedEnumName]) {
                                        options = dropdownOptionsMap[selectedEnumName];
                                    } else if (selectedMasterType.indexes && selectedMasterType.indexes.length > 0) {
                                        options = convertIndexesToOptions(selectedMasterType.indexes);
                                    }
                                    formStore.getState().updateField(selectedField.id, {
                                        groupName: { id: selectedMasterType.id, name: selectedMasterType.name },
                                        masterTypeName: selectedEnumName,
                                        options: options.length > 0 ? options : undefined
                                    });
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
                                    options: undefined
                                });
                            }
                        }
                    });

                    let currentMasterType: MasterType | undefined;
                    if (selectedField.masterTypeName) {
                        currentMasterType = activeMasterTypes.find(mt => mt.enumName === selectedField.masterTypeName);
                    } else if (selectedField.groupName) {
                        currentMasterType = activeMasterTypes.find(mt =>
                            mt.id === selectedField.groupName?.id || mt.name === selectedField.groupName?.name
                        );
                    }

                    groupNameSelect.appendChild(createElement('option', { value: '', text: 'None', selected: !currentMasterType }));
                    activeMasterTypes.forEach(mt => {
                        const isSelected = currentMasterType && (
                            (selectedField.masterTypeName && mt.enumName === selectedField.masterTypeName) ||
                            (selectedField.groupName && (mt.id === selectedField.groupName?.id || mt.name === selectedField.groupName?.name))
                        );
                        const optionValue = mt.enumName || mt.id || mt.name;
                        groupNameSelect.appendChild(createElement('option', {
                            value: optionValue,
                            text: mt.displayName || mt.name,
                            selected: !!isSelected
                        }));
                    });

                    groupNameGroup.appendChild(groupNameSelect);
                    body.appendChild(groupNameGroup);

                    if (currentMasterType && (!selectedField.options || selectedField.options.length === 0)) {
                        let options: { label: string; value: string }[] = [];
                        if (currentMasterType.enumName && dropdownOptionsMap && dropdownOptionsMap[currentMasterType.enumName]) {
                            options = dropdownOptionsMap[currentMasterType.enumName];
                        } else if (currentMasterType.indexes && currentMasterType.indexes.length > 0) {
                            options = convertIndexesToOptions(currentMasterType.indexes);
                        }
                        if (options.length > 0) {
                            formStore.getState().updateField(selectedField.id, { options });
                        }
                        if (selectedField.masterTypeName && !selectedField.groupName) {
                            formStore.getState().updateField(selectedField.id, {
                                groupName: { id: currentMasterType.id, name: currentMasterType.name }
                            });
                        }
                    }
                }
            }

            // --- Lookup Configuration (for LOOKUP optionSource) ---
            if (selectedField.type === 'select' && selectedField.optionSource === 'LOOKUP') {
                // Lookup Source Type dropdown
                const lookupSourceTypeGroup = createElement('div', { className: 'mb-4' });
                lookupSourceTypeGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Source Type' }));
                const lookupSourceTypeSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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
                    lookupSourceGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Source' }));
                    const lookupSourceSelect = createElement('select', {
                        className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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
                    lookupSourceGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Source' }));
                    const lookupSourceSelect = createElement('select', {
                        className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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
                lookupValueFieldGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Value Field' }));
                const lookupValueFieldSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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
                lookupLabelFieldGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Lookup Label Field' }));
                const lookupLabelFieldSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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
            // - For select: (customOptionsEnabled OR has options) AND optionSource is STATIC
            //   When loading saved form, customOptionsEnabled may be unset but options exist - show editor
            // - For checkbox/radio: always show (they always use STATIC)
            const isStaticSelect = selectedField.type === 'select' && (selectedField.optionSource === 'STATIC' || !selectedField.optionSource);
            const hasOptions = selectedField.options && selectedField.options.length > 0;
            const shouldShowOptions = selectedField.type === 'select'
                ? isStaticSelect && (!!selectedField.customOptionsEnabled || !!hasOptions)
                : true;

            if (shouldShowOptions) {
                const options = selectedField.options || [];

                // Helper to get current options from store (avoids stale closure when user types then clicks Add/Delete)
                const fieldId = selectedField.id;
                const getCurrentOptions = (): { label: string; value: string }[] => {
                    const field = formStore.getState().schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === fieldId);
                    return field?.options || [];
                };

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
                            const currentOptions = getCurrentOptions();
                            const newOptions = [...currentOptions];
                            if (newOptions[index]) {
                                newOptions[index] = { ...newOptions[index], label: (e.target as HTMLInputElement).value };
                                formStore.getState().updateField(fieldId, { options: newOptions });
                            }
                        }
                    });

                    const valueInput = createElement('input', {
                        type: 'text',
                        className: 'flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm',
                        value: opt.value,
                        placeholder: 'Option value',
                        'data-focus-id': `field-option-value-${selectedField.id}-${index}`,
                        oninput: (e: Event) => {
                            const currentOptions = getCurrentOptions();
                            const newOptions = [...currentOptions];
                            if (newOptions[index]) {
                                newOptions[index] = { ...newOptions[index], value: (e.target as HTMLInputElement).value };
                                formStore.getState().updateField(fieldId, { options: newOptions });
                            }
                        }
                    });

                    const deleteBtn = createElement('button', {
                        type: 'button',
                        className: 'p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors',
                        title: 'Delete option',
                        onclick: (e: Event) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const currentOptions = getCurrentOptions();
                            // Use value-based deletion (more robust than index - avoids stale closure)
                            const newOptions = currentOptions.filter((o) => o.value !== opt.value);
                            formStore.getState().updateField(fieldId, { options: newOptions });
                            this.render();
                        }
                    }, [getIcon('Trash2', 14)]);

                    optionRow.appendChild(labelInput);
                    optionRow.appendChild(valueInput);
                    optionRow.appendChild(deleteBtn);
                    optionsList.appendChild(optionRow);
                });

                body.appendChild(optionsList);

                // Add Option button - use getCurrentOptions() to avoid stale closure (preserves user-typed values)
                const addOptionBtn = createElement('button', {
                    type: 'button',
                    className: 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                    text: 'Add Option',
                    onclick: () => {
                        const currentOptions = getCurrentOptions();
                        const newOption = { label: `Option ${currentOptions.length + 1}`, value: `opt${currentOptions.length + 1}` };
                        const newOptions = [...currentOptions, newOption];
                        formStore.getState().updateField(fieldId, { options: newOptions });
                        // Force re-render to show new option (scroll position will be preserved)
                        this.render();
                    }
                });
                body.appendChild(addOptionBtn);
            }
        }

        // --- Advanced Validation ---
        // Use validations (comprehensive) - fallback to migrated validation for legacy
        const validationsObj: FieldValidations = selectedField.validations || (() => {
            const v = selectedField.validation;
            if (!v) return {};
            if (Array.isArray(v)) {
                const obj: FieldValidations = {};
                v.forEach((rule: any) => {
                    if (rule.type === 'required') obj.required = true;
                    else if (rule.type === 'pattern' && rule.regex) {
                        obj.pattern = rule.regex;
                        if (rule.message) obj.customErrorMessages = { ...obj.customErrorMessages, pattern: rule.message };
                    }
                    else if (rule.type === 'minLength' && typeof rule.value === 'number') obj.minLength = rule.value;
                    else if (rule.type === 'maxLength' && typeof rule.value === 'number') obj.maxLength = rule.value;
                    else if (rule.type === 'min' && typeof rule.value === 'number') obj.min = rule.value;
                    else if (rule.type === 'max' && typeof rule.value === 'number') obj.max = rule.value;
                    else if (rule.type === 'minSelected' && typeof rule.value === 'number') obj.minSelected = rule.value;
                    else if (rule.type === 'maxSelected' && typeof rule.value === 'number') obj.maxSelected = rule.value;
                    else if (rule.type === 'minDate' && typeof rule.value === 'string') obj.minDate = rule.value;
                    else if (rule.type === 'maxDate' && typeof rule.value === 'string') obj.maxDate = rule.value;
                });
                return obj;
            }
            const o = v as ValidationObject;
            return {
                required: o.required,
                pattern: o.regex,
                minLength: o.minLength,
                maxLength: o.maxLength,
                min: o.min,
                max: o.max,
                minSelected: o.minSelected,
                maxSelected: o.maxSelected,
                minDate: o.minDate,
                maxDate: o.maxDate,
                customErrorMessages: o.regexMessage ? { pattern: o.regexMessage } : undefined
            };
        })();

        const updateValidations = (updates: Partial<FieldValidations>) => {
            // Always read latest validations from store to avoid stale closure when updates happen
            // in quick succession (e.g. typing min then max before debounced re-render)
            const currentField = formStore.getState().schema.sections.flatMap((s: any) => s.fields).find((f: any) => f.id === selectedField.id);
            const currentValidations: FieldValidations = currentField?.validations ? { ...currentField.validations } : { ...validationsObj };
            const newValidations: FieldValidations = { ...currentValidations, ...updates };
            // Remove undefined/null only - use explicit checks to preserve valid numeric 0
            Object.keys(newValidations).forEach(key => {
                const v = newValidations[key as keyof FieldValidations];
                if (v === undefined || v === null) {
                    delete newValidations[key as keyof FieldValidations];
                }
            });
            formStore.getState().updateField(selectedField.id, { validations: newValidations });
        };

        const getValidationsValue = (key: keyof FieldValidations): string => {
            const value = validationsObj[key];
            if (value === undefined || value === null) return '';
            if (typeof value === 'number') return String(value);
            if (typeof value === 'boolean') return String(value);
            return String(value);
        };

        // Collect validation rule elements
        const validationElements: HTMLElement[] = [];

        // --- Number field validation ---
        if (selectedField.type === 'number') {
            // Validation Type for number (amount)
            const numValidationTypeGroup = createElement('div', { className: 'mb-3' });
            numValidationTypeGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Validation Type' }));
            const numValidationTypeSelect = createElement('select', {
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                onchange: (e: Event) => {
                    const presetId = (e.target as HTMLSelectElement).value;
                    if (presetId) {
                        const preset = VALIDATION_TYPE_PRESETS[presetId];
                        if (preset && presetId === 'amount') {
                            updateValidations({ ...preset, validationType: presetId as FieldValidations['validationType'] });
                        }
                    } else {
                        updateValidations({ validationType: 'custom' });
                    }
                }
            });
            [
                { value: '', text: 'Custom' },
                { value: 'amount', text: 'Amount (min 0, 2 decimals)' }
            ].forEach(opt => {
                numValidationTypeSelect.appendChild(createElement('option', {
                    value: opt.value,
                    text: opt.text,
                    selected: validationsObj.validationType === opt.value || (!validationsObj.validationType && opt.value === '')
                }));
            });
            numValidationTypeGroup.appendChild(numValidationTypeSelect);
            validationElements.push(numValidationTypeGroup);

            const minValGroup = createElement('div', { className: 'mb-3' });
            minValGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Min Value' }));
            minValGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: getValidationsValue('min') || '',
                placeholder: 'e.g. 0',
                oninput: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({ min: val !== '' ? parseFloat(val) : undefined });
                }
            }));
            validationElements.push(minValGroup);

            const maxValGroup = createElement('div', { className: 'mb-3' });
            maxValGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Max Value' }));
            maxValGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: getValidationsValue('max') || '',
                placeholder: 'e.g. 100',
                oninput: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({ max: val !== '' ? parseFloat(val) : undefined });
                }
            }));
            validationElements.push(maxValGroup);

            validationElements.push(this.createCheckboxField(
                'Allow Decimal',
                validationsObj.allowDecimal === true,
                (checked) => updateValidations({
                    allowDecimal: checked,
                    // When unchecked, remove decimalPlaces so it's not in the payload
                    decimalPlaces: checked ? (validationsObj.decimalPlaces ?? 2) : undefined
                }),
                `allow-decimal-${selectedField.id}`
            ));

            const decimalPlacesGroup = createElement('div', { className: 'mb-3' });
            decimalPlacesGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Decimal Places' }));
            const decimalPlacesInput = createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent disabled:opacity-50 disabled:cursor-not-allowed',
                value: validationsObj.allowDecimal === true ? String(validationsObj.decimalPlaces ?? 2) : '',
                placeholder: 'e.g. 2',
                min: '0',
                max: '10',
                disabled: validationsObj.allowDecimal !== true,
                oninput: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({ decimalPlaces: val !== '' ? parseInt(val) : undefined });
                }
            });
            decimalPlacesGroup.appendChild(decimalPlacesInput);
            validationElements.push(decimalPlacesGroup);

            validationElements.push(this.createCheckboxField(
                'Allow Negative',
                validationsObj.allowNegative === true,
                (checked) => updateValidations({ allowNegative: checked }),
                `allow-negative-${selectedField.id}`
            ));
        }

        // Min/Max Length (Text/Textarea/Email/Phone - numeric use-case: postal, phone, OTP)
        if (['text', 'textarea', 'email', 'phone'].includes(selectedField.type)) {
            // Validation Type dropdown (for text-based numeric fields: postal, phone, OTP)
            if (selectedField.type === 'text' || selectedField.type === 'phone') {
                const validationTypeGroup = createElement('div', { className: 'mb-3' });
                validationTypeGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Validation Type' }));
                const validationTypeSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                    onchange: (e: Event) => {
                        const presetId = (e.target as HTMLSelectElement).value;
                        if (presetId) {
                            const preset = VALIDATION_TYPE_PRESETS[presetId];
                            if (preset) {
                                updateValidations({ ...preset, validationType: presetId as FieldValidations['validationType'] });
                            }
                        } else {
                            updateValidations({ validationType: 'custom' });
                        }
                    }
                });
                const options = [
                    { value: '', text: 'Custom' },
                    { value: 'postalCode', text: 'Postal Code (6 digit)' },
                    { value: 'phoneNumber', text: 'Phone Number (10 digit)' },
                    { value: 'otp', text: 'OTP (4/6 digit)' }
                ];
                options.forEach(opt => {
                    validationTypeSelect.appendChild(createElement('option', {
                        value: opt.value,
                        text: opt.text,
                        selected: validationsObj.validationType === opt.value || (!validationsObj.validationType && opt.value === '')
                    }));
                });
                validationTypeGroup.appendChild(validationTypeSelect);
                validationElements.push(validationTypeGroup);
            }

            const minLenGroup = createElement('div', { className: 'mb-3' });
            minLenGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Min Length' }));
            minLenGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: getValidationsValue('minLength') || '',
                placeholder: 'e.g. 3',
                oninput: (e: Event) => {
                    const value = (e.target as HTMLInputElement).value;
                    updateValidations({ minLength: value !== '' ? parseInt(value) : undefined });
                }
            }));
            validationElements.push(minLenGroup);

            const maxLenGroup = createElement('div', { className: 'mb-3' });
            maxLenGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Max Length' }));
            maxLenGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: getValidationsValue('maxLength') || '',
                placeholder: 'e.g. 100',
                oninput: (e: Event) => {
                    const value = (e.target as HTMLInputElement).value;
                    updateValidations({ maxLength: value !== '' ? parseInt(value) : undefined });
                }
            }));
            validationElements.push(maxLenGroup);

            // Regex (with preset support for text fields, special handling for email fields)
            const regexGroup = createElement('div', { className: 'mb-3' });
            regexGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Regex Pattern' }));

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

            const currentRegex = validationsObj.pattern || (selectedField.validation as ValidationObject)?.regex || '';

            // Find current preset based on regex pattern
            const findPresetByRegex = (regex: string): RegexPreset | undefined => {
                return REGEX_PRESETS.find(preset => preset.pattern === regex);
            };

            const regexMessage = validationsObj.customErrorMessages?.pattern || (selectedField.validation as ValidationObject)?.regexMessage || 'Invalid format';
            let currentPreset: RegexPreset | undefined = currentRegex ? findPresetByRegex(currentRegex) : undefined;
            let selectedPresetId: string = currentPreset?.id || '';

            // Declare regexInput variable first so it can be referenced in presetSelect handler
            let regexInput: HTMLElement;

            // Regex Presets dropdown (only for text fields)
            if (selectedField.type === 'text') {
                const presetGroup = createElement('div', { className: 'mb-2' });
                presetGroup.appendChild(createElement('label', { className: 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1', text: 'Regex Presets (Optional)' }));

                const presetSelect = createElement('select', {
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent text-sm',
                    value: selectedPresetId,
                    onchange: (e: Event) => {
                        const presetId = (e.target as HTMLSelectElement).value;
                        selectedPresetId = presetId;
                        const preset = REGEX_PRESETS.find(p => p.id === presetId);

                        if (preset) {
                            updateValidations({
                                pattern: preset.pattern,
                                customErrorMessages: { ...validationsObj.customErrorMessages, pattern: preset.errorMessage }
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
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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

                    updateValidations({
                        pattern: val || undefined,
                        customErrorMessages: { ...validationsObj.customErrorMessages, pattern: currentPreset?.errorMessage || regexMessage || 'Invalid format' }
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

            // Pattern error message (inline with regex)
            const patternMsgGroup = createElement('div', { className: 'mb-3 mt-2' });
            patternMsgGroup.appendChild(createElement('label', { className: 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1', text: 'Pattern Error Message' }));
            patternMsgGroup.appendChild(createElement('input', {
                type: 'text',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent text-sm',
                value: validationsObj.customErrorMessages?.pattern || '',
                placeholder: 'e.g. Invalid format',
                oninput: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({
                        customErrorMessages: { ...validationsObj.customErrorMessages, pattern: val || undefined }
                    });
                }
            }));
            regexGroup.appendChild(patternMsgGroup);
            validationElements.push(regexGroup);
        }

        // Custom Error Messages (for fields with validation)
        // These are typically handled via HTML5 min/max attributes, but we can add them if needed
        // For now, skipping as they're not in the standard validation object

        // Min/Max Selected (Checkbox)
        if (selectedField.type === 'checkbox') {
            const minSelectedGroup = createElement('div', { className: 'mb-3' });
            minSelectedGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Min Selected' }));
            minSelectedGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: getValidationsValue('minSelected'),
                placeholder: 'e.g. 1',
                min: '0',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({ minSelected: val ? parseInt(val) : undefined });
                }
            }));
            validationElements.push(minSelectedGroup);

            const maxSelectedGroup = createElement('div', { className: 'mb-3' });
            maxSelectedGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Max Selected' }));
            maxSelectedGroup.appendChild(createElement('input', {
                type: 'number',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: getValidationsValue('maxSelected'),
                placeholder: 'e.g. 2',
                min: '1',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({ maxSelected: val ? parseInt(val) : undefined });
                }
            }));
            validationElements.push(maxSelectedGroup);
        }

        // Min/Max Date (Date)
        if (selectedField.type === 'date') {
            const minDateGroup = createElement('div', { className: 'mb-3' });
            minDateGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Minimum Date' }));
            minDateGroup.appendChild(createElement('input', {
                type: 'date',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: validationsObj.minDate || '',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({ minDate: val || undefined });
                }
            }));
            validationElements.push(minDateGroup);

            const maxDateGroup = createElement('div', { className: 'mb-3' });
            maxDateGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Maximum Date' }));
            maxDateGroup.appendChild(createElement('input', {
                type: 'date',
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
                value: validationsObj.maxDate || '',
                onchange: (e: Event) => {
                    const val = (e.target as HTMLInputElement).value;
                    updateValidations({ maxDate: val || undefined });
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
        paddingGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Padding' }));
        const paddingSelect = createElement('select', {
            className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm',
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
        bgColorGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Background Color' }));
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
        alignGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Text Alignment' }));
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
        cssClassGroup.appendChild(createElement('label', { className: 'block text-sm font-normal text-gray-700 dark:text-gray-300 mb-1', text: 'Custom CSS Class' }));
        cssClassGroup.appendChild(createElement('input', {
            type: 'text',
            className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent text-sm',
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
            className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent text-xs font-mono',
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
                className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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
                    className: 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-transparent',
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
