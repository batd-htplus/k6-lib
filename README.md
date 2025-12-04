# k6 Testing Framework

A comprehensive, production-ready k6 testing framework that simplifies writing and maintaining performance tests.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Examples](#examples)

---

## Installation

### Prerequisites

- **Node.js**: v18 or higher (v20+ recommended)
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
│   ├── config/             # Framework configuration
│   ├── scenarios/          # Your test files
│   │   └── my-project/     # Project-specific tests
│   │       ├── config.ts   # Project configuration
│   │       ├── helpers.ts  # Shared test helpers (optional)
│   │       ├── smoke/      # Test scenarios
│   │       ├── performance/
│   │       └── load/
│   ├── types/              # TypeScript definitions
│   └── reporter.ts         # HTML reporter
├── dist/                   # Compiled JavaScript
├── results/                # Test results
├── env.example             # Environment template
└── run-k6.sh               # Test runner
```

### Project Structure Pattern

For projects with multiple tests sharing common logic (auth, CRUD operations), use this pattern:

```
src/scenarios/my-project/
├── config.ts          # Project configuration (baseURL, endpoints, testUsers, VUConfig)
├── helpers.ts         # Shared test functions (login, create, update, delete)
├── smoke/
│   └── api.test.ts    # Uses helpers from ../helpers.ts
├── performance/
│   └── api.test.ts
└── load/
    └── api.test.ts
```

**Benefits:**
- Eliminates code duplication across test files
- Centralized configuration management
- Easy to maintain and update
- See `src/scenarios/project_example/` for complete example

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
    const data = response.data;
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

### Complete Project Example

See `src/scenarios/project_example/` for a complete working example demonstrating the recommended project structure pattern:

**Structure:**
```
project_example/
├── config.ts          # Project configuration with VU settings
├── helpers.ts         # Shared test functions (login, CRUD operations)
├── smoke/post.test.ts
├── performance/post.test.ts
├── load/post.test.ts
├── stress/post.test.ts
├── spike/post.test.ts
└── soak/post.test.ts
```

**Key Features:**
- **Centralized config** (`config.ts`) - Base URL, endpoints, test users, VU configurations
- **Shared helpers** (`helpers.ts`) - Reusable functions for login, create, read, update, delete
- **Clean test files** - Each test file is only ~35 lines, focused on thresholds and test flow
- **VU configuration** - Each test type can have custom VU settings with fallback to defaults

**Example Test File:**
```typescript
import { group } from 'k6';
import { ScenarioBuilder } from '@libs/base/scenario-builder';
import { defaultScenarioOptions, createThresholds, CommonThresholdPresets } from '@config/thresholds';
import { randomSleep } from '@helper/helpers';
import { getVUConfig } from '../config';
import { createTestHelpers, login, createPost, getPost, updatePost, deletePost } from '../helpers';
export { handleSummary } from '@reporter';

const helpers = createTestHelpers();
const THRESHOLDS = createThresholds({...}, CommonThresholdPresets.api);
const vuConfig = getVUConfig('smoke');

export const options = ScenarioBuilder.smoke(vuConfig.vus, vuConfig.duration)
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
}
```

---

## Additional Resources

- **k6 Documentation**: https://k6.io/docs/
- **k6 JavaScript API**: https://k6.io/docs/javascript-api/
- **Example Tests**: `src/scenarios/project_example/`
- **Type Definitions**: `src/k6.d.ts`

---

## License

This framework is designed to be reusable across projects. Customize as needed for your specific requirements.
