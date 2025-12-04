import { Trend, Rate, Counter, Gauge } from 'k6/metrics';
import { K6Response } from '../types/common';

export const createTrend = (name: string): Trend => new Trend(name);
export const createRate = (name: string): Rate => new Rate(name);
export const createCounter = (name: string): Counter => new Counter(name);
export const createGauge = (name: string): Gauge => new Gauge(name);

export const getResponseDuration = (response: K6Response): number => {
    if (!response?.timings) return 0;
    return response.timings.duration || 0;
};

export const getResponseSize = (response: K6Response): number => {
    if (!response) return 0;
    return response.body?.length || 0;
};

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

export interface MetricSet {
    duration: Trend;
    errorRate: Rate;
    [key: string]: Trend | Rate | Counter | Gauge;
}

export const createMetricSet = (prefix: string): MetricSet => {
    return {
        duration: createTrend(`${prefix}_duration_ms`),
        errorRate: createRate(`${prefix}_errors`),
    };
};

