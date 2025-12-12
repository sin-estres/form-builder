# Cursor Prompt: Implement FormBuilder with existingForms and formTemplates

## Task
Implement the FormBuilder component in my Angular application with two separate input parameters:
1. `existingForms` - List of created forms (FormSchema[]) that populates the Import dropdown
2. `formTemplates` - Form templates from form-templates.json (FormSchema[]) that populates the Templates tab

## Context
I'm using the `form-builder-pro` package which has been updated to support:
- `existingForms` option: Populates `state.existingForms` and appears in the Import dropdown
- `formTemplates` option: Extracts sections from FormSchema[] and populates the Templates tab

## Requirements

### 1. File Structure
- Place `form-templates.json` in `src/assets/` directory
- Create or update the FormBuilder component

### 2. Component Implementation
Create/update a FormBuilder component that:
- Loads created forms from an API endpoint (e.g., `/api/forms`) for the `existingForms` parameter
- Loads form templates from `/assets/form-templates.json` for the `formTemplates` parameter
- Initializes FormBuilder with both parameters
- Handles async loading properly (wait for both to load before initializing)
- Implements proper cleanup in `ngOnDestroy`

### 3. Code Structure

**Component Template:**
```html
<div #builderContainer class="h-screen"></div>
```

**Component Class Requirements:**
- Use `@ViewChild` to get container reference
- Use `HttpClient` to load data
- Implement `AfterViewInit` and `OnDestroy`
- Handle async data loading
- Initialize FormBuilder only after container is ready
- Pass both `existingForms` and `formTemplates` to FormBuilder constructor

### 4. Implementation Details

**Data Loading:**
- Load created forms from API: `GET /api/forms` → `existingForms`
- Load templates from assets: `GET /assets/form-templates.json` → `formTemplates`
- Both should be `FormSchema[]` type

**FormBuilder Initialization:**
```typescript
new FormBuilder(container, {
  existingForms: this.existingForms,    // For Import dropdown
  formTemplates: this.formTemplates,    // For Templates tab
  onSave: (schema) => { /* handle save */ }
})
```

**Error Handling:**
- Handle API errors gracefully
- Initialize builder even if one data source fails
- Log warnings for missing templates

### 5. Example Implementation

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormSchema } from 'form-builder-pro';

@Component({
  selector: 'app-form-builder',
  template: `<div #builderContainer class="h-screen"></div>`,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class FormBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer', { static: false }) container!: ElementRef<HTMLElement>;
  private builder?: FormBuilder;
  
  existingForms: FormSchema[] = [];
  formTemplates: FormSchema[] = [];
  
  private formsLoaded = false;
  private templatesLoaded = false;

  constructor(private http: HttpClient) {}

  ngAfterViewInit() {
    if (!this.container?.nativeElement) {
      console.error('Container element not found');
      return;
    }
    
    this.loadData();
  }

  private loadData() {
    // Load created forms (for Import dropdown)
    this.http.get<FormSchema[]>('/api/forms').subscribe({
      next: (forms) => {
        this.existingForms = forms;
        this.formsLoaded = true;
        this.tryInitializeBuilder();
      },
      error: (err) => {
        console.error('Failed to load forms:', err);
        this.formsLoaded = true;
        this.tryInitializeBuilder();
      }
    });

    // Load form templates (for Templates tab)
    this.http.get<FormSchema[]>('/assets/form-templates.json').subscribe({
      next: (templates) => {
        this.formTemplates = templates;
        this.templatesLoaded = true;
        this.tryInitializeBuilder();
      },
      error: (err) => {
        console.warn('Could not load form templates:', err);
        this.templatesLoaded = true;
        this.tryInitializeBuilder();
      }
    });
  }

  private tryInitializeBuilder() {
    // Only initialize when both data sources have completed (success or error)
    if (!this.formsLoaded || !this.templatesLoaded) {
      return;
    }
    
    if (!this.container?.nativeElement) {
      return;
    }
    
    if (this.builder) {
      return; // Already initialized
    }
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      existingForms: this.existingForms,    // Populates Import dropdown
      formTemplates: this.formTemplates,    // Populates Templates tab
      onSave: (schema: FormSchema) => {
        console.log('Form schema saved:', schema);
        // Save to your backend
        this.http.post('/api/forms', schema).subscribe({
          next: () => console.log('Form saved successfully'),
          error: (err) => console.error('Failed to save form:', err)
        });
      }
    });
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

### 6. Module Setup

Ensure your module imports `HttpClientModule`:

```typescript
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    HttpClientModule,
    // ... other imports
  ],
  // ...
})
```

### 7. Assets Configuration

Ensure `angular.json` includes assets:

```json
{
  "projects": {
    "your-app": {
      "architect": {
        "build": {
          "options": {
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ]
          }
        }
      }
    }
  }
}
```

### 8. Styles Configuration

Ensure FormBuilder styles are imported in `angular.json`:

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

## Expected Behavior

1. Component loads created forms from API → Populates Import dropdown
2. Component loads templates from form-templates.json → Populates Templates tab
3. Users can:
   - Select forms from Import dropdown to import sections
   - Drag-and-drop sections from Templates tab into their form
4. Both features work independently and together

## Testing Checklist

- [ ] Component initializes without errors
- [ ] Created forms appear in Import dropdown
- [ ] Templates appear in Templates tab
- [ ] Can import sections from existing forms
- [ ] Can drag sections from Templates tab
- [ ] Save callback works correctly
- [ ] Component cleans up properly on destroy
- [ ] Handles API errors gracefully
- [ ] Handles missing form-templates.json gracefully

## Notes

- `existingForms` and `formTemplates` are separate and serve different purposes
- `formTemplates` automatically extracts sections from FormSchema[] arrays
- Both can be empty arrays if data isn't available
- The builder initializes even if one data source fails
