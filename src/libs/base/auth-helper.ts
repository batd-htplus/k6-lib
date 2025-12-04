import { BaseAuth, AuthCredentials } from './auth';
import { BaseTestData, TestUser } from './test-data';

export interface UserTokenMap {
    [userKey: string]: string;
}

export class AuthHelper {
    private auth: BaseAuth;
    private testData: BaseTestData;

    constructor(auth: BaseAuth, testData: BaseTestData) {
        this.auth = auth;
        this.testData = testData;
    }

    loginUser(userKey: string): string | null {
        const user = this.testData.getTestUser(userKey);
        return this.auth.loginAndGetToken({
            email: user.email,
            username: user.username,
            password: user.password,
        }, userKey);
    }

    loginMultipleUsers(userKeys: string[]): UserTokenMap {
        const tokens: UserTokenMap = {};
        userKeys.forEach(key => {
            const token = this.loginUser(key);
            if (token) {
                tokens[key] = token;
            }
        });
        return tokens;
    }

    loginAllUsers(): UserTokenMap {
        const allUsers = this.testData.getAllUsers();
        return this.loginMultipleUsers(Object.keys(allUsers));
    }

    getAuthHeadersForUser(userKey: string): Record<string, string> {
        const token = this.auth.getCachedTokenString(userKey) || this.loginUser(userKey);
        return this.auth.getAuthHeaders(token);
    }

    getRandomUserToken(): string | null {
        const userKeys = Object.keys(this.testData.getAllUsers());
        if (userKeys.length === 0) return null;
        const randomKey = userKeys[Math.floor(Math.random() * userKeys.length)];
        return this.loginUser(randomKey);
    }

    preloadTokens(userKeys: string[]): UserTokenMap {
        return this.loginMultipleUsers(userKeys);
    }
}

