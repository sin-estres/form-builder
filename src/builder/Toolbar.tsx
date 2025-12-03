import React from 'react';
import { useFormStore } from '../core/useFormStore';
import { Undo, Redo, Eye, Save, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

export const Toolbar: React.FC = () => {
    const { undo, redo, canUndo, canRedo, setSchema, togglePreview, isPreviewMode } = useFormStore();

    const handleSave = () => {
        const schema = useFormStore.getState().schema;
        console.log('Saved Schema:', JSON.stringify(schema, null, 2));
        alert('Schema saved to console!');
    };

    const handleClear = () => {
        if (confirm('Are you sure you want to clear the form?')) {
            setSchema({
                id: 'form_' + Date.now(),
                title: 'New Form',
                sections: []
            });
        }
    };

    return (
        <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mr-4">
                    FormBuilder Pro
                </h1>
                <button
                    onClick={undo}
                    disabled={!canUndo()}
                    className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Undo"
                >
                    <Undo size={18} />
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo()}
                    className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Redo"
                >
                    <Redo size={18} />
                </button>
            </div>
            <div className="flex items-center space-x-2">
                <button
                    onClick={handleClear}
                    className="flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                    <Trash2 size={16} className="mr-2" />
                    Clear
                </button>
                <button
                    onClick={togglePreview}
                    className={clsx(
                        "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                        isPreviewMode
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                            : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                >
                    <Eye size={16} className="mr-2" />
                    {isPreviewMode ? 'Edit' : 'Preview'}
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                >
                    <Save size={16} className="mr-2" />
                    Save
                </button>
            </div>
        </div>
    );
};
