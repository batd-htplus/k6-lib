import { ApplyContext, IAuthProvider, Token } from './types';

/** Options for configuring API key authentication. */
export interface ApiKeyAuthOptions {
    /** The API key value. */
    key: string;
    /** Where to place the key: HTTP header or query parameter. Defaults to 'header'. */
    location?: 'header' | 'query';
    /** The header or query parameter name. Defaults to 'X-API-Key' for header, 'api_key' for query. */
    name?: string;
    /** Header value format when location is 'header'. Defaults to '{key}' (raw). Use 'Bearer {key}' for bearer-style. */
    headerFormat?: string;
}

/** Auth provider that sends an API key via header or query parameter. */
export class ApiKeyAuthProvider implements IAuthProvider {
    readonly name = 'api-key';
    constructor(private opts: ApiKeyAuthOptions) {}

    /** Returns the API key as the token value. */
    acquireToken(): Token | null {
        if (!this.opts.key) return null;
        return { value: this.opts.key };
    }

    /** Applies the API key to the request header or query string based on configuration. */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        const location = this.opts.location || 'header';
        const name = this.opts.name || (location === 'header' ? 'X-API-Key' : 'api_key');
        if (location === 'header') {
            const format = this.opts.headerFormat || '{key}';
            ctx.headers[name] = format.replace('{key}', token.value);
        } else {
            ctx.query[name] = token.value;
        }
    }

    /** API keys do not expire. */
    isExpired(): boolean {
        return false;
    }
}

/** Creates an ApiKeyAuthProvider instance. */
export function apiKeyAuth(opts: ApiKeyAuthOptions): ApiKeyAuthProvider {
    return new ApiKeyAuthProvider(opts);
}
