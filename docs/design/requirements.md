# 需求与验收

> 本文档是 ybc 产品需求、功能优先级与验收标准的权威说明。

---

## 1. 项目定位

**问题**：用友 BIP 开放平台提供 300+ API，覆盖财务、供应链、人力等业务域。当前调用需要手动查文档、自行实现签名、组装 HTTP 请求——集成成本高、调试低效、自动化困难，对大模型 Agent 尤其不友好。

**目标**：把 BIP OpenAPI 封装为一个全平台 CLI 工具，让开发者、运维、AI Agent 以**最低认知负担**完成接口调用。

**核心价值**：
- 一键安装（`npm install -g @liuychk/ybc`）
- 零配置快速调用（一次配 tenantId/appKey/appSecret，自动管 Token）
- 三级帮助 + 自动生成命令（无需翻文档）
- 双模输出（人类友好表格 + 机器友好 JSON）
- 安全可靠（appSecret 加密、文件权限 600、绝不日志泄露）

---

## 2. 用户角色

| 角色 | 典型场景 | 关键诉求 |
|------|---------|---------|
| **集成开发者** | 对接 ERP、写集成脚本 | 调试方便、请求预览、结构化输出 |
| **运维 / 数据工程师** | 定时同步、报表导出 | 非交互运行、环境变量注入、批量调用 |
| **业务顾问** | 查询数据（员工、凭证）| 命令易记、交互式帮助、表格输出 |
| **AI Agent** | 工具调用 BIP 完成任务 | 稳定 JSON 输出、规范退出码、零交互 |

---

## 3. 功能优先级矩阵

| 模块 | 内容 | 优先级 | 现状 |
|------|------|--------|------|
| **配置管理** | `config init/show/set`（含 tenantId/appKey/appSecret 等新字段）| P0 | ✅ 已完成 |
| **鉴权** | HmacSHA256 签名、数据中心查询、Token 三级缓存 | P0 | ✅ 已完成 |
| **业务命令** | 自动从 OpenAPI 生成 | P0 | 🟡 staff + todo 完成；voucher 待补 |
| **输出格式** | json / table / csv / raw | P0 | ✅ 已完成 |
| **退出码规范** | 0/1/4/5/6 标准化 | P0 | ✅ 已完成 |
| **三级帮助** | `--help` 顶级 / 域级 / 命令级 | P0 | ✅ 由 commander 自动支持 |
| **环境变量配置** | `YBC_*` 全套（CI/CD）| P0 | ✅ 已完成 |
| **调试选项** | `--dry-run`、`--verbose`、`--no-color` | P1 | ✅ 已完成 |
| **环境管理** | `ybc env list/switch sandbox/production` | P1 | ⏸️ 未启动 |
| **命令搜索** | `ybc search <kw>` | P1 | ⏸️ 未启动 |
| **统计与全量列表** | `ybc stats` / `ybc list --all` | P1 | ⏸️ 未启动 |
| **大模型友好** | `--help-json` 输出 JSON Schema | P1 | ⏸️ 未启动 |
| **批量调用** | `ybc batch -f file.json` | P2 | ⏸️ 未启动 |
| **模板功能** | `--template @file.json` | P2 | ⏸️ 未启动 |
| **交互式浏览** | 无参数进入菜单 | P2 | ⏸️ 未启动 |
| **插件机制** | `@ybc-plugin/*` 第三方扩展 | P2 | ⏸️ 未启动 |

---

## 4. 功能验收标准

### 4.1 配置管理

| 验收点 | 验证方式 |
|--------|---------|
| `ybc config init` 引导用户输入 tenantId / appKey / appSecret / env | E2E `config-init.test.ts` |
| `ybc config show` 显示配置；`appSecret` 脱敏为 `****`；显示数据中心信息（如有）| E2E `config-show.test.ts` |
| `ybc config set <field> <value>` 支持新字段名 | E2E `config-set.test.ts` |
| `appSecret` AES-256-GCM 加密存储 | 单元测试 + 检查 `~/.ybc/config.json` 内容 |
| 配置文件权限 600 | 测试断言 `stat()` 输出 |
| 环境变量优先级高于文件 | 集成测试 |

### 4.2 鉴权

| 验收点 | 验证方式 |
|--------|---------|
| 首次调用自动获取 Token 并缓存 | 集成测试 `token-flow.test.ts` |
| Token 过期前 5 分钟自动刷新 | 单元测试 `isExpired()` |
| 配置变更后旧 Token 立即失效（`configFingerprint` 不匹配）| 单元测试 |
| 401 错误自动重试一次 | 集成测试 |
| 签名算法符合官方规范（HmacSHA256 + Base64）| 单元测试 `signature-service.test.ts`（20 用例 100% 覆盖）|
| 数据中心域名动态查询 + 缓存 | 单元测试 `datacenter-service.test.ts`（19 用例 97.5% 覆盖）|
| `appSecret` / `access_token` 不出现在任何日志 | 代码评审 + 日志样本检查 |

### 4.3 业务命令

| 验收点 | 验证方式 |
|--------|---------|
| `ybc staff query --code <id>` 返回员工详情 | E2E `staff-query.test.ts` |
| `ybc todo list` 返回待办列表 | E2E `todo-list.test.ts` |
| 业务错误（API code ≠ '00000'）→ 退出码 4 | 集成测试 |
| 网络错误 → 退出码 5 | 集成测试 |
| 鉴权错误 → 退出码 6 | 集成测试 |

### 4.4 输出格式

| 验收点 | 验证方式 |
|--------|---------|
| `--format json` 输出稳定 schema、可被 `JSON.parse()` | 单元测试 |
| `--format table` 终端渲染美观、有颜色 | 单元测试（mock 颜色）|
| `--format csv` 支持特殊字符转义 | 单元测试 |
| `--raw` 输出原始服务端响应 | 单元测试 |
| `--no-color` 禁用所有 ANSI 颜色 | 集成测试 |

### 4.5 非功能性

| 验收点 | 目标 | 测试 |
|--------|------|------|
| 编译版启动时间 | < 500ms | `time node dist/bin/ybc.js --version` |
| 首次 API 调用 | < 2s | `tests/e2e/scenarios/performance.test.ts` |
| 缓存 Token 后调用 | < 1s | 同上 |
| 单元测试覆盖率 | ≥ 80% | `npm run test:coverage` |
| 跨平台 | Windows / macOS / Linux | CI 矩阵（待补）|

---

## 5. 用户故事示例

### US-1：开发者快速调试一个 API

```bash
ybc config init                                    # 1. 输入凭证
ybc staff query --code EMP001 --format json        # 2. 立即调用
ybc staff query --code EMP001 --verbose            # 3. 调试请求细节
ybc staff query --code EMP001 --dry-run            # 4. 预览而不发送
```

**预期**：4 步内拿到结果，不需要看任何文档。

---

### US-2：CI 脚本同步数据

```yaml
env:
  YBC_TENANT_ID:  ${{ secrets.YBC_TENANT_ID }}
  YBC_APP_KEY:    ${{ secrets.YBC_APP_KEY }}
  YBC_APP_SECRET: ${{ secrets.YBC_APP_SECRET }}
run: ybc staff query --format csv > staff.csv
```

**预期**：无需配置文件、退出码可判断成败、CSV 直接可消费。

---

### US-3：AI Agent 通过工具调用 BIP

```python
result = subprocess.run(
    ['ybc', 'staff', 'query', '--code', 'EMP001', '--format', 'json'],
    capture_output=True, text=True, check=True
)
data = json.loads(result.stdout)
```

**预期**：JSON 输出稳定可解析、退出码 0/4/5/6 让 Agent 区分错误类型。

---

## 6. 命令清单（MVP 范围）

```
# 配置
ybc config init
ybc config show
ybc config set <field> <value>

# 鉴权（隐式自动管理，无独立命令）

# 业务（自动生成）
ybc staff query --code <id>
ybc staff enable <id>
ybc staff disable <id>
ybc todo list [--status]
ybc todo create --title <t>
```

完整未来命令规划见 [`../../ROADMAP.md`](../../ROADMAP.md)。

---

## 7. 参考

- 详细架构：[`architecture.md`](architecture.md)
- 鉴权与架构：[`architecture.md`](architecture.md)
- 测试策略：[`testing.md`](testing.md)
- 用户使用指南：[`../guides/usage.md`](../guides/usage.md)
