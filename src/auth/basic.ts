import encoding from 'k6/encoding';
import { ApplyContext, IAuthProvider, Token } from './types';

/** Options for configuring HTTP Basic authentication. */
export interface BasicAuthOptions {
    /** The username for authentication. */
    username: string;
    /** The password for authentication. */
    password: string;
}

/** Auth provider that applies HTTP Basic authentication via the Authorization header. */
export class BasicAuthProvider implements IAuthProvider {
    readonly name = 'basic';
    private encoded: string;

    constructor(opts: BasicAuthOptions) {
        this.encoded = encoding.b64encode(`${opts.username}:${opts.password}`);
    }

    /** Returns the Base64-encoded credentials as the token value. */
    acquireToken(): Token | null {
        return { value: this.encoded };
    }

    /** Sets the Authorization header to "Basic <encoded-credentials>". */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        ctx.headers['Authorization'] = `Basic ${token.value}`;
    }

    /** Basic auth credentials do not expire. */
    isExpired(): boolean {
        return false;
    }
}

/** Creates a BasicAuthProvider instance. */
export function basicAuth(opts: BasicAuthOptions): BasicAuthProvider {
    return new BasicAuthProvider(opts);
}
