import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { FIELD_TYPES } from '../core/constants';
import * as Icons from 'lucide-react';
import { FieldType } from '../core/schemaTypes';

// Helper to get icon component dynamically
const getIcon = (name: string) => {
    const Icon = (Icons as any)[name];
    return Icon ? <Icon size={16} /> : null;
};

interface ToolboxItemProps {
    type: FieldType;
    label: string;
    icon: string;
}

const ToolboxItem: React.FC<ToolboxItemProps> = ({ type, label, icon }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `toolbox-${type}`,
        data: {
            type: 'toolbox-item',
            fieldType: type,
        },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={style}
            className="flex items-center p-3 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-move hover:border-blue-500 hover:shadow-sm transition-all"
        >
            <span className="mr-3 text-gray-500 dark:text-gray-400">{getIcon(icon)}</span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
        </div>
    );
};

export const FieldToolbox: React.FC = () => {
    return (
        <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 overflow-y-auto h-full">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Form Fields
            </h2>
            <div className="space-y-1">
                {FIELD_TYPES.map((field) => (
                    <ToolboxItem
                        key={field.type}
                        type={field.type}
                        label={field.label}
                        icon={field.icon}
                    />
                ))}
            </div>
        </div>
    );
};
