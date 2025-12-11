export * from './core/schemaTypes';
export * from './builder/FormBuilder';
export * from './renderer/FormRenderer';
export * from './core/useFormStore';
export * from './utils/mapper';
import { FormBuilder, FormBuilderOptions } from './builder/FormBuilder';
import './index.css';

export const initFormBuilder = (options: FormBuilderOptions & { containerId: string }) => {
    const container = document.getElementById(options.containerId);
    if (!container) {
        throw new Error(`Container with id ${options.containerId} not found`);
    }
    return new FormBuilder(container, options);
};
