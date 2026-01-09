import { FormSchema, getColSpanFromWidth } from '../core/schemaTypes';
import { FieldRenderer } from './FieldRenderer';
import { createElement } from '../utils/dom';

export class FormRenderer {
    private container: HTMLElement;
    private schema: FormSchema;
    private data: Record<string, any> = {};
    private onSubmit?: (data: any) => void;
    private onDropdownValueChange?: (event: { fieldId: string; value: string }) => void;

    constructor(container: HTMLElement, schema: FormSchema, onSubmit?: (data: any) => void, onDropdownValueChange?: (event: { fieldId: string; value: string }) => void) {
        this.container = container;
        this.schema = schema;
        this.onSubmit = onSubmit;
        this.onDropdownValueChange = onDropdownValueChange;
        this.render();
    }

    public setSchema(schema: FormSchema) {
        this.schema = schema;
        this.render();
    }

    private render() {
        this.container.innerHTML = '';

        const form = createElement('form', { className: 'space-y-6 md:space-y-8' });

        // Title
        form.appendChild(createElement('h1', { className: 'text-xl md:text-2xl font-bold text-bg-primary dark:text-white', text: this.schema.title }));

        // Sections
        this.schema.sections.forEach(section => {
            const sectionEl = createElement('div', { className: 'space-y-3 md:space-y-4' });
            sectionEl.appendChild(createElement('h2', { className: 'text-lg md:text-xl font-semibold text-gray-800 dark:text-gray-200 border-b pb-2', text: section.title }));

            const grid = createElement('div', { className: 'form-builder-grid' });

            section.fields.forEach(field => {
                // Check if field is visible (default to true if not specified)
                const isVisible = field.visible !== false;

                if (!isVisible) {
                    return; // Skip rendering hidden fields
                }

                const fieldWrapper = createElement('div');
                // Grid span logic - use the helper function for consistent calculation
                const spanClass = getColSpanFromWidth(field.width);

                fieldWrapper.className = spanClass;

                const fieldEl = FieldRenderer.render(field, this.data[field.id], (val) => {
                    this.data[field.id] = val;
                    // Emit dropdownValueChange event for select fields (Angular integration)
                    if (field.type === 'select' && this.onDropdownValueChange) {
                        this.onDropdownValueChange({
                            fieldId: field.id,
                            value: val || ''
                        });
                    }
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
            className: 'w-full sm:w-auto px-6 py-3 min-h-touch bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors',
            text: 'Submit'
        });

        form.onsubmit = (e) => {
            e.preventDefault();
            
            // Validate all fields before submission
            let isValid = true;
            const invalidFields: HTMLElement[] = [];
            
            // Validate each field
            this.schema.sections.forEach(section => {
                section.fields.forEach(field => {
                    if (field.visible === false) return;
                    
                    const fieldValue = this.data[field.id];
                    const fieldElement = form.querySelector(`input[id*="${field.id}"], textarea[id*="${field.id}"], select[id*="${field.id}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
                    
                    if (!fieldElement) {
                        // Try alternative selector
                        const altElement = Array.from(form.querySelectorAll('input, textarea, select')).find(el => {
                            const wrapper = el.closest('div');
                            return wrapper && wrapper.textContent?.includes(field.label);
                        }) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
                        if (altElement) {
                            // Validate required fields
                            if (field.required && (!fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0))) {
                                isValid = false;
                                altElement.setCustomValidity('This field is required');
                                altElement.reportValidity();
                                invalidFields.push(altElement);
                            } else {
                                altElement.setCustomValidity('');
                            }
                            
                            // Check pattern validation for text and email fields
                            if ((field.type === 'text' || field.type === 'email') && fieldValue) {
                                const patternRule = field.validation?.find(v => v.type === 'pattern');
                                if (patternRule?.regex) {
                                    try {
                                        const regex = new RegExp(patternRule.regex);
                                        if (!regex.test(String(fieldValue))) {
                                            isValid = false;
                                            altElement.setCustomValidity(patternRule.message || 'Invalid format');
                                            altElement.reportValidity();
                                            invalidFields.push(altElement);
                                        } else {
                                            altElement.setCustomValidity('');
                                        }
                                    } catch (e) {
                                        // Invalid regex - skip
                                    }
                                }
                            }
                        }
                        return;
                    }
                    
                    // Check required validation
                    if (field.required && (!fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0))) {
                        isValid = false;
                        fieldElement.setCustomValidity('This field is required');
                        fieldElement.reportValidity();
                        invalidFields.push(fieldElement);
                    } else {
                        fieldElement.setCustomValidity('');
                    }
                    
                    // Check pattern validation for text and email fields
                    if ((field.type === 'text' || field.type === 'email') && fieldValue) {
                        const patternRule = field.validation?.find(v => v.type === 'pattern');
                        if (patternRule?.regex) {
                            try {
                                const regex = new RegExp(patternRule.regex);
                                if (!regex.test(String(fieldValue))) {
                                    isValid = false;
                                    fieldElement.setCustomValidity(patternRule.message || 'Invalid format');
                                    fieldElement.reportValidity();
                                    invalidFields.push(fieldElement);
                                } else {
                                    fieldElement.setCustomValidity('');
                                }
                            } catch (e) {
                                // Invalid regex - skip
                            }
                        }
                    }
                });
            });
            
            // Focus first invalid field
            if (invalidFields.length > 0) {
                invalidFields[0].focus();
            }
            
            // Also check HTML5 native validation
            if (form.checkValidity() === false) {
                isValid = false;
            }
            
            if (isValid) {
                this.onSubmit?.(this.data);
            }
        };

        const btnWrapper = createElement('div', { className: 'pt-4 flex justify-center sm:justify-start' });
        btnWrapper.appendChild(submitBtn);
        form.appendChild(btnWrapper);

        this.container.appendChild(form);
    }
}
