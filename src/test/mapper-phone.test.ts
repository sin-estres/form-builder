/**
 * Mapper tests for Phone field integration
 * Verifies: phone type normalization, isd config preservation
 */

import { describe, it, expect } from 'vitest';
import { cleanFormSchema, platformToBuilder } from '../utils/mapper';

describe('Mapper - Phone Field Integration', () => {
    describe('Phone type normalization', () => {
        it('should normalize phoneNumber to phone', () => {
            const schema = {
                id: 'test',
                title: 'Test',
                sections: [{
                    id: 's1',
                    title: 'Section',
                    fields: [{
                        id: 'f1',
                        type: 'phoneNumber',
                        label: 'Phone',
                    }],
                }],
            };
            const cleaned = cleanFormSchema(schema);
            expect(cleaned.sections[0].fields[0].type).toBe('phone');
        });

        it('should normalize PHONE_NUMBER to phone', () => {
            const schema = {
                id: 'test',
                title: 'Test',
                sections: [{
                    id: 's1',
                    title: 'Section',
                    fields: [{
                        id: 'f1',
                        fieldType: 'PHONE_NUMBER',
                        label: 'Phone',
                    }],
                }],
            };
            const cleaned = cleanFormSchema(schema);
            expect(cleaned.sections[0].fields[0].type).toBe('phone');
        });

        it('should normalize telephone to phone', () => {
            const schema = {
                id: 'test',
                title: 'Test',
                sections: [{
                    id: 's1',
                    title: 'Section',
                    fields: [{
                        id: 'f1',
                        type: 'telephone',
                        label: 'Phone',
                    }],
                }],
            };
            const cleaned = cleanFormSchema(schema);
            expect(cleaned.sections[0].fields[0].type).toBe('phone');
        });

        it('should normalize mobile to phone', () => {
            const schema = {
                id: 'test',
                title: 'Test',
                sections: [{
                    id: 's1',
                    title: 'Section',
                    fields: [{
                        id: 'f1',
                        type: 'mobile',
                        label: 'Phone',
                    }],
                }],
            };
            const cleaned = cleanFormSchema(schema);
            expect(cleaned.sections[0].fields[0].type).toBe('phone');
        });

        it('should preserve phone type', () => {
            const schema = {
                id: 'test',
                title: 'Test',
                sections: [{
                    id: 's1',
                    title: 'Section',
                    fields: [{
                        id: 'f1',
                        type: 'phone',
                        label: 'Phone',
                    }],
                }],
            };
            const cleaned = cleanFormSchema(schema);
            expect(cleaned.sections[0].fields[0].type).toBe('phone');
        });
    });

    describe('ISD config preservation', () => {
        it('should preserve isd config when transforming from platform', () => {
            const schema = {
                id: 'test',
                title: 'Test',
                sections: [{
                    id: 's1',
                    title: 'Section',
                    fields: [{
                        id: 'f1',
                        type: 'phone',
                        label: 'Phone',
                        isd: {
                            enabled: true,
                            defaultCode: '+1',
                            showFlag: true,
                            showCountryName: true,
                            allowCustomCode: false,
                        },
                    }],
                }],
            };
            const cleaned = platformToBuilder(schema);
            const field = cleaned.sections[0].fields[0];
            expect(field.isd).toBeDefined();
            expect(field.isd?.enabled).toBe(true);
            expect(field.isd?.defaultCode).toBe('+1');
            expect(field.isd?.showFlag).toBe(true);
            expect(field.isd?.showCountryName).toBe(true);
        });

        it('should preserve isd when enabled is false', () => {
            const schema = {
                id: 'test',
                title: 'Test',
                sections: [{
                    id: 's1',
                    title: 'Section',
                    fields: [{
                        id: 'f1',
                        type: 'phone',
                        label: 'Phone',
                        isd: {
                            enabled: false,
                            defaultCode: '+91',
                            showFlag: false,
                            showCountryName: false,
                            allowCustomCode: false,
                        },
                    }],
                }],
            };
            const cleaned = cleanFormSchema(schema);
            expect(cleaned.sections[0].fields[0].isd?.enabled).toBe(false);
        });
    });
});
