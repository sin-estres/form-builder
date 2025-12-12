# Form Builder Pro - Responsive Design System Reference

## Breakpoints

| Name | Min Width | Grid Columns | Tailwind Prefix |
|------|-----------|--------------|-----------------|
| Mobile | 0px | 1 | (base) |
| Small | 640px | 6 | `sm:` |
| Medium | 768px | 6 | `md:` |
| Large | 1024px | 12 | `lg:` |
| XL | 1280px | 12 | `xl:` |
| 2XL | 1536px | 12 | `2xl:` |

## Touch-Friendly Standards

### Minimum Touch Targets
```typescript
// All interactive elements
className: 'min-w-touch min-h-touch'  // 44x44px minimum
```

### Drag Handles
```typescript
className: 'min-w-touch min-h-touch flex items-center justify-center'
```

### Buttons
```typescript
// Icon buttons
className: 'p-2 min-w-touch min-h-touch'

// Text buttons
className: 'px-4 py-2 min-h-touch'

// Full-width mobile, auto desktop
className: 'w-full sm:w-auto px-6 py-3 min-h-touch'
```

## Responsive Layout Patterns

### Sidebars
```typescript
// Full-width mobile → fixed width desktop
className: 'w-full md:w-64 lg:w-80'
```

### Padding
```typescript
// Progressive padding
className: 'p-4 md:p-6 lg:p-8'
className: 'p-3 md:p-4'
className: 'p-2 md:p-3'
```

### Spacing
```typescript
// Vertical spacing
className: 'space-y-4 md:space-y-6'
className: 'space-y-3 md:space-y-4'

// Gap
className: 'gap-2 md:gap-3'
```

### Typography
```typescript
// Headings
className: 'text-xl md:text-2xl'
className: 'text-lg md:text-xl'
className: 'text-lg sm:text-xl'

// Body text
className: 'text-sm md:text-base'
className: 'text-xs sm:text-sm'
```

### Flexbox Layouts
```typescript
// Stack on mobile, horizontal on desktop
className: 'flex flex-col md:flex-row'
className: 'flex flex-col sm:flex-row'

// Responsive alignment
className: 'justify-center sm:justify-start'
className: 'items-start sm:items-center'
```

### Grid Layouts
```typescript
// Responsive columns
className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
className: 'grid grid-cols-2 gap-2 md:gap-3'
```

### Width Constraints
```typescript
// Prevent overflow on mobile
className: 'max-w-full lg:max-w-5xl'
className: 'w-full max-w-3xl'
```

## Form Builder Specific Classes

### Grid System
```css
.form-builder-grid
/* Mobile: 1 column, Tablet: 6 columns, Desktop: 12 columns */
```

### Column Spans
```css
.col-span-{1-12}
/* Automatically responsive based on grid columns */
```

### Field Wrapper
```css
.form-builder-field-wrapper
/* Includes min-height for touch targets */
```

### Sidebar
```css
.form-builder-sidebar
/* Mobile: overlay, Tablet+: inline */
```

## SortableJS Configuration

```typescript
new Sortable(element, {
  animation: 150,
  forceFallback: true,      // Better touch support
  delay: 100,               // Prevent accidental drags
  delayOnTouchOnly: true,   // Only delay on touch devices
  // ... other options
});
```

## CSS Scoping

All custom styles use `.form-builder-*` prefix to avoid conflicts with parent applications.

## Mobile-First Approach

Always write base styles for mobile, then add breakpoints for larger screens:

```css
/* ✅ Correct: Mobile first */
.my-element {
  padding: 1rem;           /* Mobile */
}
@media (min-width: 768px) {
  .my-element {
    padding: 1.5rem;       /* Tablet+ */
  }
}

/* ❌ Incorrect: Desktop first */
.my-element {
  padding: 1.5rem;
}
@media (max-width: 767px) {
  .my-element {
    padding: 1rem;
  }
}
```

## Common Responsive Patterns

### Hide/Show Elements
```typescript
// Hide on mobile, show on desktop
className: 'hidden md:block'

// Show on mobile, hide on desktop
className: 'block md:hidden'

// Toolbar text (icon-only on mobile)
className: 'toolbar-text'  // Hidden via CSS on mobile
```

### Responsive Input Heights
```typescript
// Text inputs
className: 'flex min-h-touch w-full rounded-md border ...'

// Select dropdowns
className: 'flex min-h-touch w-full rounded-md border ...'
```

### Responsive Icons/Controls
```typescript
// Checkboxes
className: 'h-5 w-5 sm:h-6 sm:w-6'

// Radio buttons
className: 'h-4 w-4 sm:h-5 sm:w-5'

// Icons in toolbox
className: 'w-8 h-8 md:w-9 md:h-9'
```

## Testing Checklist

- [ ] Test at 375px (mobile)
- [ ] Test at 768px (tablet)
- [ ] Test at 1280px (desktop)
- [ ] Verify no horizontal scroll
- [ ] Verify all buttons are 44px minimum
- [ ] Test drag-and-drop on touch device
- [ ] Test in target framework (Angular/React/Vue)
- [ ] Verify no CSS conflicts with parent app
