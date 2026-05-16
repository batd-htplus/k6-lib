import { Response } from 'k6/http';
import { check } from 'k6';
import { RestClient } from '../client/rest-client';
import { WsClient, WsClientConfig } from '../client/ws-client';
import { AuthRegistry } from '../auth/registry';
import { IAuthProvider, PoolConfig, TestUser, Token } from '../auth/types';
import { TokenPool, buildPoolEntries } from '../auth/token-pool';
import { IDataSet, SharedDataSet } from '../data/data-set';
import { extractByPath } from '../auth/utils';
import { CommonThresholdPresets, ThresholdPresetName, Thresholds } from './thresholds';
import { selectBaseURL, env as envFn } from './env';

/** A single VU configuration for a test type (e.g. smoke, load, …). */
export interface VUConfig {
    vus: number;
    duration: string;
}

/** Project-level configuration passed to `defineProject`. */
export interface ProjectConfig {
    name: string;
    baseURL: string | Record<string, string>;

    /** A single auth provider, or multiple named providers (e.g. `{user, admin, internal}`). */
    auth?: IAuthProvider | Record<string, IAuthProvider>;

    /** Pool of virtual users for pre-login. Can be omitted if the auth provider does not require users. */
    testUsers?: IDataSet<TestUser> | TestUser[];

    /** Semantic test data (posts, queries, etc.). */
    testData?: Record<string, IDataSet<unknown>>;

    /** WebSocket client configuration (baseURL is resolved automatically). */
    websocket?: Omit<WsClientConfig, 'baseURL'>;

    /** VU configuration per test type (smoke, load, stress, …). Falls back to ScenarioBuilder presets when omitted. */
    vu?: Partial<Record<string, VUConfig>>;

    /** Default tags attached to every request. */
    tags?: Record<string, string>;

    /** Threshold preset name or custom Thresholds object for the test. */
    thresholds?: ThresholdPresetName | Thresholds;

    /** Default HTTP timeout duration string (e.g. `30s`). */
    defaultTimeout?: string;
    /** Default headers attached to every request. */
    defaultHeaders?: Record<string, string>;
}

/** Per-call options passed to HTTP request methods. */
export interface CallOptions {
    /** Named auth provider to use, or `false` to disable authentication. */
    auth?: string | false;
    /** Bearer token to use instead of resolving from the auth registry. */
    token?: string;
    /** Additional headers to merge into the request. */
    headers?: Record<string, string>;
    /** Additional tags to merge into the request. */
    tags?: Record<string, string>;
    /** Query parameters to append to the URL. */
    params?: Record<string, string | number | boolean | undefined>;
    /** Request timeout duration string (e.g. `10s`). */
    timeout?: string;
    /** Number of retries on failure. */
    retries?: number;
}

/** Complete toolkit returned by `defineProject` — the primary API surface for test files. */
export interface ProjectToolkit {
    config: ProjectConfig;
    http: RestClient;
    ws: WsClient;
    auth: AuthRegistry;
    data: Record<string, IDataSet<unknown>>;
    users?: IDataSet<TestUser>;
    /** Pre-resolved thresholds ready to use in the test file. */
    thresholds: Thresholds;
    /** VU configuration per test type. Falls back to default presets when not set in project config. */
    vu: Record<string, VUConfig>;
    /** Check response status and optional additional checks (duration, custom predicates). */
    check: (res: Response, expected: number | number[] | CheckSpec) => boolean;
    /** Extract a value from the response body using a dot-separated JSON path. */
    extract: <T = unknown>(res: Response, path: string) => T | undefined;
    /** Setup function to be called inside the k6 `export function setup()`. */
    setup: () => SetupData;
    /** Read an environment variable (k6 `__ENV` first, then `process.env`). */
    env: (key: string, def?: string) => string;
}

/** Specification for custom response checks beyond status code validation. */
export interface CheckSpec {
    /** Expected HTTP status code or array of acceptable codes. */
    status?: number | number[];
    /** Maximum acceptable response duration in milliseconds. */
    maxDurationMs?: number;
    /** Custom check functions keyed by name: `{name: (res) => boolean}`. */
    checks?: Record<string, (res: Response) => boolean>;
}

/** Data returned by the setup phase, containing pre-acquired token pools for each named auth provider. */
export interface SetupData {
    pools: Record<string, { tokens: Array<{ user?: TestUser; token: Token }> }>;
}

/**
 * Main factory — assembles a `ProjectToolkit` from the provided project configuration.
 * Test files typically call this once and use the returned toolkit for all HTTP, WebSocket,
 * auth, and data operations.
 */
export function defineProject(config: ProjectConfig): ProjectToolkit {
    const resolvedBaseURL = typeof config.baseURL === 'string'
        ? config.baseURL
        : selectBaseURL(config.baseURL);

    const http = new RestClient({
        baseURL: resolvedBaseURL,
        defaultHeaders: config.defaultHeaders,
        defaultTimeout: config.defaultTimeout || '30s',
        defaultTags: { service: config.name, env: envFn('ENV', 'default') || 'default', ...(config.tags || {}) },
    });

    const ws = new WsClient({
        baseURL: resolvedBaseURL,
        ...(config.websocket || {}),
        defaultTags: { service: config.name, ...(config.tags || {}) },
    });

    // Build auth registry
    const registry = new AuthRegistry(http);
    const authMap: Record<string, IAuthProvider> = {};
    if (config.auth) {
        if (isProvider(config.auth)) {
            authMap.default = config.auth;
        } else {
            Object.assign(authMap, config.auth);
        }
    }

    // Build users dataset
    let users: IDataSet<TestUser> | undefined;
    if (config.testUsers) {
        if (Array.isArray(config.testUsers)) {
            users = new SharedDataSet<TestUser>('users:inline', () => config.testUsers as TestUser[]);
        } else {
            users = config.testUsers;
        }
    }

    // Register each provider; build token pool when configured
    Object.keys(authMap).forEach((name) => {
        const provider = authMap[name];
        const pool = readPoolConfig(provider);
        if (pool && users) {
            const tokenPool = new TokenPool(name, pool, () => {
                const allUsers = (users as IDataSet<TestUser>).all().slice() as TestUser[];
                return buildPoolEntries(provider, http, allUsers, pool.size);
            });
            registry.register(name, provider, tokenPool);
        } else {
            registry.register(name, provider);
        }
    });

    // Wire auth applier into the HTTP RestClient
    http.setAuthApplier({
        apply: (headers, params, authName) => {
            const ok = registry.apply({ headers, query: params }, authName);
            if (!ok && authName !== 'default') {
                console.warn(`[k6-lib] auth provider '${authName}' does not exist`);
            }
        },
    });
    // Wire auth token resolver into the WebSocket client
    ws.setAuthApplier({
        getToken: (authName) => {
            const tok = registry.getToken(authName);
            return tok ? tok.value : null;
        },
    });

    // Resolve thresholds
    const thresholds = typeof config.thresholds === 'string'
        ? CommonThresholdPresets[config.thresholds]
        : (config.thresholds || CommonThresholdPresets.api);

    // Resolve VU config — merge project overrides with defaults
    const vuDefaults: Record<string, VUConfig> = {
        smoke: { vus: 5, duration: '1m' },
        load: { vus: 80, duration: '10m' },
        stress: { vus: 200, duration: '15m' },
        spike: { vus: 500, duration: '10m' },
        soak: { vus: 50, duration: '2h' },
        performance: { vus: 50, duration: '5m' },
    };
    const vu: Record<string, VUConfig> = { ...vuDefaults };
    if (config.vu) {
        Object.keys(config.vu).forEach((k) => {
            const v = config.vu![k];
            if (v) vu[k] = v;
        });
    }

    const toolkit: ProjectToolkit = {
        config,
        http,
        ws,
        auth: registry,
        data: config.testData || {},
        users,
        thresholds,
        vu,
        check: (res, expected) => runCheck(res, expected),
        extract: <T = unknown>(res: Response, path: string) => extractFromResponse<T>(res, path),
        setup: () => runSetup(registry, authMap, users),
        env: envFn,
    };
    return toolkit;
}

/** Type guard that checks whether an unknown value implements the `IAuthProvider` interface. */
function isProvider(obj: unknown): obj is IAuthProvider {
    return !!obj && typeof obj === 'object' && typeof (obj as IAuthProvider).acquireToken === 'function';
}

/** Extract the `PoolConfig` from a provider if it has one configured with a positive pool size. */
function readPoolConfig(provider: IAuthProvider): PoolConfig | undefined {
    const p = (provider as unknown as { pool?: PoolConfig }).pool;
    return p && p.size > 0 ? p : undefined;
}

/** Run k6 `check()` against a response with a status number, status array, or full `CheckSpec`. */
function runCheck(res: Response, expected: number | number[] | CheckSpec): boolean {
    if (typeof expected === 'number') {
        return check(res, { [`status is ${expected}`]: (r) => r.status === expected });
    }
    if (Array.isArray(expected)) {
        return check(res, { [`status in [${expected.join(',')}]`]: (r) => expected.indexOf(r.status) !== -1 });
    }
    const checks: Record<string, (r: Response) => boolean> = {};
    if (expected.status !== undefined) {
        const s = expected.status;
        if (Array.isArray(s)) {
            checks[`status in [${s.join(',')}]`] = (r) => s.indexOf(r.status) !== -1;
        } else {
            checks[`status is ${s}`] = (r) => r.status === s;
        }
    }
    if (expected.maxDurationMs !== undefined) {
        const max = expected.maxDurationMs;
        checks[`duration < ${max}ms`] = (r) => (r.timings?.duration || 0) < max;
    }
    if (expected.checks) {
        Object.assign(checks, expected.checks);
    }
    return check(res, checks);
}

/** Extract a value from a k6 HTTP response body using a dot-separated JSON path. */
function extractFromResponse<T = unknown>(res: Response, path: string): T | undefined {
    try {
        const data = typeof res.json === 'function' ? res.json() : null;
        if (!data) return undefined;
        return extractByPath<T>(data, path);
    } catch {
        return undefined;
    }
}

/** Build the `SetupData` object by iterating auth providers and triggering token acquisition for pooled providers. */
function runSetup(
    registry: AuthRegistry,
    authMap: Record<string, IAuthProvider>,
    users?: IDataSet<TestUser>
): SetupData {
    const data: SetupData = { pools: {} };
    Object.keys(authMap).forEach((name) => {
        const provider = authMap[name];
        const pool = readPoolConfig(provider);
        if (!pool) return;
        // Trigger SharedArray load (lazy — executes now during setup(), HTTP is allowed here)
        registry.getToken(name);
        // Populate setup data with real tokens from the pool
        data.pools[name] = { tokens: registry.getAllTokens(name) };
    });
    return data;
}
