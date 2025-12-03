import React from 'react';
import { useFormStore } from '../core/useFormStore';
import { FieldWidth, ValidationRule } from '../core/schemaTypes';
import { X } from 'lucide-react';

export const FieldConfigPanel: React.FC = () => {
    const { schema, selectedFieldId, updateField, selectField } = useFormStore();

    const selectedField = React.useMemo(() => {
        if (!selectedFieldId) return null;
        for (const section of schema.sections) {
            const field = section.fields.find((f) => f.id === selectedFieldId);
            if (field) return field;
        }
        return null;
    }, [schema, selectedFieldId]);

    if (!selectedField) {
        return (
            <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center justify-center text-center text-gray-500">
                <p>Select a field to configure its properties</p>
            </div>
        );
    }

    const handleValidationChange = (type: ValidationRule['type'], value: any, checked: boolean) => {
        const currentValidation = selectedField.validation || [];
        if (checked) {
            updateField(selectedField.id, { validation: [...currentValidation, { type, value }] });
        } else {
            updateField(selectedField.id, { validation: currentValidation.filter(v => v.type !== type) });
        }
    };

    return (
        <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-white">Field Settings</h2>
                <button onClick={() => selectField(null)} className="text-gray-500 hover:text-gray-700">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* General Settings */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label</label>
                        <input
                            type="text"
                            value={selectedField.label}
                            onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Placeholder</label>
                        <input
                            type="text"
                            value={selectedField.placeholder || ''}
                            onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                        <textarea
                            value={selectedField.description || ''}
                            onChange={(e) => updateField(selectedField.id, { description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                            rows={2}
                        />
                    </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-800" />

                {/* Layout Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Layout</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Width</label>
                        <select
                            value={selectedField.width}
                            onChange={(e) => updateField(selectedField.id, { width: e.target.value as FieldWidth })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
                        >
                            <option value="25%">25% (1/4)</option>
                            <option value="50%">50% (1/2)</option>
                            <option value="100%">100% (Full)</option>
                        </select>
                    </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-800" />

                {/* Validation Settings */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">Validation</h3>

                    <div className="flex items-center justify-between">
                        <label className="text-sm text-gray-700 dark:text-gray-300">Required</label>
                        <input
                            type="checkbox"
                            checked={selectedField.required || false}
                            onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Options (for Select, Radio, etc.) */}
                {(selectedField.type === 'select' || selectedField.type === 'radio') && (
                    <>
                        <hr className="border-gray-200 dark:border-gray-800" />
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Options</h3>
                            {selectedField.options?.map((option, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        placeholder="Label"
                                        value={option.label}
                                        onChange={(e) => {
                                            const newOptions = [...(selectedField.options || [])];
                                            newOptions[index].label = e.target.value;
                                            updateField(selectedField.id, { options: newOptions });
                                        }}
                                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm"
                                    />
                                    <input
                                        placeholder="Value"
                                        value={option.value}
                                        onChange={(e) => {
                                            const newOptions = [...(selectedField.options || [])];
                                            newOptions[index].value = e.target.value;
                                            updateField(selectedField.id, { options: newOptions });
                                        }}
                                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm"
                                    />
                                    <button
                                        onClick={() => {
                                            const newOptions = selectedField.options?.filter((_, i) => i !== index);
                                            updateField(selectedField.id, { options: newOptions });
                                        }}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const newOptions = [...(selectedField.options || []), { label: 'New Option', value: 'new_option' }];
                                    updateField(selectedField.id, { options: newOptions });
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                + Add Option
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
