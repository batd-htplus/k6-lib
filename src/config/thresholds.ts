/** A map of metric names to their threshold expressions (e.g. `{ "http_req_duration": ["p(95)<500"] }`). */
export type Thresholds = Record<string, string[]>;

/** Sensible defaults for k6 scenario options. */
export const defaultScenarioOptions = {
    noConnectionReuse: false,
    discardResponseBodies: false,
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
    setupTimeout: '120s',
    teardownTimeout: '30s',
};

/**
 * Pre-built threshold presets.
 *
 * `.auth` and `.ws` contain custom metrics (`auth_duration_ms`, `ws_connect_ms`, …)
 * that must be created via `createTrend()`/`createRate()` before the `options` export,
 * otherwise k6 will throw "no metric name found".
 */
export const CommonThresholdPresets = {
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
    auth: {
        'auth_duration_ms': ['p(95)<1000'],
        'http_req_duration': ['p(95)<500'],
        'http_req_failed': ['rate<0.01'],
    } as Thresholds,
    ws: {
        'ws_connect_ms': ['p(95)<500'],
        'ws_msg_rtt_ms': ['p(95)<200'],
        'ws_errors': ['rate<0.01'],
    } as Thresholds,
};

/** Valid keys of the `CommonThresholdPresets` map. */
export type ThresholdPresetName = keyof typeof CommonThresholdPresets;

/** Merge multiple `Thresholds` objects. When the same metric appears in more than one object, the threshold expressions are concatenated. */
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


/** Create a complete thresholds configuration by merging custom thresholds on top of a preset (defaults to `api`). */
export function createThresholds(
    custom: Thresholds,
    defaults: Thresholds = CommonThresholdPresets.api
): Thresholds {
    return mergeThresholds(defaults, custom);
}

/** Add or override a single metric's threshold expressions in an existing preset. */
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

/** Create a custom preset by merging additional metrics on top of an existing base preset (defaults to `api`). */
export function createCustomPreset(
    basePreset: Thresholds = CommonThresholdPresets.api,
    additionalMetrics: Thresholds = {}
): Thresholds {
    return mergeThresholds(basePreset, additionalMetrics);
}
