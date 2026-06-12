# 架构设计

> 本文档是 ybc 当前架构的权威说明。鉴权相关详见独立文档：[`ref/auth-spec.md`](ref/auth-spec.md)。

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

## 2. 目录结构（与实际代码一一对应）

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

## 3. OpenAPI 驱动的命令生成（核心范式）

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
   └─ TokenManager.getValidToken(config)
         ├─ 命中内存 → 返回
         ├─ 命中 ~/.ybc/token.json + 未过期 + 指纹匹配 → 返回
         └─ 未命中 → SignatureService 计算签名 → GET tokenUrl/.../getAccessToken
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

详细鉴权流程（含签名算法）见 [`ref/auth-spec.md`](ref/auth-spec.md)。

---

## 5. 持久化文件

| 文件 | 内容 | 权限 | 维护方 |
|------|------|------|--------|
| `~/.ybc/config.json` | 配置（含加密 appSecret）| 600 | `ConfigService` |
| `~/.ybc/token.json` | Token 缓存（含 `configFingerprint`）| 600 | `TokenManager` |
| `~/.ybc/datacenter.json` | 数据中心域名缓存（按 tenantId）| 600 | `DataCenterService` |

---

## 6. 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行语言 | TypeScript 5 | 类型安全、IDE 友好 |
| CLI 框架 | commander.js 11 | 成熟、子命令、自动 help |
| HTTP | axios | OpenAPI Generator 默认 |
| 加密 | Node `crypto` | AES-256-GCM、HmacSHA256，无第三方依赖 |
| 配置缓存 | 自研 `FileStorage` | 简单 JSON + 文件权限控制 |
| 表格输出 | cli-table3 | 颜色、对齐 |
| 颜色 | chalk 4 | 与 cli-table3 配套 |
| OpenAPI 生成 | @openapitools/openapi-generator-cli | 自动同步 API → 客户端 |
| 测试 | Jest + ts-jest | TypeScript 友好；`axios-mock-adapter` 用于集成层；Express 写 Mock Server 用于 E2E |
| 代码风格 | ESLint + Prettier | 标配 |

---

## 7. 关键架构决策（ADR 速查）

| ADR | 决策 | 详细位置 |
|-----|------|---------|
| **ADR-1** | 用 TypeScript 而非 JavaScript | 类型安全 + IDE 重构 |
| **ADR-2** | 文件缓存而非数据库 | 单用户 CLI，数据量小 |
| **ADR-3** | OpenAPI 自动生成而非手写 300+ API | 见本文第 3 节 |
| **ADR-4** | commander.js 而非 oclif | 项目规模中等，commander 足够 |
| **ADR-5** | Token 三级缓存（内存 / 文件 / 远程）+ 提前 5 分钟刷新 | 见 [`ref/auth-spec.md`](ref/auth-spec.md) §4 |
| **ADR-6** | URLEncode 由 axios 而非 SignatureService 负责 | 见 [`ref/auth-spec.md`](ref/auth-spec.md) ADR-1 |
| **ADR-7** | 数据中心域名动态查询 + 缓存 | 见 [`ref/auth-spec.md`](ref/auth-spec.md) ADR-2 |
| **ADR-8** | 业务接口用 `access_token` query 参数（非 Authorization Header）| 见 [`ref/auth-spec.md`](ref/auth-spec.md) ADR-3 |

---

## 8. 非功能性要求

| 类别 | 目标 | 现状 |
|------|------|------|
| **CLI 启动** | < 500ms（编译版）| ✅ ~150ms（ts-node ~1000ms）|
| **首次 API 调用** | < 2s（含数据中心查询 + Token 获取）| ✅ 接近目标 |
| **后续 API 调用** | < 1s（缓存命中）| ✅ 达成 |
| **测试覆盖率** | 单元 ≥80%、集成 ≥70% | ✅ 单元 ~90%、新模块 100% |
| **跨平台** | Windows / macOS / Linux | ✅ Node.js ≥16 |
| **安全** | `appSecret` 加密、文件 600、绝不日志暴露 | ✅ 已实施 |

---

## 9. 演进路线

| 阶段 | 状态 | 范围 |
|------|------|------|
| **Phase 1** | ✅ 完成 | 基础架构、Token 改造、staff + todo 两个域 |
| **Phase 2** | 🟡 进行中 | 见 [`../../ROADMAP.md`](../../ROADMAP.md)：补 voucher 域、修剩余 E2E、真实 API 验证 |
| **Phase 3** | 待启动 | 覆盖 90% API、批量调用、模板 |
| **Phase 4** | 待启动 | 大模型友好（`--help-json`）、插件机制 |

---

## 10. 参考

- 鉴权完整设计与 API 规范：[`ref/auth-spec.md`](ref/auth-spec.md)
- 测试策略：[`testing.md`](testing.md)
- 安全方案：[`security.md`](security.md)
- 需求与验收：[`requirements.md`](requirements.md)
