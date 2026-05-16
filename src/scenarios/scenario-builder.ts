import type { Options } from 'k6/options';

/** Configuration for a single k6 scenario, supporting all built-in executors. */
export interface ScenarioConfig {
    name: string;
    executor: 'constant-vus' | 'ramping-vus' | 'shared-iterations' | 'per-vu-iterations' | 'constant-arrival-rate' | 'ramping-arrival-rate';
    vus?: number;
    duration?: string;
    iterations?: number;
    maxVUs?: number;
    stages?: Array<{ duration: string; target: number }>;
    startRate?: number;
    rate?: number;
    timeUnit?: string;
    preAllocatedVUs?: number;
    gracefulStop?: string;
    tags?: Record<string, string>;
    [key: string]: unknown;
}

/** Partial k6 options configuration used to build full k6/options. */
export interface TestOptionsConfig {
    scenarios?: Record<string, ScenarioConfig>;
    thresholds?: Record<string, (string | { threshold: string; abortOnFail?: boolean; delayAbortEval?: string })[]>;
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
    tags?: Record<string, string>;
}

/**
 * Fluent builder for constructing k6 test option configurations with multiple scenarios.
 * Provides convenience methods for common executor types and preset static factories.
 */
export class ScenarioBuilder {
    private config: TestOptionsConfig;

    constructor() {
        this.config = {};
    }

    /** Registers a scenario config under its name. Returns the builder for chaining. */
    addScenario(scenario: ScenarioConfig): this {
        if (!this.config.scenarios) {
            this.config.scenarios = {};
        }
        this.config.scenarios[scenario.name] = scenario;
        return this;
    }

    /** Adds a constant-VUs scenario. */
    addConstantVUS(name: string, vus: number, duration: string, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({ name, executor: 'constant-vus', vus, duration, ...options });
    }

    /** Adds a ramping-VUs scenario with specified stages. */
    addRampingVUS(name: string, stages: Array<{ duration: string; target: number }>, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({ name, executor: 'ramping-vus', stages, ...options });
    }

    /** Adds a shared-iterations scenario. */
    addSharedIterations(name: string, iterations: number, vus: number, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({ name, executor: 'shared-iterations', iterations, vus, ...options });
    }

    /** Adds a per-VU-iterations scenario. */
    addPerVUIterations(name: string, iterations: number, vus: number, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({ name, executor: 'per-vu-iterations', iterations, vus, ...options });
    }

    /** Adds a constant-arrival-rate scenario. */
    addConstantArrivalRate(name: string, rate: number, duration: string, timeUnit?: string, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({ name, executor: 'constant-arrival-rate', rate, duration, timeUnit: timeUnit || '1s', ...options });
    }

    /** Adds a ramping-arrival-rate scenario. */
    addRampingArrivalRate(name: string, stages: Array<{ duration: string; target: number }>, timeUnit?: string, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({ name, executor: 'ramping-arrival-rate', stages, timeUnit: timeUnit || '1s', ...options });
    }

    /** Sets threshold expressions for the test. Returns the builder for chaining. */
    setThresholds(thresholds: Record<string, (string | { threshold: string; abortOnFail?: boolean; delayAbortEval?: string })[]>): this {
        this.config.thresholds = thresholds;
        return this;
    }

    /** Merges global k6 options into the config. Returns the builder for chaining. */
    setGlobalOptions(options: Partial<TestOptionsConfig>): this {
        Object.assign(this.config, options);
        return this;
    }

    /** Builds and returns the final k6 Options object. */
    build(): Options {
        const options: Options = { ...this.config } as Options;

        if (this.config.scenarios) {
            const scenarios: NonNullable<Options['scenarios']> = {};
            Object.entries(this.config.scenarios).forEach(([name, scenario]) => {
                const { name: _, ...scenarioConfig } = scenario;
                scenarios[name] = scenarioConfig as NonNullable<Options['scenarios']>[string];
            });
            options.scenarios = scenarios;
        }

        return options;
    }

    /** Creates a preset performance test scenario. */
    static performance(vus: number = 50, duration: string = '5m'): ScenarioBuilder {
        return new ScenarioBuilder().addConstantVUS('performance', vus, duration, { gracefulStop: '30s' });
    }

    /** Creates a preset load test scenario. */
    static load(vus: number = 80, duration: string = '10m'): ScenarioBuilder {
        return new ScenarioBuilder().addConstantVUS('load', vus, duration, { gracefulStop: '30s' });
    }

    /** Creates a preset stress test scenario with ramping VUs. */
    static stress(maxVUs: number = 200): ScenarioBuilder {
        return new ScenarioBuilder().addRampingVUS('stress', [
            { duration: '2m', target: 50 },
            { duration: '5m', target: 100 },
            { duration: '5m', target: maxVUs },
            { duration: '3m', target: 0 },
        ], { gracefulStop: '30s' });
    }

    /** Creates a preset spike test scenario with sudden traffic surge. */
    static spike(maxVUs: number = 500): ScenarioBuilder {
        return new ScenarioBuilder().addRampingVUS('spike', [
            { duration: '1m', target: 50 },
            { duration: '30s', target: maxVUs },
            { duration: '1m', target: maxVUs },
            { duration: '30s', target: 50 },
            { duration: '7m', target: 50 },
        ], { gracefulStop: '30s' });
    }

    /** Creates a combined preset with concurrent performance and load scenarios. */
    static combined(performanceVUs: number = 50, loadVUs: number = 80): ScenarioBuilder {
        return new ScenarioBuilder()
            .addConstantVUS('performance', performanceVUs, '5m', { gracefulStop: '30s' })
            .addConstantVUS('load', loadVUs, '10m', { gracefulStop: '30s' });
    }

    /** Creates a preset soak (endurance) test scenario. */
    static soak(vus: number = 50, duration: string = '2h'): ScenarioBuilder {
        return new ScenarioBuilder().addConstantVUS('soak', vus, duration, { gracefulStop: '1m' });
    }

    /** Creates a preset smoke test scenario with minimal load. */
    static smoke(vus: number = 5, duration: string = '1m'): ScenarioBuilder {
        return new ScenarioBuilder().addConstantVUS('smoke', vus, duration, { gracefulStop: '10s' });
    }

    /** Creates a preset volume test scenario with shared iterations. */
    static volume(iterations: number = 10000, vus: number = 100): ScenarioBuilder {
        return new ScenarioBuilder().addSharedIterations('volume', iterations, vus, { gracefulStop: '30s' });
    }

    /** Creates a preset capacity test scenario with ramping VUs. */
    static capacity(maxVUs: number = 1000, duration: string = '30m'): ScenarioBuilder {
        return new ScenarioBuilder().addRampingVUS('capacity', [
            { duration: '5m', target: 100 },
            { duration: '10m', target: 500 },
            { duration: '10m', target: maxVUs },
            { duration: '5m', target: 0 },
        ], { gracefulStop: '1m' });
    }

    /** Creates a preset throughput test scenario with constant arrival rate. */
    static throughput(rate: number = 1000, duration: string = '5m', timeUnit: string = '1s'): ScenarioBuilder {
        return new ScenarioBuilder().addConstantArrivalRate('throughput', rate, duration, timeUnit, {
            preAllocatedVUs: 20,
            maxVUs: rate * 2,
        });
    }
}
