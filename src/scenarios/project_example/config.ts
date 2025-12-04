import { getEnv } from '@helper/helpers';
import { VUConfig as DefaultVUConfig, VUConfigType } from '@config/thresholds';

const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;

export const projectConfig = {
    baseURL: k6Env?.BASE_URL || getEnv('BASE_URL', 'http://localhost:3000'),
    auth: {
        loginEndpoint: '/auth/login',
        logoutEndpoint: '/auth/logout',
    },
    endpoints: {
        posts: '/posts',
    },
    testUsers: {
        user: {
            email: k6Env?.TEST_EMAIL || getEnv('TEST_EMAIL', 'user1@example.com'),
            password: k6Env?.TEST_PASSWORD || getEnv('TEST_PASSWORD', 'password123'),
        },
    },
    vuConfig: {
        // Override VU config for this project if needed
        // If not specified, will use defaults from thresholds.ts
        // smoke: { vus: 5, duration: '1m' },
        // performance: { vus: 50, duration: '5m' },
        // load: { vus: 80, duration: '10m' },
        // stress: { vus: 200, duration: '15m' },
        // spike: { vus: 500, duration: '10m' },
        // soak: { vus: 50, duration: '2h' },
    } as VUConfigType,
};

export function getVUConfig(testType: keyof VUConfigType): { vus: number; duration: string } {
    return projectConfig.vuConfig[testType] || DefaultVUConfig[testType];
}

