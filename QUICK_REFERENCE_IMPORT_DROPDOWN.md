# Quick Reference: Import Dropdown Setup

## TL;DR - What You Need

1. **Load forms from API** → Get all existing forms with their full details (including sections)
2. **Map to FormSchema** → Convert API response to `FormSchema` format with `id`, `formName`, and `sections`
3. **Pass to FormBuilder** → Include `existingForms` in FormBuilder options
4. **Exclude current form** → Filter out the form being edited (if in edit mode)

## Critical Fields

Each form in `existingForms` **MUST** have:

```typescript
{
  id: string,           // Required: Used to identify the form
  formName: string,     // Required: Displayed in dropdown (line 388 in FormBuilder.ts)
  sections: FormSection[] // Required: Sections that can be imported
  title: string         // Optional: Form title
}
```

## Code Snippet

```typescript
// Load and map forms
this.formService.getFormsApi().subscribe(forms => {
  const formRequests = forms.map(f => 
    this.formService.getFormByIdApi(f.id)
  );
  
  forkJoin(formRequests).subscribe(apiResponses => {
    this.existingForms = apiResponses
      .filter(r => r !== null)
      .map(r => ({
        id: r.id,
        formName: r.formName || r.name || r.title, // CRITICAL: Must have formName
        title: r.title || r.name,
        sections: r.sections || r.groups || []     // CRITICAL: Must have sections
      }))
      .filter(f => f.id !== this.formId)          // Exclude current form
      .filter(f => f.sections.length > 0);       // Only forms with sections
    
    this.initializeBuilder();
  });
});

// Pass to FormBuilder
this.builder = new FormBuilder(container, {
  existingForms: this.existingForms,  // ← This populates Import dropdown
  // ... other options
});
```

## How FormBuilder Uses It

1. **Line 36-38**: `setExistingForms()` stores forms in the store
2. **Line 376**: Gets `existingForms` from store
3. **Line 388**: Creates dropdown options using `f.formName` as display text
4. **Line 405**: Finds form by `id` when selected
5. **Line 408**: Displays sections from `form.sections`

## Verification

✅ Forms appear in Import dropdown  
✅ Selecting a form shows its sections  
✅ "Import" button works on sections  
✅ Current form excluded when editing

