#!/usr/bin/env node
/**
 * CLI entry point for code generation.
 *
 * Reads an OpenAPI/Swagger spec file and generates a TypeScript API client file.
 * Supports both YAML and JSON formats with a built-in fallback YAML parser.
 *
 * Usage: k6-lib gen [--spec openapi.yaml] [--out src/generated/api.ts] [--importFrom @htplus/k6-lib]
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseSpec } from '../openapi/parser';
import { generateApiFile } from '../openapi/codegen';

const args = parseArgs(process.argv.slice(2));
const specPath = args.spec || './openapi.yaml';
const outPath = args.out || './src/generated/api.ts';
const importFrom = args.importFrom || '@htplus/k6-lib';

if (!fs.existsSync(specPath)) {
    console.error(`Spec not found: ${specPath}`);
    process.exit(1);
}

const raw = fs.readFileSync(specPath, 'utf8');
let spec: Record<string, unknown>;
try {
    if (specPath.endsWith('.yaml') || specPath.endsWith('.yml')) {
        spec = simpleYamlToJson(raw);
    } else {
        spec = JSON.parse(raw);
    }
} catch (e) {
    console.error(`Failed to parse spec: ${(e as Error).message}`);
    process.exit(1);
}

const parsed = parseSpec(spec);
const code = generateApiFile(parsed, { importFrom });

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, code);
console.log(`✓ Generated ${outPath} (${parsed.endpoints.length} endpoints)`);

/** Parse CLI `--key value` or `--flag` arguments into a dictionary. */
function parseArgs(arr: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < arr.length; i++) {
        const a = arr[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const val = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[++i] : 'true';
            out[key] = val;
        }
    }
    return out;
}

/**
 * Attempt to parse a YAML string into a JSON object.
 *
 * Tries `js-yaml` first if the package is available; falls back to a naive
 * built-in parser for simple specs. Projects with complex OpenAPI specs
 * should install `js-yaml` as a dependency.
 */
function simpleYamlToJson(yaml: string): Record<string, unknown> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yamlLib = require('js-yaml');
        return yamlLib.load(yaml);
    } catch {
        console.warn('[k6-lib gen] Recommendation: npm install js-yaml for full YAML support.');
        return naiveYamlParse(yaml);
    }
}

/** Minimal YAML-to-object parser for basic OpenAPI specs. */
function naiveYamlParse(yaml: string): Record<string, unknown> {
    const lines = yaml.split(/\r?\n/);
    const root: Record<string, unknown> = {};
    const stack: Array<{ obj: Record<string, unknown> | unknown[]; indent: number }> = [{ obj: root, indent: -1 }];

    for (let li = 0; li < lines.length; li++) {
        const line = lines[li].replace(/#.*$/, '');
        if (!line.trim()) continue;
        const indent = line.length - line.trimStart().length;
        const trimmed = line.trim();

        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
        const parent = stack[stack.length - 1].obj;

        if (trimmed.startsWith('- ')) {
            const val = trimmed.slice(2);
            if (Array.isArray(parent)) parent.push(parseScalar(val));
            continue;
        }
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;
        const key = trimmed.slice(0, colonIdx).trim();
        const rest = trimmed.slice(colonIdx + 1).trim();

        if (!rest) {
            // Nested object or array — peek at the next non-empty line to decide
            const next = nextContentLine(lines, li + 1);
            const child: Record<string, unknown> | unknown[] = next && next.trim().startsWith('- ') ? [] : {};
            (parent as Record<string, unknown>)[key] = child;
            stack.push({ obj: child, indent });
        } else {
            (parent as Record<string, unknown>)[key] = parseScalar(rest);
        }
    }
    return root;
}

/** Return the next non-empty, non-comment line starting at index `from`. */
function nextContentLine(lines: string[], from: number): string | null {
    for (let i = from; i < lines.length; i++) {
        const l = lines[i].replace(/#.*$/, '');
        if (l.trim()) return l;
    }
    return null;
}

/** Parse a YAML scalar string into its JavaScript type (boolean, number, null, or string). */
function parseScalar(s: string): unknown {
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
    return s;
}
