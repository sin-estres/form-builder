/**
 * TC-S1, TC-S2: Section Configuration Test Cases
 * 
 * TC-S1: Section Name & Metadata
 * TC-S2: Multiple Sections Rendering
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formStore } from '../core/useFormStore';
import { FormBuilder } from '../builder/FormBuilder';
import {
    resetFormStore,
    createTestContainer,
    cleanupTestContainer,
    waitForDOMUpdate,
    getSectionById,
    countSections,
} from './utils/test-helpers';

describe('Section Configuration Tests', () => {
    let container: HTMLElement;
    let builder: FormBuilder;

    beforeEach(() => {
        resetFormStore();
        container = createTestContainer();
        builder = new FormBuilder(container, {});
    });

    afterEach(() => {
        cleanupTestContainer();
    });

    describe('TC-S1: Section Name & Metadata', () => {
        it('should create section with default title', async () => {
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections).toHaveLength(1);
            expect(state.schema.sections[0].title).toBe('Section 1');
        });

        it('should update section title', async () => {
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().updateSection(sectionId, { title: 'Personal Information' });
            await waitForDOMUpdate();

            const section = getSectionById(sectionId);
            expect(section?.title).toBe('Personal Information');
        });

        it('should set section order', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const state = formStore.getState();
            state.schema.sections.forEach((section, index) => {
                expect(section.order).toBe(index);
            });
        });

        it('should update section columns (legacy)', async () => {
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().updateSection(sectionId, { columns: 2 });
            await waitForDOMUpdate();

            const section = getSectionById(sectionId);
            expect(section?.columns).toBe(2);
        });

        it('should update section layout.columns', async () => {
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().updateSection(sectionId, {
                layout: { type: 'grid', columns: 6, gap: '20px' },
            });
            await waitForDOMUpdate();

            const section = getSectionById(sectionId);
            expect(section?.layout?.columns).toBe(6);
            expect(section?.layout?.gap).toBe('20px');
        });

        it('should set section CSS class', async () => {
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().updateSection(sectionId, {
                css: { class: 'custom-section-class' },
            });
            await waitForDOMUpdate();

            const section = getSectionById(sectionId);
            expect(section?.css?.class).toBe('custom-section-class');
        });

        it('should set section CSS style', async () => {
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().updateSection(sectionId, {
                css: { style: { backgroundColor: 'red', padding: '20px' } },
            });
            await waitForDOMUpdate();

            const section = getSectionById(sectionId);
            expect(section?.css?.style?.backgroundColor).toBe('red');
            expect(section?.css?.style?.padding).toBe('20px');
        });

        it('should remove section', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().removeSection(sectionId);
            await waitForDOMUpdate();

            expect(countSections()).toBe(1);
            expect(getSectionById(sectionId)).toBeUndefined();
        });

        it('should remove all fields when section is removed', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            
            formStore.getState().addField(sectionId, 'text');
            formStore.getState().addField(sectionId, 'number');
            await waitForDOMUpdate();

            expect(formStore.getState().schema.sections[0].fields).toHaveLength(2);

            formStore.getState().removeSection(sectionId);
            await waitForDOMUpdate();

            expect(countSections()).toBe(0);
        });
    });

    describe('TC-S2: Multiple Sections Rendering', () => {
        it('should render multiple sections with correct hierarchy', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections).toHaveLength(3);
            
            state.schema.sections.forEach((section, index) => {
                expect(section.title).toBe(`Section ${index + 1}`);
                expect(section.order).toBe(index);
            });
        });

        it('should maintain section order when reordered', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            // Move section from index 2 to index 0
            formStore.getState().moveSection(2, 0);
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections[0].order).toBe(0);
            expect(state.schema.sections[1].order).toBe(1);
            expect(state.schema.sections[2].order).toBe(2);
        });

        it('should render fields in correct sections', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const section1Id = formStore.getState().schema.sections[0].id;
            const section2Id = formStore.getState().schema.sections[1].id;

            formStore.getState().addField(section1Id, 'text');
            formStore.getState().addField(section1Id, 'number');
            formStore.getState().addField(section2Id, 'date');
            formStore.getState().addField(section2Id, 'email');
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections[0].fields).toHaveLength(2);
            expect(state.schema.sections[1].fields).toHaveLength(2);
            expect(state.schema.sections[0].fields[0].type).toBe('text');
            expect(state.schema.sections[1].fields[0].type).toBe('date');
        });

        it('should maintain field order within sections', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;

            const fieldTypes = ['text', 'number', 'date', 'email', 'select'];
            fieldTypes.forEach((type) => {
                formStore.getState().addField(sectionId, type as any);
            });
            await waitForDOMUpdate();

            const state = formStore.getState();
            const fields = state.schema.sections[0].fields;
            
            fields.forEach((field, index) => {
                expect(field.order).toBe(index);
                expect(field.type).toBe(fieldTypes[index]);
            });
        });

        it('should handle sections with different column layouts', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sections = formStore.getState().schema.sections;
            
            formStore.getState().updateSection(sections[0].id, { columns: 1 });
            formStore.getState().updateSection(sections[1].id, { columns: 2 });
            formStore.getState().updateSection(sections[2].id, { columns: 3 });
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections[0].columns).toBe(1);
            expect(state.schema.sections[1].columns).toBe(2);
            expect(state.schema.sections[2].columns).toBe(3);
        });

        it('should handle sections with different layout configurations', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const sections = formStore.getState().schema.sections;
            
            formStore.getState().updateSection(sections[0].id, {
                layout: { type: 'grid', columns: 12, gap: '16px' },
            });
            formStore.getState().updateSection(sections[1].id, {
                layout: { type: 'grid', columns: 6, gap: '24px' },
            });
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections[0].layout?.columns).toBe(12);
            expect(state.schema.sections[0].layout?.gap).toBe('16px');
            expect(state.schema.sections[1].layout?.columns).toBe(6);
            expect(state.schema.sections[1].layout?.gap).toBe('24px');
        });

        it('should maintain section order after field operations', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const section1Id = formStore.getState().schema.sections[0].id;
            const section2Id = formStore.getState().schema.sections[1].id;
            const section3Id = formStore.getState().schema.sections[2].id;

            // Add fields to different sections
            formStore.getState().addField(section1Id, 'text');
            formStore.getState().addField(section2Id, 'number');
            formStore.getState().addField(section3Id, 'date');
            await waitForDOMUpdate();

            // Verify sections still maintain order
            const state = formStore.getState();
            expect(state.schema.sections[0].id).toBe(section1Id);
            expect(state.schema.sections[1].id).toBe(section2Id);
            expect(state.schema.sections[2].id).toBe(section3Id);
            
            state.schema.sections.forEach((section, index) => {
                expect(section.order).toBe(index);
            });
        });

        it('should handle empty sections', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections).toHaveLength(2);
            expect(state.schema.sections[0].fields).toHaveLength(0);
            expect(state.schema.sections[1].fields).toHaveLength(0);
        });

        it('should handle sections with many fields', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;

            // Add 20 fields
            for (let i = 0; i < 20; i++) {
                formStore.getState().addField(sectionId, 'text');
            }
            await waitForDOMUpdate();

            const state = formStore.getState();
            expect(state.schema.sections[0].fields).toHaveLength(20);
            
            // Verify all fields have correct order
            state.schema.sections[0].fields.forEach((field, index) => {
                expect(field.order).toBe(index);
            });
        });
    });
});
