/**
 * TC-P1, TC-P2: Serialization & Persistence Test Cases
 * 
 * TC-P1: Save Form Configuration
 * TC-P2: Load Form Configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formStore } from '../core/useFormStore';
import { FormBuilder } from '../builder/FormBuilder';
import { FormSchema } from '../core/schemaTypes';
import {
    resetFormStore,
    createTestContainer,
    cleanupTestContainer,
    waitForDOMUpdate,
    createMockFormSchema,
} from './utils/test-helpers';

describe('Serialization & Persistence Tests', () => {
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

    describe('TC-P1: Save Form Configuration', () => {
        it('should save form schema with correct structure', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            
            // Verify schema structure
            expect(schema).toHaveProperty('id');
            expect(schema).toHaveProperty('title');
            expect(schema).toHaveProperty('formName');
            expect(schema).toHaveProperty('sections');
            expect(Array.isArray(schema.sections)).toBe(true);
        });

        it('should save form with all sections', async () => {
            formStore.getState().addSection();
            formStore.getState().addSection();
            formStore.getState().addSection();
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            expect(schema.sections).toHaveLength(3);
            
            schema.sections.forEach((section) => {
                expect(section).toHaveProperty('id');
                expect(section).toHaveProperty('title');
                expect(section).toHaveProperty('fields');
                expect(Array.isArray(section.fields)).toBe(true);
            });
        });

        it('should save form with all field properties', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            
            formStore.getState().addField(sectionId, 'text');
            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            
            formStore.getState().updateField(fieldId, {
                label: 'Test Field',
                placeholder: 'Enter value',
                required: true,
                defaultValue: 'Default',
                visible: true,
                enabled: true,
            });
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            const field = schema.sections[0].fields[0];
            
            expect(field.id).toBeDefined();
            expect(field.type).toBe('text');
            expect(field.label).toBe('Test Field');
            expect(field.placeholder).toBe('Enter value');
            expect(field.required).toBe(true);
            expect(field.defaultValue).toBe('Default');
            expect(field.visible).toBe(true);
            expect(field.enabled).toBe(true);
        });

        it('should save form with field validation rules', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            
            formStore.getState().updateField(fieldId, {
                validation: {
                    required: true,
                    minLength: 5,
                    maxLength: 10,
                    regex: '^[A-Z]+$',
                    regexMessage: 'Only uppercase',
                },
            });
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            const field = schema.sections[0].fields[0];
            expect(field.validation).toBeDefined();
        });

        it('should save form with dropdown options', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'select');
            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            
            formStore.getState().updateField(fieldId, {
                options: [
                    { label: 'India', value: 'IN' },
                    { label: 'USA', value: 'US' },
                ],
                defaultValue: 'IN',
            });
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            const field = schema.sections[0].fields[0];
            expect(field.options).toHaveLength(2);
            expect(field.defaultValue).toBe('IN');
        });

        it('should preserve custom options when adding multiple options and include in save payload', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'select');
            const fieldId = formStore.getState().schema.sections[0].fields[0].id;

            // Enable custom options and add first option
            formStore.getState().updateField(fieldId, {
                customOptionsEnabled: true,
                optionSource: 'STATIC',
                options: [{ label: 'Custom Option 1', value: 'custom1' }],
            });
            await waitForDOMUpdate();

            // Simulate "Add Option" - append to existing (must read current from store, not stale closure)
            const getCurrentOptions = () => {
                const field = formStore.getState().schema.sections.flatMap((s) => s.fields).find((f) => f.id === fieldId);
                return field?.options || [];
            };
            const currentOptions = getCurrentOptions();
            const newOptions = [...currentOptions, { label: 'Custom Option 2', value: 'custom2' }];
            formStore.getState().updateField(fieldId, { options: newOptions });
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            const field = schema.sections[0].fields[0];
            expect(field.options).toHaveLength(2);
            expect(field.options?.[0]).toEqual({ label: 'Custom Option 1', value: 'custom1' });
            expect(field.options?.[1]).toEqual({ label: 'Custom Option 2', value: 'custom2' });

            // Verify options and customOptionsEnabled are in save payload
            const savedSchema = JSON.parse(JSON.stringify(schema));
            expect(savedSchema.sections[0].fields[0].options).toHaveLength(2);
            expect(savedSchema.sections[0].fields[0].customOptionsEnabled).toBe(true);

            // Reload and verify options persist
            formStore.getState().setSchema(savedSchema);
            const reloadedField = formStore.getState().schema.sections[0].fields[0];
            expect(reloadedField.options).toHaveLength(2);
            expect(reloadedField.options?.[0].label).toBe('Custom Option 1');
            expect(reloadedField.options?.[1].label).toBe('Custom Option 2');
        });

        it('should save form with section layout configuration', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            
            formStore.getState().updateSection(sectionId, {
                layout: { type: 'grid', columns: 6, gap: '20px' },
                css: { class: 'custom-class', style: { padding: '10px' } },
            });
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            const section = schema.sections[0];
            expect(section.layout?.columns).toBe(6);
            expect(section.layout?.gap).toBe('20px');
            expect(section.css?.class).toBe('custom-class');
            expect(section.css?.style?.padding).toBe('10px');
        });

        it('should save form as valid JSON', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            const jsonString = JSON.stringify(schema);
            
            // Should not throw error
            expect(() => JSON.parse(jsonString)).not.toThrow();
            
            const parsed = JSON.parse(jsonString);
            expect(parsed.id).toBe(schema.id);
            expect(parsed.sections).toHaveLength(1);
        });

        it('should save complex form with multiple sections and fields', async () => {
            // Create complex form
            formStore.getState().addSection();
            formStore.getState().addSection();
            formStore.getState().addSection();
            
            const sections = formStore.getState().schema.sections;
            
            // Add fields to each section
            formStore.getState().addField(sections[0].id, 'text');
            formStore.getState().addField(sections[0].id, 'number');
            formStore.getState().addField(sections[1].id, 'date');
            formStore.getState().addField(sections[1].id, 'select');
            formStore.getState().addField(sections[2].id, 'checkbox');
            await waitForDOMUpdate();

            const schema = formStore.getState().schema;
            expect(schema.sections).toHaveLength(3);
            expect(schema.sections[0].fields).toHaveLength(2);
            expect(schema.sections[1].fields).toHaveLength(2);
            expect(schema.sections[2].fields).toHaveLength(1);
        });
    });

    describe('TC-P2: Load Form Configuration', () => {
        it('should load form schema correctly', async () => {
            const testSchema: FormSchema = {
                id: 'loaded_form',
                title: 'Loaded Form',
                formName: 'loadedForm',
                sections: [
                    {
                        id: 'section_1',
                        title: 'Section 1',
                        fields: [
                            {
                                id: 'field_1',
                                type: 'text',
                                label: 'Text Field',
                                placeholder: 'Enter text',
                                required: false,
                                enabled: true,
                                visible: true,
                                order: 0,
                            },
                        ],
                        columns: 1,
                        layout: { type: 'grid', columns: 12, gap: '16px' },
                        order: 0,
                    },
                ],
            };

            formStore.getState().setSchema(testSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            expect(loadedSchema.id).toBe('loaded_form');
            expect(loadedSchema.title).toBe('Loaded Form');
            expect(loadedSchema.sections).toHaveLength(1);
            expect(loadedSchema.sections[0].fields).toHaveLength(1);
            expect(loadedSchema.sections[0].fields[0].label).toBe('Text Field');
        });

        it('should reconstruct UI exactly from saved schema', async () => {
            // Create and save form
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            formStore.getState().addField(sectionId, 'number');
            
            const field1Id = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(field1Id, {
                label: 'First Field',
                required: true,
            });
            await waitForDOMUpdate();

            const savedSchema = formStore.getState().schema;
            
            // Reset and reload
            resetFormStore();
            formStore.getState().setSchema(savedSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            expect(loadedSchema.sections).toHaveLength(1);
            expect(loadedSchema.sections[0].fields).toHaveLength(2);
            expect(loadedSchema.sections[0].fields[0].label).toBe('First Field');
            expect(loadedSchema.sections[0].fields[0].required).toBe(true);
        });

        it('should load form with all field types', async () => {
            const testSchema: FormSchema = {
                id: 'multi_type_form',
                title: 'Multi Type Form',
                formName: 'multiTypeForm',
                sections: [
                    {
                        id: 'section_1',
                        title: 'All Fields',
                        fields: [
                            { id: 'f1', type: 'text', label: 'Text', order: 0, enabled: true, visible: true },
                            { id: 'f2', type: 'number', label: 'Number', order: 1, enabled: true, visible: true },
                            { id: 'f3', type: 'date', label: 'Date', order: 2, enabled: true, visible: true },
                            { id: 'f4', type: 'select', label: 'Select', options: [], order: 3, enabled: true, visible: true },
                            { id: 'f5', type: 'checkbox', label: 'Checkbox', options: [], order: 4, enabled: true, visible: true },
                            { id: 'f6', type: 'radio', label: 'Radio', options: [], order: 5, enabled: true, visible: true },
                            { id: 'f7', type: 'email', label: 'Email', order: 6, enabled: true, visible: true },
                            { id: 'f8', type: 'phone', label: 'Phone', order: 7, enabled: true, visible: true },
                        ],
                        columns: 1,
                        layout: { type: 'grid', columns: 12, gap: '16px' },
                        order: 0,
                    },
                ],
            };

            formStore.getState().setSchema(testSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            expect(loadedSchema.sections[0].fields).toHaveLength(8);
            
            const fieldTypes = loadedSchema.sections[0].fields.map((f) => f.type);
            expect(fieldTypes).toContain('text');
            expect(fieldTypes).toContain('number');
            expect(fieldTypes).toContain('date');
            expect(fieldTypes).toContain('select');
            expect(fieldTypes).toContain('checkbox');
            expect(fieldTypes).toContain('radio');
            expect(fieldTypes).toContain('email');
            expect(fieldTypes).toContain('phone');
        });

        it('should load form with validation rules', async () => {
            const testSchema: FormSchema = {
                id: 'validated_form',
                title: 'Validated Form',
                formName: 'validatedForm',
                sections: [
                    {
                        id: 'section_1',
                        title: 'Section',
                        fields: [
                            {
                                id: 'field_1',
                                type: 'text',
                                label: 'Validated Field',
                                validation: {
                                    required: true,
                                    minLength: 5,
                                    maxLength: 10,
                                    regex: '^[A-Z]+$',
                                    regexMessage: 'Uppercase only',
                                },
                                order: 0,
                                enabled: true,
                                visible: true,
                            },
                        ],
                        columns: 1,
                        layout: { type: 'grid', columns: 12, gap: '16px' },
                        order: 0,
                    },
                ],
            };

            formStore.getState().setSchema(testSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            const field = loadedSchema.sections[0].fields[0];
            expect(field.validation).toBeDefined();
        });

        it('should load form with dropdown options and selected value', async () => {
            const testSchema: FormSchema = {
                id: 'dropdown_form',
                title: 'Dropdown Form',
                formName: 'dropdownForm',
                sections: [
                    {
                        id: 'section_1',
                        title: 'Section',
                        fields: [
                            {
                                id: 'field_1',
                                type: 'select',
                                label: 'Country',
                                options: [
                                    { label: 'India', value: 'IN' },
                                    { label: 'USA', value: 'US' },
                                    { label: 'UK', value: 'UK' },
                                ],
                                defaultValue: 'IN',
                                order: 0,
                                enabled: true,
                                visible: true,
                            },
                        ],
                        columns: 1,
                        layout: { type: 'grid', columns: 12, gap: '16px' },
                        order: 0,
                    },
                ],
            };

            formStore.getState().setSchema(testSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            const field = loadedSchema.sections[0].fields[0];
            expect(field.options).toHaveLength(3);
            expect(field.defaultValue).toBe('IN');
        });

        it('should load form with section layout and CSS', async () => {
            const testSchema: FormSchema = {
                id: 'styled_form',
                title: 'Styled Form',
                formName: 'styledForm',
                sections: [
                    {
                        id: 'section_1',
                        title: 'Styled Section',
                        fields: [],
                        columns: 2,
                        layout: { type: 'grid', columns: 6, gap: '24px' },
                        css: {
                            class: 'custom-section',
                            style: { backgroundColor: 'blue', padding: '20px' },
                        },
                        order: 0,
                    },
                ],
            };

            formStore.getState().setSchema(testSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            const section = loadedSchema.sections[0];
            expect(section.layout?.columns).toBe(6);
            expect(section.css?.class).toBe('custom-section');
            expect(section.css?.style?.backgroundColor).toBe('blue');
        });

        it('should maintain field order after loading', async () => {
            const testSchema: FormSchema = {
                id: 'ordered_form',
                title: 'Ordered Form',
                formName: 'orderedForm',
                sections: [
                    {
                        id: 'section_1',
                        title: 'Section',
                        fields: [
                            { id: 'f1', type: 'text', label: 'First', order: 0, enabled: true, visible: true },
                            { id: 'f2', type: 'text', label: 'Second', order: 1, enabled: true, visible: true },
                            { id: 'f3', type: 'text', label: 'Third', order: 2, enabled: true, visible: true },
                        ],
                        columns: 1,
                        layout: { type: 'grid', columns: 12, gap: '16px' },
                        order: 0,
                    },
                ],
            };

            formStore.getState().setSchema(testSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            const fields = loadedSchema.sections[0].fields;
            expect(fields[0].label).toBe('First');
            expect(fields[1].label).toBe('Second');
            expect(fields[2].label).toBe('Third');
            
            fields.forEach((field, index) => {
                expect(field.order).toBe(index);
            });
        });

        it('should handle loading empty form', async () => {
            const emptySchema: FormSchema = {
                id: 'empty_form',
                title: 'Empty Form',
                formName: 'emptyForm',
                sections: [],
            };

            formStore.getState().setSchema(emptySchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            expect(loadedSchema.sections).toHaveLength(0);
        });

        it('should handle loading form with empty sections', async () => {
            const testSchema: FormSchema = {
                id: 'empty_sections_form',
                title: 'Empty Sections Form',
                formName: 'emptySectionsForm',
                sections: [
                    {
                        id: 'section_1',
                        title: 'Empty Section',
                        fields: [],
                        columns: 1,
                        layout: { type: 'grid', columns: 12, gap: '16px' },
                        order: 0,
                    },
                ],
            };

            formStore.getState().setSchema(testSchema);
            await waitForDOMUpdate();

            const loadedSchema = formStore.getState().schema;
            expect(loadedSchema.sections).toHaveLength(1);
            expect(loadedSchema.sections[0].fields).toHaveLength(0);
        });
    });
});
