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
