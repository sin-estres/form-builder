import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useFormStore } from '../core/useFormStore';
import { SortableSection } from './SortableSection';
import { Plus } from 'lucide-react';

export const Canvas: React.FC = () => {
    const { schema, addSection, selectField } = useFormStore();

    const { setNodeRef } = useDroppable({
        id: 'canvas',
        data: {
            type: 'canvas',
        },
    });

    return (
        <div
            className="flex-1 bg-gray-100 dark:bg-gray-950 p-8 overflow-y-auto h-full"
            onClick={() => selectField(null)} // Deselect on clicking background
        >
            <div className="max-w-3xl mx-auto">
                <div className="mb-8 text-center">
                    <input
                        value={schema.title}
                        onChange={(e) => useFormStore.getState().setSchema({ ...schema, title: e.target.value })}
                        className="text-3xl font-bold text-center bg-transparent border-none focus:outline-none focus:ring-0 w-full text-gray-900 dark:text-white"
                        placeholder="Form Title"
                    />
                </div>

                <div ref={setNodeRef} className="space-y-6 min-h-[200px]">
                    <SortableContext
                        items={schema.sections.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {schema.sections.map((section) => (
                            <SortableSection key={section.id} section={section} />
                        ))}
                    </SortableContext>
                </div>

                <button
                    onClick={addSection}
                    className="w-full mt-6 py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center font-medium"
                >
                    <Plus size={20} className="mr-2" />
                    Add Section
                </button>
            </div>
        </div>
    );
};
