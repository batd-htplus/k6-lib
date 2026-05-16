import { SharedArray } from 'k6/data';
import { RestClient } from '../client/rest-client';
import { IAuthProvider, PoolConfig, TestUser, Token } from './types';

interface PoolEntry {
    user?: TestUser;
    token: Token;
}

type SharedArrayLike<T> = { readonly length: number; readonly [index: number]: T };

/**
 * Pre-login N users during setup() and shares tokens across VUs via SharedArray.
 *
 * 🛑 IMPORTANT: Mỗi VU được gán **một token cố định** trong suốt vòng đời của nó.
 * Không pick token mới cho mỗi request — tránh lẫn data giữa các user.
 *
 * Rotation strategy chỉ ảnh hưởng đến cách phân bổ VU → token lúc ban đầu:
 * - `round-robin`: VU 1→token[0], VU 2→token[1], … (mặc định)
 * - `per-vu`: tương tự round-robin
 * - `random`: VU → token ngẫu nhiên
 */
export class TokenPool {
    private entries: SharedArrayLike<PoolEntry>;
    private rotation: NonNullable<PoolConfig['rotation']>;

    constructor(
        name: string,
        config: PoolConfig,
        loader: () => PoolEntry[]
    ) {
        this.rotation = config.rotation || 'round-robin';
        this.entries = new SharedArray<PoolEntry>(`token-pool:${name}`, loader) as unknown as SharedArrayLike<PoolEntry>;
    }

    /**
     * Trả về token gán cho VU hiện tại.
     * Kết quả được cache theo `__VU` để mọi request trong cùng VU dùng chung một user.
     */
    pick(): PoolEntry | null {
        if (this.entries.length === 0) return null;
        const vu = (globalThis as { __VU?: number }).__VU || 1;
        const idx = this.resolveIndex(vu);
        return this.entries[idx % this.entries.length];
    }

    /** Xác định index trong pool dựa trên VU number. */
    private resolveIndex(vu: number): number {
        switch (this.rotation) {
            case 'random':
                // Seed giả định theo VU để phân bố đều
                return ((vu * 2654435761) >>> 0) % this.entries.length;
            case 'round-robin':
            case 'per-vu':
            default:
                return (vu - 1) % this.entries.length;
        }
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
