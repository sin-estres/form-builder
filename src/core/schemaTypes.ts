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
    type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'minDate' | 'maxDate' | 'minSelected' | 'maxSelected';
    value?: string | number | boolean;
    message?: string;
    // For pattern/regex
    regex?: string;
}

// New validation object format (from payload) - this is the standard format
export interface ValidationObject {
    required?: boolean;
    regex?: string;
    regexMessage?: string;
    minLength?: number;
    maxLength?: number;
    minSelected?: number; // For checkbox/select groups
    maxSelected?: number; // For checkbox/select groups
    minDate?: string; // ISO date string
    maxDate?: string; // ISO date string
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
    fieldName?: string; // Model key for binding (API / preview); fallback to id when missing
    placeholder?: string;
    description?: string;
    required?: boolean;
    defaultValue?: any;
    options?: { label: string; value: string }[]; // For select, radio, checkbox
    optionsSource?: AsyncOptionSource; // For async select
    validation?: ValidationRule[] | ValidationObject; // Support both array and object formats
    width?: FieldWidth; // Legacy support - prefer layout.span
    hidden?: boolean; // For conditional logic later
    position?: { row: number; column: number }; // Legacy - use layout instead
    layout?: { row?: number; column?: number; span?: number }; // Grid layout format from payload (required)
    groupName?: { id: string; name: string }; // For dropdown fields - mapped from masterTypes
    masterTypeName?: string; // The enum name of the selected master type group (for Angular integration)
    enabled?: boolean; // Whether the field is enabled/disabled
    visible?: boolean; // Whether the field is visible/hidden
    order?: number; // Field order in section (required for drag-and-drop persistence)
    css?: { class?: string; style?: Record<string, string> }; // CSS styling from payload
    // New properties
    customOptionsEnabled?: boolean; // For dropdown/checkbox/radio - enable custom options editing (UI only)
    multiselect?: boolean; // For dropdown - enable multiple selection (legacy - use multiSelect instead)
    multiSelect?: boolean; // Multi-select for dropdown (required: true | false, not optional)
    optionSource?: 'STATIC' | 'MASTER' | 'LOOKUP'; // Option source type: STATIC = custom options, MASTER = from master types, LOOKUP = entity fields lookup
    // Lookup configuration (for LOOKUP optionSource)
    lookupSourceType?: 'MODULE' | 'MASTER_TYPE'; // Lookup source type: MODULE = from module list, MASTER_TYPE = from master types
    lookupSource?: string; // Selected module name or master type identifier
    lookupValueField?: string; // Field name to use as value in lookup
    lookupLabelField?: string; // Field name to use as label in lookup
    // Phone field ISD configuration
    isd?: ISDConfig;
}

/**
 * ISD (International Subscriber Dialing) configuration for phone fields
 */
export interface ISDConfig {
    enabled: boolean;           // Whether ISD selector is enabled (always true for phone)
    defaultCode: string;        // Default dial code, e.g., "+91"
    showFlag: boolean;          // Show country flag emoji in dropdown
    showCountryName: boolean;   // Show full country name in dropdown
    allowCustomCode: boolean;   // Allow manual ISD code entry (future feature)
}

export interface FormSection {
    id: string;
    title: string;
    fields: FormField[];
    isExpanded?: boolean;
    columns?: 1 | 2 | 3; // Legacy grid columns layout - prefer layout.columns
    order?: number; // Section order (required for drag-and-drop persistence)
    layout?: { type?: string; columns?: number; gap?: string }; // Section layout from payload (required)
    css?: { class?: string; style?: Record<string, string> }; // CSS styling from payload
}

export interface FormSchema {
    id: string;
    title: string;
    formName: string;
    sections: FormSection[];
    layout?: { type?: string; columns?: number; gap?: string }; // Form-level layout from payload
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
