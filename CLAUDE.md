# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsup bundle + PostCSS CSS (for publishing)
npm run lint         # ESLint with zero warnings policy
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run (CI)
npm run test:ui      # Vitest with browser UI
npm run test:coverage
```

Run a single test file: `npx vitest run src/test/field-properties.test.ts`

## Architecture

This is a **framework-agnostic drag-and-drop form builder library** published to npm. It outputs CJS, ESM, and TypeScript declarations to `dist/`. The dev entry (`main.ts`) runs a local demo; `index.ts` is the library export.

### Two main subsystems

**Builder** (`src/builder/`) — The editor UI. `FormBuilder.ts` is the main class that owns the drag-and-drop canvas, field selection, and properties panel. Uses SortableJS for drag interactions.

**Renderer** (`src/renderer/`) — Takes a `FormSchema` and renders a read-only or submittable form. `FieldRenderer.ts` handles all 16 field types.

### State

All state lives in a single Zustand store (`src/core/useFormStore.ts`). It includes:
- `schema: FormSchema` — the current form being edited
- `selectedFieldId / selectedSectionId` — what's selected in the builder
- `history / historyIndex` — undo/redo stack
- `masterTypes`, `dropdownOptionsMap`, `lookupFieldOptionsMap` — async data from the host app

### Schema hierarchy

```
FormSchema
└── sections: FormSection[]
    ├── parentGroupId?          // nested sections
    └── fields: FormField[]
        ├── type: FieldType     // 16 types (text, select, repeater, etc.)
        ├── layout: { row, column, span }   // 4-column responsive grid
        ├── validations: FieldValidations
        └── optionSource: 'STATIC' | 'MASTER' | 'LOOKUP'
```

### Key files

| File | Purpose |
|------|---------|
| `src/core/schemaTypes.ts` | All TypeScript interfaces |
| `src/core/constants.ts` | Field types, defaults, regex presets |
| `src/utils/mapper.ts` | Schema validation, conversion, cleanup (Zod-based) |
| `src/utils/formula.ts` | Formula parsing and dependency tracking |
| `src/utils/sectionHierarchy.ts` | Parent-child section relationships |

### Build output

- `dist/index.js` — CommonJS
- `dist/index.mjs` — ES Module
- `dist/index.d.ts` — TypeScript declarations
- `dist/index.css` — Bundled TailwindCSS styles (built separately via PostCSS)

### Integration

Host apps (Angular/React) instantiate `FormBuilder` or `FormRenderer`, passing `masterTypeGroups`, `dropdownOptionsMap`, and callbacks like `onSave`, `onClone`, `onGroupSelectionChange`. The library emits DOM events and calls these callbacks — it does not depend on any framework runtime.

### Tests

Tests live in `src/test/` and `src/core/store.test.ts`. The vitest environment is `jsdom`. Test utilities are in `src/test/utils/`.
