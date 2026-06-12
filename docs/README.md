# ybc CLI 文档索引

> **本目录是 ybc CLI 的全部官方文档入口。** 一份索引，找任何东西都在这里。

---

## 📖 目录结构

```
docs/
├── README.md                # 本文档（唯一权威索引）
├── guides/                  # 面向用户
│   └── usage.md             # 安装、配置、命令、输出、调试、故障排查
├── design/                  # 面向开发
│   ├── requirements.md      # 需求与产品验收
│   ├── architecture.md      # 系统架构（4 层 + 命令流程 + ADR）
│   ├── testing.md           # 测试策略
│   ├── security.md          # 安全方案
│   └── ref/                 # 用友 BIP 官方 API 规范 + 鉴权设计
│       ├── auth-spec.md     # 鉴权规范（签名算法、Token 流程、ADR）
│       ├── 获取access_token.md
│       ├── 获取租户所在数据中心域名.md
│       └── 员工详情查询API.md
└── archive/                 # 历史快照（不再维护）
    └── phase1/              # Phase 1 计划 / 验收 / 最终报告
```

---

## 🚀 我想做什么？

| 我想… | 看哪份 |
|------|--------|
| **安装并跑起来** | [`guides/usage.md`](guides/usage.md) |
| **理解项目架构** | [`design/architecture.md`](design/architecture.md) |
| **了解鉴权机制** | [`design/ref/auth-spec.md`](design/ref/auth-spec.md) |
| **看待办与下一步** | 项目根目录 [`ROADMAP.md`](../ROADMAP.md) |
| **看版本历史** | 项目根目录 [`CHANGELOG.md`](../CHANGELOG.md) |
| **看用友官方 API 原文** | [`design/ref/`](design/ref/) |
| **排查问题** | [`guides/usage.md`](guides/usage.md) → 「故障排查」一节 |
| **查看 Phase 1 历史** | [`archive/phase1/`](archive/phase1/) |

---

## 📝 文档维护约定

- **design/**：唯一权威的设计文档。设计变更改这里，不要留"旧版本"在旁边
- **guides/**：用户视角的使用与故障排查
- **archive/phase1/**：Phase 1 的历史快照，不会再更新。之后不再新增 archive 内容
- **临时报告不建文档**：重要事件写进 `CHANGELOG.md`；如需详细记录，写完审阅后删除
- **新增文档**：写到对应目录，文件名用小写英文，中文写在内容里

---

## 🗑️ 旧文档去哪了？

Git 历史完整保留了所有版本。如需查找已删除的旧文档：
```bash
git log --all --full-history -- docs/archive/reports/
git log --all --full-history -- docs/archive/legacy-designs/
```
