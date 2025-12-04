import { getEnv } from '../helper/helpers';

export interface ProjectConfig {
    baseURL: string;
    apiVersion?: string;
    timeout?: string;
    testUsers?: Record<string, {
        email?: string;
        username?: string;
        password: string;
        role?: string;
    }>;
    endpoints?: {
        auth?: string;
        [key: string]: string | undefined;
    };
}

export function getProjectConfig(): ProjectConfig {
    return {
        baseURL: getEnv('BASE_URL', 'http://localhost:3000'),
        apiVersion: getEnv('API_VERSION', 'v1'),
        timeout: getEnv('TIMEOUT', '30s'),
        testUsers: {
            default: {
                email: getEnv('TEST_EMAIL', 'test@example.com'),
                password: getEnv('TEST_PASSWORD', 'password123'),
            },
        },
        endpoints: {
            auth: getEnv('AUTH_ENDPOINT', '/api/auth'),
        },
    };
}


