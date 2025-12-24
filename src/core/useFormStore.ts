import { createStore } from 'zustand/vanilla';
import { FormSchema, FormSection, FormField, FieldType } from './schemaTypes';
import { generateId, DEFAULT_FIELD_CONFIG } from './constants';
import { cloneForm, cloneSection, cloneField } from '../utils/clone';
import { cleanFormSchema } from '../utils/mapper';

export interface MasterType {
    id: string;
    name: string;
    displayName: string;
    enumName?: string;
    indexes?: any[];
    active: boolean;
}

interface FormState {
    schema: FormSchema;
    selectedFieldId: string | null;
    history: FormSchema[];
    historyIndex: number;
    isPreviewMode: boolean;
    existingForms: FormSchema[];
    templates: FormSection[];
    masterTypes: MasterType[];
    dropdownOptionsMap: {
        [groupEnumName: string]: {
            label: string;
            value: string;
        }[];
    };
}

interface FormActions {
    setSchema: (schema: FormSchema) => void;
    togglePreview: () => void;

    // New Actions
    setExistingForms: (forms: FormSchema[]) => void;
    setTemplates: (templates: FormSection[]) => void;
    setMasterTypes: (masterTypes: MasterType[]) => void;
    setDropdownOptionsMap: (map: { [groupEnumName: string]: { label: string; value: string }[] }) => void;
    loadForm: (formId: string) => void;
    cloneExistingForm: (formId: string) => void;
    importSection: (section: FormSection) => void;

    addSection: () => void;
    removeSection: (sectionId: string) => void;
    updateSection: (sectionId: string, updates: Partial<FormSection>) => void;
    moveSection: (oldIndex: number, newIndex: number) => void;

    addField: (sectionId: string | null, type: FieldType, index?: number) => void;
    removeField: (fieldId: string) => void;
    updateField: (fieldId: string, updates: Partial<FormField>) => void;
    selectField: (fieldId: string | null) => void;
    moveField: (fieldId: string, targetSectionId: string | null, newIndex: number) => void;

    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    addTemplateFields: (targetSectionId: string, template: FormSection, index?: number) => void;
}

const INITIAL_SCHEMA: FormSchema = {
    id: 'form_1',
    title: 'My New Form',
    formName: 'myNewForm',
    sections: [],
};

export const formStore = createStore<FormState & FormActions>((set, get) => ({
    schema: INITIAL_SCHEMA,
    selectedFieldId: null,
    history: [INITIAL_SCHEMA],
    historyIndex: 0,
    isPreviewMode: false,
    existingForms: [],
    templates: [],
    masterTypes: [],
    dropdownOptionsMap: {},

    setSchema: (schema) => {
        // Clean schema: remove invalid properties and normalize field types
        const cleanedSchema = cleanFormSchema(schema);

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
            // Check if options match default pattern: "Option 1", "Option 2", etc.
            return options.every((opt, idx) => 
                opt.label === `Option ${idx + 1}` && 
                (opt.value === `opt${idx + 1}` || opt.value === `Option ${idx + 1}`)
            );
        };

        // Populate options for fields with groupName from masterTypes
        const state = get();
        if (state.masterTypes && state.masterTypes.length > 0 && cleanedSchema.sections) {
            const updatedSections = cleanedSchema.sections.map(section => ({
                ...section,
                fields: section.fields.map(field => {
                    // Always populate options from master types if groupName exists and options are missing or default
                    if (field.type === 'select' && field.groupName) {
                        const masterType = state.masterTypes.find(mt => 
                            mt.active === true && 
                            (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                        );
                        if (masterType) {
                            // Check dropdownOptionsMap first (Angular integration)
                            if (masterType.enumName && state.dropdownOptionsMap && state.dropdownOptionsMap[masterType.enumName]) {
                                return { ...field, options: state.dropdownOptionsMap[masterType.enumName] };
                            }
                            
                            if (!masterType.indexes || masterType.indexes.length === 0) {
                                console.warn(`[FormBuilder] Master type "${masterType.displayName}" (${masterType.name}) has empty indexes array. Dropdown will have no options. Please ensure the API returns populated indexes.`, {
                                    masterTypeId: masterType.id,
                                    masterTypeName: masterType.name,
                                    enumName: masterType.enumName,
                                    indexes: masterType.indexes
                                });
                            }
                            
                            if (masterType.indexes && masterType.indexes.length > 0) {
                                // Replace options if they don't exist, are empty, or are default placeholder options
                                if (!field.options || field.options.length === 0 || areDefaultOptions(field.options)) {
                                    const options = convertIndexesToOptions(masterType.indexes);
                                    console.log(`[FormBuilder] Populating ${options.length} options from master type "${masterType.displayName}"`);
                                    return { ...field, options };
                                }
                            }
                        } else {
                            console.warn('[FormBuilder] Master type not found for groupName:', field.groupName);
                        }
                    }
                    return field;
                })
            }));
            set({ schema: { ...cleanedSchema, sections: updatedSections } });
        } else {
            set({ schema: cleanedSchema });
        }
    },
    togglePreview: () => {
        const state = get();
        // Before toggling preview, ensure options are populated for fields with groupName
        if (state.masterTypes && state.masterTypes.length > 0 && state.schema.sections) {
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
                // Check if options match default pattern: "Option 1", "Option 2", etc.
                return options.every((opt, idx) => 
                    opt.label === `Option ${idx + 1}` && 
                    (opt.value === `opt${idx + 1}` || opt.value === `Option ${idx + 1}`)
                );
            };

            const updatedSections = state.schema.sections.map(section => ({
                ...section,
                fields: section.fields.map(field => {
                    // Always populate options from master types if groupName exists and options are missing or default
                    if (field.type === 'select' && field.groupName) {
                        const masterType = state.masterTypes.find(mt => 
                            mt.active === true && 
                            (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                        );
                        if (masterType && masterType.indexes && masterType.indexes.length > 0) {
                            // Replace options if they don't exist, are empty, or are default placeholder options
                            if (!field.options || field.options.length === 0 || areDefaultOptions(field.options)) {
                                const options = convertIndexesToOptions(masterType.indexes);
                                return { ...field, options };
                            }
                        }
                    }
                    return field;
                })
            }));
            
            // Check if any fields were updated
            const hasChanges = updatedSections.some((section, idx) => 
                section.fields.some((field, fieldIdx) => 
                    field !== state.schema.sections[idx]?.fields[fieldIdx]
                )
            );
            
            if (hasChanges) {
                set({ 
                    schema: { ...state.schema, sections: updatedSections },
                    isPreviewMode: !state.isPreviewMode 
                });
            } else {
                set({ isPreviewMode: !state.isPreviewMode });
            }
        } else {
            set({ isPreviewMode: !state.isPreviewMode });
        }
    },

    // New Actions
    setExistingForms: (forms) => set({ existingForms: forms }),
    setTemplates: (templates) => set({ templates }),
    setDropdownOptionsMap: (map) => {
        set({ dropdownOptionsMap: map });
        // Update field options when dropdownOptionsMap changes
        const state = get();
        if (state.schema && state.schema.sections) {
            const updatedSections = state.schema.sections.map(section => ({
                ...section,
                fields: section.fields.map(field => {
                    if (field.type === 'select' && field.groupName) {
                        // Find the master type to get enumName
                        const masterType = state.masterTypes.find(mt => 
                            mt.active === true && 
                            (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                        );
                        if (masterType && masterType.enumName && map[masterType.enumName]) {
                            return { ...field, options: map[masterType.enumName] };
                        }
                    }
                    return field;
                })
            }));
            set({ schema: { ...state.schema, sections: updatedSections } });
        }
    },
    setMasterTypes: (masterTypes) => {
        set({ masterTypes });
        // Populate options for fields with groupName when masterTypes are set
        const state = get();
        if (state.schema && state.schema.sections) {
            // Helper function to convert master type indexes to options format
            const convertIndexesToOptions = (indexes: any[]): { label: string; value: string }[] => {
                if (!indexes || !Array.isArray(indexes) || indexes.length === 0) {
                    return [];
                }
                return indexes.map((item: any, index: number) => {
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
                // Check if options match default pattern: "Option 1", "Option 2", etc.
                return options.every((opt, idx) => 
                    opt.label === `Option ${idx + 1}` && 
                    (opt.value === `opt${idx + 1}` || opt.value === `Option ${idx + 1}`)
                );
            };

            const updatedSections = state.schema.sections.map(section => ({
                ...section,
                fields: section.fields.map(field => {
                    // Always populate options from master types if groupName exists and options are missing or default
                    if (field.type === 'select' && field.groupName) {
                        const masterType = masterTypes.find(mt => 
                            mt.active === true && 
                            (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                        );
                        if (masterType && masterType.indexes && masterType.indexes.length > 0) {
                            // Replace options if they don't exist, are empty, or are default placeholder options
                            if (!field.options || field.options.length === 0 || areDefaultOptions(field.options)) {
                                const options = convertIndexesToOptions(masterType.indexes);
                                return { ...field, options };
                            }
                        }
                    }
                    return field;
                })
            }));
            // Check if any fields were updated
            const hasChanges = updatedSections.some((section, idx) => 
                section.fields.some((field, fieldIdx) => 
                    field !== state.schema.sections[idx]?.fields[fieldIdx]
                )
            );
            if (hasChanges) {
                set({ schema: { ...state.schema, sections: updatedSections } });
            }
        }
    },

    loadForm: (formId) => {
        const { existingForms, history, historyIndex } = get();
        const found = existingForms.find(f => f.id === formId);
        if (found) {
            set({
                schema: found,
                history: [...history.slice(0, historyIndex + 1), found],
                historyIndex: historyIndex + 1,
            });
        }
    },

    cloneExistingForm: (formId) => {
        const { existingForms, history, historyIndex } = get();
        const found = existingForms.find(f => f.id === formId);
        if (found) {
            const cloned = cloneForm(found); // Uses the new util
            set({
                schema: cloned,
                history: [...history.slice(0, historyIndex + 1), cloned],
                historyIndex: historyIndex + 1,
            });
        }
    },

    importSection: (section) => {
        const { schema, history, historyIndex } = get();
        const clonedSection = cloneSection(section); // Deep clone with new IDs
        const newSchema = { ...schema, sections: [...schema.sections, clonedSection] };

        set({
            schema: newSchema,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    addSection: () => {
        const { schema, history, historyIndex } = get();
        const newSection: FormSection = {
            id: generateId(),
            title: `Section ${schema.sections.length + 1}`,
            fields: [],
            columns: 1 // Default to 1 column
        };
        const newSchema = { ...schema, sections: [...schema.sections, newSection] };

        set({
            schema: newSchema,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    removeSection: (sectionId) => {
        const { schema, history, historyIndex } = get();
        const newSchema = {
            ...schema,
            sections: schema.sections.filter((s) => s.id !== sectionId),
        };
        set({
            schema: newSchema,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    updateSection: (sectionId, updates) => {
        const { schema, history, historyIndex } = get();
        const newSchema = {
            ...schema,
            sections: schema.sections.map((s) =>
                s.id === sectionId ? { ...s, ...updates } : s
            ),
        };
        set({
            schema: newSchema,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    moveSection: (oldIndex, newIndex) => {
        const { schema, history, historyIndex } = get();
        const newSections = [...schema.sections];
        const [movedSection] = newSections.splice(oldIndex, 1);
        newSections.splice(newIndex, 0, movedSection);

        const newSchema = { ...schema, sections: newSections };
        set({
            schema: newSchema,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    addField: (sectionId, type, index) => {
        const { schema, history, historyIndex } = get();
        const newField: FormField = {
            id: generateId(),
            type,
            ...DEFAULT_FIELD_CONFIG[type],
        } as FormField;

        let newSections = [...schema.sections];
        
        // If no sections exist or sectionId is null, create a default section
        if (newSections.length === 0 || sectionId === null) {
            const defaultSection: FormSection = {
                id: generateId(),
                title: 'Default Section',
                fields: [],
                columns: 1
            };
            newSections.push(defaultSection);
            sectionId = defaultSection.id;
        }

        // Find the section and add the field
        const sectionIndex = newSections.findIndex(s => s.id === sectionId);
        if (sectionIndex !== -1) {
            const section = newSections[sectionIndex];
            const newFields = [...section.fields];
            if (typeof index === 'number') {
                newFields.splice(index, 0, newField);
            } else {
                newFields.push(newField);
            }
            newSections[sectionIndex] = { ...section, fields: newFields };
        } else {
            // If sectionId was provided but not found, create a default section
            const defaultSection: FormSection = {
                id: generateId(),
                title: 'Default Section',
                fields: [newField],
                columns: 1
            };
            newSections.push(defaultSection);
        }

        const newSchema = {
            ...schema,
            sections: newSections,
        };

        set({
            schema: newSchema,
            selectedFieldId: newField.id,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    removeField: (fieldId) => {
        const { schema, history, historyIndex } = get();
        const newSchema = {
            ...schema,
            sections: schema.sections.map((s) => ({
                ...s,
                fields: s.fields.filter((f) => f.id !== fieldId),
            })),
        };
        set({
            schema: newSchema,
            selectedFieldId: null,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    updateField: (fieldId, updates) => {
        const { schema, history, historyIndex } = get();
        const newSchema = {
            ...schema,
            sections: schema.sections.map((s) => ({
                ...s,
                fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
            })),
        };
        set({
            schema: newSchema,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    selectField: (fieldId) => set({ selectedFieldId: fieldId }),

    moveField: (fieldId, targetSectionId, newIndex) => {
        const { schema, history, historyIndex } = get();

        // Find the field and remove it from its old position
        let field: FormField | undefined;
        const newSections = schema.sections.map(s => {
            const fIndex = s.fields.findIndex(f => f.id === fieldId);
            if (fIndex !== -1) {
                field = s.fields[fIndex];
                const newFields = [...s.fields];
                newFields.splice(fIndex, 1);
                return { ...s, fields: newFields };
            }
            return s;
        });

        if (!field) return;

        // If targetSectionId is null or no sections exist, create a default section
        if (targetSectionId === null || newSections.length === 0) {
            const defaultSection: FormSection = {
                id: generateId(),
                title: 'Default Section',
                fields: [],
                columns: 1
            };
            newSections.push(defaultSection);
            targetSectionId = defaultSection.id;
        }

        // Insert into new position
        const targetSectionIndex = newSections.findIndex(s => s.id === targetSectionId);
        if (targetSectionIndex !== -1) {
            const targetSection = newSections[targetSectionIndex];
            const newFields = [...targetSection.fields];
            newFields.splice(newIndex, 0, field);
            newSections[targetSectionIndex] = { ...targetSection, fields: newFields };
        }

        const newSchema = { ...schema, sections: newSections };
        set({
            schema: newSchema,
            history: [...history.slice(0, historyIndex + 1), newSchema],
            historyIndex: historyIndex + 1,
        });
    },

    addTemplateFields: (targetSectionId: string, template: FormSection, index?: number) => {
        set((state) => {
            const sectionIndex = state.schema.sections.findIndex(s => s.id === targetSectionId);
            if (sectionIndex === -1) return state;

            const section = state.schema.sections[sectionIndex];
            const newFields = template.fields.map(cloneField);

            const currentFields = [...section.fields];
            if (typeof index === 'number' && index >= 0) {
                currentFields.splice(index, 0, ...newFields);
            } else {
                currentFields.push(...newFields);
            }

            const newSection = { ...section, fields: currentFields };
            const newSections = [...state.schema.sections];
            newSections[sectionIndex] = newSection;

            return {
                schema: { ...state.schema, sections: newSections },
                history: [...state.history.slice(0, state.historyIndex + 1), { ...state.schema, sections: newSections }],
                historyIndex: state.historyIndex + 1
            };
        });
    },

    undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
            set({
                schema: history[historyIndex - 1],
                historyIndex: historyIndex - 1,
            });
        }
    },

    redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
            set({
                schema: history[historyIndex + 1],
                historyIndex: historyIndex + 1,
            });
        }
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,
}));
