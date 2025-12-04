import { z } from 'zod';
import * as zustand_vanilla from 'zustand/vanilla';

type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'toggle' | 'file' | 'email' | 'phone';
type FieldWidth = '25%' | '50%' | '100%';
interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email';
    value?: string | number | boolean;
    message?: string;
}
interface FormField {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
    options?: {
        label: string;
        value: string;
    }[];
    validation?: ValidationRule[];
    width: FieldWidth;
    hidden?: boolean;
}
interface FormSection {
    id: string;
    title: string;
    fields: FormField[];
    isExpanded?: boolean;
}
interface FormSchema {
    id: string;
    title: string;
    sections: FormSection[];
}
declare const FormSchemaValidation: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    sections: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        fields: z.ZodArray<z.ZodAny, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        fields: any[];
    }, {
        id: string;
        title: string;
        fields: any[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    sections: {
        id: string;
        title: string;
        fields: any[];
    }[];
}, {
    id: string;
    title: string;
    sections: {
        id: string;
        title: string;
        fields: any[];
    }[];
}>;

declare class FormBuilder {
    private container;
    private unsubscribe;
    constructor(container: HTMLElement);
    private setupSubscriptions;
    destroy(): void;
    private render;
    private renderToolbar;
    private renderToolbox;
    private renderCanvas;
    private renderConfigPanel;
    private initSortable;
}

declare class FormRenderer {
    private container;
    private schema;
    private data;
    private onSubmit?;
    constructor(container: HTMLElement, schema: FormSchema, onSubmit?: (data: any) => void);
    setSchema(schema: FormSchema): void;
    private render;
}

interface FormState {
    schema: FormSchema;
    selectedFieldId: string | null;
    history: FormSchema[];
    historyIndex: number;
    isPreviewMode: boolean;
}
interface FormActions {
    setSchema: (schema: FormSchema) => void;
    togglePreview: () => void;
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
declare const formStore: zustand_vanilla.StoreApi<FormState & FormActions>;

export { FieldType, FieldWidth, FormBuilder, FormField, FormRenderer, FormSchema, FormSchemaValidation, FormSection, ValidationRule, formStore };
