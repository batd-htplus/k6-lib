import { RestClient } from '../client/rest-client';
import { ApplyContext, IAuthProvider, PoolConfig, TestUser, Token } from './types';
import { extractByPath } from './utils';

/** Options for configuring OAuth 2.0 Resource Owner Password Credentials flow. */
export interface OAuth2PasswordOptions {
    /** The token endpoint URL. */
    tokenUrl: string;
    /** The OAuth 2.0 client identifier. */
    clientId: string;
    /** Optional OAuth 2.0 client secret. */
    clientSecret?: string;
    /** Optional list of requested scopes. */
    scopes?: string[];
    /** Optional token pool configuration for pre-login scenarios. */
    pool?: PoolConfig;
    /** Fallback TTL in seconds when the server does not return expires_in. Defaults to 3600. */
    defaultTtlSeconds?: number;
}

/** Auth provider that implements the OAuth 2.0 Password grant type with optional refresh token support. */
export class OAuth2PasswordProvider implements IAuthProvider {
    readonly name = 'oauth2-password';
    constructor(private opts: OAuth2PasswordOptions) {}

    /** Returns the token pool configuration, if any. */
    get pool(): PoolConfig | undefined { return this.opts.pool; }

    /** Authenticates with username/password and returns an access token (with optional refresh token). */
    acquireToken(client: RestClient, user?: TestUser): Token | null {
        if (!user || !user.password || !(user.username || user.email)) return null;
        const body: Record<string, string> = {
            grant_type: 'password',
            username: (user.username || user.email) as string,
            password: user.password,
            client_id: this.opts.clientId,
        };
        if (this.opts.clientSecret) body.client_secret = this.opts.clientSecret;
        if (this.opts.scopes && this.opts.scopes.length) body.scope = this.opts.scopes.join(' ');

        const form = Object.keys(body)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(body[k])}`)
            .join('&');

        const res = client.post(this.opts.tokenUrl, form, {
            auth: false,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (!client.isSuccess(res)) return null;
        let data: unknown;
        try { data = res.json(); } catch { return null; }
        const access = extractByPath<string>(data, 'access_token');
        if (!access) return null;
        const refresh = extractByPath<string>(data, 'refresh_token');
        const expiresIn = extractByPath<number>(data, 'expires_in') || this.opts.defaultTtlSeconds || 3600;
        return {
            value: access,
            refreshToken: refresh,
            issuedAt: Date.now(),
            expiresAt: Date.now() + expiresIn * 1000,
        };
    }

    /** Sets the access token as a Bearer token in the Authorization header. */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        ctx.headers['Authorization'] = `Bearer ${token.value}`;
    }

    /** Refreshes the access token using the stored refresh token. */
    refresh(client: RestClient, token: Token): Token | null {
        if (!token.refreshToken) return null;
        const body: Record<string, string> = {
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
            client_id: this.opts.clientId,
        };
        if (this.opts.clientSecret) body.client_secret = this.opts.clientSecret;
        const form = Object.keys(body).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(body[k])}`).join('&');
        const res = client.post(this.opts.tokenUrl, form, {
            auth: false,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (!client.isSuccess(res)) return null;
        let data: unknown;
        try { data = res.json(); } catch { return null; }
        const access = extractByPath<string>(data, 'access_token');
        if (!access) return null;
        const refresh = extractByPath<string>(data, 'refresh_token') || token.refreshToken;
        const expiresIn = extractByPath<number>(data, 'expires_in') || this.opts.defaultTtlSeconds || 3600;
        return { value: access, refreshToken: refresh, issuedAt: Date.now(), expiresAt: Date.now() + expiresIn * 1000 };
    }

    /** Returns true if the token is expired (with a 30-second buffer before actual expiry). */
    isExpired(token: Token): boolean {
        if (!token.expiresAt) return false;
        return Date.now() >= token.expiresAt - 30_000;
    }
}

/** Creates an OAuth2PasswordProvider instance. */
export function oauth2Password(opts: OAuth2PasswordOptions): OAuth2PasswordProvider {
    return new OAuth2PasswordProvider(opts);
}
