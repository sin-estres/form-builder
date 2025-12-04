# Form Builder Pro

A production-grade, reusable Drag & Drop Form Builder for React.

## Features

- 🏗 **Drag & Drop Builder**: Intuitive interface to build forms.
- 🧩 **Modular Architecture**: Separate Builder and Renderer components.
- 📱 **Responsive Grid**: 4-column grid system with configurable field widths (25%, 50%, 100%).
- ⚡ **Performance**: Built with Vite and optimized for speed.
- 🎨 **Customizable**: Built with TailwindCSS, easy to theme.
- 🛡 **Type Safe**: Written in TypeScript with Zod validation.
- 💾 **State Management**: Zustand store with Undo/Redo support.

## Installation

```bash
npm install form-builder-pro
```

## Usage

### Vanilla JS / Angular / Vue

This package is framework-agnostic. You can use it anywhere.

1. **Import the classes**:

```typescript
import { FormBuilder, FormRenderer } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';
```

2. **Initialize Builder**:

```typescript
const container = document.getElementById('builder-container');
const builder = new FormBuilder(container);

// To destroy
// builder.destroy();
```

3. **Initialize Renderer**:

```typescript
const container = document.getElementById('form-container');
const renderer = new FormRenderer(container, schema, (data) => {
    console.log('Form submitted:', data);
});
```

### Angular Example

In your component:

```typescript
import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder } from 'form-builder-pro';

@Component({ ... })
export class MyComponent implements AfterViewInit {
  @ViewChild('builderContainer') container: ElementRef;

  ngAfterViewInit() {
    new FormBuilder(this.container.nativeElement);
  }
}
```

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Run tests:
   ```bash
   npm test
   ```
5. Build for production:
   ```bash
   npm run build
   ```

## License

MIT
# form-builder
# form-builder
# form-builder
