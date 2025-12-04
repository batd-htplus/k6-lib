import { Options } from 'k6';
import { Thresholds } from '../../config/thresholds';

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

export interface TestOptionsConfig {
    scenarios?: Record<string, ScenarioConfig>;
    thresholds?: Thresholds;
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

export class ScenarioBuilder {
    private config: TestOptionsConfig;

    constructor() {
        this.config = {};
    }

    addScenario(scenario: ScenarioConfig): this {
        if (!this.config.scenarios) {
            this.config.scenarios = {};
        }
        this.config.scenarios[scenario.name] = scenario;
        return this;
    }

    addConstantVUS(name: string, vus: number, duration: string, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({
            name,
            executor: 'constant-vus',
            vus,
            duration,
            ...options,
        });
    }

    addRampingVUS(name: string, stages: Array<{ duration: string; target: number }>, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({
            name,
            executor: 'ramping-vus',
            stages,
            ...options,
        });
    }

    addSharedIterations(name: string, iterations: number, vus: number, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({
            name,
            executor: 'shared-iterations',
            iterations,
            vus,
            ...options,
        });
    }

    addPerVUIterations(name: string, iterations: number, vus: number, options?: Partial<ScenarioConfig>): this {
        return this.addScenario({
            name,
            executor: 'per-vu-iterations',
            iterations,
            vus,
            ...options,
        });
    }

    addConstantArrivalRate(
        name: string,
        rate: number,
        duration: string,
        timeUnit?: string,
        options?: Partial<ScenarioConfig>
    ): this {
        return this.addScenario({
            name,
            executor: 'constant-arrival-rate',
            rate,
            duration,
            timeUnit: timeUnit || '1s',
            ...options,
        });
    }

    addRampingArrivalRate(
        name: string,
        stages: Array<{ duration: string; target: number }>,
        timeUnit?: string,
        options?: Partial<ScenarioConfig>
    ): this {
        return this.addScenario({
            name,
            executor: 'ramping-arrival-rate',
            stages,
            timeUnit: timeUnit || '1s',
            ...options,
        });
    }

    setThresholds(thresholds: Thresholds): this {
        this.config.thresholds = thresholds;
        return this;
    }

    setGlobalOptions(options: Partial<TestOptionsConfig>): this {
        Object.assign(this.config, options);
        return this;
    }

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

    static performance(vus: number = 50, duration: string = '5m'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addConstantVUS('performance', vus, duration, { gracefulStop: '30s' });
    }

    static load(vus: number = 80, duration: string = '10m'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addConstantVUS('load', vus, duration, { gracefulStop: '30s' });
    }

    static stress(maxVUs: number = 200, duration: string = '15m'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addRampingVUS('stress', [
                { duration: '2m', target: 50 },
                { duration: '5m', target: 100 },
                { duration: '5m', target: maxVUs },
                { duration: '3m', target: 0 },
            ], { gracefulStop: '30s' });
    }

    static spike(maxVUs: number = 500, duration: string = '10m'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addRampingVUS('spike', [
                { duration: '1m', target: 50 },
                { duration: '30s', target: maxVUs },
                { duration: '1m', target: maxVUs },
                { duration: '30s', target: 50 },
                { duration: '7m', target: 50 },
            ], { gracefulStop: '30s' });
    }

    static combined(performanceVUs: number = 50, loadVUs: number = 80): ScenarioBuilder {
        return new ScenarioBuilder()
            .addConstantVUS('performance', performanceVUs, '5m', { gracefulStop: '30s' })
            .addConstantVUS('load', loadVUs, '10m', { gracefulStop: '30s' });
    }

    static soak(vus: number = 50, duration: string = '2h'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addConstantVUS('soak', vus, duration, { gracefulStop: '1m' });
    }

    static smoke(vus: number = 5, duration: string = '1m'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addConstantVUS('smoke', vus, duration, { gracefulStop: '10s' });
    }

    static volume(iterations: number = 10000, vus: number = 100): ScenarioBuilder {
        return new ScenarioBuilder()
            .addSharedIterations('volume', iterations, vus, { gracefulStop: '30s' });
    }

    static capacity(maxVUs: number = 1000, duration: string = '30m'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addRampingVUS('capacity', [
                { duration: '5m', target: 100 },
                { duration: '10m', target: 500 },
                { duration: '10m', target: maxVUs },
                { duration: '5m', target: 0 },
            ], { gracefulStop: '1m' });
    }

    static throughput(rate: number = 1000, duration: string = '5m', timeUnit: string = '1s'): ScenarioBuilder {
        return new ScenarioBuilder()
            .addConstantArrivalRate('throughput', rate, duration, timeUnit, {
                preAllocatedVUs: 20,
                maxVUs: rate * 2,
            });
    }
}

