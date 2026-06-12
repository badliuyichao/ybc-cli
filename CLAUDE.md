# CLAUDE.md

## 语言

**所有交互必须使用中文，每次回复时，请称呼我为”超哥”。**

---

## 记忆系统

项目使用 `memory/` 目录持久化用户偏好与项目事实，Claude 每次启动时会加载 `MEMORY.md` 索引。规则：

- **每个文件一条事实**，用 Markdown frontmatter（`name` / `description` / `type`）标注元数据
- `MEMORY.md` 是索引——新增记忆文件后必须在其中加一条 `- [标题](文件名.md)` 的指针
- `type: feedback` 为用户反馈记录，`type: project` 为项目事实，`type: user` 为用户信息
- **保存前先检查是否已有同名/同主题文件**——更新已有文件，不建重复
- 关联记忆用 `[[文件名]]` 互相链接
- 不要保存代码仓库本身就能反映的信息（代码结构、git 历史、已存在于 `docs/` 的事实）

当前记忆：
- `feedback_language.md` — 中文回复 + 称呼”超哥”

---

## 项目

**ybc**（用友 BIP CLI），v0.1.6，Phase 1 完成。通过 CLI 简化用友 BIP OpenAPI 300+ 端点的访问。当前已实现 `staff` + `todo` 两个域。待办见 `ROADMAP.md`。

---

## 核心范式：OpenAPI 驱动

**命令不是手写的，是从 OpenAPI 规范生成的：**

```
openapi/openapi.yaml                     ← 唯一事实来源
  ↓ npm run generate:api
src/api/generated/                       ← 不可手改
  ↓ npm run generate:commands
src/cli/commands/generated/              ← 不可手改
  ↓ src/cli/index.ts 注册
ybc <domain> <action>
```

**规则**：
- `src/api/generated/` 和 `src/cli/commands/generated/` **绝对不能手改**
- 改 API → 改 `openapi/openapi.yaml` → 重新生成
- 业务逻辑覆盖写到 `src/cli/commands/<domain>/`（非 `generated/`）
- 配置读写**必须经过** `src/services/config/config-service.ts`，禁止直接读写 `~/.ybc/*.json`

---

## 关键文件

```
src/bin/ybc.ts                           入口
src/cli/index.ts                         bootstrap() 命令注册
src/cli/program.ts                       commander 全局选项
src/services/auth/token-manager.ts       Token 三级缓存 + 自动刷新（核心）
src/services/auth/signature-service.ts   HmacSHA256 签名
src/services/auth/datacenter-service.ts  数据中心域名查询 + 缓存
src/services/config/config-service.ts    配置管理（AES-256-GCM 加密）
src/services/error/                      统一错误处理 + 退出码
openapi/openapi.yaml                     OpenAPI 规范
```

---

## 安全底线

- **绝不记录** `appSecret`、`access_token`、`signature` 到任何日志或错误消息
- 配置文件 `~/.ybc/config.json` 和 token 缓存 `~/.ybc/token.json` 权限 600
- `appSecret` 存储用 AES-256-GCM 加密
- 优先使用新字段 `appKey/appSecret`；旧字段 `ak/sk` 仅向后兼容

---

## 退出码（对外契约，不可变更）

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 通用错误 |
| 4 | 业务错误 |
| 5 | 网络错误 |
| 6 | 鉴权错误 |

---

## 常用命令

```bash
npm run generate:api       # OpenAPI → TS 客户端
npm run generate:commands  # TS 客户端 → CLI 命令
npm run build              # 编译
npm test                   # 全部测试
npm run test:unit          # 单元测试
npm run test:coverage      # 覆盖率（目标 ≥80%）
npm run lint               # ESLint
npm run format             # Prettier
```

---

## 文档

`docs/` 是唯一文档入口，以 `docs/README.md` 为索引。

| 查什么 | 去哪 |
|--------|------|
| 架构 + 鉴权 | `docs/design/architecture.md` |
| 需求与验收 | `docs/design/requirements.md` |
| 测试策略 | `docs/design/testing.md` |
| 安全方案 | `docs/design/security.md` |
| 用户指南 | `docs/guides/usage.md` |
| 待办 | `ROADMAP.md` |
| 版本历史 | `CHANGELOG.md` |
| 用友官方 API | `docs/design/ref/` |
