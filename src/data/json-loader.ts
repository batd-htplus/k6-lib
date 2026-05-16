import { SharedDataSet } from './data-set';

/**
 * Loads a JSON file (array or single object) and wraps it in a SharedDataSet.
 * A single JSON object is automatically wrapped into a one-element array.
 */
export function jsonData<T = unknown>(path: string): SharedDataSet<T> {
    return new SharedDataSet<T>(`json:${path}`, () => {
        const openFn = (globalThis as { open?: (p: string) => string }).open;
        if (!openFn) {
            console.warn(`[jsonData] k6 open() is not available for ${path}`);
            return [];
        }
        const content = openFn(path);
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) return parsed as T[];
            // wrap single object into a one-element array for consistency
            return [parsed] as T[];
        } catch (e) {
            console.error(`[jsonData] Parse failed for ${path}:`, e);
            return [];
        }
    });
}

/**
 * Loads a JSONL file (one JSON object per line) and wraps it in a SharedDataSet.
 * Lines that fail to parse are silently skipped.
 */
export function jsonlData<T = unknown>(path: string): SharedDataSet<T> {
    return new SharedDataSet<T>(`jsonl:${path}`, () => {
        const openFn = (globalThis as { open?: (p: string) => string }).open;
        if (!openFn) return [];
        const content = openFn(path);
        const out: T[] = [];
        content.split(/\r?\n/).forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            try {
                out.push(JSON.parse(trimmed) as T);
            } catch {
                // skip malformed lines
            }
        });
        return out;
    });
}

/**
 * Creates a SharedDataSet from an in-memory array. Useful for quick prototyping without file I/O.
 */
export function inlineData<T>(name: string, items: T[]): SharedDataSet<T> {
    return new SharedDataSet<T>(`inline:${name}`, () => items.slice());
}
