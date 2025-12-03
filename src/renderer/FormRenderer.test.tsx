import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormRenderer } from './FormRenderer';
import { FormSchema } from '../core/schemaTypes';

// Mock schema
const mockSchema: FormSchema = {
    id: 'test_form',
    title: 'Test Form',
    sections: [
        {
            id: 's1',
            title: 'Section 1',
            fields: [
                {
                    id: 'f1',
                    type: 'text',
                    label: 'First Name',
                    width: '100%',
                    required: true,
                },
            ],
        },
    ],
};

describe('FormRenderer', () => {
    it('renders the form title', () => {
        render(<FormRenderer schema={mockSchema} />);
        expect(screen.getByText('Test Form')).toBeDefined();
    });

    it('renders section title', () => {
        render(<FormRenderer schema={mockSchema} />);
        expect(screen.getByText('Section 1')).toBeDefined();
    });

    it('renders fields', () => {
        render(<FormRenderer schema={mockSchema} />);
        expect(screen.getByLabelText(/First Name/i)).toBeDefined();
    });
});
