import { FormSchema, FormSection, FormField } from '../../core/schemaTypes';
import { formStore } from '../../core/useFormStore';

/**
 * Test utilities for Form Builder tests
 */

/**
 * Reset form store to initial state
 */
export function resetFormStore() {
    const initialState: FormSchema = {
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
        isPreviewMode: false,
        existingForms: [],
        templates: [],
        masterTypes: [],
        dropdownOptionsMap: {},
        lookupFieldOptionsMap: {},
    });
}

/**
 * Create a test container element
 */
export function createTestContainer(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    return container;
}

/**
 * Clean up test container
 */
export function cleanupTestContainer() {
    const container = document.getElementById('test-container');
    if (container) {
        container.remove();
    }
}

/**
 * Simulate drag-and-drop event
 * This simulates SortableJS drag-and-drop behavior
 */
export function simulateDragDrop(
    sourceElement: HTMLElement,
    targetElement: HTMLElement,
    sourceIndex: number = 0,
    targetIndex: number = 0
) {
    // Create drag events
    const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
    });
    
    const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
    });
    
    const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
    });

    // Dispatch events
    sourceElement.dispatchEvent(dragStartEvent);
    targetElement.dispatchEvent(dragOverEvent);
    targetElement.dispatchEvent(dropEvent);
}

/**
 * Simulate SortableJS move operation
 * This simulates the actual SortableJS onAdd/onUpdate behavior
 */
export function simulateSortableMove(
    item: HTMLElement,
    fromList: HTMLElement,
    toList: HTMLElement,
    newIndex: number
) {
    // Remove from source
    if (item.parentNode === fromList) {
        item.remove();
    }
    
    // Insert into target at new index
    const children = Array.from(toList.children);
    if (newIndex >= children.length) {
        toList.appendChild(item);
    } else {
        toList.insertBefore(item, children[newIndex]);
    }
    
    // Trigger custom event that SortableJS would trigger
    const addEvent = new CustomEvent('sortable:add', {
        detail: {
            item,
            from: fromList,
            to: toList,
            newIndex,
        },
    });
    toList.dispatchEvent(addEvent);
}

/**
 * Wait for DOM updates
 */
export function waitForDOMUpdate(ms: number = 0): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            requestAnimationFrame(() => resolve());
        }, ms);
    });
}

/**
 * Create a mock field for testing
 */
export function createMockField(
    type: FormField['type'],
    overrides: Partial<FormField> = {}
): FormField {
    const baseField: FormField = {
        id: `field_${Math.random().toString(36).substring(2, 9)}`,
        type,
        label: `${type} Field`,
        placeholder: `Enter ${type}...`,
        required: false,
        enabled: true,
        visible: true,
        order: 0,
        ...overrides,
    };

    // Add type-specific defaults
    if (type === 'select' || type === 'checkbox' || type === 'radio') {
        baseField.options = [
            { label: 'Option 1', value: 'opt1' },
            { label: 'Option 2', value: 'opt2' },
        ];
    }

    return baseField;
}

/**
 * Create a mock section for testing
 */
export function createMockSection(overrides: Partial<FormSection> = {}): FormSection {
    return {
        id: `section_${Math.random().toString(36).substring(2, 9)}`,
        title: 'Test Section',
        fields: [],
        columns: 1,
        layout: { type: 'grid', columns: 12, gap: '16px' },
        order: 0,
        ...overrides,
    };
}

/**
 * Create a mock form schema for testing
 */
export function createMockFormSchema(overrides: Partial<FormSchema> = {}): FormSchema {
    return {
        id: 'test_form',
        title: 'Test Form',
        formName: 'testForm',
        sections: [],
        ...overrides,
    };
}

/**
 * Mock fetch for API testing
 */
export function createMockFetch(response: any, status: number = 200) {
    return jest.fn(() =>
        Promise.resolve({
            ok: status >= 200 && status < 300,
            status,
            json: () => Promise.resolve(response),
            text: () => Promise.resolve(JSON.stringify(response)),
        } as Response)
    );
}

/**
 * Mock dropdown API response
 */
export const MOCK_DROPDOWN_RESPONSE = {
    data: [
        { label: 'India', value: 'IN' },
        { label: 'USA', value: 'US' },
        { label: 'UK', value: 'UK' },
    ],
};

/**
 * Mock empty dropdown API response
 */
export const MOCK_EMPTY_DROPDOWN_RESPONSE = {
    data: [],
};

/**
 * Mock error response
 */
export function createMockErrorResponse(status: number = 500) {
    return {
        ok: false,
        status,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
    } as Response;
}

/**
 * Get field from store by ID
 */
export function getFieldById(fieldId: string): FormField | undefined {
    const state = formStore.getState();
    for (const section of state.schema.sections) {
        const field = section.fields.find((f) => f.id === fieldId);
        if (field) return field;
    }
    return undefined;
}

/**
 * Get section from store by ID
 */
export function getSectionById(sectionId: string): FormSection | undefined {
    const state = formStore.getState();
    return state.schema.sections.find((s) => s.id === sectionId);
}

/**
 * Count fields in store
 */
export function countFields(): number {
    const state = formStore.getState();
    return state.schema.sections.reduce((count, section) => count + section.fields.length, 0);
}

/**
 * Count sections in store
 */
export function countSections(): number {
    const state = formStore.getState();
    return state.schema.sections.length;
}
