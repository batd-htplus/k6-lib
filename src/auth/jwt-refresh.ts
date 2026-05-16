import encoding from 'k6/encoding';
import { RestClient } from '../client/rest-client';
import { ApplyContext, IAuthProvider, PoolConfig, TestUser, Token } from './types';
import { extractByPath } from './utils';

/** Options for configuring JWT authentication with refresh token support. */
export interface JwtRefreshAuthOptions {
    /** The login endpoint path. */
    loginPath: string;
    /** Function to build the login request body from a test user. */
    body: (user: TestUser) => Record<string, unknown>;
    /** Dot-separated path to extract the access token from the login response. */
    extractToken: string;
    /** Dot-separated path to extract the refresh token from the login response. */
    extractRefreshToken: string;
    /** The token refresh endpoint path. */
    refreshPath: string;
    /** Optional function to build the refresh request body. Defaults to { refresh_token: <token> }. */
    refreshBody?: (refreshToken: string) => Record<string, unknown>;
    /** Optional token pool configuration for pre-login scenarios. */
    pool?: PoolConfig;
    /** Whether to parse token expiry from the JWT payload. Defaults to true. */
    parseJwtExp?: boolean;
    /** Fallback TTL in seconds when expiry cannot be parsed. Defaults to 3600. */
    defaultTtlSeconds?: number;
}

/** JWT auth with refresh token support, ideal for long-running soak tests. */
export class JwtRefreshAuthProvider implements IAuthProvider {
    readonly name = 'jwt-refresh';
    constructor(private opts: JwtRefreshAuthOptions) {}

    /** Returns the token pool configuration, if any. */
    get pool(): PoolConfig | undefined { return this.opts.pool; }

    /** Authenticates the user and returns a token pair (access + refresh). */
    acquireToken(client: RestClient, user?: TestUser): Token | null {
        if (!user) return null;
        const res = client.post(this.opts.loginPath, this.opts.body(user), { auth: false });
        if (!client.isSuccess(res)) return null;
        let data: unknown;
        try { data = res.json(); } catch { return null; }
        const access = extractByPath<string>(data, this.opts.extractToken);
        if (!access) return null;
        const refresh = extractByPath<string>(data, this.opts.extractRefreshToken);
        return this.buildToken(access, refresh);
    }

    /** Applies the access token as a Bearer token in the Authorization header. */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        ctx.headers['Authorization'] = `Bearer ${token.value}`;
    }

    /** Refreshes the access token using the stored refresh token. */
    refresh(client: RestClient, token: Token): Token | null {
        if (!token.refreshToken) return null;
        const body = this.opts.refreshBody
            ? this.opts.refreshBody(token.refreshToken)
            : { refresh_token: token.refreshToken };
        const res = client.post(this.opts.refreshPath, body, { auth: false });
        if (!client.isSuccess(res)) return null;
        let data: unknown;
        try { data = res.json(); } catch { return null; }
        const access = extractByPath<string>(data, this.opts.extractToken);
        if (!access) return null;
        const newRefresh = extractByPath<string>(data, this.opts.extractRefreshToken) || token.refreshToken;
        return this.buildToken(access, newRefresh);
    }

    /** Returns true if the token is expired (with a 1-minute buffer before actual expiry). */
    isExpired(token: Token): boolean {
        if (!token.expiresAt) return false;
        return Date.now() >= token.expiresAt - 60_000;
    }

    /** Builds a token object with parsed or fallback expiry. */
    private buildToken(access: string, refresh?: string): Token {
        let expiresAt: number | undefined;
        if (this.opts.parseJwtExp !== false) {
            const exp = this.tryParseJwtExp(access);
            if (exp) expiresAt = exp * 1000;
        }
        if (!expiresAt) {
            expiresAt = Date.now() + (this.opts.defaultTtlSeconds || 3600) * 1000;
        }
        return { value: access, refreshToken: refresh, issuedAt: Date.now(), expiresAt };
    }

    /** Attempts to parse the expiry timestamp from a JWT payload. */
    private tryParseJwtExp(token: string): number | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payload = encoding.b64decode(this.padBase64(parts[1].replace(/-/g, '+').replace(/_/g, '/')), 'std', 's');
            const json = JSON.parse(payload as unknown as string);
            return typeof json.exp === 'number' ? json.exp : null;
        } catch {
            return null;
        }
    }

    /** Pads a Base64-encoded string to a multiple of 4 characters. */
    private padBase64(s: string): string {
        const pad = s.length % 4;
        return pad ? s + '='.repeat(4 - pad) : s;
    }
}

/** Creates a JwtRefreshAuthProvider instance. */
export function jwtRefreshAuth(opts: JwtRefreshAuthOptions): JwtRefreshAuthProvider {
    return new JwtRefreshAuthProvider(opts);
}
