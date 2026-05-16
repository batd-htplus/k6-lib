# @htplus/k6-lib

k6 performance testing framework — REST + WebSocket, multi-auth, OpenAPI codegen.

## Quick start

```bash
npm install
cp test-users.example.csv workspaces/<project>/
# sửa .env (BASE_URL, TEST_EMAIL, TEST_PASSWORD)
npm run build
npx k6-lib run workspaces/project_example/smoke
```

## Project structure

```
├── src/                        # Core library (không sửa)
│   ├── auth/                   # Auth providers
│   ├── client/                 # HTTP + WebSocket client
│   ├── cli/                    # CLI: init, gen, run
│   ├── config/                 # defineProject(), env, thresholds
│   ├── data/                   # CSV, JSON, JSONL loaders
│   ├── helper/                 # Utilities
│   ├── reporter/               # HTML + JSON + JUnit reporter
│   └── scenarios/              # ScenarioBuilder + presets
├── workspaces/                 # Mỗi dự án một thư mục riêng
│   └── project_example/
│       ├── config.ts           # defineProject(...)
│       ├── openapi.yaml        # Spec API của dự án (tuỳ chọn)
│       ├── generated/
│       │   └── api.ts          # Codegen từ openapi.yaml (tuỳ chọn)
│       ├── smoke/post.test.ts
│       └── ...
└── dist/                       # Build output
```

---

## 1. Định nghĩa project

Tạo file `workspaces/<tên-dự-án>/config.ts`:

```typescript
import { defineProject, passwordAuth, csvUsers, jsonData, env } from '@htplus/k6-lib';

export default defineProject({
    name: 'my-project',
    baseURL: {
        default: env('BASE_URL', 'http://localhost:3000'),
        staging: 'https://staging.example.com',
    },
    auth: {
        user: passwordAuth({
            loginPath: '/auth/login',
            body: (u) => ({ email: u.email, password: u.password }),
            extractToken: 'data.token',
            pool: { size: 5, rotation: 'round-robin' },
        }),
    },
    testUsers: csvUsers('./test-users.csv'),
    testData: {
        posts: jsonData('./data/posts.json'),
    },
    thresholds: 'api',
});
```

`defineProject()` trả về toolkit gồm: `project.http`, `project.ws`, `project.auth`, `project.check`, `project.extract`, `project.env`, `project.data`.

---

## 2. Viết test

### Cách 1: Xài `project.http` trực tiếp

```typescript
// workspaces/my-project/smoke/post.test.ts
import { group } from 'k6';
import { ScenarioBuilder, createThresholds, createTrend, defaultScenarioOptions } from '@htplus/k6-lib';
import { randomSleep } from '@helper/common';
import project from '../config';
export { handleSummary } from '@reporter';

const trend = createTrend('api_duration_ms');

export const options = ScenarioBuilder.smoke(5, '1m')
    .setThresholds(createThresholds({ 'api_duration_ms': ['p(95)<1000'] }))
    .setGlobalOptions(defaultScenarioOptions)
    .build();

export default function () {
    group('Post CRUD', () => {
        const res = project.http.post('/posts', { title: 'test' }, { auth: 'user' });
        project.check(res, 201);
        trend.add(res.timings?.duration || 0);
        const id = project.extract(res, 'data.id');
        // ...
    });
    randomSleep(0.5, 1);
}
```

### Cách 2: Dùng OpenAPI codegen (có TypeScript type)

Nếu backend có file OpenAPI spec, chạy lệnh sau để sinh code:

```bash
k6-lib gen \
  --spec=workspaces/my-project/openapi.yaml \
  --out=workspaces/my-project/generated/api.ts
```

Lệnh này đọc spec → sinh ra file `generated/api.ts` với typed method cho từng endpoint. File này nằm trong workspace của dự án, mỗi dự án gen riêng:

```
workspaces/my-project/
├── openapi.yaml           # Spec của dự án này
├── generated/
│   └── api.ts             # Codegen từ spec trên (không sửa tay)
├── config.ts
└── smoke/post.test.ts
```

Sau đó test import code đã gen và xài:

```typescript
// workspaces/my-project/smoke/post.test.ts
import { createApi } from '../generated/api';
import project from '../config';

const api = createApi(project.http);

export default function () {
    // Có TypeScript type, gõ sai endpoint/param báo lỗi ngay
    const posts = api.posts.listPosts({ page: 1, limit: 10 });
    const created = api.posts.createPost({ title: 'test' }, { auth: 'user' });
    const got = api.posts.getPost({ id: created.data.id });
}
```

So sánh:

| Cách           | Viết tay             | Codegen + type |
|----------------|----------------------|----------------|
| URL            | Tự gõ `'/posts/123'` | Tự động        |
| Query params   | Tự拼接 string        | Object có type |
| Body           | Tự khai báo          | Tự động        |
| Response type  | `unknown`            | Có type sẵn    |
| Sai endpoint   | Chạy mới biết        | Compile báo    |

---

## 3. Chạy test

```bash
# run single test
npx k6-lib run workspaces/my-project/smoke/post.test.ts

# run all tests trong thư mục
npx k6-lib run workspaces/my-project/smoke

# override preset
npx k6-lib run workspaces/my-project/smoke/post.test.ts --type load

# legacy
bash run-k6.sh dist/scenarios/my-project/smoke/post.test.js
```

---

## 4. Auth providers

| Provider              | Import                          |
|-----------------------|---------------------------------|
| Password login        | `passwordAuth(...)`             |
| OAuth2 client creds   | `oauth2ClientCredentials(...)`  |
| OAuth2 password grant | `oauth2Password(...)`           |
| API key               | `apiKeyAuth(...)`               |
| Basic auth            | `basicAuth(...)`                |
| Bearer static token   | `bearerStaticAuth(...)`         |
| JWT refresh           | `jwtRefreshAuth(...)`           |
| HMAC signature        | `hmacAuth(...)`                 |
| Custom                | `customAuth(...)`               |

Mỗi provider có pool token tự động (pre-login, refresh, round-robin).

---

## 5. Data loaders

| Source   | Import                    |
|----------|---------------------------|
| CSV      | `csvUsers(path)`          |
| CSV      | `csvData(path)`           |
| JSON     | `jsonData(path)`          |
| JSONL    | `jsonlData(path)`         |
| Inline   | `inlineData([...])`       |

---

## 6. Threshold presets

| Preset     | Yêu cầu                            |
|------------|------------------------------------|
| `'api'`    | p(95)<1000ms, failed<1%            |
| `'strict'` | p(95)<500ms, failed<0.1%           |
| `'relaxed'`| p(95)<2000ms, failed<5%            |
| `'auth'`   | auth_duration<1000ms               |
| `'ws'`     | WebSocket connect<500ms             |

Custom:

```typescript
createThresholds({ 'my_metric': ['p(95)<500'] }, CommonThresholdPresets.api)
```

---

## 7. Kết quả

Lưu trong `results/`:
- `dashboard-report.html` — interactive charts
- `result.json` — raw data
- `summary.json` — quick overview

---

## 8. CLI

```bash
k6-lib init <name>       # Tạo project mới (scaffold)
k6-lib gen --spec=...    # Sinh code từ OpenAPI spec
k6-lib run <target>      # Chạy test
```
