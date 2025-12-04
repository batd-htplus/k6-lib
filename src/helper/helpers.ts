import { sleep } from 'k6';

export function randomSleep(min: number, max: number): void {
    if (typeof min !== 'number' || typeof max !== 'number') {
        throw new Error('min and max must be numbers');
    }
    sleep(Math.random() * (max - min) + min);
}

export function fixedSleep(seconds: number): void {
    sleep(seconds);
}

export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

export function randomChoice<T>(array: T[]): T {
    if (array.length === 0) {
        throw new Error('Array is empty');
    }
    return array[Math.floor(Math.random() * array.length)];
}

export function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
}

export function getEnv(key: string, defaultValue?: string): string {
    const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
    const processEnv = typeof process !== 'undefined' 
        ? (process as { env?: Record<string, string | undefined> }).env 
        : undefined;
    
    const value = k6Env?.[key] || processEnv?.[key];
    return value || defaultValue || '';
}

export function isK6Cloud(): boolean {
    return getEnv('K6_CLOUD', 'false') === 'true';
}

