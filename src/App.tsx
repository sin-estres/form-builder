import React from 'react';
import { FormBuilder } from './builder/FormBuilder';
import { useFormStore } from './core/useFormStore';

function App() {
    const { schema } = useFormStore();

    return (
        <div className="flex h-screen w-full">
            {/* Main Builder Area */}
            <div className="flex-1 h-full">
                <FormBuilder />
            </div>

            {/* JSON Preview Sidebar (Rightmost) - Only visible in Edit mode usually, but prompt asked for "Right-side JSON Preview" */}
            {/* Since FormBuilder already has a right panel (Config), maybe we put this below or make it toggleable? */}
            {/* The prompt said: "Right-side JSON Preview (Live updating)". And "Field Configuration Panel" is also "Right panel". */}
            {/* Maybe I should put JSON preview in a separate tab or below the config panel? */}
            {/* Or maybe the "Right panel" is split? */}
            {/* I'll add a JSON preview panel to the right of the Config Panel, or make the Config Panel switchable. */}
            {/* For now, I'll render it as a separate column for the demo app to satisfy the requirement "Show real-time JSON output". */}

            <div className="w-80 bg-gray-900 text-gray-300 p-4 overflow-auto border-l border-gray-700 hidden xl:block">
                <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Live JSON Preview</h3>
                <pre className="text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(schema, null, 2)}
                </pre>
            </div>
        </div>
    );
}

export default App;
