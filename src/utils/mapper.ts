import { FormSchema, FormField, ValidationRule, ValidationObject } from '../core/schemaTypes';

/**
 * Converts validation object format to validation array format
 * Automatically sets required=true if any validation property exists
 * @param validationObj 
 * @returns Array of ValidationRule objects
 */
function convertValidationObjectToArray(validationObj: ValidationObject | ValidationRule[] | undefined): ValidationRule[] {
    if (!validationObj) return [];
    
    // If it's already an array, return as is
    if (Array.isArray(validationObj)) {
        return validationObj;
    }
    
    // Convert object to array
    const rules: ValidationRule[] = [];
    const obj = validationObj as ValidationObject;
    
    // Check if any validation property exists (excluding required itself)
    const hasValidationProperties = !!(
        obj.regex ||
        obj.regexMessage ||
        obj.minLength !== undefined ||
        obj.maxLength !== undefined ||
        obj.minSelected !== undefined ||
        obj.maxSelected !== undefined
    );
    
    // Auto-set required to true if any validation property exists
    const isRequired = obj.required === true || (hasValidationProperties && obj.required !== false);
    
    if (isRequired) {
        rules.push({ type: 'required', value: true });
    }
    
    if (obj.regex) {
        rules.push({
            type: 'pattern',
            regex: obj.regex,
            message: obj.regexMessage || 'Invalid format'
        });
    }
    
    if (obj.minLength !== undefined) {
        rules.push({ type: 'minLength', value: obj.minLength });
    }
    
    if (obj.maxLength !== undefined) {
        rules.push({ type: 'maxLength', value: obj.maxLength });
    }
    
    if (obj.minSelected !== undefined) {
        rules.push({ type: 'minSelected', value: obj.minSelected });
    }
    
    if (obj.maxSelected !== undefined) {
        rules.push({ type: 'maxSelected', value: obj.maxSelected });
    }
    
    return rules;
}

/**
 * Converts layout.span to width percentage
 * @param span Span value (1-12 typically)
 * @param totalColumns Total columns in grid (default 12)
 * @returns Width as percentage number
 */
function convertSpanToWidth(span: number | undefined, totalColumns: number = 12): number {
    if (!span) return 100; // Default to full width
    // Convert span to percentage: (span / totalColumns) * 100
    const percentage = (span / totalColumns) * 100;
    // Round to nearest integer and clamp between 10 and 100
    return Math.max(10, Math.min(100, Math.round(percentage)));
}

/**
 * Transforms new payload format to internal format
 * - Converts layout.span to width
 * - Converts validation object to validation array
 * - Auto-sets required=true if any validation property exists
 * - Maps multiSelect to multiselect
 * @param field 
 * @returns Transformed field
 */
function transformField(field: any): FormField {
    const transformed: any = {
        id: field.id,
        type: field.type === 'decimal' ? 'number' : field.type,
        label: field.label,
    };
    
    // Handle width: prefer layout.span, fallback to width
    if (field.layout?.span !== undefined) {
        transformed.width = convertSpanToWidth(field.layout.span, field.layout.columns || 12);
    } else if (field.width !== undefined) {
        transformed.width = field.width;
    } else {
        transformed.width = 100; // Default
    }
    
    // Preserve layout if it exists
    if (field.layout) {
        transformed.layout = field.layout;
    }
    
    // Handle validation: convert object to array and auto-set required
    if (field.validation) {
        transformed.validation = convertValidationObjectToArray(field.validation);
        // Also set required flag for backward compatibility
        const validationRules = transformed.validation;
        transformed.required = validationRules.some((r: ValidationRule) => r.type === 'required');
    } else if (field.required !== undefined) {
        transformed.required = field.required;
    }
    
    // Handle multiSelect for select fields - REQUIRED property
    // multiSelect determines if dropdown is single or multi-select
    if (field.type === 'select') {
        // multiSelect is required for select fields - default to false if not provided
        if (field.multiSelect !== undefined) {
            transformed.multiSelect = field.multiSelect;
            transformed.multiselect = field.multiSelect; // Also set legacy property for backward compatibility
        } else if (field.multiselect !== undefined) {
            transformed.multiSelect = field.multiselect;
            transformed.multiselect = field.multiselect;
        } else {
            // Default to false (single select) if not specified
            transformed.multiSelect = false;
            transformed.multiselect = false;
        }
    }
    
    // Handle optionSource - REQUIRED for select/radio/checkbox
    // STATIC = custom options, MASTER = from master types
    if (['select', 'radio', 'checkbox'].includes(field.type)) {
        if (field.optionSource) {
            transformed.optionSource = field.optionSource;
        } else {
            // Default to STATIC if not specified (for backward compatibility)
            // If field has masterTypeName or groupName, it's implicitly MASTER
            if (field.masterTypeName || field.groupName) {
                transformed.optionSource = 'MASTER';
            } else {
                transformed.optionSource = 'STATIC';
            }
        }
    }
    
    // Copy other optional properties
    if (field.placeholder !== undefined) transformed.placeholder = field.placeholder;
    if (field.description !== undefined) transformed.description = field.description;
    if (field.defaultValue !== undefined) transformed.defaultValue = field.defaultValue;
    if (field.hidden !== undefined) transformed.hidden = field.hidden;
    if (field.position !== undefined) transformed.position = field.position;
    if (field.enabled !== undefined) transformed.enabled = field.enabled;
    if (field.visible !== undefined) transformed.visible = field.visible;
    if (field.order !== undefined) transformed.order = field.order;
    if (field.css !== undefined) transformed.css = field.css; // Preserve CSS
    if (field.optionsSource !== undefined) transformed.optionsSource = field.optionsSource;
    if (field.customOptionsEnabled !== undefined) transformed.customOptionsEnabled = field.customOptionsEnabled;
    if (field.groupName !== undefined) transformed.groupName = field.groupName;
    if (field.masterTypeName !== undefined) transformed.masterTypeName = field.masterTypeName;
    
    // Only include options for select/radio/checkbox
    if ((field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && field.options) {
        transformed.options = field.options;
    }
    
    return transformed as FormField;
}

/**
 * Cleans a form schema by removing invalid properties and normalizing field types
 * - Converts "decimal" type to "number"
 * - Removes empty options arrays from non-select/radio fields
 * - Preserves masterTypeName for select fields with groupName
 * - Transforms new payload format (layout.span, validation object) to internal format
 * @param schema 
 * @returns Cleaned schema
 */
export const cleanFormSchema = (schema: any): FormSchema => {
    // Use the transformField function which handles both old and new formats
    const cleanField = transformField;

    return {
        id: schema.id,
        title: schema.title,
        formName: schema.formName,
        layout: schema.layout, // Preserve form-level layout
        sections: schema.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            fields: section.fields.map(cleanField),
            isExpanded: section.isExpanded,
            columns: section.columns,
            order: section.order, // Preserve section order
            layout: section.layout, // Preserve section layout
            css: section.css, // Preserve section CSS
        }))
    };
};

/**
 * Transforms Form Builder JSON to Platform JSON
 * @param builderSchema 
 * @returns 
 */
export const builderToPlatform = (builderSchema: FormSchema): any => {
    // Implement transformation logic here if platform format differs.
    // For now, we assume they are compatible or the platform adapts to builder.
    return builderSchema;
};

/**
 * Transforms Platform JSON to Form Builder JSON
 * @param platformSchema 
 * @returns 
 */
export const platformToBuilder = (platformSchema: any): FormSchema => {
    // Clean the schema when loading from platform
    return cleanFormSchema(platformSchema);
};
