import { group } from 'k6';
import { ScenarioBuilder, defaultScenarioOptions, createThresholds, createTrend, createRate } from '@htplus/k6-lib';
import { randomSleep } from '@helper/common';
import project from '../config';
export { handleSummary } from '@reporter';

const trendApiDuration = createTrend('api_duration_ms');
const rateApiErrors = createRate('api_errors');

const { vus, duration } = project.vu.performance;
export const options = ScenarioBuilder.performance(vus, duration)
    .setThresholds(createThresholds({
        'api_duration_ms': ['p(95)<800'],
        'api_errors': ['rate<0.01'],
    }))
    .setGlobalOptions(defaultScenarioOptions)
    .build();

export default function () {
    group('Post CRUD', () => {
        const created = project.http.post('/posts', { title: `Test ${Date.now()}`, content: 'test' }, { auth: 'user' });
        project.check(created, 201);
        trendApiDuration.add(created.timings?.duration || 0);
        const id = project.extract(created, 'data.id') as number;
        if (!id) { rateApiErrors.add(true); return; }

        const got = project.http.get(`/posts/${id}`, { auth: 'user' });
        trendApiDuration.add(got.timings?.duration || 0);

        const updated = project.http.put(`/posts/${id}`, { title: 'updated', content: 'test' }, { auth: 'user' });
        trendApiDuration.add(updated.timings?.duration || 0);

        const deleted = project.http.del(`/posts/${id}`, null, { auth: 'user' });
        trendApiDuration.add(deleted.timings?.duration || 0);
    });
    randomSleep(0.5, 1);
}
