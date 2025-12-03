import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormField } from '../core/schemaTypes';
import { FieldRenderer } from '../renderer/FieldRenderer';
import { useFormStore } from '../core/useFormStore';
import { GripVertical, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface SortableFieldProps {
    field: FormField;
}

export const SortableField: React.FC<SortableFieldProps> = ({ field }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: field.id,
        data: {
            type: 'field',
            field,
        },
    });

    const { selectField, selectedFieldId, removeField } = useFormStore();
    const isSelected = selectedFieldId === field.id;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        gridColumn: field.width === '100%' ? 'span 4' : field.width === '50%' ? 'span 2' : 'span 1',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "relative group rounded-lg border-2 transition-all bg-white dark:bg-gray-800",
                isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600",
                isDragging && "opacity-50 z-50"
            )}
            onClick={(e) => {
                e.stopPropagation();
                selectField(field.id);
            }}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className={clsx(
                    "absolute top-2 left-2 cursor-move p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity",
                    isSelected && "opacity-100"
                )}
            >
                <GripVertical size={16} />
            </div>

            {/* Delete Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    removeField(field.id);
                }}
                className={clsx(
                    "absolute top-2 right-2 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity",
                    isSelected && "opacity-100"
                )}
            >
                <Trash2 size={16} />
            </button>

            {/* Field Content */}
            <div className="p-4 pointer-events-none">
                <FieldRenderer field={field} readOnly />
            </div>
        </div>
    );
};
