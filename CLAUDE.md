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

This is a **framework-agnostic drag-and-drop form builder library** published to npm as `form-builder-pro`. It outputs CJS, ESM, and TypeScript declarations to `dist/`. The dev entry (`main.ts`) runs a local demo; `index.ts` is the library export.

### Two main subsystems

**Builder** (`src/builder/`) — The editor UI. `FormBuilder.ts` is the main class that owns the drag-and-drop canvas, field selection, and properties panel. Uses SortableJS for drag interactions. `SectionList.ts` manages section rendering and drag ordering. `FieldWrapper.ts` wraps individual fields in the builder canvas.

**Renderer** (`src/renderer/`) — Takes a `FormSchema` and renders a read-only or submittable form. `FormRenderer.ts` drives layout and validation; `FieldRenderer.ts` handles all 17 field types.

### State

All state lives in a single Zustand vanilla store (`src/core/useFormStore.ts`). It includes:
- `schema: FormSchema` — the current form being edited
- `selectedFieldId / selectedSectionId` — what's selected in the builder
- `history / historyIndex` — undo/redo stack
- `masterTypes`, `dropdownOptionsMap`, `lookupFieldOptionsMap` — async data from the host app

The store is a singleton (`formStore`); components subscribe via `formStore.subscribe(...)` and call `formStore.getState().action(...)`.

### Schema hierarchy

```
FormSchema
└── sections: FormSection[]
    ├── parentGroupId?          // nested sections
    └── fields: FormField[]
        ├── type: FieldType     // 17 types (see below)
        ├── layout: { row, column, span }   // 4-column responsive grid
        ├── validations: FieldValidations   // preferred
        ├── validation?: ValidationRule[] | ValidationObject  // legacy
        └── optionSource: 'STATIC' | 'MASTER' | 'LOOKUP'
```

### Field types (17)

`text`, `textarea`, `number`, `email`, `phone`, `date`, `datetime`, `select`, `checkbox`, `radio`, `toggle`, `binary_choice`, `repeater`, `file`, `image`, `name_generator`, `formula`

- **formula** — computed field with two modes: `single` (one expression) or `multiple` (condition table keyed off a compare field). Expressions use `{fieldRef}` bracket syntax. Handled by `FormulaEditorWidget.ts` (rich contenteditable editor) and parsed by `formulaTokenParser.ts`.
- **binary_choice** — Yes/No toggle with configurable labels and conditional field visibility (`showWhenValueOnFields` / `showWhenValueOffFields`).
- **name_generator** — auto-generated string based on `NameGeneratorFormat` (20 format variants).
- **repeater** — section-like repeating group with min/max instances.

### Key files

| File | Purpose |
|------|---------|
| `src/core/schemaTypes.ts` | All TypeScript interfaces (`FormField`, `FormSection`, `FormSchema`, `FormulaConfig`, etc.) |
| `src/core/constants.ts` | Field types, `DEFAULT_FIELD_CONFIG`, `VALIDATION_TYPE_PRESETS`, `REGEX_PRESETS` |
| `src/utils/mapper.ts` | Schema validation, conversion between legacy and current formats, `builderToPlatform` export (Zod-based) |
| `src/utils/formula.ts` | Formula parsing (`parseFormulaDependencies`), validation, circular dependency detection, evaluation |
| `src/utils/formulaTokenParser.ts` | Token-based dual-representation parser; supports `bracket` (`{ref}`) and `plain` syntax modes |
| `src/builder/FormulaEditorWidget.ts` | Rich contenteditable formula editor — chips for field refs, operator buttons, insert-field dropdown |
| `src/utils/sectionHierarchy.ts` | Parent-child section relationships and cycle detection |
| `src/utils/nameGenerator.ts` | Name generation logic for `name_generator` field type |

### Validation formats (three coexist)

1. **`FieldValidations`** (preferred, internal) — `field.validations`
2. **`ValidationObject`** (API/payload format) — `field.validation` as object, uses `regex` key not `pattern`
3. **`ValidationRule[]`** (legacy array format) — `field.validation` as array

`mapper.ts` converts between these. When writing new code, use `FieldValidations` and `field.validations`.

### Build output

- `dist/index.js` — CommonJS
- `dist/index.mjs` — ES Module
- `dist/index.d.ts` — TypeScript declarations
- `dist/index.css` — Bundled TailwindCSS styles (built separately via PostCSS)

### Integration

Host apps (Angular/React) use either `new FormBuilder(container, options)` or `initFormBuilder({ containerId, ...options })`. Key options: `masterTypeGroups`, `dropdownOptionsMap`, `lookupFieldOptionsMap`, `moduleList`, `settingsEntities`, and callbacks `onSave`, `onClone`, `onGroupSelectionChange`, `onLookupSourceChange`.

The library emits DOM events and calls these callbacks — it does not depend on any framework runtime.

### Tests

Tests live in `src/test/` and `src/core/store.test.ts`. The vitest environment is `jsdom`. Test utilities are in `src/test/utils/test-helpers.ts`.
