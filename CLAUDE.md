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

这是 **ybc**（用友BIP CLI）项目 - 一个用于与用友 BIP OpenAPI 平台交互的命令行工具。项目目前包含完整的文档，但尚未编写源代码。开发工作已准备就绪，可按照文档规范开始实施。

**核心目的**：通过 CLI 工具简化用友 BIP 的 300+ API 端点访问，具备自动 token 管理、OpenAPI 驱动的命令生成，以及双模式输出（人类友好的表格 + 机器友好的 JSON）。

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
- **CLI 层**：基于 Commander 的命令解析、三级帮助系统、输出适配器（JSON/Table/CSV）
- **Service 层**：配置管理器、鉴权管理器（token 生命周期）、错误处理器、日志管理器
- **API 层**：从 OpenAPI 规范自动生成的 TypeScript 客户端 + 业务域封装
- **Infrastructure 层**：文件存储（`~/.ybc/`）、加密（AES-256-GCM）、axios 拦截器

## OpenAPI 驱动开发（关键模式）

**核心模式**：命令**不是手动编写**，而是从 OpenAPI 规范自动生成：

```
OpenAPI 规范 (openapi.yaml)
    ↓ openapi-generator-cli
TypeScript API 客户端
    ↓ command-generator 脚本
CLI 命令定义 (commander.js)
```

**开发流程**：
1. 在 `openapi/generator-config.yaml` 中维护 OpenAPI 规范
2. 运行 `npm run generate:api` 生成 TypeScript 客户端
3. 运行 `npm run generate:commands` 创建 CLI 命令封装
4. 命令根据 API 标签/操作自动注册

**示例**：OpenAPI 规范中的 `staff` 域包含 `query`、`enable`、`disable` 操作，自动生成：
- API 客户端：`src/api/generated/staff-api.ts`
- CLI 命令：`src/cli/commands/business/staff/query.ts`、`enable.ts`、`disable.ts`

## 目录结构（规划）

```
src/
├── cli/           # CLI 层 - commander 程序、命令、帮助系统、输出适配器
├── services/      # Service 层 - 鉴权、配置、错误处理、日志
├── api/           # API 层 - 生成的客户端 + 手动封装
├── infrastructure/ # Infrastructure 层 - 文件存储、加密、HTTP 客户端
├── types/         # TypeScript 类型定义
└── utils/         # 共享工具函数
```

**重要文件**：
- `src/bin/ybc.ts`：CLI 入口点（#!/usr/bin/env node）
- `src/cli/program.ts`：Commander 程序初始化，包含全局选项
- `src/services/auth/token-manager.ts`：Token 生命周期管理（关键组件）
- `openapi/generator-config.yaml`：OpenAPI 生成器配置（真实数据源）

## 开发命令（规划）

**安装与初始化**：
```bash
npm install                  # 安装依赖
npm run generate:api         # 从 OpenAPI 规范生成 API 客户端
npm run generate:commands    # 从 API 客户端生成 CLI 命令
```

**开发调试**：
```bash
npm run dev                  # 开发模式运行 CLI (ts-node)
npm run build                # 编译 TypeScript 到 dist/
npm run lint                 # 运行 ESLint 检查
npm run format               # 运行 Prettier 格式化
```

**测试**：
```bash
npm test                     # 运行所有测试 (Jest)
npm run test:unit            # 仅运行单元测试
npm run test:integration     # 运行集成测试
npm run test:e2e             # 运行 E2E 测试
npm run test:coverage        # 生成覆盖率报告（目标：≥80%）
```

**运行单个测试**：
```bash
npm test -- token-manager.test.ts          # 运行特定测试文件
npm test -- --testNamePattern="getValidToken"  # 运行匹配模式的测试
```

**发布**：
```bash
npm run release:patch        # 发布 patch 版本 (0.0.x)
npm run release:minor        # 发布 minor 版本 (0.x.0)
npm publish                  # 发布到 npm 仓库
```

## 关键技术模式

### Token 管理（关键组件）

**模式**：自动、透明的 token 生命周期管理，支持文件缓存：
- Token 缓存于 `~/.ybc/token.json`（文件权限 600）
- 过期前 5 分钟自动刷新
- 401 错误触发单次重试获取新 token
- 绝不在日志/错误中暴露 SK

**实现位置** `token-manager.ts`：
```typescript
// 模式：检查缓存 → 从文件加载 → 验证过期 → 如需要则刷新
// 使用 axios 拦截器自动注入 Authorization 头
// 在拦截器中处理 401 错误，包含重试逻辑
```

### 错误处理

**退出码**（为脚本和 AI agent 标准化）：
- `0`：成功
- `1`：通用错误（CLI 解析错误）
- `4`：业务错误（API 返回错误）
- `5`：网络错误
- `6`：鉴权错误（AK/SK 无效或 token 刷新失败）

**模式**：使用自定义错误类（`AuthError`、`NetworkError`、`BusinessError`）配合退出码。

### 输出格式化

**模式**：单一适配器模式，多格式化器实现：
```typescript
// src/cli/output/formatter.ts：统一接口
// src/cli/output/json.ts, table.ts, csv.ts, raw.ts：格式特定实现
// 全局 --format 标志控制使用哪个格式化器
```

**关键要点**：JSON 输出必须机器友好（稳定的 schema），Table 输出必须人类友好（颜色、对齐）。

### 安全机制

**SK 存储**：AES-256-GCM 加密，文件权限 600。绝不在日志中记录或暴露 SK。

**环境变量**：支持 `YBC_AK`、`YBC_SK`、`YBC_FORMAT` 用于 CI/CD 场景（无需本地文件）。

## 测试策略

**覆盖率目标**：
- 单元测试：≥80%（Service 和 Infrastructure 层）
- 成成测试：≥70%（鉴权流程、命令执行）
- E2E 测试：100% 核心用户场景

**测试结构**：
```
tests/
├── unit/         # 单个模块测试（mock 依赖）
├── integration/  # 多模块流程测试（mock 外部 API）
├── e2e/          # 完整 CLI 执行测试（真实或 mock BIP API）
```

**模式**：集成测试使用 `axios-mock-adapter` 进行 API mock。E2E 测试使用 `tests/e2e/fixtures/` 中的真实 fixtures。

## 开发指南

### 添加新的 API 域

1. 在 OpenAPI 规范（`openapi/openapi.yaml`）中添加新端点
2. 运行 `npm run generate:api` → 新 API 客户端生成在 `src/api/generated/`
3. 运行 `npm run generate:commands` → CLI 命令创建在 `src/cli/commands/business/`
4. 在 `src/cli/help/` 中添加域特定帮助文本
5. 在 `tests/e2e/scenarios/` 中编写 E2E 测试

### 修改现有命令

**不要编辑**自动生成的文件：`src/api/generated/` 或 `src/cli/commands/generated/`

**正确做法**：
- 更新 OpenAPI 规范
- 重新生成
- 在 `src/cli/commands/business/`（非生成区域）添加手动覆盖

### 配置管理

**配置文件**：`~/.ybc/config.json`（AK/SK、环境、偏好设置）

**模式**：所有配置操作使用 `src/services/config/config-service.ts`。绝不直接读写配置文件。

### 日志规范

**模式**：使用 `src/services/logger/` 配合详细度级别。全局 `--verbose` 标志启用调试日志。

**规则**：绝不记录 SK、token 或敏感数据。使用混淆函数。

## 项目状态

**当前阶段**：文档完成，准备开始 Phase 1 开发。

**下一步工作**：
1. 初始化项目结构（npm init、TypeScript 配置、Jest 配置）
2. 建立 OpenAPI 规范基础
3. 实现 Infrastructure 层（存储、加密）
4. 实现 Service 层（鉴权、配置）
5. 建立自动生成流程
6. 构建 CLI 层及核心命令
7. 添加帮助系统和输出适配器

## 文档参考

### 文档目录结构

所有项目文档按照以下结构组织：

```
docs/
├── design/                      # 开发设计文档
│   ├── 需求与产品设计文档.md
│   ├── 架构设计文档.md
│   ├── 技术实现方案.md
│   ├── 测试策略.md
│   ├── 安全方案.md
│   ├── 产品验收标准.md
│   ├── Token获取机制修改方案.md
│   ├── 获取access_token.md
│   └── 获取租户所在数据中心域名.md
│
├── process/                     # 开发过程文档
│   ├── 项目开发文档索引.md
│   ├── Phase1-开发计划.md
│   ├── Phase1-验收报告.md
│   ├── Phase1-最终完成报告.md
│   ├── TASK-8-IMPLEMENTATION-REPORT.md
│   ├── 修改实施完成报告.md
│   ├── 测试文件创建总结.md
│   └── 文档清单.md
│
├── 本地使用指南.md              # 用户使用文档（根目录）
├── 快速使用指南（修复版）.md
└── README.md                    # 文档目录说明
```

---

### 📁 文档分类规则

**重要**：后续所有新文档必须按照以下分类输出：

#### ✅ **design/** - 开发设计文档

**输出条件**（输出到 `docs/design/` 目录）：
- ✅ 需求和产品设计文档
- ✅ 架构和技术方案文档
- ✅ API 规范研究文档
- ✅ 测试和安全设计文档
- ✅ 实施方案和修改方案
- ✅ 技术决策记录（ADR）
- ✅ 产品验收标准

**典型文档**：
- 架构设计、技术实现方案、测试策略、安全方案
- Token获取机制修改方案、获取access_token规范
- 需求与产品设计、产品验收标准

---

#### ✅ **process/** - 开发过程文档

**输出条件**（输出到 `docs/process/` 目录）：
- ✅ 开发计划和任务清单
- ✅ 实施过程报告（实施细节、步骤记录）
- ✅ 验收和测试报告
- ✅ 问题追踪和解决记录
- ✅ 文档清单和索引
- ✅ Phase阶段性总结
- ✅ TASK任务实施报告

**典型文档**：
- Phase开发计划、验收报告、最终完成报告
- TASK实施报告、修改实施完成报告
- 测试文件创建总结、文档清单、项目索引

---

#### ✅ **根目录** - 用户使用文档

**输出条件**（输出到 `docs/` 根目录）：
- ✅ 快速上手指南
- ✅ 详细使用手册
- ✅ 常见问题解答
- ✅ 迁移指南

**典型文档**：
- 本地使用指南、快速使用指南

---

### 🔍 关键文档导航

**在进行架构决策前请查阅以下核心设计文档**：

| 文档 | 路径 | 说明 |
|------|------|------|
| **架构设计文档** | `docs/design/架构设计文档.md` | 架构、模块设计、技术决策、ADR |
| **技术实现方案** | `docs/design/技术实现方案.md` | 目录结构、编码规范、实现细节 |
| **测试策略** | `docs/design/测试策略.md` | 测试计划、测试用例、质量标准 |
| **安全方案** | `docs/design/安全方案.md` | 加密、token安全、审计机制 |
| **Token修改方案** | `docs/design/Token获取机制修改方案.md` | 最新Token机制修改（关键） |

**最新实施状态请查阅**：
- `docs/process/修改实施完成报告.md` - 最新实施成果
- `docs/process/Phase1-最终完成报告.md` - Phase 1 总结

**用户使用请查阅**：
- `docs/本地使用指南.md` - 详细使用说明
- `docs/快速使用指南（修复版）.md` - 3步快速上手