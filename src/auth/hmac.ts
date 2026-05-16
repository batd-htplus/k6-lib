import crypto from 'k6/crypto';
import { ApplyContext, IAuthProvider, Token } from './types';

/** Options for configuring HMAC request signing authentication. */
export interface HmacAuthOptions {
    /** The key identifier sent in the signature header. */
    keyId: string;
    /** The shared secret used to sign requests. */
    secret: string;
    /** Hashing algorithm. Defaults to 'sha256'. */
    algorithm?: 'sha256' | 'sha512';
    /** Header that carries the signature. Defaults to 'Authorization'. */
    signatureHeader?: string;
    /** Header format template. Defaults to 'HMAC-SHA256 keyId={keyId}, signature={signature}'. */
    signatureFormat?: string;
    /** Custom function to build the signing string from the request context. Override to match company scheme. */
    buildSigningString?: (ctx: ApplyContext, timestamp: number) => string;
    /** Whether to attach a timestamp header. Defaults to true. */
    addTimestampHeader?: boolean;
    /** Name of the timestamp header. Defaults to 'X-Timestamp'. */
    timestampHeader?: string;
}

/** Auth provider that signs each request using HMAC. */
export class HmacAuthProvider implements IAuthProvider {
    readonly name = 'hmac';
    constructor(private opts: HmacAuthOptions) {}

    /** Returns the shared secret as the token value (HMAC has no traditional token). */
    acquireToken(): Token | null {
        return { value: this.opts.secret };
    }

    /** Computes and applies the HMAC signature along with the timestamp header. */
    applyToRequest(ctx: ApplyContext, _token: Token): void {
        const algo = this.opts.algorithm || 'sha256';
        const timestamp = Math.floor(Date.now() / 1000);
        const signingString = this.opts.buildSigningString
            ? this.opts.buildSigningString(ctx, timestamp)
            : this.defaultSigningString(ctx, timestamp);
        const signature = crypto.hmac(algo, this.opts.secret, signingString, 'base64');

        const sigHeader = this.opts.signatureHeader || 'Authorization';
        const format = this.opts.signatureFormat || `HMAC-${algo.toUpperCase()} keyId={keyId}, signature={signature}`;
        ctx.headers[sigHeader] = format.replace('{keyId}', this.opts.keyId).replace('{signature}', signature);

        if (this.opts.addTimestampHeader !== false) {
            ctx.headers[this.opts.timestampHeader || 'X-Timestamp'] = String(timestamp);
        }
    }

    /** Each request generates a fresh signature, so tokens never expire. */
    isExpired(): boolean {
        return false;
    }

    /** Builds a default signing string from method, path, timestamp, and body. */
    private defaultSigningString(ctx: ApplyContext, timestamp: number): string {
        const method = (ctx.method || 'GET').toUpperCase();
        const path = ctx.path || '/';
        const body = typeof ctx.body === 'string' ? ctx.body : ctx.body ? JSON.stringify(ctx.body) : '';
        return `${method}\n${path}\n${timestamp}\n${body}`;
    }
}

/** Creates an HmacAuthProvider instance. */
export function hmacAuth(opts: HmacAuthOptions): HmacAuthProvider {
    return new HmacAuthProvider(opts);
}
