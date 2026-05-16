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
    /** Tên project — dùng làm tag `service` cho mọi request. */
    name: 'project_example',

    /**
     * Base URL — có thể là string hoặc object nhiều môi trường.
     * `selectBaseURL()` tự động chọn theo env `ENV`.
     */
    baseURL: {
        default: env('BASE_URL', 'http://localhost:3000'),
        staging: 'https://staging.example.com',
        production: 'https://api.example.com',
    },

    /**
     * Auth providers — mỗi provider một tên, test file gọi `{ auth: 'user' }`.
     * Có thể xài nhiều provider cùng lúc.
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
     * Test users — dùng cho pool auth (pre-login).
     * Mỗi user được auth provider gọi `body(u)` để login lấy token.
     */
    testUsers: csvUsers('./test-users.csv'),

    /**
     * Test data — load sẵn, test file dùng `project.data.posts`.
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
     * VU config per test type — mỗi project custom theo sức chứa API.
     * Test file xài: `const { vus, duration } = project.vu.smoke;`
     * Không set → dùng mặc định (smoke=5·1m, load=80·10m, stress=200·15m, …).
     */
    vu: {
        smoke: { vus: 5, duration: '1m' },
        load: { vus: 80, duration: '10m' },
        stress: { vus: 200, duration: '15m' },
        spike: { vus: 500, duration: '10m' },
        soak: { vus: 50, duration: '2h' },
        performance: { vus: 50, duration: '5m' },
    },

    /** Tag mặc định gắn vào mọi request. */
    tags: {
        service: 'example',
        team: 'platform',
        project: env('PROJECT', 'dev'),
    },

    /** Header mặc định gắn vào mọi request. */
    defaultHeaders: {
        'X-Client-Version': '1.0',
    },

    /** Threshold preset — 'api', 'strict', 'relaxed', 'auth', 'ws' hoặc custom object. */
    thresholds: 'api',

    /** HTTP timeout mặc định. */
    defaultTimeout: '30s',

    /** Discard response body sau khi parse JSON (giảm RAM khi chạy stress). */
    discardResponseBodies: false,
});
