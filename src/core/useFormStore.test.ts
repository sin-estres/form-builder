import { describe, it, expect, beforeEach } from 'vitest';
import { useFormStore } from './useFormStore';

describe('useFormStore', () => {
    beforeEach(() => {
        const initialState = {
            id: 'test_form',
            title: 'Test Form',
            sections: [],
        };
        useFormStore.setState({
            schema: initialState,
            history: [initialState],
            historyIndex: 0,
        });
    });

    it('should add a section', () => {
        const store = useFormStore.getState();
        store.addSection();

        const { schema } = useFormStore.getState();
        expect(schema.sections).toHaveLength(1);
        expect(schema.sections[0].title).toBe('Section 1');
    });

    it('should add a field to a section', () => {
        const store = useFormStore.getState();
        store.addSection();
        const sectionId = useFormStore.getState().schema.sections[0].id;

        store.addField(sectionId, 'text');

        const { schema } = useFormStore.getState();
        expect(schema.sections[0].fields).toHaveLength(1);
        expect(schema.sections[0].fields[0].type).toBe('text');
    });

    it('should update a field', () => {
        const store = useFormStore.getState();
        store.addSection();
        const sectionId = useFormStore.getState().schema.sections[0].id;
        store.addField(sectionId, 'text');
        const fieldId = useFormStore.getState().schema.sections[0].fields[0].id;

        store.updateField(fieldId, { label: 'Updated Label' });

        const { schema } = useFormStore.getState();
        expect(schema.sections[0].fields[0].label).toBe('Updated Label');
    });

    it('should undo and redo changes', () => {
        const store = useFormStore.getState();
        store.addSection(); // Action 1

        expect(store.canUndo()).toBe(true);

        store.undo();
        expect(useFormStore.getState().schema.sections).toHaveLength(0);

        expect(store.canRedo()).toBe(true);

        store.redo();
        expect(useFormStore.getState().schema.sections).toHaveLength(1);
    });
});
