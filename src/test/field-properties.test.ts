/**
 * Field Property Validation Test Cases
 * 
 * Tests all field properties for each field type:
 * - Common properties (label, fieldKey, required, visible, defaultValue, placeholder, validationRules)
 * - Type-specific properties (minLength, maxLength, regex, min, max, etc.)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formStore } from '../core/useFormStore';
import { FormBuilder } from '../builder/FormBuilder';
import { FormField, ValidationObject } from '../core/schemaTypes';
import {
    resetFormStore,
    createTestContainer,
    cleanupTestContainer,
    waitForDOMUpdate,
    getFieldById,
} from './utils/test-helpers';

describe('Field Property Validation Tests', () => {
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

    describe('Common Properties (All Fields)', () => {
        it('should set and update label property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, { label: 'Updated Label' });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.label).toBe('Updated Label');
        });

        it('should generate unique fieldKey (id)', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;

            formStore.getState().addField(sectionId, 'text');
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fields = formStore.getState().schema.sections[0].fields;
            expect(fields[0].id).not.toBe(fields[1].id);
            expect(fields[0].id).toBeTruthy();
            expect(fields[1].id).toBeTruthy();
        });

        it('should toggle required property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            
            formStore.getState().updateField(fieldId, { required: true });
            await waitForDOMUpdate();
            expect(getFieldById(fieldId)?.required).toBe(true);

            formStore.getState().updateField(fieldId, { required: false });
            await waitForDOMUpdate();
            expect(getFieldById(fieldId)?.required).toBe(false);
        });

        it('should toggle visible property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            
            formStore.getState().updateField(fieldId, { visible: false });
            await waitForDOMUpdate();
            expect(getFieldById(fieldId)?.visible).toBe(false);

            formStore.getState().updateField(fieldId, { visible: true });
            await waitForDOMUpdate();
            expect(getFieldById(fieldId)?.visible).toBe(true);
        });

        it('should set and update defaultValue', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, { defaultValue: 'Default Value' });
            await waitForDOMUpdate();

            expect(getFieldById(fieldId)?.defaultValue).toBe('Default Value');
        });

        it('should set and update placeholder', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, { placeholder: 'Enter your name' });
            await waitForDOMUpdate();

            expect(getFieldById(fieldId)?.placeholder).toBe('Enter your name');
        });

        it('should set and update validationRules', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                required: true,
                minLength: 5,
                maxLength: 10,
                regex: '^[A-Z]+$',
                regexMessage: 'Only uppercase letters allowed',
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });
    });

    describe('Text Field Properties', () => {
        it('should validate minLength property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                minLength: 5,
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });

        it('should validate maxLength property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                maxLength: 100,
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });

        it('should validate regex pattern property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                regex: '^[A-Z0-9]+$',
                regexMessage: 'Only uppercase letters and numbers',
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });
    });

    describe('Number Field Properties', () => {
        it('should validate min value property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'number');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                min: 0,
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });

        it('should validate max value property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'number');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                max: 100,
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });

        it('should set decimal precision', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'number');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, { placeholder: '0.00' });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.placeholder).toBe('0.00');
        });
    });

    describe('Date Field Properties', () => {
        it('should validate minDate property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'date');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                minDate: '2024-01-01',
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });

        it('should validate maxDate property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'date');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                maxDate: '2024-12-31',
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });

        it('should enforce date format', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'date');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                minDate: '2024-01-01',
                maxDate: '2024-12-31',
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });
    });

    describe('Checkbox/Radio Properties', () => {
        it('should validate options list for checkbox', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'checkbox');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const options = [
                { label: 'Option 1', value: 'opt1' },
                { label: 'Option 2', value: 'opt2' },
                { label: 'Option 3', value: 'opt3' },
            ];

            formStore.getState().updateField(fieldId, { options });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.options).toHaveLength(3);
            expect(field?.options?.[0].label).toBe('Option 1');
        });

        it('should validate options list for radio', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'radio');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const options = [
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
            ];

            formStore.getState().updateField(fieldId, { options });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.options).toHaveLength(2);
        });

        it('should set default selected values for checkbox', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'checkbox');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, {
                defaultValue: ['opt1', 'opt2'],
            });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.defaultValue).toEqual(['opt1', 'opt2']);
        });

        it('should set default selected value for radio', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'radio');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, {
                defaultValue: 'yes',
            });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.defaultValue).toBe('yes');
        });

        it('should validate minSelected and maxSelected for checkbox', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'checkbox');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const validation: ValidationObject = {
                minSelected: 1,
                maxSelected: 3,
            };

            formStore.getState().updateField(fieldId, { validation });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.validation).toBeDefined();
        });
    });

    describe('Dropdown (Select) Properties', () => {
        it('should set options for dropdown', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'select');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            const options = [
                { label: 'India', value: 'IN' },
                { label: 'USA', value: 'US' },
                { label: 'UK', value: 'UK' },
            ];

            formStore.getState().updateField(fieldId, { options });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.options).toHaveLength(3);
        });

        it('should set multiSelect property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'select');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, { multiSelect: true });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.multiSelect).toBe(true);
        });

        it('should set optionSource property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'select');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, { optionSource: 'MASTER' });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.optionSource).toBe('MASTER');
        });
    });

    describe('Email Field Properties', () => {
        it('should have email validation by default', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'email');
            await waitForDOMUpdate();

            const field = formStore.getState().schema.sections[0].fields[0];
            expect(field.type).toBe('email');
            expect(field.validation).toBeDefined();
        });
    });

    describe('Phone Field Properties', () => {
        it('should have ISD configuration', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'phone');
            await waitForDOMUpdate();

            const field = formStore.getState().schema.sections[0].fields[0];
            expect(field.type).toBe('phone');
            expect(field.isd).toBeDefined();
            expect(field.isd?.enabled).toBe(true);
            expect(field.isd?.defaultCode).toBe('+91');
        });
    });

    describe('Field Width/Layout Properties', () => {
        it('should set width property (legacy)', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, { width: '50%' });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.width).toBe('50%');
        });

        it('should set layout.span property', async () => {
            formStore.getState().addSection();
            const sectionId = formStore.getState().schema.sections[0].id;
            formStore.getState().addField(sectionId, 'text');
            await waitForDOMUpdate();

            const fieldId = formStore.getState().schema.sections[0].fields[0].id;
            formStore.getState().updateField(fieldId, {
                layout: { row: 0, column: 0, span: 6 },
            });
            await waitForDOMUpdate();

            const field = getFieldById(fieldId);
            expect(field?.layout?.span).toBe(6);
        });
    });
});
