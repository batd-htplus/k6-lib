declare module 'k6' {
    export  function check<T>(val: T, sets: Record<string, (arg: T) => boolean>): boolean;
    export  function sleep(seconds: number): void;
    export function group(name: string, fn: () => void): void;
    export function open(filePath: string): string;

    export interface Options {
        vus?: number;
        duration?: string;
        iterations?: number;
        setupTimeout?: string;
        teardownTimeout?: string;
        noConnectionReuse?: boolean;
        batch?: number;
        batchPerHost?: number;
        discardResponseBodies?: boolean;
        summaryTrendStats?: string[];
        summaryTimeUnit?: string;
        thresholds?: {
            [key: string]: string[];
        };
        stages?: Array<{
            duration: string;
            target: number;
        }>;
        tags?: {
            [key: string]: string;
        };
        scenarios?: {
            [key: string]: {
                executor?: string;
                vus?: number;
                duration?: string;
                iterations?: number;
                maxVUs?: number;
                stages?: Array<{ duration: string; target: number }>;
                rate?: number;
                timeUnit?: string;
                preAllocatedVUs?: number;
                gracefulStop?: string;
                tags?: Record<string, string>;
                [key: string]: unknown;
            };
        };
    }

    export interface Metric {
        values: {
            [key: string]: number | undefined;
        };
    }

    export interface Data {
        metrics: {
            [key: string]: Metric;
        };
        state: {
            [key: string]: unknown;
        };
    }
}

declare function handleSummary(data: {
    metrics?: {
        [key: string]: {
            values: {
                [key: string]: number | undefined;
            };
        };
    };
    state?: {
        [key: string]: unknown;
    };
}): Record<string, string>;

// For http module
declare module 'k6/http' {
    export interface Response {
        status: number;
        body: string;
        headers: Record<string, string>;
        json(): unknown;
        timings: {
            duration: number;
            [key: string]: number;
        };
    }

    export function get(url: string, params?: Record<string, unknown>): Response;
    export function post(url: string, body?: string | unknown, params?: Record<string, unknown>): Response;
    export function del(url: string, body?: string | unknown, params?: Record<string, unknown>): Response;
    export function put(url: string, body?: string | unknown, params?: Record<string, unknown>): Response;
    export function patch(url: string, body?: string | unknown, params?: Record<string, unknown>): Response;
    export function head(url: string, params?: Record<string, unknown>): Response;
    export function options(url: string, params?: Record<string, unknown>): Response;
}

declare module 'k6/metrics' {
    export class Rate {
        constructor(name: string);
        add(value: boolean): void;
    }

    export class Trend {
        constructor(name: string);
        add(value: number): void;
    }
}
