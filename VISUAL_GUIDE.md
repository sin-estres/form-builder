# Form Builder Pro - Visual Guide

## What It Looks Like

After installing the package, here's what you get:

### 1. Main Builder Interface

![Form Builder Main View](/Users/rakeshkaushik/.gemini/antigravity/brain/41f15e49-f8b3-47a7-ac3e-4e969dc5dbcd/main_builder_view_1764848659222.png)

**Components:**
- **Left Sidebar (Toolbox)**: Draggable field types
  - Text, Email, Number, Date
  - Textarea, Dropdown, Checkbox
  - Radio, Toggle, File Upload, Phone
  
- **Center Canvas**: Your form building area
  - Drag fields here
  - Organize into sections
  - Reorder by dragging
  
- **Right Panel**: Field configuration
  - Label, Placeholder, Description
  - Width (25%, 50%, 100%)
  - Required toggle
  - Options for select/radio fields

- **Top Toolbar**:
  - Undo/Redo buttons
  - Clear form
  - Preview/Edit toggle
  - Save schema

### 2. Preview Mode

![Preview Mode](/Users/rakeshkaushik/.gemini/antigravity/brain/41f15e49-f8b3-47a7-ac3e-4e969dc5dbcd/preview_mode_1764848667719.png)

**What you see:**
- Fully rendered form with all your fields
- Responsive grid layout
- Submit button
- Live validation
- Exactly how end-users will see it

### 3. Interactive Demo

![Form Builder Demo](/Users/rakeshkaushik/.gemini/antigravity/brain/41f15e49-f8b3-47a7-ac3e-4e969dc5dbcd/form_builder_demo_1764848641363.webp)

Watch the recording above to see:
- Dragging fields from toolbox to canvas
- Configuring field properties
- Switching between edit and preview modes

## How to Use After Installation

### Step 1: Install
```bash
npm install form-builder-pro
```

### Step 2: Import
```typescript
import { FormBuilder } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';
```

### Step 3: Initialize
```typescript
const container = document.getElementById('app');
const builder = new FormBuilder(container);
```

That's it! The complete interface shown above will render in your container.

## Features You Get

### Drag & Drop
- ✅ Drag field types from toolbox
- ✅ Drop onto canvas to add
- ✅ Reorder sections and fields
- ✅ Move fields between sections

### Configuration
- ✅ Click any field to configure
- ✅ Set labels, placeholders, descriptions
- ✅ Mark fields as required
- ✅ Adjust field widths (responsive grid)
- ✅ Add options for dropdowns/radio buttons

### State Management
- ✅ Undo/Redo any action
- ✅ Auto-save state
- ✅ Export schema as JSON
- ✅ Import existing schemas

### Preview & Testing
- ✅ Toggle preview mode instantly
- ✅ Test form validation
- ✅ See responsive layout
- ✅ Submit to test callbacks

## Real-World Example

```typescript
// In your Angular/React/Vue app
import { FormBuilder, FormRenderer } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

// 1. Let users build forms
const builder = new FormBuilder(document.getElementById('builder'));

// 2. Get the schema (JSON)
// User builds form visually, you get:
const schema = {
  id: 'contact-form',
  title: 'Contact Us',
  sections: [
    {
      id: 'section1',
      title: 'Personal Info',
      fields: [
        { id: 'name', type: 'text', label: 'Name', required: true },
        { id: 'email', type: 'email', label: 'Email', required: true }
      ]
    }
  ]
};

// 3. Render the form anywhere
const renderer = new FormRenderer(
  document.getElementById('form'),
  schema,
  (data) => {
    console.log('Submitted:', data);
    // { name: 'John', email: 'john@example.com' }
  }
);
```

## Styling

The package includes beautiful, modern styling:
- 🎨 Light and dark mode support
- 📱 Fully responsive
- ✨ Smooth animations
- 🎯 Accessible (keyboard navigation, ARIA labels)

No additional CSS needed - just import the stylesheet!
