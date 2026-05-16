import { Response } from 'k6/http';

/** Supported HTTP methods for REST requests. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/** Options that can be passed to any REST request. */
export interface RequestOptions {
    /** Custom headers to include in the request. */
    headers?: Record<string, string>;
    /** Request timeout duration string (e.g. '30s'). */
    timeout?: string;
    /** Custom k6 tags to attach to the request metrics. */
    tags?: Record<string, string>;
    /** Additional URL query parameters. */
    params?: Record<string, string | number | boolean | undefined>;
    /** Auth provider name when the project has multiple providers (e.g. 'user', 'admin', 'internal'). Set to false to skip auth. */
    auth?: string | false;
    /** Raw bearer token to override the auth registry entirely. */
    token?: string;
    /** Number of retry attempts on 5xx or network errors. Defaults to 0. */
    retries?: number;
    /** Base delay between retries in ms. Defaults to 200ms, increases exponentially. */
    retryDelayMs?: number;
}

/** A Response extended with a typed parsed JSON body. */
export interface TypedResponse<T = unknown> extends Response {
    /** The response body parsed as type T, set automatically after a successful JSON parse. */
    data?: T;
}

/** Describes a single request within a batch call. */
export interface BatchRequest {
    /** HTTP method for the batch request. */
    method: HttpMethod;
    /** Request path (relative to baseURL or absolute URL). */
    path: string;
    /** Optional request body. */
    body?: unknown;
    /** Optional per-request options. */
    options?: RequestOptions;
}

/** Configuration for creating a RestClient instance. */
export interface RestClientConfig {
    /** Base URL prepended to every request path. */
    baseURL: string;
    /** Default headers sent with every request. */
    defaultHeaders?: Record<string, string>;
    /** Default timeout for every request (e.g. '30s'). */
    defaultTimeout?: string;
    /** Default tags attached to every request metric. */
    defaultTags?: Record<string, string>;
    /** Whether to allow HTTP connection reuse (k6 enables by default; library may override). */
    reuseConnections?: boolean;
    /** Whether to discard response bodies after parsing to reduce RAM/CPU for throughput tests. */
    discardResponseBodies?: boolean;
}
