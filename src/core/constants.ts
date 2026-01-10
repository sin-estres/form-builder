import { FieldType, FormField } from './schemaTypes';

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
    { type: 'text', label: 'Text Input', icon: 'Type' },
    { type: 'textarea', label: 'Text Area', icon: 'DocumentText' },
    { type: 'number', label: 'Number', icon: 'Hash' },
    { type: 'email', label: 'Email', icon: 'Mail' },
    { type: 'phone', label: 'Phone', icon: 'Phone' },
    { type: 'date', label: 'Date Picker', icon: 'Calendar' },
    { type: 'select', label: 'Dropdown', icon: 'ListBullet' },
    { type: 'checkbox', label: 'Checkbox', icon: 'CheckSquare' },
    { type: 'radio', label: 'Radio Group', icon: 'CircleDot' },
    { type: 'toggle', label: 'Toggle', icon: 'ToggleSwitch' },
    { type: 'file', label: 'File Upload', icon: 'Upload' },
];

export const DEFAULT_FIELD_CONFIG: Record<FieldType, Partial<FormField>> = {
    text: { label: 'Text Input', placeholder: 'Enter text...', width: '100%', enabled: true, visible: true },
    textarea: { label: 'Text Area', placeholder: 'Enter description...', width: '100%', enabled: true, visible: true },
    number: { label: 'Number', placeholder: '0', width: '50%', enabled: true, visible: true },
    email: { label: 'Email', placeholder: 'example@email.com', width: '100%', validation: [{ type: 'pattern', regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', message: 'Invalid email format' }], enabled: true, visible: true },
    phone: {
        label: 'Phone',
        placeholder: 'Enter phone number',
        width: '100%',
        enabled: true,
        visible: true,
        isd: {
            enabled: true,
            defaultCode: '+91',
            showFlag: true,
            showCountryName: false,
            allowCustomCode: false
        }
    },
    date: { label: 'Date', width: '50%', enabled: true, visible: true },
    select: { label: 'Dropdown', options: [], width: '100%', enabled: true, visible: true, optionSource: 'STATIC' as const },
    checkbox: { label: 'Checkbox', options: [], width: '100%', enabled: true, visible: true },
    radio: { label: 'Radio Group', options: [], width: '100%', enabled: true, visible: true },
    toggle: { label: 'Toggle', width: '50%', enabled: true, visible: true },
    file: { label: 'File Upload', width: '100%', enabled: true, visible: true },
};

export interface RegexPreset {
    id: string;
    label: string;
    description: string;
    pattern: string;
    validExamples: string[];
    invalidExamples: string[];
    errorMessage: string;
}

export const REGEX_PRESETS: RegexPreset[] = [
    {
        id: 'website-url',
        label: 'Website URL',
        description: 'Use when the text field is intended to capture a website or domain name.',
        pattern: '^(https?:\\/\\/)?(www\\.)?([a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}(\\/.*)?$',
        validExamples: [
            'https://example.com',
            'http://www.example.com',
            'www.example.com',
            'example.com',
            'subdomain.example.co.uk'
        ],
        invalidExamples: [
            'not-a-url',
            'example',
            'http://',
            '.com',
            'example.'
        ],
        errorMessage: 'Please enter a valid website URL'
    },
    {
        id: 'pan-card',
        label: 'PAN Card (India)',
        description: 'Use for validating Indian PAN numbers.',
        pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$',
        validExamples: [
            'ABCDE1234F',
            'XYZAB5678C',
            'PQRST9012M'
        ],
        invalidExamples: [
            'ABCD1234F',
            'ABCDE12345F',
            'abcde1234f',
            'ABCDE1234',
            '1234567890'
        ],
        errorMessage: 'Please enter a valid PAN card number (e.g., ABCDE1234F)'
    },
    {
        id: 'phone-number',
        label: 'Phone Number',
        description: 'Use for validating 10-digit mobile numbers (India).',
        pattern: '^[6-9]\\d{9}$',
        validExamples: [
            '9876543210',
            '8765432109',
            '7654321098',
            '6543210987'
        ],
        invalidExamples: [
            '1234567890',
            '987654321',
            '98765432101',
            'abc1234567',
            '98765-43210'
        ],
        errorMessage: 'Please enter a valid 10-digit mobile number starting with 6-9'
    },
    {
        id: 'aadhaar-number',
        label: 'Aadhaar Number (India)',
        description: 'Use for validating 12-digit Aadhaar numbers.',
        pattern: '^\\d{12}$',
        validExamples: [
            '123456789012',
            '987654321098',
            '111122223333'
        ],
        invalidExamples: [
            '12345678901',
            '1234567890123',
            '1234-5678-9012',
            'abcdefghijkl',
            '12345678901a'
        ],
        errorMessage: 'Please enter a valid 12-digit Aadhaar number'
    },
    {
        id: 'gst-number',
        label: 'GST Number (India)',
        description: 'Use for validating Indian GSTIN.',
        pattern: '^\\d{2}[A-Z]{5}\\d{4}[A-Z][A-Z\\d]Z[A-Z\\d]$',
        validExamples: [
            '27ABCDE1234F1Z5',
            '29FGHIJ5678K2M6',
            '33PQRST9012L3N7'
        ],
        invalidExamples: [
            '27ABCDE1234F1Z',
            'ABCDE1234F1Z5',
            '27abcde1234f1z5',
            '27ABCDE12345F1Z5',
            '123456789012345'
        ],
        errorMessage: 'Please enter a valid GST number (e.g., 27ABCDE1234F1Z5)'
    }
];
