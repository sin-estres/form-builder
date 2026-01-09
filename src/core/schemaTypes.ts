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

// FieldWidth now supports both legacy string percentages and numeric values (10-100)
// for the new slider control. String values are kept for backward compatibility.
export type FieldWidth = '25%' | '33%' | '50%' | '66%' | '75%' | '100%' | number;

// Helper function to parse FieldWidth to a numeric percentage
export function parseWidth(width: FieldWidth): number {
    if (typeof width === 'number') {
        return Math.max(10, Math.min(100, width));
    }
    return parseInt(width) || 100;
}

// Helper function to get col-span class from width
export function getColSpanFromWidth(width: FieldWidth): string {
    const numWidth = parseWidth(width);
    // Convert to 12-column grid (rounded to nearest column)
    const cols = Math.round((numWidth / 100) * 12);
    // Ensure at least 1 column, max 12
    const clampedCols = Math.max(1, Math.min(12, cols));
    return `col-span-${clampedCols}`;
}

export interface ValidationRule {
    type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'minDate' | 'maxDate';
    value?: string | number | boolean;
    message?: string;
    // For pattern/regex
    regex?: string;
}

export interface AsyncOptionSource {
    api: string;
    method: 'GET' | 'POST';
    labelKey: string;
    valueKey: string;
}

export interface FormField {
    id: string;
    type: FieldType;
    label: string;
    placeholder?: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
    options?: { label: string; value: string }[]; // For select, radio, checkbox
    optionsSource?: AsyncOptionSource; // For async select
    validation?: ValidationRule[];
    width: FieldWidth;
    hidden?: boolean; // For conditional logic later
    position?: { row: number; column: number }; // Future proofing for strict grid, currently width-based
    groupName?: { id: string; name: string }; // For dropdown fields - mapped from masterTypes
    masterTypeName?: string; // The enum name of the selected master type group (for Angular integration)
    enabled?: boolean; // Whether the field is enabled/disabled
    visible?: boolean; // Whether the field is visible/hidden
    // New properties
    customOptionsEnabled?: boolean; // For dropdown/checkbox/radio - enable custom options editing
    multiselect?: boolean; // For dropdown - enable multiple selection
}

export interface FormSection {
    id: string;
    title: string;
    fields: FormField[];
    isExpanded?: boolean;
    columns?: 1 | 2 | 3; // Grid columns layout
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
