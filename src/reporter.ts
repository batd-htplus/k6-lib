import { K6SummaryData, K6Summary } from './types/common';

export function handleSummary(data: K6SummaryData): Record<string, string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summary = generateSummary(data);
    const htmlReport = generateHTMLReport(summary, timestamp);
    const textReport = generateTextSummary(summary);
    const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
    const processEnv = typeof process !== 'undefined' 
        ? (process as { env?: Record<string, string | undefined> }).env 
        : undefined;
    const outDir = k6Env?.K6_SUMMARY_DIR || processEnv?.K6_SUMMARY_DIR || 'reports';
    return {
        'stdout': textReport,
        [`${outDir}/k6-report-${timestamp}.html`]: htmlReport,
        [`${outDir}/k6-report-${timestamp}.json`]: JSON.stringify(data, null, 2),
        [`${outDir}/latest-k6-report.html`]: htmlReport
    };
}

function generateSummary(data: K6SummaryData): K6Summary {
    const metrics = data?.metrics || {};
    const httpReqs = metrics.http_reqs?.values?.count || 0;
    const httpFailedRate = metrics.http_req_failed?.values?.rate || 0;
    const httpDur = metrics.http_req_duration?.values || {};
    const avg = httpDur.avg || 0;
    const p95 = httpDur['p(95)'] || 0;

    // Collect custom trends ending with _ms (e.g., assessment_request_*_ms)
    const customTrends: Array<{ name: string; avg: number; p95: number; count: number }> = [];
    Object.keys(metrics).forEach((key) => {
        if (key === 'http_req_duration' || key === 'http_reqs' || key === 'http_req_failed') return;
        if (key.endsWith('_ms')) {
            const v = metrics[key]?.values || {};
            customTrends.push({
                name: key,
                avg: v.avg || 0,
                p95: v['p(95)'] || 0,
                count: v.count || 0
            });
        }
    });

    return {
        testDuration: data.state?.testRunDurationMs || 0,
        totalRequests: httpReqs,
        failedRate: httpFailedRate,
        avgResponseTime: avg,
        p95ResponseTime: p95,
        iterations: data.metrics?.iterations?.values?.count || 0,
        vus: data.metrics?.vus?.values?.max || 0,
        trends: customTrends.sort((a, b) => b.count - a.count)
    };
}

function generateHTMLReport(summary: K6Summary, timestamp: string): string {
    const passed = summary.failedRate < 0.01; // fail rate < 1%
    const statusBadge = passed ? '<span class="badge badge-success">✅ PASSED</span>' : '<span class="badge badge-error">❌ FAILED</span>';
    const trendsRows = summary.trends.map((t) => `
            <tr>
                <td>${t.name}</td>
                <td>${t.count}</td>
                <td>${t.avg.toFixed(2)}</td>
                <td>${t.p95.toFixed(2)}</td>
            </tr>`).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>k6 Performance Report - ${timestamp}</title>
    <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial; margin: 0; padding: 24px; background:#0b1220; color:#e5e7eb; }
        .container { max-width: 1100px; margin: 0 auto; }
        .header { background: #111827; padding: 20px; border-radius: 10px; border: 1px solid #1f2937; }
        .header h1 { margin: 0 0 8px 0; font-size: 22px; }
        .timestamp { color:#9ca3af; }
        .badge { padding: 6px 12px; border-radius: 9999px; font-weight: 600; font-size: 12px; }
        .badge-success { background: #065f46; color: #d1fae5; }
        .badge-error { background: #7f1d1d; color: #fee2e2; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 14px; margin: 16px 0 24px; }
        .card { background: #0f172a; border: 1px solid #1f2937; border-radius: 10px; padding: 16px; }
        .label { color:#9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
        .value { font-size: 22px; font-weight: 700; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #1f2937; }
        th { color:#9ca3af; font-weight: 600; }
    </style>
<body>
    <div class="container">
        <div class="header">
            <h1>k6 Performance Report</h1>
            <div class="timestamp">Generated: ${new Date(timestamp).toLocaleString()}</div>
            ${statusBadge}
        </div>
        <div class="grid">
            <div class="card"><div class="label">Test Duration</div><div class="value">${(summary.testDuration/1000).toFixed(1)}s</div></div>
            <div class="card"><div class="label">Total Requests</div><div class="value">${summary.totalRequests}</div></div>
            <div class="card"><div class="label">Failed Rate</div><div class="value">${(summary.failedRate*100).toFixed(2)}%</div></div>
            <div class="card"><div class="label">Avg Response</div><div class="value">${summary.avgResponseTime.toFixed(2)} ms</div></div>
            <div class="card"><div class="label">P95 Response</div><div class="value">${summary.p95ResponseTime.toFixed(2)} ms</div></div>
            <div class="card"><div class="label">Iterations</div><div class="value">${summary.iterations}</div></div>
        </div>
        <div class="card">
            <div class="label">Custom Trend Metrics</div>
            <table>
                <thead>
                    <tr><th>Metric</th><th>Count</th><th>Avg (ms)</th><th>P95 (ms)</th></tr>
                </thead>
                <tbody>
                    ${trendsRows || '<tr><td colspan="4" style="color:#9ca3af">No custom trends</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;
}

function generateTextSummary(summary: K6Summary): string {
    const status = summary.failedRate < 0.01 ? '✅ PASSED' : '❌ FAILED';
    return `
🚀 k6 Performance Report
=======================
Status: ${status}
Duration: ${(summary.testDuration/1000).toFixed(1)}s
Requests: ${summary.totalRequests}
Failed rate: ${(summary.failedRate*100).toFixed(2)}%
Avg: ${summary.avgResponseTime.toFixed(2)} ms
P95: ${summary.p95ResponseTime.toFixed(2)} ms
Iterations: ${summary.iterations}
`;
}

declare global {
    function handleSummary(data: K6SummaryData): Record<string, string>;
}
