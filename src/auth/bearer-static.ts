import { ApplyContext, IAuthProvider, Token } from './types';

/** Options for configuring static Bearer token authentication. */
export interface BearerStaticAuthOptions {
    /** The static bearer token value. */
    token: string;
    /** Custom header name. Defaults to 'Authorization'. */
    headerName?: string;
    /** Custom header format. Defaults to 'Bearer {token}'. */
    headerFormat?: string;
}

/** Auth provider that sends a static bearer token on every request. */
export class BearerStaticAuthProvider implements IAuthProvider {
    readonly name = 'bearer-static';
    constructor(private opts: BearerStaticAuthOptions) {}

    /** Returns the configured static token. */
    acquireToken(): Token | null {
        return { value: this.opts.token };
    }

    /** Sets the authorization header with the configured format. */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        const headerName = this.opts.headerName || 'Authorization';
        const format = this.opts.headerFormat || 'Bearer {token}';
        ctx.headers[headerName] = format.replace('{token}', token.value);
    }

    /** Static tokens do not expire. */
    isExpired(): boolean {
        return false;
    }
}

/** Creates a BearerStaticAuthProvider instance. */
export function bearerStaticAuth(opts: BearerStaticAuthOptions): BearerStaticAuthProvider {
    return new BearerStaticAuthProvider(opts);
}
