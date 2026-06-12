# ybc CLI 文档索引

> **本目录是 ybc CLI 的全部官方文档入口。** 包含面向用户的使用指南、面向开发的设计文档，以及历史归档。

---

## 📖 目录结构

```
docs/
├── README.md                # 本文档（唯一权威索引）
├── guides/                  # 面向用户：使用与故障排查
│   └── usage.md             # 安装、配置、命令、输出、调试、故障排查（一份覆盖）
├── design/                  # 面向开发：设计与决策
│   ├── requirements.md      # 需求与产品验收（含用户故事、功能优先级）
│   ├── architecture.md      # 系统架构（4 层 + 命令流程 + ADR 速查）
│   ├── auth-spec.md         # 鉴权规范（API+签名+Token 改造决策）
│   ├── testing.md           # 测试策略
│   ├── security.md          # 安全方案
│   └── ref/                 # 用友官方 API 规范原文（不修改，备查）
└── archive/                 # 历史归档（不再维护，仅备查）
    ├── phase1/              # Phase 1 计划/验收/最终报告
    ├── reports/             # 各类一次性任务报告
    └── legacy-designs/      # 旧版超长设计文档（已被精简版替代）
```

---

## 🚀 我想做什么？

| 我想… | 看哪份 |
|------|--------|
| **安装并跑起来** | [`guides/usage.md`](guides/usage.md) → 「快速开始」一节 |
| **理解项目架构** | [`design/architecture.md`](design/architecture.md) |
| **了解鉴权机制（签名、Token、数据中心）** | [`design/auth-spec.md`](design/auth-spec.md) |
| **看待办与下一步** | 项目根目录 [`ROADMAP.md`](../ROADMAP.md) |
| **看版本历史** | 项目根目录 [`CHANGELOG.md`](../CHANGELOG.md) |
| **看用友官方 API 原文** | [`design/ref/`](design/ref/) |
| **排查具体问题** | [`guides/usage.md`](guides/usage.md) → 「故障排查」一节 |
| **查看 Phase 1 的历史** | [`archive/phase1/`](archive/phase1/) |
| **查看旧版超长设计文档** | [`archive/legacy-designs/`](archive/legacy-designs/) |

---

## 📝 文档维护约定

- **活文档**（持续维护）：`guides/`、`design/`、`README.md`、根目录 `ROADMAP.md` / `CHANGELOG.md`
- **死文档**（仅备查）：`archive/`——历史归档，新内容不再写进去
- **API 规范**：`design/ref/` 是用友官方原文备份，不修改；项目自己的设计写在 `design/auth-spec.md`
- **新增设计文档**：写到 `design/`，文件名用小写英文（`my-design.md`），中文写在内容里
- **新增使用文档**：写到 `guides/`，同样用小写英文文件名
- **一次性事件报告**：不再新建——重要事件请直接写进 `CHANGELOG.md`；如确实需要详细记录，写到 `archive/reports/`，不要污染主流目录
