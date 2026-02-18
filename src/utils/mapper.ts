import { FormSchema, FormField, ValidationRule, ValidationObject, FieldWidth, parseWidth } from '../core/schemaTypes';

/**
 * Converts validation object format to validation array format
 * Automatically sets required=true if any validation property exists
 * @param validationObj 
 * @returns Array of ValidationRule objects
 */
export function convertValidationObjectToArray(validationObj: ValidationObject | ValidationRule[] | undefined): ValidationRule[] {
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
 * Normalizes field type from various formats to lowercase
 * Handles: "SELECT" -> "select", "TEXT" -> "text", etc.
 */
function normalizeFieldType(type: any): string {
    if (!type) return 'text';
    const normalized = String(type).toLowerCase();
    // Handle special cases
    if (normalized === 'decimal') return 'number';
    return normalized;
}

/**
 * Transforms new payload format to internal format
 * - Converts width to layout.span (backward compatibility)
 * - Converts validation object to validation array (for internal use)
 * - Auto-sets required=true if any validation property exists
 * - Maps multiSelect (standard) and multiselect (legacy)
 * - Handles fieldId -> id and fieldType -> type conversions
 * - Handles nested lookup object -> flat lookup properties
 * - Ensures order is set
 * @param field 
 * @returns Transformed field
 */
function transformField(field: any): FormField {
    // Handle fieldId -> id conversion
    const fieldId = field.id || field.fieldId;
    
    // Handle fieldType -> type conversion with normalization
    const fieldType = field.type || field.fieldType;
    const normalizedType = normalizeFieldType(fieldType);
    
    const transformed: any = {
        id: fieldId,
        type: normalizedType,
        label: field.label,
    };

    // Handle layout: prefer layout.span, fallback to position object, then width conversion
    if (field.layout?.span !== undefined) {
        // Use layout.span directly
        transformed.layout = {
            row: field.layout.row ?? 0,
            column: field.layout.column ?? 0,
            span: field.layout.span
        };
        // Also set width for backward compatibility (internal use)
        transformed.width = convertSpanToWidth(field.layout.span, field.layout.columns || 12);
    } else if (field.position) {
        // Handle position object format: { row, column, width, order }
        // Convert width to span (assuming width is in columns 1-12)
        const positionWidth = field.position.width;
        const span = positionWidth !== undefined ? Math.max(1, Math.min(12, positionWidth)) : 12;
        transformed.layout = {
            row: field.position.row ?? 0,
            column: field.position.column ?? 0,
            span: span
        };
        transformed.width = convertSpanToWidth(span, 12);
        // Also preserve position for backward compatibility
        transformed.position = field.position;
        // Use order from position if available
        if (field.position.order !== undefined) {
            transformed.order = field.position.order;
        }
    } else if (field.width !== undefined) {
        // Backward compatibility: convert width to layout.span
        const widthNum = parseWidth(field.width);
        const span = Math.max(1, Math.min(12, Math.round((widthNum / 100) * 12)));
        transformed.layout = {
            row: 0,
            column: 0,
            span: span
        };
        transformed.width = field.width; // Keep for backward compatibility
    } else {
        // Default: full width (12 columns)
        transformed.layout = {
            row: 0,
            column: 0,
            span: 12
        };
        transformed.width = 100; // Default
    }

    // Preserve order if it exists, otherwise set to 0
    // Order might have been set from position object above
    if (transformed.order === undefined) {
        transformed.order = field.order !== undefined ? field.order : 0;
    }

    // Handle validation: support both object and array formats
    // Keep validation as object format internally (standard), but also support array for backward compatibility
    if (field.validation) {
        if (Array.isArray(field.validation)) {
            // Legacy array format - convert to object format
            const validationObj: ValidationObject = {};
            field.validation.forEach((rule: ValidationRule) => {
                if (rule.type === 'required') {
                    validationObj.required = true;
                } else if (rule.type === 'pattern' && rule.regex) {
                    validationObj.regex = rule.regex;
                    validationObj.regexMessage = rule.message || 'Invalid format';
                } else if (rule.type === 'minLength' && typeof rule.value === 'number') {
                    validationObj.minLength = rule.value;
                } else if (rule.type === 'maxLength' && typeof rule.value === 'number') {
                    validationObj.maxLength = rule.value;
                } else if (rule.type === 'minSelected' && typeof rule.value === 'number') {
                    validationObj.minSelected = rule.value;
                } else if (rule.type === 'maxSelected' && typeof rule.value === 'number') {
                    validationObj.maxSelected = rule.value;
                } else if (rule.type === 'minDate' && typeof rule.value === 'string') {
                    validationObj.minDate = rule.value;
                } else if (rule.type === 'maxDate' && typeof rule.value === 'string') {
                    validationObj.maxDate = rule.value;
                }
            });
            transformed.validation = validationObj;
            transformed.required = validationObj.required || false;
        } else {
            // Object format (standard)
            transformed.validation = field.validation as ValidationObject;
            transformed.required = field.validation.required || false;
        }
    } else if (field.required !== undefined) {
        transformed.required = field.required;
        // Create validation object with required flag
        transformed.validation = { required: field.required };
    }

    // Handle multiSelect for select fields - REQUIRED property
    // multiSelect determines if dropdown is single or multi-select
    // Standard: use multiSelect (not multiselect)
    if (normalizedType === 'select') {
        // multiSelect is required for select fields - default to false if not provided
        if (field.multiSelect !== undefined) {
            transformed.multiSelect = field.multiSelect;
            // Remove legacy multiselect property
            transformed.multiselect = undefined;
        } else if (field.multiselect !== undefined) {
            // Backward compatibility: migrate multiselect to multiSelect
            transformed.multiSelect = field.multiselect;
            transformed.multiselect = undefined; // Remove legacy property
        } else {
            // Default to false (single select) if not specified
            transformed.multiSelect = false;
        }
    }

    // Handle lookup object (nested format) -> flat properties conversion
    // Support both nested lookup object and flat lookup properties
    let lookupSourceType: string | undefined;
    let lookupSource: string | undefined;
    let lookupValueField: string | undefined;
    let lookupLabelField: string | undefined;
    
    if (field.lookup) {
        // Handle nested lookup object format
        // lookup: { sourceType, sourceKey, valueField, labelField }
        lookupSourceType = field.lookup.sourceType;
        lookupSource = field.lookup.sourceKey || field.lookup.source;
        lookupValueField = field.lookup.valueField;
        lookupLabelField = field.lookup.labelField;
    } else {
        // Handle flat lookup properties format
        lookupSourceType = field.lookupSourceType;
        lookupSource = field.lookupSource;
        lookupValueField = field.lookupValueField;
        lookupLabelField = field.lookupLabelField;
    }

    // Handle optionSource - REQUIRED for select/radio/checkbox
    // STATIC = custom options, MASTER = from master types, LOOKUP = entity fields lookup
    if (['select', 'radio', 'checkbox'].includes(normalizedType)) {
        if (field.optionSource) {
            transformed.optionSource = field.optionSource;
        } else if (lookupSourceType || lookupSource) {
            // If lookup properties exist, set optionSource to LOOKUP
            transformed.optionSource = 'LOOKUP';
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

    // Copy lookup-related properties (for LOOKUP optionSource)
    if (lookupSourceType !== undefined) transformed.lookupSourceType = lookupSourceType;
    if (lookupSource !== undefined) transformed.lookupSource = lookupSource;
    if (lookupValueField !== undefined) transformed.lookupValueField = lookupValueField;
    if (lookupLabelField !== undefined) transformed.lookupLabelField = lookupLabelField;

    // Copy other optional properties
    if (field.placeholder !== undefined) transformed.placeholder = field.placeholder;
    if (field.description !== undefined) transformed.description = field.description;
    if (field.defaultValue !== undefined) transformed.defaultValue = field.defaultValue;
    if (field.hidden !== undefined) transformed.hidden = field.hidden;
    if (field.position !== undefined) transformed.position = field.position;
    if (field.enabled !== undefined) transformed.enabled = field.enabled;
    if (field.visible !== undefined) transformed.visible = field.visible;
    // Order is already set above
    if (field.css !== undefined) transformed.css = field.css; // Preserve CSS
    if (field.optionsSource !== undefined) transformed.optionsSource = field.optionsSource;
    if (field.customOptionsEnabled !== undefined) transformed.customOptionsEnabled = field.customOptionsEnabled;
    if (field.groupName !== undefined) transformed.groupName = field.groupName;
    if (field.masterTypeName !== undefined) transformed.masterTypeName = field.masterTypeName;

    // Only include options for select/radio/checkbox
    if ((normalizedType === 'select' || normalizedType === 'radio' || normalizedType === 'checkbox') && field.options) {
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
 * - Handles forms with direct fields array (converts to sections)
 * @param schema 
 * @returns Cleaned schema
 */
export const cleanFormSchema = (schema: any): FormSchema => {
    // Use the transformField function which handles both old and new formats
    const cleanField = transformField;

    // Handle schema with direct fields array (convert to sections)
    let sections: any[] = [];
    if (schema.fields && Array.isArray(schema.fields) && schema.fields.length > 0) {
        // Convert fields array to a single section
        sections = [{
            id: schema.id ? `section-${schema.id}` : 'section-1',
            title: schema.formName || schema.title || 'Form Fields',
            fields: schema.fields,
            order: 0,
            isExpanded: true
        }];
    } else if (schema.sections && Array.isArray(schema.sections)) {
        sections = schema.sections;
    } else if (schema.groups && Array.isArray(schema.groups)) {
        // Handle groups array (similar to sections)
        sections = schema.groups.map((group: any, index: number) => ({
            id: group.id || `section-${index}`,
            title: group.title || group.name || `Section ${index + 1}`,
            fields: group.fields || [],
            order: group.order !== undefined ? group.order : index,
            isExpanded: group.isExpanded !== undefined ? group.isExpanded : true
        }));
    }

    return {
        id: schema.id,
        title: schema.title || schema.formName || 'Form',
        formName: schema.formName || schema.formId || schema.id,
        layout: schema.layout || { type: 'grid', columns: 12, gap: '16px' }, // Preserve form-level layout or set default
        sections: sections.map((section: any, sectionIndex: number) => ({
            id: section.id || `section-${sectionIndex}`,
            title: section.title || `Section ${sectionIndex + 1}`,
            fields: (section.fields || []).map((field: any, fieldIndex: number) => {
                const cleaned = cleanField(field);
                // Ensure order is set if not provided
                if (cleaned.order === undefined) {
                    cleaned.order = fieldIndex;
                }
                return cleaned;
            }),
            isExpanded: section.isExpanded !== undefined ? section.isExpanded : true,
            columns: section.columns, // Legacy - prefer layout.columns
            order: section.order !== undefined ? section.order : sectionIndex, // Ensure section order is set
            layout: section.layout || { type: 'grid', columns: section.columns || 12, gap: '16px' }, // Preserve section layout or set default
            css: section.css, // Preserve section CSS
        }))
    };
};

/**
 * Converts validation array format to validation object format (standard payload format)
 * @param validation 
 * @returns ValidationObject
 */
function convertValidationArrayToObject(validation: ValidationRule[] | ValidationObject | undefined): ValidationObject | undefined {
    if (!validation) return undefined;
    if (!Array.isArray(validation)) return validation as ValidationObject;

    const obj: ValidationObject = {};
    validation.forEach((rule: ValidationRule) => {
        if (rule.type === 'required') {
            obj.required = true;
        } else if (rule.type === 'pattern' && rule.regex) {
            obj.regex = rule.regex;
            obj.regexMessage = rule.message;
        } else if (rule.type === 'minLength' && typeof rule.value === 'number') {
            obj.minLength = rule.value;
        } else if (rule.type === 'maxLength' && typeof rule.value === 'number') {
            obj.maxLength = rule.value;
        } else if (rule.type === 'minSelected' && typeof rule.value === 'number') {
            obj.minSelected = rule.value;
        } else if (rule.type === 'maxSelected' && typeof rule.value === 'number') {
            obj.maxSelected = rule.value;
        } else if (rule.type === 'minDate' && typeof rule.value === 'string') {
            obj.minDate = rule.value;
        } else if (rule.type === 'maxDate' && typeof rule.value === 'string') {
            obj.maxDate = rule.value;
        }
    });
    return Object.keys(obj).length > 0 ? obj : undefined;
}

/**
 * Converts width to layout span
 * @param width 
 * @param totalColumns 
 * @returns span value (1-12)
 */
function convertWidthToSpan(width: FieldWidth | undefined, totalColumns: number = 12): number {
    if (!width) return 12; // Default to full width
    const widthNum = parseWidth(width);
    return Math.max(1, Math.min(12, Math.round((widthNum / 100) * totalColumns)));
}

/**
 * Transforms internal field format to standardized payload format
 * @param field 
 * @returns Field in payload format
 */
function fieldToPayload(field: FormField): any {
    const payload: any = {
        id: field.id,
        type: field.type,
        label: field.label,
        order: field.order !== undefined ? field.order : 0
    };

    // Layout (required) - prefer layout.span, fallback to width conversion
    if (field.layout?.span !== undefined) {
        payload.layout = {
            row: field.layout.row ?? 0,
            column: field.layout.column ?? 0,
            span: field.layout.span
        };
    } else if (field.width !== undefined) {
        // Convert width to layout.span
        payload.layout = {
            row: 0,
            column: 0,
            span: convertWidthToSpan(field.width)
        };
    } else {
        // Default
        payload.layout = {
            row: 0,
            column: 0,
            span: 12
        };
    }

    // Validation (object format)
    payload.validation = convertValidationArrayToObject(field.validation);
    if (payload.validation?.required) {
        payload.required = true;
    }

    // Multi-select (standard: multiSelect, not multiselect)
    if (field.type === 'select') {
        payload.multiSelect = field.multiSelect !== undefined ? field.multiSelect : false;
    }

    // Copy other optional properties
    if (field.placeholder !== undefined) payload.placeholder = field.placeholder;
    if (field.description !== undefined) payload.description = field.description;
    if (field.defaultValue !== undefined) payload.defaultValue = field.defaultValue;
    if (field.enabled !== undefined) payload.enabled = field.enabled;
    if (field.visible !== undefined) payload.visible = field.visible;
    if (field.css !== undefined) payload.css = field.css;
    if (field.optionSource !== undefined) payload.optionSource = field.optionSource;
    if (field.customOptionsEnabled !== undefined) payload.customOptionsEnabled = field.customOptionsEnabled;
    if (field.groupName !== undefined) payload.groupName = field.groupName;
    if (field.masterTypeName !== undefined) payload.masterTypeName = field.masterTypeName;
    // Lookup-related properties (for LOOKUP optionSource)
    if (field.lookupSourceType !== undefined) payload.lookupSourceType = field.lookupSourceType;
    if (field.lookupSource !== undefined) payload.lookupSource = field.lookupSource;
    if (field.lookupValueField !== undefined) payload.lookupValueField = field.lookupValueField;
    if (field.lookupLabelField !== undefined) payload.lookupLabelField = field.lookupLabelField;
    if (field.isd !== undefined) payload.isd = field.isd;

    // Options for select/radio/checkbox - include when present (STATIC/custom options, or from MASTER/LOOKUP)
    // Do not strip options: preserve custom options for STATIC fields even when lookup/masterTypeName absent
    if ((field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && field.options && Array.isArray(field.options)) {
        payload.options = field.options.map(opt => ({ label: opt.label, value: opt.value }));
    }

    return payload;
}

/**
 * Transforms Form Builder JSON to Platform JSON (standardized payload format)
 * @param builderSchema 
 * @returns Standardized payload format
 */
export const builderToPlatform = (builderSchema: FormSchema): any => {
    return {
        id: builderSchema.id,
        title: builderSchema.title,
        formName: builderSchema.formName,
        layout: builderSchema.layout || { type: 'grid', columns: 12, gap: '16px' },
        sections: builderSchema.sections.map((section, sectionIndex) => ({
            id: section.id,
            title: section.title,
            order: section.order !== undefined ? section.order : sectionIndex,
            layout: section.layout || { type: 'grid', columns: section.columns || 12, gap: '16px' },
            css: section.css,
            fields: section.fields.map(fieldToPayload)
        }))
    };
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
