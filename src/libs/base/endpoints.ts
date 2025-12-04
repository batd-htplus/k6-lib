export class BaseEndpoints {
    protected basePath: string;

    constructor(basePath: string = '') {
        this.basePath = basePath;
    }

    protected path(...segments: (string | number)[]): string {
        const parts = [this.basePath, ...segments]
            .filter(Boolean)
            .map(String)
            .map((s) => s.replace(/^\/+|\/+$/g, ''))
            .filter(Boolean);
        return parts.length > 0 ? '/' + parts.join('/') : '/';
    }

    protected withQuery(path: string, params?: Record<string, string | number | boolean | undefined>): string {
        if (!params || Object.keys(params).length === 0) {
            return path;
        }

        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
            .join('&');

        return `${path}?${queryString}`;
    }

    protected withParams(path: string, params: Record<string, string | number>): string {
        let result = path;
        Object.entries(params).forEach(([key, value]) => {
            result = result.replace(`:${key}`, String(value));
        });
        return result;
    }
}

export class AuthEndpoints extends BaseEndpoints {
    constructor(basePath: string = '/api/auth') {
        super(basePath);
    }

    login(): string {
        return this.path('login');
    }

    logout(): string {
        return this.path('logout');
    }

    refresh(): string {
        return this.path('refresh');
    }

    register(): string {
        return this.path('register');
    }

    requestPasswordReset(): string {
        return this.path('password', 'reset', 'request');
    }

    confirmPasswordReset(): string {
        return this.path('password', 'reset', 'confirm');
    }

    verifyEmail(token: string): string {
        return this.path('verify', token);
    }
}

export class CRUDEndpoints extends BaseEndpoints {
    constructor(resourceName: string, basePath?: string) {
        super(basePath || `/api/${resourceName}`);
    }

    list(params?: Record<string, string | number | boolean | undefined>): string {
        return this.withQuery(this.path(), params);
    }

    get(id: string | number): string {
        return this.path(String(id));
    }

    create(): string {
        return this.path();
    }

    update(id: string | number): string {
        return this.path(String(id));
    }

    delete(id: string | number): string {
        return this.path(String(id));
    }

    search(query: string, params?: Record<string, string | number | boolean | undefined>): string {
        return this.withQuery(this.path('search', query), params);
    }
}

