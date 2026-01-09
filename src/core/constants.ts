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
    phone: { label: 'Phone', placeholder: '+1 234 567 8900', width: '100%', enabled: true, visible: true },
    date: { label: 'Date', width: '50%', enabled: true, visible: true },
    select: { label: 'Dropdown', options: [{ label: 'Option 1', value: 'opt1' }, { label: 'Option 2', value: 'opt2' }], width: '100%', enabled: true, visible: true },
    checkbox: { label: 'Checkbox', options: [{ label: 'Option 1', value: 'opt1' }], width: '100%', enabled: true, visible: true },
    radio: { label: 'Radio Group', options: [{ label: 'Option 1', value: 'opt1' }, { label: 'Option 2', value: 'opt2' }], width: '100%', enabled: true, visible: true },
    toggle: { label: 'Toggle', width: '50%', enabled: true, visible: true },
    file: { label: 'File Upload', width: '100%', enabled: true, visible: true },
};
