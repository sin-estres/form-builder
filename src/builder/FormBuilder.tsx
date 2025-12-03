import React, { useState } from 'react';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    defaultDropAnimationSideEffects,
    DropAnimation,
    closestCorners,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useFormStore } from '../core/useFormStore';
import { Toolbar } from './Toolbar';
import { FieldToolbox } from './FieldToolbox';
import { Canvas } from './Canvas';
import { FieldConfigPanel } from './FieldConfigPanel';
import { SortableField } from './SortableField';
import { SortableSection } from './SortableSection';
import { createPortal } from 'react-dom';
import { FieldType } from '../core/schemaTypes';
import { FormRenderer } from '../renderer/FormRenderer';

const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
};

export const FormBuilder: React.FC = () => {
    const {
        schema,
        addField,
        moveField,
        moveSection,
        isPreviewMode
    } = useFormStore();

    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeData, setActiveData] = useState<any>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setActiveData(event.active.data.current);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeType = active.data.current?.type;
        const overType = over.data.current?.type;

        // If dragging a toolbox item over a section
        if (activeType === 'toolbox-item' && overType === 'section') {
            // We don't need to do anything here, the drop handler will handle the addition
            return;
        }

        // If dragging a field over another field or section
        if (activeType === 'field') {
            // Handled in moveField in store? 
            // Actually moveField in store handles reordering. 
            // But for visual feedback during drag, we might want to update the UI?
            // dnd-kit handles the visual sorting if we use SortableContext correctly.
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setActiveData(null);

        if (!over) return;

        const activeType = active.data.current?.type;
        const overType = over.data.current?.type;

        // 1. Drop Toolbox Item -> Section
        if (activeType === 'toolbox-item') {
            const fieldType = active.data.current?.fieldType as FieldType;

            if (overType === 'section') {
                addField(over.id as string, fieldType);
            } else if (overType === 'field') {
                // Find which section this field belongs to
                const section = schema.sections.find(s => s.fields.some(f => f.id === over.id));
                if (section) {
                    const index = section.fields.findIndex(f => f.id === over.id);
                    addField(section.id, fieldType, index + 1); // Add after the target field
                }
            }
            return;
        }

        // 2. Reorder Sections
        if (activeType === 'section' && overType === 'section') {
            if (active.id !== over.id) {
                moveSection(active.id as string, over.id as string);
            }
            return;
        }

        // 3. Reorder Fields (Same Section or Different Section)
        if (activeType === 'field') {
            const activeFieldId = active.id as string;
            const overId = over.id as string;

            // Find source and destination sections
            const activeSection = schema.sections.find(s => s.fields.some(f => f.id === activeFieldId));

            let overSection;
            if (overType === 'section') {
                overSection = schema.sections.find(s => s.id === overId);
            } else if (overType === 'field') {
                overSection = schema.sections.find(s => s.fields.some(f => f.id === overId));
            }

            if (activeSection && overSection) {
                moveField(activeFieldId, overId, activeSection.id, overSection.id);
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-950">
                <Toolbar />
                <div className="flex flex-1 overflow-hidden">
                    {isPreviewMode ? (
                        <div className="flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center">
                            <div className="w-full max-w-3xl">
                                <FormRenderer schema={schema} onSubmit={(data) => alert(JSON.stringify(data, null, 2))} />
                            </div>
                        </div>
                    ) : (
                        <>
                            <FieldToolbox />
                            <Canvas />
                            <FieldConfigPanel />
                        </>
                    )}
                </div>
            </div>

            {createPortal(
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId && activeData?.type === 'toolbox-item' && (
                        <div className="p-3 bg-white border border-blue-500 rounded shadow-lg w-48">
                            {activeData.fieldType}
                        </div>
                    )}
                    {activeId && activeData?.type === 'field' && (
                        <div className="opacity-80">
                            <SortableField field={activeData.field} />
                        </div>
                    )}
                    {activeId && activeData?.type === 'section' && (
                        <div className="opacity-80">
                            <SortableSection section={activeData.section} />
                        </div>
                    )}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
};
