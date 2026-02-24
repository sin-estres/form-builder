import { FormField, ISDConfig, FieldValidations } from '../core/schemaTypes';
import { createElement } from '../utils/dom';
import { COUNTRY_CODES, getCountryByDialCode, getDefaultCountry, CountryCode } from '../core/countryData';

/** Get validation rules from field.validations (preferred) or field.validation (legacy) */
function getValidationRules(field: FormField): {
    required?: boolean;
    pattern?: string;
    patternMessage?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    minDate?: string;
    maxDate?: string;
} {
    const v = field.validations;
    if (v) {
        return {
            required: v.required,
            pattern: v.pattern,
            patternMessage: v.customErrorMessages?.pattern,
            minLength: v.minLength,
            maxLength: v.maxLength,
            min: v.min,
            max: v.max,
            minDate: v.minDate,
            maxDate: v.maxDate
        };
    }
    const val = field.validation;
    if (!val) return {};
    if (Array.isArray(val)) {
        const rules: any = {};
        val.forEach((r: any) => {
            if (r.type === 'required') rules.required = true;
            else if (r.type === 'pattern') {
                rules.pattern = r.regex;
                rules.patternMessage = r.message;
            }
            else if (r.type === 'minLength') rules.minLength = r.value;
            else if (r.type === 'maxLength') rules.maxLength = r.value;
            else if (r.type === 'min') rules.min = r.value;
            else if (r.type === 'max') rules.max = r.value;
            else if (r.type === 'minDate') rules.minDate = r.value;
            else if (r.type === 'maxDate') rules.maxDate = r.value;
        });
        return rules;
    }
    const o = val as any;
    return {
        required: o.required,
        pattern: o.regex,
        patternMessage: o.regexMessage,
        minLength: o.minLength,
        maxLength: o.maxLength,
        min: o.min,
        max: o.max,
        minDate: o.minDate,
        maxDate: o.maxDate
    };
}

/** Check if field is numeric text (postal, phone, OTP) - must use type="text" to preserve leading zeros */
function isNumericTextField(field: FormField): boolean {
    const v = field.validations;
    return !!(v?.validationType && ['postalCode', 'phoneNumber', 'otp'].includes(v.validationType));
}

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

        const validationRules = getValidationRules(field);
        const hasPatternValidation = !!validationRules.pattern;
        const hasNumericTextValidation = isNumericTextField(field);

        // Create validation message container for date/email/text/number fields with validation
        if (field.type === 'date' || field.type === 'email' || field.type === 'number' ||
            (field.type === 'text' && (hasPatternValidation || hasNumericTextValidation || validationRules.minLength !== undefined || validationRules.maxLength !== undefined))) {
            validationMsg = createElement('div', { className: 'text-xs text-red-600 dark:text-red-400 mt-1 hidden', id: `validation-${field.id}` });
        }

        // Validation helper function (uses validationRules from getValidationRules)
        const validateField = (f: FormField, value: string, inputElement: HTMLInputElement, msgEl: HTMLElement) => {
            const rules = getValidationRules(f);
            const custom = f.validations?.customErrorMessages;
            let errorMessage = '';

            // Required
            if (rules.required && (!value || String(value).trim() === '')) {
                errorMessage = custom?.required || 'This field is required';
            }

            // Date validation
            if (!errorMessage && f.type === 'date' && value) {
                const inputDate = new Date(value);
                if (rules.minDate) {
                    const minDate = new Date(rules.minDate);
                    if (inputDate < minDate) {
                        errorMessage = 'Date must be after the minimum date';
                    }
                }
                if (!errorMessage && rules.maxDate) {
                    const maxDate = new Date(rules.maxDate);
                    if (inputDate > maxDate) {
                        errorMessage = 'Date must be before the maximum date';
                    }
                }
            }

            // Pattern/regex validation (for email, text, phone)
            if (!errorMessage && (f.type === 'email' || f.type === 'text' || f.type === 'phone') && value && rules.pattern) {
                try {
                    if (!new RegExp(rules.pattern).test(value)) {
                        errorMessage = rules.patternMessage || custom?.pattern || 'Invalid format';
                    }
                } catch (_e) { /* invalid regex */ }
            }

            // Length validation (text, numeric text)
            if (!errorMessage && value && (f.type === 'text' || f.type === 'phone')) {
                const len = String(value).length;
                if (rules.minLength !== undefined && len < rules.minLength) {
                    errorMessage = custom?.minLength || `Minimum length is ${rules.minLength}`;
                }
                if (!errorMessage && rules.maxLength !== undefined && len > rules.maxLength) {
                    errorMessage = custom?.maxLength || `Maximum length is ${rules.maxLength}`;
                }
            }

            // Number min/max and allowNegative validation
            if (!errorMessage && f.type === 'number' && value !== '' && value !== undefined) {
                const num = parseFloat(String(value));
                if (!isNaN(num)) {
                    if (f.validations?.allowNegative === false && num < 0) {
                        errorMessage = custom?.min || 'Negative values are not allowed';
                    }
                    if (!errorMessage && rules.min !== undefined && num < rules.min) {
                        errorMessage = custom?.min || `Value must be at least ${rules.min}`;
                    }
                    if (!errorMessage && rules.max !== undefined && num > rules.max) {
                        errorMessage = custom?.max || `Value must be at most ${rules.max}`;
                    }
                }
            }

            if (errorMessage) {
                msgEl.textContent = errorMessage;
                msgEl.classList.remove('hidden');
                inputElement.classList.add('border-red-500');
            } else {
                msgEl.classList.add('hidden');
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

            case 'image':
                // Image field: upload, preview, remove/replace
                input = this.renderImageField(field, value ?? field.imageUrl ?? field.defaultValue, onChange, isEnabled);
                break;

            default: // text, number, email, date, etc.
                const rules = getValidationRules(field);
                // For postal, phone, OTP: use type="text" to preserve leading zeros; prevent scientific notation (e, +, -)
                const useNumericTextInput = field.type === 'text' && isNumericTextField(field);
                const inputType = useNumericTextInput ? 'text' : (field.type === 'number' ? 'number' : field.type);

                const runValidation = () => {
                    if (validationMsg && (field.type === 'date' || field.type === 'email' || field.type === 'text' || field.type === 'number')) {
                        validateField(field, (input as HTMLInputElement).value, input as HTMLInputElement, validationMsg);
                    }
                };

                input = createElement('input', {
                    type: inputType,
                    ...(useNumericTextInput && { inputmode: 'numeric' }),
                    className: 'flex min-h-touch w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    placeholder: field.placeholder,
                    value: value || '',
                    disabled: !isEnabled,
                    min: field.type === 'date' ? rules.minDate : (field.type === 'number' ? (rules.min !== undefined ? String(rules.min) : undefined) : undefined),
                    max: field.type === 'date' ? rules.maxDate : (field.type === 'number' ? (rules.max !== undefined ? String(rules.max) : undefined) : undefined),
                    pattern: !useNumericTextInput ? (rules.pattern || undefined) : undefined,
                    oninput: (e: Event) => {
                        const inputEl = e.target as HTMLInputElement;
                        let inputValue = inputEl.value;
                        // Prevent scientific notation (e, E, +, -) for numeric text fields (postal, phone, OTP)
                        if (useNumericTextInput) {
                            inputValue = inputValue.replace(/[eE+-]/g, '');
                            inputEl.value = inputValue;
                        }
                        onChange?.(inputValue);
                        runValidation();
                    },
                    onchange: () => runValidation(),
                    onblur: () => runValidation()
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

    /**
     * Render image field with upload, preview, and remove/replace
     */
    private static renderImageField(
        field: FormField,
        imageValue: string | undefined,
        onChange?: (val: string | undefined) => void,
        isEnabled: boolean = true
    ): HTMLElement {
        const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
        const MAX_SIZE_MB = 5;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

        const container = createElement('div', { className: 'image-field-wrapper flex flex-col gap-3 w-full' });

        // Preview area
        const previewWrap = createElement('div', {
            className: 'relative rounded-md border border-input bg-gray-50 dark:bg-gray-800 overflow-hidden min-h-[100px] flex items-center justify-center'
        });

        if (imageValue) {
            const img = createElement('img', {
                src: imageValue,
                alt: field.label || 'Uploaded image',
                className: 'max-h-48 max-w-full object-contain'
            }) as HTMLImageElement;
            img.onerror = () => {
                previewWrap.innerHTML = '';
                previewWrap.appendChild(createElement('p', {
                    className: 'text-xs text-red-500 p-4',
                    text: 'Failed to load image'
                }));
            };
            previewWrap.appendChild(img);

            if (isEnabled) {
                const removeBtn = createElement('button', {
                    type: 'button',
                    className: 'absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-xs',
                    title: 'Remove image',
                    onclick: () => onChange?.(undefined)
                });
                removeBtn.innerHTML = '×';
                previewWrap.appendChild(removeBtn);
            }
        } else {
            previewWrap.appendChild(createElement('p', {
                className: 'text-xs text-muted-foreground p-4',
                text: 'No image uploaded'
            }));
        }

        container.appendChild(previewWrap);

        // Upload input (hidden)
        if (isEnabled) {
            const fileInput = createElement('input', {
                type: 'file',
                accept: ACCEPT,
                className: 'hidden',
                id: `image-upload-${field.id}`
            }) as HTMLInputElement;

            const uploadBtn = createElement('button', {
                type: 'button',
                className: 'px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                text: imageValue ? 'Replace' : 'Upload Image',
                onclick: () => fileInput.click()
            });

            fileInput.onchange = (e: Event) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (!file) return;

                if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
                    alert(`Please select a valid image (JPG, PNG, GIF, WebP)`);
                    target.value = '';
                    return;
                }
                if (file.size > MAX_SIZE_BYTES) {
                    alert(`Image must be under ${MAX_SIZE_MB}MB`);
                    target.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    if (result) onChange?.(result);
                };
                reader.onerror = () => {
                    alert('Failed to read image');
                };
                reader.readAsDataURL(file);
                target.value = '';
            };

            container.appendChild(fileInput);
            container.appendChild(uploadBtn);
        }

        return container;
    }
}
