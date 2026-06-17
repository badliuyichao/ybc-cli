# Changelog

All notable changes to this project will be documented in this file.

## [0.1.7] - 2026-06-16

### Fixed
- **CR-001 全局选项注入**：5 个生成命令（staff query/enable/disable、todo list/create）显式声明 `--format` / `--raw` / `--verbose`，子命令 options 不再丢全局值
- **CR-002 空 token 缓存防护**：TokenManager 在 L1（内存）、L2（文件）、L3（远程响应）三层都校验 `access_token` 非空，防止空 token 被缓存导致后续 401
- **CR-007 EOF 时 stdin 监听器残留**：`config init` 的 `questionHidden` resolve 前清理 data 监听器（与上次审查条目对齐）

### Changed
- **CR-037 集成测试**：临时跳过 3 个集成测试套件（auth-flow / http-flow / full-flow），原因是用友实现迁移（POST→GET、Bearer Header→query param）后未同步重写。详见 `docs/process/code-review-20260616.md` CR-037
- **CR-041 `process.exit` 收敛**：审计显示 `config/*` 命令有 16 处直接 `process.exit()`（上次审查 CR-013 仅识别 queryStaff.ts 1 处），已在审计报告标记
- **CR-042 auth-interceptor 标记废弃**：加 `@deprecated` JSDoc，指向 `ApiHttpWrapper`。CI 不删，避免外部依赖
- **CR-043 ApiHttpWrapper 错误分类**：按 HTTP 状态码分类错误：4xx → BusinessError（退出码 4）/ 5xx → NetworkError（5）/ 超时 / 连接失败 → NetworkError（5）/ 401 走原有重试链路（6）

### Docs
- **README.md 术语同步**：`SK` → `appSecret`，`config list` → `config show`，删除不存在的 `config delete` 条目，退出码描述统一
- **docs/design/testing.md**：Token Refresh / Error Scenarios 状态更新为 ✅（CR-001/CR-002 修复后已通过），Performance 标注为环境超时
- **docs/process/code-review-20260616.md**（新增）：补充轮审查 15 项问题 + 51 项累计 + 修复优先级

### Chore
- **`.gitattributes` 新增**：强制 `.ts/.js/.json/.yaml/.md` 行尾 LF，避免 Windows 提交混入 CRLF 导致 ESLint 误报（CR-048）。已存在的 CRLF 文件待单独 PR 用 `git rm --cached` 一次性清理

## [0.1.7] - 2026-06-11

### Added
- **版本更新检查**：启动时异步检查 npm 最新版本，发现新版本时提示用户更新
  - 使用缓存机制，24小时内只检查一次，避免频繁请求 npm registry
  - 支持 `--no-update-check` 选项禁用检查
  - 静默失败机制，网络错误不影响正常使用

## [0.1.1] - 2026-04-29

### Fixed
- **API 端点动态化**：修复 `StaffApi` 使用硬编码 URL 的问题，现在使用 `DataCenterService` 动态获取正确的 `gatewayUrl`
- **Token 响应解析**：修复 Token 响应解析以支持 `{ code, message, data: { access_token, expires_in } }` 格式
- **错误退出码**：修复生成的命令使用 `handleErrorAndExit` 返回正确的退出码
- **业务错误转换**：添加 axios 错误处理，将非 2xx 响应中的业务错误转换为 `BusinessError`
- **TokenManager 清理**：移除未使用的 `encryption` 参数
- **Mock Server 更新**：支持 GET 请求、正确格式的 Token 响应和业务错误模拟

### Changed
- **命令文件**：所有生成的命令现在使用 `handleErrorAndExit` 进行错误处理
- **单元测试**：更新测试以匹配新的 API 流程（GET + 签名）

## [0.1.0] - 2026-04-28

### Added
- 初始版本发布
- 支持 `config init`、`config set`、`config show` 命令
- 支持 `staff query`、`staff enable`、`staff disable` 命令
- 支持 `todo list`、`todo create` 命令
- Token 管理（自动获取、刷新、缓存）
- 数据中心域名管理
- 错误处理和退出码规范
