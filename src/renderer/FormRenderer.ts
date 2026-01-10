import { FormSchema, getColSpanFromWidth, ValidationObject, ValidationRule } from '../core/schemaTypes';
import { FieldRenderer } from './FieldRenderer';
import { createElement } from '../utils/dom';

// Helper function to convert validation object to array format for validation logic
function convertValidationToArray(validation: ValidationRule[] | ValidationObject | undefined): ValidationRule[] {
    if (!validation) return [];
    if (Array.isArray(validation)) return validation;
    const obj = validation as ValidationObject;
    const rules: ValidationRule[] = [];
    if (obj.required) rules.push({ type: 'required', value: true });
    if (obj.regex) rules.push({ type: 'pattern', regex: obj.regex, message: obj.regexMessage });
    if (obj.minLength !== undefined) rules.push({ type: 'minLength', value: obj.minLength });
    if (obj.maxLength !== undefined) rules.push({ type: 'maxLength', value: obj.maxLength });
    if (obj.minSelected !== undefined) rules.push({ type: 'minSelected', value: obj.minSelected });
    if (obj.maxSelected !== undefined) rules.push({ type: 'maxSelected', value: obj.maxSelected });
    if (obj.minDate) rules.push({ type: 'minDate', value: obj.minDate });
    if (obj.maxDate) rules.push({ type: 'maxDate', value: obj.maxDate });
    return rules;
}

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
        form.appendChild(createElement('h1', { className: 'text-2xl font-semibold mb-2 text-[#3b497e] ', text: this.schema.title }));

        // Sections
        this.schema.sections.forEach(section => {
            const sectionEl = createElement('div', { className: 'space-y-3 md:space-y-4 !m-0' });
            sectionEl.appendChild(createElement('h2', { className: 'text-xl  font-semibold text-[#3b497e] dark:text-gray-200 border-b pb-2', text: section.title }));

            const grid = createElement('div', { className: 'form-builder-grid' });

            section.fields.forEach(field => {
                // Check if field is visible (default to true if not specified)
                const isVisible = field.visible !== false;

                if (!isVisible) {
                    return; // Skip rendering hidden fields
                }

                const fieldWrapper = createElement('div');
                // Grid span logic - prioritize layout.span if available, otherwise use width
                let spanClass: string;
                if (field.layout?.span !== undefined) {
                    // Use layout.span directly (clamp between 1-12)
                    const span = Math.max(1, Math.min(12, field.layout.span));
                    spanClass = `col-span-${span}`;
                } else {
                    // Fallback to width-based calculation
                    spanClass = getColSpanFromWidth(field.width || 100);
                }

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
            className: 'w-full sm:w-auto px-6 py-3 min-h-touch !bg-[#019FA2]  text-white font-semibold p-3 flex items-center justify-center text-sm h-10 rounded-md hover:bg-primary cursor-pointer transition transition-colors',
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
                                // Handle both array and object validation formats
                                const validationArray = convertValidationToArray(field.validation);
                                const patternRule = validationArray.find((v: any) => v.type === 'pattern');
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

                            // Check minSelected/maxSelected validation for checkbox fields
                            if (field.type === 'checkbox' && Array.isArray(fieldValue)) {
                                const validationArray = convertValidationToArray(field.validation);
                                const minSelectedRule = validationArray.find((v: any) => v.type === 'minSelected');
                                const maxSelectedRule = validationArray.find((v: any) => v.type === 'maxSelected');
                                const selectedCount = fieldValue.length;

                                const minSelected = typeof minSelectedRule?.value === 'number' ? minSelectedRule.value : undefined;
                                const maxSelected = typeof maxSelectedRule?.value === 'number' ? maxSelectedRule.value : undefined;

                                if (minSelected !== undefined && selectedCount < minSelected) {
                                    isValid = false;
                                    altElement.setCustomValidity(`Please select at least ${minSelected} option(s)`);
                                    altElement.reportValidity();
                                    invalidFields.push(altElement);
                                } else if (maxSelected !== undefined && selectedCount > maxSelected) {
                                    isValid = false;
                                    altElement.setCustomValidity(`Please select at most ${maxSelected} option(s)`);
                                    altElement.reportValidity();
                                    invalidFields.push(altElement);
                                } else {
                                    altElement.setCustomValidity('');
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
                        // Handle both array and object validation formats
                        const validationArray = convertValidationToArray(field.validation);
                        const patternRule = validationArray.find((v: any) => v.type === 'pattern');
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

                    // Check minSelected/maxSelected validation for checkbox fields
                    if (field.type === 'checkbox' && Array.isArray(fieldValue)) {
                        const validationArray = convertValidationToArray(field.validation);
                        const minSelectedRule = validationArray.find((v: any) => v.type === 'minSelected');
                        const maxSelectedRule = validationArray.find((v: any) => v.type === 'maxSelected');
                        const selectedCount = fieldValue.length;

                        const minSelected = typeof minSelectedRule?.value === 'number' ? minSelectedRule.value : undefined;
                        const maxSelected = typeof maxSelectedRule?.value === 'number' ? maxSelectedRule.value : undefined;

                        if (minSelected !== undefined && selectedCount < minSelected) {
                            isValid = false;
                            fieldElement.setCustomValidity(`Please select at least ${minSelected} option(s)`);
                            fieldElement.reportValidity();
                            invalidFields.push(fieldElement);
                        } else if (maxSelected !== undefined && selectedCount > maxSelected) {
                            isValid = false;
                            fieldElement.setCustomValidity(`Please select at most ${maxSelected} option(s)`);
                            fieldElement.reportValidity();
                            invalidFields.push(fieldElement);
                        } else {
                            fieldElement.setCustomValidity('');
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

        const btnWrapper = createElement('div', { className: 'pt-2 flex justify-center sm:justify-start' });
        btnWrapper.appendChild(submitBtn);
        form.appendChild(btnWrapper);

        this.container.appendChild(form);
    }
}
