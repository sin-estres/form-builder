import { create } from 'zustand';
import { FormSchema, FormSection, FormField, FieldType } from './schemaTypes';
import { generateId, DEFAULT_FIELD_CONFIG } from './constants';

interface FormState {
    schema: FormSchema;
    selectedFieldId: string | null;
    history: FormSchema[];
    historyIndex: number;
    isPreviewMode: boolean;

    // Actions
    setSchema: (schema: FormSchema) => void;
    togglePreview: () => void;
    addSection: () => void;
    removeSection: (sectionId: string) => void;
    updateSection: (sectionId: string, updates: Partial<FormSection>) => void;
    moveSection: (activeId: string, overId: string) => void;

    addField: (sectionId: string, type: FieldType, index?: number) => void;
    removeField: (fieldId: string) => void;
    updateField: (fieldId: string, updates: Partial<FormField>) => void;
    selectField: (fieldId: string | null) => void;
    moveField: (activeId: string, overId: string, activeSectionId: string, overSectionId: string) => void;

    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
}

const INITIAL_SCHEMA: FormSchema = {
    id: 'form_1',
    title: 'My New Form',
    sections: [
        {
            id: generateId(),
            title: 'Section 1',
            fields: [],
        },
    ],
};

export const useFormStore = create<FormState>((set, get) => ({
    schema: INITIAL_SCHEMA,
    selectedFieldId: null,
    history: [INITIAL_SCHEMA],
    historyIndex: 0,
    isPreviewMode: false,

    setSchema: (schema) => set({ schema }),
    togglePreview: () => set((state) => ({ isPreviewMode: !state.isPreviewMode })),

    addSection: () => {
        const { schema, history, historyIndex } = get();
        const newSection: FormSection = {
            id: generateId(),
            title: `Section ${schema.sections.length + 1}`,
            fields: [],
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

    moveSection: (activeId, overId) => {
        const { schema, history, historyIndex } = get();
        const oldIndex = schema.sections.findIndex(s => s.id === activeId);
        const newIndex = schema.sections.findIndex(s => s.id === overId);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

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

    moveField: (activeId, overId, activeSectionId, overSectionId) => {
        const { schema, history, historyIndex } = get();

        // Deep clone to avoid mutation issues
        const newSections = schema.sections.map(s => ({
            ...s,
            fields: [...s.fields]
        }));

        const activeSectionIndex = newSections.findIndex(s => s.id === activeSectionId);
        const overSectionIndex = newSections.findIndex(s => s.id === overSectionId);

        if (activeSectionIndex === -1 || overSectionIndex === -1) return;

        const activeSection = newSections[activeSectionIndex];
        const overSection = newSections[overSectionIndex];

        const activeFieldIndex = activeSection.fields.findIndex(f => f.id === activeId);
        const overFieldIndex = overSection.fields.findIndex(f => f.id === overId);

        if (activeFieldIndex === -1) return;

        // If moving within the same section
        if (activeSectionId === overSectionId) {
            if (activeFieldIndex === overFieldIndex) return;
            const [movedField] = activeSection.fields.splice(activeFieldIndex, 1);
            // If overFieldIndex is -1 (dropped on section container but not on a field), push to end? 
            // But dnd-kit usually gives us a valid overId if we are over a sortable.
            // If overId is the section itself, we might handle it differently.
            // For now assume overId is a field.
            activeSection.fields.splice(overFieldIndex, 0, movedField);
        } else {
            // Moving to different section
            const [movedField] = activeSection.fields.splice(activeFieldIndex, 1);

            // If overId is the section ID, append to end of that section
            if (overId === overSectionId) {
                overSection.fields.push(movedField);
            } else {
                // Insert before the target field
                // If overFieldIndex is -1, it might mean we are over the container.
                // We need to be careful here.
                const insertIndex = overFieldIndex >= 0 ? overFieldIndex : overSection.fields.length;
                overSection.fields.splice(insertIndex, 0, movedField);
            }
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
