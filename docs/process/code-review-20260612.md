# 代码审查报告

> **日期**：2026-06-12
> **版本**：ybc v0.1.6
> **范围**：`src/` 全部 ~55 个 TypeScript 源文件 + 设计文档一致性核验
> **方法**：一致性审计（代码 vs 设计文档）+ 全面 Code Review（安全/架构/错误处理/质量）

---

## 审查总览

| 审查维度 | 发现项数 | 🔴 严重 | 🟡 中等 | 🟢 轻微 |
|---------|---------|---------|---------|---------|
| 一致性审计（代码 vs 设计文档） | 10 | 0 | 4 | 6 |
| 全面 Code Review | 26 | 2 | 14 | 10 |
| **合计** | **36** | **2** | **18** | **16** |

---

## 🔴 严重（2 项，必须立即修复）

### CR-001：`options.format` 始终为 `undefined` — 全局 `--format` 选项完全失效

**严重度**：🔴 严重
**影响范围**：全部 5 个业务命令
**涉及文件**：
- `src/cli/commands/generated/staff/queryStaff.ts:49`
- `src/cli/commands/generated/staff/enableStaff.ts:33`
- `src/cli/commands/generated/staff/disableStaff.ts:33`
- `src/cli/commands/generated/todo/listTodos.ts:44`
- `src/cli/commands/generated/todo/createTodo.ts:44`

**问题描述**：

`program.ts` 在全局定义了 `--format <json|table|csv|raw>`，但 commander 的 `options` 对象只包含**当前命令**定义的选项，不包含父级选项。所有业务命令的 `action` 回调中调用 `outputManager.output(responseData, options.format)` 时，`options.format` 始终是 `undefined`，OutputManager 默认回退到 `'table'`。

**结果**：用户通过 `ybc staff query --format json` 设置的格式**永远不会生效**。

**示例代码**（当前有问题）：

```typescript
// queryStaff.ts
.action(async (options) => {
  // ...
  outputManager.output(responseData, options.format);  // ← options.format 始终 undefined
});
```

**建议修复**：通过 `command.parent.opts().format` 或 `program.opts().format` 获取全局选项。或将 `--format` 也定义在每个子命令上。

---

### CR-002：`TokenManager.refreshToken` 中 `accessToken` 空字符串未校验

**严重度**：🔴 严重
**涉及文件**：`src/services/auth/token-manager.ts:183-192`

**问题描述**：

```typescript
let accessToken: string;
// ...
accessToken = fullResponse.data?.access_token || '';  // ← 空字符串兜底

if (!expiresIn) {   // ← 只检查了 expiresIn，没检查 accessToken
  throw new AuthError(AuthErrorReason.TOKEN_REFRESH_FAILED, 'Token response missing expiration time');
}
```

如果 API 响应缺少 `access_token` 字段，`accessToken` 会是空字符串 `''`。后续只检查了 `expiresIn` 是否为 0，但没有检查 `accessToken` 是否为空。空 token 会被写入缓存（`saveToCache`），导致后续所有 API 调用返回 401。

**建议修复**：在 `expiresIn` 检查之前增加 `if (!accessToken)` 校验。

---

## 🟡 中等（18 项，建议计划修复）

### 安全类

#### CR-003：Token 缓存文件以明文存储 access_token

**严重度**：🟡 中等
**涉及文件**：`src/services/auth/token-manager.ts:273-296`

**问题描述**：`TokenManager.saveToCache()` 将包含 `access_token` 的 `TokenCache` 对象以明文 JSON 写入 `~/.ybc/token.json`。虽然文件权限设置了 `0o600`，但 Windows 不支持 POSIX 文件权限（见 CR-004），且 access_token 是高敏感凭证。

**建议修复**：使用 `EncryptionService` 对 access_token 加密后再写入；或至少在 Windows 上使用 `icacls` 设置 ACL。

---

#### CR-004：Windows 上文件权限 `0o600` 无效

**严重度**：🟡 中等
**涉及文件**：`src/infrastructure/storage/file-storage.ts:99-102`

**问题描述**：项目声明支持 Node.js >=16（含 Windows），但 `FileStorage.write()` 使用 `mode: 0o600` 设置文件权限，这在 Windows 上完全被忽略。`~/.ybc/config.json`、`~/.ybc/token.json`、`~/.ybc/.key` 等敏感文件在 Windows 上会使用默认权限（通常所有用户可读）。

**建议修复**：检测平台，Windows 上使用 `icacls` 设置 ACL；或至少在 Windows 上给出权限警告。

---

#### CR-005：加密密钥文件 (`.key`) 明文 JSON 存储

**严重度**：🟡 中等
**涉及文件**：`src/infrastructure/crypto/encryption-service.ts:156-171`

**问题描述**：`EncryptionService.storeKey()` 将 Base64 编码的加密密钥以明文 JSON 存储在 `~/.ybc/.key`。攻击者获取此文件即可解密所有加密的 appSecret。

**建议修复**：考虑使用操作系统密钥管理服务（Windows DPAPI / macOS Keychain）存储加密密钥。

---

#### CR-006：`questionHidden()` 非 TTY 环境崩溃

**严重度**：🟡 中等
**涉及文件**：`src/cli/commands/config/init.ts:113`

**问题描述**：`questionHidden()` 调用 `process.stdin.setRawMode(true)`，但如果 stdin 不是 TTY（如 CI/CD 管道），`setRawMode` 会抛出 `TypeError`。

**建议修复**：调用前检查 `process.stdin.isTTY`，非 TTY 回退到普通 `readline.question()`。

---

#### CR-007：stdin data 事件监听器未移除

**严重度**：🟡 中等
**涉及文件**：`src/cli/commands/config/init.ts:110-145`

**问题描述**：`questionHidden()` 通过 `process.stdin.on('data', ...)` 监听输入，resolve 后未移除监听器。虽然 `finally` 中关闭了 `readline`，但 `stdin` 上的 `data` 监听器可能残留。

**建议修复**：resolve 前调用 `process.stdin.removeAllListeners('data')`。

---

### 架构类

#### CR-008：`TokenManager` / `DataCenterService` 绕过 `HttpClientFactory`

**严重度**：🟡 中等
**涉及文件**：
- `src/services/auth/token-manager.ts:59-64`
- `src/services/auth/datacenter-service.ts:25`

**问题描述**：两个 Service 直接 `axios.create()` 创建 HTTP 客户端，绕过了 `HttpClientFactory` 和拦截器体系（日志拦截器、错误处理拦截器）。Token 获取和数据中心查询的 HTTP 请求不会被日志拦截器记录，也不走统一错误处理。

**建议修复**：通过构造函数注入配置好拦截器的 `AxiosInstance`。

---

#### CR-009：CLI 命令内直接实例化 Service

**严重度**：🟡 中等
**涉及文件**：全部 5 个业务命令文件，每个命令中 `new ApiHttpWrapper()` / `new ApiClientService()`

**问题描述**：
1. 无法在测试中 mock 依赖
2. 每次命令执行都创建新实例，`ApiClientService.cachedGatewayUrl` 缓存无法跨命令共享
3. 违反依赖倒置原则

**建议修复**：在 `bootstrap()` 中创建共享 Service 实例，通过闭包或 context 注入到命令中。

---

#### CR-010：`auth-interceptor.ts` 仍使用 Authorization Header 注入

**严重度**：🟡 中等
**涉及文件**：`src/infrastructure/http/auth-interceptor.ts:57-59`

**问题描述**：拦截器中注入 `Authorization: Bearer ${token}`，与 ADR-7（query 参数传 token）矛盾。虽然当前业务命令已绕过此拦截器（改用 `ApiHttpWrapper`），但作为公开导出的基础设施模块，存在被误用风险。

**建议修复**：标记为废弃或重构为 query 参数模式。

---

#### CR-011：`update-checker.ts` 绕过 `FileStorage` 直接操作文件系统

**严重度**：🟡 中等
**涉及文件**：`src/services/update/update-checker.ts`（第 78、103、107、123、124、131 行）

**问题描述**：直接使用 `fs.readFileSync` / `fs.writeFileSync` / `fs.existsSync` / `fs.mkdirSync` 操作 `~/.ybc/update-check.json`，绕过 `FileStorage`，且**未设置 600 权限**。违反 CLAUDE.md "配置读写必须经过 ConfigService" 和 architecture.md "Service 层不直接读写文件" 约束。

**建议修复**：重构为使用 `FileStorage`。

---

### 错误处理类

#### CR-012：`ApiHttpWrapper.call()` 将非鉴权错误统一包装为 `AuthError`

**严重度**：🟡 中等
**涉及文件**：`src/services/api/api-http-wrapper.ts:72-81`

**问题描述**：所有非 401、非 AuthError 的错误（如 500 服务器错误、400 参数错误）都被包装为 `AuthError(TOKEN_REFRESH_FAILED)`，误导用户以为是鉴权失败。

**建议修复**：根据 HTTP 状态码区分错误类型：4xx 抛 `BusinessError`，5xx/网络错误抛 `NetworkError`。

---

#### CR-013：`queryStaff` 参数校验直接 `process.exit(1)` 而非抛 `ValidationError`

**严重度**：🟡 中等
**涉及文件**：`src/cli/commands/generated/staff/queryStaff.ts:23-28`

**问题描述**：当 `--id` 和 `--code` 都未传时，直接 `process.exit(1)` 绕过了统一错误处理器 `handleErrorAndExit`。

**建议修复**：改为 `throw new ValidationError(...)`，统一由 `handleErrorAndExit` 处理。

---

#### CR-014：`config set` 显示脱敏旧值未标注"已脱敏"

**严重度**：🟡 中等
**涉及文件**：`src/cli/commands/config/set.ts:69-81`

**问题描述**：获取旧配置时传入 `maskSensitive: true`，然后将脱敏后的 appSecret 值（如 `abcd****efgh`）显示为"旧值"。用户看到的旧值已经是脱敏的但未标注。

**建议修复**：对 appSecret 字段标注"（已脱敏显示）"。

---

### 代码质量类

#### CR-015：`any` 类型使用过多（约 20 处）

**严重度**：🟡 中等
**涉及文件**：
- `auth-interceptor.ts:24,30`（`client?: any`、`clientInstance: any`）
- `file-storage.ts:36,84`（`read(): Promise<any>`、`write(data: any)`）
- `encryption-service.ts:67,115`（`cipher as any`）
- `logging-interceptor.ts:44`（`maskObject(obj: any): any`）
- `config-service.ts:229`（`config[field] = processedValue as any`）

**建议修复**：逐步消除。`FileStorage.read()` 改为泛型 `read<T>()`；crypto 相关使用正确类型定义。

---

#### CR-016：业务成功码判断不一致

**严重度**：🟡 中等
**涉及文件**：
- `src/cli/commands/generated/staff/queryStaff.ts:43` — `code !== '200' && code !== ''`
- `src/cli/commands/generated/staff/enableStaff.ts:27` — `code !== 'SUCCESS' && code !== '00000'`
- 其余 3 个命令同 enableStaff

**问题描述**：同一 API 返回 `code: '200'` 时，`queryStaff` 认为成功，其他命令认为失败。

**建议修复**：抽取公共的响应码判断工具函数，统一成功码定义。

---

#### CR-017：生成的 API 客户端完全未使用

**严重度**：🟡 中等
**涉及文件**：`src/api/generated/` 全部

**问题描述**：`StaffApi`、`TodoApi` 等生成的客户端类从未被业务命令使用（改用 `ApiHttpWrapper` 直接发请求）。生成代码使用 Bearer Header 认证，与实际 query 参数模式矛盾。

**建议修复**：要么让生成器适配 query 参数认证使业务命令复用生成代码，要么移除未使用的生成代码减少包体积。

---

#### CR-018：`config set` 环境变量名提示错误

**严重度**：🟡 中等
**涉及文件**：`src/cli/commands/config/set.ts:63`

**问题描述**：

```typescript
console.log(chalk.cyan(`  export YBC_${field.toUpperCase()}=<value>`));
```

`field` 是 `appKey`，`field.toUpperCase()` 输出 `APPKEY`，但正确的环境变量名是 `YBC_APP_KEY`（全大写下划线分隔）。同理 `appSecret` → `APPSECRET` 而非 `APP_SECRET`。

**建议修复**：建立字段名到环境变量名的映射表。

---

#### CR-019：Token 刷新无并发控制

**严重度**：🟡 中等
**涉及文件**：`src/services/auth/token-manager.ts:77-117`

**问题描述**：`getValidToken()` 没有并发保护。多个命令同时触发 Token 刷新时会导致多次冗余请求。

**建议修复**：引入 `refreshPromise` 单例，后续调用复用同一个 Promise。

---

#### CR-020：`EncryptionService.getOrCreateKey()` 回退密钥未持久化

**严重度**：🟡 中等
**涉及文件**：`src/infrastructure/crypto/encryption-service.ts:200-218`

**问题描述**：密钥文件不存在时回退到 `hostname-username-platform` 派生密钥，但不保存到文件。后果：每次冷启动重新派生（性能浪费）；hostname/username 变更后旧数据无法解密。

**建议修复**：派生后调用 `this.storeKey()` 持久化。

---

## 🟢 轻微（16 项，可逐步改进）

| 编号 | 问题 | 文件 | 建议 |
|------|------|------|------|
| CR-021 | `--reveal` 输出 appSecret 无确认提示 | `config/show.ts:103` | 增加 `confirm? [y/N]` 提示 |
| CR-022 | `getConfigFingerprint()` 将 appSecret 纳入哈希 | `token-manager.ts:340` | 改用 `tenantId:appKey:env` |
| CR-023 | `DataCenterService` 缓存永不过期 | `datacenter-service.ts:103` | 增加 7 天过期机制 |
| CR-024 | `UpdateChecker` 用同步 `fs` 阻塞事件循环 | `update-checker.ts` | 改用 `fs.promises` |
| CR-025 | `bin/ybc.ts` bootstrap catch 硬编码退出码 1 | `bin/ybc.ts:12` | 用 `ErrorHandler.getExitCode(error)` |
| CR-026 | `ErrorHandler` 单例 config 不更新 | `error-handler.ts:46` | 支持 config 更新或改用 DI |
| CR-027 | `CsvFormatter.extractHeaders` 只取第一个对象的字段 | `csv.ts:87` | 遍历所有对象合并字段 |
| CR-028 | signature-service 注释中 appKey 值像真实凭证 | `signature-service.ts:18,42,109` | 替换为 `'your-app-key-here'` |
| CR-029 | 5 个命令样板代码完全重复 | `generated/` 全部 | 抽 `createCommandAction()` 高阶函数 |
| CR-030 | `EncryptionService` 不必要的 eslint-disable | `encryption-service.ts:7` | 移除，改 `generateKey()` 为同步 |
| CR-031 | Logger 服务无内置敏感字段过滤 | `logger.ts` | Logger 层面增加过滤 |
| CR-032 | 多处代码注释残留 "SK" 术语 | `show.ts:33`、`config-service.ts:27` | 统一为 appSecret |
| CR-033 | `config-service.ts:148` 向后兼容注释不准确 | `config-service.ts:148` | 注明实际已无 fallback |
| CR-034 | `errors.ts:93` 注释仍写 "SK" | `errors.ts:93` | 改为 appSecret |
| CR-035 | `openapi.yaml` securitySchemes 仍为 `bearerAuth` 类型 | `openapi.yaml:43` | 修改生成器模板或调整 security 定义 |
| CR-036 | `security.md` 推荐的 keytar 方案未实现 | `security.md` | 阶段性取舍，已合理 |

---

## 一致性审计：前次 7 项修复验证

| 编号 | 问题 | 状态 | 说明 |
|------|------|------|------|
| CONS-001 | 4/5 命令 Header 传 Token，违反 ADR-7 | ✅ 已修复 | 统一改用 `ApiHttpWrapper`，token 作为 query 参数 |
| MISS-001 | 401 业务自动重试缺失 | ✅ 已修复 | `api-http-wrapper.ts:62-69` 实现 |
| UNDOC-001 | update 服务未文档化 | ✅ 已修复（文档层面） | 代码层面架构违规留 CR-011 |
| OUTD-001 | openapi.yaml 鉴权描述过时 | ✅ 已修复 | info.description 已更新 |
| OUTD-002 | codes.ts 注释引 AK/SK | ✅ 已修复 | 已改为 appKey/appSecret |
| OUTD-003 | program.ts 版本号硬编码 + --format 缺 raw | ✅ 已修复 | 动态读取 + raw 已加 |
| MISS-002 | 手写覆盖目录未建 | ✅ 已修复（文档层面） | architecture.md §3 更新 |

**结论：前次 7 项全部已修复。**

---

## 一致性审计：新发现的不一致

| 编号 | 问题 | 严重度 | 说明 |
|------|------|--------|------|
| NEW-001 | auth-interceptor 仍用 Bearer Header | 🟡 | 与 ADR-7 矛盾，当前未被业务流程使用但存在误用风险 |
| NEW-002 | 生成 API 客户端仍用 Bearer Header | 🟡 | 重新生成会覆盖手改，CLAUDE.md "不手改 generated" 约束与当前修复矛盾 |
| NEW-003 | Logger 无内置敏感字段过滤 | 🟢 | HTTP 拦截器有过滤，但 Logger 直接调用时不过滤 |
| NEW-004 | Token 缓存未加密存储 | 🟡 | `security.md` 要求加密，`architecture.md` 未明确，两文档存在分歧 |
| NEW-005 | openapi securitySchemes 仍为 bearerAuth 类型 | 🟢 | 描述已修正但 schema 未对齐，影响生成链路 |

---

## 建议修复优先级

### 第一波：功能影响（CR-001 + CR-002 + CR-016）

| 问题 | 修复方式 | 预估工作量 |
|------|---------|-----------|
| CR-001 `options.format` 不生效 | 改为 `program.opts().format` | 30 分钟 |
| CR-002 accessToken 空字符串 | 加 `if (!accessToken)` 校验 | 10 分钟 |
| CR-016 成功码不一致 | 抽公共判断函数 | 30 分钟 |

### 第二波：安全加固

| 问题 | 修复方式 | 预估工作量 |
|------|---------|-----------|
| CR-006 非 TTY 崩溃 | 检查 `process.stdin.isTTY` | 15 分钟 |
| CR-005 `.key` 密钥保护 | 检测平台，Windows 用 DPAPI | 2 小时 |
| CR-003/CR-004 token 加密 + Windows ACL | EncryptionService 加密 token + icacls | 2 小时 |

### 第三波：架构治理

| 问题 | 修复方式 | 预估工作量 |
|------|---------|-----------|
| CR-011 update-checker 改用 FileStorage | 重构 | 1 小时 |
| CR-009 Service 实例共享 | DI / 单例 + 注入 | 2 小时 |
| CR-012 ApiHttpWrapper 错误分类 | 按 HTTP 状态码分错 | 1 小时 |
| CR-015 消除 any | 逐文件清理 | 3 小时 |
