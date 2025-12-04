/**
 * Common Type Definitions
 */

// Environment variables
export interface K6Env {
    [key: string]: string | undefined;
}

export interface ProcessEnv {
    [key: string]: string | undefined;
}

declare global {
    interface GlobalThis {
        __ENV?: K6Env;
    }
}

// Response types
export interface K6Response {
    status: number;
    body: string;
    headers: Record<string, string>;
    timings?: {
        duration: number;
        [key: string]: number;
    };
    url?: string;
    proto?: string;
    json?(): unknown;
}

// k6 Summary Data types
export interface K6MetricValues {
    count?: number;
    rate?: number;
    avg?: number;
    min?: number;
    med?: number;
    max?: number;
    'p(90)'?: number;
    'p(95)'?: number;
    'p(99)'?: number;
    [key: string]: number | undefined;
}

export interface K6Metric {
    values: K6MetricValues;
}

export interface K6SummaryData {
    metrics?: Record<string, K6Metric>;
    state?: {
        testRunDurationMs?: number;
        [key: string]: unknown;
    };
}

export interface K6Summary {
    testDuration: number;
    totalRequests: number;
    failedRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    iterations: number;
    vus: number;
    trends: Array<{
        name: string;
        avg: number;
        p95: number;
        count: number;
    }>;
}

// Generic types
export type UnknownRecord = Record<string, unknown>;
export type StringRecord = Record<string, string>;
export type UnknownValue = unknown;

