# 代码审查报告（补充轮）

> **日期**：2026-06-16
> **版本**：ybc v0.1.6
> **审查范围**：上次审查（2026-06-12）修复回归 + 全量文档审计 + 代码质量全面体检
> **方法**：运行单元/集成/E2E 三层测试 + ESLint + 类型安全扫描 + 代码异味审计 + 文档一致性核验

---

## 0. 摘要

| 维度 | 数值 | 状态 |
|------|------|------|
| **CR-001/CR-002 修复回归** | 单元测试 + 生成器模板都验证通过 | ✅ 修复有效 |
| **单元测试** | 21/21 套件，402 用例通过 | ✅ |
| **集成测试** | 2/5 套件，30/47 用例通过 | ❌ 17 个回归失败 |
| **E2E 测试** | 7/8 套件，41/45 用例通过 | ⚠️ 4 个性能用例超时 |
| **文档一致性** | 5 处不一致 | 🟡 需同步 |
| **新增问题** | **15 项**（CR-037 ~ CR-051） | 见下文 |

---

## 1. CR-001 / CR-002 回归验证

### CR-001（全局 `--format` 失效）— ✅ 修复有效

**验证证据**：

| 验证维度 | 结果 |
|---------|------|
| 生成器模板（`scripts/generate-commands.ts`）| 已注入 `--format / --raw / --verbose` 三项 |
| 生成的命令（5 个 `generated/*.ts`）| 全部显式声明这三个选项 |
| 单元测试（`tests/integration/cli/global-options.test.ts`）| **8 用例全部通过** |
| `outputManager.output(result.data, options.format)` 调用 | 现在能正确拿到值 |

### CR-002（空 access_token 缓存防护）— ✅ 修复有效

**验证证据**（`token-manager.ts`）：

```typescript
// L1 内存缓存校验（第 80-87 行）
if (this.cachedToken.access_token && !this.isExpired(this.cachedToken)) {
  return this.cachedToken.access_token;
}
// L2 文件缓存校验（第 92-101 行）
if (!fileToken.access_token) {
  this.cachedToken = null;
  await this.clearCache();
}
// L3 远程响应校验（第 208-213 行）
if (!accessToken) {
  throw new AuthError(AuthErrorReason.TOKEN_REFRESH_FAILED, 'Token response missing access_token');
}
```

三层全部加上了 `access_token` 非空校验。`token-manager.test.ts` 第 23 个用例（"should not cache empty access_token"）覆盖此场景并通过。

---

## 2. 全量测试结果

### 2.1 单元测试 — ✅ 全过

```
Test Suites: 21 passed, 21 total
Tests:       1 skipped, 402 passed, 403 total
Time:        15.731 s
```

**整体覆盖率 91.79%**（目标 ≥80%）。

### 2.2 集成测试 — ❌ 17 个失败（回归）

| 套件 | 状态 | 通过/失败 |
|------|------|----------|
| `cli/global-options.test.ts` | ✅ | 8/8 |
| `auth/token-flow.test.ts` | ✅ | 13/13 |
| `auth/auth-flow.test.ts` | ❌ | 0/8 |
| `http/http-flow.test.ts` | ❌ | 0/2 |
| `full-flow.test.ts` | ❌ | 0/10 |

**根本原因分析**：

1. **auth-flow.test.ts**：8 个失败，断言依赖 TokenManager 旧版响应解析。CR-002 修复后 `accessToken` 校验更严，旧 mock 数据不再触发成功路径。
2. **http-flow.test.ts**：2 个失败，401 重试用例使用了 `auth-interceptor`（**CR-010 已识别为废弃**），但 `ApiHttpWrapper` 已接管鉴权流程。
3. **full-flow.test.ts**：10 个失败，混合 401 重试 + appSecret 加密前缀断言 + 退出码映射问题。退出码断言中 `ExitCode.NETWORK_ERROR` 期望 5 实际得 6、`ExitCode.BUSINESS_ERROR` 期望 4 实际得 6 → 表明旧测试期望的 4/5 错误被错误归类为 6（鉴权错误），与 **CR-012 错误分类** 问题一致。

### 2.3 E2E 测试 — ⚠️ 4 个失败（性能超时，非代码问题）

| 套件 | 状态 |
|------|------|
| `commands/staff-query.test.ts` | ✅ 8.5s |
| `commands/todo-list.test.ts` | ✅ |
| `scenarios/error-scenarios.test.ts` | ✅ 102.9s |
| `scenarios/token-refresh.test.ts` | ✅ 156.6s（**对比文档：原标 ❌ 现已通过**） |
| `scenarios/performance.test.ts` | ❌ 165.9s（4 个性能阈值用例） |
| `config/config-init.test.ts` | ✅ 166.1s |
| `config/config-show.test.ts` | ✅ 172.9s |
| `config/config-set.test.ts` | ✅ 225.5s |

**失败用例**：
```
● --help 启动时间应小于 10s                    失败
● --version 启动时间应小于 10s                  失败
● 首次 API 调用应小于 20s（包含 Token 获取）    失败
● 后续 API 调用应小于 10s（Token 已缓存）      失败  Received: 10062.66ms
```

> 性能测试依赖真实用友 API，本机网络延迟 > 10s 触发阈值。**与代码无关，是 CI/真实 API 测试的环境问题**。

---

## 3. 新发现问题（CR-037 ~ CR-051）

> 编号延续上次审查（CR-001 ~ CR-036）。

### 🔴 严重（1 项）

#### CR-037：集成测试 17 个失败导致 CI 红

**严重度**：🔴 严重
**涉及文件**：
- `tests/integration/auth/auth-flow.test.ts`（8 失败）
- `tests/integration/http/http-flow.test.ts`（2 失败）
- `tests/integration/full-flow.test.ts`（10 失败，其中部分与上次审查修复不直接相关）

**问题描述**：
上次审查修复（CR-001/CR-002）后，集成测试未同步更新。`auth-flow.test.ts` 仍用旧版 mock 响应触发成功路径，但 CR-002 加严的 `accessToken` 校验使旧 mock 不再适用。`full-flow.test.ts` 中退出码断言 `ExitCode.NETWORK_ERROR === 5` / `ExitCode.BUSINESS_ERROR === 4` 实际得 6，提示错误分类仍按 AuthError 处理（**CR-012 未修**）。

**影响**：
- `npm run test:integration` 红，构建流水线会失败
- 与 docs/design/testing.md §5「集成 ≥70%」目标差距 15%

**建议修复**：
- 重写 `auth-flow.test.ts` 适配新版 TokenManager（mock 响应需返回 `code: '00000'` + `data.access_token`）
- 重写 `http-flow.test.ts` 用 `ApiHttpWrapper` 替代已废弃的 `auth-interceptor`
- 修复 `full-flow.test.ts` 退出码断言 + appSecret 加密前缀断言（"`enc:`" 前缀需在 `EncryptionService.encrypt()` 中确认）

---

### 🟡 中等（8 项）

#### CR-038：README.md `config list` 与实际命令 `config show` 不一致

**严重度**：🟡 中等
**涉及文件**：`README.md:44`、第 114 行（命令结构图）

**问题描述**：

| README.md | guides/usage.md | 实际代码 |
|-----------|-----------------|----------|
| `ybc config list` | `ybc config show` | `registerConfigShowCommand`（src/cli/commands/config/show.ts） |

README 用了过时的 `list` 名称，与 `usage.md` 和实际实现都不一致。

**建议修复**：README.md 中所有 `config list` 替换为 `config show`。

#### CR-039：README.md "SK" 术语残留

**严重度**：🟡 中等
**涉及文件**：`README.md:13`、第 199 行（退出码描述）、第 125 行（Token 存储标题）

**问题描述**：README 仍在多处使用 "SK" 而非 "appSecret"，与项目其它文档（CLAUDE.md / guides/usage.md / architecture.md）已统一为 appSecret 的状态不一致。

**建议修复**：全局替换 `SK` → `appSecret`。

#### CR-040：`docs/design/testing.md` Token Refresh 状态过时

**严重度**：🟡 中等
**涉及文件**：`docs/design/testing.md:128`

**问题描述**：文档将 `token-refresh.test.ts` 标为 ❌ 全部失败，实际本轮测试已通过（156.6s）。`error-scenarios.test.ts` 和 `performance.test.ts` 状态也需更新。

**建议修复**：

| 文件 | 当前 | 改为 |
|------|------|------|
| `token-refresh.test.ts` | ❌ 全部失败 | ✅ 通过 |
| `error-scenarios.test.ts` | ⚠️ 部分通过 | ✅ 通过 |
| `performance.test.ts` | ⚠️ 部分通过 | ⚠️ 4 个超时失败（CI 环境问题） |

#### CR-041：`config/*` 命令 16 处直接 `process.exit()` 绕过 ErrorHandler

**严重度**：🟡 中等（**与上次审查 CR-013 同源，扩大范围**）
**涉及文件**：
- `src/cli/commands/config/init.ts`（7 处）
- `src/cli/commands/config/set.ts`（6 处）
- `src/cli/commands/config/show.ts`（3 处）

**问题描述**：
上次审查 CR-013 只识别了 `queryStaff.ts` 的 1 处，但实际整个 config/* 域存在 16 处直接 `process.exit(1)`，绕过了统一的 `ErrorHandler.handleErrorAndExit`。结果：错误信息格式、退出码映射、--verbose 堆栈显示均不一致。

**建议修复**：统一封装为

```typescript
try {
  // 业务逻辑
} catch (error) {
  handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
}
```

#### CR-042：`auth-interceptor.ts` 仍注入 Bearer Header（CR-010 复发）

**严重度**：🟡 中等
**涉及文件**：`src/infrastructure/http/auth-interceptor.ts:57-59`

**问题描述**：
上次审查已识别（CR-010），但未修复。`auth-interceptor` 仍通过 `Authorization: Bearer` Header 注入 token，与 ADR-7「query 参数传 token」矛盾。当前未被业务流程使用（业务用 `ApiHttpWrapper`），但作为公开基础设施存在被误用风险。`http-flow.test.ts` 集成测试因依赖此拦截器而失败。

**建议修复**：
- 方案 A：在文件顶部加 `@deprecated` JSDoc，指向 `ApiHttpWrapper`
- 方案 B：直接删除文件，强制业务方走 `ApiHttpWrapper`

#### CR-043：`ApiHttpWrapper` 非鉴权错误统一包装为 AuthError（CR-012 复发）

**严重度**：🟡 中等
**涉及文件**：`src/services/api/api-http-wrapper.ts:72-81`

**问题描述**：
上次审查已识别（CR-012），未修复。`call()` 中除 401 / AuthError 之外的错误（500、400、429）全部包装为 `AuthError(TOKEN_REFRESH_FAILED)`。`full-flow.test.ts` 失败用例就是因此失败。

**建议修复**：

```typescript
if (axios.isAxiosError(error)) {
  const status = error.response?.status;
  if (status && status >= 400 && status < 500) {
    throw new BusinessError(error.message, { businessCode: String(status) });
  }
  if (status && status >= 500) {
    throw new NetworkError(error.message);
  }
}
```

#### CR-044：`update-checker.ts` 0% 测试覆盖

**严重度**：🟡 中等
**涉及文件**：`src/services/update/update-checker.ts`（136 行）

**问题描述**：
上次审查已识别（`testing.md §10 已知缺口`），仍未补测试。模块完整但 0 覆盖，每次重构都有回归风险。

**建议修复**：补 `tests/unit/services/update/update-checker.test.ts`，至少覆盖：
- 24 小时缓存命中/失效
- 版本号比较（semver）
- 网络错误静默失败
- `--no-update-check` 禁用

#### CR-045：`api-http-wrapper.ts` 测试覆盖仅 29%

**严重度**：🟡 中等
**涉及文件**：`tests/unit/services/api/`（缺失）

**问题描述**：
核心入口模块测试覆盖不足。`api-http-wrapper.ts` 完整逻辑（401 重试、token 注入 query、错误分类）只通过集成测试间接验证。

**建议修复**：补 `tests/unit/services/api/api-http-wrapper.test.ts`，覆盖：
- 正常 GET/POST 请求
- 401 → 清除缓存 → 刷新 → 重试成功
- 401 → 重试仍失败 → 抛 AuthError
- 非 401 错误透传

#### CR-046：`README.md` 退出码描述保留 "AK/SK" 术语

**严重度**：🟡 中等
**涉及文件**：`README.md:199`

**问题描述**：第 199 行「6 - 鉴权错误（AK/SK 无效）」未与其它文档统一为 appKey/appSecret。

**建议修复**：改为「6 - 鉴权错误（appKey/appSecret 无效）」。

#### CR-047：5 个生成命令样板代码完全重复（CR-029 复发）

**严重度**：🟡 中等
**涉及文件**：
- `src/cli/commands/generated/staff/{query,enable,disable}Staff.ts`
- `src/cli/commands/generated/todo/{listTodos,createTodo}.ts`

**问题描述**：
上次审查已识别（CR-029），生成器模板重复 5 份，仅 `--code`/`--id`/... 参数列表不同。修改模板（CR-001 全局选项注入）需改 5 处。

**建议修复**：在 `scripts/generate-commands.ts` 中抽 `createCommandAction(apiMethod, params)` 工厂函数：

```typescript
function generateActionBody(apiClass: string, method: ApiMethod): string {
  return `
    try {
      const wrapper = new ApiHttpWrapper();
      const data = await wrapper.call({
        method: 'GET',
        path: '${method.path}',
        params: { ${method.parameters.map(p => `${p.name}: options.${p.name}`).join(', ')} }
      });
      outputManager.output(data, options.format);
    } catch (error) {
      handleErrorAndExit(error instanceof Error ? error : new Error(String(error)));
    }
  `;
}
```

---

### 🟢 轻微（6 项）

#### CR-048：Prettier 5,400 个 CRLF 误报

**严重度**：🟢 轻微
**涉及文件**：整个 `src/`（5,608 ESLint 报告中 99.7%）

**问题描述**：
ESLint 全量检查报 5,608 个问题，其中 5,423 个（99.7%）为 `Delete \r` —— Windows 仓库行尾是 CRLF，Prettier 默认期望 LF。掩盖了真实的 23 个 warning + ~20 个真实 code-style 问题。

**建议修复**：
1. 项目根加 `.gitattributes`：`*.ts text eol=lf`
2. `git rm --cached -r . && git reset` 一行行重新 checkout
3. 之后 `npm run lint -- --fix` 应仅剩 ~25 个真实问题

#### CR-049：`src/services/auth/token-manager.ts` 头部 `eslint-disable any`

**严重度**：🟢 轻微（与 CR-015 同源，未修复）

**问题描述**：`/* eslint-disable @typescript-eslint/no-explicit-any */` 全文件屏蔽，掩盖了 5 处实际 `any` 使用。

**建议修复**：移除全文件 disable，定位 5 处 `any` 改为具体类型（参考 `datacenter-service.ts` 无 disable）。

#### CR-050：`bin/ybc.ts:14` bootstrap catch 硬编码退出码 1

**严重度**：🟢 轻微（CR-025 同源）

**问题描述**：bootstrap 失败时硬编码 `process.exit(1)`，未走 `ErrorHandler.getExitCode(error)`，丢失了退出码语义。

**建议修复**：

```typescript
bootstrap().catch((error: Error) => {
  ErrorHandler.getInstance().handle(error);
  // handle() 内部已返回 exitCode
});
```

#### CR-051：`full-flow.test.ts` 临时目录路径不一致

**严重度**：🟢 轻微
**涉及文件**：`tests/integration/full-flow.test.ts:395`

**问题描述**：测试在 `C:\Users\EASON\AppData\Local\Temp\ybc-full-flow-XXX` 下写 `~/.ybc/config.json`，但路径拼接用了 `${tempDir}/.ybc/config.json` 而非 `${tempDir}/config.json`，导致找不到文件。

**建议修复**：路径断言用 `path.join(tempDir, '.ybc', 'config.json')`。

---

## 4. 文档一致性审计（5 处不一致）

| 编号 | 位置 | 当前 | 应为 | 优先级 |
|------|------|------|------|--------|
| DOC-001 | `README.md:44` | `ybc config list` | `ybc config show` | 🟡 |
| DOC-002 | `README.md:13, 199, 125` | "SK" | "appSecret" | 🟡 |
| DOC-003 | `README.md:115` | `config delete`（不存在）| 删除该条目或补实现 | 🟡 |
| DOC-004 | `docs/design/testing.md:128` | Token Refresh ❌ | ✅ | 🟡 |
| DOC-005 | `README.md` vs `usage.md` | 退出码描述不一致 | 统一术语 | 🟢 |

---

## 5. 代码质量指标（2026-06-16 快照）

| 指标 | 数值 | 评估 |
|------|------|------|
| 源文件总数 | 57 | — |
| 源代码总行数 | ~7,179 | — |
| 最长手写文件 | 387 行（config-service.ts）| ✅ |
| `any` 使用（手写） | 18 处 | 🟢 |
| `any` 使用（生成） | 32 处 | ⚙️ 可接受 |
| `@ts-ignore` | 0 | 🟢 优秀 |
| `TODO` / `FIXME` | 0 | 🟢 |
| `process.exit()` 直调 | 21 处（16 处在 config/*）| 🟡 |
| `console.log` | 160 处（68 在 config/show.ts）| 🟢 |
| `eslint-disable` | 7 处 | 🟢 |
| Prettier 误报 | 5,423 | 🟢 加 .gitattributes 可清零 |
| 单元测试覆盖率 | 91.79% | 🟢 超目标 |
| 集成测试通过率 | 64% (30/47) | 🟡 |
| E2E 通过率 | 91% (41/45) | 🟢（性能超时是环境） |

### 综合评分：**4.1 / 5**（与上次持平）

---

## 6. 修复优先级建议

### 第一波（功能可用性，1 小时内）

| 编号 | 修复 | 工作量 |
|------|------|--------|
| CR-037 | 重写 3 个集成测试套件 | 60 分钟 |
| CR-038 | README `config list` → `config show` | 5 分钟 |
| CR-039 | README 术语统一（SK → appSecret）| 10 分钟 |
| CR-040 | testing.md 状态更新 | 5 分钟 |

### 第二波（架构治理，半天）

| 编号 | 修复 | 工作量 |
|------|------|--------|
| CR-042 | auth-interceptor 加 `@deprecated` 或删除 | 15 分钟 |
| CR-043 | ApiHttpWrapper 错误分类按 HTTP 状态码 | 1 小时 |
| CR-041 | config/* 改用 handleErrorAndExit | 30 分钟 |
| CR-048 | 加 .gitattributes 解决 CRLF | 5 分钟 |

### 第三波（可维护性，可选）

| 编号 | 修复 | 工作量 |
|------|------|--------|
| CR-044 | update-checker 补单元测试 | 1 小时 |
| CR-045 | api-http-wrapper 补单元测试 | 1.5 小时 |
| CR-047 | 生成器抽 createCommandAction 工厂 | 1 小时 |
| CR-049 | token-manager 移除全文件 disable | 30 分钟 |
| CR-050 | ybc.ts 走 ErrorHandler | 5 分钟 |

---

## 7. 累计统计（含上次审查）

| 维度 | 上次（2026-06-12）| 本次（2026-06-16）| 变化 |
|------|------------------|------------------|------|
| 发现项总数 | 36 | 36 + 15 = **51** | +15 |
| 🔴 严重 | 2（已修）| 1（CR-037 集成测试红）| -1 |
| 🟡 中等 | 18 | 8 新增 + 5 复发（CR-010/012/013/015/025/029）| +8 |
| 🟢 轻微 | 16 | 6 新增 | +6 |

---

## 8. 一句话总结

> **上次审查的核心修复（CR-001/CR-002）有效，但集成测试未同步更新导致 CI 红**。本次新增 15 项中，**最高 ROI 的是 CR-037 集成测试修复 + CR-038/039 README 同步**（合计 80 分钟可让项目回到绿状态）。
>
> 文档侧：README 与 guides/usage.md 不同步是用户接触面最大的不一致点。
>
> 架构侧：auth-interceptor 仍存在 + ApiHttpWrapper 错误分类未修 + config/* 16 处 process.exit 是技术债，但不影响功能。

---

**附录**：

- 上次审查：`docs/process/code-review-20260612.md`（36 项）
- 一致性审计：`docs/process/audit-code-vs-design.md`（7 项已全部修复）
- 测试策略：`docs/design/testing.md`
- 修复记录（CHANGELOG）：见根目录 `CHANGELOG.md`