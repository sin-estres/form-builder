import React from 'react';
import ReactDOM from 'react-dom/client';
import { FormBuilder } from './builder/FormBuilder';
import { FormRenderer } from './renderer/FormRenderer';
import { FormSchema } from './core/schemaTypes';
// import style from './index.css?inline'; // We will need to handle CSS injection

// Helper to create a React Web Component wrapper
class ReactCustomElement extends HTMLElement {
    protected root: ReactDOM.Root | null = null;
    protected props: Record<string, any> = {};
    protected Component: React.ComponentType<any>;

    constructor(Component: React.ComponentType<any>) {
        super();
        this.Component = Component;
    }

    connectedCallback() {
        if (!this.root) {
            this.root = ReactDOM.createRoot(this);
            this.render();
        }
    }

    disconnectedCallback() {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        if (oldValue !== newValue) {
            this.props[name] = newValue;
            this.render();
        }
    }

    // Allow setting complex props via JS properties
    setProp(name: string, value: any) {
        this.props[name] = value;
        this.render();
    }

    render() {
        if (this.root) {
            const Component = this.Component;
            this.root.render(
                <React.StrictMode>
                    {/* We might need to wrap with a style provider or inject styles here if using Shadow DOM */}
                    {/* For now, we assume global styles are loaded or we inject them */}
                    <Component {...this.props} />
                </React.StrictMode>
            );
        }
    }
}

// Form Builder Wrapper
class FormBuilderElement extends ReactCustomElement {
    constructor() {
        super(FormBuilder);
    }

    // Expose methods or specific props if needed
}

// Form Renderer Wrapper
class FormRendererElement extends ReactCustomElement {
    constructor() {
        super(FormRenderer);
    }

    // Define setters for complex properties
    set schema(value: FormSchema) {
        this.setProp('schema', value);
    }

    set onSubmit(value: (data: any) => void) {
        this.setProp('onSubmit', value);
    }
}

// Register the custom elements
export function registerWebComponents() {
    if (typeof window !== 'undefined') {
        if (!customElements.get('form-builder-pro')) {
            customElements.define('form-builder-pro', FormBuilderElement);
        }
        if (!customElements.get('form-renderer-pro')) {
            customElements.define('form-renderer-pro', FormRendererElement);
        }
    }
}

// Auto-register if imported directly in a browser environment via script tag
if (typeof window !== 'undefined') {
    // We can expose a global variable to init
    (window as any).FormBuilderPro = {
        register: registerWebComponents
    };
}
