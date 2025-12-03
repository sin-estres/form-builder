import { FieldType, FormField } from './schemaTypes';
import { v4 as uuidv4 } from 'uuid'; // We might need uuid, but for now I'll use a simple generator or just Date.now() if uuid isn't installed. Wait, I didn't install uuid. I'll use a helper.

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
    { type: 'text', label: 'Text Input', icon: 'Type' },
    { type: 'textarea', label: 'Text Area', icon: 'AlignLeft' },
    { type: 'number', label: 'Number', icon: 'Hash' },
    { type: 'email', label: 'Email', icon: 'Mail' },
    { type: 'phone', label: 'Phone', icon: 'Phone' },
    { type: 'date', label: 'Date Picker', icon: 'Calendar' },
    { type: 'select', label: 'Dropdown', icon: 'ChevronDown' },
    { type: 'checkbox', label: 'Checkbox', icon: 'CheckSquare' },
    { type: 'radio', label: 'Radio Group', icon: 'CircleDot' },
    { type: 'toggle', label: 'Toggle', icon: 'ToggleLeft' }, // Lucide icon names, will be mapped later
    { type: 'file', label: 'File Upload', icon: 'Upload' },
];

export const DEFAULT_FIELD_CONFIG: Record<FieldType, Partial<FormField>> = {
    text: { label: 'Text Input', placeholder: 'Enter text...', width: '100%' },
    textarea: { label: 'Text Area', placeholder: 'Enter description...', width: '100%' },
    number: { label: 'Number', placeholder: '0', width: '50%' },
    email: { label: 'Email', placeholder: 'example@email.com', width: '100%', validation: [{ type: 'email', message: 'Invalid email' }] },
    phone: { label: 'Phone', placeholder: '+1 234 567 8900', width: '100%' },
    date: { label: 'Date', width: '50%' },
    select: { label: 'Dropdown', options: [{ label: 'Option 1', value: 'opt1' }, { label: 'Option 2', value: 'opt2' }], width: '100%' },
    checkbox: { label: 'Checkbox', width: '100%' },
    radio: { label: 'Radio Group', options: [{ label: 'Option 1', value: 'opt1' }, { label: 'Option 2', value: 'opt2' }], width: '100%' },
    toggle: { label: 'Toggle', width: '50%' },
    file: { label: 'File Upload', width: '100%' },
};
