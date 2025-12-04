# Form Builder Pro - Usage Examples

## Installation

```bash
npm install form-builder-pro
```

**No peer dependencies required!** All dependencies are bundled.

## Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="node_modules/form-builder-pro/dist/index.css">
</head>
<body>
    <div id="app"></div>
    
    <script type="module">
        import { FormBuilder } from './node_modules/form-builder-pro/dist/index.mjs';
        
        const builder = new FormBuilder(document.getElementById('app'));
    </script>
</body>
</html>
```

## Angular

### app.component.ts
```typescript
import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder } from 'form-builder-pro';

@Component({
  selector: 'app-root',
  template: '<div #builderContainer class="h-screen"></div>',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('builderContainer') container!: ElementRef;
  private builder?: FormBuilder;

  ngAfterViewInit() {
    this.builder = new FormBuilder(this.container.nativeElement);
  }

  ngOnDestroy() {
    this.builder?.destroy();
  }
}
```

### angular.json
```json
{
  "styles": [
    "node_modules/form-builder-pro/dist/index.css",
    "src/styles.css"
  ]
}
```

## React

```tsx
import { useEffect, useRef } from 'react';
import { FormBuilder } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const builder = new FormBuilder(containerRef.current);
    
    return () => {
      builder.destroy();
    };
  }, []);

  return <div ref={containerRef} className="h-screen" />;
}
```

## Vue 3

```vue
<template>
  <div ref="container" class="h-screen"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { FormBuilder } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

const container = ref(null);
let builder = null;

onMounted(() => {
  if (container.value) {
    builder = new FormBuilder(container.value);
  }
});

onUnmounted(() => {
  builder?.destroy();
});
</script>
```

## Form Renderer

```typescript
import { FormRenderer } from 'form-builder-pro';
import 'form-builder-pro/dist/index.css';

const schema = {
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

const container = document.getElementById('form-container');
const renderer = new FormRenderer(container, schema, (data) => {
  console.log('Form submitted:', data);
});
```
