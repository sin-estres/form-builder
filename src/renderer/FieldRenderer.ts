import { FormField, ISDConfig } from '../core/schemaTypes';
import { createElement } from '../utils/dom';
import { COUNTRY_CODES, getCountryByDialCode, getDefaultCountry, CountryCode } from '../core/countryData';

export class FieldRenderer {
    static render(field: FormField, value?: any, onChange?: (val: any) => void, readOnly: boolean = false): HTMLElement {
        const wrapper = createElement('div', { className: 'w-full form-row' });

        // Check if field is enabled (default to true if not specified)
        const isEnabled = field.enabled !== false && !readOnly;

        // Label (except for checkbox which has its own layout)
        if (field.type !== 'checkbox' && field.type !== 'toggle') {
            const label = createElement('label', {
                className: 'text-xs sm:text-sm font-medium leading-none mb-2 block text-gray-900 dark:text-gray-100',
                text: field.label
            });
            if (field.required) {
                label.appendChild(createElement('span', { className: 'text-red-500 ml-1', text: '*' }));
            }
            wrapper.appendChild(label);
        } else if (field.type === 'checkbox') {
            // Checkbox label logic (aligned on top as per previous request)
            const label = createElement('label', {
                className: 'text-xs sm:text-sm font-medium leading-none mb-2 block text-gray-900 dark:text-gray-100',
                text: field.label
            });
            if (field.required) {
                label.appendChild(createElement('span', { className: 'text-red-500 ml-1', text: '*' }));
            }
            wrapper.appendChild(label);
        } else if (field.type === 'toggle') {
            // Toggle label (shown alongside the switch)
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
        let validationMsg: HTMLElement | null = null;

        // Handle both array and object validation formats
        // Convert validation object to array format for rendering logic
        const validationArray = Array.isArray(field.validation)
            ? field.validation
            : field.validation
                ? (() => {
                    const obj = field.validation as any;
                    const rules: any[] = [];
                    if (obj.required) rules.push({ type: 'required', value: true });
                    if (obj.regex) rules.push({ type: 'pattern', regex: obj.regex, message: obj.regexMessage });
                    if (obj.minLength !== undefined) rules.push({ type: 'minLength', value: obj.minLength });
                    if (obj.maxLength !== undefined) rules.push({ type: 'maxLength', value: obj.maxLength });
                    if (obj.minSelected !== undefined) rules.push({ type: 'minSelected', value: obj.minSelected });
                    if (obj.maxSelected !== undefined) rules.push({ type: 'maxSelected', value: obj.maxSelected });
                    if (obj.minDate) rules.push({ type: 'minDate', value: obj.minDate });
                    if (obj.maxDate) rules.push({ type: 'maxDate', value: obj.maxDate });
                    return rules;
                })()
                : [];

        // Check if field has pattern validation (for text or email fields)
        const hasPatternValidation = validationArray.some((v: any) => v.type === 'pattern');

        // Create validation message container for date/email/text fields with validation
        if (field.type === 'date' || field.type === 'email' || (field.type === 'text' && hasPatternValidation)) {
            validationMsg = createElement('div', { className: 'text-xs text-red-600 dark:text-red-400 mt-1 hidden', id: `validation-${field.id}` });
        }

        // Validation helper function (defined before use)
        const validateField = (field: FormField, value: string, inputElement: HTMLInputElement, validationMsg: HTMLElement) => {
            let errorMessage = '';

            // Handle both array and object validation formats
            // Convert validation object to array format for rendering logic
            const validationArray = Array.isArray(field.validation)
                ? field.validation
                : field.validation
                    ? (() => {
                        const obj = field.validation as any;
                        const rules: any[] = [];
                        if (obj.required) rules.push({ type: 'required', value: true });
                        if (obj.regex) rules.push({ type: 'pattern', regex: obj.regex, message: obj.regexMessage });
                        if (obj.minLength !== undefined) rules.push({ type: 'minLength', value: obj.minLength });
                        if (obj.maxLength !== undefined) rules.push({ type: 'maxLength', value: obj.maxLength });
                        if (obj.minSelected !== undefined) rules.push({ type: 'minSelected', value: obj.minSelected });
                        if (obj.maxSelected !== undefined) rules.push({ type: 'maxSelected', value: obj.maxSelected });
                        if (obj.minDate) rules.push({ type: 'minDate', value: obj.minDate });
                        if (obj.maxDate) rules.push({ type: 'maxDate', value: obj.maxDate });
                        return rules;
                    })()
                    : [];

            // Date validation
            if (field.type === 'date' && value) {
                const minDateRule = validationArray.find((v: any) => v.type === 'minDate');
                const maxDateRule = validationArray.find((v: any) => v.type === 'maxDate');
                const inputDate = new Date(value);

                if (minDateRule?.value) {
                    const minDate = new Date(minDateRule.value as string);
                    if (inputDate < minDate) {
                        errorMessage = minDateRule.message || 'Date must be after the minimum date';
                    }
                }

                if (maxDateRule?.value && !errorMessage) {
                    const maxDate = new Date(maxDateRule.value as string);
                    if (inputDate > maxDate) {
                        errorMessage = maxDateRule.message || 'Date must be before the maximum date';
                    }
                }
            }

            // Pattern/regex validation (for email and text fields)
            if ((field.type === 'email' || field.type === 'text') && value) {
                const patternRule = validationArray.find((v: any) => v.type === 'pattern');
                if (patternRule?.regex) {
                    try {
                        const regex = new RegExp(patternRule.regex);
                        if (!regex.test(value)) {
                            errorMessage = patternRule.message || 'Invalid format';
                        }
                    } catch (e) {
                        // Invalid regex pattern - don't show error for invalid regex
                    }
                }
            }

            // Show/hide validation message
            if (errorMessage) {
                validationMsg.textContent = errorMessage;
                validationMsg.classList.remove('hidden');
                inputElement.classList.add('border-red-500');
            } else {
                validationMsg.classList.add('hidden');
                inputElement.classList.remove('border-red-500');
            }
        };

        switch (field.type) {
            case 'textarea':
                input = createElement('textarea', {
                    className: 'flex min-h-[30px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    placeholder: field.placeholder,
                    value: value || '',
                    disabled: !isEnabled,
                    oninput: (e: Event) => onChange?.((e.target as HTMLTextAreaElement).value)
                });
                break;

            case 'select':
                // Use multiSelect (standard), fallback to multiselect (legacy) for backward compatibility
                const isMultiSelect = field.multiSelect === true || field.multiselect === true;
                if (isMultiSelect) {
                    // Multiselect dropdown
                    input = createElement('select', {
                        multiple: true,
                        className: 'flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        disabled: !isEnabled,
                        onchange: (e: Event) => {
                            const select = e.target as HTMLSelectElement;
                            const selectedValues = Array.from(select.selectedOptions).map(opt => opt.value);
                            onChange?.(selectedValues);
                        }
                    });
                    const currentValues = Array.isArray(value) ? value : (value ? [value] : []);
                    field.options?.forEach(opt => {
                        const option = createElement('option', { value: opt.value, text: opt.label });
                        if (currentValues.includes(opt.value)) {
                            (option as HTMLOptionElement).selected = true;
                        }
                        input.appendChild(option);
                    });
                } else {
                    // Single select dropdown
                    input = createElement('select', {
                        className: 'flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        value: value || '',
                        disabled: !isEnabled,
                        onchange: (e: Event) => onChange?.((e.target as HTMLSelectElement).value)
                    });
                    input.appendChild(createElement('option', { value: '', text: 'Select an option', disabled: true, selected: !value }));
                    field.options?.forEach(opt => {
                        input.appendChild(createElement('option', { value: opt.value, text: opt.label, selected: value === opt.value }));
                    });
                }
                break;

            case 'checkbox':
                // Support multiple checkbox options
                if (field.options && field.options.length > 0) {
                    input = createElement('div', { className: 'flex flex-wrap gap-x-4 gap-y-2' });
                    const currentValues = Array.isArray(value) ? value : (value ? [value] : []);
                    field.options.forEach(opt => {
                        const checkboxWrapper = createElement('div', { className: 'flex items-center space-x-2 min-h-touch' });
                        const checkbox = createElement('input', {
                            type: 'checkbox',
                            className: 'h-5 w-5 sm:h-6 sm:w-6 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer',
                            value: opt.value,
                            checked: currentValues.includes(opt.value),
                            disabled: !isEnabled,
                            onchange: (e: Event) => {
                                const checked = (e.target as HTMLInputElement).checked;
                                const optValue = opt.value;
                                let newValues: string[];
                                if (checked) {
                                    newValues = [...currentValues, optValue];
                                } else {
                                    newValues = currentValues.filter(v => v !== optValue);
                                }
                                onChange?.(newValues);
                            }
                        });
                        const checkboxLabel = createElement('label', {
                            className: 'text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                            text: opt.label
                        });
                        checkboxWrapper.appendChild(checkbox);
                        checkboxWrapper.appendChild(checkboxLabel);
                        input.appendChild(checkboxWrapper);
                    });
                } else {
                    // Single checkbox
                    input = createElement('div', { className: 'flex items-center min-h-touch' });
                    const checkbox = createElement('input', {
                        type: 'checkbox',
                        className: 'h-5 w-5 sm:h-6 sm:w-6 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer',
                        checked: !!value,
                        disabled: !isEnabled,
                        onchange: (e: Event) => onChange?.((e.target as HTMLInputElement).checked)
                    });
                    input.appendChild(checkbox);
                }
                break;

            case 'radio':
                input = createElement('div', { className: 'flex flex-wrap gap-x-4 gap-y-2' });
                field.options?.forEach(opt => {
                    const radioWrapper = createElement('div', { className: 'flex items-center space-x-2 min-h-touch' });
                    const radio = createElement('input', {
                        type: 'radio',
                        name: field.id,
                        value: opt.value,
                        checked: value === opt.value,
                        disabled: !isEnabled,
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

            case 'toggle':
                // Toggle switch
                input = createElement('div', { className: 'flex items-center' });
                const toggleLabel = createElement('label', { className: 'relative inline-flex items-center cursor-pointer' });
                const toggleInput = createElement('input', {
                    type: 'checkbox',
                    className: 'sr-only peer',
                    checked: !!value,
                    disabled: !isEnabled,
                    onchange: (e: Event) => onChange?.((e.target as HTMLInputElement).checked)
                });
                const toggleSlider = createElement('div', {
                    className: `w-11 h-6 bg-gray-200 peer-focus:outline-none shadow-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#019FA2] ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`
                });
                toggleLabel.appendChild(toggleInput);
                toggleLabel.appendChild(toggleSlider);
                input.appendChild(toggleLabel);
                break;

            case 'phone':
                // Phone field with ISD selector
                input = this.renderPhoneField(field, value, onChange, isEnabled);
                break;

            default: // text, number, email, date, etc.
                // Get pattern validation if exists
                // Convert validation object to array format for rendering logic
                const fieldValidationArray = Array.isArray(field.validation)
                    ? field.validation
                    : field.validation
                        ? (() => {
                            const obj = field.validation as any;
                            const rules: any[] = [];
                            if (obj.required) rules.push({ type: 'required', value: true });
                            if (obj.regex) rules.push({ type: 'pattern', regex: obj.regex, message: obj.regexMessage });
                            if (obj.minLength !== undefined) rules.push({ type: 'minLength', value: obj.minLength });
                            if (obj.maxLength !== undefined) rules.push({ type: 'maxLength', value: obj.maxLength });
                            if (obj.minSelected !== undefined) rules.push({ type: 'minSelected', value: obj.minSelected });
                            if (obj.maxSelected !== undefined) rules.push({ type: 'maxSelected', value: obj.maxSelected });
                            if (obj.minDate) rules.push({ type: 'minDate', value: obj.minDate });
                            if (obj.maxDate) rules.push({ type: 'maxDate', value: obj.maxDate });
                            return rules;
                        })()
                        : [];
                const patternRule = fieldValidationArray.find((v: any) => v.type === 'pattern');
                const patternRegex = patternRule?.regex;

                input = createElement('input', {
                    type: field.type,
                    className: 'flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    // type: field.type === 'phone' ? 'tel' : field.type,
                    // className: 'flex min-h-touch w-full rounded-md border border-gray-300 bg-background px-3 py-2 text-sm sm:text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none   disabled:cursor-not-allowed disabled:opacity-50',
                    placeholder: field.placeholder,
                    value: value || '',
                    disabled: !isEnabled,
                    min: field.type === 'date' ? (fieldValidationArray.find((v: any) => v.type === 'minDate')?.value as string) : undefined,
                    max: field.type === 'date' ? (fieldValidationArray.find((v: any) => v.type === 'maxDate')?.value as string) : undefined,
                    pattern: patternRegex || undefined, // Apply pattern for both email and text fields
                    oninput: (e: Event) => {
                        const inputValue = (e.target as HTMLInputElement).value;
                        onChange?.(inputValue);

                        // Validate on input for immediate feedback (date, email, or text with pattern)
                        if (validationMsg && (field.type === 'date' || field.type === 'email' || (field.type === 'text' && hasPatternValidation))) {
                            validateField(field, inputValue, input as HTMLInputElement, validationMsg);
                        }
                    },
                    onchange: (e: Event) => {
                        if (validationMsg && (field.type === 'date' || field.type === 'email' || (field.type === 'text' && hasPatternValidation))) {
                            validateField(field, (e.target as HTMLInputElement).value, input as HTMLInputElement, validationMsg);
                        }
                    },
                    onblur: (e: Event) => {
                        // Also validate on blur for better UX
                        if (validationMsg && (field.type === 'date' || field.type === 'email' || (field.type === 'text' && hasPatternValidation))) {
                            validateField(field, (e.target as HTMLInputElement).value, input as HTMLInputElement, validationMsg);
                        }
                    }
                });
        }

        wrapper.appendChild(input);

        // Append validation message after input for date/email/text fields with validation
        if (validationMsg) {
            wrapper.appendChild(validationMsg);
        }

        if (field.description) {
            wrapper.appendChild(createElement('p', { className: 'text-xs sm:text-sm text-muted-foreground mt-1', text: field.description }));
        }

        return wrapper;
    }

    /**
     * Render phone field with ISD selector
     */
    private static renderPhoneField(
        field: FormField,
        value: any,
        onChange?: (val: any) => void,
        isEnabled: boolean = true
    ): HTMLElement {
        // Get ISD config with defaults
        const isdConfig: ISDConfig = field.isd || {
            enabled: true,
            defaultCode: '+91',
            showFlag: true,
            showCountryName: false,
            allowCustomCode: false
        };

        // Parse existing value
        let currentIsd = isdConfig.defaultCode;
        let currentNumber = '';

        if (value) {
            if (typeof value === 'object') {
                currentIsd = value.isd || isdConfig.defaultCode;
                currentNumber = value.number || '';
            } else if (typeof value === 'string') {
                // Try to parse from string (e.g., "+919876543210")
                const match = value.match(/^(\+\d{1,4})(\d+)$/);
                if (match) {
                    const matchedCountry = getCountryByDialCode(match[1]);
                    if (matchedCountry) {
                        currentIsd = match[1];
                        currentNumber = match[2];
                    } else {
                        currentNumber = value;
                    }
                } else {
                    currentNumber = value.replace(/^\+\d{1,4}/, '');
                }
            }
        }

        // Get current country for potential future use
        const currentCountry = getCountryByDialCode(currentIsd) || getDefaultCountry();
        void currentCountry; // Suppress unused warning - reserved for future use

        // Container for the phone input group
        const container = createElement('div', {
            className: 'phone-input-wrapper flex w-full'
        });

        // ISD Selector dropdown
        // Disable dropdown if field is disabled OR if country change is not allowed (isdConfig.enabled = false)
        const isdDisabled = !isEnabled || isdConfig.enabled === false;

        const isdSelector = createElement('select', {
            className: 'phone-isd-selector flex-shrink-0 rounded-l-md border border-r-0 border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
            disabled: isdDisabled,
            onchange: (e: Event) => {
                const newDialCode = (e.target as HTMLSelectElement).value;
                currentIsd = newDialCode;
                // Emit change
                emitChange();
            }
        });

        // Populate ISD options
        // Always show full info in dropdown for easy selection: flag + country name + dial code
        COUNTRY_CODES.forEach((country: CountryCode) => {
            // Full text for dropdown options: 🇮🇳 India (+91)
            const optionText = isdConfig.showFlag
                ? `${country.flag} ${country.name} (${country.dialCode})`
                : `${country.name} (${country.dialCode})`;

            const option = createElement('option', {
                value: country.dialCode,
                text: optionText,
                selected: country.dialCode === currentIsd
            });
            isdSelector.appendChild(option);
        });

        container.appendChild(isdSelector);

        // Phone number input
        const phoneInput = createElement('input', {
            type: 'tel',
            className: 'phone-number-input flex-1 min-h-touch rounded-r-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            placeholder: field.placeholder || 'Enter phone number',
            value: currentNumber,
            disabled: !isEnabled,
            oninput: (e: Event) => {
                // Allow only numbers
                let inputValue = (e.target as HTMLInputElement).value;
                inputValue = inputValue.replace(/[^0-9]/g, '');
                (e.target as HTMLInputElement).value = inputValue;
                currentNumber = inputValue;
                emitChange();
            }
        }) as HTMLInputElement;

        container.appendChild(phoneInput);

        // Helper to emit change
        const emitChange = () => {
            const phoneValue = {
                isd: currentIsd,
                number: currentNumber,
                value: currentNumber ? `${currentIsd}${currentNumber}` : ''
            };
            onChange?.(phoneValue);
        };

        // Auto-focus phone input after ISD change (nice-to-have)
        isdSelector.addEventListener('change', () => {
            phoneInput.focus();
        });

        return container;
    }
}
