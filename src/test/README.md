# Form Builder Test Suite

Comprehensive test coverage for the Form Builder package, ensuring stability and correctness across all features.

## Test Structure

### Test Files

1. **`drag-drop.test.ts`** - Drag-and-drop functionality tests
   - TC-1: Drag Field to Section
   - TC-2: Reorder Fields in Section
   - TC-3: Remove Field from Section

2. **`field-properties.test.ts`** - Field property validation tests
   - Common properties (label, required, visible, defaultValue, placeholder, validationRules)
   - Type-specific properties (minLength, maxLength, regex, min, max, etc.)
   - All field types: text, number, date, select, checkbox, radio, email, phone, etc.

3. **`dropdown-api.test.ts`** - Dropdown external API integration tests
   - TC-D1: Populate Dropdown from External API
   - TC-D2: Handle Empty API Response
   - TC-D3: Handle API Failure
   - TC-D4: Persist Selected Dropdown Value

4. **`section-config.test.ts`** - Section configuration tests
   - TC-S1: Section Name & Metadata
   - TC-S2: Multiple Sections Rendering

5. **`serialization.test.ts`** - Serialization and persistence tests
   - TC-P1: Save Form Configuration
   - TC-P2: Load Form Configuration

6. **`e2e.test.ts`** - End-to-end form builder tests
   - Complete workflow: create, configure, save, reload
   - Complex forms with multiple sections
   - Field order persistence
   - Dropdown API integration
   - All field types validation

### Test Utilities

**`utils/test-helpers.ts`** - Shared test utilities:
- `resetFormStore()` - Reset form store to initial state
- `createTestContainer()` - Create test DOM container
- `cleanupTestContainer()` - Clean up test container
- `simulateDragDrop()` - Simulate drag-and-drop events
- `simulateSortableMove()` - Simulate SortableJS move operations
- `waitForDOMUpdate()` - Wait for DOM updates
- `createMockField()` - Create mock field for testing
- `createMockSection()` - Create mock section for testing
- `createMockFormSchema()` - Create mock form schema
- `createMockFetch()` - Mock fetch API calls
- `MOCK_DROPDOWN_RESPONSE` - Mock dropdown API response
- Helper functions to query store state

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests once (CI mode)
```bash
npm run test:run
```

### Run specific test file
```bash
npm test drag-drop.test.ts
```

## Test Coverage

### ✅ Drag-and-Drop (TC-1, TC-2, TC-3)
- [x] Drag field to section
- [x] Multiple field types
- [x] Field at specific index
- [x] Unique field IDs
- [x] Default field configuration
- [x] Reorder fields within section
- [x] Update order property
- [x] Move field between sections
- [x] Multiple reorders
- [x] Remove field from section
- [x] Clear selected field on delete
- [x] Update order after deletion
- [x] Handle non-existent field
- [x] Remove from correct section

### ✅ Field Properties
- [x] Common properties (label, fieldKey, required, visible, defaultValue, placeholder)
- [x] Validation rules
- [x] Text field (minLength, maxLength, regex)
- [x] Number field (min, max, decimal precision)
- [x] Date field (minDate, maxDate, format)
- [x] Checkbox/Radio (options, defaultSelected, minSelected, maxSelected)
- [x] Dropdown (options, multiSelect, optionSource)
- [x] Email field validation
- [x] Phone field ISD configuration
- [x] Field width/layout properties

### ✅ Dropdown External API (TC-D1, TC-D2, TC-D3, TC-D4)
- [x] Populate from dropdownOptionsMap
- [x] Populate from masterTypes indexes
- [x] Update options when map changes
- [x] Handle AsyncOptionSource
- [x] Handle empty dropdownOptionsMap
- [x] Handle missing enumName
- [x] Handle empty masterTypes indexes
- [x] Handle 500 error
- [x] Handle network timeout
- [x] Handle 404 error
- [x] Persist selected value
- [x] Persist in form schema
- [x] Reload with persisted value
- [x] Persist multiSelect values

### ✅ Section Configuration (TC-S1, TC-S2)
- [x] Create section with default title
- [x] Update section title
- [x] Set section order
- [x] Update section columns (legacy)
- [x] Update section layout.columns
- [x] Set section CSS class
- [x] Set section CSS style
- [x] Remove section
- [x] Remove all fields when section removed
- [x] Multiple sections rendering
- [x] Maintain section order
- [x] Fields in correct sections
- [x] Maintain field order within sections
- [x] Different column layouts
- [x] Different layout configurations
- [x] Section order after field operations
- [x] Empty sections
- [x] Sections with many fields

### ✅ Serialization & Persistence (TC-P1, TC-P2)
- [x] Save form schema structure
- [x] Save all sections
- [x] Save all field properties
- [x] Save validation rules
- [x] Save dropdown options
- [x] Save section layout configuration
- [x] Save as valid JSON
- [x] Complex form with multiple sections
- [x] Load form schema correctly
- [x] Reconstruct UI from saved schema
- [x] Load all field types
- [x] Load validation rules
- [x] Load dropdown options and selected value
- [x] Load section layout and CSS
- [x] Maintain field order after loading
- [x] Handle empty form
- [x] Handle empty sections

### ✅ End-to-End Tests
- [x] Complete E2E flow (create, configure, save, reload)
- [x] Complex form with multiple sections
- [x] Field order persistence
- [x] Dropdown API integration
- [x] All field types validation
- [x] No errors after complete workflow

## Acceptance Criteria

All tests pass when:
- ✅ All fields can be dragged, configured, saved, and reloaded
- ✅ All field properties validated correctly
- ✅ Dropdowns work with mocked external API responses
- ✅ Sections maintain hierarchy and order
- ✅ Serialization and deserialization is consistent
- ✅ No runtime errors occur
- ✅ Form Builder package is production-ready

## Mock Data

### Mock Dropdown API Response
```json
{
  "data": [
    { "label": "India", "value": "IN" },
    { "label": "USA", "value": "US" },
    { "label": "UK", "value": "UK" }
  ]
}
```

### Mock Empty Response
```json
{
  "data": []
}
```

## Notes

- Tests use Vitest as the test framework
- Tests run in jsdom environment (simulated browser)
- API calls are mocked using `vi.fn()` and `global.fetch`
- DOM operations are tested using test utilities
- Store state is reset before each test
- All tests are isolated and independent

## Future Enhancements

- Add visual regression tests
- Add performance tests
- Add accessibility tests
- Add integration tests with real API endpoints (optional)
- Add Cypress/Playwright E2E tests for browser automation
