import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy } from '@dnd-kit/sortable';
import { FormSection } from '../core/schemaTypes';
import { SortableField } from './SortableField';
import { useFormStore } from '../core/useFormStore';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useDroppable } from '@dnd-kit/core';

interface SortableSectionProps {
    section: FormSection;
}

export const SortableSection: React.FC<SortableSectionProps> = ({ section }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: section.id,
        data: {
            type: 'section',
            section,
        },
    });

    const { removeSection, updateSection } = useFormStore();

    // Make the section droppable for fields
    const { setNodeRef: setDroppableNodeRef } = useDroppable({
        id: section.id,
        data: {
            type: 'section',
            section,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={clsx(
                "mb-6 rounded-lg border bg-white dark:bg-gray-900 shadow-sm transition-all",
                isDragging ? "opacity-50 z-50 border-blue-500" : "border-gray-200 dark:border-gray-800"
            )}
        >
            {/* Section Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
                <div className="flex items-center flex-1">
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-move mr-3 text-gray-400 hover:text-gray-600"
                    >
                        <GripVertical size={20} />
                    </div>
                    <input
                        value={section.title}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                        className="bg-transparent font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:border-b border-blue-500"
                        placeholder="Section Title"
                    />
                </div>
                <button
                    onClick={() => removeSection(section.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Section Body (Grid for Fields) */}
            <div
                ref={setDroppableNodeRef}
                className="p-4 min-h-[100px] grid grid-cols-4 gap-4"
            >
                <SortableContext
                    items={section.fields.map((f) => f.id)}
                    strategy={rectSortingStrategy} // Use rect strategy for grid
                >
                    {section.fields.map((field) => (
                        <SortableField key={field.id} field={field} />
                    ))}
                </SortableContext>

                {section.fields.length === 0 && (
                    <div className="col-span-4 flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-400">
                        <p className="text-sm">Drop fields here</p>
                    </div>
                )}
            </div>
        </div>
    );
};
