import {
    defineProject,
    passwordAuth,
    oauth2ClientCredentials,
    apiKeyAuth,
    basicAuth,
    bearerStaticAuth,
    csvUsers,
    jsonData,
    jsonlData,
    inlineData,
    env,
} from '@htplus/k6-lib';

export default defineProject({
    /** Project name — used as the `service` tag on every request. */
    name: 'project_example',

    /**
     * Base URL — can be a string or a multi-environment object.
     * `selectBaseURL()` automatically picks based on env `ENV`.
     */
    baseURL: {
        default: env('BASE_URL', 'http://localhost:3000'),
        staging: 'https://staging.example.com',
        production: 'https://api.example.com',
    },

    /**
     * Auth providers — each provider has a name; test files use `{ auth: 'user' }`.
     * Multiple providers can be used simultaneously.
     */
    auth: {
        // ── Password login ──────────────────────────────────
        user: passwordAuth({
            loginPath: '/auth/login',
            body: (u) => ({ email: u.email, password: u.password }),
            extractToken: 'data.token',
            refreshPath: '/auth/refresh',
            pool: { size: 10, rotation: 'round-robin' },
            onUnauthorized: 'reacquire',
        }),

        // ── OAuth2 client credentials ────────────────────────
        // internal: oauth2ClientCredentials({
        //     tokenUrl: '/oauth/token',
        //     clientId: env('CLIENT_ID'),
        //     clientSecret: env('CLIENT_SECRET'),
        //     scopes: ['read', 'write'],
        //     pool: { size: 3, rotation: 'round-robin' },
        // }),

        // ── API Key ──────────────────────────────────────────
        // admin: apiKeyAuth({
        //     key: env('API_KEY'),
        //     in: 'header',       // 'header' | 'query'
        //     name: 'X-API-Key',
        // }),

        // ── Basic Auth ───────────────────────────────────────
        // legacy: basicAuth({
        //     username: env('BASIC_USER'),
        //     password: env('BASIC_PASS'),
        // }),

        // ── Bearer Static ────────────────────────────────────
        // readonly: bearerStaticAuth({
        //     token: env('READONLY_TOKEN'),
        // }),
    },

    /**
     * Test users — used for the auth token pool (pre-login).
     * Each user is passed through `body(u)` to acquire a token.
     */
    testUsers: csvUsers('./test-users.csv'),

    /**
     * Test data — pre-loaded; test files access via `project.data.posts`.
     */
    testData: {
        posts: jsonData('./data/posts.json'),
        // comments: jsonlData('./data/comments.jsonl'),
        // config: inlineData([{ key: 'timeout', value: 5000 }]),
    },

    /**
     * WebSocket config (optional).
     */
    websocket: {
        path: '/ws',
        authMode: 'query',
        queryName: 'token',
    },

    /**
     * VU config per test type — each project customizes based on API capacity.
     * Test files use: `const { vus, duration } = project.vu.smoke;`
     * Falls back to defaults when unset (smoke=5·1m, load=80·10m, stress=200·15m, …).
     */
    vu: {
        smoke: { vus: 5, duration: '1m' },
        load: { vus: 80, duration: '10m' },
        stress: { vus: 200, duration: '15m' },
        spike: { vus: 500, duration: '10m' },
        soak: { vus: 50, duration: '2h' },
        performance: { vus: 50, duration: '5m' },
    },

    /** Default tags attached to every request. */
    tags: {
        service: 'example',
        team: 'platform',
        project: env('PROJECT', 'dev'),
    },

    /** Default headers attached to every request. */
    defaultHeaders: {
        'X-Client-Version': '1.0',
    },

    /** Threshold preset — 'api', 'strict', 'relaxed', 'auth', 'ws', or a custom object. */
    thresholds: 'api',

    /** Default HTTP timeout. */
    defaultTimeout: '30s',
});
