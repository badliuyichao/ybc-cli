# npm 发布准备清单

---

## 📋 发布前检查清单

### ✅ 已完成的准备工作

| 检查项 | 状态 | 说明 |
|--------|------|------|
| **package.json 配置** | ✅ 完成 | name, version, bin, files 等配置正确 |
| **构建产物** | ✅ 完成 | dist/bin/ybc.js 已生成，211个文件 |
| **README.md** | ✅ 完成 | 已更新为最新的配置字段名 |
| **LICENSE** | ✅ 完成 | MIT License 文件存在 |
| **.npmignore** | ✅ 完成 | 正确排除源码和测试文件 |
| **打包测试** | ✅ 完成 | npm pack --dry-run 成功，96.9 KB |

---

### ⚠️ 需要确认的配置

#### 1. package.json 中的 repository URL

**当前状态**：
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/ybc"
  },
  "bugs": {
    "url": "https://github.com/your-org/ybc/issues"
  },
  "homepage": "https://github.com/your-org/ybc"
}
```

**问题**：这是占位符URL，需要更新为真实的仓库地址。

**建议操作**：
- 如果项目有真实的GitHub仓库，请更新为真实URL
- 如果暂时没有仓库，可以暂时保留，发布后再更新

---

#### 2. package.json 中的 author 信息

**当前状态**：
```json
{
  "author": "开发团队"
}
```

**建议**：更新为更具体的信息，例如：
```json
{
  "author": {
    "name": "你的名字或组织名",
    "email": "your-email@example.com"
  }
}
```

---

#### 3. package.json 中的 version

**当前状态**：`"version": "0.1.0"`

**说明**：这是首次发布的合适版本号。

**版本号规范**：
- `0.1.0` - 首次发布（当前）
- `0.1.1` - 小修复（patch）
- `0.2.0` - 新功能（minor）
- `1.0.0` - 稳定版本（major）

---

## 📦 打包详情

### 包内容统计

```
Tarball Details:
- 包名称：ybc
- 版本：0.1.0
- 文件名：ybc-0.1.0.tgz
- 包大小：96.9 KB
- 解压大小：452.6 KB
- 文件数：211
```

### 包含的文件

**主要文件**：
- ✅ LICENSE (1.1 KB)
- ✅ README.md (4.9 KB)
- ✅ package.json (2.6 KB)
- ✅ dist/**/* (211个编译后的文件)

**排除的文件**（通过 .npmignore）：
- ❌ src/ (源码)
- ❌ tests/ (测试)
- ❌ docs/ (文档)
- ❌ node_modules/ (依赖)
- ❌ tsconfig.json, jest.config.js 等配置文件
- ❌ coverage/ (覆盖率报告)

---

## 🚀 发布流程

### 步骤 1：确认 npm 登录状态

```bash
# 检查是否已登录 npm
npm whoami

# 如果未登录，执行登录
npm login
```

**说明**：
- 需要 npm 账户（如果没有，先去 https://www.npmjs.com/ 注册）
- 登录时会要求输入用户名、密码、邮箱

---

### 步骤 2：最终构建和验证

```bash
# 1. 清理旧的构建产物
npm run clean

# 2. 重新构建
npm run build

# 3. 验证构建成功
node dist/bin/ybc.js --help

# 4. 运行测试（可选，确保功能正常）
npm test

# 5. 模拟打包（查看最终包内容）
npm pack --dry-run
```

---

### 步骤 3：更新 package.json（可选）

**如果需要更新 repository URL**：

```bash
# 方法 1：手动编辑 package.json
# 更新 repository, bugs, homepage 字段

# 方法 2：使用 npm 命令更新
npm config set repository.url https://github.com/your-real-org/ybc
```

**如果需要更新 author 信息**：
```bash
# 手动编辑 package.json 的 author 字段
```

---

### 步骤 4：发布到 npm

**首次发布（推荐方式）**：

```bash
# 使用 npm publish 发布
npm publish

# 或者使用 npm publish --access public（如果是 scoped package）
npm publish --access public
```

**说明**：
- 发布是**不可逆**操作，一旦发布就不能删除（只能 deprecated）
- 发布前请确保所有内容正确
- 发布后会生成 `ybc@0.1.0` 包，其他人可以安装使用

---

### 步骤 5：验证发布成功

```bash
# 1. 查看发布的包信息
npm info ybc

# 2. 在新环境安装测试
npm install -g ybc

# 3. 运行测试
ybc --help
ybc config init

# 4. 查看版本
ybc --version
```

---

## 🔄 后续版本发布流程

### 发布 patch 版本（修复bug）

```bash
# 1. 修复bug，提交代码

# 2. 更新版本号（自动创建 git tag）
npm version patch
# 版本从 0.1.0 -> 0.1.1

# 3. 发布
npm publish
```

---

### 发布 minor 版本（新功能）

```bash
# 1. 添加新功能，提交代码

# 2. 更新版本号
npm version minor
# 版本从 0.1.1 -> 0.2.0

# 3. 发布
npm publish
```

---

### 发布 major 版本（重大变更）

```bash
# 1. 完成重大变更，提交代码

# 2. 更新版本号
npm version major
# 版本从 0.2.0 -> 1.0.0

# 3. 发布
npm publish
```

---

## 📝 发布注意事项

### ⚠️ 重要警告

**发布前请确认**：
- ✅ **构建成功** - 确保 `dist/bin/ybc.js` 存在且可运行
- ✅ **README.md 准确** - 使用最新的配置字段名（tenantId/appKey/appSecret）
- ✅ **package.json 正确** - 所有配置项正确无误
- ✅ **测试通过** - 核心功能测试通过（至少92.7%）
- ✅ **版本号合适** - 首次发布建议使用 0.1.0

**发布后无法修改**：
- ❌ 无法删除已发布的包（只能 deprecated）
- ❌ 无法修改已发布版本的文件
- ✅ 可以发布新版本覆盖

---

### 🔒 安全检查

**确保不暴露敏感信息**：
- ❌ 绝不包含 `.env` 文件
- ❌ 绝不包含真实的 AK/SK 或 token
- ❌ 绝不包含测试用的真实凭证
- ✅ 确保 .npmignore 正确排除敏感文件

---

## 🎯 当前状态总结

### ✅ 准备完成项

- ✅ package.json 配置完善（name, version, bin, files）
- ✅ README.md 已更新最新配置字段
- ✅ LICENSE 文件存在
- ✅ .npmignore 配置正确
- ✅ 构建产物完整（211个文件，96.9 KB）
- ✅ 打包测试成功

---

### ⏸️ 需要确认项

- ⏸️ package.json 的 repository URL（当前是占位符）
- ⏸️ package.json 的 author 信息（可以更具体）
- ⏸️ npm 登录状态（发布前需要登录）

---

### 🚀 可以立即执行

**如果所有配置都满意**，可以立即发布：

```bash
npm login         # 登录 npm
npm publish       # 发布到 npm
npm info ybc      # 验证发布成功
```

---

## 💡 发布后建议

### 1. 创建 GitHub Release

```bash
# 在 GitHub 创建 Release v0.1.0
# 添加发布说明和 CHANGELOG
```

---

### 2. 更新文档

```bash
# 在 GitHub Wiki 或 README.md 中添加安装说明：
npm install -g ybc
```

---

### 3. 推广使用

- 在项目文档中添加 npm 安装链接
- 在社区分享项目
- 收集用户反馈

---

## 📊 预期发布结果

### 发布后的效果

**用户可以**：
- ✅ 通过 `npm install -g ybc` 全局安装
- ✅ 直接使用 `ybc` 命令
- ✅ 查看 npm 页面：https://www.npmjs.com/package/ybc
- ✅ 看到 README、版本信息、下载统计

---

### npm 包页面内容

**npm 会显示**：
- ✅ README.md（最新的配置说明）
- ✅ LICENSE（MIT License）
- ✅ 版本：0.1.0
- ✅ 作者信息
- ✅ 仓库链接（如果更新）
- ✅ 依赖列表
- ✅ 下载统计

---

## 🎉 总结

### 当前状态

✅ **项目已准备好发布**：
- ✅ 所有准备工作已完成
- ✅ 构建产物完整
- ✅ 文档已更新
- ✅ 打包测试成功

---

### 下一步行动

**立即可以执行**：
1. 确认 package.json 的 repository URL（可选）
2. 登录 npm：`npm login`
3. 发布：`npm publish`
4. 验证：`npm info ybc`

---

### 预估发布时间

- **登录 npm**：1分钟
- **发布命令**：30秒
- **npm处理**：1-2分钟
- **总计**：约3分钟

---

**项目已准备就绪，可以立即发布到 npm！**

---

**相关文档**：
- [README.md](../README.md) - 用户使用指南
- [package.json](../package.json) - npm 配置
- [使用和测试指南（最新）.md](../使用和测试指南（最新）.md) - 详细使用指南