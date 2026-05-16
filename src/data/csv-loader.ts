import { SharedDataSet } from './data-set';
import { TestUser } from '../auth/types';

/**
 * Parses a CSV string into an array of key-value records.
 * Handles quoted fields, escaped double quotes, and CR/LF line endings.
 */
export function parseCsv(content: string): Record<string, string>[] {
    const lines: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < content.length; i++) {
        const c = content[i];
    if (c === '"') {
        if (inQuote && content[i + 1] === '"') {
            cur += '"';
            i++;
        } else {
            inQuote = !inQuote;
        }
        } else if ((c === '\n' || c === '\r') && !inQuote) {
            if (cur.length > 0) {
                lines.push(cur);
                cur = '';
            }
            if (c === '\r' && content[i + 1] === '\n') i++;
        } else {
            cur += c;
        }
    }
    if (cur.length > 0) lines.push(cur);
    if (lines.length === 0) return [];

    const splitLine = (line: string): string[] => {
        const out: string[] = [];
        let field = '';
        let q = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
        if (c === '"') {
            if (q && line[i + 1] === '"') {
                field += '"';
                i++;
            } else {
                q = !q;
                continue;
            }
            } else if (c === ',' && !q) {
                out.push(field);
                field = '';
            } else {
                field += c;
            }
        }
        out.push(field);
        return out.map((s) => s.trim());
    };

    const headers = splitLine(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (cols.length === 1 && cols[0] === '') continue;
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = cols[idx] !== undefined ? cols[idx] : '';
        });
        rows.push(row);
    }
    return rows;
}

/**
 * Loads a CSV file and returns a SharedDataSet.
 * Optionally maps each row to a custom type via the mapper function.
 */
export function csvData<T = Record<string, string>>(path: string, mapper?: (row: Record<string, string>) => T): SharedDataSet<T> {
    return new SharedDataSet<T>(`csv:${path}`, () => {
        const openFn = (globalThis as { open?: (p: string) => string }).open;
        if (!openFn) {
            console.warn(`[csvData] k6 open() is not available for ${path}`);
            return [];
        }
        const content = openFn(path);
        const rows = parseCsv(content);
        return mapper ? rows.map(mapper) : (rows as unknown as T[]);
    });
}

/**
 * Loads a CSV file containing test user data with expected columns:
 * email, password, username, role. Extra columns are passed through.
 */
export function csvUsers(path: string): SharedDataSet<TestUser> {
    return csvData<TestUser>(path, (row) => {
        const user: TestUser = { password: row.password || '' };
        if (row.email) user.email = row.email;
        if (row.username) user.username = row.username;
        if (row.role) user.role = row.role;
        Object.keys(row).forEach((k) => {
            if (!['email', 'username', 'password', 'role'].includes(k)) {
                (user as Record<string, unknown>)[k] = row[k];
            }
        });
        return user;
    });
}
