/** Read an environment variable. Checks k6 `__ENV` first, then falls back to `process.env`. */
export function env(key: string, defaultValue?: string): string {
    const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
    const v = k6Env?.[key];
    if (v !== undefined && v !== '') return v;
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] as string;
    }
    return defaultValue || '';
}

/** Read an environment variable and parse it as an integer. Returns `defaultValue` on missing or invalid input. */
export function envInt(key: string, defaultValue = 0): number {
    const v = env(key);
    if (!v) return defaultValue;
    const n = parseInt(v, 10);
    return isNaN(n) ? defaultValue : n;
}

/** Read an environment variable and interpret it as a boolean (`true`, `1`, `yes` → `true`). */
export function envBool(key: string, defaultValue = false): boolean {
    const v = env(key).toLowerCase();
    if (!v) return defaultValue;
    return v === 'true' || v === '1' || v === 'yes';
}

/** Select a base URL from a map keyed by environment name (e.g. `default`, `staging`, `prod`). Reads the `ENV` variable to pick the appropriate key. */
export function selectBaseURL(map: Record<string, string>): string {
    const target = env('ENV', 'default') || 'default';
    return map[target] || map.default || '';
}
