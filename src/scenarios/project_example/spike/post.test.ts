import { group } from 'k6';
import { ScenarioBuilder } from '@libs/base/scenario-builder';
import { defaultScenarioOptions, createThresholds, CommonThresholdPresets } from '@config/thresholds';
import { randomSleep } from '@helper/helpers';
import { getVUConfig } from '../config';
import { createTestHelpers, login, createPost, getPost, updatePost, deletePost } from '../helpers';
export { handleSummary } from '@reporter';

const helpers = createTestHelpers();

const THRESHOLDS = createThresholds({
    'api_duration_ms': ['p(95)<20000', 'p(99)<40000'],
    'api_errors': ['rate<0.05'],
}, CommonThresholdPresets.relaxed);

const vuConfig = getVUConfig('spike');
export const options = ScenarioBuilder.spike(vuConfig.vus, vuConfig.duration)
    .setThresholds(THRESHOLDS)
    .setGlobalOptions(defaultScenarioOptions)
    .build();

export default function () {
    const token = login(helpers);
    if (!token) return;

    group('Post CRUD Tests', () => {
        const postId = createPost(helpers, token);
        if (postId) {
            getPost(helpers, token, postId);
            updatePost(helpers, token, postId);
            deletePost(helpers, token, postId);
        }
    });

    randomSleep(1, 2);
}
