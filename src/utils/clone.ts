import { generateId } from '../core/constants';
import { FormSchema, FormSection, FormField } from '../core/schemaTypes';

/**
 * Deep clones a form schema and regenerates all IDs (Form, Sections, Fields)
 */
export const cloneForm = (schema: FormSchema): FormSchema => {
    return {
        ...schema,
        id: generateId(),
        title: `${schema.title} (Copy)`,
        formName: `${schema.formName}_copy`,
        sections: schema.sections.map(cloneSection)
    };
};

/**
 * Deep clones a section and regenerates all IDs (Section, Fields)
 */
export const cloneSection = (section: FormSection): FormSection => {
    return {
        ...section,
        id: generateId(),
        fields: section.fields.map(cloneField)
    };
};

/**
 * Deep clones a field and regenerates its ID
 */
export const cloneField = (field: FormField): FormField => {
    return {
        ...field,
        id: generateId(),
        // Ensure options are also cloned if present
        options: field.options ? field.options.map(opt => ({ ...opt })) : undefined,
        validation: field.validation ? field.validation.map(v => ({ ...v })) : undefined,
        // Preserve formula config for number fields (dependencies stay as-is - they reference other field ids/names)
        valueSource: field.valueSource,
        formula: field.formula,
        dependencies: field.dependencies ? [...field.dependencies] : undefined
    };
};
