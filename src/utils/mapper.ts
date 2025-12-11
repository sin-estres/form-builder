import { FormSchema } from '../core/schemaTypes';

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
    // Implement transformation logic here.
    return platformSchema as FormSchema;
};
