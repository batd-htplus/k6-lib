import { sleep } from 'k6';
import { env as getEnv } from '../config/env';
export { getEnv };

/** Pauses execution for a random duration between min and max seconds (inclusive). */
export function randomSleep(min: number, max: number): void {
    if (typeof min !== 'number' || typeof max !== 'number') {
        throw new Error('min and max must be numbers');
    }
    sleep(Math.random() * (max - min) + min);
}

/** Pauses execution for a fixed duration in seconds. */
export function fixedSleep(seconds: number): void {
    sleep(seconds);
}

/** Returns a random integer in the range [min, max] (inclusive). */
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Returns a random float in the range [min, max). */
export function randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

/** Returns a random element from a non-empty array. */
export function randomChoice<T>(array: T[]): T {
    if (array.length === 0) {
        throw new Error('Array is empty');
    }
    return array[Math.floor(Math.random() * array.length)];
}

/** Returns a new array with the elements in random order (Fisher-Yates shuffle). */
export function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/** Formats a millisecond duration into a human-readable string (ms/s/m/h). */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
    return `${(ms / 3600000).toFixed(2)}h`;
}

/** Returns true when running in the k6 Cloud environment (K6_CLOUD=true). */
export function isK6Cloud(): boolean {
    return getEnv('K6_CLOUD', 'false') === 'true';
}

