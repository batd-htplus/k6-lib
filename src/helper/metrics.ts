import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { K6Response } from '../types/common';

/** Creates a k6 Trend metric for tracking duration-based values. */
export const createTrend = (name: string): Trend => new Trend(name);
/** Creates a k6 Rate metric for tracking pass/fail ratios. */
export const createRate = (name: string): Rate => new Rate(name);
/** Creates a k6 Counter metric for accumulating integer values. */
export const createCounter = (name: string): Counter => new Counter(name);
/** Creates a k6 Gauge metric for tracking point-in-time values. */
export const createGauge = (name: string): Gauge => new Gauge(name);

/** Extracts the response duration from a k6 response object, falling back to 0. */
export const getResponseDuration = (response: K6Response): number => {
    if (!response?.timings) return 0;
    return response.timings.duration || 0;
};

/** Extracts the response body length from a k6 response object, falling back to 0. */
export const getResponseSize = (response: K6Response): number => {
    if (!response) return 0;
    return response.body?.length || 0;
};

/** Records a value to a k6 metric, dispatching add() according to the metric type. */
export const trackMetric = (
    metric: Trend | Rate | Counter | Gauge,
    value: number | boolean
): void => {
    if (metric instanceof Trend) {
        metric.add(value as number);
    } else if (metric instanceof Rate) {
        metric.add(value as boolean);
    } else if (metric instanceof Counter) {
        metric.add(value as number);
    } else if (metric instanceof Gauge) {
        metric.add(value as number);
    }
};

/** A collection of named k6 metrics, typically including a duration Trend and an error Rate. */
export interface MetricSet {
    duration: Trend;
    errorRate: Rate;
    [key: string]: Trend | Rate | Counter | Gauge;
}

/** Creates a standard MetricSet with a duration Trend and error Rate, both prefixed with the given name. */
export const createMetricSet = (prefix: string): MetricSet => {
    return {
        duration: createTrend(`${prefix}_duration_ms`),
        errorRate: createRate(`${prefix}_errors`),
    };
};

