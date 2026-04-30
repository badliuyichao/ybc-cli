# Phase 1（基础验证）开发计划

---

## 文档信息

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-25 | 项目经理 | 初稿，基于项目文档索引和多 agent 协作模式 |

**适用范围**：`ybc` CLI 工具的 Phase 1（基础验证）阶段开发执行。
**目标读者**：项目经理、开发工程师、测试工程师、架构师。

---

## 1. Phase 1 目标

**核心目标**：验证技术可行性，建立完整的基础架构，确保 OpenAPI → CLI 命令的自动化生成流程可行。

**验证通过标准**：
- ✅ OpenAPI 规范能成功生成 TypeScript API 客户端
- ✅ API 客户端能成功生成 CLI 命令
- ✅ Token 自动获取、缓存、刷新流程完整
- ✅ 基础命令能成功执行并返回结果
- ✅ 所有核心流程通过集成测试
- ✅ 性能指标达标（启动 <500ms，首次调用 <2s）
- ✅ 安全机制完善（SK 加密、权限控制）

**开发周期**：预计 1 周（可根据实际情况调整）

---

## 2. 多 Agent 协作模式

### 2.1 Agent 角色定义

本开发计划使用 **Claude Code 多 agent 协作能力**，每个任务由对应的专业角色 agent 执行：

| Agent 角色 | 负责任务类型 | 技能特点 |
|-----------|-------------|---------|
| **全栈工程师** | 项目初始化、基础配置 | 全面的前后端能力，熟悉 npm、TypeScript、测试框架配置 |
| **架构师** | OpenAPI 规范设计、架构设计 | 深厚的架构经验，熟悉 OpenAPI 3.0 规范、API 设计最佳实践 |
| **API 工程师** | OpenAPI 规范编写、API 定义 | 熟悉 RESTful API 设计、OpenAPI 规范编写 |
| **基础工程师** | Infrastructure 层实现 | 熟悉文件系统、加密算法、环境变量管理 |
| **安全工程师** | 加密服务、安全验证 | 深厚的安全经验，熟悉 AES-256-GCM、密钥管理 |
| **后端工程师** | Token 管理、HTTP 客户端、错误处理 | 熟悉鉴权流程、axios、拦截器模式、错误处理 |
| **前端工程师** | CLI 命令实现、输出适配器 | 熟悉 commander.js、CLI 交互、表格渲染、用户体验 |
| **工具工程师** | 命令生成器、自动化脚本 | 熟悉代码生成、模板引擎、自动化工具开发 |
| **测试工程师** | 集成测试、E2E 测试、性能测试 | 熟悉 Jest、Mock API、测试策略、覆盖率分析 |
| **项目经理** | 流程验证、质量把控、最终验收 | 全局视野、质量标准把控、风险管理 |

### 2.2 Agent 协作流程

```
项目经理（总控）
    ↓
分配任务 → TaskCreate（创建任务）
    ↓
专业 Agent（执行任务）
    ↓
验证标准 → TaskUpdate（标记完成）
    ↓
项目经理验收（评估）
    ↓
继续下一任务或重新分配
```

**关键机制**：
- 每个任务有明确的验证标准（可通过测试验证）
- 任务之间有依赖关系（blockedBy），确保执行顺序正确
- Agent 执行任务时，可以使用所有 Claude Code 工具（Read、Write、Edit、Bash、Agent 等）
- 最终由项目经理 agent 验收所有任务，确保 Phase 1 通过

---

## 3. 任务清单与依赖关系

### 3.1 任务执行顺序图

```
Task #6: 初始化项目基础结构和配置文件
    ↓ ↓ ↓ ↓ ↓
    | | | | └─→ Task #13: 实现输出适配器（前端工程师）
    | | | └─→ Task #14: 实现错误处理器（后端工程师）
    | | └─→ Task #11: 实现配置管理命令（前端工程师）
    | └─→ Task #7: 创建 OpenAPI 规范（架构师 + API 工程师）
    |       ↓
    |       └─→ Task #12: 实现命令生成器（工具工程师）
    └─→ Task #8: 实现 Infrastructure 层（基础工程师 + 安全工程师）
            ↓
            └─→ Task #9: 实现 Token 管理器（后端工程师）
                    ↓
                    └─→ Task #10: 实现 HTTP 客户端和拦截器（后端工程师）
                            ↓
                            └─────────────────────────→ Task #15: Phase 1 完整验证（测试工程师 + 项目经理）
```

### 3.2 任务详细清单

| 任务 ID | 任务名称 | 负责 Agent | 依赖任务 | 验证方式 |
|---------|---------|-----------|---------|---------|
| **#6** | 初始化项目基础结构和配置文件 | 全栈工程师 | 无 | npm install/build/lint/test 通过 |
| **#7** | 创建 OpenAPI 规范基础文件 | 架构师 + API 工程师 | #6 | OpenAPI 规范验证通过、API 客户端生成成功 |
| **#8** | 实现 Infrastructure 层核心组件 | 基础工程师 + 安全工程师 | #6 | 单元测试覆盖率 ≥90%、文件加密验证 |
| **#9** | 实现 Token 管理器 | 后端工程师 | #8 | 单元测试覆盖率 ≥90%、集成测试通过 |
| **#10** | 实现 HTTP 客户端和鉴权拦截器 | 后端工程师 | #9 | 单元测试覆盖率 ≥90%、401 重试验证 |
| **#11** | 实现配置管理 CLI 命令 | 前端工程师 | #8 | E2E 测试通过、安全验证通过 |
| **#12** | 实现命令自动生成器 | 工具工程师 | #7 | 命令生成成功、生成的命令可运行 |
| **#13** | 实现输出适配器 | 前端工程师 | #6 | 单元测试覆盖率 ≥90%、格式化验证 |
| **#14** | 实现统一错误处理器 | 后端工程师 | #6 | 单元测试覆盖率 ≥90%、退出码验证 |
| **#15** | Phase 1 完整流程验证 | 测试工程师 + 项目经理 | #9, #10, #11, #12, #13, #14 | 所有验证标准通过 |

---

## 4. Agent 任务执行指南

### 4.1 如何启动 Agent 执行任务

**方式 1：手动启动单个 Agent**

```bash
# 使用 TaskGet 获取任务详情
TaskGet(taskId: "6")

# 启动对应角色的 Agent
Agent({
  description: "全栈工程师：初始化项目基础结构",
  prompt: "你是全栈工程师，负责执行 Task #6：初始化项目基础结构和配置文件。
  
  请按照任务描述完成任务，并确保所有验证标准通过：
  
  **任务描述**：
  创建项目的完整基础结构，包括 package.json、tsconfig.json、jest.config.js、.eslintrc.js、.prettierrc、.husky 配置，以及完整的目录结构（src/cli、src/services、src/api、src/infrastructure、src/types、src/utils）和基础入口文件。
  
  **验证标准**：
  - npm install 成功
  - npm run build 成功编译
  - npm run lint 通过检查
  - npm test 可运行
  - ts-node src/bin/ybc.ts --version 输出版本号
  - 目录结构正确
  
  参考文档：docs/技术实现方案.md 第 1、4 节。
  
  完成后，使用 TaskUpdate 标记任务为 completed。",
  subagent_type: "general-purpose"
})
```

**方式 2：批量启动多个 Agent（并行执行）**

对于无依赖关系的任务，可以同时启动多个 Agent：

```bash
# Task #7、#8、#13、#14 都依赖 #6，但它们之间无依赖
# 当 #6 完成后，可以并行启动这 4 个 Agent

Agent({description: "架构师：创建 OpenAPI 规范", ...})  # Task #7
Agent({description: "基础工程师：实现 Infrastructure", ...})  # Task #8
Agent({description: "前端工程师：实现输出适配器", ...})  # Task #13
Agent({description: "后端工程师：实现错误处理器", ...})  # Task #14
```

### 4.2 Agent 工具能力

每个 Agent 可以使用以下 Claude Code 工具：

- **Read**：读取项目文档和现有代码
- **Write**：创建新文件
- **Edit**：编辑现有文件
- **Bash**：执行命令（npm、git、测试等）
- **Glob/Grep**：搜索文件和代码
- **Agent**：启动子 Agent（如有需要）
- **TaskUpdate**：更新任务状态

**关键点**：Agent 执行任务时，必须确保验证标准通过，才能使用 `TaskUpdate` 标记任务为 `completed`。

### 4.3 任务状态流转

```
pending（等待）
    ↓ Agent 开始执行
in_progress（进行中）
    ↓ Agent 完成并验证
completed（完成）
    ↓ 项目经理验收
通过 → 继续下一任务
失败 → 重新分配或补充任务
```

---

## 5. Phase 1 验证流程

### 5.1 最终验收（Task #15）

Task #15 是 Phase 1 的最终验收任务，由测试工程师和项目经理共同执行。

**验收步骤**：

1. **创建 Mock BIP API 服务器**：
   ```typescript
   // tests/mocks/mock-bip-server.ts
   // Mock /token、/staff/query、/todo/list 等端点
   ```

2. **执行完整流程集成测试**：
   ```bash
   npm test
   npm run test:integration
   npm run test:coverage
   ```

3. **执行 E2E 用户场景**：
   ```bash
   # 场景 1：初始化配置 → 查询员工
   ts-node src/bin/ybc.ts config init
   ts-node src/bin/ybc.ts staff query --code EMP001 --format json

   # 场景 2：直接执行命令（配置已存在）
   ts-node src/bin/ybc.ts todo list --format table

   # 场景 3：错误场景
   rm ~/.ybc/config.json
   ts-node src/bin/ybc.ts staff query  # 应退出码 6
   ```

4. **测量性能指标**：
   ```bash
   time ts-node src/bin/ybc.ts --version  # 应 <500ms
   time ts-node src/bin/ybc.ts staff query --code EMP001  # 应 <2s（首次）
   ```

5. **检查覆盖率报告**：
   ```bash
   npm run test:coverage
   # 查看 coverage/lcov-report/index.html
   # 单元测试覆盖率应 ≥80%
   # 集成测试覆盖率应 ≥70%
   ```

6. **验证生成流程**：
   ```bash
   # 修改 openapi.yaml，新增一个操作
   npm run generate:api
   npm run generate:commands
   npm run build
   # 新命令应可用
   ```

### 5.2 Phase 1 通过决策

**决策标准**：所有验证标准通过 + 覆盖率达标 + 性能达标 + 安全验证通过

**项目经理职责**：
- 检查所有 Task 是否 completed
- 执行最终验收流程
- 生成验收报告
- 决定是否进入 Phase 2

---

## 6. 开发进度跟踪

### 6.1 任务进度查看

使用 `TaskList` 查看所有任务状态：

```bash
TaskList()
```

输出示例：
```
#6 [completed] 初始化项目基础结构和配置文件
#7 [in_progress] 创建 OpenAPI 规范基础文件
#8 [pending] 实现 Infrastructure 层核心组件 [blocked by #6]
...
```

### 6.2 单个任务详情查看

使用 `TaskGet` 查看任务详情：

```bash
TaskGet(taskId: "9")
```

输出包含：
- 任务描述
- 负责 Agent
- 验证标准
- 依赖任务
- 当前状态

---

## 7. 风险管理

### 7.1 常见风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| **OpenAPI 规范错误** | API 客户端生成失败 | 使用在线验证器验证、参考官方示例 |
| **Token 管理复杂度高** | 开发周期延长 | 简化初始实现、Mock API 辅助测试 |
| **生成器实现困难** | 命令无法自动生成 | 参考 openapi-generator-cli 文档、简化模板 |
| **测试覆盖率不达标** | 质量风险 | 优先编写关键路径测试、补充边界测试 |
| **性能不达标** | 用户体验差 | 分析瓶颈、优化启动流程、延迟加载 |

### 7.2 任务失败处理

**如果任务验证不通过**：

1. Agent 提交失败原因
2. 项目经理评估问题
3. 重新分配任务或补充任务
4. Agent 重新执行
5. 直到验证通过

**示例流程**：
```
Task #9 验证失败（覆盖率 85%，未达到 90%）
    ↓
项目经理评估：需要补充测试
    ↓
TaskUpdate(taskId: "16", subject: "补充 Token 管理器测试", ...)
    ↓
后端工程师 Agent 执行 Task #16
    ↓
Task #9 + #16 完成后，重新验证 Task #9
    ↓
验证通过 → Task #9 completed
```

---

## 8. 开发质量标准

### 8.1 代码质量标准

- ✅ TypeScript 编译无错误、无警告
- ✅ ESLint 检查通过（无 error，warning ≤5）
- ✅ Prettier 格式化通过
- ✅ 所有函数有 JSDoc 注释
- ✅ 关键逻辑有行内注释

### 8.2 测试质量标准

- ✅ 单元测试覆盖率 ≥80%（Service、Infrastructure 层）
- ✅ 集成测试覆盖率 ≥70%（关键流程）
- ✅ E2E 测试覆盖率 100%（核心用户场景）
- ✅ 所有测试通过（无失败、无跳过）

### 8.3 安全质量标准

- ✅ SK 加密存储（AES-256-GCM）
- ✅ 所有配置文件权限 600
- ✅ 日志中无敏感信息（SK、完整 token）
- ✅ 错误消息中无敏感信息
- ✅ HTTPS 强制启用

### 8.4 性能质量标准

- ✅ CLI 启动时间 <500ms
- ✅ 首次 API 调用（含 token） <2s
- ✅ 后续 API 调用 <1s（token 已缓存）

---

## 9. Agent 启动命令模板

### 9.1 Task #6: 全栈工程师 Agent

```
使用 TaskGet(taskId: "6") 获取任务详情。

启动 Agent：
Agent({
  description: "全栈工程师：初始化项目基础结构",
  subagent_type: "general-purpose",
  prompt: `
你是全栈工程师，负责执行 Task #6。

**任务**：初始化项目基础结构和配置文件。

**详细步骤**：
1. 执行 npm init，配置 package.json（name: ybc、version: 0.1.0、bin、scripts）
2. 创建 tsconfig.json（target: ES2020、module: commonjs、strict: true）
3. 创建 tsconfig.build.json（构建配置）
4. 创建 jest.config.js（测试配置）
5. 创建 .eslintrc.js（ESLint 配置）
6. 创建 .prettierrc（Prettier 配置）
7. 设置 .husky（pre-commit、pre-push）
8. 创建目录：src/cli、src/services、src/api、src/infrastructure、src/types、src/utils
9. 创建 src/bin/ybc.ts（CLI 入口）
10. 安装依赖：npm install commander axios typescript jest eslint prettier husky

**验证**：
- npm install 无错误
- npm run build 成功
- npm run lint 通过
- npm test 可运行
- ts-node src/bin/ybc.ts --version 输出 "0.1.0"

参考：docs/技术实现方案.md 第 1、4 节。

完成后：TaskUpdate(taskId: "6", status: "completed")
`
})
```

### 9.2 Task #7: 架构师 + API 工程师 Agent

```
Agent({
  description: "架构师：创建 OpenAPI 规范",
  subagent_type: "general-purpose",
  prompt: `
你是架构师和 API 工程师，负责执行 Task #7。

**任务**：创建 OpenAPI 规范基础文件和示例 API 定义。

**详细步骤**：
1. 创建 openapi/ 目录
2. 创建 openapi/openapi.yaml（OpenAPI 3.0 规范）
   - 定义 2 个业务域：staff、todo
   - staff: query、enable 操作
   - todo: list、create 操作
   - 定义 bearerAuth 安全方案
   - 定义 paths、parameters、responses
3. 创建 openapi/generator-config.yaml（openapi-generator-cli 配置）
4. 安装 @openapitools/openapi-generator-cli
5. 创建 scripts/generate-api.ts（生成脚本）
6. 配置 package.json scripts: "generate:api"

**验证**：
- openapi.yaml 通过 OpenAPI 3.0 验证器
- npm run generate:api 成功生成 TypeScript 客户端
- 生成的客户端位于 src/api/generated/
- 生成的代码通过 TypeScript 编译

参考：docs/架构设计文档.md 第 5.3 节。

完成后：TaskUpdate(taskId: "7", status: "completed")
`
})
```

### 9.3 其他 Agent 启动模板

参考上述模板，根据 TaskGet(taskId: "X") 获取的详细信息，编写对应 Agent 的 prompt。

**通用模板结构**：
```
Agent({
  description: "<角色>：<任务名称>",
  subagent_type: "general-purpose",
  prompt: `
你是<角色>，负责执行 Task #<ID>。

**任务**：<任务名称>

**详细步骤**：<从 TaskGet 获取>

**验证标准**：<从 TaskGet 获取>

参考文档：<指定文档路径>

完成后：TaskUpdate(taskId: "<ID>", status: "completed")
`
})
```

---

## 10. Phase 1 完成标志

**Phase 1 完成条件**：

1. ✅ 所有任务（#6 ~ #15）状态为 `completed`
2. ✅ Task #15 最终验收通过
3. ✅ 项目经理生成验收报告（docs/Phase1-验收报告.md）
4. ✅ 确认可以进入 Phase 2

**验收报告内容**：
- 任务完成情况
- 测试覆盖率数据
- 性能测量数据
- 安全验证结果
- 风险和问题总结
- Phase 2 准备建议

---

## 11. 附录：Agent 角色与任务对应表

| Agent 角色 | 可执行任务 | 技术栈要求 |
|-----------|-----------|-----------|
| **全栈工程师** | #6 | npm、TypeScript、Jest、ESLint、Prettier |
| **架构师** | #7、架构决策 | OpenAPI 3.0、API 设计、架构模式 |
| **API 工程师** | #7 | RESTful API、OpenAPI 规范编写 |
| **基础工程师** | #8 | Node.js fs、文件系统、环境变量 |
| **安全工程师** | #8、安全验证 | AES-256-GCM、密钥管理、安全最佳实践 |
| **后端工程师** | #9、#10、#14 | Token 管理、axios、拦截器、错误处理 |
| **前端工程师** | #11、#13 | commander.js、CLI 交互、表格渲染、用户体验 |
| **工具工程师** | #12 | 代码生成、模板引擎、自动化脚本 |
| **测试工程师** | #15 | Jest、Mock API、测试策略、覆盖率分析 |
| **项目经理** | #15（验收）、总控 | 质量把控、风险管理、决策 |

---

## 总结

本开发计划基于 **Claude Code 多 agent 协作能力**，通过明确的任务分解、专业的角色分工、严格的验证标准，确保 Phase 1 开发能够验证通过，为后续 Phase 2-5 打下坚实基础。

**关键成功因素**：
- 明确的任务定义和验证标准
- 专业 Agent 角色分工
- 严格的依赖关系管理
- 全面的测试覆盖和质量标准
- 项目经理的全程把控和最终验收

**下一步**：启动 Task #6（初始化项目基础结构），开始 Phase 1 开发！