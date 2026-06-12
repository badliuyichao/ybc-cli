# 代码与设计文档一致性审计报告

> **日期**：2026-06-12
> **范围**：`src/` 全部源代码 vs `docs/design/` 全部设计文档
> **方法**：以 `architecture.md` + `requirements.md` + `testing.md` 为基准，逐项核验代码实现

---

## 问题分类编码

| 前缀 | 类别 | 含义 |
|------|------|------|
| **CONS** | 一致性偏差 | 设计文档描述了 A，代码实现了 B，两者互斥 |
| **UNDOC** | 未文档化 | 代码中存在完整的功能模块，但设计文档未提及 |
| **OUTD** | 文档过时 | 代码已按新方案实现，但相关文档/注释仍指向旧方案 |
| **MISS** | 实现缺失 | 设计文档明确承诺的功能，代码中不存在对应实现 |

---

## CONS-001：业务命令鉴权方式与 ADR-7 相悖

**分类**：一致性偏差（CONS）
**严重度**：🔴 严重
**设计文档**：`docs/design/architecture.md` ADR-7
**涉及代码**：`src/cli/commands/generated/staff/enableStaff.ts` `disableStaff.ts` `src/cli/commands/generated/todo/listTodos.ts` `createTodo.ts`

### 文档描述（ADR-7 原文）

> `access_token` 用 **query 参数**而不用 Authorization Header。用友 BIP 业务接口只认 query 参数。

### 代码现状

| 命令 | 文件 | 鉴权方式 |
|------|------|---------|
| `staff query` | `queryStaff.ts` | 原始 axios，`access_token` 在 `params` 中 | ✅ 符合 ADR-7 |
| `staff enable` | `enableStaff.ts` | `new StaffApi(configuration)` → 走生成的 base.ts，**accessToken 注入 Authorization Header** | ❌ 不符合 |
| `staff disable` | `disableStaff.ts` | 同上 | ❌ 不符合 |
| `todo list` | `listTodos.ts` | `new TodoApi(configuration)` → 同上 | ❌ 不符合 |
| `todo create` | `createTodo.ts` | `new TodoApi(configuration)` → 同上 | ❌ 不符合 |

### 差异点

1. **5 个命令中 4 个使用生成的 API 客户端，1 个手动绕过**。`queryStaff.ts` 使用原始 `axios.create()` 构造请求，把 `access_token` 放在 `params` 中；其余 4 个命令调用 `new StaffApi(configuration)` 或 `new TodoApi(configuration)`，依赖生成客户端的内建鉴权机制。

2. **生成客户端的鉴权方式由 `openapi.yaml` 决定**——当前 `openapi.yaml` 的 `info.description` 声明 `Authorization: Bearer <your_access_token>`（见问题 OUTD-001），生成的 `base.ts` 和 `configuration.ts` 依此将 token 注入 HTTP Header。

3. **`queryStaff.ts` 绕过生成客户端的做法在 `generate-commands.ts` 中没有体现**——生成器产生的模板是"调用 API 客户端"模式（即其他 4 个命令的模式），`queryStaff.ts` 是手改的例外，说明生成器本身与 ADR-7 不兼容。

### 影响

- 如果用真实 BIP API 调用 `staff enable` / `staff disable` / `todo list` / `todo create`，token 将以 Header 方式传递，根据 ADR-7 的实测结论，BIP 不接受此方式，会导致 401。
- 生成器（`scripts/generate-commands.ts`）产出的模板与架构决策不兼容，任何后续新增域的命令都会默认走 Header 模式。

---

## MISS-001：401 业务接口自动重试——有设计承诺，无代码实现

**分类**：实现缺失（MISS）
**严重度**：🔴 严重
**设计文档**：`docs/design/architecture.md` §5.3
**涉及代码**：全部业务命令文件 + `src/services/auth/token-manager.ts`

### 文档描述（architecture.md §5.3 原文）

> **401 重试**：业务接口 401 → 清除缓存 → 刷新 Token → 重试一次

### 代码现状

1. **业务命令层**（`queryStaff.ts` / `enableStaff.ts` 等全部 5 个命令）：`catch` 块统一调用 `handleErrorAndExit(error)`，**无任何 401 判断，无任何重试**。

2. **TokenManager 层**（`token-manager.ts:215`）：仅在 `refreshToken()` 方法内部判断 **Token 获取端点自身**返回的 401——那是"获取 Token 失败"的场景，不是"拿已有 Token 调业务接口被拒"的场景。

3. **api-client-service.ts**：`getConfiguration()` 只负责装配 Configuration 对象，不涉及请求拦截或重试。

### 差异点

| 文档承诺 | 代码实际 |
|---------|---------|
| 业务接口返回 401 | `catch` 直接触发 `handleErrorAndExit()` |
| 清除缓存旧 Token | 未实现 |
| 自动刷新 Token | 未实现 |
| 用新 Token 重试原请求 | 未实现 |

### 影响

- Token 过期后的首次业务调用不会自动恢复，用户看到退出码 6 的鉴权错误，而不是透明刷新后继续执行。
- 文档描述的用户体验（"整个过程对用户透明"）与实际代码不匹配。

---

## UNDOC-001：版本更新检查模块——完整功能模块未在设计文档中记录

**分类**：未文档化（UNDOC）
**严重度**：🟡 重要
**设计文档**：`docs/design/architecture.md` §2（目录结构）+ §7（技术选型）
**涉及代码**：`src/services/update/update-checker.ts` + `src/services/update/index.ts`

### 代码现状

`src/services/update/update-checker.ts` 是一个完整的独立模块（137 行），实现：
- CLI 启动时异步检查 npm registry 上的最新版本
- 24 小时内缓存检查结果（`~/.ybc/update-check.json`）
- 版本号语义比较
- 控制台提示用户升级命令
- CLI 选项 `--no-update-check` 对应禁用

### 文档缺失点

1. **architecture.md §2 目录结构**：`src/services/` 下未列出 `update/` 目录。
2. **architecture.md §7 技术选型**：未提及 npm registry 查询依赖。
3. **requirements.md §3 功能优先级矩阵**：更新检查功能未出现在任何优先级行中。
4. **architecture.md §6 持久化文件**：只列了 `config.json` / `token.json` / `datacenter.json`，未列 `update-check.json`。

### 额外发现：违反架构规则

architecture.md §1 明确：
> Service 层 **不直接**读写 `~/.ybc/*.json`，必须经 Infrastructure 层

但 `update-checker.ts` 直接使用 `fs.readFileSync` / `fs.writeFileSync` / `fs.existsSync` / `fs.mkdirSync` 操作 `~/.ybc/update-check.json`，**绕过了 `FileStorage`**，且**未设置 600 权限**（`config.json` 和 `token.json` 都设置了）。

---

## OUTD-001：openapi.yaml 鉴权描述仍指向旧版 AK/SK + Bearer Header 方案

**分类**：文档过时（OUTD）
**严重度**：🟡 重要
**设计文档**：`openapi/openapi.yaml`（自身即为 OpenAPI 生成链的事实来源）
**涉及代码**：`src/api/generated/` 全部（由 openapi.yaml 驱动生成）

### 文档当前内容（openapi.yaml info.description）

```
Token 通过 AK/SK 签名机制获取
所有 API 调用需要在请求头中携带 Bearer Token：Authorization: Bearer <your_access_token>
```

### 实际实现

| 维度 | openapi.yaml 描述 | 实际实现 |
|------|-----------------|---------|
| 凭证字段 | AK/SK | **appKey** / **appSecret** |
| 鉴权算法 | 未描述 | **HmacSHA256** 签名（5 步算法） |
| 鉴权流程 | 无数据中心概念 | **先查数据中心域名** → 再获 Token |
| Token 传参 | `Authorization: Bearer` Header | **query 参数** `?access_token=xxx`（ADR-7） |
| API 版本路径 | 未区分 | `/selfAppAuth/base/v1/getAccessToken`（2023-07-21 新版） |

### 影响

**openapi.yaml 是 `npm run generate:api` 的唯一输入**。如果任何人基于当前版本重新生成：
1. 生成的 `api.ts` / `base.ts` 默认鉴权模式为 Bearer Header
2. 生成的 `configuration.ts` 的注释也会写入过时描述
3. 生成的 16 个 API docs Markdown 全部延续旧描述
4. 进一步放大 CONS-001（Header vs query param 不一致）

---

## OUTD-002：codes.ts JSDoc 注释引用已废弃的 AK/SK 字段名

**分类**：文档过时（OUTD）
**严重度**：🟢 轻微
**设计文档**：`docs/design/architecture.md` §5
**涉及代码**：`src/services/error/codes.ts`

### 差异点

| 位置 | 当前注释 | 应更新为 |
|------|---------|---------|
| `codes.ts:12` | `鉴权错误（AK/SK 无效、token 刷新失败等）` | `鉴权错误（appKey/appSecret 无效、token 刷新失败等）` |
| `codes.ts:39` | `用于 AK/SK 无效、token 获取失败...` | `用于 appKey/appSecret 无效、token 获取失败...` |

代码中的枚举值和退出码逻辑是正确的，仅注释过时。

---

## OUTD-003：program.ts 全局选项与实际功能矩阵不一致

**分类**：文档过时（OUTD）
**严重度**：🟢 轻微
**设计文档**：`docs/design/architecture.md` §1 + `docs/design/requirements.md` §3
**涉及代码**：`src/cli/program.ts`

### 差异点

#### 3.1 版本号硬编码

| 来源 | 值 |
|------|-----|
| `package.json` | `"version": "0.1.6"` |
| `program.ts:14` | `.version('0.1.0', ...)` |

用户执行 `ybc --version` 显示 `0.1.0`，与实际版本不一致。

#### 3.2 --format 选项类型声明缺少 raw

| 文档 | 代码 |
|------|------|
| 支持 json / table / csv / **raw** 四种 | `program.ts:15` 声明 `<json\|table\|csv>` 三种 |

raw 通过独立 `--raw` flag 实现，但 `--format raw` 会被 commander 类型校验拒绝。

#### 3.3 --help-json 选项声明但无实现

| 文档 | 代码 |
|------|------|
| requirements.md §3 列为 P1 功能 | `program.ts:20` 声明了选项，但无任何命令实现 JSON Schema 输出 |

---

## MISS-002：手写命令覆盖目录在设计中描述、文件系统中不存在

**分类**：实现缺失（MISS）
**严重度**：🟢 轻微
**设计文档**：`docs/design/architecture.md` §3

### 文档描述

> 业务逻辑覆盖写到 `src/cli/commands/<domain>/`（非 `generated/`），不污染生成区

### 代码现状

`src/cli/commands/` 下只有：
- `config/`（手写管理命令，不属于业务域覆盖）
- `generated/`（自动生成，不可手改）

**不存在任何 `<domain>/` 覆盖目录**（如 `staff/`、`todo/`）。当前 `queryStaff.ts` 对 ADR-7 的手动适配是**直接在 `generated/staff/` 目录里改的**，这意味着下次 `npm run generate:commands` 会覆盖掉手改内容。

---

## 💡 补充发现（非差异项，但值得记录）

### 测试用例数与文档一致 ✅

| 测试文件 | 文档宣称 | 实际 `it()` 数 |
|---------|---------|---------------|
| `signature-service.test.ts` | 20 | 20 |
| `datacenter-service.test.ts` | 19 | 19 |
| `token-flow.test.ts` | 13 | 13 |

三项与设计文档一致，无需修正。

### 实际目录结构匹配度

`src/` 目录树与 architecture.md §2 的描述基本一致，仅 `update/` 未标注 + `cli/commands/<domain>/` 缺失。

---

## 📊 问题汇总

| 编码 | 类别 | 严重度 | 简述 |
|------|------|--------|------|
| **CONS-001** | 一致性偏差 | 🔴 严重 | 4/5 命令用 Header 传 Token，违反 ADR-7 |
| **MISS-001** | 实现缺失 | 🔴 严重 | 401 业务接口自动重试有文档承诺无代码 |
| **UNDOC-001** | 未文档化 | 🟡 重要 | update 服务完整模块未在设计文档中记录，且违反架构规则 |
| **OUTD-001** | 文档过时 | 🟡 重要 | openapi.yaml 鉴权描述仍为旧版 AK/SK + Bearer Header |
| **OUTD-002** | 文档过时 | 🟢 轻微 | codes.ts 注释引 AK/SK |
| **OUTD-003** | 文档过时 | 🟢 轻微 | program.ts 版本号硬编码 + --format 缺 raw + --help-json 空声明 |
| **MISS-002** | 实现缺失 | 🟢 轻微 | 手写命令覆盖目录未建 |

**统计**：一致性偏差 1 项 / 实现缺失 2 项 / 未文档化 1 项 / 文档过时 3 项
