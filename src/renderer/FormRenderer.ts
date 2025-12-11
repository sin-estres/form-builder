import { FormSchema } from '../core/schemaTypes';
import { FieldRenderer } from './FieldRenderer';
import { createElement } from '../utils/dom';

export class FormRenderer {
    private container: HTMLElement;
    private schema: FormSchema;
    private data: Record<string, any> = {};
    private onSubmit?: (data: any) => void;

    constructor(container: HTMLElement, schema: FormSchema, onSubmit?: (data: any) => void) {
        this.container = container;
        this.schema = schema;
        this.onSubmit = onSubmit;
        this.render();
    }

    public setSchema(schema: FormSchema) {
        this.schema = schema;
        this.render();
    }

    private render() {
        this.container.innerHTML = '';

        const form = createElement('form', { className: 'space-y-8' });

        // Title
        form.appendChild(createElement('h1', { className: 'text-2xl font-bold text-gray-900 dark:text-white', text: this.schema.title }));

        // Sections
        this.schema.sections.forEach(section => {
            const sectionEl = createElement('div', { className: 'space-y-4' });
            sectionEl.appendChild(createElement('h2', { className: 'text-xl font-semibold text-gray-800 dark:text-gray-200 border-b pb-2', text: section.title }));

            const grid = createElement('div', { className: 'form-builder-grid' });

            section.fields.forEach(field => {
                const fieldWrapper = createElement('div');
                // Grid span logic (12 Cols)
                let spanClass = 'col-span-12';
                if (field.width === '50%') spanClass = 'col-span-6';
                else if (field.width === '33%') spanClass = 'col-span-4';
                else if (field.width === '25%') spanClass = 'col-span-3';
                else if (field.width === '66%') spanClass = 'col-span-8';
                else if (field.width === '75%') spanClass = 'col-span-9';

                fieldWrapper.className = spanClass;

                const fieldEl = FieldRenderer.render(field, this.data[field.id], (val) => {
                    this.data[field.id] = val;
                });

                fieldWrapper.appendChild(fieldEl);
                grid.appendChild(fieldWrapper);
            });

            sectionEl.appendChild(grid);
            form.appendChild(sectionEl);
        });

        // Submit Button
        const submitBtn = createElement('button', {
            type: 'submit',
            className: 'px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors',
            text: 'Submit'
        });

        form.onsubmit = (e) => {
            e.preventDefault();
            this.onSubmit?.(this.data);
        };

        const btnWrapper = createElement('div', { className: 'pt-4' });
        btnWrapper.appendChild(submitBtn);
        form.appendChild(btnWrapper);

        this.container.appendChild(form);
    }
}
