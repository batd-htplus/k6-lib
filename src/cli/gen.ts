#!/usr/bin/env node
/**
 * CLI entry point for code generation.
 *
 * Reads an OpenAPI/Swagger spec file and generates a TypeScript API client file.
 * Supports both YAML and JSON formats using `js-yaml` and `JSON.parse`.
 *
 * Usage: k6-lib gen [--spec openapi.yaml] [--out src/generated/api.ts] [--importFrom @htplus/k6-lib]
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseSpec } from '../openapi/parser';
import { generateApiFile } from '../openapi/codegen';

const rawArgv = process.argv.slice(2);
const positional = rawArgv.find((a) => !a.startsWith('--')) || '';
const args = parseArgs(rawArgv);

// Workspace mode: `k6-lib gen workspaces/foo` → auto detect spec + out paths.
let specPath: string;
let outPath: string;
if (positional && !args.spec) {
    const ws = path.resolve(positional);
    specPath = args.spec || findSpec(ws);
    outPath = args.out || path.join(ws, 'generated', 'api.ts');
} else {
    specPath = args.spec || './openapi.yaml';
    outPath = args.out || './src/generated/api.ts';
}
const importFrom = args.importFrom || '@htplus/k6-lib';

function findSpec(workspaceDir: string): string {
    for (const f of ['openapi.yaml', 'openapi.yml', 'openapi.json', 'swagger.yaml', 'swagger.json']) {
        const p = path.join(workspaceDir, f);
        if (fs.existsSync(p)) return p;
    }
    return path.join(workspaceDir, 'openapi.yaml');
}

if (!fs.existsSync(specPath)) {
    console.error(`Spec not found: ${specPath}`);
    process.exit(1);
}

const raw = fs.readFileSync(specPath, 'utf8');
let spec: Record<string, unknown>;
try {
    if (specPath.endsWith('.yaml') || specPath.endsWith('.yml')) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yaml = require('js-yaml');
        spec = yaml.load(raw) as Record<string, unknown>;
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
