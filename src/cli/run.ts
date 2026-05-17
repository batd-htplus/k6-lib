#!/usr/bin/env node
/**
 * CLI entry point for running k6 tests.
 *
 * Discovers test files from a file or folder path, optionally applies
 * VUs/duration overrides or built-in presets (smoke, load, stress, etc.),
 * sets the target environment, and executes each test sequentially via `k6 run`.
 *
 * Usage: k6-lib run <file-or-folder> [options]
 *
 * Options:
 *   --vus <n>         Override virtual users count
 *   --duration <s>    Override test duration (e.g. 10m, 2h)
 *   --type <name>     Override using a preset (smoke|load|stress|spike|soak|performance)
 *   --env <name>      Target environment (staging|prod), defaults to 'default'
 *
 * Examples:
 *   k6-lib run dist/scenarios/project_example/smoke/post.test.js
 *   k6-lib run dist/scenarios/project_example/load
 *   k6-lib run dist/scenarios/project_example
 *   k6-lib run dist/scenarios/project_example --type smoke
 *   k6-lib run dist/scenarios/project_example/smoke --vus 100 --duration 10m
 *   k6-lib run dist/scenarios/project_example --env staging
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync } from 'child_process';

interface RunOptions {
    vus?: string;
    duration?: string;
    type?: string;
    env?: string;
}

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--')) || '';
const opts = parseOptions(args);

if (!target) {
    console.log(`
k6-lib run — Execute k6 tests

Usage:
  k6-lib run <file-or-folder> [options]

Options:
  --vus <n>         Override virtual users count
  --duration <s>    Override test duration (e.g. 10m, 2h)
  --type <name>     Override using a preset (smoke|load|stress|spike|soak|performance)
  --env <name>      Target environment (staging|prod)

Examples:
  k6-lib run dist/scenarios/project_example/smoke/post.test.js
  k6-lib run dist/scenarios/project_example/load
  k6-lib run dist/scenarios/project_example
`);
    process.exit(1);
}

// Check k6 availability (warning only, does not block)
try {
    execSync('which k6', { stdio: 'pipe' });
} catch {
    console.warn('⚠️  k6 is not installed. Run: brew install k6');
}

// Load .env from CWD and project directory
loadEnv(path.resolve('.env'));
const projectDir = detectProjectDir(target);
if (projectDir) loadEnv(path.join(projectDir, '.env'));

// Set ENV from --env flag
if (opts.env) {
    process.env.ENV = opts.env;
}

// Collect all test files to run
const files = collectTestFiles(target);
if (!files.length) {
    console.error(`No .test.js files found in: ${target}`);
    process.exit(1);
}

const k6Args = buildK6Args(opts);
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

let passed = 0;
let failed: string[] = [];

(async () => {
    for (const f of files) {
        const rel = path.relative(process.cwd(), f);
        const cleanRel = rel.replace(/^dist\//, '').replace(/\.test\.js$/, '');
        // Derive workspace-scoped report path: workspaces/<name>/reports/<type>/<name>_<ts>/
        const parts = cleanRel.split(path.sep);
        const wsIdx = parts.indexOf('workspaces');
        const outDir = wsIdx !== -1 && wsIdx + 2 < parts.length
            ? path.join(parts.slice(0, wsIdx + 2).join(path.sep), 'reports', ...parts.slice(wsIdx + 2)) + '_' + ts
            : path.join('results', cleanRel + '_' + ts);
        fs.mkdirSync(outDir, { recursive: true });

        console.log(`\n━━━ Running ${rel} ━━━`);
        const code = await runK6(f, outDir, k6Args);
        if (code === 0) {
            console.log(`  ✅ ${path.basename(f, '.test.js')} passed`);
            passed++;
        } else {
            console.log(`  ❌ ${path.basename(f, '.test.js')} failed`);
            failed.push(rel);
        }
    }

    const total = files.length;
    console.log(`\n━━━ Summary: ${passed}/${total} passed, ${failed.length} failed ━━━`);
    process.exit(failed.length > 0 ? 1 : 0);
})();

// ─── Helper functions ───

/** Parse CLI arguments into a structured RunOptions object. */
function parseOptions(argv: string[]): RunOptions {
    const opts: RunOptions = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const key = a.slice(2);
        const val = i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
        if (key === 'vus') opts.vus = val;
        else if (key === 'duration') opts.duration = val;
        else if (key === 'type') opts.type = val;
        else if (key === 'env') opts.env = val;
    }
    return opts;
}

/** Load environment variables from a `.env` file, skipping empty lines and comments. Does not overwrite existing env vars. */
function loadEnv(filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !process.env[key]) {
            process.env[key] = val;
        }
    }
}

/** Detect the project root directory by looking for a `workspaces/<name>` segment in the target path. */
function detectProjectDir(targetPath: string): string | null {
    const abs = path.resolve(targetPath);
    const parts = abs.split(path.sep);
    const wsIdx = parts.indexOf('workspaces');
    if (wsIdx !== -1 && wsIdx + 1 < parts.length) {
        const projectDir = parts.slice(0, wsIdx + 2).join(path.sep);
        if (fs.existsSync(projectDir)) return projectDir;
    }
    return null;
}

/** Collect all `.test.js` files from a file or directory path. */
function collectTestFiles(targetPath: string): string[] {
    const files: string[] = [];
    const abs = path.resolve(targetPath);
    if (!fs.existsSync(abs)) {
        console.error(`File/folder does not exist: ${targetPath}`);
        process.exit(1);
    }
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
        walk(abs, files);
    } else {
        files.push(abs);
    }
    return files;
}

/** Recursively walk a directory and collect all `.test.js` files. */
function walk(dir: string, out: string[]): void {
    try {
        for (const name of fs.readdirSync(dir)) {
            const p = path.join(dir, name);
            const s = fs.statSync(p);
            if (s.isDirectory()) walk(p, out);
            else if (name.endsWith('.test.js')) out.push(p);
        }
    } catch { /* skip unreadable directories */ }
}

/** Build k6 CLI arguments from RunOptions, applying preset VUs/duration when a type is specified. */
function buildK6Args(opts: RunOptions): string[] {
    const args: string[] = [];

    if (opts.type) {
        const presetVUs: Record<string, string> = {
            smoke: '5', performance: '50', load: '80',
            stress: '200', spike: '500', soak: '50',
        };
        const presetDurations: Record<string, string> = {
            smoke: '1m', performance: '5m', load: '10m',
            stress: '15m', spike: '10m', soak: '2h',
        };
        const vus = opts.vus || presetVUs[opts.type] || '5';
        const duration = opts.duration || presetDurations[opts.type] || '1m';
        args.push('--vus', vus, '--duration', duration);
    } else {
        if (opts.vus) args.push('--vus', opts.vus);
        if (opts.duration) args.push('--duration', opts.duration);
    }

    return args;
}

/** Spawn a `k6 run` process for a single test file and return its exit code. */
function runK6(file: string, outDir: string, extraArgs: string[]): Promise<number> {
    return new Promise((resolve) => {
        const env: Record<string, string | undefined> = {
            ...process.env,
            K6_SUMMARY_DIR: outDir,
            K6_WEB_DASHBOARD: 'true',
            K6_WEB_DASHBOARD_EXPORT: path.join(outDir, 'dashboard-report.html'),
            K6_WEB_DASHBOARD_HOST: '127.0.0.1',
            K6_WEB_DASHBOARD_PORT: '5665',
        };

        const args = [
            'run',
            file,
            '--out', `json=${path.join(outDir, 'result.json')}`,
            '--out', `csv=${path.join(outDir, 'result.csv')}`,
            '--summary-export', path.join(outDir, 'summary.json'),
            '--summary-trend-stats', 'avg,p(95)',
            ...extraArgs,
        ];

        const child = spawn('k6', args, { stdio: 'inherit', env });
        child.on('exit', (code) => resolve(code ?? 1));
        child.on('error', (e) => {
            console.error('k6 spawn error:', e.message);
            resolve(1);
        });
    });
}
