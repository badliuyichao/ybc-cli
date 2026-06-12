# ybc CLI 使用指南

> 用友 BIP 命令行工具，一份就能上手。本指南覆盖：安装 → 配置 → 命令 → 输出 → 调试 → 集成 → 故障排查。

---

## 🚀 快速开始（3 步上手）

```bash
# 1. 进入项目目录并安装依赖
cd D:\03-CODE\ybc-cli && npm install

# 2. 构建（生产模式必需，开发模式可跳过）
npm run build

# 3. 查看帮助（任选一种方式，见下表）
node dist/bin/ybc.js --help
```

### 三种运行方式对比

| 方式 | 命令 | 启动时间 | 适用场景 |
|------|------|---------|---------|
| **A. 编译版本** ⚡ | `node dist/bin/ybc.js …` | ~100-200ms | **生产推荐** |
| **B. npx ts-node** | `npx ts-node src/bin/ybc.ts …` | ~1000ms | 开发调试 |
| **C. npm run dev** | `npm run dev -- …` | ~1000ms | 开发调试（更规范）|

> ⚠️ 不要直接运行 `ts-node` —— 它装在项目本地不在全局路径。用 `npx ts-node` 或 `npm run dev --`。
> ⚠️ `npm run dev` 后面要加 `--` 才能把参数传给 ybc：`npm run dev -- --help`。

> 下文示例统一用 `ybc` 代表 CLI 入口，实际使用时替换为上面三种之一即可。

---

## 🔧 配置

### 方法 1：环境变量（推荐 CI/CD 与一次性测试）

```bash
# 推荐使用新字段名
export YBC_TENANT_ID="你的租户ID"
export YBC_APP_KEY="你的AppKey"
export YBC_APP_SECRET="你的AppSecret"
export YBC_ENV="sandbox"                  # sandbox | production
export YBC_FORMAT="table"                 # 可选：json | table | csv | raw
```

```powershell
# Windows PowerShell
$env:YBC_TENANT_ID="你的租户ID"
$env:YBC_APP_KEY="你的AppKey"
$env:YBC_APP_SECRET="你的AppSecret"
```

```cmd
:: Windows CMD
set YBC_TENANT_ID=你的租户ID
set YBC_APP_KEY=你的AppKey
set YBC_APP_SECRET=你的AppSecret
```

> 旧字段 `YBC_AK` / `YBC_SK` 仍可用（向后兼容），但**新字段优先**。建议新配置使用新字段。

### 方法 2：交互式 config init（推荐持久化）

```bash
ybc config init
# 依次提示：tenantId → appKey → appSecret → env
# 完成后写入 ~/.ybc/config.json（权限 600，appSecret 自动 AES-256-GCM 加密）
```

### 方法 3：单字段 config set

```bash
ybc config set tenantId  "你的租户ID"
ybc config set appKey    "你的AppKey"
ybc config set appSecret "你的AppSecret"
ybc config set env       sandbox
ybc config set format    json
```

### 配置文件格式

**位置**：`~/.ybc/config.json`（Windows: `C:\Users\<你>\.ybc\config.json`）

```json
{
  "tenantId": "your-tenant-id",
  "appKey": "your-app-key",
  "appSecret": "<AES-256-GCM 加密>",
  "env": "sandbox",
  "format": "table",
  "version": "2.0"
}
```

> **优先级**：环境变量 > 配置文件
> **必需字段**：`tenantId` / `appKey` / `appSecret`（缺一不可）

### 查看与脱敏显示

```bash
ybc config show
# 输出（appSecret 自动脱敏）：
#   租户ID:     your-tenant-id
#   App Key:    your-app****
#   App Secret: ****（已加密存储）
#   环境:       sandbox
#   输出格式:   table
```

---

## 📋 命令清单

| 命令 | 说明 |
|------|------|
| `ybc --help` | 顶级帮助 |
| `ybc <domain> --help` | 域级帮助（如 `ybc staff --help`）|
| `ybc <domain> <action> --help` | 命令级帮助 |
| `ybc config init` | 交互式初始化配置 |
| `ybc config show` | 查看当前配置（敏感字段脱敏）|
| `ybc config set <field> <value>` | 设置单个字段 |
| `ybc staff query --code EMP001` | 查询员工详情 |
| `ybc staff enable <id>` | 启用员工 |
| `ybc staff disable <id>` | 禁用员工 |
| `ybc todo list` | 查询待办列表 |
| `ybc todo create --title "…"` | 创建待办 |

> 业务命令由 OpenAPI 规范自动生成。新增 API → 改 `openapi/openapi.yaml` → `npm run generate:api` → `npm run generate:commands`。

---

## 🎨 输出格式

全局 `--format` 选项，支持 4 种：

| 格式 | 适用场景 | 示例 |
|------|---------|------|
| `table`（默认）| 终端查看 | `ybc staff query --code EMP001` |
| `json` | 脚本/AI Agent 消费 | `ybc staff query --code EMP001 --format json` |
| `csv` | 导出 Excel | `ybc staff query --format csv > staff.csv` |
| `raw` | 管道传输原始响应 | `ybc staff query --raw \| jq '.data'` |

### 全局选项

```bash
--format <json|table|csv|raw>    # 输出格式
--raw                            # 仅输出原始 JSON（同 --format raw）
--verbose                        # 详细调试日志
--no-color                       # 禁用颜色（CI/CD 友好）
--dry-run                        # 预览请求而不发送
--help, -h                       # 命令帮助
--version, -V                    # 版本号
```

---

## 🐛 调试

### verbose 模式：看清整个流程

```bash
ybc staff query --code EMP001 --verbose
# 输出包含：
#   - 数据中心查询请求与响应
#   - 时间戳生成、签名计算步骤
#   - Token 获取请求与响应（access_token 自动脱敏）
#   - 业务接口请求 URL / Method / Params
#   - 错误堆栈（若有）
```

### dry-run：预览请求不发送

```bash
ybc staff query --code EMP001 --dry-run --verbose
```

### 检查缓存文件

| 文件 | 内容 |
|------|------|
| `~/.ybc/config.json` | 配置 |
| `~/.ybc/token.json` | Token 缓存（含 `access_token`、`expires_at`、`configFingerprint`）|
| `~/.ybc/datacenter.json` | 数据中心域名缓存（`gatewayUrl`、`tokenUrl`）|

```bash
# Linux/Mac
cat ~/.ybc/token.json | jq .

# Windows
type %USERPROFILE%\.ybc\token.json
```

### 强制刷新 Token

```bash
# 直接删除缓存即可，下次调用会自动重新获取
rm ~/.ybc/token.json                            # Linux/Mac
del %USERPROFILE%\.ybc\token.json               # Windows
```

---

## 🧪 测试

```bash
npm test                       # 全部测试
npm run test:unit              # 单元测试（已稳定，≥80% 覆盖率）
npm run test:integration       # 集成测试
npm run test:e2e               # E2E 测试（部分 token-refresh/error/perf 场景待修，见 ROADMAP）
npm run test:coverage          # 覆盖率报告 → coverage/lcov-report/index.html

# 单文件
npm test -- tests/unit/services/auth/signature-service.test.ts

# 按名称匹配
npm test -- --testNamePattern="getValidToken"
```

### 关键测试速查

| 测试文件 | 用例数 | 覆盖率 |
|---------|-------|--------|
| `signature-service.test.ts` | 20 | 100% |
| `datacenter-service.test.ts` | 19 | 97.5% |
| `token-flow.test.ts` (integration) | 13 | 82% |

---

## 🔗 脚本与 CI/CD 集成

### Shell 批量调用

```bash
#!/bin/bash
for code in EMP001 EMP002 EMP003; do
  node dist/bin/ybc.js staff query --code "$code" --format json
done
```

### Python 调用

```python
import subprocess, json

result = subprocess.run(
    ['node', 'dist/bin/ybc.js', 'staff', 'query', '--code', 'EMP001', '--format', 'json'],
    capture_output=True, text=True, check=True
)
data = json.loads(result.stdout)
print(f"员工姓名: {data['data']['name']}")
```

### GitHub Actions

```yaml
name: Sync Staff Data
on:
  schedule: [{ cron: '0 9 * * *' }]
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '16' }
      - run: npm ci && npm run build
      - run: node dist/bin/ybc.js staff query --format csv > staff.csv
        env:
          YBC_TENANT_ID:  ${{ secrets.YBC_TENANT_ID }}
          YBC_APP_KEY:    ${{ secrets.YBC_APP_KEY }}
          YBC_APP_SECRET: ${{ secrets.YBC_APP_SECRET }}
          YBC_ENV:        production
      - uses: actions/upload-artifact@v3
        with: { name: staff-data, path: staff.csv }
```

---

## 🔢 退出码（脚本与 AI Agent 友好）

| 码 | 含义 |
|----|------|
| `0` | 成功 |
| `1` | 通用错误（CLI 解析、参数错误）|
| `4` | 业务错误（API 返回 code ≠ '00000'）|
| `5` | 网络错误（超时、DNS、连接失败）|
| `6` | 鉴权错误（appKey/appSecret 无效、Token 刷新失败）|

---

## 🛠️ 故障排查

### 配置类

| 症状 | 解决 |
|------|------|
| `ValidationError: Tenant ID (tenantId) is required` | 运行 `ybc config init` 或设置 `YBC_TENANT_ID` 环境变量 |
| `App Key 必须 16-128 字符` | 检查 appKey 是否被截断；前后引号要去掉 |
| `ts-node: command not found` | 用 `npx ts-node` 或 `npm run dev --`，不要直接 `ts-node` |

### 鉴权类（退出码 6）

| 症状 | 排查方向 |
|------|---------|
| `鉴权失败：App Key 或 App Secret 无效` | 1) 检查 `config show` 输出；2) 删除 `~/.ybc/token.json` 重试；3) 用 `--verbose` 看签名计算 |
| `Failed to refresh token` | 检查 `tenantId` 是否在用友平台上有效；检查网络能否访问 `api.yonyoucloud.com` |
| 签名一直失败 | 时间戳必须毫秒级（`Date.now()`）；机器时间必须准确（与互联网时间差 < 5 分钟）|

### 网络类（退出码 5）

```bash
ping api.yonyoucloud.com           # 数据中心查询入口
ybc staff query --verbose          # 看具体卡在哪一步
```

### Token 自动刷新

ybc 会在 Token 过期前 5 分钟自动刷新，**无需手动干预**。出现以下情况会强制刷新：

- Token 文件不存在
- Token 已过期
- `configFingerprint` 与当前配置不匹配（配置变更后）
- 业务接口返回 401（自动重试 1 次）

如自动刷新失败：
```bash
rm ~/.ybc/token.json                 # 强制重新获取
ybc staff query --code EMP001
```

### 性能类

```bash
# CLI 启动慢？用编译版本
npm run build && node dist/bin/ybc.js --help   # ~150ms vs ts-node 的 ~1000ms
```

---

## 📚 相关文档

| 想了解 | 看哪里 |
|--------|--------|
| 项目架构 | [`../design/architecture.md`](../design/architecture.md) |
| 鉴权机制（签名 + Token + 数据中心）| [`../design/architecture.md`](../design/architecture.md) |
| 测试策略 | [`../design/testing.md`](../design/testing.md) |
| 安全方案 | [`../design/security.md`](../design/security.md) |
| 当前待办与下一步 | [`../../ROADMAP.md`](../../ROADMAP.md) |
| 版本历史 | [`../../CHANGELOG.md`](../../CHANGELOG.md) |
| 用友官方 API 原文 | [`../design/ref/`](../design/ref/) |
