import { group, check } from 'k6';
import { ScenarioBuilder } from '@libs/base/scenario-builder';
import { BaseHTTPClient } from '@libs/base/http-client';
import { BaseAuth } from '@libs/base/auth';
import { BaseTestData } from '@libs/base/test-data';
import { AuthEndpoints, CRUDEndpoints } from '@libs/base/endpoints';
import { defaultScenarioOptions, createThresholds, CommonThresholdPresets } from '@config/thresholds';
import { createTrend, createRate, getResponseDuration } from '@helper/metrics';
import { isStatus200, isStatus201, isStatus204 } from '@helper/http-check';
import { randomSleep } from '@helper/helpers';
export { handleSummary } from '@reporter';

const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
const BASE_URL = k6Env?.BASE_URL || 'http://localhost:3000';

const httpClient = new BaseHTTPClient({ baseURL: BASE_URL });
const auth = new BaseAuth(httpClient, { loginEndpoint: '/auth/login' });
const testData = new BaseTestData({
    users: {
        user: {
            email: k6Env?.TEST_EMAIL || 'user1@example.com',
            password: k6Env?.TEST_PASSWORD || 'password123',
        },
    },
});

const authEndpoints = new AuthEndpoints('/auth');
const postEndpoints = new CRUDEndpoints('posts', '/posts');

const apiDuration = createTrend('api_duration_ms');
const apiErrors = createRate('api_errors');

const THRESHOLDS = createThresholds({
    'api_duration_ms': ['p(95)<1000', 'p(99)<2000'],
    'api_errors': ['rate<0.01'],
}, CommonThresholdPresets.api);

export const options = ScenarioBuilder.performance(50, '5m')
    .setThresholds(THRESHOLDS)
    .setGlobalOptions(defaultScenarioOptions)
    .build();

function login(): string | null {
    try {
        const user = testData.getTestUser('user');
        const response = httpClient.post(authEndpoints.login(), {
            email: user.email,
            password: user.password,
        });

        const success = check(response, {
            'Login - status 200': (r) => isStatus200(r),
            'Login - has token': (r) => {
                try {
                    const data = (r.data || r.json()) as Record<string, unknown>;
                    const responseData = data?.data as Record<string, unknown> | undefined;
                    return responseData?.token !== undefined;
                } catch (e) {
                    return false;
                }
            },
        });

        if (success) {
            try {
                const data = (response.data || response.json()) as Record<string, unknown>;
                const responseData = data?.data as Record<string, unknown> | undefined;
                const token = responseData?.token as string;
                if (token) {
                    apiDuration.add(getResponseDuration(response));
                    return token;
                }
            } catch (e) {
                // Ignore
            }
        }
        
        apiErrors.add(true);
        return null;
    } catch (error) {
        apiErrors.add(true);
        return null;
    }
}

function createPost(token: string): number | null {
    if (!token) {
        return null;
    }

    try {
        const headers = auth.getAuthHeaders(token);
        const postData = {
            title: `Test Post ${Date.now()}`,
            content: 'This is a test post content',
        };

        const response = httpClient.post(postEndpoints.create(), postData, { headers });

        let postId: number | null = null;
        const success = check(response, {
            'Create Post - status 201': (r) => isStatus201(r),
            'Create Post - has id': (r) => {
                try {
                    const data = (r.data || r.json()) as Record<string, unknown>;
                    const postData = data?.data as Record<string, unknown> | undefined;
                    if (postData?.id) {
                        postId = Number(postData.id);
                        return true;
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            },
        });

        if (success && postId) {
            apiDuration.add(getResponseDuration(response));
            return postId;
        } else {
            apiErrors.add(true);
        }

        return null;
    } catch (error) {
        apiErrors.add(true);
        return null;
    }
}

function getPost(token: string, postId: number): boolean {
    if (!token || !postId) return false;

    try {
        const headers = auth.getAuthHeaders(token);
        const response = httpClient.get(postEndpoints.list(), { headers });

        const success = check(response, {
            'Get Posts - status 200': (r) => isStatus200(r),
            'Get Posts - has data': (r) => {
                try {
                    const data = (r.data || r.json()) as Record<string, unknown>;
                    const posts = data?.data as Array<Record<string, unknown>> | undefined;
                    if (posts && Array.isArray(posts)) {
                        return posts.some((post) => Number(post.id) === postId);
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            },
        });

        if (success) {
            apiDuration.add(getResponseDuration(response));
        } else {
            apiErrors.add(true);
        }

        return success;
    } catch (error) {
        apiErrors.add(true);
        return false;
    }
}

function updatePost(token: string, postId: number): boolean {
    if (!token || !postId) return false;

    try {
        const headers = auth.getAuthHeaders(token);
        const updateData = {
            title: `Updated Post ${Date.now()}`,
            content: 'This is updated content',
        };

        const response = httpClient.put(postEndpoints.update(postId), updateData, { headers });

        const success = check(response, {
            'Update Post - status 200': (r) => isStatus200(r) === true,
            'Update Post - updated': (r) => {
                try {
                    const data = (r.data || r.json()) as Record<string, unknown>;
                    const postData = data?.data as Record<string, unknown> | undefined;
                    return (postData && Number(postData.id) === postId) === true;
                } catch (e) {
                    return false;
                }
            },
        });

        if (success) {
            apiDuration.add(getResponseDuration(response));
        } else {
            apiErrors.add(true);
        }

        return success;
    } catch (error) {
        apiErrors.add(true);
        return false;
    }
}

function deletePost(token: string, postId: number): boolean {
    if (!token || !postId) return false;

    try {
        const headers = auth.getAuthHeaders(token);
        const response = httpClient.del(postEndpoints.delete(postId), null, { headers });

        const success = check(response, {
            'Delete Post - status 200/204': (r) => (isStatus200(r) || isStatus204(r)) === true,
        });

        if (success) {
            apiDuration.add(getResponseDuration(response));
        } else {
            apiErrors.add(true);
        }

        return success;
    } catch (error) {
        apiErrors.add(true);
        return false;
    }
}

export default function () {
    const token = login();
    if (!token) return;

    group('Post CRUD Tests', () => {
        const postId = createPost(token);
        if (postId) {
            getPost(token, postId);
            updatePost(token, postId);
            deletePost(token, postId);
        }
    });

    randomSleep(1, 2);
}
