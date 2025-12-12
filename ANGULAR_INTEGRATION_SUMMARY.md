# Angular Integration Summary

## Changes Made to FormBuilder Package

### 1. New Input Parameter: `formTemplates`

Added a new option `formTemplates` to `FormBuilderOptions` that accepts `FormSchema[]` and automatically extracts all sections from those forms to populate the Templates tab.

**Location**: `src/builder/FormBuilder.ts`

**Interface Update**:
```typescript
export interface FormBuilderOptions {
    existingForms?: FormSchema[];      // For Import dropdown (created forms)
    reusableSections?: FormSection[]; // Direct section templates
    formTemplates?: FormSchema[];      // NEW: Form templates - extracts sections
    // ... other options
}
```

### 2. New Public Methods

- `updateTemplates(templates: FormSection[])` - Update templates dynamically
- `loadFormTemplates(formTemplates: FormSchema[])` - Load form templates and extract sections

## How It Works

### `existingForms` (FormSchema[])
- **Purpose**: List of created/saved forms
- **Populates**: `state.existingForms`
- **UI Location**: Import dropdown (top toolbar and Import tab)
- **Usage**: Users can select a form and import its sections into the current form

### `formTemplates` (FormSchema[])
- **Purpose**: Form templates from `form-templates.json`
- **Populates**: Templates tab (extracts sections from all forms)
- **UI Location**: Templates tab in the left sidebar
- **Usage**: Users can drag-and-drop template sections into their form

## Angular App Implementation

### Step 1: Place form-templates.json in Assets

Place your `form-templates.json` file in `src/assets/`:

```
src/
  assets/
    form-templates.json
```

### Step 2: Update Your Component

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `<div #builderContainer class="h-screen"></div>`
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer') container!: ElementRef;
  private builder?: FormBuilder;
  
  // Created forms - for Import dropdown
  existingForms: FormSchema[] = [];
  
  // Form templates - for Templates tab
  formTemplates: FormSchema[] = [];

  constructor(private http: HttpClient) {}

  ngAfterViewInit() {
    if (!this.container?.nativeElement) return;
    
    this.loadData();
  }

  private loadData() {
    // Load created forms (for Import dropdown)
    this.http.get<FormSchema[]>('/api/forms').subscribe({
      next: (forms) => {
        this.existingForms = forms;
        this.initializeBuilder();
      },
      error: (err) => {
        console.error('Failed to load forms:', err);
        this.initializeBuilder();
      }
    });

    // Load form templates (for Templates tab)
    this.http.get<FormSchema[]>('/assets/form-templates.json').subscribe({
      next: (templates) => {
        this.formTemplates = templates;
        this.initializeBuilder();
      },
      error: (err) => {
        console.warn('Could not load form templates:', err);
        this.initializeBuilder();
      }
    });
  }

  private initializeBuilder() {
    if (!this.container?.nativeElement || this.builder) return;
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      existingForms: this.existingForms,    // Populates Import dropdown
      formTemplates: this.formTemplates,   // Populates Templates tab
      onSave: (schema: FormSchema) => {
        console.log('Form saved:', schema);
        // Save to your backend
        this.http.post('/api/forms', schema).subscribe();
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

### Step 3: Alternative - Using Component Inputs

If you prefer to pass data from a parent component:

```typescript
// form-builder.component.ts
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `<div #builderContainer class="h-screen"></div>`
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('builderContainer') container!: ElementRef;
  @Input() existingForms: FormSchema[] = [];
  @Input() formTemplates: FormSchema[] = [];
  private builder?: FormBuilder;

  ngAfterViewInit() {
    if (this.container?.nativeElement) {
      this.initializeBuilder();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.builder) {
      if (changes['existingForms']) {
        this.builder.updateExistingForms(this.existingForms);
      }
      if (changes['formTemplates']) {
        this.builder.loadFormTemplates(this.formTemplates);
      }
    }
  }

  private initializeBuilder() {
    if (!this.container?.nativeElement) return;
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      existingForms: this.existingForms,
      formTemplates: this.formTemplates,
      onSave: (schema) => {
        console.log('Form saved:', schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

```html
<!-- parent.component.html -->
<app-form-builder 
  [existingForms]="createdForms"
  [formTemplates]="templates">
</app-form-builder>
```

## Key Points

1. **`existingForms`**: Your created/saved forms → Import dropdown
2. **`formTemplates`**: Template forms from `form-templates.json` → Templates tab
3. Both can be used together
4. Sections are automatically extracted from `formTemplates`
5. Templates can be updated dynamically using `loadFormTemplates()` or `updateTemplates()`

## Example Data Structure

### form-templates.json
```json
[
  {
    "id": "form-customer-lead-001",
    "title": "Customer Lead Form",
    "formName": "customerLeadForm",
    "sections": [
      {
        "id": "section-contact-details-001",
        "title": "Contact Details",
        "fields": [...]
      },
      {
        "id": "section-business-info-001",
        "title": "Business Info",
        "fields": [...]
      }
    ]
  }
]
```

All sections from all forms in this array will be extracted and added to the Templates tab.

## Migration from Previous Setup

If you were previously loading `form-templates.json` into `existingForms`, update your code:

**Before**:
```typescript
this.builder = new FormBuilder(this.container.nativeElement, {
  existingForms: formTemplatesData, // ❌ Wrong - goes to Import dropdown
  // ...
});
```

**After**:
```typescript
this.builder = new FormBuilder(this.container.nativeElement, {
  existingForms: createdForms,      // ✅ Created forms for Import
  formTemplates: formTemplatesData, // ✅ Templates for Templates tab
  // ...
});
```
