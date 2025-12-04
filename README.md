# k6 Testing Framework

A comprehensive, production-ready k6 testing framework that simplifies writing and maintaining performance tests. Built with TypeScript for type safety, this framework provides reusable components, utilities, and best practices.

## What is This Framework?

A **universal testing toolkit** for k6 that eliminates boilerplate code and provides:

- **Ready-to-use components** for HTTP requests, authentication, and test data management
- **Type-safe APIs** with full TypeScript support
- **Flexible configuration** via environment variables and CSV files
- **Automatic reporting** with HTML dashboards and detailed metrics
- **Best practices** built-in for common testing scenarios

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Configuration](#configuration)
- [Writing Tests](#writing-tests)
- [Running Tests](#running-tests)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

- **Node.js**: v14 or higher
- **k6**: Installed and available in PATH

```bash
# Install k6
# Ubuntu/Debian: sudo apt install k6
# macOS: brew install k6
# CentOS/RHEL: sudo yum install k6
```

### Setup Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp env.example .env
# Edit .env with your settings

# 3. Build framework
npm run build
```

**Minimum `.env` configuration:**
```env
BASE_URL=http://localhost:3000
TEST_EMAIL=user@example.com
TEST_PASSWORD=password123
```

---

## Quick Start

### 1. Create Test File

Create `src/scenarios/my-project/smoke/api.test.ts`:

```typescript
import { check } from 'k6';
import { ScenarioBuilder } from '@libs/base/scenario-builder';
import { BaseHTTPClient } from '@libs/base/http-client';
import { createThresholds, CommonThresholdPresets } from '@config/thresholds';
import { createTrend, getResponseDuration } from '@helper/metrics';
import { isStatus200 } from '@helper/http-check';
export { handleSummary } from '@reporter';

const k6Env = (globalThis as { __ENV?: Record<string, string | undefined> }).__ENV;
const BASE_URL = k6Env?.BASE_URL || 'http://localhost:3000';

const httpClient = new BaseHTTPClient({ baseURL: BASE_URL });
const apiDuration = createTrend('api_duration_ms');

export const options = ScenarioBuilder.smoke(5, '1m')
    .setThresholds(createThresholds({
        'api_duration_ms': ['p(95)<1000'],
    }, CommonThresholdPresets.api))
    .build();

export default function () {
    const response = httpClient.get('/api/health');
    check(response, {
        'Status is 200': (r) => isStatus200(r),
    });
    if (httpClient.isSuccess(response)) {
        apiDuration.add(getResponseDuration(response));
    }
}
```

### 2. Build and Run

```bash
npm run build
./run-k6.sh dist/scenarios/my-project/smoke/api.test.js
```

### 3. View Results

Results saved in `results/my-project/smoke/api_<timestamp>/`:
- `dashboard-report.html` - Interactive charts (open in browser)
- `result.json` - Raw data
- `result.csv` - For spreadsheet analysis
- `summary.json` - Quick overview

---

## Project Structure

```
k6-lib/
├── src/
│   ├── libs/base/          # Core reusable components
│   ├── helper/             # Utility functions
│   ├── config/             # Configuration
│   ├── scenarios/          # Your test files
│   ├── types/              # TypeScript definitions
│   └── reporter.ts         # HTML reporter
├── dist/                   # Compiled JavaScript
├── results/                # Test results
├── env.example             # Environment template
└── run-k6.sh              # Test runner
```

---

## Core Components

### BaseHTTPClient

HTTP client wrapper with built-in error handling.

**Key Methods:**
- `get<T>(path, options?)` - GET request
- `post<T>(path, body?, options?)` - POST request
- `put<T>(path, body?, options?)` - PUT request
- `del<T>(path, body?, options?)` - DELETE request
- `isSuccess(response)` - Check if 2xx status
- `isClientError(response)` - Check if 4xx status
- `isServerError(response)` - Check if 5xx status

**Usage:**
```typescript
const httpClient = new BaseHTTPClient({ baseURL: 'https://api.example.com' });
const response = httpClient.get('/api/users', {
    headers: { 'Authorization': 'Bearer token' }
});
if (httpClient.isSuccess(response)) {
    const data = response.data; // Parsed JSON
}
```

### BaseAuth

Authentication helper with token management and caching.

**Key Methods:**
- `loginAndGetToken(credentials, cacheKey?)` - Login and return token string
- `getAuthHeaders(token)` - Get Authorization header
- `logout(token, endpoint?)` - Logout
- `getCachedTokenString(cacheKey)` - Get cached token

**Usage:**
```typescript
const auth = new BaseAuth(httpClient, { loginEndpoint: '/auth/login' });
const token = auth.loginAndGetToken({ email, password }, 'user1');
const headers = auth.getAuthHeaders(token);
```

### BaseTestData

Test data management from environment variables or CSV files.

**Key Methods:**
- `getTestUser(key)` - Get specific user
- `getAllUsers()` - Get all users
- `getRandomUser()` - Get random user
- `generateMultipleUsers(count, prefix)` - Generate users programmatically

**Configuration:**
- Set `TEST_USER_SOURCE=env` for environment variables
- Set `TEST_USER_SOURCE=csv` for CSV file (specify `TEST_USERS_CSV=path/to/file.csv`)

**CSV Format:**
```csv
email,password,username,role
user1@example.com,password123,user1,admin
```

### ScenarioBuilder

Programmatic creation of k6 test scenarios.

**Available Test Types:**
- `smoke(vus, duration)` - Quick validation (5 VUs, 1m)
- `performance(vus, duration)` - Baseline performance (50 VUs, 5m)
- `load(vus, duration)` - Sustained load (80 VUs, 10m)
- `stress(maxVUs, duration)` - Stress testing with ramping (200 VUs, 15m)
- `spike(maxVUs, duration)` - Sudden load spike (500 VUs, 10m)
- `soak(vus, duration)` - Long-running test (50 VUs, 2h)

**Usage:**
```typescript
export const options = ScenarioBuilder.performance(50, '5m')
    .setThresholds(thresholds)
    .setGlobalOptions(options)
    .build();
```

### Endpoints

Builders for common API endpoint patterns.

**AuthEndpoints:**
```typescript
const authEndpoints = new AuthEndpoints('/auth');
authEndpoints.login();    // '/auth/login'
authEndpoints.logout();   // '/auth/logout'
```

**CRUDEndpoints:**
```typescript
const postEndpoints = new CRUDEndpoints('posts', '/api/posts');
postEndpoints.create();   // POST /api/posts
postEndpoints.get(123);   // GET /api/posts/123
postEndpoints.update(123); // PUT /api/posts/123
postEndpoints.delete(123); // DELETE /api/posts/123
```

---

## Configuration

### Environment Variables

All configuration in `.env`:

```env
BASE_URL=http://localhost:3000
TEST_USER_SOURCE=env
TEST_EMAIL=user@example.com
TEST_PASSWORD=password123
```

### Thresholds

Define performance thresholds in test files:

```typescript
import { createThresholds, CommonThresholdPresets } from '@config/thresholds';

const thresholds = createThresholds({
    'api_duration_ms': ['p(95)<1000'],
    'http_req_failed': ['rate<0.01'],
}, CommonThresholdPresets.api);
```

**Available Presets:**
- `CommonThresholdPresets.api` - General API thresholds (default)
- `CommonThresholdPresets.auth` - Authentication-specific
- `CommonThresholdPresets.strict` - Strict thresholds
- `CommonThresholdPresets.relaxed` - Relaxed for stress tests

**Threshold Format:**
- `p(95)<1000` - 95th percentile must be less than 1000ms
- `rate<0.01` - Error rate must be less than 1%

---

## Writing Tests

### Basic Structure

1. **Import components** using aliases (`@libs`, `@helper`, `@config`, `@reporter`)
2. **Initialize components** (HTTP client, auth, test data)
3. **Define metrics** (trends, rates, counters, gauges)
4. **Set thresholds** for performance expectations
5. **Configure options** using ScenarioBuilder
6. **Write test logic** in default function

### Key Imports

```typescript
import { ScenarioBuilder } from '@libs/base/scenario-builder';
import { BaseHTTPClient } from '@libs/base/http-client';
import { BaseAuth } from '@libs/base/auth';
import { BaseTestData } from '@libs/base/test-data';
import { createThresholds } from '@config/thresholds';
import { createTrend, getResponseDuration } from '@helper/metrics';
import { isStatus200 } from '@helper/http-check';
export { handleSummary } from '@reporter';
```

### Helper Functions

**HTTP Checks:**
- `isStatus200/201/204(response)` - Check specific status codes
- `isSuccess(response)` - Check if 2xx
- `isClientError(response)` - Check if 4xx
- `isServerError(response)` - Check if 5xx

**Metrics:**
- `createTrend(name)` - Track durations
- `createRate(name)` - Track error rates
- `getResponseDuration(response)` - Get response time in ms

**General:**
- `randomSleep(min, max)` - Random delay
- `randomChoice(array)` - Random selection
- `getEnv(key, defaultValue)` - Get environment variable

---

## Running Tests

### Build First

```bash
npm run build
```

### Run Single Test

```bash
# Run with scenarios from test file
./run-k6.sh dist/scenarios/my-project/smoke/api.test.js

# Override with custom VUs and duration
./run-k6.sh dist/scenarios/my-project/api.test.js custom 100 15m

# Override with preset
./run-k6.sh dist/scenarios/my-project/api.test.js performance
```

### Run All Tests in Directory

```bash
# Run all tests in a directory
./run-k6.sh dist/scenarios/my-project/load

# Run all tests in a project
./run-k6.sh dist/scenarios/my-project
```

### Results Organization

Results are automatically organized by project structure:

```
results/
└── my-project/
    └── smoke/
        └── api_20251204_120000/
            ├── dashboard-report.html
            ├── result.json
            ├── result.csv
            └── summary.json
```

---

## Examples

See `src/scenarios/project_example/` for complete working examples:

- **Smoke** (`smoke/post.test.ts`) - Quick validation (5 VUs, 1m)
- **Performance** (`performance/post.test.ts`) - Baseline (50 VUs, 5m)
- **Load** (`load/post.test.ts`) - Sustained load (80 VUs, 10m)
- **Stress** (`stress/post.test.ts`) - Stress testing (200 VUs, 15m)
- **Spike** (`spike/post.test.ts`) - Spike testing (500 VUs, 10m)
- **Soak** (`soak/post.test.ts`) - Long-running (50 VUs, 2h)

Each example demonstrates:
- Authentication flow
- CRUD operations
- Custom metrics
- Threshold configuration
- Error handling

---

## Best Practices

### 1. Use Path Aliases

Always use aliases instead of relative paths:
```typescript
// ✅ Good
import { ScenarioBuilder } from '@libs/base/scenario-builder';

// ❌ Bad
import { ScenarioBuilder } from '../../../libs/base/scenario-builder';
```

### 2. Organize by Project

```
src/scenarios/
├── project-a/
│   ├── smoke/
│   ├── performance/
│   └── load/
└── project-b/
    └── smoke/
```

### 3. Use Environment Variables

```typescript
const BASE_URL = k6Env?.BASE_URL || 'http://localhost:3000';
const user = testData.getTestUser('user');
```

### 4. Set Appropriate Thresholds

- **Performance/Load tests**: Use strict thresholds (`CommonThresholdPresets.api`)
- **Stress/Spike tests**: Use relaxed thresholds (`CommonThresholdPresets.relaxed`)

### 5. Don't Logout in Each Iteration

```typescript
export default function () {
    const token = login();
    // ... perform tests
    // Don't logout here - let tokens expire naturally
}
```

### 6. Track Custom Metrics

```typescript
const apiDuration = createTrend('api_duration_ms');
const errorRate = createRate('api_errors');
```

### 7. Use Groups for Organization

```typescript
group('User Management', () => {
    createUser();
    getUser();
    updateUser();
});
```

### 8. Add Realistic Delays

```typescript
import { randomSleep } from '@helper/helpers';
randomSleep(1, 3);  // Random delay between 1-3 seconds
```

---

## Troubleshooting

### Build Errors

```bash
npm run clean
npm run build
```

**Common causes:** Syntax errors, missing imports, type mismatches

### Authentication Failures

1. Check `TEST_EMAIL` and `TEST_PASSWORD` in `.env`
2. Verify user exists in system
3. Check login endpoint path
4. Verify API server is running

**Debug:**
```typescript
console.log('Status:', response.status);
console.log('Body:', response.body.substring(0, 200));
```

### Token Blacklist Issues

Don't logout in each iteration. Let tokens expire naturally or logout only in teardown.

### CSV File Not Found

1. Verify `TEST_USER_SOURCE=csv` in `.env`
2. Check `TEST_USERS_CSV` path is correct
3. Ensure CSV file exists and is readable
4. Check CSV format matches expected structure

### High Error Rates

1. Check API server is running
2. Verify `BASE_URL` is correct
3. Check network connectivity
4. Review API logs
5. Reduce VUs if server is overloaded

### Thresholds Exceeded

- **Stress/Spike tests**: Use `CommonThresholdPresets.relaxed` and adjust custom thresholds
- **Performance tests**: Check if thresholds are realistic for your system

---

## Additional Resources

- **k6 Documentation**: https://k6.io/docs/
- **k6 JavaScript API**: https://k6.io/docs/javascript-api/
- **Example Tests**: `src/scenarios/project_example/`
- **Type Definitions**: `src/k6.d.ts`

---

## License

This framework is designed to be reusable across projects. Customize as needed for your specific requirements.
