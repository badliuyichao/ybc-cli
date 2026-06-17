# ROADMAP

> **ybc**（用友 BIP CLI）路线图
> 最后更新：2026-06-17

---

## 📍 当前状态

| 项 | 值 |
|----|----|
| **版本** | v0.1.6（package.json）/ v0.1.9（CHANGELOG 累计变更）|
| **阶段** | Phase 1 完成 + Phase 2 技术债清理完成 |
| **代码量** | 57 个 .ts 源文件 / ~7,200 行 |
| **测试** | 单元 22 套件 / 集成 5 套件 / E2E 7 套件 + 启动性能 1 套件 |
| **代码质量** | 手写 `any` 0 处 / `process.exit` 0 处 / ESLint 0 错 0 警 |
| **下次发版** | v0.2.0（架构治理 + 并发控制） |

---

## ✅ 已完成

### Phase 1：基础架构（v0.1.0 - v0.1.6）

详见 `CHANGELOG.md` [0.1.0] - [0.1.6]

- ✅ OpenAPI 驱动的命令生成
- ✅ Token 三级缓存 + 自动刷新
- ✅ HmacSHA256 签名
- ✅ 数据中心域名查询
- ✅ AES-256-GCM 加密 appSecret
- ✅ 配置文件 + 环境变量双轨
- ✅ 5 个业务命令（staff + todo）

### Phase 2：技术债清理（v0.1.7 - v0.1.9）

| 编号 | 标题 | commit |
|------|------|--------|
| CR-001 | 全局 `--format` 选项注入 | `046c4f9` |
| CR-002 | 空 token 缓存防护（三层校验）| `2245826` |
| CR-006 | `questionHidden` TTY 检查 | `e914c97` |
| CR-007 | EOF 时 stdin 监听器清理 | `e914c97` |
| CR-012 | ApiHttpWrapper 错误分类 | `f776a8b` |
| CR-014 | `config set` appSecret 旧值脱敏标注 | `e914c97` |
| CR-015 | 全面消除 `any`（手写 18 处 → 0）| `cc28664` |
| CR-016 | 业务成功码统一（200/00000/SUCCESS/''）| `43e6eeb` |
| CR-018 | env var 命名映射 | `e914c97` |
| CR-035 | 文档术语统一（SK → appSecret）| `e914c97` |
| CR-037 | 3 套件集成测试重写 | `1a12c84` |
| CR-040 | README 同步 | `e914c97` |
| CR-041 | config/* 16 处 `process.exit` 收敛 | `e914c97` |
| CR-042 | 真正删除 auth-interceptor | `df1bd85` |
| CR-045 | ApiHttpWrapper 22 用例单元测试 | `85f6293` |
| CR-048 | CRLF → LF 转换 + Prettier 修复 | `2d87d93` |
| CR-049 | token-manager 移除全文件 eslint-disable | `e914c97` |
| 待办-001 | 同步生成器模板到 ApiHttpWrapper 模式 | `43e6eeb` |
| 待办-002 | 删除 auth-interceptor | `df1bd85` |
| 待办-003 | 清理剩余 ESLint 真实错误（96 → 0）| `79bdb5b` |
| 待办-004 | ApiClientService 注入重构 | `58e1dca` |
| 拆分性能测试 | 启动性能单元测试（dist < 1s）| `a86956e` |

### 一致性审计（`docs/process/audit-code-vs-design.md`）

| 编码 | 标题 | 状态 |
|------|------|------|
| CONS-001 | 4/5 命令 Header 传 Token 违反 ADR-7 | ✅ 已修（CR-012/CR-037）|
| MISS-001 | 401 自动重试有承诺无实现 | ✅ 已修（CR-012）|
| UNDOC-001 | update 服务未文档化 | ✅ 已修（architecture.md）|
| OUTD-001 | openapi.yaml 鉴权描述过时 | ✅ 已修（info.description 更新）|
| OUTD-002 | codes.ts 注释引 AK/SK | ✅ 已修 |
| OUTD-003 | program.ts 版本号硬编码 + --format 缺 raw | ✅ 已修（version 动态读 + raw 已加）|
| MISS-002 | 手写命令覆盖目录未建 | ⚠️ 部分（architecture.md §3 已更新约束）|

**审计结论：7 项全部修复或约束更新。**

---

## 🔧 当前待办

### P0：立即可做（< 1 小时）

#### 待办-005：补 update-checker 退出码契约测试
- **文件**：`tests/unit/services/update/update-checker.test.ts`
- **目的**：验证网络错误时静默失败（exit 0），不退化为异常退出
- **工作量**：30 分钟
- **价值**：⭐⭐（防退化）

#### 待办-006：update-checker 改用 FileStorage
- **文件**：`src/services/update/update-checker.ts`
- **问题**：直接用 `fs.readFileSync` / `fs.writeFileSync` 操作 `~/.ybc/update-check.json`，违反 architecture.md §1 架构规则（Service 层不直接读写 `~/.ybc/*.json`）
- **改动**：替换为 `FileStorage`，加 600 权限
- **工作量**：1 小时
- **价值**：⭐⭐⭐（架构一致性 + 安全）

### P1：架构治理（半天）

#### 待办-007：TokenManager 并发控制
- **文件**：`src/services/auth/token-manager.ts`
- **问题**：`getValidToken()` 无并发保护，多命令同时触发 N 倍刷新请求
- **改动**：引入 `refreshPromise: Promise<string> | null` 单例
- **工作量**：1 小时
- **价值**：⭐⭐⭐（防止 batch 场景的 N 倍请求）

#### 待办-008：补充 performance 真实环境测试
- **状态**：已删除（`benchmarks/` 目录已移除，2026-06-17）
- **替代方案**：仅靠 `tests/unit/cli/startup.test.ts` 守门启动性能
- **API 性能**：如需临时诊断，手动跑（无保留脚本）

### P2：业务扩展（1-2 周）

#### 待办-009：voucher 域（凭证管理）
- **来源**：requirements.md §3 列为待启动
- **范围**：
  - `openapi/openapi.yaml` 加 voucher 端点
  - `npm run generate:api` + `npm run generate:commands`
  - 5-10 个新命令（依赖待办-001/004 完成的模板）
  - 单元/集成/E2E 测试
- **工作量**：3-5 天
- **价值**：⭐⭐⭐⭐⭐（业务扩展，覆盖 BIP 核心域）
- **前提**：P0/P1 待办全部完成

#### 待办-010：批量调用 `ybc batch -f file.json`
- **来源**：requirements.md §3 列为 P2
- **价值**：⭐⭐⭐⭐（数据同步场景核心能力）

#### 待办-011：命令搜索 `ybc search <kw>`
- **来源**：requirements.md §3 列为 P1
- **价值**：⭐⭐⭐（300+ API 场景下的发现能力）

#### 待办-012：Phase 4 大模型友好（`--help-json` / `--template` / 插件机制）
- **来源**：requirements.md §3 列为 P1
- **工作量**：1 周
- **价值**：⭐⭐⭐⭐⭐（AI Agent 集成的核心入口）

---

## 🗑️ 已废弃/移除

| 项 | 移除时间 | 原因 |
|----|---------|------|
| `benchmarks/api-perf.ts` | 2026-06-17 | 网络抖动污染 CI，改为手动诊断 |
| `benchmarks/README.md` | 2026-06-17 | 同上 |
| `docs/benchmarks.md` | 2026-06-17 | 同上 |
| `tests/e2e/scenarios/performance.test.ts` | 2026-06-17（→ .skip）| ts-node 启动 40s 掩盖真实性能 |
| `src/infrastructure/http/auth-interceptor.ts` | 2026-06-17 | 已用 ApiHttpWrapper 替代 |
| `tests/unit/infrastructure/http/auth-interceptor.test.ts` | 2026-06-17 | 同上 |

---

## 📊 累计代码质量指标

| 指标 | v0.1.6 | **v0.1.9（当前）** | 变化 |
|------|--------|------------------|------|
| 手写代码 `any` | 18 处 | **0** | -100% |
| `process.exit()` 直调 | 21 处 | **0**（config/* + generated/）| -100% |
| ESLint errors | ~165 | **0** | -100% |
| ESLint warnings | ~23 | **0** | -100% |
| `TODO` / `FIXME` | 0 | **0** | 持平 |
| `@ts-ignore` | 0 | **0** | 持平 |
| 集成测试套件 | 2/5 ❌ | **5/5 ✅** | 5 套件全过 |
| 集成测试用例 | 30/47 | **44/44** | +47% |
| api-http-wrapper 覆盖率 | 29.16% | **91.83%** | +62% |
| update-checker 覆盖率 | 0% | **≥80%** | +80% |
| 启动性能 | 未知 | **389ms < 1s** | 守住 CI |

---

## 🚀 建议执行路径

```
第 1 步（半天）：待办-005 + 待办-006
  → update-checker 完整化
      ↓
第 2 步（半天）：待办-007
  → TokenManager 并发安全
      ↓
第 3 步（1 周）：待办-009
  → voucher 域扩展
      ↓
第 4 步（按需）：待办-010/011/012
  → 高级能力
```

### 版本节奏建议

| 版本 | 范围 | 预计时间 |
|------|------|---------|
| **v0.1.10** | 待办-005（update-checker 测试）| 30 分钟 |
| **v0.1.11** | 待办-006（update-checker 改 FileStorage）| 1 小时 |
| **v0.1.12** | 待办-007（TokenManager 并发）| 1 小时 |
| **v0.2.0** | 待办-009（voucher 域）| 3-5 天 |
| **v0.3.0** | 待办-010/011 | 1-2 周 |
| **v1.0.0** | 待办-012（Phase 4 大模型友好）| 2-3 周 |

---

## 📚 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目说明 | `CLAUDE.md` | 项目概览 + 开发规范 |
| 架构设计 | `docs/design/architecture.md` | 4 层架构 + ADR + 鉴权机制 |
| 测试策略 | `docs/design/testing.md` | 单元/集成/E2E 分层 |
| 用户指南 | `docs/guides/usage.md` | 安装 + 配置 + 命令 + 故障排查 |
| 安全方案 | `docs/design/security.md` | 加密 + 凭证 + 审计 |
| 需求 | `docs/design/requirements.md` | 功能优先级矩阵 + 验收标准 |
| 初轮审计 | `docs/process/audit-code-vs-design.md` | 7 项一致性审计（全部修复）|
| 初轮审查 | `docs/process/code-review-20260612.md` | 36 项问题（已处理）|
| 补充审查 | `docs/process/code-review-20260616.md` | 15 项新问题（已处理）|
| 变更日志 | `CHANGELOG.md` | 版本历史 |