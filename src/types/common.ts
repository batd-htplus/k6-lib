/**
 * Common Type Definitions
 */

/** k6 environment variables dictionary. */
export interface K6Env {
    [key: string]: string | undefined;
}

/** Node.js process environment variables dictionary. */
export interface ProcessEnv {
    [key: string]: string | undefined;
}

declare global {
    interface GlobalThis {
        __ENV?: K6Env;
    }
}

/** Represents an HTTP response from a k6 HTTP request. */
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

/** Statistical values for a k6 metric (count, rate, avg, percentiles). */
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

/** A single k6 metric containing its statistical values. */
export interface K6Metric {
    values: K6MetricValues;
}

/** Raw summary data structure produced by k6 at the end of a test run. */
export interface K6SummaryData {
    metrics?: Record<string, K6Metric>;
    state?: {
        testRunDurationMs?: number;
        [key: string]: unknown;
    };
}

/** Simplified, human-readable summary of k6 test results. */
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

/** Generic record with unknown values. */
export type UnknownRecord = Record<string, unknown>;
/** Generic record with string values. */
export type StringRecord = Record<string, string>;
/** Placeholder for an unknown value type. */
export type UnknownValue = unknown;

