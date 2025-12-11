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
        console.warn('Could not load section templates:', error);
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
                console.log('Form saved with schema:', schema);
                console.log('Form name:', schema.formName);
                // You can now use schema.formName and the complete schema JSON
            }
        });
    }
});
