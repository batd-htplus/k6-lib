import { RestClient } from '../client/rest-client';

/** Represents a test user with optional credentials and custom attributes. */
export interface TestUser {
    email?: string;
    username?: string;
    password?: string;
    role?: string;
    [key: string]: string | number | boolean | undefined;
}

/** Represents an authentication token with optional refresh and expiry tracking. */
export interface Token {
    value: string;
    refreshToken?: string;
    expiresAt?: number;
    issuedAt?: number;
    [key: string]: unknown;
}

/** Context passed to auth providers for applying authentication to a request. */
export interface ApplyContext {
    headers: Record<string, string>;
    query: Record<string, string | number | boolean | undefined>;
    method?: string;
    path?: string;
    body?: unknown;
}

/** Defines the contract for all authentication providers. */
export interface IAuthProvider {
    readonly name: string;
    /** Acquires a new token, optionally for a specific user. */
    acquireToken(client: RestClient, user?: TestUser): Token | null;
    /** Applies the token to a request context (headers, query params). */
    applyToRequest(ctx: ApplyContext, token: Token): void;
    /** Refreshes an existing token, returning a new one if successful. */
    refresh?(client: RestClient, token: Token, user?: TestUser): Token | null;
    /** Checks whether a token is expired. */
    isExpired?(token: Token): boolean;
    /** Handles unauthorized responses, returning a new token if possible. */
    onUnauthorized?(client: RestClient, user?: TestUser): Token | null;
}

/** Configuration for token pool rotation behavior. */
export interface PoolConfig {
    size: number;
    rotation?: 'round-robin' | 'random' | 'per-vu';
}
