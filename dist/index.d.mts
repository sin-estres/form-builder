import { z } from 'zod';
import React from 'react';
import * as zustand from 'zustand';
export { registerWebComponents } from './web-components.mjs';

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

declare const FormBuilder: React.FC;

interface FormRendererProps {
    schema: FormSchema;
    onSubmit?: (data: Record<string, any>) => void;
    className?: string;
}
declare const FormRenderer: React.FC<FormRendererProps>;

interface FormState {
    schema: FormSchema;
    selectedFieldId: string | null;
    history: FormSchema[];
    historyIndex: number;
    isPreviewMode: boolean;
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
declare const useFormStore: zustand.UseBoundStore<zustand.StoreApi<FormState>>;

export { FieldType, FieldWidth, FormBuilder, FormField, FormRenderer, FormSchema, FormSchemaValidation, FormSection, ValidationRule, useFormStore };
