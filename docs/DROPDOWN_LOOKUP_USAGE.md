# Dropdown Field with Lookup (Entity Fields) - Usage Guide

This guide explains how to use the **Lookup (Entity Fields)** feature for dropdown fields in the form builder. This feature allows you to configure dropdown fields to fetch options dynamically from modules or master types.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Using Lookup in Form Builder](#using-lookup-in-form-builder)
4. [Form Schema Structure](#form-schema-structure)
5. [Form Submission](#form-submission)
6. [Example Implementation](#example-implementation)
7. [Property Reference](#property-reference)

## Overview

The **Lookup (Entity Fields)** feature enables dropdown fields to:
- Fetch options from **Modules** (provided via `moduleList`)
- Fetch options from **Master Types** (existing master type groups)
- Configure which fields to use as **value** and **label** in the lookup
- Control **visibility** and **enabled** state

This is particularly useful when you need dropdown options to be populated from external data sources or entity fields.

## Setup

### 1. Provide Module List

When initializing the FormBuilder, pass the `moduleList` option:

```typescript
import { FormBuilder, FormSchema } from 'form-builder-pro';

const moduleList = [
  'Users',
  'Products',
  'Orders',
  'Customers',
  'Inventory'
];

const builder = new FormBuilder(containerElement, {
  moduleList: moduleList,
  onSave: (schema: FormSchema) => {
    console.log('Form schema:', schema);
    // Send to your backend
  }
});
```

### 2. Master Types (Optional)

If you want to use Master Types as lookup source, ensure you have master types configured:

```typescript
const builder = new FormBuilder(containerElement, {
  moduleList: moduleList,
  data: {
    masterTypes: [
      {
        id: "master-1",
        name: "categories",
        displayName: "Categories",
        enumName: "CATEGORIES",
        indexes: [],
        active: true
      },
      // ... more master types
    ]
  },
  onSave: (schema: FormSchema) => {
    // Handle save
  }
});
```

## Using Lookup in Form Builder

### Step-by-Step Guide

1. **Add a Dropdown Field**
   - Drag a "Dropdown" field from the toolbox to your form
   - Select the dropdown field to open the configuration panel

2. **Select Lookup Source Type**
   - In the "Option Source" section, select **"Lookup (Entity Fields)"** from the "Source Type" dropdown
   - This option is only available for dropdown (select) fields

3. **Configure Lookup Source Type**
   - A new dropdown "Lookup Source Type" will appear
   - Choose either:
     - **Module**: To fetch from a module in your `moduleList`
     - **Master Type**: To fetch from existing master types

4. **Select Lookup Source**
   - If you selected **Module**:
     - A "Lookup Source" dropdown will show all modules from your `moduleList`
     - Select the desired module (e.g., "Users", "Products")
   - If you selected **Master Type**:
     - A "Lookup Source" dropdown will show all active master types
     - Select the desired master type

5. **Configure Field Mappings**
   - **Lookup Value Field**: Enter the field name from the entity that should be used as the option value
     - Example: `id`, `userId`, `productId`
   - **Lookup Label Field**: Enter the field name from the entity that should be used as the option label
     - Example: `name`, `userName`, `productName`

6. **Set Visibility and Enabled**
   - **Visibility**: Checkbox to control if the field is visible (default: checked)
   - **Enabled**: Checkbox to control if the field is enabled (default: checked)

7. **Configure Other Properties**
   - Continue configuring other dropdown properties (label, placeholder, validation, etc.)
   - The styling options will appear after the lookup configuration

## Form Schema Structure

When you save a form with a Lookup dropdown, the field will include the following properties:

```json
{
  "id": "field-dropdown-lookup-001",
  "type": "select",
  "label": "Select User",
  "placeholder": "Choose a user",
  "optionSource": "LOOKUP",
  "lookupSourceType": "MODULE",
  "lookupSource": "Users",
  "lookupValueField": "id",
  "lookupLabelField": "name",
  "visible": true,
  "enabled": true,
  "multiSelect": false,
  "required": false,
  "layout": {
    "row": 0,
    "column": 0,
    "span": 12
  }
}
```

### Property Descriptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `optionSource` | `"LOOKUP"` | Yes | Indicates this field uses lookup functionality |
| `lookupSourceType` | `"MODULE" \| "MASTER_TYPE"` | Yes | Type of lookup source |
| `lookupSource` | `string` | Yes | Selected module name or master type identifier |
| `lookupValueField` | `string` | Yes | Field name to use as option value |
| `lookupLabelField` | `string` | Yes | Field name to use as option label |
| `visible` | `boolean` | No | Whether the field is visible (default: `true`) |
| `enabled` | `boolean` | No | Whether the field is enabled (default: `true`) |

## Form Submission

### ✅ Verified: All Lookup Properties Are Included

When you save a form using the FormBuilder's Save button, **all lookup-related properties are included** in the schema that's passed to your `onSave` callback.

The form submission process:

1. **User clicks Save button** → FormBuilder calls `onSave` callback
2. **Schema is passed** → Contains all field properties including lookup configuration
3. **All properties included**:
   - `optionSource: "LOOKUP"`
   - `lookupSourceType`
   - `lookupSource`
   - `lookupValueField`
   - `lookupLabelField`
   - `visible`
   - `enabled`
   - Plus all other field properties (id, type, label, validation, etc.)

### Example: Save Handler

```typescript
const builder = new FormBuilder(containerElement, {
  moduleList: ['Users', 'Products', 'Orders'],
  onSave: (schema: FormSchema) => {
    // Schema contains all lookup properties
    console.log('Saved schema:', JSON.stringify(schema, null, 2));
    
    // Example: Send to backend
    fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schema)
    })
    .then(response => response.json())
    .then(data => {
      console.log('Form saved:', data);
    });
  }
});
```

### Schema Structure in Save Callback

The schema passed to `onSave` will have this structure:

```typescript
{
  id: string;
  title: string;
  formName: string;
  sections: [
    {
      id: string;
      title: string;
      fields: [
        {
          id: string;
          type: "select";
          label: string;
          optionSource: "LOOKUP";
          lookupSourceType: "MODULE" | "MASTER_TYPE";
          lookupSource: string;
          lookupValueField: string;
          lookupLabelField: string;
          visible: boolean;
          enabled: boolean;
          // ... other field properties
        }
      ]
    }
  ]
}
```

### Using builderToPlatform (Optional)

If you need to transform the schema to a standardized payload format, you can use `builderToPlatform`:

```typescript
import { FormBuilder, FormSchema, builderToPlatform } from 'form-builder-pro';

const builder = new FormBuilder(containerElement, {
  moduleList: ['Users', 'Products'],
  onSave: (schema: FormSchema) => {
    // Transform to platform format (includes all lookup properties)
    const platformSchema = builderToPlatform(schema);
    
    // platformSchema also contains all lookup properties:
    // - optionSource: "LOOKUP"
    // - lookupSourceType
    // - lookupSource
    // - lookupValueField
    // - lookupLabelField
    // - visible
    // - enabled
    
    console.log('Platform schema:', platformSchema);
  }
});
```

**Note**: Both the direct schema and the platform-transformed schema include all lookup properties. Use `builderToPlatform` only if you need the standardized payload format with layout transformations.

## Example Implementation

### Complete Angular Example

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: '<div #builderContainer class="h-screen"></div>'
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer') container!: ElementRef;
  private builder?: FormBuilder;

  ngAfterViewInit() {
    // Define your module list
    const moduleList = [
      'Users',
      'Products',
      'Orders',
      'Customers',
      'Inventory',
      'Categories'
    ];

    this.builder = new FormBuilder(this.container.nativeElement, {
      moduleList: moduleList,
      onSave: (schema: FormSchema) => {
        console.log('Form schema with lookup fields:', schema);
        
        // Verify lookup properties are present
        schema.sections.forEach(section => {
          section.fields.forEach(field => {
            if (field.optionSource === 'LOOKUP') {
              console.log('Lookup field found:', {
                id: field.id,
                label: field.label,
                lookupSourceType: field.lookupSourceType,
                lookupSource: field.lookupSource,
                lookupValueField: field.lookupValueField,
                lookupLabelField: field.lookupLabelField,
                visible: field.visible,
                enabled: field.enabled
              });
            }
          });
        });

        // Send to backend
        this.saveForm(schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }

  private saveForm(schema: FormSchema) {
    // Your API call here
    // this.http.post('/api/forms', schema).subscribe(...);
  }
}
```

### Complete React Example

```tsx
import { useEffect, useRef } from 'react';
import { FormBuilder, FormSchema } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

export function FormBuilderComponent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<FormBuilder | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const moduleList = [
      'Users',
      'Products',
      'Orders',
      'Customers'
    ];

    builderRef.current = new FormBuilder(containerRef.current, {
      moduleList: moduleList,
      onSave: (schema: FormSchema) => {
        console.log('Saved form schema:', schema);
        
        // All lookup properties are included in schema
        // Send to your backend
        fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(schema)
        });
      }
    });

    return () => {
      builderRef.current?.destroy();
    };
  }, []);

  return <div ref={containerRef} className="h-screen" />;
}
```

### Backend Processing Example

When your backend receives the form schema, you can process lookup fields:

```typescript
// Backend API endpoint
app.post('/api/forms', async (req, res) => {
  const schema = req.body;
  
  // Process each field
  schema.sections.forEach((section: any) => {
    section.fields.forEach((field: any) => {
      if (field.optionSource === 'LOOKUP') {
        console.log('Processing lookup field:', {
          fieldId: field.id,
          sourceType: field.lookupSourceType,
          source: field.lookupSource,
          valueField: field.lookupValueField,
          labelField: field.lookupLabelField
        });

        // At runtime, you would:
        // 1. Fetch data from the module/master type
        // 2. Map fields using lookupValueField and lookupLabelField
        // 3. Populate dropdown options
        
        if (field.lookupSourceType === 'MODULE') {
          // Fetch from module: field.lookupSource
          // Example: Fetch users from Users module
          // Map: field.lookupValueField (e.g., "id") and field.lookupLabelField (e.g., "name")
        } else if (field.lookupSourceType === 'MASTER_TYPE') {
          // Fetch from master type: field.lookupSource
          // Map: field.lookupValueField and field.lookupLabelField
        }
      }
    });
  });

  // Save form schema
  await saveFormSchema(schema);
  res.json({ success: true, formId: schema.id });
});
```

## Property Reference

### Lookup Field Properties

All lookup properties are included in the form schema when saved:

```typescript
interface LookupField {
  // Standard field properties
  id: string;
  type: "select";
  label: string;
  placeholder?: string;
  
  // Lookup configuration
  optionSource: "LOOKUP";
  lookupSourceType: "MODULE" | "MASTER_TYPE";
  lookupSource: string; // Module name or master type identifier
  lookupValueField: string; // Field name for option value
  lookupLabelField: string; // Field name for option label
  
  // Visibility and state
  visible?: boolean; // Default: true
  enabled?: boolean; // Default: true
  
  // Other dropdown properties
  multiSelect?: boolean;
  required?: boolean;
  validation?: ValidationObject;
  layout?: { row: number; column: number; span: number };
}
```

### FormBuilderOptions

```typescript
interface FormBuilderOptions {
  moduleList?: string[]; // Array of module names for Lookup source type
  onSave?: (schema: FormSchema) => void; // Callback receives schema with all lookup properties
  // ... other options
}
```

## Runtime Implementation Notes

### Important Considerations

1. **Form Builder vs Form Renderer**
   - The Form Builder saves the **configuration** (which module/fields to use)
   - The Form Renderer needs to **fetch and populate** the actual options at runtime
   - You'll need to implement the data fetching logic in your application

2. **Data Fetching**
   - When rendering the form, check if `optionSource === 'LOOKUP'`
   - Fetch data from the specified module or master type
   - Map the data using `lookupValueField` and `lookupLabelField`
   - Populate the dropdown options

3. **Example Runtime Logic**

```typescript
async function populateLookupField(field: FormField) {
  if (field.optionSource !== 'LOOKUP') return;
  
  let data: any[] = [];
  
  if (field.lookupSourceType === 'MODULE') {
    // Fetch from module API
    data = await fetchModuleData(field.lookupSource);
  } else if (field.lookupSourceType === 'MASTER_TYPE') {
    // Fetch from master type
    data = await fetchMasterTypeData(field.lookupSource);
  }
  
  // Map data to options format
  const options = data.map(item => ({
    value: item[field.lookupValueField!],
    label: item[field.lookupLabelField!]
  }));
  
  // Update field options
  field.options = options;
}
```

## Troubleshooting

### Lookup Properties Not Appearing in Saved Schema

✅ **Verified**: All lookup properties are included in the saved schema. If you're not seeing them:

1. Check that you selected "Lookup (Entity Fields)" as the Source Type
2. Ensure all lookup fields are filled (Lookup Source Type, Lookup Source, Value Field, Label Field)
3. Verify the `onSave` callback is receiving the full schema

### Module List Not Showing

- Ensure `moduleList` is provided in FormBuilderOptions
- Check that `moduleList` is a non-empty array of strings
- Verify the modules are available when the dropdown is rendered

### Master Type Not Showing

- Ensure master types are provided via `data.masterTypes` or `masterTypeGroups`
- Check that master types have `active: true`
- Verify the master type identifier matches

## Summary

✅ **All lookup properties are included in form submission**

When you save a form with Lookup dropdown fields:
- `optionSource: "LOOKUP"` ✅
- `lookupSourceType` ✅
- `lookupSource` ✅
- `lookupValueField` ✅
- `lookupLabelField` ✅
- `visible` ✅
- `enabled` ✅

The form builder saves the **configuration** of how to fetch and map the lookup data. Your application needs to implement the **runtime logic** to actually fetch the data and populate the dropdown options when the form is rendered.
