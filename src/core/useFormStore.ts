import { createStore } from 'zustand/vanilla';
import { FormSchema, FormSection, FormField, FieldType } from './schemaTypes';
import { generateId, DEFAULT_FIELD_CONFIG } from './constants';
import { cloneForm, cloneSection } from '../utils/clone';

interface FormState {
    schema: FormSchema;
    selectedFieldId: string | null;
    history: FormSchema[];
    historyIndex: number;
    isPreviewMode: boolean;
    existingForms: FormSchema[];
    templates: FormSection[];
}

interface FormActions {
    setSchema: (schema: FormSchema) => void;
    togglePreview: () => void;

    // New Actions
    setExistingForms: (forms: FormSchema[]) => void;
    setTemplates: (templates: FormSection[]) => void;
    loadForm: (formId: string) => void;
    cloneExistingForm: (formId: string) => void;
    importSection: (section: FormSection) => void;

    addSection: () => void;
    removeSection: (sectionId: string) => void;
    updateSection: (sectionId: string, updates: Partial<FormSection>) => void;
    moveSection: (oldIndex: number, newIndex: number) => void;

    addField: (sectionId: string, type: FieldType, index?: number) => void;
    removeField: (fieldId: string) => void;
    updateField: (fieldId: string, updates: Partial<FormField>) => void;
    selectField: (fieldId: string | null) => void;
    moveField: (fieldId: string, targetSectionId: string, newIndex: number) => void;

    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
}

const INITIAL_SCHEMA: FormSchema = {
    id: 'form_1',
    title: 'My New Form',
    formName: 'myNewForm',
    sections: [
        {
            id: generateId(),
            title: 'Section 1',
            fields: [],
        },
    ],
};

export const formStore = createStore<FormState & FormActions>((set, get) => ({
    schema: INITIAL_SCHEMA,
    selectedFieldId: null,
    history: [INITIAL_SCHEMA],
    historyIndex: 0,
    isPreviewMode: false,
    existingForms: [],
    templates: [],

    setSchema: (schema) => set({ schema }),
    togglePreview: () => set((state) => ({ isPreviewMode: !state.isPreviewMode })),

    // New Actions
    setExistingForms: (forms) => set({ existingForms: forms }),
    setTemplates: (templates) => set({ templates }),

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

        const newSchema = {
            ...schema,
            sections: schema.sections.map((s) => {
                if (s.id === sectionId) {
                    const newFields = [...s.fields];
                    if (typeof index === 'number') {
                        newFields.splice(index, 0, newField);
                    } else {
                        newFields.push(newField);
                    }
                    return { ...s, fields: newFields };
                }
                return s;
            }),
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
