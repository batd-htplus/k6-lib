export type Thresholds = Record<string, string[]>;

export const defaultScenarioOptions = {
    noConnectionReuse: false,
    discardResponseBodies: false,
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
    setupTimeout: '120s',
    teardownTimeout: '30s',
    insecureSkipTLSVerify: true,
};

export const CommonThresholdPresets = {
    auth: {
        'auth_duration_ms': ['p(95)<1000'],
        'http_req_duration': ['p(95)<500'],
        'http_req_failed': ['rate<0.01'],
    } as Thresholds,
    api: {
        'http_req_duration': ['p(95)<1000', 'p(99)<2000'],
        'http_req_failed': ['rate<0.01'],
        'http_reqs': ['rate>10'],
    } as Thresholds,
    strict: {
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.001'],
        'http_reqs': ['rate>50'],
    } as Thresholds,
    relaxed: {
        'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
        'http_req_failed': ['rate<0.05'],
    } as Thresholds,
};

export const VUConfig = {
    auth: {
        vus: 10,
        duration: '2m',
    },
    performance: {
        vus: 50,
        duration: '5m',
    },
    load: {
        vus: 80,
        duration: '10m',
    },
    stress: {
        vus: 200,
        duration: '15m',
    },
};

export function mergeThresholds(...thresholds: Thresholds[]): Thresholds {
    const result: Thresholds = {};
    thresholds.forEach((t) => {
        Object.entries(t).forEach(([key, value]) => {
            if (result[key]) {
                result[key] = [...result[key], ...value];
            } else {
                result[key] = [...value];
            }
        });
    });
    return result;
}


export function createThresholds(
    custom: Thresholds,
    defaults: Thresholds = CommonThresholdPresets.api
): Thresholds {
    return mergeThresholds(defaults, custom);
}

export function addMetricToPreset(
    preset: Thresholds,
    metricName: string,
    thresholdStrings: string[]
): Thresholds {
    return {
        ...preset,
        [metricName]: thresholdStrings,
    };
}

export function createCustomPreset(
    basePreset: Thresholds = CommonThresholdPresets.api,
    additionalMetrics: Thresholds = {}
): Thresholds {
    return mergeThresholds(basePreset, additionalMetrics);
}
