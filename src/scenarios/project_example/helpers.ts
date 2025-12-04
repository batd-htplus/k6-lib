import { check } from 'k6';
import { BaseHTTPClient } from '@libs/base/http-client';
import { BaseAuth } from '@libs/base/auth';
import { BaseTestData } from '@libs/base/test-data';
import { AuthEndpoints, CRUDEndpoints } from '@libs/base/endpoints';
import { createTrend, createRate, getResponseDuration } from '@helper/metrics';
import { isStatus200, isStatus201, isStatus204 } from '@helper/http-check';
import { projectConfig } from './config';

export interface TestHelpers {
    httpClient: BaseHTTPClient;
    auth: BaseAuth;
    testData: BaseTestData;
    authEndpoints: AuthEndpoints;
    postEndpoints: CRUDEndpoints;
    apiDuration: ReturnType<typeof createTrend>;
    apiErrors: ReturnType<typeof createRate>;
}

export function createTestHelpers(): TestHelpers {
    const httpClient = new BaseHTTPClient({ baseURL: projectConfig.baseURL });
    const auth = new BaseAuth(httpClient, { loginEndpoint: projectConfig.auth.loginEndpoint });
    const testData = new BaseTestData({ users: projectConfig.testUsers });
    const authEndpoints = new AuthEndpoints('/auth');
    const postEndpoints = new CRUDEndpoints('posts', projectConfig.endpoints.posts);
    const apiDuration = createTrend('api_duration_ms');
    const apiErrors = createRate('api_errors');

    return {
        httpClient,
        auth,
        testData,
        authEndpoints,
        postEndpoints,
        apiDuration,
        apiErrors,
    };
}

export function login(helpers: TestHelpers): string | null {
    try {
        const user = helpers.testData.getTestUser('user');
        const response = helpers.httpClient.post(helpers.authEndpoints.login(), {
            email: user.email,
            password: user.password,
        });

        if (!isStatus200(response)) {
            console.error(`Login failed: Status ${response.status}, Body: ${response.body.substring(0, 200)}`);
        }

        const success = check(response, {
            'Login - status 200': (r) => isStatus200(r),
            'Login - has token': (r) => {
                try {
                    const data = (r.data || r.json()) as Record<string, unknown>;
                    const responseData = data?.data as Record<string, unknown> | undefined;
                    return responseData?.token !== undefined;
                } catch {
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
                    helpers.apiDuration.add(getResponseDuration(response));
                    return token;
                }
            } catch {
                // Ignore
            }
        }

        helpers.apiErrors.add(true);
        return null;
    } catch {
        helpers.apiErrors.add(true);
        return null;
    }
}

export function createPost(helpers: TestHelpers, token: string): number | null {
    if (!token) return null;

    try {
        const headers = helpers.auth.getAuthHeaders(token);
        const postData = {
            title: `Test Post ${Date.now()}`,
            content: 'This is a test post content',
        };

        const response = helpers.httpClient.post(helpers.postEndpoints.create(), postData, { headers });

        if (!isStatus201(response)) {
            console.error(`Create Post failed: Status ${response.status}, Body: ${response.body.substring(0, 200)}`);
        }

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
                } catch {
                    return false;
                }
            },
        });

        if (success && postId) {
            helpers.apiDuration.add(getResponseDuration(response));
            return postId;
        }

        helpers.apiErrors.add(true);
        return null;
    } catch {
        helpers.apiErrors.add(true);
        return null;
    }
}

export function getPost(helpers: TestHelpers, token: string, postId: number): boolean {
    if (!token || !postId) return false;

    try {
        const headers = helpers.auth.getAuthHeaders(token);
        const response = helpers.httpClient.get(helpers.postEndpoints.list(), { headers });

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
                } catch {
                    return false;
                }
            },
        });

        if (success) {
            helpers.apiDuration.add(getResponseDuration(response));
        } else {
            helpers.apiErrors.add(true);
        }

        return success;
    } catch {
        helpers.apiErrors.add(true);
        return false;
    }
}

export function updatePost(helpers: TestHelpers, token: string, postId: number): boolean {
    if (!token || !postId) return false;

    try {
        const headers = helpers.auth.getAuthHeaders(token);
        const updateData = {
            title: `Updated Post ${Date.now()}`,
            content: 'This is updated content',
        };

        const response = helpers.httpClient.put(helpers.postEndpoints.update(postId), updateData, { headers });

        const success = check(response, {
            'Update Post - status 200': (r) => isStatus200(r),
            'Update Post - updated': (r) => {
                try {
                    const data = (r.data || r.json()) as Record<string, unknown>;
                    const postData = data?.data as Record<string, unknown> | undefined;
                    return !!(postData && Number(postData.id) === postId);
                } catch {
                    return false;
                }
            },
        });

        if (success) {
            helpers.apiDuration.add(getResponseDuration(response));
        } else {
            helpers.apiErrors.add(true);
        }

        return success;
    } catch {
        helpers.apiErrors.add(true);
        return false;
    }
}

export function deletePost(helpers: TestHelpers, token: string, postId: number): boolean {
    if (!token || !postId) return false;

    try {
        const headers = helpers.auth.getAuthHeaders(token);
        const response = helpers.httpClient.del(helpers.postEndpoints.delete(postId), null, { headers });

        const success = check(response, {
            'Delete Post - status 200/204': (r) => isStatus200(r) || isStatus204(r),
        });

        if (success) {
            helpers.apiDuration.add(getResponseDuration(response));
        } else {
            helpers.apiErrors.add(true);
        }

        return success;
    } catch {
        helpers.apiErrors.add(true);
        return false;
    }
}

