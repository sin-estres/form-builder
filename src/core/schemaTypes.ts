import { z } from 'zod';

export type FieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'toggle' // switch
    | 'file'
    | 'email'
    | 'phone';

export type FieldWidth = '25%' | '50%' | '100%';

export interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email';
    value?: string | number | boolean;
    message?: string;
}

export interface FormField {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
    options?: { label: string; value: string }[]; // For select, radio
    validation?: ValidationRule[];
    width: FieldWidth;
    hidden?: boolean; // For conditional logic later
}

export interface FormSection {
    id: string;
    title: string;
    fields: FormField[];
    isExpanded?: boolean;
}

export interface FormSchema {
    id: string;
    title: string;
    formName: string;
    sections: FormSection[];
}

// Zod schema for validation (optional, but good for runtime checks if needed)
export const FormSchemaValidation = z.object({
    id: z.string(),
    title: z.string(),
    formName: z.string(),
    sections: z.array(z.object({
        id: z.string(),
        title: z.string(),
        fields: z.array(z.any()) // Deep validation can be added if needed
    }))
});
