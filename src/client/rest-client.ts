import http, { Response, RefinedParams, ResponseType } from 'k6/http';
import { sleep } from 'k6';
import { BatchRequest, HttpMethod, RequestOptions, RestClientConfig, TypedResponse } from './types';

/** Applies authentication headers and parameters to outgoing requests. */
export interface AuthApplier {
    apply: (headers: Record<string, string>, params: Record<string, string | number | boolean | undefined>, authName: string) => void;
}

/** High-level HTTP client built on top of k6/http with retry, auth, tagging, and batch support. */
export class RestClient {
    protected baseURL: string;
    protected defaultHeaders: Record<string, string>;
    protected defaultTimeout: string;
    protected defaultTags: Record<string, string>;
    protected authApplier?: AuthApplier;

    /**
     * @param config - Client configuration including base URL, default headers, timeout and tags.
     */
    constructor(config: RestClientConfig) {
        this.baseURL = (config.baseURL || '').replace(/\/+$/, '');
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(config.defaultHeaders || {}),
        };
        this.defaultTimeout = config.defaultTimeout || '30s';
        this.defaultTags = config.defaultTags || {};
    }

    /**
     * Registers an auth applier responsible for attaching authentication headers to requests.
     * Typically injected by the project definition layer.
     */
    setAuthApplier(applier: AuthApplier): void {
        this.authApplier = applier;
    }

    /** Sends a GET request. */
    get<T = unknown>(path: string, options?: RequestOptions): TypedResponse<T> {
        return this.request<T>('GET', path, undefined, options);
    }
    /** Sends a POST request. */
    post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): TypedResponse<T> {
        return this.request<T>('POST', path, body, options);
    }
    /** Sends a PUT request. */
    put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): TypedResponse<T> {
        return this.request<T>('PUT', path, body, options);
    }
    /** Sends a PATCH request. */
    patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): TypedResponse<T> {
        return this.request<T>('PATCH', path, body, options);
    }
    /** Sends a DELETE request. */
    del<T = unknown>(path: string, body?: unknown, options?: RequestOptions): TypedResponse<T> {
        return this.request<T>('DELETE', path, body, options);
    }
    /** Sends a HEAD request. */
    head<T = unknown>(path: string, options?: RequestOptions): TypedResponse<T> {
        return this.request<T>('HEAD', path, undefined, options);
    }
    /** Sends an OPTIONS request. */
    options<T = unknown>(path: string, options?: RequestOptions): TypedResponse<T> {
        return this.request<T>('OPTIONS', path, null, options);
    }

    /**
     * Sends multiple requests in parallel via k6's http.batch.
     *
     * @param requests - Array of batch request descriptors.
     * @returns Array of responses in the same order as the input requests.
     */
    batch(requests: BatchRequest[]): Response[] {
        const items = requests.map((r) => {
            const headers = this.buildHeaders(r.options);
            const url = this.buildURL(r.path, r.options?.params);
            const tags = this.buildTags(r.path, r.method, r.options);
            const payload = this.buildPayload(r.body);
            return {
                method: r.method,
                url,
                body: payload,
                params: {
                    headers,
                    timeout: r.options?.timeout || this.defaultTimeout,
                    tags,
                    ...(r.options?.responseType ? { responseType: r.options.responseType } : {}),
                } as RefinedParams<ResponseType>,
            };
        });
        return http.batch(items) as unknown as Response[];
    }

    /** Returns true if the response status is in the 2xx range. */
    isSuccess(response: Response): boolean {
        return response.status >= 200 && response.status < 300;
    }
    /** Returns true if the response status is in the 4xx range. */
    isClientError(response: Response): boolean {
        return response.status >= 400 && response.status < 500;
    }
    /** Returns true if the response status is in the 5xx range. */
    isServerError(response: Response): boolean {
        return response.status >= 500 && response.status < 600;
    }
    /** Returns true if the response status is 401 or 403. */
    isUnauthorized(response: Response): boolean {
        return response.status === 401 || response.status === 403;
    }

    /**
     * Core request handler — all public HTTP methods route through here.
     * Handles retry logic with exponential backoff and automatic JSON body parsing.
     */
    protected request<T = unknown>(
        method: HttpMethod,
        path: string,
        body?: unknown,
        options?: RequestOptions
    ): TypedResponse<T> {
        const headers = this.buildHeaders(options);
        const url = this.buildURL(path, options?.params);
        const tags = this.buildTags(path, method, options);
        const params: RefinedParams<ResponseType> = {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags,
            ...(options?.responseType ? { responseType: options.responseType } : {}),
        };

        const payload = this.buildPayload(body);
        const retries = options?.retries ?? 0;
        const retryDelayMs = options?.retryDelayMs ?? 200;

        let response: Response | undefined;
        let attempt = 0;
        while (attempt <= retries) {
            response = this.invoke(method, url, payload, params);
            if (this.isSuccess(response) || this.isClientError(response)) {
                break;
            }
            attempt++;
            if (attempt <= retries) {
                sleep((retryDelayMs * Math.pow(2, attempt - 1)) / 1000);
            }
        }

        const typed = response as TypedResponse<T>;
        if (typed && typed.body && typeof typed.json === 'function') {
            try {
                typed.data = typed.json() as T;
            } catch {
                // Body is not valid JSON; silently skip.
            }
        }
        return typed;
    }

    /** Dispatches the HTTP request to the appropriate k6/http method. */
    protected invoke(method: HttpMethod, url: string, payload: string | null, params: RefinedParams<ResponseType>): Response {
        const m = method.toLowerCase();
        switch (m) {
            case 'get':
                return http.get(url, params);
            case 'post':
                return http.post(url, payload ?? '', params);
            case 'put':
                return http.put(url, payload ?? '', params);
            case 'patch':
                return http.patch(url, payload ?? '', params);
            case 'delete':
                return http.del(url, payload, params);
            case 'head':
                return http.head(url, params);
            case 'options':
                return http.options(url, null, params);
            default:
                throw new Error(`Unsupported HTTP method: ${method}`);
        }
    }

    /** Resolves the full URL by prepending baseURL and appending query params if any. */
    protected buildURL(path: string, queryParams?: Record<string, string | number | boolean | undefined>): string {
        let url: string;
        if (/^https?:\/\//i.test(path)) {
            url = path;
        } else {
            const urlPath = path.startsWith('/') ? path : `/${path}`;
            url = `${this.baseURL}${urlPath}`;
        }
        if (queryParams) {
            const qs = this.toQueryString(queryParams);
            if (qs) url += (url.includes('?') ? '&' : '?') + qs;
        }
        return url;
    }

    /** Converts a params record to a URL query string, filtering out undefined values. */
    protected toQueryString(params: Record<string, string | number | boolean | undefined>): string {
        const parts: string[] = [];
        Object.keys(params).forEach((k) => {
            const v = params[k];
            if (v !== undefined) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        });
        return parts.join('&');
    }

    /** Merges default headers with request-specific options including auth headers. */
    protected buildHeaders(options?: RequestOptions): Record<string, string> {
        const headers: Record<string, string> = { ...this.defaultHeaders, ...(options?.headers || {}) };

        if (options?.token) {
            headers['Authorization'] = headers['Authorization'] || `Bearer ${options.token}`;
        } else if (options?.auth !== false && this.authApplier) {
            const authName = (options?.auth as string) || 'default';
            const params: Record<string, string | number | boolean | undefined> = {};
            this.authApplier.apply(headers, params, authName);
            if (options) {
                options.params = { ...(options.params || {}), ...params };
            }
        }
        return headers;
    }

    /** Builds k6 metric tags including the normalized endpoint and HTTP method. */
    protected buildTags(path: string, method: HttpMethod, options?: RequestOptions): Record<string, string> {
        return {
            ...this.defaultTags,
            endpoint: this.normalizeEndpoint(path),
            method,
            ...(options?.tags || {}),
        };
    }

    /** Normalizes a URL path by replacing dynamic segments (IDs, UUIDs) with placeholders. */
    protected normalizeEndpoint(path: string): string {
        return path
            .split('?')[0]
            .split('/')
            .map((seg) => {
                if (/^\d+$/.test(seg)) return ':id';
                if (/^[0-9a-f-]{8,}$/i.test(seg) && seg.length >= 16) return ':id';
                return seg;
            })
            .join('/');
    }

    /** Serializes the request body to a string, returning null for empty bodies. */
    protected buildPayload(body: unknown): string | null {
        if (body === undefined || body === null) return null;
        if (typeof body === 'string') return body;
        return JSON.stringify(body);
    }
}
