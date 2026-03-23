import { FormSection } from '../core/schemaTypes';

/** Parent id that exists in the schema, or null for top-level / orphan. */
export function effectiveParentId(section: FormSection, sectionIds: Set<string>): string | null {
    const p = section.parentGroupId;
    if (!p || !sectionIds.has(p)) return null;
    return p;
}

export function getRootSections(sections: FormSection[]): FormSection[] {
    const ids = new Set(sections.map((s) => s.id));
    return sections.filter((s) => effectiveParentId(s, ids) === null);
}

/** Direct children of `parentId`, sorted by `order` (excluding `excludeSectionId` if set). */
export function getChildSections(sections: FormSection[], parentId: string, excludeSectionId?: string): FormSection[] {
    const ids = new Set(sections.map((s) => s.id));
    return sections
        .filter((s) => {
            if (excludeSectionId && s.id === excludeSectionId) return false;
            return effectiveParentId(s, ids) === parentId;
        })
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** All section ids that are descendants of `rootId` (children, grandchildren, …). */
export function getDescendantSectionIds(sections: FormSection[], rootId: string): Set<string> {
    const byParent = new Map<string, string[]>();
    sections.forEach((s) => {
        const p = s.parentGroupId;
        if (p) {
            if (!byParent.has(p)) byParent.set(p, []);
            byParent.get(p)!.push(s.id);
        }
    });
    const out = new Set<string>();
    const stack = [...(byParent.get(rootId) || [])];
    while (stack.length) {
        const id = stack.pop()!;
        if (out.has(id)) continue;
        out.add(id);
        (byParent.get(id) || []).forEach((c) => stack.push(c));
    }
    return out;
}

export function wouldCreateParentCycle(sections: FormSection[], sectionId: string, newParentId: string): boolean {
    if (newParentId === sectionId) return true;
    return getDescendantSectionIds(sections, sectionId).has(newParentId);
}

/** Sections that may be selected as parent for `sectionId` (not self, not own descendants). */
export function getValidParentSectionIds(sections: FormSection[], sectionId: string): string[] {
    const descendants = getDescendantSectionIds(sections, sectionId);
    return sections.map((s) => s.id).filter((id) => id !== sectionId && !descendants.has(id));
}

function siblingsForParent(
    sections: FormSection[],
    sectionIds: Set<string>,
    parentId: string | null,
    excludeSectionId: string
): FormSection[] {
    return sections.filter((s) => {
        if (s.id === excludeSectionId) return false;
        const eff = effectiveParentId(s, sectionIds);
        if (parentId === null) return eff === null;
        return eff === parentId;
    });
}

/** Next `order` among siblings when moving `sectionId` under `parentId` (null = root). */
export function nextSiblingOrder(sections: FormSection[], sectionId: string, parentId: string | null): number {
    const sectionIds = new Set(sections.map((s) => s.id));
    const siblings = siblingsForParent(sections, sectionIds, parentId, sectionId);
    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map((s) => s.order ?? 0)) + 1;
}

export function getNextRootOrder(sections: FormSection[]): number {
    const roots = getRootSections(sections);
    if (roots.length === 0) return 0;
    return Math.max(...roots.map((r) => r.order ?? 0)) + 1;
}
