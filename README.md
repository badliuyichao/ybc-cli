# ybc - 用友 BIP 命令行工具

[![npm version](https://badge.fury.io/js/@liuychk/ybc.svg)](https://badge.fury.io/js/@liuychk/ybc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

用于与用友 BIP OpenAPI 平台交互的 CLI 工具。

## 特性

- 🚀 **自动 Token 管理** - 自动处理 token 的获取、缓存和刷新
- 📋 **OpenAPI 驱动** - 命令从 OpenAPI 规范自动生成，支持 300+ API 端点
- 🎨 **多格式输出** - 支持表格、JSON、CSV、Raw 四种输出格式
- 🔐 **安全存储** - SK 使用 AES-256-GCM 加密存储
- 🔧 **灵活配置** - 支持多环境、多租户配置

## 安装

```bash
npm install -g @liuychk/ybc
```

## 快速开始

### 1. 初始化配置

```bash
# 交互式初始化配置（推荐）
ybc config init

# 或手动设置配置项
ybc config set tenantId <your-tenant-id>
ybc config set appKey <your-app-key>
ybc config set appSecret <your-app-secret>
ybc config set env sandbox
```

### 2. 基本使用

```bash
# 查看帮助
ybc --help

# 查看配置
ybc config list

# 查询员工信息
ybc staff query --name "张三"

# 输出为 JSON 格式
ybc staff query --name "张三" --format json

# 查看详细信息
ybc staff query --name "张三" --verbose
```

## 配置

### 环境变量

支持通过环境变量配置（适用于 CI/CD 场景）：

```bash
# 新环境变量（推荐）
export YBC_TENANT_ID=<your-tenant-id>
export YBC_APP_KEY=<your-app-key>
export YBC_APP_SECRET=<your-app-secret>

# 旧环境变量（向后兼容）
export YBC_AK=<your-access-key>
export YBC_SK=<your-secret-key>

# 其他配置
export YBC_FORMAT=json  # 可选：json, table, csv, raw
export YBC_ENV=sandbox  # 可选：sandbox, production
```

### 配置文件

配置文件位置：`~/.ybc/config.json`

```bash
# 查看配置文件路径
ybc config path

# 编辑配置文件
ybc config edit
```

## 输出格式

支持四种输出格式：

- `table` (默认) - 人类友好的表格格式
- `json` - 机器友好的 JSON 格式
- `csv` - CSV 格式，适合导入 Excel
- `raw` - 原始 API 响应

```bash
# 使用 JSON 格式
ybc staff query --format json

# 使用 CSV 格式
ybc staff query --format csv > result.csv
```

## 命令结构

```
ybc
├── config      # 配置管理
│   ├── set     # 设置配置项
│   ├── get     # 获取配置项
│   ├── list    # 列出所有配置
│   └── delete  # 删除配置项
├── staff       # 员工管理域
│   ├── query   # 查询员工
│   ├── enable  # 启用员工
│   └── disable # 禁用员工
└── ...         # 其他业务域（从 OpenAPI 自动生成）
```

## 安全性

### Token 存储

- Token 缓存于 `~/.ybc/token.json`（文件权限 600）
- 自动在过期前 5 分钟刷新
- 401 错误自动重试

### App Secret 加密

- App Secret 使用 AES-256-GCM 加密存储
- 绝不在日志或错误信息中暴露
- 文件权限严格控制（600）

## 开发

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/your-org/ybc.git
cd ybc

# 安装依赖
npm install

# 生成 API 客户端
npm run generate:api

# 生成 CLI 命令
npm run generate:commands

# 开发模式运行
npm run dev

# 运行测试
npm test

# 构建
npm run build
```

### 从源码安装

```bash
# 克隆并构建
git clone https://github.com/your-org/ybc.git
cd ybc
npm install
npm run build

# 全局链接（用于本地测试）
npm link
```

## 帮助系统

ybc 提供三级帮助系统：

```bash
# 顶级帮助 - 显示所有命令域
ybc --help

# 域级帮助 - 显示域内所有命令
ybc staff --help

# 命令级帮助 - 显示命令详细用法
ybc staff query --help
```

## 错误退出码

- `0` - 成功
- `1` - 通用错误（CLI 解析错误）
- `4` - 业务错误（API 返回错误）
- `5` - 网络错误
- `6` - 鉴权错误（AK/SK 无效）

## 文档

- [本地使用指南](docs/本地使用指南.md)
- [快速使用指南](docs/快速使用指南（修复版）.md)
- [架构设计文档](docs/design/架构设计文档.md)
- [API 文档](https://github.com/your-org/ybc/docs)

## 故障排查

### Token 问题

```bash
# 清除缓存的 token
rm ~/.ybc/token.json

# 查看当前配置
ybc config show

# 重新配置凭证
ybc config init
```

### 网络问题

```bash
# 使用 verbose 模式查看详细请求
ybc staff query --verbose
```

## 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本历史。

## 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 许可证

[MIT](LICENSE)

## 支持

- 📧 Email: support@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/ybc/issues)
- 📖 文档: [GitHub Wiki](https://github.com/your-org/ybc/wiki)

## 致谢

本项目基于用友 BIP OpenAPI 平台构建。