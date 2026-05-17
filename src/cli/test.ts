#!/usr/bin/env node
/**
 * `k6-lib test <workspace> [type]` — one-shot: gen + build + run.
 *
 * Workspace mode: runs the full pipeline in one command, no separate package.json scripts needed.
 *
 * Usage:
 *   k6-lib test workspaces/order-svc                # gen + build + run ALL tests
 *   k6-lib test workspaces/order-svc smoke          # only the smoke folder
 *   k6-lib test workspaces/order-svc load           # only the load folder
 *   k6-lib test workspaces/order-svc smoke/post     # a single file
 *   k6-lib test workspaces/order-svc smoke --env staging
 *   k6-lib test workspaces/order-svc smoke --skip-gen   # skip codegen
 *
 * Conventions:
 *   - OpenAPI spec: workspaces/<name>/openapi.{yaml,yml,json}
 *   - Generated: workspaces/<name>/generated/api.ts
 *   - Output bundle: workspaces/<name>/dist/
 *   - Reports: workspaces/<name>/reports/
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const rawArgv = process.argv.slice(2);
const { positionals, passthrough } = parseArgs(rawArgv);

const workspace = positionals[0];
const testTarget = positionals[1];

if (!workspace) {
    console.log(`
k6-lib test — gen + build + run in one command

Usage:
  k6-lib test <workspace> [type-or-file] [flags]

Examples:
  k6-lib test workspaces/order-svc
  k6-lib test workspaces/order-svc smoke
  k6-lib test workspaces/order-svc smoke/post --env staging
  k6-lib test workspaces/order-svc --skip-gen --vus 100

Flags pass through to 'k6-lib run' (--vus, --duration, --type, --env).
Add --skip-gen to bypass OpenAPI codegen.
Add --skip-build to bypass webpack bundling.
`);
    process.exit(1);
}

const wsDir = path.resolve(workspace);
if (!fs.existsSync(wsDir)) {
    console.error(`Workspace not found: ${wsDir}`);
    process.exit(1);
}

const skipGen = passthrough.includes('--skip-gen');
const skipBuild = passthrough.includes('--skip-build');
const runFlags = passthrough.filter((f) => f !== '--skip-gen' && f !== '--skip-build');

const cliDir = __dirname;

// 1) Codegen
if (!skipGen) {
    const spec = findSpec(wsDir);
    if (spec) {
        console.log(`\n━━━ [1/3] Codegen từ ${path.relative(process.cwd(), spec)} ━━━`);
        const r = runNode(path.join(cliDir, 'gen.js'), [workspace]);
        if (r.status !== 0) process.exit(r.status || 1);
    } else {
        console.log('\n━━━ [1/3] Codegen: skip (no openapi spec found) ━━━');
    }
} else {
    console.log('\n━━━ [1/3] Codegen: skip (--skip-gen) ━━━');
}

// 2) Build
if (!skipBuild) {
    console.log(`\n━━━ [2/3] Build ${workspace} ━━━`);
    const r = runNode(path.join(cliDir, 'build.js'), [workspace]);
    if (r.status !== 0) process.exit(r.status || 1);
} else {
    console.log('\n━━━ [2/3] Build: skip (--skip-build) ━━━');
}

// 3) Run
const runTarget = testTarget
    ? path.join(wsDir, 'dist', testTarget)
    : path.join(wsDir, 'dist');

if (!fs.existsSync(runTarget) && !fs.existsSync(runTarget + '.test.js')) {
    console.error(`Bundle not found: ${runTarget}`);
    console.error('Tip: the build may have failed, or the test type you passed does not exist.');
    process.exit(1);
}

console.log(`\n━━━ [3/3] Run ${path.relative(process.cwd(), runTarget)} ━━━`);
const runArgs = [runTarget, ...runFlags];
const r = runNode(path.join(cliDir, 'run.js'), runArgs);
process.exit(r.status || 0);

function findSpec(dir: string): string | null {
    for (const f of ['openapi.yaml', 'openapi.yml', 'openapi.json', 'swagger.yaml', 'swagger.json']) {
        const p = path.join(dir, f);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function runNode(script: string, args: string[]): { status: number | null } {
    const r = spawnSync(process.execPath, [script, ...args], { stdio: 'inherit' });
    return { status: r.status };
}

function parseArgs(argv: string[]): { positionals: string[]; passthrough: string[] } {
    const positionals: string[] = [];
    const passthrough: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            passthrough.push(a);
            // If next arg is not a flag, it's this flag's value — carry it through
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                passthrough.push(next);
                i++;
            }
        } else {
            positionals.push(a);
        }
    }
    return { positionals, passthrough };
}
