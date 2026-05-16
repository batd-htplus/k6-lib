/**
 * Extracts a deeply nested value from an object using a dot-separated path.
 * Supports array indices (e.g., "data.items.0.name").
 */
export function extractByPath<T = unknown>(obj: unknown, path: string): T | undefined {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let cur: unknown = obj;
    for (const part of parts) {
        if (cur === null || cur === undefined) return undefined;
        if (Array.isArray(cur) && /^\d+$/.test(part)) {
            cur = cur[Number(part)];
        } else if (typeof cur === 'object') {
            cur = (cur as Record<string, unknown>)[part];
        } else {
            return undefined;
        }
    }
    return cur as T;
}
