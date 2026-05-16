import { K6SummaryData } from '../types/common';

/**
 * Generates a JUnit XML string from k6 summary data, including per-threshold test cases
 * and top-level properties for HTTP request metrics. Intended for CI pipelines (GitLab/Jenkins/GitHub Actions).
 */
export function generateJUnitXml(data: K6SummaryData, testName = 'k6-performance-test'): string {
    const metrics = data?.metrics || {};
    const reqs = metrics.http_reqs?.values?.count || 0;
    const failed = metrics.http_req_failed?.values?.rate || 0;
    const durationMs = data.state?.testRunDurationMs || 0;
    const durationSec = (durationMs / 1000).toFixed(3);
    const failedCount = Math.round(reqs * failed);

    const thresholdResults: string[] = [];
    Object.keys(metrics).forEach((m) => {
        const values = metrics[m]?.values;
        if (!values) return;
        const thresholds = (metrics[m] as unknown as { thresholds?: Record<string, { ok: boolean }> }).thresholds;
        if (!thresholds) return;
        Object.keys(thresholds).forEach((t) => {
            const ok = thresholds[t].ok;
            const tcName = `${m} ${t}`;
            if (ok) {
                thresholdResults.push(`    <testcase classname="${escapeXml(testName)}" name="${escapeXml(tcName)}" time="0"/>`);
            } else {
                thresholdResults.push(
                    `    <testcase classname="${escapeXml(testName)}" name="${escapeXml(tcName)}" time="0">
      <failure message="threshold not met">Threshold ${escapeXml(t)} on metric ${escapeXml(m)} failed.</failure>
    </testcase>`
                );
            }
        });
    });

    const failures = thresholdResults.filter((s) => s.includes('<failure')).length;

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${escapeXml(testName)}" tests="${thresholdResults.length}" failures="${failures}" time="${durationSec}">
${thresholdResults.join('\n')}
    <properties>
      <property name="http_reqs" value="${reqs}"/>
      <property name="http_req_failed_rate" value="${failed}"/>
      <property name="http_req_failed_count" value="${failedCount}"/>
    </properties>
  </testsuite>
</testsuites>`;
}

function escapeXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
