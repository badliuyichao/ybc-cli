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

## 9. 已知缺口

| 缺口 | 详情 | 追踪 |
|------|------|------|
| **E2E token-refresh 全部失败** | MockBipServer 与 CLI 的数据中心查询/签名/鉴权模式不匹配 | `ROADMAP.md` |
| **ApiHttpWrapper 无测试** | `src/services/api/api-http-wrapper.ts`（新建）尚未覆盖 | 待补 |
| **UpdateChecker 无测试** | `src/services/update/update-checker.ts` 无任何测试 | 待补 |
| **api-client-service 无独立测试** | 仅在集成测试中间接覆盖 | 待补 |
| **voucher 域未实现** | OpenAPI 规范中未定义，无法测试 | `ROADMAP.md` Phase 2 |
| **跨平台 CI 矩阵未搭建** | Windows/macOS/Linux 自动化测试未配置 | 待补 |

---

## 10. 参考

- 架构与鉴权：`docs/design/architecture.md`
- 需求与验收标准：`docs/design/requirements.md`
- 审计报告（代码 vs 文档差异）：`docs/process/audit-code-vs-design.md`
- 当前待办：根目录 `ROADMAP.md`
