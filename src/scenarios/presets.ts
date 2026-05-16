import { ScenarioConfig } from './scenario-builder';

/** Configuration shape for a named scenario preset. */
export interface ScenarioPreset {
    executor: ScenarioConfig['executor'];
    vus?: number;
    duration?: string;
    stages?: ScenarioConfig['stages'];
    gracefulStop?: string;
}

/** Predefined scenario configurations for common load test patterns (smoke, load, stress, spike, soak, etc.). */
export const ScenarioPresets = {
    smoke: {
        executor: 'constant-vus' as const,
        vus: 5,
        duration: '1m',
        gracefulStop: '10s',
    },
    performance: {
        executor: 'constant-vus' as const,
        vus: 50,
        duration: '5m',
        gracefulStop: '30s',
    },
    load: {
        executor: 'constant-vus' as const,
        vus: 80,
        duration: '10m',
        gracefulStop: '30s',
    },
    stress: {
        executor: 'ramping-vus' as const,
        stages: [
            { duration: '2m', target: 50 },
            { duration: '5m', target: 100 },
            { duration: '5m', target: 200 },
            { duration: '3m', target: 0 },
        ],
        gracefulStop: '30s',
    },
    spike: {
        executor: 'ramping-vus' as const,
        stages: [
            { duration: '1m', target: 50 },
            { duration: '30s', target: 500 },
            { duration: '1m', target: 500 },
            { duration: '30s', target: 50 },
            { duration: '7m', target: 50 },
        ],
        gracefulStop: '30s',
    },
    soak: {
        executor: 'constant-vus' as const,
        vus: 50,
        duration: '2h',
        gracefulStop: '1m',
    },
    capacity: {
        executor: 'ramping-vus' as const,
        stages: [
            { duration: '5m', target: 100 },
            { duration: '10m', target: 500 },
            { duration: '10m', target: 1000 },
            { duration: '5m', target: 0 },
        ],
        gracefulStop: '1m',
    },
    volume: {
        executor: 'shared-iterations' as const,
        iterations: 10000,
        vus: 100,
        gracefulStop: '30s',
    },
    throughput: {
        executor: 'constant-arrival-rate' as const,
        rate: 1000,
        timeUnit: '1s',
        duration: '5m',
        gracefulStop: '30s',
    },
};
