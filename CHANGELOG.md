# Changelog

All notable changes to this project will be documented in this file.

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
