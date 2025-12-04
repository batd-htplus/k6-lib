export interface TestUser {
    email?: string;
    username?: string;
    password: string;
    role?: string;
    [key: string]: string | number | boolean | undefined;
}

export interface TestDataConfig {
    users?: Record<string, TestUser>;
    csvPath?: string;
    [key: string]: unknown;
}

export class BaseTestData {
    protected config: TestDataConfig;
    protected csvData: Array<Record<string, string>> | null = null;

    constructor(config?: TestDataConfig) {
        this.config = config || this.getDefaultConfig();
        this.loadUsersFromSource();
    }

    protected getDefaultConfig(): TestDataConfig {
        const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
        const userSource = k6Env?.TEST_USER_SOURCE || 'env';

        if (userSource === 'csv' && k6Env?.TEST_USERS_CSV) {
            return {
                csvPath: k6Env.TEST_USERS_CSV,
                users: {},
            };
        }

        return {
            users: {
                default: {
                    email: k6Env?.TEST_EMAIL || 'test@example.com',
                    password: k6Env?.TEST_PASSWORD || 'password123',
                },
            },
        };
    }

    protected loadUsersFromSource(): void {
        const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
        const userSource = k6Env?.TEST_USER_SOURCE || 'env';

        if (userSource === 'csv') {
            this.loadUsersFromCSV();
        } else {
            this.loadUsersFromEnv();
        }
    }

    protected loadUsersFromCSV(): void {
        try {
            const csvPath = this.config.csvPath || (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV?.TEST_USERS_CSV;
            if (!csvPath) {
                console.warn('CSV path not specified, falling back to env variables');
                this.loadUsersFromEnv();
                return;
            }

            const openFn = (globalThis as { open?: (path: string) => string }).open;
            if (!openFn) {
                console.warn('k6 open function not available, falling back to env variables');
                this.loadUsersFromEnv();
                return;
            }
            const csvContent = openFn(csvPath);
            if (!csvContent) {
                console.warn(`CSV file not found: ${csvPath}, falling back to env variables`);
                this.loadUsersFromEnv();
                return;
            }

            const lines = csvContent.split('\n');
            if (lines.length < 2) {
                console.warn('CSV file is empty or invalid, falling back to env variables');
                this.loadUsersFromEnv();
                return;
            }

            const headers = lines[0].split(',').map((h: string) => h.trim());
            const users: Record<string, TestUser> = {};

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = line.split(',').map((v: string) => v.trim());
                if (values.length !== headers.length) continue;

                const user: TestUser = {
                    password: '',
                };

                headers.forEach((header: string, index: number) => {
                    const value = values[index];
                    if (header.toLowerCase() === 'email') {
                        user.email = value;
                    } else if (header.toLowerCase() === 'username') {
                        user.username = value;
                    } else if (header.toLowerCase() === 'password') {
                        user.password = value;
                    } else if (header.toLowerCase() === 'role') {
                        user.role = value;
                    } else {
                        (user as Record<string, unknown>)[header] = value;
                    }
                });

                if (user.email || user.username) {
                    const key = user.email || user.username || `user_${i}`;
                    users[key] = user;
                }
            }

            if (Object.keys(users).length > 0) {
                this.config.users = users;
                console.log(`Loaded ${Object.keys(users).length} users from CSV: ${csvPath}`);
            } else {
                console.warn('No valid users found in CSV, falling back to env variables');
                this.loadUsersFromEnv();
            }
        } catch (error) {
            console.warn(`Error loading CSV: ${error}, falling back to env variables`);
            this.loadUsersFromEnv();
        }
    }

    protected loadUsersFromEnv(): void {
        const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
        if (!k6Env) return;

        const users: Record<string, TestUser> = {};

        if (k6Env.TEST_EMAIL && k6Env.TEST_PASSWORD) {
            users.user = {
                email: k6Env.TEST_EMAIL,
                password: k6Env.TEST_PASSWORD,
            };
        }

        if (Object.keys(users).length > 0) {
            this.config.users = users;
        }
    }

    getTestUser(key: string = 'default'): TestUser {
        const user = this.config.users?.[key];
        if (!user) {
            throw new Error(`Test user '${key}' not found`);
        }
        return user;
    }

    getAllUsers(): Record<string, TestUser> {
        return this.config.users || {};
    }

    setTestUser(key: string, user: TestUser): void {
        if (!this.config.users) {
            this.config.users = {};
        }
        this.config.users[key] = user;
    }

    getRandomUser(): TestUser {
        const users = Object.values(this.config.users || {});
        if (users.length === 0) {
            throw new Error('No test users available');
        }
        const randomIndex = Math.floor(Math.random() * users.length);
        return users[randomIndex];
    }

    generateRandomEmail(domain: string = 'test.com'): string {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `test_${timestamp}_${random}@${domain}`;
    }

    generateRandomString(length: number = 10): string {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    getCustomData(key: string): unknown {
        return this.config[key];
    }

    setCustomData(key: string, value: unknown): void {
        this.config[key] = value;
    }

    generateMultipleUsers(count: number, prefix: string = 'user'): Record<string, TestUser> {
        const users: Record<string, TestUser> = {};
        for (let i = 1; i <= count; i++) {
            const key = `${prefix}_${i}`;
            users[key] = {
                email: this.generateRandomEmail(),
                password: this.generateRandomString(12),
                role: prefix,
            };
        }
        return users;
    }
}

