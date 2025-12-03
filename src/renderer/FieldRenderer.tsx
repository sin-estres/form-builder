import React from 'react';
import { FormField } from '../core/schemaTypes';
import { clsx } from 'clsx';

interface FieldRendererProps {
    field: FormField;
    value?: any;
    onChange?: (value: any) => void;
    readOnly?: boolean;
    error?: string;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, onChange, readOnly, error }) => {
    const baseInputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    const renderInput = () => {
        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
            case 'number':
            case 'date':
            case 'file':
                return (
                    <input
                        type={field.type === 'phone' ? 'tel' : field.type}
                        id={field.id}
                        placeholder={field.placeholder}
                        className={baseInputClass}
                        value={value || ''}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={readOnly}
                    />
                );
            case 'textarea':
                return (
                    <textarea
                        id={field.id}
                        placeholder={field.placeholder}
                        className={clsx(baseInputClass, "min-h-[80px]")}
                        value={value || ''}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={readOnly}
                    />
                );
            case 'select':
                return (
                    <select
                        id={field.id}
                        className={baseInputClass}
                        value={value || ''}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={readOnly}
                    >
                        <option value="" disabled>Select an option</option>
                        {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                );
            case 'checkbox':
                return (
                    <div className="flex items-center h-10">
                        <input
                            type="checkbox"
                            id={field.id}
                            className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            checked={!!value}
                            onChange={(e) => onChange?.(e.target.checked)}
                            disabled={readOnly}
                        />
                    </div>
                );
            case 'radio':
                return (
                    <div className="space-y-2">
                        {field.options?.map((opt) => (
                            <div key={opt.value} className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id={`${field.id}-${opt.value}`}
                                    name={field.id}
                                    value={opt.value}
                                    checked={value === opt.value}
                                    onChange={(e) => onChange?.(e.target.value)}
                                    disabled={readOnly}
                                    className="aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <label htmlFor={`${field.id}-${opt.value}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {opt.label}
                                </label>
                            </div>
                        ))}
                    </div>
                );
            case 'toggle':
                return (
                    <div className="flex items-center space-x-2">
                        <button
                            type="button"
                            role="switch"
                            aria-checked={!!value}
                            onClick={() => !readOnly && onChange?.(!value)}
                            className={clsx(
                                "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                value ? "bg-primary" : "bg-input"
                            )}
                            disabled={readOnly}
                        >
                            <span
                                className={clsx(
                                    "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                                    value ? "translate-x-5" : "translate-x-0"
                                )}
                            />
                        </button>
                    </div>
                );
            default:
                return <div className="text-red-500">Unknown field type: {field.type}</div>;
        }
    };

    return (
        <div className="w-full">
            <label htmlFor={field.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block text-gray-900 dark:text-gray-100">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderInput()}
            {field.description && (
                <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
            )}
            {error && (
                <p className="text-sm font-medium text-destructive mt-1">{error}</p>
            )}
        </div>
    );
};
