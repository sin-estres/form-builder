'use strict';

var React = require('react');
var ReactDOM = require('react-dom/client');
var core = require('@dnd-kit/core');
var sortable = require('@dnd-kit/sortable');
var zustand = require('zustand');
var Icons = require('lucide-react');
var clsx = require('clsx');
var jsxRuntime = require('react/jsx-runtime');
var utilities = require('@dnd-kit/utilities');
var reactDom = require('react-dom');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var React__default = /*#__PURE__*/_interopDefault(React);
var ReactDOM__default = /*#__PURE__*/_interopDefault(ReactDOM);
var Icons__namespace = /*#__PURE__*/_interopNamespace(Icons);

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/core/constants.ts
var generateId = () => Math.random().toString(36).substring(2, 9);
var FIELD_TYPES = [
  { type: "text", label: "Text Input", icon: "Type" },
  { type: "textarea", label: "Text Area", icon: "AlignLeft" },
  { type: "number", label: "Number", icon: "Hash" },
  { type: "email", label: "Email", icon: "Mail" },
  { type: "phone", label: "Phone", icon: "Phone" },
  { type: "date", label: "Date Picker", icon: "Calendar" },
  { type: "select", label: "Dropdown", icon: "ChevronDown" },
  { type: "checkbox", label: "Checkbox", icon: "CheckSquare" },
  { type: "radio", label: "Radio Group", icon: "CircleDot" },
  { type: "toggle", label: "Toggle", icon: "ToggleLeft" },
  // Lucide icon names, will be mapped later
  { type: "file", label: "File Upload", icon: "Upload" }
];
var DEFAULT_FIELD_CONFIG = {
  text: { label: "Text Input", placeholder: "Enter text...", width: "100%" },
  textarea: { label: "Text Area", placeholder: "Enter description...", width: "100%" },
  number: { label: "Number", placeholder: "0", width: "50%" },
  email: { label: "Email", placeholder: "example@email.com", width: "100%", validation: [{ type: "email", message: "Invalid email" }] },
  phone: { label: "Phone", placeholder: "+1 234 567 8900", width: "100%" },
  date: { label: "Date", width: "50%" },
  select: { label: "Dropdown", options: [{ label: "Option 1", value: "opt1" }, { label: "Option 2", value: "opt2" }], width: "100%" },
  checkbox: { label: "Checkbox", width: "100%" },
  radio: { label: "Radio Group", options: [{ label: "Option 1", value: "opt1" }, { label: "Option 2", value: "opt2" }], width: "100%" },
  toggle: { label: "Toggle", width: "50%" },
  file: { label: "File Upload", width: "100%" }
};

// src/core/useFormStore.ts
var INITIAL_SCHEMA = {
  id: "form_1",
  title: "My New Form",
  sections: [
    {
      id: generateId(),
      title: "Section 1",
      fields: []
    }
  ]
};
var useFormStore = zustand.create((set, get) => ({
  schema: INITIAL_SCHEMA,
  selectedFieldId: null,
  history: [INITIAL_SCHEMA],
  historyIndex: 0,
  isPreviewMode: false,
  setSchema: (schema) => set({ schema }),
  togglePreview: () => set((state) => ({ isPreviewMode: !state.isPreviewMode })),
  addSection: () => {
    const { schema, history, historyIndex } = get();
    const newSection = {
      id: generateId(),
      title: `Section ${schema.sections.length + 1}`,
      fields: []
    };
    const newSchema = { ...schema, sections: [...schema.sections, newSection] };
    set({
      schema: newSchema,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  removeSection: (sectionId) => {
    const { schema, history, historyIndex } = get();
    const newSchema = {
      ...schema,
      sections: schema.sections.filter((s) => s.id !== sectionId)
    };
    set({
      schema: newSchema,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  updateSection: (sectionId, updates) => {
    const { schema, history, historyIndex } = get();
    const newSchema = {
      ...schema,
      sections: schema.sections.map(
        (s) => s.id === sectionId ? { ...s, ...updates } : s
      )
    };
    set({
      schema: newSchema,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  moveSection: (activeId, overId) => {
    const { schema, history, historyIndex } = get();
    const oldIndex = schema.sections.findIndex((s) => s.id === activeId);
    const newIndex = schema.sections.findIndex((s) => s.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
      return;
    const newSections = [...schema.sections];
    const [movedSection] = newSections.splice(oldIndex, 1);
    newSections.splice(newIndex, 0, movedSection);
    const newSchema = { ...schema, sections: newSections };
    set({
      schema: newSchema,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  addField: (sectionId, type, index) => {
    const { schema, history, historyIndex } = get();
    const newField = {
      id: generateId(),
      type,
      ...DEFAULT_FIELD_CONFIG[type]
    };
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) => {
        if (s.id === sectionId) {
          const newFields = [...s.fields];
          if (typeof index === "number") {
            newFields.splice(index, 0, newField);
          } else {
            newFields.push(newField);
          }
          return { ...s, fields: newFields };
        }
        return s;
      })
    };
    set({
      schema: newSchema,
      selectedFieldId: newField.id,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  removeField: (fieldId) => {
    const { schema, history, historyIndex } = get();
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) => ({
        ...s,
        fields: s.fields.filter((f) => f.id !== fieldId)
      }))
    };
    set({
      schema: newSchema,
      selectedFieldId: null,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  updateField: (fieldId, updates) => {
    const { schema, history, historyIndex } = get();
    const newSchema = {
      ...schema,
      sections: schema.sections.map((s) => ({
        ...s,
        fields: s.fields.map((f) => f.id === fieldId ? { ...f, ...updates } : f)
      }))
    };
    set({
      schema: newSchema,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  selectField: (fieldId) => set({ selectedFieldId: fieldId }),
  moveField: (activeId, overId, activeSectionId, overSectionId) => {
    const { schema, history, historyIndex } = get();
    const newSections = schema.sections.map((s) => ({
      ...s,
      fields: [...s.fields]
    }));
    const activeSectionIndex = newSections.findIndex((s) => s.id === activeSectionId);
    const overSectionIndex = newSections.findIndex((s) => s.id === overSectionId);
    if (activeSectionIndex === -1 || overSectionIndex === -1)
      return;
    const activeSection = newSections[activeSectionIndex];
    const overSection = newSections[overSectionIndex];
    const activeFieldIndex = activeSection.fields.findIndex((f) => f.id === activeId);
    const overFieldIndex = overSection.fields.findIndex((f) => f.id === overId);
    if (activeFieldIndex === -1)
      return;
    if (activeSectionId === overSectionId) {
      if (activeFieldIndex === overFieldIndex)
        return;
      const [movedField] = activeSection.fields.splice(activeFieldIndex, 1);
      activeSection.fields.splice(overFieldIndex, 0, movedField);
    } else {
      const [movedField] = activeSection.fields.splice(activeFieldIndex, 1);
      if (overId === overSectionId) {
        overSection.fields.push(movedField);
      } else {
        const insertIndex = overFieldIndex >= 0 ? overFieldIndex : overSection.fields.length;
        overSection.fields.splice(insertIndex, 0, movedField);
      }
    }
    const newSchema = { ...schema, sections: newSections };
    set({
      schema: newSchema,
      history: [...history.slice(0, historyIndex + 1), newSchema],
      historyIndex: historyIndex + 1
    });
  },
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      set({
        schema: history[historyIndex - 1],
        historyIndex: historyIndex - 1
      });
    }
  },
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({
        schema: history[historyIndex + 1],
        historyIndex: historyIndex + 1
      });
    }
  },
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1
}));
var Toolbar = () => {
  const { undo, redo, canUndo, canRedo, setSchema, togglePreview, isPreviewMode } = useFormStore();
  const handleSave = () => {
    const schema = useFormStore.getState().schema;
    console.log("Saved Schema:", JSON.stringify(schema, null, 2));
    alert("Schema saved to console!");
  };
  const handleClear = () => {
    if (confirm("Are you sure you want to clear the form?")) {
      setSchema({
        id: "form_" + Date.now(),
        title: "New Form",
        sections: []
      });
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center space-x-2", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mr-4", children: "FormBuilder Pro" }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: undo,
          disabled: !canUndo(),
          className: "p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          title: "Undo",
          children: /* @__PURE__ */ jsxRuntime.jsx(Icons.Undo, { size: 18 })
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          onClick: redo,
          disabled: !canRedo(),
          className: "p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          title: "Redo",
          children: /* @__PURE__ */ jsxRuntime.jsx(Icons.Redo, { size: 18 })
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center space-x-2", children: [
      /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          onClick: handleClear,
          className: "flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors",
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(Icons.Trash2, { size: 16, className: "mr-2" }),
            "Clear"
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          onClick: togglePreview,
          className: clsx.clsx(
            "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
            isPreviewMode ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          ),
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(Icons.Eye, { size: 16, className: "mr-2" }),
            isPreviewMode ? "Edit" : "Preview"
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          onClick: handleSave,
          className: "flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors",
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(Icons.Save, { size: 16, className: "mr-2" }),
            "Save"
          ]
        }
      )
    ] })
  ] });
};
var getIcon = (name) => {
  const Icon = Icons__namespace[name];
  return Icon ? /* @__PURE__ */ jsxRuntime.jsx(Icon, { size: 16 }) : null;
};
var ToolboxItem = ({ type, label, icon }) => {
  const { attributes, listeners, setNodeRef, transform } = core.useDraggable({
    id: `toolbox-${type}`,
    data: {
      type: "toolbox-item",
      fieldType: type
    }
  });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
  } : void 0;
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref: setNodeRef,
      ...listeners,
      ...attributes,
      style,
      className: "flex items-center p-3 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md cursor-move hover:border-blue-500 hover:shadow-sm transition-all",
      children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "mr-3 text-gray-500 dark:text-gray-400", children: getIcon(icon) }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm font-medium text-gray-700 dark:text-gray-200", children: label })
      ]
    }
  );
};
var FieldToolbox = () => {
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 overflow-y-auto h-full", children: [
    /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4", children: "Form Fields" }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "space-y-1", children: FIELD_TYPES.map((field) => /* @__PURE__ */ jsxRuntime.jsx(
      ToolboxItem,
      {
        type: field.type,
        label: field.label,
        icon: field.icon
      },
      field.type
    )) })
  ] });
};
var FieldRenderer = ({ field, value, onChange, readOnly, error }) => {
  const baseInputClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const renderInput = () => {
    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "number":
      case "date":
      case "file":
        return /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type: field.type === "phone" ? "tel" : field.type,
            id: field.id,
            placeholder: field.placeholder,
            className: baseInputClass,
            value: value || "",
            onChange: (e) => onChange?.(e.target.value),
            disabled: readOnly
          }
        );
      case "textarea":
        return /* @__PURE__ */ jsxRuntime.jsx(
          "textarea",
          {
            id: field.id,
            placeholder: field.placeholder,
            className: clsx.clsx(baseInputClass, "min-h-[80px]"),
            value: value || "",
            onChange: (e) => onChange?.(e.target.value),
            disabled: readOnly
          }
        );
      case "select":
        return /* @__PURE__ */ jsxRuntime.jsxs(
          "select",
          {
            id: field.id,
            className: baseInputClass,
            value: value || "",
            onChange: (e) => onChange?.(e.target.value),
            disabled: readOnly,
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("option", { value: "", disabled: true, children: "Select an option" }),
              field.options?.map((opt) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: opt.value, children: opt.label }, opt.value))
            ]
          }
        );
      case "checkbox":
        return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center h-10", children: /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type: "checkbox",
            id: field.id,
            className: "h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer",
            checked: !!value,
            onChange: (e) => onChange?.(e.target.checked),
            disabled: readOnly
          }
        ) });
      case "radio":
        return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "space-y-2", children: field.options?.map((opt) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center space-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "radio",
              id: `${field.id}-${opt.value}`,
              name: field.id,
              value: opt.value,
              checked: value === opt.value,
              onChange: (e) => onChange?.(e.target.value),
              disabled: readOnly,
              className: "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("label", { htmlFor: `${field.id}-${opt.value}`, className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", children: opt.label })
        ] }, opt.value)) });
      case "toggle":
        return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center space-x-2", children: /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            role: "switch",
            "aria-checked": !!value,
            onClick: () => !readOnly && onChange?.(!value),
            className: clsx.clsx(
              "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              value ? "bg-primary" : "bg-input"
            ),
            disabled: readOnly,
            children: /* @__PURE__ */ jsxRuntime.jsx(
              "span",
              {
                className: clsx.clsx(
                  "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                  value ? "translate-x-5" : "translate-x-0"
                )
              }
            )
          }
        ) });
      default:
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-red-500", children: [
          "Unknown field type: ",
          field.type
        ] });
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "w-full", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("label", { htmlFor: field.id, className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block text-gray-900 dark:text-gray-100", children: [
      field.label,
      field.required && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-red-500 ml-1", children: "*" })
    ] }),
    renderInput(),
    field.description && /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-muted-foreground mt-1", children: field.description }),
    error && /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm font-medium text-destructive mt-1", children: error })
  ] });
};
var SortableField = ({ field }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = sortable.useSortable({
    id: field.id,
    data: {
      type: "field",
      field
    }
  });
  const { selectField, selectedFieldId, removeField } = useFormStore();
  const isSelected = selectedFieldId === field.id;
  const style = {
    transform: utilities.CSS.Transform.toString(transform),
    transition,
    gridColumn: field.width === "100%" ? "span 4" : field.width === "50%" ? "span 2" : "span 1"
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      className: clsx.clsx(
        "relative group rounded-lg border-2 transition-all bg-white dark:bg-gray-800",
        isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600",
        isDragging && "opacity-50 z-50"
      ),
      onClick: (e) => {
        e.stopPropagation();
        selectField(field.id);
      },
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            ...attributes,
            ...listeners,
            className: clsx.clsx(
              "absolute top-2 left-2 cursor-move p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity",
              isSelected && "opacity-100"
            ),
            children: /* @__PURE__ */ jsxRuntime.jsx(Icons.GripVertical, { size: 16 })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              removeField(field.id);
            },
            className: clsx.clsx(
              "absolute top-2 right-2 p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity",
              isSelected && "opacity-100"
            ),
            children: /* @__PURE__ */ jsxRuntime.jsx(Icons.Trash2, { size: 16 })
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "p-4 pointer-events-none", children: /* @__PURE__ */ jsxRuntime.jsx(FieldRenderer, { field, readOnly: true }) })
      ]
    }
  );
};
var SortableSection = ({ section }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = sortable.useSortable({
    id: section.id,
    data: {
      type: "section",
      section
    }
  });
  const { removeSection, updateSection } = useFormStore();
  const { setNodeRef: setDroppableNodeRef } = core.useDroppable({
    id: section.id,
    data: {
      type: "section",
      section
    }
  });
  const style = {
    transform: utilities.CSS.Transform.toString(transform),
    transition
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      ref: setNodeRef,
      style,
      className: clsx.clsx(
        "mb-6 rounded-lg border bg-white dark:bg-gray-900 shadow-sm transition-all",
        isDragging ? "opacity-50 z-50 border-blue-500" : "border-gray-200 dark:border-gray-800"
      ),
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center flex-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                ...attributes,
                ...listeners,
                className: "cursor-move mr-3 text-gray-400 hover:text-gray-600",
                children: /* @__PURE__ */ jsxRuntime.jsx(Icons.GripVertical, { size: 20 })
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                value: section.title,
                onChange: (e) => updateSection(section.id, { title: e.target.value }),
                className: "bg-transparent font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:border-b border-blue-500",
                placeholder: "Section Title"
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              onClick: () => removeSection(section.id),
              className: "text-gray-400 hover:text-red-500 transition-colors p-1",
              children: /* @__PURE__ */ jsxRuntime.jsx(Icons.Trash2, { size: 18 })
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            ref: setDroppableNodeRef,
            className: "p-4 min-h-[100px] grid grid-cols-4 gap-4",
            children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                sortable.SortableContext,
                {
                  items: section.fields.map((f) => f.id),
                  strategy: sortable.rectSortingStrategy,
                  children: section.fields.map((field) => /* @__PURE__ */ jsxRuntime.jsx(SortableField, { field }, field.id))
                }
              ),
              section.fields.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "col-span-4 flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-400", children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm", children: "Drop fields here" }) })
            ]
          }
        )
      ]
    }
  );
};
var Canvas = () => {
  const { schema, addSection, selectField } = useFormStore();
  const { setNodeRef } = core.useDroppable({
    id: "canvas",
    data: {
      type: "canvas"
    }
  });
  return /* @__PURE__ */ jsxRuntime.jsx(
    "div",
    {
      className: "flex-1 bg-gray-100 dark:bg-gray-950 p-8 overflow-y-auto h-full",
      onClick: () => selectField(null),
      children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-3xl mx-auto", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mb-8 text-center", children: /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            value: schema.title,
            onChange: (e) => useFormStore.getState().setSchema({ ...schema, title: e.target.value }),
            className: "text-3xl font-bold text-center bg-transparent border-none focus:outline-none focus:ring-0 w-full text-gray-900 dark:text-white",
            placeholder: "Form Title"
          }
        ) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { ref: setNodeRef, className: "space-y-6 min-h-[200px]", children: /* @__PURE__ */ jsxRuntime.jsx(
          sortable.SortableContext,
          {
            items: schema.sections.map((s) => s.id),
            strategy: sortable.verticalListSortingStrategy,
            children: schema.sections.map((section) => /* @__PURE__ */ jsxRuntime.jsx(SortableSection, { section }, section.id))
          }
        ) }),
        /* @__PURE__ */ jsxRuntime.jsxs(
          "button",
          {
            onClick: addSection,
            className: "w-full mt-6 py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center font-medium",
            children: [
              /* @__PURE__ */ jsxRuntime.jsx(Icons.Plus, { size: 20, className: "mr-2" }),
              "Add Section"
            ]
          }
        )
      ] })
    }
  );
};
var FieldConfigPanel = () => {
  const { schema, selectedFieldId, updateField, selectField } = useFormStore();
  const selectedField = React__default.default.useMemo(() => {
    if (!selectedFieldId)
      return null;
    for (const section of schema.sections) {
      const field = section.fields.find((f) => f.id === selectedFieldId);
      if (field)
        return field;
    }
    return null;
  }, [schema, selectedFieldId]);
  if (!selectedField) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center justify-center text-center text-gray-500", children: /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Select a field to configure its properties" }) });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "font-semibold text-gray-900 dark:text-white", children: "Field Settings" }),
      /* @__PURE__ */ jsxRuntime.jsx("button", { onClick: () => selectField(null), className: "text-gray-500 hover:text-gray-700", children: /* @__PURE__ */ jsxRuntime.jsx(Icons.X, { size: 20 }) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Label" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: selectedField.label,
              onChange: (e) => updateField(selectedField.id, { label: e.target.value }),
              className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Placeholder" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: selectedField.placeholder || "",
              onChange: (e) => updateField(selectedField.id, { placeholder: e.target.value }),
              className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Description" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "textarea",
            {
              value: selectedField.description || "",
              onChange: (e) => updateField(selectedField.id, { description: e.target.value }),
              className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent",
              rows: 2
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("hr", { className: "border-gray-200 dark:border-gray-800" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-medium text-gray-900 dark:text-white", children: "Layout" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Width" }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              value: selectedField.width,
              onChange: (e) => updateField(selectedField.id, { width: e.target.value }),
              className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent",
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "25%", children: "25% (1/4)" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "50%", children: "50% (1/2)" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "100%", children: "100% (Full)" })
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("hr", { className: "border-gray-200 dark:border-gray-800" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-medium text-gray-900 dark:text-white", children: "Validation" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntime.jsx("label", { className: "text-sm text-gray-700 dark:text-gray-300", children: "Required" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "checkbox",
              checked: selectedField.required || false,
              onChange: (e) => updateField(selectedField.id, { required: e.target.checked }),
              className: "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            }
          )
        ] })
      ] }),
      (selectedField.type === "select" || selectedField.type === "radio") && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx("hr", { className: "border-gray-200 dark:border-gray-800" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-medium text-gray-900 dark:text-white", children: "Options" }),
          selectedField.options?.map((option, index) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                placeholder: "Label",
                value: option.label,
                onChange: (e) => {
                  const newOptions = [...selectedField.options || []];
                  newOptions[index].label = e.target.value;
                  updateField(selectedField.id, { options: newOptions });
                },
                className: "flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                placeholder: "Value",
                value: option.value,
                onChange: (e) => {
                  const newOptions = [...selectedField.options || []];
                  newOptions[index].value = e.target.value;
                  updateField(selectedField.id, { options: newOptions });
                },
                className: "flex-1 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                onClick: () => {
                  const newOptions = selectedField.options?.filter((_, i) => i !== index);
                  updateField(selectedField.id, { options: newOptions });
                },
                className: "text-red-500 hover:text-red-700",
                children: /* @__PURE__ */ jsxRuntime.jsx(Icons.X, { size: 16 })
              }
            )
          ] }, index)),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              onClick: () => {
                const newOptions = [...selectedField.options || [], { label: "New Option", value: "new_option" }];
                updateField(selectedField.id, { options: newOptions });
              },
              className: "text-sm text-blue-600 hover:text-blue-700 font-medium",
              children: "+ Add Option"
            }
          )
        ] })
      ] })
    ] })
  ] });
};
var FormRenderer = ({ schema, onSubmit, className }) => {
  const [formData, setFormData] = React.useState({});
  const [errors, setErrors] = React.useState({});
  const handleChange = (fieldId, value) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };
  const validate = () => {
    const newErrors = {};
    let isValid = true;
    schema.sections.forEach((section) => {
      section.fields.forEach((field) => {
        const value = formData[field.id];
        if (field.required && !value) {
          newErrors[field.id] = "This field is required";
          isValid = false;
        }
        if (field.validation) {
          field.validation.forEach((rule) => {
            if (rule.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              newErrors[field.id] = rule.message || "Invalid email address";
              isValid = false;
            }
            if (rule.type === "min" && typeof value === "number" && value < rule.value) {
              newErrors[field.id] = rule.message || `Minimum value is ${rule.value}`;
              isValid = false;
            }
          });
        }
      });
    });
    setErrors(newErrors);
    return isValid;
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit?.(formData);
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSubmit, className: clsx.clsx("space-y-8", className), children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "space-y-2", children: /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: schema.title }) }),
    schema.sections.map((section) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-xl font-semibold text-gray-800 dark:text-gray-200 border-b pb-2", children: section.title }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "grid grid-cols-4 gap-4", children: section.fields.map((field) => /* @__PURE__ */ jsxRuntime.jsx(
        "div",
        {
          style: {
            gridColumn: field.width === "100%" ? "span 4" : field.width === "50%" ? "span 2" : "span 1"
          },
          children: /* @__PURE__ */ jsxRuntime.jsx(
            FieldRenderer,
            {
              field,
              value: formData[field.id],
              onChange: (val) => handleChange(field.id, val),
              error: errors[field.id]
            }
          )
        },
        field.id
      )) })
    ] }, section.id)),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "pt-4", children: /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        type: "submit",
        className: "px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors",
        children: "Submit"
      }
    ) })
  ] });
};
var dropAnimation = {
  sideEffects: core.defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.5"
      }
    }
  })
};
var FormBuilder = () => {
  const {
    schema,
    addField,
    moveField,
    moveSection,
    isPreviewMode
  } = useFormStore();
  const [activeId, setActiveId] = React.useState(null);
  const [activeData, setActiveData] = React.useState(null);
  const sensors = core.useSensors(
    core.useSensor(core.PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    core.useSensor(core.KeyboardSensor, {
      coordinateGetter: sortable.sortableKeyboardCoordinates
    })
  );
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    setActiveData(event.active.data.current);
  };
  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over)
      return;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    if (activeType === "toolbox-item" && overType === "section") {
      return;
    }
  };
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveData(null);
    if (!over)
      return;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;
    if (activeType === "toolbox-item") {
      const fieldType = active.data.current?.fieldType;
      if (overType === "section") {
        addField(over.id, fieldType);
      } else if (overType === "field") {
        const section = schema.sections.find((s) => s.fields.some((f) => f.id === over.id));
        if (section) {
          const index = section.fields.findIndex((f) => f.id === over.id);
          addField(section.id, fieldType, index + 1);
        }
      }
      return;
    }
    if (activeType === "section" && overType === "section") {
      if (active.id !== over.id) {
        moveSection(active.id, over.id);
      }
      return;
    }
    if (activeType === "field") {
      const activeFieldId = active.id;
      const overId = over.id;
      const activeSection = schema.sections.find((s) => s.fields.some((f) => f.id === activeFieldId));
      let overSection;
      if (overType === "section") {
        overSection = schema.sections.find((s) => s.id === overId);
      } else if (overType === "field") {
        overSection = schema.sections.find((s) => s.fields.some((f) => f.id === overId));
      }
      if (activeSection && overSection) {
        moveField(activeFieldId, overId, activeSection.id, overSection.id);
      }
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(
    core.DndContext,
    {
      sensors,
      collisionDetection: core.closestCorners,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col h-screen bg-gray-100 dark:bg-gray-950", children: [
          /* @__PURE__ */ jsxRuntime.jsx(Toolbar, {}),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-1 overflow-hidden", children: isPreviewMode ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex-1 p-8 overflow-y-auto bg-white dark:bg-gray-900 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-full max-w-3xl", children: /* @__PURE__ */ jsxRuntime.jsx(FormRenderer, { schema, onSubmit: (data) => alert(JSON.stringify(data, null, 2)) }) }) }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(FieldToolbox, {}),
            /* @__PURE__ */ jsxRuntime.jsx(Canvas, {}),
            /* @__PURE__ */ jsxRuntime.jsx(FieldConfigPanel, {})
          ] }) })
        ] }),
        reactDom.createPortal(
          /* @__PURE__ */ jsxRuntime.jsxs(core.DragOverlay, { dropAnimation, children: [
            activeId && activeData?.type === "toolbox-item" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "p-3 bg-white border border-blue-500 rounded shadow-lg w-48", children: activeData.fieldType }),
            activeId && activeData?.type === "field" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "opacity-80", children: /* @__PURE__ */ jsxRuntime.jsx(SortableField, { field: activeData.field }) }),
            activeId && activeData?.type === "section" && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "opacity-80", children: /* @__PURE__ */ jsxRuntime.jsx(SortableSection, { section: activeData.section }) })
          ] }),
          document.body
        )
      ]
    }
  );
};
var ReactCustomElement = class extends HTMLElement {
  constructor(Component) {
    super();
    __publicField(this, "root", null);
    __publicField(this, "props", {});
    __publicField(this, "Component");
    this.Component = Component;
  }
  connectedCallback() {
    if (!this.root) {
      this.root = ReactDOM__default.default.createRoot(this);
      this.render();
    }
  }
  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.props[name] = newValue;
      this.render();
    }
  }
  // Allow setting complex props via JS properties
  setProp(name, value) {
    this.props[name] = value;
    this.render();
  }
  render() {
    if (this.root) {
      const Component = this.Component;
      this.root.render(
        /* @__PURE__ */ jsxRuntime.jsx(React__default.default.StrictMode, { children: /* @__PURE__ */ jsxRuntime.jsx(Component, { ...this.props }) })
      );
    }
  }
};
var FormBuilderElement = class extends ReactCustomElement {
  constructor() {
    super(FormBuilder);
  }
  // Expose methods or specific props if needed
};
var FormRendererElement = class extends ReactCustomElement {
  constructor() {
    super(FormRenderer);
  }
  // Define setters for complex properties
  set schema(value) {
    this.setProp("schema", value);
  }
  set onSubmit(value) {
    this.setProp("onSubmit", value);
  }
};
function registerWebComponents() {
  if (typeof window !== "undefined") {
    if (!customElements.get("form-builder-pro")) {
      customElements.define("form-builder-pro", FormBuilderElement);
    }
    if (!customElements.get("form-renderer-pro")) {
      customElements.define("form-renderer-pro", FormRendererElement);
    }
  }
}
if (typeof window !== "undefined") {
  window.FormBuilderPro = {
    register: registerWebComponents
  };
}

exports.registerWebComponents = registerWebComponents;
//# sourceMappingURL=out.js.map
//# sourceMappingURL=web-components.js.map