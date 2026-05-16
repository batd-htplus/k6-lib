# k6-lib — Kiến trúc thư viện

> Internal performance testing library 

---

## 1. Phạm vi

| Có hỗ trợ | Không hỗ trợ |
|-----------|---------------|
| REST API (HTTP/HTTPS) | gRPC |
| WebSocket (`k6/ws`) | GraphQL |
| OpenAPI 3.x / Swagger 2.x → codegen endpoint | Browser test |
| Smoke / Load / Stress / Spike / Soak / Volume / Capacity / Throughput | Chaos / fault injection |
| Auth: password, OAuth2 (CC + password grant), API key, Basic, Bearer static, JWT refresh, HMAC, custom | SAML / OIDC interactive flow |
| Output: HTML dashboard, JSON, CSV, JUnit XML, Prometheus remote write | k6 Cloud (chưa làm phase 1) |

## 2. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────┐
│                    User Project                          │
│  project.config.ts  ──►  defineProject({ ... })         │
│  openapi.yaml       ──►  k6-lib gen ──► src/generated/  │
│  scenarios/*.ts     ──►  import { api, ws, auth, data } │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   @htplus/k6-lib                         │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │  client/   │  │   auth/    │  │     data/        │  │
│  │  rest      │  │  providers │  │  loaders + pool  │  │
│  │  ws        │  │            │  │  SharedArray     │  │
│  └────────────┘  └────────────┘  └──────────────────┘  │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ scenarios/ │  │  openapi/  │  │   reporter/      │  │
│  │  builder   │  │  parser    │  │   summary, junit │  │
│  │            │  │  codegen   │  │                  │  │
│  └────────────┘  └────────────┘  └──────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                  defineProject()                    │ │
│  │     factory gom config → trả về toolkit            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              cli/  (init, gen, run)                │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                             │
                             ▼
                       k6 binary chạy
```

## 3. Cấu trúc thư mục

### Bên trong package `@htplus/k6-lib`

```
src/
├── client/
│   ├── rest-client.ts          # HTTP wrapper, retry, tag chuẩn
│   ├── ws-client.ts            # WebSocket wrapper, metric tự động
│   └── types.ts
├── auth/
│   ├── index.ts                # export tất cả provider
│   ├── provider.ts             # interface IAuthProvider
│   ├── password.ts
│   ├── oauth2-client-credentials.ts
│   ├── oauth2-password.ts
│   ├── api-key.ts
│   ├── basic.ts
│   ├── bearer-static.ts
│   ├── jwt-refresh.ts
│   ├── hmac.ts
│   ├── custom.ts
│   └── token-pool.ts           # pre-login pool + rotation
├── data/
│   ├── csv-loader.ts           # SharedArray + parser đúng
│   ├── json-loader.ts          # SharedArray
│   └── data-set.ts             # API .random() .next() .pick()
├── scenarios/
│   ├── scenario-builder.ts     # giữ nguyên từ code hiện tại
│   └── presets.ts              # smoke/load/stress/spike/soak/...
├── openapi/
│   ├── parser.ts               # đọc OpenAPI 3.x + Swagger 2.x
│   ├── codegen.ts              # sinh src/generated/api.ts
│   └── validator.ts            # validate response theo schema
├── config/
│   ├── define-project.ts       # factory chính
│   ├── thresholds.ts           # preset api/auth/strict/relaxed/ws
│   └── env.ts
├── reporter/
│   ├── handle-summary.ts       # HTML dashboard hiện có
│   ├── junit-xml.ts            # cho CI
│   └── notifier.ts             # Slack/Teams hook (optional)
├── cli/
│   ├── init.ts                 # scaffold project mới
│   ├── gen.ts                  # codegen từ openapi
│   └── run.ts                  # wrap run-k6.sh
└── index.ts
```

### Bên trong dự án dùng lib

```
my-service-k6/
├── project.config.ts           # File config duy nhất
├── openapi.yaml                # Copy/fetch từ backend
├── .env                        # BASE_URL, credentials...
├── test-users.csv              # Pool user cho login
├── data/
│   ├── posts.json              # Test data cho POST/PUT
│   └── search-queries.json     # Query string mẫu
├── src/generated/              # Auto-gen, không sửa tay
│   ├── api.ts
│   └── types.ts
└── scenarios/
    ├── smoke/
    │   └── *.test.ts
    ├── load/
    │   └── *.test.ts
    ├── stress/
    ├── spike/
    ├── soak/
    └── ws/
```

## 4. Core interfaces

Đây là contract của các module, dev không cần biết implementation:

```typescript
// client
interface IRestClient {
  get<T>(path: string, opts?: RequestOptions): Response<T>;
  post<T>(path: string, body?: unknown, opts?: RequestOptions): Response<T>;
  put<T>(path: string, body?: unknown, opts?: RequestOptions): Response<T>;
  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Response<T>;
  del<T>(path: string, body?: unknown, opts?: RequestOptions): Response<T>;
  batch(requests: BatchRequest[]): Response[];
}

interface IWsClient {
  connect(path: string, opts: WsOptions, handler: WsHandler): void;
}

// auth
interface IAuthProvider {
  name: string;
  acquireToken(client: IRestClient, user?: TestUser): Token;
  applyToRequest(request: Request, token: Token): Request;
  refresh?(client: IRestClient, token: Token): Token;
  onUnauthorized?(client: IRestClient, user?: TestUser): Token;
}

// data
interface IDataSet<T> {
  all(): readonly T[];
  random(): T;
  next(): T;                    // round-robin theo __VU + __ITER
  pickByVU(): T;                // __VU % size
  size: number;
}

// project
interface ProjectToolkit {
  api: GeneratedApi;             // từ openapi codegen
  ws: IWsClient;
  auth: AuthRegistry;            // single hoặc multi
  data: Record<string, IDataSet<unknown>>;
  check: (res: Response, expected: number | CheckSpec) => boolean;
  extract: (res: Response, jsonPath: string) => unknown;
  env: (key: string, defaultValue?: string) => string;
}
```

## 5. Project lifecycle

### Bước 1 — Init

```bash
npx @htplus/k6-lib init order-service-k6
```

CLI tạo: `project.config.ts` (template), `.env.example`, `openapi.yaml` (placeholder), `scenarios/smoke/health.test.ts` (1 file mẫu), `package.json`.

### Bước 2 — Cấu hình

```typescript
// project.config.ts
import {
  defineProject,
  passwordAuth,
  apiKeyAuth,
  csvUsers,
  jsonData,
} from '@htplus/k6-lib';

export default defineProject({
  name: 'order-service',
  baseURL: {
    default: 'http://localhost:3000',
    staging: 'https://staging.api.htplus.software',
    prod:    'https://api.htplus.software',
  },
  openapi: './openapi.yaml',

  auth: {
    user: passwordAuth({
      loginPath: '/auth/login',
      body: (u) => ({ email: u.email, password: u.password }),
      extractToken: 'data.token',
      extractRefreshToken: 'data.refresh_token',
      refreshPath: '/auth/refresh',
      pool: { size: 100, rotation: 'round-robin' },
    }),
    internal: apiKeyAuth({
      key: env('INTERNAL_API_KEY'),
      location: 'header',
      name: 'X-API-Key',
    }),
  },

  testUsers: csvUsers('./test-users.csv'),
  testData: {
    posts: jsonData('./data/posts.json'),
    queries: jsonData('./data/search-queries.json'),
  },

  websocket: {
    path: '/ws',
    authMode: 'query',
    queryName: 'token',
  },

  tags: { service: 'order-svc' },
  thresholds: 'api',                  // preset, có thể override
  defaultTimeout: '30s',
  reuseConnections: true,
});
```

### Bước 3 — Codegen từ OpenAPI

```bash
npx k6-lib gen
```

Đọc `openapi.yaml` → sinh `src/generated/api.ts`:

```typescript
// AUTO-GENERATED — DO NOT EDIT
export const api = {
  posts: {
    list:   (query?: PostsListQuery, opts?: CallOpts) => client.get('/posts', { params: query, ...opts }),
    get:    (id: number, opts?: CallOpts)              => client.get(`/posts/${id}`, opts),
    create: (body: CreatePostBody, opts?: CallOpts)    => client.post('/posts', body, opts),
    update: (id: number, body: UpdatePostBody, opts?: CallOpts) => client.put(`/posts/${id}`, body, opts),
    delete: (id: number, opts?: CallOpts)              => client.del(`/posts/${id}`, opts),
  },
  users: { /* ... */ },
};
```

Kèm types đầy đủ → IDE auto-complete.

### Bước 4 — Viết test

**Smoke 1 endpoint:**

```typescript
// scenarios/smoke/list-posts.test.ts
import project from '../../project.config';
import { ScenarioBuilder } from '@htplus/k6-lib';
export { handleSummary } from '@htplus/k6-lib/reporter';

const { api } = project;

export const options = ScenarioBuilder.smoke(5, '1m').build();

export default function () {
  const res = api.posts.list({ limit: 20 }, { auth: 'user' });
  project.check(res, 200);
}
```

**Load CRUD flow:**

```typescript
// scenarios/load/posts-crud.test.ts
import project from '../../project.config';
import { ScenarioBuilder, group } from '@htplus/k6-lib';
export { handleSummary } from '@htplus/k6-lib/reporter';

const { api, data, check, extract } = project;

export const options = ScenarioBuilder.load(80, '10m').build();

export default function () {
  group('create-read-update-delete', () => {
    const body = data.posts.random();
    const created = api.posts.create(body, { auth: 'user' });
    const id = extract(created, 'data.id') as number;
    if (!id) return;
    api.posts.get(id, { auth: 'user' });
    api.posts.update(id, { ...body, title: 'updated' }, { auth: 'user' });
    api.posts.delete(id, { auth: 'user' });
  });
}
```

**WebSocket load:**

```typescript
// scenarios/ws/chat-load.test.ts
import project from '../../project.config';
import { ScenarioBuilder } from '@htplus/k6-lib';

export const options = ScenarioBuilder.load(200, '5m').build();

export default function () {
  project.ws.connect('/chat', { auth: 'user' }, (socket) => {
    socket.onOpen(() => socket.sendJSON({ type: 'subscribe', room: 'general' }));
    socket.onMessage(() => { /* ws_msg_rtt_ms tự track */ });
    socket.sendEvery('1s', () => ({ type: 'ping', t: Date.now() }));
    socket.waitFor('30s');
  });
}
```

### Bước 5 — Chạy

```bash
npm run test scenarios/load/posts-crud.test.ts
npm run test scenarios/load                    # chạy tất cả test trong folder
npm run test scenarios/                        # chạy tất cả
ENV=staging npm run test scenarios/smoke       # đổi env
```

## 7. Auth providers — bảng quyết định

| Provider | Khi nào dùng |
|----------|--------------|
| `passwordAuth` | Hệ thống có email/username + password, trả JWT. **Phổ biến nhất.** |
| `oauth2ClientCredentials` | Service-to-service, có client_id/client_secret. |
| `oauth2Password` | Legacy OAuth2 resource owner password grant. |
| `apiKeyAuth` | Public API hoặc internal API key. |
| `basicAuth` | Hệ thống cũ. |
| `bearerStaticAuth` | Test internal/staging, đã có token cố định. |
| `jwtRefreshAuth` | JWT có refresh token, cần auto-refresh khi 401 trong soak test. |
| `hmacAuth` | Payment/banking, request signing. |
| `customAuth` | Flow đặc thù không khớp template — escape hatch. |

Tất cả implement chung `IAuthProvider` → có thể mix trong cùng `defineProject({ auth: { user, admin, internal } })`.

## 8. Tối ưu hiệu năng — mặc định bật sẵn

Lib enforce sẵn các best practice, dev không cần biết:

| Tối ưu | Cơ chế |
|--------|--------|
| Test data load 1 lần share giữa các VU | `SharedArray` cho mọi CSV/JSON |
| Token pool pre-login | `setup()` login N user, share token qua `SharedArray` |
| Connection reuse | `noConnectionReuse: false` mặc định |
| Tag chuẩn cho mọi request | `{ service, endpoint, scenario, env }` auto-attach |
| Discard body khi throughput test | `discardResponseBodies: true` khi dùng `.throughput()` |
| Batch request | `client.batch([...])` wrap `http.batch()` |
| Auto-refresh token | provider tự bắt 401 → refresh → retry |
| Graceful stop | mỗi scenario có `gracefulStop` mặc định |

## 9. Reporting

Mặc định mỗi lần test sinh:

```
results/<service>/<scenario>/<test-name>_<timestamp>/
├── dashboard-report.html      # k6 web dashboard, mở browser xem
├── summary.json               # tổng quan
├── result.json                # raw metric
├── result.csv                 # cho Excel
└── junit.xml                  # cho CI parse
```

Optional output (config trong `defineProject`):
- Prometheus remote write → Grafana
- Slack/Teams webhook khi threshold fail

## 10. Threshold preset

Mặc định lib có 5 preset, dev chọn 1 hoặc compose:

| Preset | Khi nào dùng |
|--------|--------------|
| `api` | API thường (p95 < 1s, error < 1%) |
| `auth` | Endpoint auth (p95 < 1s, request < 500ms) |
| `strict` | API quan trọng (p95 < 500ms, error < 0.1%) |
| `relaxed` | Stress test (p95 < 2s, error < 5%) |
| `ws` | WebSocket (connect < 500ms, RTT < 200ms) |

Compose:

```typescript
thresholds: createThresholds(
  { 'api_duration_ms': ['p(95)<800'] },   // custom
  CommonThresholdPresets.api               // base
)
```

## 11. CLI commands

```
k6-lib init <name>           # Tạo project mới từ template
k6-lib gen [--spec=...]      # Sinh code từ OpenAPI
k6-lib run <path>            # Chạy test (wrap k6 run + setup output)
k6-lib run <folder>          # Chạy tất cả test trong folder
k6-lib validate              # Validate project.config.ts + openapi.yaml
```
