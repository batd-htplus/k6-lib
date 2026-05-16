import { RestClient } from '../client/rest-client';
import { ApplyContext, IAuthProvider, PoolConfig, TestUser, Token } from './types';
import { extractByPath } from './utils';

/** Options for configuring username/password-based authentication with optional refresh token support. */
export interface PasswordAuthOptions {
    /** The login endpoint path (e.g., '/auth/login'). */
    loginPath: string;
    /** Function to build the login request body from a test user. */
    body: (user: TestUser) => Record<string, unknown>;
    /** Dot-separated path to extract the access token from the login response. */
    extractToken: string;
    /** Optional dot-separated path to extract the refresh token from the login response. */
    extractRefreshToken?: string;
    /** Optional refresh endpoint path. Enables automatic token refresh. */
    refreshPath?: string;
    /** Optional function to build the refresh request body from the refresh token. */
    refreshBody?: (refreshToken: string) => Record<string, unknown>;
    /** Custom header name for the token. Defaults to 'Authorization'. */
    headerName?: string;
    /** Custom header format. Defaults to 'Bearer {token}'. */
    headerFormat?: string;
    /** Token pool configuration for pre-login in performance tests. */
    pool?: PoolConfig;
    /** Fallback TTL in seconds when the server does not return expires_in. Defaults to 3600. */
    defaultTtlSeconds?: number;
    /**
     * Handler for 401 responses.
     * - `'reacquire'`: automatically re-login to get a new token.
     * - Callback: `(client, user?) => Token | null`.
     */
    onUnauthorized?: 'reacquire' | ((client: RestClient, user?: TestUser) => Token | null);
}

/** Auth provider that authenticates with username/password and manages token lifecycle. */
export class PasswordAuthProvider implements IAuthProvider {
    readonly name = 'password';
    private unauthHandler?: (client: RestClient, user?: TestUser) => Token | null;

    constructor(private opts: PasswordAuthOptions) {
        if (opts.onUnauthorized === 'reacquire') {
            this.unauthHandler = (client, user) => this.acquireToken(client, user);
        } else if (typeof opts.onUnauthorized === 'function') {
            this.unauthHandler = opts.onUnauthorized;
        }
    }

    /** Returns the token pool configuration, if any. */
    get pool(): PoolConfig | undefined {
        return this.opts.pool;
    }

    /** Handles 401 responses by delegating to the configured handler (reacquire or custom callback). */
    onUnauthorized(client: RestClient, user?: TestUser): Token | null {
        return this.unauthHandler ? this.unauthHandler(client, user) : null;
    }

    /** Authenticates with user credentials and returns a token with optional refresh token and expiry. */
    acquireToken(client: RestClient, user?: TestUser): Token | null {
        if (!user) return null;
        const body = this.opts.body(user);
        const res = client.post(this.opts.loginPath, body, { auth: false });
        if (!client.isSuccess(res)) {
            console.error(`[passwordAuth] Login failed ${res.status} for user ${user.email || user.username}`);
            return null;
        }
        let data: unknown;
        try {
            data = res.json();
        } catch {
            return null;
        }
        const accessToken = extractByPath<string>(data, this.opts.extractToken);
        if (!accessToken) {
            console.error('[passwordAuth] Cannot extract token at path:', this.opts.extractToken);
            return null;
        }
        const refreshToken = this.opts.extractRefreshToken
            ? extractByPath<string>(data, this.opts.extractRefreshToken)
            : undefined;
        const expiresIn = extractByPath<number>(data, 'expires_in') ?? extractByPath<number>(data, 'expiresIn');
        const ttlSec = expiresIn || this.opts.defaultTtlSeconds || 3600;
        return {
            value: accessToken,
            refreshToken: refreshToken || undefined,
            issuedAt: Date.now(),
            expiresAt: Date.now() + ttlSec * 1000,
        };
    }

    /** Applies the token to the request using the configured header name and format. */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        const headerName = this.opts.headerName || 'Authorization';
        const format = this.opts.headerFormat || 'Bearer {token}';
        ctx.headers[headerName] = format.replace('{token}', token.value);
    }

    /** Refreshes the token using the refresh endpoint, if configured. */
    refresh(client: RestClient, token: Token): Token | null {
        if (!this.opts.refreshPath || !token.refreshToken) return null;
        const body = this.opts.refreshBody
            ? this.opts.refreshBody(token.refreshToken)
            : { refresh_token: token.refreshToken };
        const res = client.post(this.opts.refreshPath, body, { auth: false });
        if (!client.isSuccess(res)) return null;
        let data: unknown;
        try {
            data = res.json();
        } catch {
            return null;
        }
        const newAccess = extractByPath<string>(data, this.opts.extractToken);
        if (!newAccess) return null;
        const newRefresh = this.opts.extractRefreshToken
            ? extractByPath<string>(data, this.opts.extractRefreshToken)
            : token.refreshToken;
        const expiresIn = extractByPath<number>(data, 'expires_in') ?? extractByPath<number>(data, 'expiresIn');
        const ttlSec = expiresIn || this.opts.defaultTtlSeconds || 3600;
        return {
            value: newAccess,
            refreshToken: newRefresh,
            issuedAt: Date.now(),
            expiresAt: Date.now() + ttlSec * 1000,
        };
    }

    /** Returns true if the token is expired (with a 30-second buffer before actual expiry). */
    isExpired(token: Token): boolean {
        if (!token.expiresAt) return false;
        return Date.now() >= token.expiresAt - 30_000;
    }
}

/** Creates a PasswordAuthProvider instance. */
export function passwordAuth(opts: PasswordAuthOptions): PasswordAuthProvider {
    return new PasswordAuthProvider(opts);
}
