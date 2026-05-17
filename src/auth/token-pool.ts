import { RestClient } from '../client/rest-client';
import { IAuthProvider, PoolConfig, TestUser, Token } from './types';

/** A single entry in the token pool: an optional user reference and their pre-acquired token. */
export interface PoolEntry {
    user?: TestUser;
    token: Token;
}

/**
 * Token pool that assigns one pre-logged-in user per VU.
 *
 * Tokens must be loaded before VU execution via `load()` (call from setup() where HTTP is allowed).
 * Rotation strategy only affects the initial VU→token mapping:
 * - `round-robin`: VU 1→token[0], VU 2→token[1], … (default)
 * - `per-vu`: same as round-robin
 * - `random`: VU→random token
 */
export class TokenPool {
    private entries: PoolEntry[] = [];
    private rotation: NonNullable<PoolConfig['rotation']>;

    constructor(config: PoolConfig) {
        this.rotation = config.rotation || 'round-robin';
    }

    /**
     * Populate the pool with token entries. Must be called during setup()
     * (HTTP is allowed there). Safe to call multiple times — replaces entries.
     */
    load(entries: PoolEntry[]): void {
        this.entries = entries;
    }

    /**
     * Returns the token assigned to the current VU.
     * Each VU keeps the same token for its entire lifetime.
     */
    pick(): PoolEntry | null {
        if (this.entries.length === 0) return null;
        const vu = (globalThis as { __VU?: number }).__VU || 1;
        const idx = this.resolveIndex(vu);
        return this.entries[idx % this.entries.length];
    }

    private resolveIndex(vu: number): number {
        switch (this.rotation) {
            case 'random':
                return ((vu * 2654435761) >>> 0) % this.entries.length;
            case 'round-robin':
            case 'per-vu':
            default:
                return (vu - 1) % this.entries.length;
        }
    }

    /** Returns all entries in the pool. */
    getAllEntries(): PoolEntry[] {
        return this.entries.slice();
    }

    /** Returns the number of entries in the pool. */
    get size(): number {
        return this.entries.length;
    }
}

/** Helper called by defineProject during setup() to pre-login a set of users. */
export function buildPoolEntries(
    provider: IAuthProvider,
    client: RestClient,
    users: TestUser[],
    size: number
): PoolEntry[] {
    const picked = users.slice(0, Math.min(size, users.length));
    const entries: PoolEntry[] = [];
    for (const user of picked) {
        const token = provider.acquireToken(client, user);
        if (token) entries.push({ user, token });
    }
    if (entries.length === 0 && !picked.length) {
        // Provider does not require a user (e.g., OAuth2 client credentials)
        const token = provider.acquireToken(client);
        if (token) entries.push({ token });
    }
    return entries;
}
