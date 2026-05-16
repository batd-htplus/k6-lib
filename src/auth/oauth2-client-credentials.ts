import { RestClient } from '../client/rest-client';
import { ApplyContext, IAuthProvider, Token } from './types';
import { extractByPath } from './utils';

/** Options for configuring OAuth 2.0 Client Credentials flow. */
export interface OAuth2ClientCredentialsOptions {
    /** The token endpoint URL (e.g., 'https://auth.example.com/oauth/token'). */
    tokenUrl: string;
    /** The OAuth 2.0 client identifier. */
    clientId: string;
    /** The OAuth 2.0 client secret. */
    clientSecret: string;
    /** Optional list of requested scopes. */
    scopes?: string[];
    /** Optional audience parameter (used by Auth0, AWS Cognito, etc.). */
    audience?: string;
    /** Whether to cache the token across all VUs. Defaults to true since client credentials are user-independent. */
    cacheAcrossVUs?: boolean;
    /** Fallback TTL in seconds when the server does not return expires_in. Defaults to 3600. */
    defaultTtlSeconds?: number;
}

/** Auth provider that implements the OAuth 2.0 Client Credentials grant type. */
export class OAuth2ClientCredentialsProvider implements IAuthProvider {
    readonly name = 'oauth2-client-credentials';
    constructor(private opts: OAuth2ClientCredentialsOptions) {}

    /** Exchanges client credentials for an access token via the token endpoint. */
    acquireToken(client: RestClient): Token | null {
        const body: Record<string, string> = {
            grant_type: 'client_credentials',
            client_id: this.opts.clientId,
            client_secret: this.opts.clientSecret,
        };
        if (this.opts.scopes && this.opts.scopes.length) body.scope = this.opts.scopes.join(' ');
        if (this.opts.audience) body.audience = this.opts.audience;

        const form = Object.keys(body)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(body[k])}`)
            .join('&');

        const res = client.post(this.opts.tokenUrl, form, {
            auth: false,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        if (!client.isSuccess(res)) {
            console.error(`[oauth2-cc] token request failed ${res.status}`);
            return null;
        }
        let data: unknown;
        try { data = res.json(); } catch { return null; }
        const access = extractByPath<string>(data, 'access_token');
        if (!access) return null;
        const expiresIn = extractByPath<number>(data, 'expires_in') || this.opts.defaultTtlSeconds || 3600;
        return {
            value: access,
            issuedAt: Date.now(),
            expiresAt: Date.now() + expiresIn * 1000,
        };
    }

    /** Sets the access token as a Bearer token in the Authorization header. */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        ctx.headers['Authorization'] = `Bearer ${token.value}`;
    }

    /** Returns true if the token is expired (with a 30-second buffer before actual expiry). */
    isExpired(token: Token): boolean {
        if (!token.expiresAt) return false;
        return Date.now() >= token.expiresAt - 30_000;
    }
}

/** Creates an OAuth2ClientCredentialsProvider instance. */
export function oauth2ClientCredentials(opts: OAuth2ClientCredentialsOptions): OAuth2ClientCredentialsProvider {
    return new OAuth2ClientCredentialsProvider(opts);
}
