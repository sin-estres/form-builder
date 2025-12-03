export type ElementOptions = {
    className?: string;
    id?: string;
    text?: string;
    html?: string;
    src?: string;
    href?: string;
    type?: string;
    value?: string;
    placeholder?: string;
    checked?: boolean;
    disabled?: boolean;
    style?: Partial<CSSStyleDeclaration>;
    [key: string]: any;
};

export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options: ElementOptions = {},
    children: (HTMLElement | string | null | undefined)[] = []
): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);

    const { className, text, html, style, ...attrs } = options;

    if (className) el.className = className;
    if (text) el.textContent = text;
    if (html) el.innerHTML = html;

    if (style) {
        Object.assign(el.style, style);
    }

    Object.entries(attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== false) {
            if (key === 'onclick' || key.startsWith('on')) {
                // Event listeners
                el.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                // Attributes
                if (value === true) {
                    el.setAttribute(key, '');
                } else {
                    el.setAttribute(key, String(value));
                }
            }
        }
    });

    children.forEach((child) => {
        if (child) {
            if (typeof child === 'string') {
                el.appendChild(document.createTextNode(child));
            } else {
                el.appendChild(child);
            }
        }
    });

    return el;
}

export function getIcon(name: string, size: number = 16): HTMLElement {
    // We will use lucide's createIcons or just render SVG string if needed.
    // Lucide vanilla works by replacing elements with 'i' tags or similar.
    // But for dynamic creation, we might need a helper.
    // For now, let's assume we use the 'lucide' package's icons object if available, 
    // or we create an element with `data-lucide` attribute and call `createIcons()`.

    const i = createElement('i', { 'data-lucide': name, style: { width: `${size}px`, height: `${size}px` } });
    return i;
}
