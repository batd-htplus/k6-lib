import { RestClient } from '../client/rest-client';
import { ApplyContext, IAuthProvider, PoolConfig, TestUser, Token } from './types';

/** Options for configuring a fully custom authentication provider. */
export interface CustomAuthOptions {
    /** Unique name identifier for this provider. */
    name: string;
    /** Custom function to acquire a token. */
    acquireToken: (client: RestClient, user?: TestUser) => Token | null;
    /** Custom function to apply the token to a request context. */
    applyToRequest: (ctx: ApplyContext, token: Token) => void;
    /** Optional custom function to refresh an expired token. */
    refresh?: (client: RestClient, token: Token, user?: TestUser) => Token | null;
    /** Optional custom function to check token expiration. */
    isExpired?: (token: Token) => boolean;
    /** Optional token pool configuration for pre-login scenarios. */
    pool?: PoolConfig;
}

/** Escape hatch for when company auth flows are too specific to use built-in providers. */
export class CustomAuthProvider implements IAuthProvider {
    readonly name: string;
    constructor(private opts: CustomAuthOptions) {
        this.name = opts.name;
    }

    /** Returns the token pool configuration, if any. */
    get pool(): PoolConfig | undefined { return this.opts.pool; }

    /** Acquires a token using the custom acquire function. */
    acquireToken(client: RestClient, user?: TestUser): Token | null {
        return this.opts.acquireToken(client, user);
    }

    /** Applies the token to the request using the custom apply function. */
    applyToRequest(ctx: ApplyContext, token: Token): void {
        this.opts.applyToRequest(ctx, token);
    }

    /** Refreshes the token using the custom refresh function, if defined. */
    refresh(client: RestClient, token: Token, user?: TestUser): Token | null {
        return this.opts.refresh ? this.opts.refresh(client, token, user) : null;
    }

    /** Checks token expiration using the custom isExpired function, if defined. */
    isExpired(token: Token): boolean {
        return this.opts.isExpired ? this.opts.isExpired(token) : false;
    }
}

/** Creates a CustomAuthProvider instance for fully custom authentication flows. */
export function customAuth(opts: CustomAuthOptions): CustomAuthProvider {
    return new CustomAuthProvider(opts);
}
