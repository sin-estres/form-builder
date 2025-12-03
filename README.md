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

### Form Builder

```tsx
import { FormBuilder } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

function App() {
  return (
    <div className="h-screen">
      <FormBuilder />
    </div>
  );
}
```

### Form Renderer

```tsx
import { FormRenderer, FormSchema } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

const schema: FormSchema = {
  // ... your schema
};

function App() {
  const handleSubmit = (data: any) => {
    console.log(data);
  };

  return (
    <FormRenderer 
      schema={schema} 
      onSubmit={handleSubmit} 
    />
  );
}
```

### Angular / Vanilla JS (Web Components)

This package exports standard Web Components that can be used in any framework.

1. **Import the registration function** in your app's entry point (e.g., `main.ts` in Angular):

```typescript
import { registerWebComponents } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

registerWebComponents();
```

2. **Use in HTML/Template**:

```html
<!-- Builder -->
<form-builder-pro></form-builder-pro>

<!-- Renderer -->
<form-renderer-pro id="my-renderer"></form-renderer-pro>
```

3. **Pass complex data via JavaScript**:

```javascript
const renderer = document.getElementById('my-renderer');
renderer.schema = { ... }; // Pass your schema object
renderer.onSubmit = (data) => console.log(data);
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
