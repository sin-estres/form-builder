import { FormBuilder } from './builder/FormBuilder';
import { FormSchema } from './core/schemaTypes';
import './index.css';

// Load form templates from form-templates.json
// The FormBuilder will automatically extract sections from FormSchema[] and populate the Templates tab
async function loadFormTemplates(): Promise<FormSchema[]> {
    try {
        const response = await fetch('/form-templates.json');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Could not load form templates:', error);
    }
    return [];
}

// Initialize form builder after templates are loaded
loadFormTemplates().then(async (formTemplates) => {
    const root = document.getElementById('root');
    if (root) {
        new FormBuilder(root, {
            formTemplates: formTemplates, // Use formTemplates instead of reusableSections
            onSave: (schema) => {
                console.log('[Form Builder] Saved schema:', JSON.stringify(schema, null, 2));
            }
        });

        // DEV-ONLY: JSON preview uploader — visible only when running locally (Vite dev server)
        if (import.meta.env.DEV) {
            const { attachDevJsonUploader } = await import('./dev/JsonPreviewUploader');
            attachDevJsonUploader(root);
        }
    }
});
