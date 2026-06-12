# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 重要：语言要求

**所有交互必须使用中文**：用户的所有问题和请求，都必须使用中文回答，包括但不限于：
- 问题解答
- 代码解释
- 任务讨论
- 错误说明
- 进度报告

---

## 项目概览

这是 **ybc**（用友 BIP CLI）项目——一个通过命令行简化用友 BIP OpenAPI 平台 300+ API 端点访问的工具。
具备自动 Token 管理、OpenAPI 驱动的命令生成，以及双模式输出（人类友好的表格 + 机器友好的 JSON）。

**当前状态**：Phase 1 完成（v0.1.6），已实现 `staff` 与 `todo` 两个业务域。Phase 2 待办见根目录 `ROADMAP.md`。

---

## 架构设计

项目采用 **4 层架构**：

```
CLI 层 (commander.js)
    ↓
Service 层 (业务逻辑)
    ↓
API 层 (OpenAPI 生成的客户端)
    ↓
Infrastructure 层 (存储、加密、HTTP)
```

**核心组件**：
- **CLI 层**：commander 命令解析、命令注册、输出适配器（json/table/csv/raw）
- **Service 层**：配置管理（`config-service`）、鉴权（`token-manager` + `signature-service` + `datacenter-service`）、错误处理、日志
- **API 层**：从 OpenAPI 规范自动生成的 TypeScript 客户端 + 业务命令封装
- **Infrastructure 层**：文件存储（`~/.ybc/`）、加密（AES-256-GCM）、HTTP 客户端、环境变量

完整架构与设计决策见 `docs/design/architecture.md`；鉴权机制见 `docs/design/auth-spec.md`。

---

## OpenAPI 驱动开发（关键模式）

**核心模式**：业务命令**不是手动编写**，而是从 OpenAPI 规范自动生成：

```
OpenAPI 规范 (openapi/openapi.yaml)
    ↓ openapi-generator-cli (npm run generate:api)
TypeScript API 客户端 (src/api/generated/)
    ↓ scripts/generate-commands.ts (npm run generate:commands)
CLI 命令定义 (src/cli/commands/generated/)
```

**开发流程**：
1. 在 `openapi/openapi.yaml` 中维护 OpenAPI 规范（**单一事实来源**）
2. 运行 `npm run generate:api` 生成 TypeScript 客户端
3. 运行 `npm run generate:commands` 生成 CLI 命令封装
4. 在 `src/cli/index.ts` 中注册命令组到 commander

---

## 目录结构

```
src/
├── bin/ybc.ts                 # CLI 入口（#!/usr/bin/env node）
├── cli/
│   ├── program.ts             # Commander 初始化 + 全局选项
│   ├── index.ts               # bootstrap()，注册命令
│   ├── commands/
│   │   ├── config/            # 手写：config init/show/set
│   │   └── generated/         # ⚠️ 自动生成（不要手改）
│   └── output/                # json/table/csv/raw 适配器
├── services/
│   ├── auth/                  # token-manager + signature-service + datacenter-service
│   ├── config/, api/, error/, logger/
├── api/generated/             # ⚠️ 自动生成（不要手改）
├── infrastructure/            # storage / crypto / env / http
└── types/                     # 类型定义
```

**关键文件**：
- `src/bin/ybc.ts`：CLI 入口
- `src/cli/program.ts`：commander 程序与全局选项
- `src/services/auth/token-manager.ts`：Token 生命周期管理（核心）
- `src/services/auth/signature-service.ts`：HmacSHA256 签名
- `src/services/auth/datacenter-service.ts`：数据中心域名查询
- `openapi/openapi.yaml`：OpenAPI 规范（真实数据源）

---

## 开发命令

```bash
# 安装与生成
npm install
npm run generate:api          # OpenAPI → TS 客户端
npm run generate:commands     # TS 客户端 → CLI 命令

# 开发调试
npm run dev                   # ts-node 运行
npm run build                 # 编译到 dist/
npm run lint                  # ESLint
npm run format                # Prettier

# 测试
npm test                      # 全部测试
npm run test:unit             # 单元测试
npm run test:integration      # 集成测试
npm run test:e2e              # E2E（部分场景待修，见 ROADMAP）
npm run test:coverage         # 覆盖率（目标 ≥80%）

# 单文件 / 按名称匹配
npm test -- token-manager.test.ts
npm test -- --testNamePattern="getValidToken"

# 发布
npm run release:patch
npm publish
```

---

## 关键技术模式

### Token 管理（核心组件）

**模式**：自动、透明的三级缓存 Token 生命周期：
- 内存缓存 → `~/.ybc/token.json`（权限 600）→ 远程刷新
- 提前 5 分钟自动刷新
- 401 错误触发单次自动重试
- 配置变更通过 `configFingerprint` 立即作废旧 Token
- 绝不在日志/错误中暴露 `appSecret` 或 `access_token`

实现位于 `src/services/auth/token-manager.ts`。详细签名算法、数据中心查询、ADR 见 `docs/design/auth-spec.md`。

### 错误处理

**退出码**（为脚本和 AI Agent 标准化）：
- `0`：成功
- `1`：通用错误（CLI 解析）
- `4`：业务错误（API 返回 code ≠ '00000'）
- `5`：网络错误
- `6`：鉴权错误（凭证无效 / Token 刷新失败）

**模式**：自定义错误类（`AuthError` / `BusinessError` / `NetworkError` / `ValidationError`）+ `handleErrorAndExit()` 统一出口。

### 输出格式化

**模式**：单一适配器接口，多格式实现：
- `src/cli/output/formatter.ts`：统一接口
- `src/cli/output/{json,table,csv,raw}.ts`：四种格式
- 全局 `--format` 选项切换

**要点**：JSON 输出必须机器友好（稳定 schema），Table 输出必须人类友好（颜色、对齐）。

### 安全机制

- **appSecret 存储**：AES-256-GCM 加密；文件权限 600
- **配置文件**：`~/.ybc/config.json`（同样 600）
- **环境变量**：支持 `YBC_TENANT_ID` / `YBC_APP_KEY` / `YBC_APP_SECRET` / `YBC_ENV` / `YBC_FORMAT`（CI/CD 友好）
- **向后兼容**：旧字段 `ak/sk` 与 `YBC_AK/YBC_SK` 仍可读，但**新字段优先**
- **日志规则**：永远不记录 `appSecret`、`access_token` 等敏感数据

详细安全设计见 `docs/design/security.md`。

---

## 测试策略

**覆盖率目标**：
- 单元测试：≥80%（Service 与 Infrastructure 层）
- 集成测试：≥70%（鉴权流程、命令执行）
- E2E 测试：100% 核心用户场景

**测试结构**：
```
tests/
├── unit/         # 单模块测试（mock 依赖）
├── integration/  # 多模块流程（mock 外部 API）
├── e2e/          # 完整 CLI 执行（依赖 tests/mocks/mock-bip-server.ts）
└── mocks/        # Mock BIP Server（Express）
```

**工具**：Jest + ts-jest，集成层用 `axios-mock-adapter`，E2E 用 `execSync` + Mock Server。

详细策略与覆盖率细节见 `docs/design/testing.md`。

---

## 开发指南

### 添加新的 API 域

1. 在 `openapi/openapi.yaml` 中添加新端点
2. `npm run generate:api` → 新客户端生成在 `src/api/generated/`
3. `npm run generate:commands` → 命令创建在 `src/cli/commands/generated/`
4. 在 `src/cli/index.ts` 中注册命令组（`registerXxxApiCommands`）
5. 在 `tests/e2e/scenarios/` 中编写 E2E 测试

### 修改现有命令

**不要编辑自动生成的文件**：`src/api/generated/` 或 `src/cli/commands/generated/`

**正确做法**：
- 改 OpenAPI 规范 → 重新生成
- 或在 `src/cli/commands/<domain>/`（非 `generated/`）添加手写覆盖

### 配置管理

- 配置文件：`~/.ybc/config.json`（tenantId/appKey/appSecret/env/format）
- 所有配置操作**必须经过** `src/services/config/config-service.ts`，禁止直接读写文件

### 日志规范

- 使用 `src/services/logger/`，遵循详细度级别
- 全局 `--verbose` 启用调试日志
- **绝不记录** `appSecret`、`access_token`、`signature` 等敏感数据

---

## 文档参考

所有项目文档以 `docs/README.md` 为唯一索引入口。常用导航：

| 想了解 | 看哪里 |
|--------|--------|
| 文档全景 | `docs/README.md` |
| 用户使用 | `docs/guides/usage.md` |
| 项目架构 | `docs/design/architecture.md` |
| 鉴权机制 | `docs/design/auth-spec.md` |
| 当前待办 | 根目录 `ROADMAP.md` |
| 版本历史 | 根目录 `CHANGELOG.md` |
| 用友官方 API 原文 | `docs/design/ref/` |
| 历史归档 | `docs/archive/`（Phase 1 报告、各类任务报告，不再维护，仅备查）|
