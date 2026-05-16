import { group } from 'k6';
import { ScenarioBuilder, defaultScenarioOptions, createThresholds, createTrend, createRate } from '@htplus/k6-lib';
import { randomSleep } from '@helper/common';
import project from '../config';
import { createApi } from '../generated/api';
export { handleSummary } from '@reporter';
export function setup() { return project.setup(); }

const api = createApi(project.http);
const trendApiDuration = createTrend('api_duration_ms');
const rateApiErrors = createRate('api_errors');

const { vus, duration } = project.vu.smoke;
export const options = ScenarioBuilder.smoke(vus, duration)
    .setThresholds(createThresholds({
        'api_duration_ms': ['p(95)<1000'],
        'api_errors': ['rate<0.01'],
    }))
    .setGlobalOptions(defaultScenarioOptions)
    .build();

export default function () {
    group('Post CRUD (codegen)', () => {
        const created = api.posts.createPost({ title: `Test ${Date.now()}`, content: 'test' }, { auth: 'user' });
        project.check(created, 201);
        trendApiDuration.add(created.timings?.duration || 0);
        const id = project.extract(created, 'data.id') as number;
        if (!id) { rateApiErrors.add(true); return; }

        const got = api.posts.getPost(id, { auth: 'user' });
        trendApiDuration.add(got.timings?.duration || 0);

        const updated = api.posts.updatePost(id, { title: 'updated', content: 'test' }, { auth: 'user' });
        trendApiDuration.add(updated.timings?.duration || 0);

        const deleted = api.posts.deletePost(id, { auth: 'user' });
        trendApiDuration.add(deleted.timings?.duration || 0);
    });
    randomSleep(0.5, 1);
}
