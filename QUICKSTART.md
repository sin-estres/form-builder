# Form Builder Pro - Quick Start Guide

## Installation

```bash
npm install form-builder-pro
```

## Basic Usage

### 1. Import the Package

```typescript
import { FormBuilder, FormRenderer } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';
```

### 2. Create a Form Builder with Save Callback

```typescript
// Get a container element
const container = document.getElementById('builder-container');

// Initialize the builder with onSave callback
const builder = new FormBuilder(container, {
  onSave: (schema) => {
    console.log('Form saved:', schema);
    
    // Send to backend
    fetch('/api/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schema)
    });
    
    // Or store locally
    localStorage.setItem('myForm', JSON.stringify(schema));
  }
});
```

### 3. Use the Form Renderer

```typescript
// Define your form schema
const schema = {
  id: 'contact-form',
  title: 'Contact Us',
  sections: [
    {
      id: 'section1',
      title: 'Personal Information',
      fields: [
        {
          id: 'name',
          type: 'text',
          label: 'Full Name',
          placeholder: 'Enter your name',
          required: true,
          width: '100%'
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email',
          placeholder: 'your@email.com',
          required: true,
          width: '50%'
        },
        {
          id: 'phone',
          type: 'phone',
          label: 'Phone',
          placeholder: '+1 234 567 8900',
          width: '50%'
        }
      ]
    }
  ]
};

// Render the form
const formContainer = document.getElementById('form-container');
const renderer = new FormRenderer(formContainer, schema, (data) => {
  console.log('Form submitted with data:', data);
  // Handle form submission
});
```

## What You Get

### Form Builder Interface
- **Left Sidebar**: Draggable field types (Text, Email, Number, Date, etc.)
- **Center Canvas**: Drop zone for building your form with sections
- **Right Panel**: Configuration panel for selected fields
- **Top Toolbar**: Undo/Redo, Preview, **Save** buttons

### Save Button Behavior
- **With callback**: Calls your `onSave` function with the schema
- **Without callback**: Shows alert and logs to console

### Features
- ✅ Drag & drop fields from toolbox
- ✅ Reorder sections and fields
- ✅ Configure field properties (label, placeholder, validation, width)
- ✅ Live preview mode
- ✅ Undo/Redo support
- ✅ **Save callback** for exporting JSON schema

### Form Renderer
- Renders forms from JSON schema
- Built-in validation
- Responsive grid layout (25%, 50%, 100% widths)
- Handles all field types
- Submit callback for form data

## Framework Examples

### Angular Component

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
    this.builder = new FormBuilder(this.container.nativeElement, {
      onSave: (schema: FormSchema) => {
        console.log('Schema saved:', schema);
        // Send to your API
        this.http.post('/api/forms', schema).subscribe();
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

### React Component

```tsx
import { useEffect, useRef } from 'react';
import { FormBuilder } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

export function FormBuilderComponent() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const builder = new FormBuilder(containerRef.current, {
      onSave: (schema) => {
        console.log('Schema saved:', schema);
        // Send to your API
        fetch('/api/forms', {
          method: 'POST',
          body: JSON.stringify(schema)
        });
      }
    });
    
    return () => builder.destroy();
  }, []);

  return <div ref={containerRef} className="h-screen" />;
}
```

### Vue Component

```vue
<template>
  <div ref="container" class="h-screen"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { FormBuilder } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

const container = ref(null);
let builder = null;

onMounted(() => {
  if (container.value) {
    builder = new FormBuilder(container.value, {
      onSave: (schema) => {
        console.log('Schema saved:', schema);
        // Send to your API
      }
    });
  }
});

onUnmounted(() => {
  builder?.destroy();
});
</script>
```

## API Reference

### FormBuilder Class

```typescript
class FormBuilder {
  constructor(
    container: HTMLElement,
    options?: {
      onSave?: (schema: FormSchema) => void
    }
  )
  destroy(): void
}
```

**Options:**
- `onSave`: Callback function called when user clicks Save button. Receives the complete form schema as JSON.

### FormRenderer Class

```typescript
class FormRenderer {
  constructor(
    container: HTMLElement,
    schema: FormSchema,
    onSubmit?: (data: Record<string, any>) => void
  )
  setSchema(schema: FormSchema): void
}
```

### FormSchema Type

```typescript
interface FormSchema {
  id: string;
  title: string;
  sections: FormSection[];
}

interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

interface FormField {
  id: string;
  type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'phone' | 'file' | 'toggle';
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  width?: '25%' | '50%' | '100%';
  options?: Array<{ label: string; value: string }>;
  validation?: ValidationRule[];
}
```

## Styling

The package includes pre-built CSS. Just import it:

```typescript
import 'form-builder-pro/dist/index.css';
```

The styles use Tailwind CSS classes and support both light and dark modes.
