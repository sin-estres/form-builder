import { FormBuilder } from './builder/FormBuilder';
import { FormSection } from './core/schemaTypes';
import './index.css';

// Load section templates
async function loadTemplates(): Promise<FormSection[]> {
    try {
        const response = await fetch('/section-templates.json');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        // Could not load section templates
    }
    return [];
}

// Initialize form builder after templates are loaded
loadTemplates().then((sectionTemplates) => {
    const root = document.getElementById('root');
    if (root) {
        new FormBuilder(root, {
            reusableSections: sectionTemplates,
            onSave: (schema) => {
                // You can now use schema.formName and the complete schema JSON
            }
        });
    }
});
