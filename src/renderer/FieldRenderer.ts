import { FormField } from '../core/schemaTypes';
import { createElement } from '../utils/dom';

export class FieldRenderer {
    static render(field: FormField, value?: any, onChange?: (val: any) => void, readOnly: boolean = false): HTMLElement {
        const wrapper = createElement('div', { className: 'w-full' });

        // Label (except for checkbox which has its own layout)
        if (field.type !== 'checkbox') {
            const label = createElement('label', {
                className: 'text-xs sm:text-sm font-medium leading-none mb-2 block text-gray-900 dark:text-gray-100',
                text: field.label
            });
            if (field.required) {
                label.appendChild(createElement('span', { className: 'text-red-500 ml-1', text: '*' }));
            }
            wrapper.appendChild(label);
        } else {
            // Checkbox label logic (aligned on top as per previous request)
            const label = createElement('label', {
                className: 'text-xs sm:text-sm font-medium leading-none mb-2 block text-gray-900 dark:text-gray-100',
                text: field.label
            });
            if (field.required) {
                label.appendChild(createElement('span', { className: 'text-red-500 ml-1', text: '*' }));
            }
            wrapper.appendChild(label);
        }

        let input: HTMLElement;

        switch (field.type) {
            case 'textarea':
                input = createElement('textarea', {
                    className: 'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    placeholder: field.placeholder,
                    value: value || '',
                    disabled: readOnly,
                    oninput: (e: Event) => onChange?.((e.target as HTMLTextAreaElement).value)
                });
                break;

            case 'select':
                input = createElement('select', {
                    className: 'flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    value: value || '',
                    disabled: readOnly,
                    onchange: (e: Event) => onChange?.((e.target as HTMLSelectElement).value)
                });
                input.appendChild(createElement('option', { value: '', text: 'Select an option', disabled: true, selected: !value }));
                field.options?.forEach(opt => {
                    input.appendChild(createElement('option', { value: opt.value, text: opt.label, selected: value === opt.value }));
                });
                break;

            case 'checkbox':
                input = createElement('div', { className: 'flex items-center min-h-touch' });
                const checkbox = createElement('input', {
                    type: 'checkbox',
                    className: 'h-5 w-5 sm:h-6 sm:w-6 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer',
                    checked: !!value,
                    disabled: readOnly,
                    onchange: (e: Event) => onChange?.((e.target as HTMLInputElement).checked)
                });
                input.appendChild(checkbox);
                break;

            case 'radio':
                input = createElement('div', { className: 'space-y-2' });
                field.options?.forEach(opt => {
                    const radioWrapper = createElement('div', { className: 'flex items-center space-x-2 min-h-touch' });
                    const radio = createElement('input', {
                        type: 'radio',
                        name: field.id,
                        value: opt.value,
                        checked: value === opt.value,
                        disabled: readOnly,
                        className: 'aspect-square h-4 w-4 sm:h-5 sm:w-5 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        onchange: (e: Event) => onChange?.((e.target as HTMLInputElement).value)
                    });
                    const radioLabel = createElement('label', {
                        className: 'text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                        text: opt.label
                    });
                    radioWrapper.appendChild(radio);
                    radioWrapper.appendChild(radioLabel);
                    input.appendChild(radioWrapper);
                });
                break;

            default: // text, number, email, date, etc.
                input = createElement('input', {
                    type: field.type === 'phone' ? 'tel' : field.type,
                    className: 'flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    placeholder: field.placeholder,
                    value: value || '',
                    disabled: readOnly,
                    oninput: (e: Event) => onChange?.((e.target as HTMLInputElement).value)
                });
        }

        wrapper.appendChild(input);

        if (field.description) {
            wrapper.appendChild(createElement('p', { className: 'text-xs sm:text-sm text-muted-foreground mt-1', text: field.description }));
        }

        return wrapper;
    }
}
