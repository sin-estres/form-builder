# Quick Cursor Prompt

Copy and paste this into Cursor:

---

Implement a FormBuilder component in my Angular app that:

1. **Loads two data sources:**
   - Created forms from API: `GET /api/forms` → store in `existingForms: FormSchema[]`
   - Form templates from assets: `GET /assets/form-templates.json` → store in `formTemplates: FormSchema[]`

2. **Initializes FormBuilder with both parameters:**
   ```typescript
   new FormBuilder(container, {
     existingForms: this.existingForms,    // For Import dropdown
     formTemplates: this.formTemplates,    // For Templates tab
     onSave: (schema) => { /* save to API */ }
   })
   ```

3. **Requirements:**
   - Use `@ViewChild` for container reference
   - Use `HttpClient` for API calls
   - Wait for both data sources to load (success or error) before initializing FormBuilder
   - Handle errors gracefully (initialize even if one fails)
   - Implement proper cleanup in `ngOnDestroy`
   - Place form-templates.json in `src/assets/`

4. **Component structure:**
   - Template: `<div #builderContainer class="h-screen"></div>`
   - Implements `AfterViewInit` and `OnDestroy`
   - Has `existingForms` and `formTemplates` properties
   - Has `loadData()` method that loads both sources
   - Has `tryInitializeBuilder()` that waits for both to complete
   - Save callback should POST to `/api/forms`

5. **Ensure:**
   - `HttpClientModule` is imported in module
   - `angular.json` includes assets folder
   - `angular.json` includes `node_modules/form-builder-pro/dist/index.css` in styles

Create the complete component with proper TypeScript types, error handling, and async loading logic.
