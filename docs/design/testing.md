# 测试策略

> 基于 ybc v0.1.6 实际代码现状。覆盖范围、文件位置、工具链、用例数均与实际一致。

---

## 1. 测试分层

| 层 | 位置 | 工具 | 作用 |
|---|------|------|------|
| **单元测试** | `tests/unit/` | Jest + ts-jest | 单模块逻辑、Mock 外部依赖 |
| **集成测试** | `tests/integration/` | Jest + axios-mock-adapter | 多模块串联、鉴权流程、HTTP 交互 |
| **E2E 测试** | `tests/e2e/` | Jest + Express Mock Server (`tests/mocks/mock-bip-server.ts`) | 完整 CLI 命令执行 |

---

## 2. 目录结构（实际）

```
tests/
├── setup.ts                              # Jest 全局 setup
├── mocks/
│   └── mock-bip-server.ts                # Express Mock Server（端口可配，默认 3000）
├── unit/
│   ├── cli/output/                       # 6 个：formatter + json + table + csv + raw + index
│   ├── infrastructure/                   # 6 个：encryption + env + file-storage + http(3)
│   ├── services/
│   │   ├── auth/                         # 3 个：token-manager + signature + datacenter
│   │   ├── config/                       # 1 个：config-service
│   │   ├── error/                        # 3 个：codes + errors + error-handler
│   │   └── logger/                       # 1 个：logger
│   └── scripts/                          # 1 个：generate-commands
├── integration/
│   ├── auth/                             # 2 个：auth-flow + token-flow
│   ├── http/                             # 1 个：http-flow
│   └── full-flow.test.ts                 # 1 个：端到端集成
└── e2e/
    ├── commands/                         # 2 个：staff-query + todo-list
    ├── config/                           # 3 个：config-init + config-show + config-set
    └── scenarios/                        # 3 个：token-refresh + error + performance
```

---

## 3. 各模块测试详情

### 3.1 单元测试

#### Service 层

| 模块 | 文件 | 用例数 | 关键覆盖 |
|------|------|-------|---------|
| TokenManager | `token-manager.test.ts` | 23 | 三级缓存命中/过期/刷新；配置指纹校验；401 处理 |
| SignatureService | `signature-service.test.ts` | 20 | HmacSHA256 五步算法；参数排序；Base64 格式；一致性/差异性 |
| DataCenterService | `datacenter-service.test.ts` | 19 | API 调用；响应解析；缓存命中/失效；错误处理 |
| ConfigService | `config-service.test.ts` | 28 | 初始化/读取/设置；tenantId/appKey/appSecret 校验；加密/解密；环境变量合并 |
| ErrorHandler | `error-handler.test.ts` | 24 | AuthError/NetworkError/BusinessError 统一出口；退出码映射 |
| Error Codes | `codes.test.ts` | 9 | 退出码定义；描述映射 |
| Error Classes | `errors.test.ts` | 38 | AuthError/BusinessError/NetworkError/ValidationError 实例化与属性 |
| Logger | `logger.test.ts` | 17 | 日志级别；敏感字段过滤 |

#### Infrastructure 层

| 模块 | 文件 | 用例数 | 关键覆盖 |
|------|------|-------|---------|
| EncryptionService | `encryption-service.test.ts` | 24 | AES-256-GCM 加密/解密；密钥派生；损坏数据处理 |
| EnvService | `env-service.test.ts` | 42 | 环境变量读写；必需字段校验；默认值；新/旧字段兼容 |
| FileStorage | `file-storage.test.ts` | 22 | JSON 读写；文件权限 600；不存在/损坏处理 |
| Auth Interceptor | `auth-interceptor.test.ts` | 7 | Token 注入 Header；过期检测 |
| HTTP Client | `http-client.test.ts` | 9 | 超时；baseURL；拦截器注册 |
| Logging Interceptor | `logging-interceptor.test.ts` | 16 | 请求/响应日志；敏感字段过滤 |

#### CLI 输出层

| 模块 | 文件 | 用例数 |
|------|------|-------|
| Formatter 接口 | `formatter.test.ts` | 4 |
| JSON | `json.test.ts` | 14 |
| Table | `table.test.ts` | 18 |
| CSV | `csv.test.ts` | 19 |
| Raw | `raw.test.ts` | 14 |
| Output Index | `index.test.ts` | 16 |

#### 脚本

| 模块 | 文件 | 用例数 |
|------|------|-------|
| generate-commands | `generate-commands.test.ts` | 16 |

---

### 3.2 集成测试

| 模块 | 文件 | 用例数 | 关键覆盖 |
|------|------|-------|---------|
| Auth Flow | `auth-flow.test.ts` | 8 | 完整鉴权流程：配置加载 → Token 获取 → API 调用 |
| Token Flow | `token-flow.test.ts` | 13 | Token 获取新流程：数据中心查询 → 签名 → GET getAccessToken |
| HTTP Flow | `http-flow.test.ts` | 12 | HTTP 客户端拦截器链：认证注入 + 日志 |
| Full Flow | `full-flow.test.ts` | 10 | config init → 多命令串联 → 输出验证 |

---

### 3.3 E2E 测试

#### Commands（命令注册与参数验证）

| 测试 | 文件 | 用例数 | 状态 |
|------|------|-------|------|
| staff query | `staff-query.test.ts` | 13 | ✅ 通过 |
| todo list | `todo-list.test.ts` | 13 | ✅ 通过 |

> 注意：这两个 E2E 测试是**单元风格的 E2E**——直接在进程内构造 commander 实例并解析参数，验证命令注册、选项定义和帮助信息，**不实际执行 HTTP 请求**。

#### Config（配置命令端到端）

| 测试 | 文件 | 用例数 | 状态 |
|------|------|-------|------|
| config init | `config-init.test.ts` | 8 | ✅ 通过 |
| config show | `config-show.test.ts` | 5 | ✅ 通过 |
| config set | `config-set.test.ts` | 10 | ✅ 通过 |

#### Scenarios（完整场景，依赖 MockBipServer）

| 测试 | 文件 | 用例数 | 状态 |
|------|------|-------|------|
| Token Refresh | `token-refresh.test.ts` | 10 | ❌ **全部失败**（Mock Server 与 CLI 之间接口不匹配） |
| Error Scenarios | `error-scenarios.test.ts` | 13 | ⚠️ 部分通过（退出码验证逻辑有偏差） |
| Performance | `performance.test.ts` | 10 | ⚠️ 部分通过 |

> Token Refresh 全部失败根因：`MockBipServer` 未注册数据中心查询端点；Token 端点校验旧字段 `ak/sk` 而非新字段 `appKey/timestamp/signature`；业务端点检查 `Authorization` Header 但 CLI 用 query 参数。见 `docs/process/audit-code-vs-design.md` 的 E2E 分析。

---

## 4. 测试工具

| 工具 | 用途 | 状态 |
|------|------|------|
| **Jest + ts-jest** | 测试框架 + TypeScript 编译 | ✅ 已安装 |
| **axios-mock-adapter** | 集成测试 HTTP Mock | ✅ 已安装 |
| **Express** | E2E Mock BIP Server | ✅ 已安装 |
| **Node child_process (execSync)** | E2E CLI 子进程执行 | ✅ 内置 |
| **FileStorage (自研)** | 测试中模拟 `~/.ybc/` 文件系统 | ✅ 已用 |

以下工具在旧版测试方案中列出但**未安装**：nock、sinon、faker、chance、mockdate、Playwright、keytar。

---

## 4.1 Mock Server 详解（tests/mocks/mock-bip-server.ts）

### 技术栈

| 组件 | 版本 | 用途 |
|------|------|------|
| **Express** | ^5.2.1 | Web 框架，搭建 Mock API Server |
| **TypeScript** | ^5.2.0 | 类型安全 |
| **@types/express** | ^5.0.6 | Express 类型定义 |

### 启动方式

```typescript
import { MockBipServer } from '../../mocks/mock-bip-server';

// 创建并启动
const mockServer = new MockBipServer({ port: 3000 });
await mockServer.start();

// 停止
await mockServer.stop();

// 获取 URL
const url = mockServer.getUrl();  // http://localhost:3000
```

### 已实现接口列表

| 端点 | 方法 | 功能 | 状态码 | 校验逻辑 |
|------|------|------|--------|---------|
| `/open-auth/selfAppAuth/base/v1/getAccessToken` | GET/POST | 获取 Token | 200/401 | 校验 ak/sk 长度 |
| `/api/staff/query` | POST | 查询员工 | 200/401/403/404 | 校验 Authorization Header |
| `/api/todo/list` | POST | 获取待办列表 | 200/401 | 校验 Authorization Header |
| `/api/error/401` | GET | 模拟 401 错误 | 401 | 无 |
| `/api/error/429` | GET | 模拟 429 限流 | 429 | 无 |
| `/api/error/500` | GET | 模拟 500 错误 | 500 | 无 |

### 接口报文格式

#### Token 获取接口

**请求**（GET）：
```
GET /open-auth/selfAppAuth/base/v1/getAccessToken?ak=xxx&sk=xxx
```

**响应**（成功）：
```json
{
  "code": "00000",
  "message": "成功",
  "data": {
    "access_token": "mock-token-1234567890-abc123",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

**响应**（失败）：
```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Invalid AK/SK"
}
```

**校验规则**：
- `ak` 长度 ≥ 8
- `sk` 长度 ≥ 14

---

#### 员工查询接口

**请求**：
```
POST /api/staff/query
Authorization: Bearer <token>
Body: { "code": "EMP001" }
```

**响应**（成功）：
```json
{
  "code": "SUCCESS",
  "message": "查询成功",
  "data": {
    "staffs": [
      {
        "code": "EMP001",
        "name": "张三",
        "department": "研发部",
        "status": "enabled"
      }
    ],
    "total": 1
  }
}
```

**特殊参数触发错误**：
| 参数 | 返回错误 | 状态码 |
|------|---------|--------|
| `code=INVALID_CODE` | NOT_FOUND | 404 |
| `department=SECRET_DEPT` | PERMISSION_DENIED | 403 |
| `page=-1` | INVALID_PARAMETER | 400 |

---

#### 待办列表接口

**响应**（成功）：
```json
{
  "code": "SUCCESS",
  "message": "查询成功",
  "data": {
    "todos": [
      {
        "id": "TODO001",
        "title": "完成Phase1验收",
        "status": "pending",
        "assignee": "张三",
        "dueDate": "2026-04-30"
      }
    ],
    "total": 1
  }
}
```

---

### 已知问题（与 CLI 不匹配）

| 问题 | Mock Server 实现 | CLI 实际调用 | 影响 |
|------|-----------------|-------------|------|
| **鉴权方式** | 校验 `ak/sk` 参数 | 使用 `appKey/timestamp/signature` 签名 | Token 获取失败 |
| **业务接口鉴权** | 检查 `Authorization` Header | 使用 query 参数传递 token | 业务调用失败 |
| **数据中心查询** | 未实现 `/getGatewayAddress` | 需要先查询数据中心域名 | 流程无法启动 |
| **Token 响应格式** | 标准格式 | 支持多种格式（expires_in/expire） | 可能解析失败 |

> 详见 `ROADMAP.md` 任务 4：Mock Server 问题修复

---

## 5. 覆盖率目标

| 层级 | 目标 | 当前 |
|------|------|------|
| 单元测试（Service + Infrastructure） | ≥ 80% | ✅ ~90%（SignatureService 100%、DataCenterService 97.5%）|
| 集成测试（鉴权 + 命令流程） | ≥ 70% | ✅ Token Flow 82% |
| E2E（核心场景） | 100% 通过 | ⚠️ Token Refresh 0% 通过，待修复 Mock Server |

---

## 6. 运行命令

```bash
npm test                                    # 全部测试
npm run test:unit                           # 仅单元测试
npm run test:integration                    # 仅集成测试
npm run test:e2e                            # 仅 E2E 测试
npm run test:coverage                       # 生成覆盖率 HTML → coverage/lcov-report/index.html

# 单个文件
npm test -- token-manager.test.ts

# 按名称匹配
npm test -- --testNamePattern="getValidToken"
```

---

## 7. 测试编写规范

### 单元测试

```typescript
// 模式：Jest + ts-jest，使用路径别名 '@/'
import { SignatureService } from '@/services/auth/signature-service';

describe('SignatureService', () => {
  let service: SignatureService;

  beforeEach(() => {
    service = new SignatureService();
  });

  it('should calculate signature correctly', () => {
    const signature = service.calculateSignature({
      appKey: '41832a3d2df94989b500da6a22268747',
      timestamp: 1568098531823,
      appSecret: 'test-secret',
    });
    expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);  // Base64 format
  });
});
```

### 集成测试

```typescript
// 模式：MockAdapter + 临时文件系统
import MockAdapter from 'axios-mock-adapter';
import { TokenManager } from '@/services/auth/token-manager';

describe('Token Flow', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    // Mock 数据中心查询
    mockAxios.onGet(/getGatewayAddress/).reply(200, {
      code: '00000',
      data: { gatewayUrl: 'https://test/iuap-api-gateway', tokenUrl: 'https://test/iuap-api-auth' },
    });
    // Mock Token 获取
    mockAxios.onGet(/getAccessToken/).reply(200, {
      code: '00000',
      data: { access_token: 'test-token', expire: 7200 },
    });
  });

  afterEach(() => { mockAxios.reset(); });
});
```

### E2E 测试（命令验证模式）

```typescript
// 模式：进程内构造 commander，验证命令注册与参数
import { Command } from 'commander';
import { registerStaffApiQueryStaffCommand } from '@/cli/commands/generated/staff/queryStaff';

describe('staff query E2E', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerStaffApiQueryStaffCommand(program);
  });

  it('should register query command with correct options', () => {
    const cmd = program.commands.find(c => c.name() === 'query');
    expect(cmd).toBeDefined();
    expect(cmd?.options.find(o => o.long === '--code')).toBeDefined();
  });
});
```

### E2E 测试（完整场景模式，依赖 MockBipServer）

```typescript
// 模式：启动 Express Mock Server → execSync 执行真实 CLI
import { execSync } from 'child_process';
import { MockBipServer } from '../../mocks/mock-bip-server';

describe('Token Refresh E2E', () => {
  let mockServer: MockBipServer;

  beforeAll(async () => {
    mockServer = new MockBipServer({ port: 4001 });
    await mockServer.start();
  });

  afterAll(async () => { await mockServer.stop(); });

  it('should auto-refresh expired token', () => {
    // ⚠️ 当前 Mock Server 需与 CLI URL 机制对接后方可运行
    // 见 ROADMAP.md 中 E2E 补完计划
  });
});
```

---

## 8. 安全测试要点

以下通过代码评审 + 单元测试双重保障：

| 检查项 | 方式 |
|--------|------|
| `appSecret` 不出现在日志/错误消息 | `logger.test.ts` 验证过滤函数 |
| `~/.ybc/*.json` 文件权限 600 | `file-storage.test.ts` 使用 `fs.statSync` 校验 mode |
| `configFingerprint` = sha256（不存明文）| `token-manager.test.ts` 验证哈希格式 |
| `encryption-service` 使用 AES-256-GCM | `encryption-service.test.ts` 验证算法参数 |

---

## 9. 真实 API 测试方案

### 9.1 设计背景

> 用友 BIP 采用多数据中心架构，API 入口固定为 `https://api.yonyoucloud.com`。
> 实际的业务域名（`gatewayUrl`）和 Token 域名（`tokenUrl`）由 `DataCenterService` 根据 `tenantId` 动态查询返回。
> 因此，所有环境都连接同一个固定地址，不需要区分 sandbox / production。

### 9.2 密钥配置

#### 方式 1：环境变量（推荐用于 CI/CD）

```bash
export YBC_TEST_TENANT_ID=your-tenant-id
export YBC_TEST_APP_KEY=your-app-key
export YBC_TEST_APP_SECRET=your-app-secret
```

#### 方式 2：测试配置文件（推荐用于本地开发）

创建 `tests/config/test-credentials.json`（已在 .gitignore 中忽略）：

```json
{
  "tenantId": "your-tenant-id",
  "appKey": "your-app-key",
  "appSecret": "your-app-secret"
}
```

> ⚠️ **安全警告**：`test-credentials.json` 包含真实凭证，绝对不能提交到 Git。

### 9.3 配置加载器

```typescript
// tests/config/test-config.ts
import { loadTestConfig } from '../config/test-config';

const config = loadTestConfig();
// config.tenantId, config.appKey, config.appSecret
```

### 9.4 E2E 测试示例（真实 API）

```typescript
// tests/e2e/scenarios/real-api.test.ts
import { loadTestConfig } from '../config/test-config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

describe('Real API E2E Tests', () => {
  let config: ReturnType<typeof loadTestConfig>;
  let tempDir: string;

  beforeAll(() => {
    config = loadTestConfig();
    tempDir = path.join(os.tmpdir(), `ybc-real-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should get token from real API', () => {
    const testEnv = {
      ...process.env,
      HOME: tempDir,
      USERPROFILE: tempDir,
      YBC_TENANT_ID: config.tenantId,
      YBC_APP_KEY: config.appKey,
      YBC_APP_SECRET: config.appSecret,
    };

    // 执行查询（会自动查询数据中心、获取 Token）
    const result = execSync(
      'npx ts-node src/bin/ybc.ts staff query --code EMP001',
      { env: testEnv, cwd: process.cwd(), encoding: 'utf-8' }
    );

    expect(result).toBeDefined();
  });
});
```

### 9.5 测试策略总结

| 场景 | 测试类型 | Mock 方式 | 说明 |
|------|---------|----------|------|
| **CI/CD 自动化** | 单元测试 + 集成测试 | axios-mock-adapter | 安全、快速、稳定 |
| **本地开发调试** | E2E（真实 API） | 无 Mock | 真实验证 |
| **上线前验证** | E2E（真实 API） | 无 Mock | 最终确认 |
| **命令注册验证** | E2E（命令模式） | jest.mock('axios') | 不需要真实 API |

### 9.6 运行真实 API 测试

```bash
# 本地运行（需要先配置 test-credentials.json）
npm run test:e2e

# CI/CD 运行（通过环境变量注入）
YBC_TEST_TENANT_ID=xxx YBC_TEST_APP_KEY=xxx YBC_TEST_APP_SECRET=xxx npm run test:e2e
```

---

## 10. 已知缺口

| 缺口 | 详情 | 追踪 |
|------|------|------|
| **ApiHttpWrapper 无测试** | `src/services/api/api-http-wrapper.ts`（新建）尚未覆盖 | 待补 |
| **UpdateChecker 无测试** | `src/services/update/update-checker.ts` 无任何测试 | 待补 |
| **api-client-service 无独立测试** | 仅在集成测试中间接覆盖 | 待补 |
| **voucher 域未实现** | OpenAPI 规范中未定义，无法测试 | `ROADMAP.md` Phase 2 |
| **跨平台 CI 矩阵未搭建** | Windows/macOS/Linux 自动化测试未配置 | 待补 |

---

## 11. 参考

- 架构与鉴权：`docs/design/architecture.md`
- 需求与验收标准：`docs/design/requirements.md`
- 审计报告（代码 vs 文档差异）：`docs/process/audit-code-vs-design.md`
- 当前待办：根目录 `ROADMAP.md`
- 测试配置：`tests/config/test-config.ts`
