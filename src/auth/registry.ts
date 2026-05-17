import { RestClient } from '../client/rest-client';
import { ApplyContext, IAuthProvider, TestUser, Token } from './types';
import { TokenPool } from './token-pool';

interface ProviderEntry {
    provider: IAuthProvider;
    pool?: TokenPool;
    /** Singleton token for providers without a pool (e.g., OAuth2 Client Credentials). */
    singleton?: Token | null;
}

/**
 * Registry that manages multiple auth providers within the same project.
 * Usage: { user: passwordAuth(...), admin: passwordAuth(...), internal: oauth2CC(...) }.
 */
export class AuthRegistry {
    private entries = new Map<string, ProviderEntry>();

    constructor(private client: RestClient) {}

    /** Registers an auth provider under a given name, optionally with a token pool. */
    register(name: string, provider: IAuthProvider, pool?: TokenPool): void {
        this.entries.set(name, { provider, pool });
    }

    /** Returns true if a provider with the given name has been registered. */
    has(name: string): boolean {
        return this.entries.has(name);
    }

    /** Lists all registered provider names. */
    list(): string[] {
        return Array.from(this.entries.keys());
    }

    /** Returns a token for the named provider (pool pick or singleton). */
    getToken(name: string): Token | null {
        const entry = this.entries.get(name);
        if (!entry) return null;
        if (entry.pool) {
            const picked = entry.pool.pick();
            if (!picked) return null;
            const tok = picked.token;
            if (entry.provider.isExpired && entry.provider.isExpired(tok)) {
                const refreshed = entry.provider.refresh?.(this.client, tok, picked.user);
                if (refreshed) return refreshed;
            }
            return tok;
        }
        if (entry.singleton) {
            if (entry.provider.isExpired && entry.provider.isExpired(entry.singleton)) {
                const refreshed = entry.provider.refresh?.(this.client, entry.singleton);
                if (refreshed) entry.singleton = refreshed;
                else entry.singleton = entry.provider.acquireToken(this.client);
            }
            return entry.singleton;
        }
        // Lazy acquire on first access
        const tok = entry.provider.acquireToken(this.client);
        entry.singleton = tok;
        return tok;
    }

    /** Applies the named provider's token to a request context. */
    apply(ctx: ApplyContext, authName: string): boolean {
        const entry = this.entries.get(authName);
        if (!entry) return false;
        const token = this.getToken(authName);
        if (!token) return false;
        entry.provider.applyToRequest(ctx, token);
        return true;
    }

    /** Returns the raw provider instance (useful for direct acquireToken calls). */
    provider(name: string): IAuthProvider | undefined {
        return this.entries.get(name)?.provider;
    }

    /** Manually logs in a specific user without using the pool. Useful for smoke tests. */
    loginOne(name: string, user: TestUser): Token | null {
        const entry = this.entries.get(name);
        if (!entry) return null;
        const tok = entry.provider.acquireToken(this.client, user);
        return tok;
    }

    /** Returns ALL token entries from a named provider's pool (used by setup()). */
    getAllTokens(name: string): Array<{ user?: TestUser; token: Token }> {
        const entry = this.entries.get(name);
        if (!entry?.pool) return [];
        return entry.pool.getAllEntries();
    }

    /** Returns the underlying RestClient (used by setup() for pre-login HTTP calls). */
    getClient(): RestClient {
        return this.client;
    }

    /** Returns the TokenPool for a given provider name, or undefined if none. */
    getPool(name: string): TokenPool | undefined {
        return this.entries.get(name)?.pool;
    }

    /** Handles a 401 response — delegates to the provider's onUnauthorized handler if defined. */
    handleUnauthorized(name: string, user?: TestUser): Token | null {
        const entry = this.entries.get(name);
        if (!entry?.provider.onUnauthorized) return null;
        const tok = entry.provider.onUnauthorized(this.client, user);
        return tok;
    }
}
