# Form Templates Not Visible in Angular App - Solution Guide

## Problem

You have `form-templates.json` with 12 pre-built form templates, but they're not showing up in the Import dropdown in your Angular application.

## Root Cause

The FormBuilder requires the `existingForms` option to be passed when initializing. The `form-templates.json` file exists but is not being loaded and passed to the FormBuilder in your Angular app.

## Solution

Load the `form-templates.json` file from your Angular assets folder and pass it to the FormBuilder via the `existingForms` option.

## Step-by-Step Implementation

### Step 1: Copy form-templates.json to Assets

Copy `form-templates.json` from the form-builder package to your Angular app's assets folder:

```bash
# Copy the file to your Angular project
cp form-templates.json /path/to/your-angular-app/src/assets/form-templates.json
```

Or manually:
1. Copy `form-templates.json` from the form-builder package root
2. Paste it into `src/assets/` folder in your Angular project

### Step 2: Update Your Angular Component

Update your form builder component to load the templates:

```typescript
// form-builder.component.ts
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
    
    // Load form templates from assets
    this.loadFormTemplates();
  }

  private loadFormTemplates() {
    this.http.get<FormSchema[]>('/assets/form-templates.json').subscribe({
      next: (forms) => {
        this.existingForms = forms;
        this.initializeBuilder();
      },
      error: (err) => {
        console.error('Failed to load form templates:', err);
        // Initialize with empty list if file not found
        this.initializeBuilder();
      }
    });
  }

  private initializeBuilder() {
    if (!this.container?.nativeElement) return;
    
    this.builder = new FormBuilder(this.container.nativeElement, {
      existingForms: this.existingForms, // This makes templates visible!
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

### Step 3: Verify It Works

1. Run your Angular app
2. Open the form builder
3. Click on the "Import" tab in the left sidebar
4. You should see a dropdown with all 12 form templates:
   - Customer Lead / Prospect Form
   - Employee Onboarding Form
   - Vendor Registration Form
   - Customer Feedback Form
   - Support Ticket / Complaint Form
   - Sales Order Request Form
   - Job Application / Recruitment Form
   - Internal Request Form (IT / Admin)
   - Event Registration Form
   - Appointment / Booking Form
   - CRM Contact / Company Form
   - Expense Reimbursement Form

## How It Works

1. **Loading**: The `loadFormTemplates()` method fetches the JSON file from `/assets/form-templates.json`
2. **Passing to Builder**: The loaded templates are passed via `existingForms` option
3. **Display**: FormBuilder populates the Import dropdown with these forms
4. **Importing**: Users can select a form and import individual sections from it

## Alternative: Using Fetch (No HttpClient)

If you prefer not to use HttpClient:

```typescript
private async loadFormTemplates() {
  try {
    const response = await fetch('/assets/form-templates.json');
    if (response.ok) {
      this.existingForms = await response.json();
    }
  } catch (error) {
    console.warn('Could not load form templates:', error);
  } finally {
    this.initializeBuilder();
  }
}
```

## Troubleshooting

### Templates still not visible?

1. **Check file location**: Ensure `form-templates.json` is in `src/assets/`
2. **Check browser console**: Look for 404 errors or JSON parsing errors
3. **Verify JSON structure**: Ensure the file is valid JSON matching `FormSchema[]` format
4. **Check network tab**: Verify the file is being loaded (status 200)
5. **Verify initialization**: Ensure `existingForms` is passed before builder renders

### File not found error?

- Make sure the file is in `src/assets/form-templates.json`
- Check your `angular.json` includes assets folder:
  ```json
  "assets": [
    "src/favicon.ico",
    "src/assets"
  ]
  ```

### Empty dropdown?

- Check that `existingForms` array is not empty after loading
- Add `console.log(this.existingForms)` after loading to verify
- Ensure the JSON structure matches `FormSchema[]` (array of form objects)

## Additional Resources

- See `ANGULAR_GUIDE.md` for complete Angular integration guide
- See `form-templates.json` for the complete list of available templates
- Each template includes multiple sections that can be imported individually
