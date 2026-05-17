#!/usr/bin/env node
/**
 * `k6-lib build [project-folder]` — bundle scenarios for a project → <project>/dist/.
 *
 * The project does NOT need webpack.config.js or its own package.json.
 * The CLI builds a webpack config in RAM and auto-discovers all `*.test.ts` files.
 *
 * Usage:
 *   k6-lib build                                # build CWD
 *   k6-lib build workspaces/project_example     # build 1 workspace
 *   k6-lib build --src ./tests --out ./out      # override paths
 *   k6-lib build workspaces/foo --watch         # rebuild when files change
 *
 * Discovery rules:
 *   - Recursively scan from <project-folder>
 *   - Pick every `*.test.ts` file
 *   - Skip: node_modules, dist, reports, generated, data
 *   - Output mirrors the original folder structure → <project>/dist/
 */
import * as fs from 'fs';
import * as path from 'path';

interface WebpackStats { hasErrors(): boolean; toString(opts: unknown): string }

const SKIP_DIRS = new Set(['node_modules', 'dist', 'reports', 'results', 'generated', 'data']);
const SKIP_DATA_DIRS = new Set(['node_modules', 'dist', 'reports', 'results', 'generated']);

/** Parse argv → { positional, opts }. */
function parseArgs(argv: string[]): { positional: string; opts: Record<string, string> } {
    const opts: Record<string, string> = {};
    let positional = '';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--') || a.startsWith('-')) {
            const key = a.replace(/^-+/, '');
            const val = i + 1 < argv.length && !argv[i + 1].startsWith('-') ? argv[++i] : 'true';
            opts[key] = val;
        } else if (!positional) {
            positional = a;
        }
    }
    return { positional, opts };
}

function discoverEntries(dir: string): Record<string, string> {
    const entries: Record<string, string> = {};
    walk(dir, dir, entries);
    return entries;
}

function walk(root: string, current: string, entries: Record<string, string>): void {
    let names: string[];
    try { names = fs.readdirSync(current); } catch { return; }
    names.forEach((name) => {
        if (name.startsWith('.') || SKIP_DIRS.has(name)) return;
        const full = path.join(current, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            walk(root, full, entries);
        } else if (name.endsWith('.test.ts')) {
            const rel = path.relative(root, full).replace(/\.ts$/, '').replace(/\\/g, '/');
            entries[rel] = full;
        }
    });
}

function buildWebpackConfig(
    entries: Record<string, string>,
    outDir: string,
    srcDir: string,
    projectRoot: string,
): Record<string, unknown> {
    const libRoot = path.resolve(__dirname, '..', '..');
    const libDistIndex = path.join(libRoot, 'dist', 'index.js');
    const libSrcIndex = path.join(libRoot, 'src', 'index.ts');
    const libEntry = fs.existsSync(libDistIndex) ? libDistIndex : libSrcIndex;
    const libReporter = fs.existsSync(libDistIndex)
        ? path.join(libRoot, 'dist', 'reporter', 'index.js')
        : path.join(libRoot, 'src', 'reporter', 'index.ts');

    return {
        mode: 'development',
        entry: entries,
        target: 'node',
        output: {
            path: outDir,
            filename: '[name].js',
            libraryTarget: 'commonjs',
            globalObject: 'this',
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', { targets: { node: 'current' } }],
                                '@babel/preset-typescript',
                            ],
                        },
                    },
                },
                { test: /\.json$/, type: 'json' },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
            modules: [
                path.join(projectRoot, 'node_modules'),
                path.join(libRoot, 'node_modules'),
                'node_modules',
            ],
            alias: {
                '@htplus/k6-lib$': libEntry,
                '@htplus/k6-lib/reporter$': libReporter,
                '@helper': path.join(libRoot, 'src/helper'),
                '@reporter': path.join(libRoot, 'src/reporter/index.ts'),
                '@project': projectRoot,
                '@generated': path.join(projectRoot, 'generated'),
                '@data': path.join(projectRoot, 'data'),
            },
            fallback: { fs: false, path: false, os: false, util: false, stream: false, buffer: false, process: false },
        },
        externals: [/^k6(\/.*)?/, 'fs', 'path', 'os', 'crypto', 'stream', 'buffer', 'util'],
    };
}

const DATA_EXTS = new Set(['.csv', '.json', '.jsonl', '.yaml', '.yml']);

/** Collect all data files from project root recursively (skips unwanted dirs). */
function collectProjectDataFiles(projectRoot: string): string[] {
    const files: string[] = [];
    const walk = (dir: string) => {
        let names: string[];
        try { names = fs.readdirSync(dir); } catch { return; }
        names.forEach((name) => {
            if (name.startsWith('.') || SKIP_DATA_DIRS.has(name)) return;
            const full = path.join(dir, name);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
                walk(full);
            } else if (DATA_EXTS.has(path.extname(name))) {
                files.push(full);
            }
        });
    };
    walk(projectRoot);
    return files;
}

/** Copy data files next to each bundled test file so k6 open() resolves them. */
function copyDataFiles(srcDir: string, outDir: string, entries: Record<string, string>): void {
    const dataFiles = collectProjectDataFiles(srcDir);
    if (dataFiles.length === 0) return;

    const seen = new Set<string>();
    Object.values(entries).forEach((entryFile) => {
        const relDir = path.relative(srcDir, path.dirname(entryFile));
        const destSubDir = path.join(outDir, relDir);
        dataFiles.forEach((srcPath) => {
            const relPath = path.relative(srcDir, srcPath);
            const destPath = path.join(destSubDir, relPath);
            if (seen.has(destPath)) return;
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(srcPath, destPath);
            seen.add(destPath);
        });
    });
}

function printResult(err: Error | null, stats: WebpackStats): void {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log(stats.toString({ colors: true, modules: false, chunks: false, assets: false, errors: true, warnings: true }));
}

// ─── Main ────────────────────────────────────────────────────────────────────
const { positional, opts } = parseArgs(process.argv.slice(2));

const projectRoot = path.resolve(positional || opts.src || '.');
const srcDir = path.resolve(opts.src || projectRoot);
const outDir = path.resolve(opts.out || path.join(projectRoot, 'dist'));
const watch = opts.watch === 'true' || opts.w === 'true';

if (!fs.existsSync(srcDir)) {
    console.error(`Project folder not found: ${srcDir}`);
    process.exit(1);
}

const entries = discoverEntries(srcDir);
if (Object.keys(entries).length === 0) {
    console.error(`Không tìm thấy *.test.ts nào trong ${srcDir}`);
    console.error('Tip: file test phải đặt tên kết thúc bằng .test.ts (vd: smoke/post.test.ts)');
    process.exit(1);
}

console.log(`Project: ${path.relative(process.cwd(), projectRoot) || '.'}`);
console.log(`Bundling ${Object.keys(entries).length} test file(s) → ${path.relative(process.cwd(), outDir)}/`);

const config = buildWebpackConfig(entries, outDir, srcDir, projectRoot);

const webpack = require('webpack');

if (watch) {
    webpack(config).watch({ aggregateTimeout: 300 }, (err: Error | null, stats: WebpackStats) => {
        printResult(err, stats);
    });
} else {
    webpack(config, (err: Error | null, stats: WebpackStats) => {
        printResult(err, stats);
        if (err || stats.hasErrors()) process.exit(1);
        copyDataFiles(srcDir, outDir, entries);
        console.log(`✓ Built to ${path.relative(process.cwd(), outDir)}`);
    });
}
