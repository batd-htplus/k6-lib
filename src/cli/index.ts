#!/usr/bin/env node
/**
 * CLI entry point — dispatches to init/gen/run subcommands.
 * Registered in package.json:
 *   "bin": { "k6-lib": "dist/cli/index.js" }
 */
const cmd = process.argv[2];
const rest = process.argv.slice(3);

switch (cmd) {
    case 'init':
        process.argv = [process.argv[0], process.argv[1], ...rest];
        require('./init');
        break;
    case 'gen':
        process.argv = [process.argv[0], process.argv[1], ...rest];
        require('./gen');
        break;
    case 'run':
        process.argv = [process.argv[0], process.argv[1], ...rest];
        require('./run');
        break;
    case 'build':
        process.argv = [process.argv[0], process.argv[1], ...rest];
        require('./build');
        break;
    case 'test':
        process.argv = [process.argv[0], process.argv[1], ...rest];
        require('./test');
        break;
    default:
        console.log(`k6-lib — internal performance testing library

Usage:
  k6-lib init <name>              Scaffold a new project
  k6-lib gen <workspace>          Codegen từ openapi.yaml trong workspace
  k6-lib build <workspace>        Bundle scenarios → <workspace>/dist/
  k6-lib run <file-or-folder>     Run k6 tests
  k6-lib test <workspace> [type]  One-shot: gen + build + run

Examples:
  k6-lib test workspaces/order-svc smoke
  k6-lib test workspaces/order-svc load --env staging
`);
        process.exit(cmd ? 1 : 0);
}
