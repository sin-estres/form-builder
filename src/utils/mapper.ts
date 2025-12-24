import { FormSchema, FormField } from '../core/schemaTypes';

/**
 * Cleans a form schema by removing invalid properties and normalizing field types
 * - Converts "decimal" type to "number"
 * - Removes invalid properties like "masterTypeName"
 * - Removes empty options arrays from non-select/radio fields
 * @param schema 
 * @returns Cleaned schema
 */
export const cleanFormSchema = (schema: any): FormSchema => {
    const cleanField = (field: any): FormField => {
        const cleaned: any = {
            id: field.id,
            type: field.type === 'decimal' ? 'number' : field.type, // Convert decimal to number
            label: field.label,
            width: field.width,
        };

        // Only include valid optional properties
        if (field.placeholder !== undefined) cleaned.placeholder = field.placeholder;
        if (field.description !== undefined) cleaned.description = field.description;
        if (field.required !== undefined) cleaned.required = field.required;
        if (field.defaultValue !== undefined) cleaned.defaultValue = field.defaultValue;
        if (field.validation !== undefined) cleaned.validation = field.validation;
        if (field.hidden !== undefined) cleaned.hidden = field.hidden;
        if (field.position !== undefined) cleaned.position = field.position;
        if (field.enabled !== undefined) cleaned.enabled = field.enabled;
        if (field.visible !== undefined) cleaned.visible = field.visible;
        if (field.optionsSource !== undefined) cleaned.optionsSource = field.optionsSource;
        
        // Only include options for select/radio fields
        if ((field.type === 'select' || field.type === 'radio') && field.options) {
            cleaned.options = field.options;
        }
        
        // Only include groupName for select fields
        if (field.type === 'select' && field.groupName) {
            cleaned.groupName = field.groupName;
        }

        // Remove invalid properties like masterTypeName
        // (masterTypeName is not part of FormField interface)

        return cleaned as FormField;
    };

    return {
        id: schema.id,
        title: schema.title,
        formName: schema.formName,
        sections: schema.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            fields: section.fields.map(cleanField),
            isExpanded: section.isExpanded,
            columns: section.columns,
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
