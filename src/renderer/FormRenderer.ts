import { FormSchema, FormField, getColSpanFromWidth, ValidationObject, ValidationRule } from '../core/schemaTypes';
import { FieldRenderer } from './FieldRenderer';
import { createElement } from '../utils/dom';
import { evaluateFormula } from '../utils/formula';

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
    if (obj.min !== undefined) rules.push({ type: 'min', value: obj.min });
    if (obj.max !== undefined) rules.push({ type: 'max', value: obj.max });
    if (obj.minSelected !== undefined) rules.push({ type: 'minSelected', value: obj.minSelected });
    if (obj.maxSelected !== undefined) rules.push({ type: 'maxSelected', value: obj.maxSelected });
    if (obj.minDate) rules.push({ type: 'minDate', value: obj.minDate });
    if (obj.maxDate) rules.push({ type: 'maxDate', value: obj.maxDate });
    return rules;
}

/** Get validation rules from field.validations (preferred) or field.validation (legacy) */
function getValidationRulesForField(field: FormField): ValidationRule[] {
    const v = field.validations;
    if (v) {
        const obj: ValidationObject = {};
        if (v.required) obj.required = true;
        if (v.pattern) obj.regex = v.pattern;
        if (v.customErrorMessages?.pattern) obj.regexMessage = v.customErrorMessages.pattern;
        if (v.minLength !== undefined) obj.minLength = v.minLength;
        if (v.maxLength !== undefined) obj.maxLength = v.maxLength;
        if (v.min !== undefined) obj.min = v.min;
        if (v.max !== undefined) obj.max = v.max;
        if (v.minSelected !== undefined) obj.minSelected = v.minSelected;
        if (v.maxSelected !== undefined) obj.maxSelected = v.maxSelected;
        if (v.minDate) obj.minDate = v.minDate;
        if (v.maxDate) obj.maxDate = v.maxDate;
        return convertValidationToArray(obj);
    }
    return convertValidationToArray(field.validation);
}

/**
 * Returns the first validation error message for a field, or empty string if valid.
 * Used on form submission to validate all field types including number min/max.
 */
function getFieldValidationError(field: FormField, fieldValue: any): string {
    const isRequired = field.validations?.required ?? field.required;
    if (isRequired && (!fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0))) {
        return field.validations?.customErrorMessages?.required || 'This field is required';
    }

    // Pattern, minLength, maxLength for text, email, phone
    if ((field.type === 'text' || field.type === 'email' || field.type === 'phone') && fieldValue) {
        const validationArray = getValidationRulesForField(field);
        const patternRule = validationArray.find((v: any) => v.type === 'pattern');
        if (patternRule?.regex) {
            try {
                if (!new RegExp(patternRule.regex).test(String(fieldValue))) {
                    return field.validations?.customErrorMessages?.pattern || patternRule.message || 'Invalid format';
                }
            } catch (_e) { /* invalid regex */ }
        }
        const minLenRule = validationArray.find((v: any) => v.type === 'minLength');
        const maxLenRule = validationArray.find((v: any) => v.type === 'maxLength');
        const len = String(fieldValue).length;
        if (minLenRule && typeof minLenRule.value === 'number' && len < minLenRule.value) {
            return field.validations?.customErrorMessages?.minLength || `Minimum length is ${minLenRule.value}`;
        }
        if (maxLenRule && typeof maxLenRule.value === 'number' && len > maxLenRule.value) {
            return field.validations?.customErrorMessages?.maxLength || `Maximum length is ${maxLenRule.value}`;
        }
    }

    // Min/max for number fields
    if (field.type === 'number' && fieldValue !== '' && fieldValue !== undefined) {
        const v = field.validations;
        const num = parseFloat(String(fieldValue));
        if (!isNaN(num)) {
            if (v?.min !== undefined && num < v.min) {
                return v.customErrorMessages?.min || `Value must be at least ${v.min}`;
            }
            if (v?.max !== undefined && num > v.max) {
                return v.customErrorMessages?.max || `Value must be at most ${v.max}`;
            }
            if (v?.allowNegative === false && num < 0) {
                return v.customErrorMessages?.min || 'Negative values are not allowed';
            }
        }
    }

    // MinSelected/maxSelected for checkbox
    if (field.type === 'checkbox' && Array.isArray(fieldValue)) {
        const validationArray = getValidationRulesForField(field);
        const minSelectedRule = validationArray.find((v: any) => v.type === 'minSelected');
        const maxSelectedRule = validationArray.find((v: any) => v.type === 'maxSelected');
        const selectedCount = fieldValue.length;
        const minSelected = typeof minSelectedRule?.value === 'number' ? minSelectedRule.value : undefined;
        const maxSelected = typeof maxSelectedRule?.value === 'number' ? maxSelectedRule.value : undefined;
        if (minSelected !== undefined && selectedCount < minSelected) {
            return `Please select at least ${minSelected} option(s)`;
        }
        if (maxSelected !== undefined && selectedCount > maxSelected) {
            return `Please select at most ${maxSelected} option(s)`;
        }
    }

    return '';
}

// Model key for binding: fieldName (API convention) or id fallback
function getModelKey(field: { id: string; fieldName?: string }): string {
    return field.fieldName ?? field.id;
}

/** Build values map for formula evaluation - includes manual values and computed formula values in dependency order */
function buildFormulaValuesMap(schema: FormSchema, data: Record<string, any>): Record<string, number | string | undefined> {
    const values: Record<string, number | string | undefined> = {};
    const allFields: FormField[] = schema.sections.flatMap(s => s.fields);

    // First pass: add manual field values
    for (const field of allFields) {
        const modelKey = getModelKey(field);
        const val = data[modelKey];
        values[modelKey] = val;
        values[field.id] = val;
        if (field.fieldName) values[field.fieldName] = val;
    }

    // Compute formula fields (iterate to handle formula chains: A=B+C, D=A*2)
    const formulaFields = allFields.filter(f => f.type === 'number' && f.valueSource === 'formula' && f.formula);
    for (let pass = 0; pass < Math.max(1, formulaFields.length); pass++) {
        for (const field of formulaFields) {
            const modelKey = getModelKey(field);
            const result = evaluateFormula(field.formula!, values);
            const newVal = isNaN(result) ? undefined : result;
            values[modelKey] = newVal;
            values[field.id] = newVal;
            if (field.fieldName) values[field.fieldName] = newVal;
        }
    }
    return values;
}

/** Compute value for a formula field */
function computeFormulaValue(field: FormField, schema: FormSchema, data: Record<string, any>): number | string | undefined {
    if (field.type !== 'number' || field.valueSource !== 'formula' || !field.formula) return undefined;
    const values = buildFormulaValuesMap(schema, data);
    const modelKey = getModelKey(field);
    const result = values[modelKey];
    if (typeof result !== 'number') return undefined;
    // Apply decimal places from validations
    const decimalPlaces = field.validations?.decimalPlaces ?? (field.validations?.allowDecimal ? 2 : 0);
    const rounded = decimalPlaces > 0
        ? Math.round(result * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
        : Math.round(result);
    return rounded;
}

/** Check if any formula field depends on the given field (by modelKey or id) */
function isFormulaDependency(schema: FormSchema, modelKey: string, fieldId?: string): boolean {
    for (const section of schema.sections) {
        for (const field of section.fields) {
            if (field.type === 'number' && field.valueSource === 'formula' && field.dependencies) {
                if (field.dependencies.includes(modelKey)) return true;
                if (fieldId && field.dependencies.includes(fieldId)) return true;
            }
        }
    }
    return false;
}

export class FormRenderer {
    private container: HTMLElement;
    private schema: FormSchema;
    private data: Record<string, any> = {};
    private onSubmit?: (data: any) => void;
    private onDropdownValueChange?: (event: { fieldId: string; value: string }) => void;

    constructor(
        container: HTMLElement,
        schema: FormSchema,
        onSubmit?: (data: any) => void,
        onDropdownValueChange?: (event: { fieldId: string; value: string }) => void,
        initialData?: Record<string, any>
    ) {
        this.container = container;
        this.schema = schema;
        this.onSubmit = onSubmit;
        this.onDropdownValueChange = onDropdownValueChange;
        if (initialData && typeof initialData === 'object') {
            this.data = { ...initialData };
        }
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

        // Sections: sort fields by order (fallback when row/column conflict)
        this.schema.sections.forEach(section => {
            const sectionEl = createElement('div', { className: 'space-y-3 md:space-y-4 !m-0' });
            sectionEl.appendChild(createElement('h2', { className: 'text-xl  font-semibold text-[#3b497e] dark:text-gray-200 border-b pb-2', text: section.title }));

            const grid = createElement('div', { className: 'form-builder-grid' });

            const sortedFields = [...section.fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            sortedFields.forEach(field => {
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

                const modelKey = getModelKey(field);
                // For formula number fields, compute value from formula
                let fieldValue: any;
                if (field.type === 'number' && field.valueSource === 'formula' && field.formula) {
                    const computed = computeFormulaValue(field, this.schema, this.data);
                    fieldValue = computed;
                    this.data[modelKey] = computed; // Keep data in sync for submit
                } else if (field.type === 'image') {
                    fieldValue = this.data[modelKey] ?? field.imageUrl ?? field.defaultValue;
                } else {
                    fieldValue = this.data[modelKey];
                }
                const isFormulaField = field.type === 'number' && field.valueSource === 'formula';
                const fieldEl = FieldRenderer.render(
                    field,
                    fieldValue,
                    (val) => {
                        this.data[modelKey] = val;
                        // Emit dropdownValueChange event for select fields (Angular integration)
                        if (field.type === 'select' && this.onDropdownValueChange) {
                            this.onDropdownValueChange({
                                fieldId: field.id,
                                value: val || ''
                            });
                        }
                        // Re-render when a formula dependency changes
                        if (isFormulaDependency(this.schema, modelKey, field.id)) {
                            this.render();
                        }
                    },
                    isFormulaField // Formula fields are read-only
                );

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

                    const modelKey = getModelKey(field);
                    const fieldValue = this.data[modelKey];
                    const fieldElement = form.querySelector(`input[id*="${field.id}"], textarea[id*="${field.id}"], select[id*="${field.id}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

                    const fieldError = getFieldValidationError(field, fieldValue);
                    const element = fieldElement ?? Array.from(form.querySelectorAll('input, textarea, select')).find(el => {
                        const wrapper = el.closest('div');
                        return wrapper && wrapper.textContent?.includes(field.label);
                    }) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

                    if (element) {
                        if (fieldError) {
                            isValid = false;
                            element.setCustomValidity(fieldError);
                            element.reportValidity();
                            invalidFields.push(element);
                        } else {
                            element.setCustomValidity('');
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
