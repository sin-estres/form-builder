# Master Types / Group Name Feature

## Overview

The form-builder-pro package now supports mapping dropdown fields to "Group Name" values from a master types array provided by the consuming application. This feature allows you to associate dropdown fields with specific groups for organizational or data management purposes.

## Configuration

### Input Parameter

Pass the `masterTypes` configuration through the `data` option when initializing FormBuilder:

```typescript
import { FormBuilder, MasterType } from 'form-builder-pro';

const masterTypes: MasterType[] = [
  {
    id: "693afa421b790717a8b22cd5",
    name: "commodities",
    displayName: "Commodities",
    indexes: [],
    active: true
  },
  {
    id: "693afa421b790717a8b22cd6",
    name: "currencies",
    displayName: "Currencies",
    indexes: [],
    active: true
  },
  {
    id: "693afa421b790717a8b22cd7",
    name: "inactive_group",
    displayName: "Inactive Group",
    indexes: [],
    active: false  // This will be filtered out
  }
];

const builder = new FormBuilder(containerElement, {
  data: {
    masterTypes: masterTypes
  },
  onSave: (schema) => {
    console.log('Form schema:', schema);
  }
});
```

## Usage

### 1. Adding a Dropdown Field

When you add a dropdown field (type: `'select'`) to your form, the Group Name property will automatically appear in the field configuration panel.

### 2. Selecting a Group Name

1. Select a dropdown field in the form builder
2. In the configuration panel, you'll see a "Group Name" section
3. Choose a group from the dropdown (only active master types are shown)
4. The selected group name is automatically saved to the field schema

### 3. Field Schema

The selected Group Name is persisted in the dropdown field schema:

```json
{
  "id": "field_123",
  "type": "select",
  "label": "Select Commodity",
  "width": "100%",
  "options": [
    { "label": "Option 1", "value": "opt1" },
    { "label": "Option 2", "value": "opt2" }
  ],
  "groupName": {
    "id": "693afa421b790717a8b22cd5",
    "name": "commodities"
  }
}
```

## Behavior

### Active Filtering

- Only master types with `active === true` are shown in the Group Name dropdown
- Inactive master types are automatically filtered out

### Backward Compatibility

- The `data.masterTypes` parameter is **optional**
- If not provided, the Group Name property will not appear
- Existing forms without `groupName` continue to work normally

### Field Type Restriction

- Group Name property **only appears for dropdown fields** (type: `'select'`)
- Other field types (text, number, radio, etc.) do not show this property

### Editable After Creation

- You can change or remove the Group Name selection at any time
- Select "None" from the dropdown to clear the Group Name

## Complete Example

### Angular Example

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormSchema, MasterType } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `<div #builderContainer class="h-screen"></div>`
})
export class FormBuilderComponent implements AfterViewInit {
  @ViewChild('builderContainer') container!: ElementRef;
  private builder?: FormBuilder;

  ngAfterViewInit() {
    const masterTypes: MasterType[] = [
      {
        id: "693afa421b790717a8b22cd5",
        name: "commodities",
        displayName: "Commodities",
        indexes: [],
        active: true
      }
    ];

    this.builder = new FormBuilder(this.container.nativeElement, {
      data: {
        masterTypes: masterTypes
      },
      onSave: (schema: FormSchema) => {
        console.log('Form schema with group names:', schema);
        // Send to backend
      }
    });
  }
}
```

### React Example

```typescript
import { useEffect, useRef } from 'react';
import { FormBuilder, FormSchema, MasterType } from 'form-builder-pro';

function FormBuilderComponent() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const masterTypes: MasterType[] = [
      {
        id: "693afa421b790717a8b22cd5",
        name: "commodities",
        displayName: "Commodities",
        indexes: [],
        active: true
      }
    ];

    const builder = new FormBuilder(containerRef.current, {
      data: {
        masterTypes: masterTypes
      },
      onSave: (schema: FormSchema) => {
        console.log('Form schema:', schema);
      }
    });

    return () => {
      builder.destroy();
    };
  }, []);

  return <div ref={containerRef} className="h-screen" />;
}
```

### Vanilla JavaScript Example

```javascript
import { FormBuilder } from 'form-builder-pro';

const masterTypes = [
  {
    id: "693afa421b790717a8b22cd5",
    name: "commodities",
    displayName: "Commodities",
    indexes: [],
    active: true
  }
];

const container = document.getElementById('form-builder-container');
const builder = new FormBuilder(container, {
  data: {
    masterTypes: masterTypes
  },
  onSave: (schema) => {
    console.log('Form schema:', schema);
    // Handle save
  }
});
```

## TypeScript Types

```typescript
export interface MasterType {
  id: string;
  name: string;
  displayName: string;
  indexes?: any[];
  active: boolean;
}

export interface FormField {
  // ... other properties
  groupName?: {
    id: string;
    name: string;
  };
}
```

## Notes

- The `masterTypes` array is treated as **read-only** configuration
- The package does not modify the `masterTypes` array
- Group Name selection uses `displayName` for the visible label
- Group Name value stores both `id` and `name` for flexibility
- The feature gracefully handles missing or empty `masterTypes` arrays

