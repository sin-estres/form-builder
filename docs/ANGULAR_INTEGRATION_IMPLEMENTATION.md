# Angular Integration Implementation

This document describes the implementation of Angular integration features for form-builder-pro.

## Overview

The form-builder-pro package now supports integration with Angular applications for dynamic dropdown population based on Master Types.

## Features Implemented

### 1. Master Type Groups Input

Angular can pass `masterTypeGroups` to populate the Group dropdown in form-builder-pro.

**Input Format:**
```typescript
masterTypeGroups: {
  id: string;
  displayName: string;
  enumName: string;
}[]
```

**Usage:**
- Display value: `displayName` (shown in dropdown)
- Internal value: `enumName` (used for API calls and mapping)

### 2. Group Selection Event

When a user selects a Group value in the dropdown, form-builder-pro emits a `groupSelectionChange` event.

**Event Payload:**
```typescript
{
  fieldId: string;
  groupEnumName: string;
}
```

**Callback:**
```typescript
onGroupSelectionChange?: (event: { fieldId: string; groupEnumName: string }) => void;
```

### 3. Dynamic Dropdown Options Map

Angular can provide a `dropdownOptionsMap` that maps `groupEnumName` to dropdown options.

**Input Format:**
```typescript
dropdownOptionsMap: {
  [groupEnumName: string]: {
    label: string;
    value: string;
  }[];
}
```

**Usage:**
- Angular receives `groupSelectionChange` event
- Angular calls backend API based on `groupEnumName`
- Angular sends API response back via `dropdownOptionsMap`
- form-builder-pro automatically updates dropdown options

### 4. Dropdown Value Change Event

When a user selects a value from the dropdown, form-builder-pro emits a `dropdownValueChange` event.

**Event Payload:**
```typescript
{
  fieldId: string;
  value: string;
}
```

**Callback:**
```typescript
onDropdownValueChange?: (event: { fieldId: string; value: string }) => void;
```

## API Methods

### FormBuilder Constructor Options

```typescript
const builder = new FormBuilder(containerElement, {
  masterTypeGroups: [
    {
      id: "693afa421b790717a8b22cd5",
      displayName: "Commodities",
      enumName: "COMMODITIES"
    },
    // ... more groups
  ],
  dropdownOptionsMap: {
    "COMMODITIES": [
      { label: "MS Steel", value: "MS_STEEL" },
      { label: "SS Steel", value: "SS_STEEL" }
    ]
  },
  onGroupSelectionChange: (event) => {
    console.log('Group selected:', event);
    // Angular: Call API based on event.groupEnumName
  },
  onDropdownValueChange: (event) => {
    console.log('Dropdown value changed:', event);
    // Angular: Handle final selection
  }
});
```

### Public Methods

#### `updateDropdownOptionsMap(dropdownOptionsMap)`

Dynamically update dropdown options after Angular receives API response.

```typescript
builder.updateDropdownOptionsMap({
  "COMMODITIES": [
    { label: "MS Steel", value: "MS_STEEL" },
    { label: "SS Steel", value: "SS_STEEL" }
  ]
});
```

#### `updateMasterTypeGroups(masterTypeGroups)`

Dynamically update master type groups.

```typescript
builder.updateMasterTypeGroups([
  {
    id: "693afa421b790717a8b22cd5",
    displayName: "Commodities",
    enumName: "COMMODITIES"
  }
]);
```

## Complete Flow

1. **Angular sends Master Types** → `masterTypeGroups` populates Group dropdown
2. **User selects Group** → `groupSelectionChange` event emitted with `fieldId` and `groupEnumName`
3. **Angular receives event** → Calls backend API based on `groupEnumName`
4. **Angular sends API response** → Calls `updateDropdownOptionsMap()` with response
5. **form-builder-pro updates dropdown** → Options automatically updated
6. **User selects dropdown value** → `dropdownValueChange` event emitted with `fieldId` and `value`

## Implementation Details

### Store Updates

- Added `dropdownOptionsMap` to `FormState`
- Added `setDropdownOptionsMap` action to update map and automatically update field options
- `setSchema` now checks `dropdownOptionsMap` before falling back to master type indexes

### FormBuilder Updates

- Group dropdown now uses `enumName` as value and `displayName` as display text
- Emits `groupSelectionChange` event when group is selected
- Checks `dropdownOptionsMap` for options before using master type indexes

### FormRenderer Updates

- Accepts `onDropdownValueChange` callback
- Emits `dropdownValueChange` event when dropdown value changes

## Backward Compatibility

- All new features are optional
- Existing functionality continues to work without Angular integration
- `masterTypes` (via `data.masterTypes`) still works as before
- Falls back to master type `indexes` if `dropdownOptionsMap` is not available





