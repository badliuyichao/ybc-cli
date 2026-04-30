# 用友BIP CLI（ybc）需求与产品设计文档

---

## 文档信息

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-25 | - | 初稿，涵盖需求分析、产品功能清单、帮助系统设计、技术路线、实施计划 |

**适用范围**：`ybc` CLI 工具的设计、开发、测试与交付。  
**目标读者**：产品经理、前端/全栈开发工程师、测试工程师。

---

## 1. 项目背景与目标

用友 BIP 开放平台提供了 300+ 标准化 API 接口，覆盖财务、供应链、人力等业务域，并提供基于 AK/SK 的开放鉴权。然而目前调用这些接口需手动查阅在线文档、自行实现鉴权和 token 管理、组装 HTTP 请求，导致集成门槛高、调试效率低、自动化困难，尤其不利于大模型 Agent 等新型客户端消费。

`ybc` 的目标是将 BIP OpenAPI 封装为一个全平台可用的命令行工具，使开发者、运维人员及大模型 Agent 能以**最低的认知负担**完成接口调用。

**核心目标**：
- **一键安装使用**：通过 `npm install -g ybc` 即可获得所有能力。
- **零配置快速调用**：一次配置 AK/SK，自动管理 token 生命周期。
- **自然发现命令**：三级帮助体系 + 关键词搜索，无需翻阅文档。
- **双模输出**：人类友好的表格与机器友好的 JSON，适配人与大模型。
- **安全可靠**：SK 本地加密/环境变量注入，绝不明文泄露。

---

## 2. 需求分析

### 2.1 用友 BIP 开放平台能力综述

- **鉴权方式**：标准 AK/SK 换取 `access_token`，token 有效期较短（通常2小时）。调用流程：`POST /token` → 获取 `access_token` → 业务请求头携带 `Authorization: Bearer <token>`。
- **API 规模**：12 个以上业务域，300+ 接口，存在依赖（如先获取 `applicationId` 才能调业务接口）。
- **限流策略**：接口级限流，返回 429；可付费升速。
- **环境划分**：沙箱环境（`openapi-sit.yonyoucloud.com`）与生产环境（`openapi.yonyoucloud.com`）。

### 2.2 用户角色及核心场景

| 角色 | 典型场景 | 需求特征 |
|------|----------|----------|
| 集成开发者 | 对接 ERP 与第三方系统，编写集成脚本 | 调试方便、请求预览、结构化输出 |
| 运维 / 数据工程师 | 定时任务批量同步数据、导出报表 | 非交互运行、环境变量注入、批量调用 |
| 业务顾问 | 查询业务数据（如查员工、看凭证） | 命令易记、交互式帮助、表格输出 |
| 大模型 Agent | 通过工具调用 BIP 接口完成任务 | 固定 JSON 输出、稳定退出码、无交互 |

### 2.3 痛点总结

1. 文档碎片化，每次调接口都要翻在线文档。
2. 鉴权逻辑需要手动编写，token 管理重复实现。
3. 缺乏统一的命令入口，导致测试和集成效率低。
4. 直接调用原始 API 不适合大模型消费（无结构、无 schema、鉴权复杂）。
5. 环境切换容易出错，生产/沙箱配置混淆。

---

## 3. 产品功能清单

### 3.1 功能概览（共 10 大模块）

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 🔧 **配置管理** | `config init`, `config show`, `config set` | P0 |
| 🔐 **鉴权** | 自动 token 获取/刷新，手动 `login` | P0 |
| 📋 **业务操作** | 300+ API 子命令（按域分组） | P0 |
| 📤 **输出控制** | `--format json/table/csv`, `--raw` | P0 |
| 🔍 **发现与帮助** | 三级帮助、搜索、统计、全量列表 | P0 |
| 🛡️ **调试** | `--dry-run`, `--verbose`, 自动重试 | P1 |
| 🌐 **环境管理** | `env list`, `env switch` | P1 |
| 📦 **批量调用** | `batch` 从文件批量执行，`--template` 模板 | P2 |
| 🧩 **集成友好** | 全环境变量配置、静默模式、退出码规范 | P0 |
| 🤖 **大模型工具支持** | `--help-json` 输出 schema、统一 JSON 输出 | P1 |

### 3.2 命令体系

#### 3.2.1 全局命令

```
ybc config init              # 交互式配置AK/SK、环境
ybc config show              # 显示当前配置（SK脱敏）
ybc config set <key> <val>   # 修改单项配置
ybc login                    # 手动刷新token
ybc search <keyword>         # 搜索API
ybc stats                    # 查看命令/API统计和鉴权状态
ybc list --all               # 列出所有命令（扁平列表）
ybc help                     # 全局帮助
```

#### 3.2.2 业务域命令示例

```
# 人员管理（staff）
ybc staff query --code EMP001
ybc staff enable <id>
ybc staff disable <id>
ybc staff update <id> --data @file.json

# 凭证管理（voucher）
ybc voucher create --data @payload.json
ybc voucher query --date 2026-04-01 --json

# 待办管理（todo）
ybc todo list --status pending
ybc todo done <id>
```

完整命令清单由 OpenAPI 规范自动生成，业务域及操作名决定。

### 3.3 鉴权生命周期

1. **首次配置**：`ybc config init` 存储 AK/SK 于 `~/.ybc/config.json`（权限 600）。
2. **首次调用**：任何业务命令执行前，检查本地 token 缓存（`~/.ybc/token.json`）。若不存在或过期，自动调用 `/token` 获取新 token 并缓存。
3. **自动续期**：令牌有效期前 5 分钟自动续期（连续使用场景）。
4. **安全刷新**：401 错误自动清除旧 token 并重试一次，整个过程对用户透明。
5. **CI 环境**：AK/SK 可通过 `YBC_AK` / `YBC_SK` 环境变量注入，不写本地配置。

### 3.4 输出控制

所有命令均支持：

| 选项 | 行为 | 用途 |
|------|------|------|
| `--format json` | 纯净 JSON，稳定键名 | 管道、脚本、Agent |
| `--format table` (默认) | 人类可读的表格 | 终端直接查看 |
| `--format csv` | CSV 导出 | Excel 打开或数据流 |
| `--raw` | 仅打印服务端原始响应 | 极简管道模式，优先级最高 |
| `--no-color` | 关闭颜色输出 | 日志文件、CI 日志 |

环境变量 `YBC_FORMAT` 可全局覆盖默认格式，`YBC_QUIET=1` 则禁止一切进度、警告等非结果输出。

### 3.5 错误处理与退出码

| 退出码 | 含义 | 适用场景 |
|--------|------|----------|
| 0 | 成功 | |
| 1 | 通用错误（未知） | 命令行解析失败等 |
| 4 | 业务错误（API 返回 code≠0） | 大模型应区分网络与业务错误 |
| 5 | 网络错误 | 连接超时、DNS 失败等 |
| 6 | 鉴权失败（AK/SK 错误或 token 过期无法续期） | 提示用户重新配置 |

---

## 4. 帮助系统与命令发现设计（详设）

帮助系统遵循 **渐进式发现** 原则，确保用户从零知识到精确执行命令的路径最短。

### 4.1 三级帮助结构

| 层级 | 命令 | 展示内容 |
|------|------|----------|
| L0 | `ybc` 或 `ybc help` | 欢迎语、全局选项、业务域分组、命令总数、下一步引导 |
| L1 | `ybc <domain> help` | 该域下所有操作名及一行描述、引导至 L2 |
| L2 | `ybc <domain> <action> --help` | 详细参数、选项、默认值、示例、API 文档链接 |

#### L0 模板

```
用友 BIP 命令行工具 v1.0.0

用法:
  ybc <command> [options]

全局选项:
  --format json|table|csv   输出格式（默认 table）
  --raw                     仅输出服务端原始 JSON
  --dry-run                 预览请求而不发送
  --verbose                 输出详细调试日志
  --no-color                禁用颜色
  --version, -V             查看版本
  --help, -h                查看帮助

可用命令（共 3 个全局命令 + 12 个业务域）:

全局命令:
  config       配置凭证、环境等
  login        手动刷新 access_token
  search       搜索 API 命令

业务域（按字母序）:
  staff        人员管理（4 个命令）
  todo         待办事项（5 个命令）
  voucher      凭证管理（6 个命令）
  ...            ...

执行 "ybc <domain> help" 查看某个业务域下的命令。
执行 "ybc search <关键词>" 快速查找命令。
```

#### L1 示例

```
用法: ybc staff <command> [options]

人员管理命令（4 个）:
  query       查询人员信息
  enable      启用员工
  disable     停用员工
  update      更新员工信息

执行 "ybc staff <command> --help" 查看具体命令的用法。
```

#### L2 示例

```
用法: ybc staff query [options]

查询用友 BIP 人员信息。

选项:
  --code <code>          员工编码（精确匹配）
  --name <name>          姓名（支持模糊匹配）
  --dept-id <id>         部门 ID
  --status <status>      员工状态（在职/离职/试用）
  --page <number>        页码（默认 1）
  --size <number>        每页条数（默认 20，最大 100）
  --format <json|...>    输出格式（可继承全局 --format）
  --dry-run              预览请求
  --verbose              详细日志
  --help, -h             查看帮助

示例:
  ybc staff query --code EMP001
  ybc staff query --dept-id D001 --status 在职 --json
  ybc staff query --name 张 --page 1 --size 50

API 文档: https://open.yonyoucloud.com/doc-center/xxxx
```

### 4.2 命令搜索

`ybc search <关键词>`  
- 搜索命令名、描述、参数名中的关键词（支持中文、英文、部分拼音）。
- 结果列出 `domain action` 及描述，供直接复制。

```
$ ybc search 待办
todo create    创建待办事项
todo list      获取待办列表
todo done      标记待办完成
```

### 4.3 统计与全量列表

`ybc stats` 展示整体状况：

```
全局命令:       3
业务域:         12
业务命令:       68
覆盖 API:       72（4 个接口暂未实现命令）
鉴权状态:       已登录（token 有效至 2026-04-26）
当前环境:       sandbox
```

`ybc list --all` 打印所有命令的扁平列表，每行一个完整命令：

```
ybc config init
ybc config show
...
ybc staff query
ybc staff enable
...
```

方便开发者用 `grep`、`wc -l` 等工具二次处理。

### 4.4 大模型友好帮助

任何命令支持 `--help-json`，输出标准 JSON Schema 描述：

```
ybc staff query --help-json
{
  "name": "ybc_staff_query",
  "description": "查询用友 BIP 人员信息",
  "parameters": {
    "type": "object",
    "properties": {
      "code": {"type": "string", "description": "员工编码（精确匹配）"},
      "name": {"type": "string", "description": "姓名（支持模糊匹配）"},
      "dept-id": {"type": "string", "description": "部门ID"},
      "page": {"type": "integer", "description": "页码（默认 1）"},
      "size": {"type": "integer", "description": "每页条数（默认 20）"}
    }
  }
}
```

该 JSON 可直接用于 OpenAI Functions / Anthropic tool use / LangChain tool 注册。

### 4.5 交互式浏览（可选，P2）

当用户仅执行 `ybc` 无参数，可进入简易菜单导航（方向键选择）。  
环境变量 `YBC_INTERACTIVE=never` 禁用交互模式，保证自动化安全。

---

## 5. 技术实现方案

### 5.1 总体架构

```
[OpenAPI Spec] --> [openapi-generator] --> TypeScript API Client
                                                |
                                          +-----+------+
                                          | Auth Layer |
                                          +------------+
                                                |
                                       [commander.js CLI]
                                                |
                                     [npm package: ybc]
```

### 5.2 技术选型

| 组件 | 选型 | 理由 |
|------|------|------|
| 运行语言 | TypeScript | 类型安全，Node.js 生态 |
| CLI 框架 | commander.js | 成熟稳定，支持子命令、自动 help |
| HTTP 客户端 | axios (生成默认) | 转换拦截器方便注入 token |
| 鉴权签名 | crypto-js 或 node:crypto | HMAC-SHA256（如需要签名） |
| 配置管理 | conf 或本地 JSON | 简单，支持加密（可选 keytar） |
| 输出格式化 | 自动表格库（如 cli-table3） | JSON 原生，CSV 简单转换 |
| 生成器 | @openapitools/openapi-generator-cli | 生成 TypeScript-axios 客户端 |
| 打包/发布 | npm | 支持 `npm install -g` |

### 5.3 关键实现细节

#### 5.3.1 OpenAPI 规范准备

由于用友 BIP 可能未直接提供标准 `openapi.json`，需进行半自动化整理：
- 提取文档中心 API 列表，生成 OpenAPI 3.0 YAML/JSON。
- 定义路径、参数、安全方案（`bearerAuth`）。
- 此文件将是 **单一事实来源**，所有 CLI 命令由此驱动。

#### 5.3.2 鉴权中间件

```typescript
// 在生成的 axios 实例中添加请求拦截器
axiosInstance.interceptors.request.use(async (config) => {
  const token = await getValidToken(); // 自动从缓存取或刷新
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

`getValidToken()` 逻辑：  
1. 读 `~/.ybc/token.json` 中 `access_token` 和 `expires_at`。
2. 若不存在或已过期，调用 `/token` 获取新令牌，存储后返回。
3. 若获取失败，抛出明确异常，CLI 层转化为退出码 6。

#### 5.3.3 命令生成与注册

利用生成的 API 客户端方法名，在 CLI 入口中按 `tag` 自动注册命令：

```typescript
import { Command } from 'commander';
import { StaffApi, TodoApi, VoucherApi } from './api-client';

// 示例：注册 staff 域
const staffCmd = program.command('staff');
staffCmd.command('query')
  .description('查询人员信息')
  .option('--code <code>')
  .action(async (options) => {
    const api = new StaffApi(config);
    const result = await api.queryStaff(options.code);
    output(result, options.format);
  });
```

可编写脚本根据 OpenAPI 规范文件**自动生成**上述注册代码，保证与 API 文档同步。

#### 5.3.4 输出适配器

统一输出函数 `output(data, format, raw)` 根据全局选项动态切换：
- `raw`：直接 `console.log(JSON.stringify(data))`
- `json`：美化 JSON 输出
- `table`：使用 `cli-table3` 绘制表格
- `csv`：转换为 CSV 字符串输出

#### 5.3.5 帮助生成

- 全局 `help` 由 commander 自动生成，自定义 `--help` 回调增加命令总数和分组列表。
- L1、L2 由 commander 在子命令上的 `.helpInformation()` 控制。
- `--help-json` 通过注入自定义选项实现，读取命令元数据生成 schema。

### 5.4 发布与分发

- `package.json` 中设置 `"bin": { "ybc": "./dist/cli.js" }`。
- 执行 `npm publish` 后，用户通过 `npm install -g ybc` 安装。
- 也可用 `npx ybc` 临时运行。
- 后续可通过 `pkg` 打包成独立二进制文件供无 Node 环境使用（可选）。

---

## 6. 非功能性需求

| 类别 | 要求 |
|------|------|
| **性能** | 命令启动 <500ms；首次 API 调用（含 token 获取）<2s |
| **安全** | SK 不得出现在日志、命令行历史中；配置文件权限 600；支持环境变量注入 |
| **可用性** | 无网络时给出明确错误，不打印堆栈；提供 recovery 建议 |
| **兼容性** | Node.js ≥16，全平台（Windows, macOS, Linux） |
| **可维护性** | 新 API 发布：更新 OpenAPI 规范 → 重新生成客户端 → 构建发布，业务逻辑零改动 |
| **可观测性** | `--verbose` 输出请求/响应详情；`--dry-run` 预览请求 |

---

## 7. 实施路线图

| 阶段 | 周期 | 核心交付 | 关键活动 |
|------|------|----------|----------|
| **Phase 1: 基础验证** | 1 周 | 手工编写 10-15 个 API 的 OpenAPI 片段 + 生成可行性验证 | 梳理 BIP 文档，确定生成链路可行 |
| **Phase 2: MVP** | 2 周 | `ybc v0.1.0` 发布至 npm | 配置、登录、3 个核心域（staff/todo/voucher）子命令、帮助体系、--json |
| **Phase 3: 全量命令** | 2 周 | 覆盖 90% 以上 API，环境管理，速率控制 | 完善 OpenAPI 规范，批量生成命令 |
| **Phase 4: 高级特性** | 2 周 | 批量调用、模板、交互浏览、大模型专用优化 | 实现 batch/--template/--help-json，集成测试 |
| **Phase 5: 生态与维护** | 持续 | 用户文档、CI/CD 示例、性能监控 | 发布 v1.0.0，建立反馈渠道 |

---

## 8. 附录：CLI 命令速查表（MVP 范围）

```
ybc config init                   # 初始化凭证
ybc config show                   # 查看当前配置
ybc login                         # 手动刷新token
ybc search <关键词>                # 查找命令
ybc stats                         # 统计信息
ybc list --all                    # 所有命令列表

ybc staff query [--code] [--name] [--dept-id] ...
ybc staff enable <id>
ybc staff disable <id>
ybc staff update <id> --data ...

ybc todo list [--status] [--page]
ybc todo create --title <title> --assignee <user>
ybc todo done <id>
ybc todo delete <id>

ybc voucher query [--date] [--voucher-code]
ybc voucher create --data @file.json
```

---

该文档可作为后续开发迭代的唯一参考依据。所有功能设计与交互细节均已明确，开发团队可直接按模块拆分任务开始实现。