import { group } from 'k6';
import { ScenarioBuilder, defaultScenarioOptions, createThresholds, createTrend, createRate, SetupData } from '@htplus/k6-lib';
import { randomSleep } from '@helper/common';
import project from '../config';
export { handleSummary } from '@reporter';
export function setup() { return project.setup(); }

const trendApiDuration = createTrend('api_duration_ms');
const rateApiErrors = createRate('api_errors');

const { vus } = project.vu.stress;
export const options = ScenarioBuilder.stress(vus)
    .setThresholds(createThresholds({
        'api_duration_ms': ['p(95)<2000'],
        'api_errors': ['rate<0.1'],
    }))
    .setGlobalOptions(defaultScenarioOptions)
    .build();

export default function (data: unknown) {
    project.applySetupData(data as SetupData);
    group('Post CRUD', () => {
        const created = project.http.post('/posts', { title: `Test ${Date.now()}`, content: 'test' }, { auth: 'user' });
        project.check(created, 201);
        trendApiDuration.add(created.timings?.duration || 0);
        const id = project.extract(created, 'data.id') as number;
        if (!id) { rateApiErrors.add(true); return; }

        const updated = project.http.put(`/posts/${id}`, { title: 'updated', content: 'test' }, { auth: 'user' });
        trendApiDuration.add(updated.timings?.duration || 0);

        const deleted = project.http.del(`/posts/${id}`, null, { auth: 'user' });
        trendApiDuration.add(deleted.timings?.duration || 0);
    });
    randomSleep(0.5, 1);
}
