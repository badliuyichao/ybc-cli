# 架构设计

> 本文档是 ybc 系统架构、鉴权机制与关键设计决策的**唯一权威说明**。

---

## 1. 总览：4 层架构

```
┌──────────────────────────────────────────────────────────────┐
│ CLI 层                                                       │
│   commander 解析 → 命令注册 → 输出适配器 (json/table/csv/raw) │
├──────────────────────────────────────────────────────────────┤
│ Service 层                                                   │
│   config / auth (token + signature + datacenter) /            │
│   api / error / logger                                        │
├──────────────────────────────────────────────────────────────┤
│ API 层                                                       │
│   OpenAPI 自动生成的 TypeScript 客户端 (axios)                │
├──────────────────────────────────────────────────────────────┤
│ Infrastructure 层                                            │
│   file-storage / crypto / env / http                          │
└──────────────────────────────────────────────────────────────┘
```

**职责边界**：
- CLI 层 **不直接**调用 axios，必须经 Service 层
- Service 层 **不直接**读写 `~/.ybc/*.json`，必须经 Infrastructure 层
- API 层主要是自动生成代码，少量手写覆盖位于 `src/cli/commands/<domain>/`

---

## 2. 目录结构

```
src/
├── bin/ybc.ts                          # 入口 (#!/usr/bin/env node)
├── cli/
│   ├── index.ts                        # bootstrap() 启动函数
│   ├── program.ts                      # commander 全局选项
│   ├── commands/
│   │   ├── config/                     # 手写：config init/show/set
│   │   └── generated/                  # ⚠️ 自动生成
│   │       ├── staff/                  # query/enable/disable
│   │       └── todo/                   # list/create
│   └── output/                         # formatter + json/table/csv/raw
├── services/
│   ├── auth/                           # token-manager + signature + datacenter
│   ├── config/                         # config-service
│   ├── api/                            # api-client-service (统一工厂)
│   ├── error/                          # codes + errors + error-handler
│   └── logger/                         # logger
├── api/generated/                      # ⚠️ 自动生成（OpenAPI Generator）
├── infrastructure/
│   ├── storage/                        # file-storage
│   ├── crypto/                         # encryption-service (AES-256-GCM)
│   ├── env/                            # env-service
│   └── http/                           # http-client + auth/logging 拦截器
└── types/                              # auth / config / error / http / infrastructure
```

---

## 3. OpenAPI 驱动的命令生成

ybc 的命令**不是手动编写**，而是从 OpenAPI 规范自动生成：

```
openapi/openapi.yaml                                   ← 唯一事实来源
  │ npm run generate:api  (openapi-generator-cli)
  ▼
src/api/generated/api.ts (StaffApi / TodoApi / …)      ← 不可手改
  │ npm run generate:commands  (scripts/generate-commands.ts)
  ▼
src/cli/commands/generated/<domain>/*.ts               ← 不可手改
  │ 启动时由 src/cli/index.ts 注册到 commander
  ▼
ybc staff query / ybc todo list / …
```

**关键约束**：
- 修改 API 必须改 `openapi/openapi.yaml`，然后重新生成
- 业务逻辑覆盖写到 `src/cli/commands/<domain>/`（非 `generated/`），不污染生成区

---

## 4. 命令执行流程

```
用户输入 ybc staff query --code EMP001 --format json
   │
   ▼
[CLI 层] commander 解析参数 → 命中 queryStaff action
   │
   ▼
[Service 层] ApiClientService.getConfiguration()
   ├─ ConfigService.getConfig()         # 读配置（含环境变量优先）
   ├─ DataCenterService.getDataCenterUrls(tenantId)
   │     ├─ 命中 ~/.ybc/datacenter.json  → 返回
   │     └─ 未命中 → GET api.yonyoucloud.com/.../getGatewayAddress
   └─ TokenManager.getValidToken(config)    # 详见 §5
   │
   ▼
[API 层 / 业务命令] axios.get(gatewayUrl + path, {params: {access_token, ...}})
   │
   ▼
[输出层] OutputManager.output(result, format) → stdout
   │
   ▼
[退出] 0 (成功) / 4 (业务错误) / 5 (网络) / 6 (鉴权)
```

---

## 5. 鉴权机制

用友 YonBIP 采用**多数据中心架构**，开发者调用接口前必须：先按 `tenantId` 查询数据中心域名 → 用 HmacSHA256 签名换取 `access_token` → 携带 token 调用业务接口。

### 5.1 三类外部 API

**数据中心域名查询**

| 项 | 值 |
|---|---|
| URL | `https://api.yonyoucloud.com/open-auth/dataCenter/getGatewayAddress` |
| 方法 | GET |
| 参数 | `tenantId`（必需）|

**响应**：
```json
{
  "code": "00000",
  "data": {
    "gatewayUrl": "https://yonbip.diwork.com/iuap-api-gateway",
    "tokenUrl":   "https://yonbip.diwork.com/iuap-api-auth"
  }
}
```

**Token 获取**

| 项 | 值 |
|---|---|
| URL | `{tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken` |
| 方法 | **GET**（不是 POST）|
| Header | `Content-Type: application/json`（GET 也必需）|
| 参数 | `appKey`、`timestamp`（毫秒级）、`signature`|

> 2023-07-21 升级：旧路径 `/selfAppAuth/getAccessToken` → 新路径 `/selfAppAuth/base/v1/getAccessToken`。ybc 已采用新路径。

**业务接口调用**

| 项 | 值 |
|---|---|
| Base URL | `{gatewayUrl}` |
| 鉴权方式 | `access_token` 作为 **query 参数**（用友不接受 Authorization Header）|

### 5.2 HmacSHA256 签名算法

```
signature = URLEncode( Base64( HmacSHA256( sortedParams, appSecret ) ) )
```

**五步计算**：

1. 构建参数对象：`{ appKey, timestamp }`
2. 按字母序排序：`["appKey", "timestamp"]`
3. 拼接参数名和值（无分隔符）：`appKey<v>timestamp<v>`
4. HmacSHA256 加密（密钥 = appSecret，UTF-8）
5. Base64 编码

**示例**：`appKey=41832a3d…`、`timestamp=1568098531823` 时，待签字符串为：
```
appKey41832a3d2df94989b500da6a22268747timestamp1568098531823
```

> ⚠️ **URLEncode 由 axios 负责**，不在签名服务中手动编码。双重编码会导致签名校验失败。详见 [ADR-5]。

实现：`src/services/auth/signature-service.ts`。时间戳必须是毫秒级（`Date.now()`），机器时间与互联网偏差 ≤ 5 分钟。

### 5.3 Token 三级缓存

```
用户命令
  → TokenManager.getValidToken()
      ├─ L1 内存缓存（进程内未过期 → 直接返回）
      ├─ L2 ~/.ybc/token.json（文件存在 + 未过期 + configFingerprint 匹配 → 返回）
      └─ L3 远程刷新（L1/L2 均失效时）
           1. DataCenterService → 查询或命中缓存获取 tokenUrl
           2. SignatureService → 生成时间戳 + 计算签名
           3. GET {tokenUrl}/.../getAccessToken?appKey&timestamp&signature
           4. 解析响应 → 写回 ~/.ybc/token.json（600 权限）
```

| 机制 | 细节 |
|------|------|
| **过期判定** | 提前 5 分钟视为过期（`expires_at <= now + 5min`）|
| **configFingerprint** | `sha256(tenantId + appKey + appSecret + env)` — 配置变更立即作废旧 Token |
| **401 重试** | 业务接口 401 → 清除缓存 → 刷新 Token → 重试一次 |
| **数据中心缓存** | `~/.ybc/datacenter.json`，按 tenantId 命中；可手工 seed 用于离线测试 |
| **向后兼容** | 新字段优先（`appKey/appSecret` → fallback `ak/sk`）；响应格式兼容两种 |

### 5.4 类型契约

```typescript
interface TokenConfig {
  tenantId: string;  appKey: string;  appSecret: string;
  env: 'sandbox' | 'production';
  tokenUrl?: string;     // 可选，跳过数据中心查询
  gatewayUrl?: string;   // 可选
}

interface SignatureParams {
  appKey: string;  timestamp: number;  // 毫秒级
  appSecret: string;
}

interface DataCenterResponse {
  code: string;  // '00000' = 成功
  message: string;
  data: { gatewayUrl: string; tokenUrl: string };
}
```

### 5.5 测试覆盖

| 测试 | 用例数 | 覆盖率 |
|------|-------|--------|
| `signature-service.test.ts` | 20 | 100% |
| `datacenter-service.test.ts` | 19 | 97.5% |
| `token-flow.test.ts`（集成）| 13 | 82% |

---

## 6. 持久化文件

| 文件 | 内容 | 权限 | 维护方 |
|------|------|------|--------|
| `~/.ybc/config.json` | 配置（含加密 appSecret）| 600 | `ConfigService` |
| `~/.ybc/token.json` | Token 缓存（含 `configFingerprint`）| 600 | `TokenManager` |
| `~/.ybc/datacenter.json` | 数据中心域名缓存（按 tenantId）| 600 | `DataCenterService` |

---

## 7. 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行语言 | TypeScript 5 | 类型安全、IDE 友好 |
| CLI 框架 | commander.js 11 | 成熟、子命令、自动 help |
| HTTP | axios | OpenAPI Generator 默认 |
| 加密 | Node `crypto` | AES-256-GCM、HmacSHA256，无第三方依赖 |
| 存储 | 自研 `FileStorage` | 简单 JSON + 文件权限控制 |
| 表格输出 | cli-table3 | 颜色、对齐 |
| 测试 | Jest + ts-jest | 集成层 `axios-mock-adapter`，E2E 用 Express Mock Server |
| 代码风格 | ESLint + Prettier | 标配 |

---

## 8. 关键架构决策（ADR）

| ADR | 决策 | 详见 |
|-----|------|------|
| **ADR-1** | TypeScript 而非 JavaScript | 类型安全 + IDE 重构 |
| **ADR-2** | 文件缓存而非数据库 | 单用户 CLI，数据量小 |
| **ADR-3** | OpenAPI 自动生成而非手写 300+ API | 见 §3 |
| **ADR-4** | commander.js 而非 oclif | 项目规模中等 |
| **ADR-5** | URLEncode 由 axios 而非 SignatureService 负责 | 避免双重编码导致签名失效 |
| **ADR-6** | `~/.ybc/datacenter.json` 缓存 + 按 tenantId 命中，而非硬编码 URL | 支持多数据中心；可 seed 用于离线测试 |
| **ADR-7** | `access_token` 用 query 参数而不用 Authorization Header | 用友 BIP 业务接口只认 query 参数 |
| **ADR-8** | `configFingerprint = sha256(…)` 而非明文 | 配置变更即作废旧 Token，不可反推 appSecret |

---

## 9. 非功能性要求

| 类别 | 目标 | 现状 |
|------|------|------|
| CLI 启动 | < 500ms（编译版）| ✅ ~150ms |
| 首次 API 调用 | < 2s（含数据中心查询 + Token）| ✅ 接近目标 |
| 后续 API 调用 | < 1s（缓存命中）| ✅ |
| 测试覆盖率 | 单元 ≥80%、集成 ≥70% | ✅ 单元 ~90% |
| 跨平台 | Windows / macOS / Linux | ✅ Node.js ≥16 |
| 安全 | appSecret 加密、文件 600、绝不日志暴露 | ✅ |

---

## 10. 演进路线

| 阶段 | 状态 | 范围 |
|------|------|------|
| **Phase 1** | ✅ 完成 | 基础架构、Token 改造、staff + todo 两个域 |
| **Phase 2** | 🟡 进行中 | 见 [`../../ROADMAP.md`](../../ROADMAP.md) |
| **Phase 3** | 待启动 | 覆盖 90% API、批量调用、模板 |
| **Phase 4** | 待启动 | 大模型友好（`--help-json`）、插件机制 |
