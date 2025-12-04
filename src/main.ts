import { FormBuilder } from './builder/FormBuilder';
import './index.css';

const root = document.getElementById('root');
if (root) {
    new FormBuilder(root, {
        onSave: (schema) => {
            console.log('Form saved with schema:', schema);
            console.log('Form name:', schema.formName);
            // You can now use schema.formName and the complete schema JSON
        }
    });
}
