import React, { useState } from 'react';
import { FormSchema } from '../core/schemaTypes';
import { FieldRenderer } from './FieldRenderer';
import { clsx } from 'clsx';

interface FormRendererProps {
    schema: FormSchema;
    onSubmit?: (data: Record<string, any>) => void;
    className?: string;
}

export const FormRenderer: React.FC<FormRendererProps> = ({ schema, onSubmit, className }) => {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (fieldId: string, value: any) => {
        setFormData((prev) => ({ ...prev, [fieldId]: value }));
        // Clear error on change
        if (errors[fieldId]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[fieldId];
                return newErrors;
            });
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        schema.sections.forEach((section) => {
            section.fields.forEach((field) => {
                const value = formData[field.id];

                // Required check
                if (field.required && !value) {
                    newErrors[field.id] = 'This field is required';
                    isValid = false;
                }

                // Custom validation rules
                if (field.validation) {
                    field.validation.forEach(rule => {
                        if (rule.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                            newErrors[field.id] = rule.message || 'Invalid email address';
                            isValid = false;
                        }
                        if (rule.type === 'min' && typeof value === 'number' && value < (rule.value as number)) {
                            newErrors[field.id] = rule.message || `Minimum value is ${rule.value}`;
                            isValid = false;
                        }
                        // Add more rules as needed
                    });
                }
            });
        });

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit?.(formData);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={clsx("space-y-8", className)}>
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{schema.title}</h1>
            </div>

            {schema.sections.map((section) => (
                <div key={section.id} className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 border-b pb-2">
                        {section.title}
                    </h2>

                    <div className="grid grid-cols-4 gap-4">
                        {section.fields.map((field) => (
                            <div
                                key={field.id}
                                style={{
                                    gridColumn: field.width === '100%' ? 'span 4' : field.width === '50%' ? 'span 2' : 'span 1',
                                }}
                            >
                                <FieldRenderer
                                    field={field}
                                    value={formData[field.id]}
                                    onChange={(val) => handleChange(field.id, val)}
                                    error={errors[field.id]}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <div className="pt-4">
                <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                    Submit
                </button>
            </div>
        </form>
    );
};
