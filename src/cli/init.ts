#!/usr/bin/env node
/**
 * CLI entry point for scaffolding a new k6 test project.
 *
 * Creates a project directory with a predefined folder structure,
 * configuration files, example data, and a sample test scenario.
 * This runs via Node.js, not inside the k6 runtime.
 */
import * as fs from 'fs';
import * as path from 'path';

const argv = process.argv.slice(2);
const projectName = argv[0];

if (!projectName) {
    console.error('Usage: k6-lib init <project-name>');
    process.exit(1);
}

const root = path.resolve(process.cwd(), projectName);
if (fs.existsSync(root)) {
    console.error(`Folder already exists: ${root}`);
    process.exit(1);
}

fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.mkdirSync(path.join(root, 'scenarios/smoke'), { recursive: true });
fs.mkdirSync(path.join(root, 'scenarios/load'), { recursive: true });
fs.mkdirSync(path.join(root, 'scenarios/stress'), { recursive: true });
fs.mkdirSync(path.join(root, 'scenarios/spike'), { recursive: true });
fs.mkdirSync(path.join(root, 'scenarios/soak'), { recursive: true });
fs.mkdirSync(path.join(root, 'scenarios/ws'), { recursive: true });
fs.mkdirSync(path.join(root, 'src/generated'), { recursive: true });

write(path.join(root, 'package.json'), JSON.stringify({
    name: projectName,
    version: '0.1.0',
    private: true,
    scripts: {
        build: 'webpack',
        gen: 'k6-lib gen',
        test: 'k6-lib run',
    },
    devDependencies: {
        '@htplus/k6-lib': '^0.1.0',
        '@types/k6': '^1.1.1',
        '@types/node': '^24.0.0',
        typescript: '^5.0.0',
        webpack: '^5.99.0',
        'webpack-cli': '^5.1.4',
    },
}, null, 2));

write(path.join(root, '.env.example'), `BASE_URL=http://localhost:3000
ENV=default
TEST_EMAIL=user@example.com
TEST_PASSWORD=password123
`);

write(path.join(root, 'test-users.example.csv'), `email,password,username,role
user1@example.com,password123,user1,member
user2@example.com,password123,user2,member
admin@example.com,admin123,admin,admin
`);

write(path.join(root, 'project.config.ts'), `import { defineProject, passwordAuth, csvUsers, jsonData, env } from '@htplus/k6-lib';
// import { createApi } from './src/generated/api';  // uncomment after running 'npm run gen'

const project = defineProject({
    name: '${projectName}',
    baseURL: {
        default: env('BASE_URL', 'http://localhost:3000'),
        staging: 'https://staging.api.example.com',
        prod:    'https://api.example.com',
    },
    auth: {
        user: passwordAuth({
            loginPath: '/auth/login',
            body: (u) => ({ email: u.email, password: u.password }),
            extractToken: 'data.token',
            extractRefreshToken: 'data.refresh_token',
            refreshPath: '/auth/refresh',
            pool: { size: 50, rotation: 'round-robin' },
        }),
    },
    testUsers: csvUsers('./test-users.csv'),
    testData: {
        // posts: jsonData('./data/posts.json'),
    },
    thresholds: 'api',
    tags: { service: '${projectName}' },
});

// export const api = createApi(project.http);
export default project;
`);

write(path.join(root, 'openapi.yaml'), `openapi: 3.0.0
info:
  title: ${projectName}
  version: 1.0.0
paths:
  /health:
    get:
      operationId: health
      tags: [health]
      responses:
        '200':
          description: OK
`);

write(path.join(root, 'scenarios/smoke/health.test.ts'), `import project from '../../project.config';
import { ScenarioBuilder } from '@htplus/k6-lib';
export { handleSummary } from '@htplus/k6-lib/reporter';

export const options = ScenarioBuilder.smoke(5, '1m')
    .setThresholds(project.thresholds)
    .build();

export default function () {
    const res = project.http.get('/health', { auth: false });
    project.check(res, 200);
}
`);

write(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
        target: 'es2017',
        module: 'commonjs',
        strict: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        outDir: './dist',
        rootDir: '.',
    },
    include: ['scenarios/**/*', 'src/**/*', 'project.config.ts'],
}, null, 2));

write(path.join(root, '.gitignore'), `node_modules/
dist/
results/
.env
`);

console.log(`✓ Created project ${projectName} at ${root}`);
console.log('Next steps:');
console.log(`  cd ${projectName}`);
console.log('  cp .env.example .env');
console.log('  cp test-users.example.csv test-users.csv');
console.log('  npm install');
console.log('  npm run gen           # generate API client from openapi.yaml');
console.log('  npm test scenarios/smoke/health.test.ts');

/** Write content to a file, creating parent directories as needed. */
function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
}
