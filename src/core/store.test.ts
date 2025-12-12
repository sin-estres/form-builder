import { describe, it, expect, beforeEach } from 'vitest';
import { formStore } from './useFormStore';

describe('formStore', () => {
    beforeEach(() => {
        const initialState = {
            id: 'test_form',
            title: 'Test Form',
            formName: 'testForm',
            sections: [],
        };
        formStore.setState({
            schema: initialState,
            history: [initialState],
            historyIndex: 0,
            selectedFieldId: null,
            isPreviewMode: false
        });
    });

    it('should add a section', () => {
        formStore.getState().addSection();
        const state = formStore.getState();
        expect(state.schema.sections).toHaveLength(1);
        expect(state.schema.sections[0].title).toBe('Section 1');
    });

    it('should add a field to a section', () => {
        formStore.getState().addSection();
        const sectionId = formStore.getState().schema.sections[0].id;

        formStore.getState().addField(sectionId, 'text');
        const state = formStore.getState();

        expect(state.schema.sections[0].fields).toHaveLength(1);
        expect(state.schema.sections[0].fields[0].type).toBe('text');
    });

    it('should undo and redo', () => {
        formStore.getState().addSection();
        expect(formStore.getState().schema.sections).toHaveLength(1);

        formStore.getState().undo();
        expect(formStore.getState().schema.sections).toHaveLength(0);

        formStore.getState().redo();
        expect(formStore.getState().schema.sections).toHaveLength(1);
    });

    it('should add fields from a template to a section', () => {
        formStore.getState().addSection();
        const sectionId = formStore.getState().schema.sections[0].id;

        const template = {
            id: 'temp_1',
            title: 'Test Template',
            fields: [
                { id: 'f1', type: 'text', label: 'Field 1' } as any,
                { id: 'f2', type: 'number', label: 'Field 2' } as any
            ]
        };

        formStore.getState().addTemplateFields(sectionId, template);
        const state = formStore.getState();

        expect(state.schema.sections[0].fields).toHaveLength(2);
        expect(state.schema.sections[0].fields[0].label).toBe('Field 1');
        expect(state.schema.sections[0].fields[1].label).toBe('Field 2');
        // IDs should be regenerated
        expect(state.schema.sections[0].fields[0].id).not.toBe('f1');
        expect(state.schema.sections[0].fields[1].id).not.toBe('f2');
    });
});
