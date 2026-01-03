# Schema Cleaning Fix - "Form Not Found" Error

## Problem

When saving forms with updated dropdown values, you were getting a "Form Not Found" error. This was caused by invalid properties in the form schema that don't match the `FormField` interface.

## Issues Found

1. **Invalid Field Type**: `"decimal"` is not a valid field type (should be `"number"`)
2. **Invalid Property**: `"masterTypeName"` is not part of the `FormField` interface
3. **Empty Options Arrays**: Non-select/radio fields had empty `options: []` arrays

## Solution

Added automatic schema cleaning that:

1. **Converts field types**: `"decimal"` → `"number"`
2. **Removes invalid properties**: Strips `masterTypeName` and other non-standard properties
3. **Cleans options arrays**: Only includes `options` for `select` and `radio` field types
4. **Validates properties**: Only includes valid `FormField` properties

## Implementation

### Automatic Cleaning

The schema is automatically cleaned when:
- Loading a form via `setSchema()`
- Loading from platform via `platformToBuilder()`
- Saving a form (schema is already cleaned)

### Manual Cleaning (Optional)

If you need to clean a schema before sending to your backend, you can use the exported utility:

```typescript
import { cleanFormSchema } from 'form-builder-pro';

const cleanedSchema = cleanFormSchema(rawSchema);
// Send cleanedSchema to your backend
```

## Example

### Before (Invalid Schema)
```json
{
  "id": "field_6",
  "type": "decimal",  // ❌ Invalid type
  "label": "Thickness (mm)",
  "options": [],  // ❌ Empty options on non-select field
  "masterTypeName": "RM_GRADE"  // ❌ Invalid property
}
```

### After (Cleaned Schema)
```json
{
  "id": "field_6",
  "type": "number",  // ✅ Converted to number
  "label": "Thickness (mm)"
  // ✅ Invalid properties removed
}
```

## Usage

No changes needed in your code! The cleaning happens automatically. However, if you want to clean a schema before sending to your backend:

```typescript
import { FormBuilder, cleanFormSchema } from 'form-builder-pro';

const builder = new FormBuilder(container, {
  onSave: (schema) => {
    // Schema is already cleaned, but you can clean again if needed
    const cleaned = cleanFormSchema(schema);
    
    // Send to backend
    this.http.post('/api/forms', cleaned).subscribe(...);
  }
});
```

## Valid Field Types

- `text`
- `textarea`
- `number` (includes `decimal` which is converted)
- `email`
- `phone`
- `date`
- `select`
- `checkbox`
- `radio`
- `toggle`
- `file`

## Valid FormField Properties

- `id` (required)
- `type` (required)
- `label` (required)
- `width` (required)
- `placeholder` (optional)
- `description` (optional)
- `required` (optional)
- `defaultValue` (optional)
- `validation` (optional)
- `hidden` (optional)
- `position` (optional)
- `enabled` (optional)
- `visible` (optional)
- `options` (optional, only for `select`/`radio`)
- `optionsSource` (optional)
- `groupName` (optional, only for `select`)

## Notes

- The `masterTypeName` property is removed as it's not part of the standard interface
- Use `groupName` instead for dropdown group associations
- Empty `options` arrays are removed from non-select/radio fields
- All schemas are automatically cleaned when loaded or saved

