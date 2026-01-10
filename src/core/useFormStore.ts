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

        // Populate options for fields with groupName or masterTypeName from masterTypes
        const state = get();
        if (state.masterTypes && state.masterTypes.length > 0 && cleanedSchema.sections) {
            const updatedSections = cleanedSchema.sections.map(section => ({
                ...section,
                fields: section.fields.map(field => {
                    // Hydrate dropdown fields that have masterTypeName or groupName
                    if (field.type === 'select') {
                        let masterType: MasterType | undefined;
                        let updatedField = { ...field };

                        // Case 1: Field has masterTypeName but no groupName - resolve groupName from masterType
                        if (field.masterTypeName && !field.groupName) {
                            masterType = state.masterTypes.find(mt =>
                                mt.active === true &&
                                mt.enumName === field.masterTypeName
                            );

                            if (masterType) {
                                // Set groupName from master type to preserve group binding
                                updatedField = {
                                    ...updatedField,
                                    groupName: {
                                        id: masterType.id,
                                        name: masterType.name
                                    }
                                };
                            }
                        }
                        // Case 2: Field has groupName - find master type by groupName
                        else if (field.groupName) {
                            masterType = state.masterTypes.find(mt =>
                                mt.active === true &&
                                (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                            );

                            // If masterTypeName is missing but groupName exists, set masterTypeName from master type
                            if (masterType && !field.masterTypeName && masterType.enumName) {
                                updatedField = {
                                    ...updatedField,
                                    masterTypeName: masterType.enumName
                                };
                            }
                        }
                        // Case 3: Field has masterTypeName and groupName - verify they match
                        else if (field.masterTypeName && field.groupName) {
                            masterType = state.masterTypes.find(mt =>
                                mt.active === true &&
                                mt.enumName === field.masterTypeName &&
                                (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                            );

                            if (!masterType) {
                                // Try to resolve by masterTypeName only
                                masterType = state.masterTypes.find(mt =>
                                    mt.active === true &&
                                    mt.enumName === field.masterTypeName
                                );

                                if (masterType) {
                                    // Update groupName to match masterTypeName
                                    updatedField = {
                                        ...updatedField,
                                        groupName: {
                                            id: masterType.id,
                                            name: masterType.name
                                        }
                                    };
                                }
                            }
                        }

                        // Load options from dropdownOptionsMap or master type indexes
                        if (masterType) {
                            let options: { label: string; value: string }[] = [];

                            // Priority 1: Check dropdownOptionsMap first (Angular integration)
                            if (masterType.enumName && state.dropdownOptionsMap && state.dropdownOptionsMap[masterType.enumName]) {
                                options = state.dropdownOptionsMap[masterType.enumName];
                            }
                            // Priority 2: Use master type indexes
                            else if (masterType.indexes && masterType.indexes.length > 0) {
                                options = convertIndexesToOptions(masterType.indexes);
                            }
                            // Priority 3: No options available - options array remains empty

                            // Update options if they don't exist, are empty, or are default placeholder options
                            // Always update if we loaded from dropdownOptionsMap or master type indexes
                            if (options.length > 0) {
                                if (!updatedField.options || updatedField.options.length === 0 || areDefaultOptions(updatedField.options)) {
                                    updatedField = {
                                        ...updatedField,
                                        options
                                    };
                                }
                            }
                        }

                        return updatedField;
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
                    // Hydrate dropdown fields that have masterTypeName or groupName
                    if (field.type === 'select') {
                        let masterType: MasterType | undefined;

                        // Check for masterTypeName first
                        if (field.masterTypeName) {
                            masterType = state.masterTypes.find(mt =>
                                mt.active === true &&
                                mt.enumName === field.masterTypeName
                            );
                        }
                        // Fallback to groupName
                        else if (field.groupName) {
                            masterType = state.masterTypes.find(mt =>
                                mt.active === true &&
                                (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                            );
                        }

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
                    if (field.type === 'select') {
                        let masterType: MasterType | undefined;

                        // Check for masterTypeName first
                        if (field.masterTypeName) {
                            masterType = state.masterTypes.find(mt =>
                                mt.active === true &&
                                mt.enumName === field.masterTypeName
                            );
                        }
                        // Fallback to groupName
                        else if (field.groupName) {
                            masterType = state.masterTypes.find(mt =>
                                mt.active === true &&
                                (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                            );
                        }

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
                    // Hydrate dropdown fields that have masterTypeName or groupName
                    if (field.type === 'select') {
                        let masterType: MasterType | undefined;
                        let updatedField = { ...field };

                        // Check for masterTypeName first
                        if (field.masterTypeName) {
                            masterType = masterTypes.find(mt =>
                                mt.active === true &&
                                mt.enumName === field.masterTypeName
                            );

                            // If masterType found but groupName is missing, set it
                            if (masterType && !field.groupName) {
                                updatedField = {
                                    ...updatedField,
                                    groupName: {
                                        id: masterType.id,
                                        name: masterType.name
                                    }
                                };
                            }
                        }
                        // Fallback to groupName
                        else if (field.groupName) {
                            masterType = masterTypes.find(mt =>
                                mt.active === true &&
                                (mt.id === field.groupName?.id || mt.name === field.groupName?.name)
                            );

                            // If masterType found but masterTypeName is missing, set it
                            if (masterType && !field.masterTypeName && masterType.enumName) {
                                updatedField = {
                                    ...updatedField,
                                    masterTypeName: masterType.enumName
                                };
                            }
                        }

                        if (masterType && masterType.indexes && masterType.indexes.length > 0) {
                            // Replace options if they don't exist, are empty, or are default placeholder options
                            if (!updatedField.options || updatedField.options.length === 0 || areDefaultOptions(updatedField.options)) {
                                const options = convertIndexesToOptions(masterType.indexes);
                                return { ...updatedField, options };
                            }
                        }

                        return updatedField;
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
                fields: s.fields.map((f) => {
                    if (f.id !== fieldId) return f;

                    // Deep merge css object to preserve existing values
                    let mergedUpdates = { ...updates };
                    if (updates.css !== undefined) {
                        // Check if 'style' key was explicitly passed (even if undefined)
                        const styleKeyPassed = updates.css && 'style' in updates.css;

                        let newStyle: Record<string, string> | undefined;
                        if (styleKeyPassed) {
                            if (updates.css.style === undefined || updates.css.style === null) {
                                // Explicitly clearing style
                                newStyle = undefined;
                            } else if (typeof updates.css.style === 'object') {
                                // Check if only 'style' is in the update (no 'class')
                                // This indicates it's from updateStyleProp which provides the complete style object
                                // In this case, we should REPLACE, not merge
                                const onlyStyleInUpdate = !('class' in updates.css) || updates.css.class === undefined;
                                if (onlyStyleInUpdate) {
                                    // Replace style completely (from updateStyleProp)
                                    newStyle = updates.css.style;
                                } else {
                                    // Merge with existing style (from other sources like CSS textarea)
                                    newStyle = { ...(f.css?.style || {}), ...updates.css.style };
                                }
                            } else {
                                newStyle = updates.css.style;
                            }
                        } else {
                            // style key not passed, preserve existing
                            newStyle = f.css?.style;
                        }

                        mergedUpdates.css = {
                            ...(f.css || {}),
                            ...updates.css,
                            style: newStyle
                        };

                        // Clean up undefined/empty values
                        if (!mergedUpdates.css.class) delete mergedUpdates.css.class;
                        if (!mergedUpdates.css.style || Object.keys(mergedUpdates.css.style).length === 0) {
                            delete mergedUpdates.css.style;
                        }
                        // Remove css entirely if empty
                        if (Object.keys(mergedUpdates.css).length === 0) {
                            mergedUpdates.css = undefined;
                        }
                    }

                    return { ...f, ...mergedUpdates };
                }),
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
