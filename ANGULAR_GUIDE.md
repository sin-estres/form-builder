# Angular Integration Guide

## Installation

```bash
npm install form-builder-pro
```

## Basic Setup

### 1. Import Styles in `angular.json`

```json
{
  "projects": {
    "your-app": {
      "architect": {
        "build": {
          "options": {
            "styles": [
              "node_modules/form-builder-pro/dist/index.css",
              "src/styles.css"
            ]
          }
        }
      }
    }
  }
}
```

### 2. Create a Component

```typescript
// form-builder.component.ts
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `
    <div #builderContainer class="h-screen"></div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer') container!: ElementRef;
  private builder?: FormBuilder;

  ngAfterViewInit() {
    this.builder = new FormBuilder(this.container.nativeElement, {
      onSave: (schema: FormSchema) => {
        // This callback is triggered when user clicks Save button
        console.log('Form schema:', schema);
        
        // Send to your backend
        this.saveToBackend(schema);
        
        // Or store locally
        localStorage.setItem('formSchema', JSON.stringify(schema));
        
        // Or emit to parent component
        // this.schemaChanged.emit(schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }

  private saveToBackend(schema: FormSchema) {
    // Your API call here
    // this.http.post('/api/forms', schema).subscribe(...);
  }
}
```

## Loading Forms List for Import Dropdown

The Import dropdown allows users to select from existing forms and import their sections. To populate this dropdown with forms from your Angular application, pass the `existingForms` option when initializing the FormBuilder.

### Basic Example

```typescript
// form-builder.component.ts
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `
    <div #builderContainer class="h-screen"></div>
  `
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer') container!: ElementRef;
  private builder?: FormBuilder;
  
  // Your forms list - can come from a service, API, or component input
  existingForms: FormSchema[] = [
    {
      id: 'form_1',
      title: 'Contact Form',
      formName: 'contactForm',
      sections: [
        {
          id: 'section_1',
          title: 'Personal Information',
          fields: [
            {
              id: 'field_1',
              type: 'text',
              label: 'Full Name',
              required: true,
              width: '100%'
            },
            {
              id: 'field_2',
              type: 'email',
              label: 'Email Address',
              required: true,
              width: '100%'
            }
          ]
        }
      ]
    },
    {
      id: 'form_2',
      title: 'Registration Form',
      formName: 'registrationForm',
      sections: [
        {
          id: 'section_2',
          title: 'Account Details',
          fields: [
            {
              id: 'field_3',
              type: 'text',
              label: 'Username',
              required: true,
              width: '50%'
            }
          ]
        }
      ]
    }
  ];

  ngAfterViewInit() {
    if (!this.container?.nativeElement) return;
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      existingForms: this.existingForms, // Pass your forms list here
      onSave: (schema: FormSchema) => {
        console.log('Form schema:', schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

### Loading Forms from API/Service

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `
    <div #builderContainer class="h-screen"></div>
  `
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer') container!: ElementRef;
  private builder?: FormBuilder;
  existingForms: FormSchema[] = [];

  constructor(private http: HttpClient) {}

  ngAfterViewInit() {
    if (!this.container?.nativeElement) return;
    
    // Load forms from your API
    this.loadExistingForms();
  }

  private loadExistingForms() {
    this.http.get<FormSchema[]>('/api/forms').subscribe({
      next: (forms) => {
        this.existingForms = forms;
        
        // Initialize builder after forms are loaded
        if (!this.builder && this.container?.nativeElement) {
          this.initializeBuilder();
        } else if (this.builder) {
          // Update existing forms if builder already exists
          // Note: You may need to re-render or use a method to update
          this.builder = new FormBuilder(this.container.nativeElement, {
            existingForms: this.existingForms,
            onSave: (schema) => {
              console.log('Form schema:', schema);
            }
          });
        }
      },
      error: (err) => {
        console.error('Failed to load forms:', err);
        // Initialize with empty list if API fails
        this.initializeBuilder();
      }
    });
  }

  private initializeBuilder() {
    if (!this.container?.nativeElement) return;
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      existingForms: this.existingForms,
      onSave: (schema: FormSchema) => {
        console.log('Form schema:', schema);
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

### Using Component Input (Parent to Child)

```typescript
// form-builder.component.ts
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `
    <div #builderContainer class="h-screen"></div>
  `
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('builderContainer') container!: ElementRef;
  @Input() existingForms: FormSchema[] = []; // Receive forms from parent
  private builder?: FormBuilder;

  ngAfterViewInit() {
    if (this.container?.nativeElement) {
      this.initializeBuilder();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    // Update forms list when input changes
    if (changes['existingForms'] && this.builder) {
      // Update forms list dynamically without re-initializing
      this.builder.updateExistingForms(this.existingForms);
    }
  }

  private initializeBuilder() {
    if (!this.container?.nativeElement) return;
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      existingForms: this.existingForms,
      onSave: (schema: FormSchema) => {
        console.log('Form schema:', schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

```typescript
// parent.component.ts
export class ParentComponent {
  formsList: FormSchema[] = [
    // Your forms here
  ];
}
```

```html
<!-- parent.component.html -->
<app-form-builder [existingForms]="formsList"></app-form-builder>
```

### How It Works

1. **Pass Forms List**: When you pass `existingForms` in the FormBuilder options, those forms become available in the Import dropdown.

2. **Select a Form**: When a user selects a form from the dropdown, all sections from that form are displayed below the dropdown.

3. **Import Sections**: Each section shows an "Import" button. Clicking it imports that specific section (with all its fields) into the current form being built.

4. **Form Structure**: Each form in `existingForms` must follow the `FormSchema` interface:
   ```typescript
   {
     id: string;           // Unique identifier
     title: string;        // Display name (shown in dropdown)
     formName: string;     // Internal form name
     sections: FormSection[]; // Array of sections with fields
   }
   ```

### Updating Forms List Dynamically

You can update the forms list after initialization using the `updateExistingForms()` method:

```typescript
export class FormBuilderComponent {
  private builder?: FormBuilder;
  
  // Method to update forms list
  updateFormsList(newForms: FormSchema[]) {
    if (this.builder) {
      this.builder.updateExistingForms(newForms);
    }
  }
  
  // Example: Update from API call
  refreshForms() {
    this.http.get<FormSchema[]>('/api/forms').subscribe(forms => {
      this.updateFormsList(forms);
    });
  }
}
```

### Important Notes

- The `formName` field is used internally but is **not** imported when you import sections. Only the sections and their fields are imported.
- Each imported section gets new unique IDs to avoid conflicts.
- You can import multiple sections from different forms into your current form.
- The forms list can be updated dynamically using the `updateExistingForms()` method without re-initializing the builder.

## Troubleshooting

### Issue: Field Widths Working Opposite (50% = Full, 100% = Half)

**Cause**: Angular's global styles or other CSS frameworks overriding Tailwind classes.

**Solution**: The package now uses explicit CSS classes with `!important` flags:
- `.form-builder-grid` - Forces correct grid layout
- `.col-span-1`, `.col-span-2`, `.col-span-4` - Forces correct column spans

**Verify**: After updating to version 0.0.2+, widths should work correctly.

### Issue: Field Selection Not Visible

**Cause**: Angular's ViewEncapsulation or global styles overriding selection styles.

**Solution**: The package now uses `.form-builder-field-wrapper.selected` class with explicit border and shadow styles using `!important`.

**If still not working**, add to your component:

```typescript
@Component({
  // ...
  encapsulation: ViewEncapsulation.None // Disable view encapsulation
})
```

### Issue: Styles Not Loading

**Verify the CSS is imported**:

1. Check `angular.json` includes the CSS file
2. Or import in your component:

```typescript
import 'form-builder-pro/dist/index.css';
```

3. Or import in `styles.css`:

```css
@import 'form-builder-pro/dist/index.css';
```

### Issue: "Builder container not found" Error

**Cause**: The container element is not available when `FormBuilder` is initialized. This commonly happens when:
- The `@ViewChild` reference is `null` or `undefined`
- The element is conditionally rendered with `*ngIf` that evaluates to `false`
- Initialization happens before `ngAfterViewInit`
- The ViewChild query doesn't match the template element

**Solution 1: Ensure ViewChild is available**

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `
    <div #builderContainer class="h-screen"></div>
  `
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer', { static: false }) container!: ElementRef<HTMLElement>;
  private builder?: FormBuilder;

  ngAfterViewInit() {
    // Add null check before initialization
    if (!this.container?.nativeElement) {
      console.error('Container element not found');
      return;
    }

    this.builder = new FormBuilder(this.container.nativeElement, {
      onSave: (schema) => {
        console.log('Form schema:', schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

**Solution 2: If using conditional rendering, use `*ngIf` with a flag**

```typescript
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer', { static: false }) container!: ElementRef<HTMLElement>;
  private builder?: FormBuilder;
  isReady = false; // Add a flag

  ngAfterViewInit() {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      if (this.container?.nativeElement) {
        this.isReady = true;
        this.initializeBuilder();
      }
    }, 0);
  }

  private initializeBuilder() {
    if (!this.container?.nativeElement) return;
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      onSave: (schema) => {
        console.log('Form schema:', schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

**Solution 3: For edit mode with async data loading**

```typescript
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer', { static: false }) container!: ElementRef<HTMLElement>;
  private builder?: FormBuilder;
  formData?: FormSchema; // Loaded asynchronously

  ngAfterViewInit() {
    // Wait for both container and data to be ready
    if (this.container?.nativeElement && this.formData) {
      this.initializeBuilder();
    }
  }

  // Call this when formData is loaded
  loadFormData(data: FormSchema) {
    this.formData = data;
    if (this.container?.nativeElement && !this.builder) {
      this.initializeBuilder();
    } else if (this.builder) {
      this.builder.loadForm(data);
    }
  }

  private initializeBuilder() {
    if (!this.container?.nativeElement || !this.formData) return;

    this.builder = new FormBuilder(this.container.nativeElement, {
      mode: 'edit',
      formJson: this.formData,
      onSave: (schema) => {
        console.log('Form schema:', schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

**Solution 4: Use ChangeDetectorRef if needed**

```typescript
import { ChangeDetectorRef } from '@angular/core';

export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer', { static: false }) container!: ElementRef<HTMLElement>;
  private builder?: FormBuilder;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.cdr.detectChanges(); // Force change detection
    
    if (!this.container?.nativeElement) {
      console.error('Container element not found');
      return;
    }

    this.builder = new FormBuilder(this.container.nativeElement, {
      onSave: (schema) => {
        console.log('Form schema:', schema);
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

### Issue: Grid Layout Broken

**Solution**: Ensure the container has proper dimensions:

```typescript
@Component({
  template: `
    <div #builderContainer style="width: 100%; height: 100vh;"></div>
  `
})
```

## Advanced Usage

### Using Form Renderer

```typescript
import { FormRenderer } from 'form-builder-pro';

export class FormDisplayComponent implements AfterViewInit {
  @ViewChild('formContainer') container!: ElementRef;
  private renderer?: FormRenderer;

  schema = {
    id: 'my-form',
    title: 'Contact Form',
    sections: [
      {
        id: 'section1',
        title: 'Personal Info',
        fields: [
          {
            id: 'name',
            type: 'text',
            label: 'Name',
            required: true,
            width: '100%'
          }
        ]
      }
    ]
  };

  ngAfterViewInit() {
    this.renderer = new FormRenderer(
      this.container.nativeElement,
      this.schema,
      (data) => this.handleSubmit(data)
    );
  }

  handleSubmit(data: any) {
    console.log('Form submitted:', data);
  }
}
```

### Getting Schema from Builder

You can access the schema at any time:

```typescript
import { formStore } from 'form-builder-pro';

export class FormBuilderComponent {
  saveForm() {
    const schema = formStore.getState().schema;
    console.log('Current schema:', schema);
    // Save to backend, localStorage, etc.
  }
  
  loadForm(schema: FormSchema) {
    formStore.getState().setSchema(schema);
  }
}
```

### Using with EventEmitter

```typescript
import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: '<div #builderContainer class="h-screen"></div>'
})
export class FormBuilderComponent implements AfterViewInit {
  @Output() schemaChanged = new EventEmitter<FormSchema>();
  @ViewChild('builderContainer') container!: ElementRef;

  ngAfterViewInit() {
    new FormBuilder(this.container.nativeElement, {
      onSave: (schema) => {
        this.schemaChanged.emit(schema);
      }
    });
  }
}
```

Then in parent component:

```html
<app-form-builder (schemaChanged)="handleSchemaChange($event)"></app-form-builder>
```

```typescript
handleSchemaChange(schema: FormSchema) {
  console.log('Received schema:', schema);
  // Do something with the schema
}
```

## CSS Customization

If you need to override styles, use higher specificity:

```css
/* In your component styles or global styles */
.form-builder-grid .col-span-4 {
  /* Your custom styles */
  grid-column: span 4 / span 4 !important;
}

.form-builder-field-wrapper.selected {
  /* Custom selection color */
  border-color: #your-color !important;
}
```

## Common Patterns

### Lazy Loading

```typescript
// In your routing module
{
  path: 'form-builder',
  loadChildren: () => import('./form-builder/form-builder.module')
    .then(m => m.FormBuilderModule)
}
```

### With Angular Forms

```typescript
import { FormGroup, FormControl } from '@angular/forms';

export class MyComponent {
  formGroup = new FormGroup({});

  onFormBuilt(schema: any) {
    // Convert schema to Angular FormGroup
    schema.sections.forEach(section => {
      section.fields.forEach(field => {
        this.formGroup.addControl(
          field.id,
          new FormControl('', field.required ? Validators.required : null)
        );
      });
    });
  }
}
```

## Version History

### v0.0.2
- ✅ Fixed width field working opposite in Angular
- ✅ Fixed field selection visibility issues
- ✅ Added explicit CSS classes with higher specificity
- ✅ Improved compatibility with Angular's ViewEncapsulation

### v0.0.1
- Initial release
