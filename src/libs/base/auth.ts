import { BaseHTTPClient } from './http-client';

export interface AuthCredentials {
    email?: string;
    username?: string;
    password: string;
    [key: string]: string | number | boolean | undefined;
}

export interface AuthToken {
    accessToken?: string;
    access_token?: string;
    token?: string;
    refreshToken?: string;
    refresh_token?: string;
    expiresIn?: number;
    expires_in?: number;
    [key: string]: string | number | boolean | undefined;
}

export interface AuthResponse {
    success: boolean;
    token?: AuthToken;
    user?: Record<string, unknown>;
    error?: string;
}

export class BaseAuth {
    protected httpClient: BaseHTTPClient;
    protected tokenCache: Map<string, AuthToken> = new Map();
    protected loginEndpoint: string;
    protected tokenKey: string;

    constructor(httpClient: BaseHTTPClient, config?: {
        loginEndpoint?: string;
        tokenKey?: string;
    }) {
        this.httpClient = httpClient;
        this.loginEndpoint = config?.loginEndpoint || '/auth/login';
        this.tokenKey = config?.tokenKey || 'access_token';
    }

    login(credentials: AuthCredentials, cacheKey?: string): AuthToken | null {
        if (cacheKey) {
            const cached = this.getCachedToken(cacheKey);
            if (cached) return cached;
        }

        try {
            const response = this.httpClient.post(this.loginEndpoint, credentials);
            
            if (!this.httpClient.isSuccess(response)) {
                console.error(`Login failed: ${response.status} - ${response.body}`);
                return null;
            }

            const data = response.data ?? (response.json ? response.json() : null);
            if (!data) return null;
            const token = this.extractToken(data);
            
            if (token && cacheKey) {
                this.tokenCache.set(cacheKey, token);
            }

            return token;
        } catch (error) {
            console.error('Login error:', error);
            return null;
        }
    }

    protected extractToken(data: unknown): AuthToken | null {
        if (!data || typeof data !== 'object') return null;
        const obj = data as Record<string, unknown>;
        
        // Check top-level token fields
        if (obj.access_token || obj.accessToken) {
            return {
                accessToken: (obj.access_token || obj.accessToken) as string,
                refreshToken: (obj.refresh_token || obj.refreshToken) as string | undefined,
                expiresIn: (obj.expires_in || obj.expiresIn) as number | undefined,
            };
        }

        if (obj.token) {
            return { token: obj.token as string };
        }

        // Check nested data object
        const dataObj = obj.data as Record<string, unknown> | undefined;
        if (dataObj) {
            // Check for access_token/accessToken in data
            if (dataObj.access_token || dataObj.accessToken) {
                return {
                    accessToken: (dataObj.access_token || dataObj.accessToken) as string,
                    refreshToken: (dataObj.refresh_token || dataObj.refreshToken) as string | undefined,
                };
            }
            
            // Check for token in data (for project_example API format)
            if (dataObj.token) {
                return { token: dataObj.token as string };
            }
        }

        return null;
    }

    getCachedToken(cacheKey: string): AuthToken | null {
        return this.tokenCache.get(cacheKey) || null;
    }

    getCachedTokenString(cacheKey: string): string | null {
        const token = this.tokenCache.get(cacheKey);
        if (!token) return null;
        return token.accessToken || token.access_token || token.token || null;
    }

    getAuthHeaders(token: AuthToken | string | null): Record<string, string> {
        if (!token) {
            return {};
        }

        const tokenString = typeof token === 'string' 
            ? token 
            : token.accessToken || token.access_token || token.token || '';

        if (!tokenString) {
            return {};
        }

        return {
            'Authorization': `Bearer ${tokenString}`,
        };
    }

    loginAndGetToken(credentials: AuthCredentials, cacheKey?: string): string | null {
        if (cacheKey) {
            const cached = this.getCachedTokenString(cacheKey);
            if (cached) return cached;
        }

        const token = this.login(credentials, cacheKey);
        if (!token) return null;

        return token.accessToken || token.access_token || token.token || null;
    }

    loginMultipleUsers(users: Array<{ key: string; credentials: AuthCredentials }>): Record<string, string> {
        const tokens: Record<string, string> = {};
        users.forEach(({ key, credentials }) => {
            const token = this.loginAndGetToken(credentials, key);
            if (token) {
                tokens[key] = token;
            }
        });
        return tokens;
    }

    logout(token: AuthToken | string, logoutEndpoint?: string): boolean {
        try {
            const headers = this.getAuthHeaders(token);
            const endpoint = logoutEndpoint || '/auth/logout';
            const response = this.httpClient.post(endpoint, null, { headers });
            return this.httpClient.isSuccess(response);
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    refreshToken(refreshToken: string, refreshEndpoint?: string): AuthToken | null {
        try {
            const endpoint = refreshEndpoint || '/auth/refresh';
            const response = this.httpClient.post(endpoint, { refresh_token: refreshToken });
            
            if (!this.httpClient.isSuccess(response)) {
                return null;
            }

            const data = response.data ?? (response.json ? response.json() : null);
            if (!data) return null;
            return this.extractToken(data);
        } catch (error) {
            console.error('Refresh token error:', error);
            return null;
        }
    }

    clearCache(): void {
        this.tokenCache.clear();
    }

    getCacheSize(): number {
        return this.tokenCache.size;
    }
}

