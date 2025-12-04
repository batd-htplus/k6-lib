import http from 'k6/http';
import { Response } from 'k6/http';
import { check } from 'k6';

export interface HTTPRequestOptions {
    headers?: Record<string, string>;
    timeout?: string;
    tags?: Record<string, string>;
    params?: Record<string, string | number | boolean | undefined>;
}

export interface HTTPResponse<T = unknown> extends Response {
    data?: T;
    success?: boolean;
}

export interface CheckConfig {
    name: string;
    check: (response: Response) => boolean;
}

export class BaseHTTPClient {
    protected baseURL: string;
    protected defaultHeaders: Record<string, string>;
    protected defaultTimeout: string;

    constructor(config: {
        baseURL: string;
        defaultHeaders?: Record<string, string>;
        defaultTimeout?: string;
    }) {
        this.baseURL = config.baseURL;
        this.defaultHeaders = config.defaultHeaders || {
            'Content-Type': 'application/json',
        };
        this.defaultTimeout = config.defaultTimeout || '30s';
    }

    protected buildURL(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        const base = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
        const urlPath = path.startsWith('/') ? path : `/${path}`;
        return `${base}${urlPath}`;
    }

    protected mergeHeaders(customHeaders?: Record<string, string>): Record<string, string> {
        return { ...this.defaultHeaders, ...customHeaders };
    }

    get<T = unknown>(path: string, options?: HTTPRequestOptions): HTTPResponse<T> {
        const url = this.buildURL(path);
        const headers = this.mergeHeaders(options?.headers);
        const response = http.get(url, {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags: options?.tags,
            params: options?.params,
        }) as HTTPResponse<T>;

        if (response.json) {
            try {
                response.data = response.json() as T;
            } catch {
                // Not JSON or empty body
            }
        }

        return response;
    }

    post<T = unknown>(path: string, body?: unknown, options?: HTTPRequestOptions): HTTPResponse<T> {
        const url = this.buildURL(path);
        const headers = this.mergeHeaders(options?.headers);
        const payload = typeof body === 'string' ? body : JSON.stringify(body || {});

        const response = http.post(url, payload, {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags: options?.tags,
            params: options?.params,
        }) as HTTPResponse<T>;

        if (response.json) {
            try {
                response.data = response.json() as T;
            } catch {
                // Not JSON or empty body
            }
        }

        return response;
    }

    put<T = unknown>(path: string, body?: unknown, options?: HTTPRequestOptions): HTTPResponse<T> {
        const url = this.buildURL(path);
        const headers = this.mergeHeaders(options?.headers);
        const payload = typeof body === 'string' ? body : JSON.stringify(body || {});

        const response = http.put(url, payload, {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags: options?.tags,
            params: options?.params,
        }) as HTTPResponse<T>;

        if (response.json) {
            try {
                response.data = response.json() as T;
            } catch {
                // Not JSON or empty body
            }
        }

        return response;
    }

    patch<T = unknown>(path: string, body?: unknown, options?: HTTPRequestOptions): HTTPResponse<T> {
        const url = this.buildURL(path);
        const headers = this.mergeHeaders(options?.headers);
        const payload = typeof body === 'string' ? body : JSON.stringify(body || {});

        const response = http.patch(url, payload, {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags: options?.tags,
            params: options?.params,
        }) as HTTPResponse<T>;

        if (response.json) {
            try {
                response.data = response.json() as T;
            } catch {
                // Not JSON or empty body
            }
        }

        return response;
    }

    del<T = unknown>(path: string, body?: unknown, options?: HTTPRequestOptions): HTTPResponse<T> {
        const url = this.buildURL(path);
        const headers = this.mergeHeaders(options?.headers);
        const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

        const response = http.del(url, payload, {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags: options?.tags,
            params: options?.params,
        }) as HTTPResponse<T>;

        if (response.json) {
            try {
                response.data = response.json() as T;
            } catch {
                // Not JSON or empty body
            }
        }

        return response;
    }

    head(path: string, options?: HTTPRequestOptions): Response {
        const url = this.buildURL(path);
        const headers = this.mergeHeaders(options?.headers);
        return http.head(url, {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags: options?.tags,
            params: options?.params,
        });
    }

    options(path: string, options?: HTTPRequestOptions): Response {
        const url = this.buildURL(path);
        const headers = this.mergeHeaders(options?.headers);
        return http.options(url, {
            headers,
            timeout: options?.timeout || this.defaultTimeout,
            tags: options?.tags,
            params: options?.params,
        });
    }

    validateResponse(response: Response, checks: CheckConfig[]): boolean {
        const checkMap: Record<string, (r: Response) => boolean> = {};
        checks.forEach((c) => {
            checkMap[c.name] = c.check;
        });
        return check(response, checkMap);
    }

    isSuccess(response: Response): boolean {
        return response.status >= 200 && response.status < 300;
    }

    isClientError(response: Response): boolean {
        return response.status >= 400 && response.status < 500;
    }

    isServerError(response: Response): boolean {
        return response.status >= 500 && response.status < 600;
    }
}

