# Comprehensive Form Payload Example Documentation

This document explains the comprehensive payload example that includes all field types and all available options in the form builder.

## File Location
- **Payload Example**: `COMPREHENSIVE_PAYLOAD_EXAMPLE.json`
- **Documentation**: `PAYLOAD_EXAMPLE_DOCUMENTATION.md` (this file)

## Payload Structure

The payload follows the `FormSchema` interface structure:

```typescript
{
  id: string;              // Unique form identifier
  title: string;           // Form display title
  formName: string;        // Form name (used in code)
  sections: FormSection[]; // Array of form sections
}
```

## All Field Types Included

The example includes all 11 supported field types:

1. **text** - Text input field
2. **textarea** - Multi-line text area
3. **number** - Number input field
4. **email** - Email input field
5. **phone** - Phone number input field
6. **date** - Date picker field
7. **select** - Dropdown/select field
8. **checkbox** - Checkbox group field
9. **radio** - Radio group field
10. **toggle** - Toggle/switch field
11. **file** - File upload field

## All Field Options Demonstrated

### Basic Properties (All Fields)
- ✅ `id` - Unique field identifier
- ✅ `type` - Field type
- ✅ `label` - Field label
- ✅ `placeholder` - Placeholder text
- ✅ `description` - Field description/help text
- ✅ `width` - Field width (string percentages: "25%", "33%", "50%", "66%", "75%", "100%" OR numeric: 10-100)
- ✅ `required` - Whether field is required
- ✅ `enabled` - Whether field is enabled/disabled
- ✅ `visible` - Whether field is visible/hidden
- ✅ `defaultValue` - Default field value
- ✅ `hidden` - For conditional logic (future use)
- ✅ `position` - Grid position {row, column} (future proofing)

### Field-Specific Options

#### Select/Dropdown Fields
- ✅ `options` - Array of {label, value} objects
- ✅ `groupName` - Master type group reference {id, name}
- ✅ `masterTypeName` - Enum name for Angular integration
- ✅ `customOptionsEnabled` - Enable custom options editing
- ✅ `multiselect` - Enable multiple selection
- ✅ `optionsSource` - Async options source configuration

#### Checkbox/Radio Fields
- ✅ `options` - Array of {label, value} objects

### Validation Rules (All Types)

The example demonstrates all validation rule types:

1. **required** - Field is required
   ```json
   {
     "type": "required",
     "message": "This field is required"
   }
   ```

2. **minLength** - Minimum character length (text, textarea, email)
   ```json
   {
     "type": "minLength",
     "value": 3,
     "message": "Minimum 3 characters required"
   }
   ```

3. **maxLength** - Maximum character length (text, textarea, email)
   ```json
   {
     "type": "maxLength",
     "value": 100,
     "message": "Maximum 100 characters allowed"
   }
   ```

4. **min** - Minimum numeric value (number)
   ```json
   {
     "type": "min",
     "value": 0,
     "message": "Value must be at least 0"
   }
   ```

5. **max** - Maximum numeric value (number)
   ```json
   {
     "type": "max",
     "value": 1000,
     "message": "Value must not exceed 1000"
   }
   ```

6. **pattern** - Regex pattern validation (text, email)
   ```json
   {
     "type": "pattern",
     "regex": "^[A-Z]{5}[0-9]{4}[A-Z]$",
     "message": "Please enter a valid PAN card number"
   }
   ```

7. **email** - Email format validation (email field)
   ```json
   {
     "type": "email",
     "message": "Please enter a valid email address"
   }
   ```

8. **minDate** - Minimum date (date field)
   ```json
   {
     "type": "minDate",
     "value": "2024-01-01",
     "message": "Date must be after 2024-01-01"
   }
   ```

9. **maxDate** - Maximum date (date field)
   ```json
   {
     "type": "maxDate",
     "value": "2024-12-31",
     "message": "Date must be before 2024-12-31"
   }
   ```

## Section Options

The example demonstrates all section configuration options:

- ✅ `id` - Unique section identifier
- ✅ `title` - Section title
- ✅ `fields` - Array of form fields
- ✅ `columns` - Grid layout (1, 2, or 3 columns)
- ✅ `isExpanded` - Whether section is expanded by default

## Width Options Demonstrated

The example shows all width options:

### String Percentages
- `"25%"` - Quarter width
- `"33%"` - One-third width
- `"50%"` - Half width
- `"66%"` - Two-thirds width
- `"75%"` - Three-quarters width
- `"100%"` - Full width

### Numeric Values (10-100)
- `45` - Custom numeric width (45%)
- `75` - Custom numeric width (75%)
- `80` - Custom numeric width (80%)

## Special Field Configurations

### 1. Select with Group Name
```json
{
  "type": "select",
  "groupName": {
    "id": "master-type-001",
    "name": "countries"
  },
  "masterTypeName": "CountryEnum",
  "options": [...]
}
```

### 2. Select with Multiselect
```json
{
  "type": "select",
  "multiselect": true,
  "options": [...]
}
```

### 3. Select with Custom Options Enabled
```json
{
  "type": "select",
  "customOptionsEnabled": true,
  "options": [...]
}
```

### 4. Select with Async Options Source
```json
{
  "type": "select",
  "optionsSource": {
    "api": "https://api.example.com/options",
    "method": "GET",
    "labelKey": "name",
    "valueKey": "id"
  }
}
```

### 5. Field with Position
```json
{
  "position": {
    "row": 0,
    "column": 0
  }
}
```

### 6. Hidden Field
```json
{
  "hidden": true,
  "visible": false
}
```

### 7. Disabled Field
```json
{
  "enabled": false
}
```

## Usage Example

### Loading the Payload

```typescript
import { FormBuilder } from 'form-builder-pro';
import comprehensivePayload from './COMPREHENSIVE_PAYLOAD_EXAMPLE.json';

const container = document.getElementById('form-builder');
const builder = new FormBuilder(container, {
  formJson: comprehensivePayload,
  onSave: (schema) => {
    console.log('Saved schema:', schema);
    // Send to your backend
    fetch('/api/forms', {
      method: 'POST',
      body: JSON.stringify(schema),
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

### Saving a Form

When you save a form using the FormBuilder, the `onSave` callback receives a cleaned schema that:

1. Removes invalid properties
2. Normalizes field types (e.g., converts "decimal" to "number")
3. Removes empty options arrays from non-select/radio fields
4. Preserves masterTypeName for select fields with groupName

The saved payload will match the structure shown in `COMPREHENSIVE_PAYLOAD_EXAMPLE.json`.

## Regex Presets Available

The form builder includes several regex presets (shown in examples):

1. **Website URL**: `^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$`
2. **PAN Card (India)**: `^[A-Z]{5}[0-9]{4}[A-Z]$`
3. **Phone Number (India)**: `^[6-9]\d{9}$`
4. **Aadhaar Number (India)**: `^\d{12}$`
5. **GST Number (India)**: `^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$`

## Notes

- All optional properties are demonstrated in the example
- The payload is valid and can be directly loaded into the FormBuilder
- Field IDs are unique and follow a naming convention
- Validation rules are comprehensive and show all possible combinations
- Section layouts demonstrate 1, 2, and 3 column configurations
- Width options show both string percentages and numeric values

## Field Type Summary

| Field Type | Options Support | Validation Support | Special Features |
|------------|----------------|-------------------|------------------|
| text | ❌ | ✅ All | Regex patterns, min/max length |
| textarea | ❌ | ✅ All | Min/max length |
| number | ❌ | ✅ min, max | Numeric validation |
| email | ❌ | ✅ email, pattern | Built-in email validation |
| phone | ❌ | ✅ pattern | Phone format validation |
| date | ❌ | ✅ minDate, maxDate | Date range validation |
| select | ✅ | ✅ required | Multiselect, custom options, groupName, async source |
| checkbox | ✅ | ✅ required | Multiple selection |
| radio | ✅ | ✅ required | Single selection |
| toggle | ❌ | ❌ | Boolean on/off |
| file | ❌ | ✅ required | File upload |

## Next Steps

1. Load the payload example into your FormBuilder instance
2. Review each section to understand different field configurations
3. Use this as a reference when creating your own forms
4. Modify the example to match your specific requirements
