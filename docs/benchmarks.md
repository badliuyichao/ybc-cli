# 性能基准与测试

> 性能数据基线（2026-06-17 实测）

## 🎯 测试分层

| 测试 | 触发方式 | 工具 | 测什么 | 阈值 |
|------|---------|------|--------|------|
| **启动性能** | CI 自动（`tests/unit/cli/startup.test.ts`）| `dist/bin/ybc.js` 启动耗时 | CLI 启动开销 | < 1s |
| **API 性能** | 手动（`benchmarks/api-perf.ts`）| 直接 HTTP 调用 | 用友 API 调用开销 | 业务 p50 < 500ms |

## 📊 实测基线（2026-06-17 真实凭证）

### 启动性能（CI 自动跑）

| 命令 | 平均耗时 | 阈值 | 状态 |
|------|---------|------|------|
| `node dist/bin/ybc.js --help` | **389ms** | 1000ms | ✅ |
| `node dist/bin/ybc.js --version` | **391ms** | 1000ms | ✅ |

### API 性能（手动跑 20 次）

```
模式:   REAL (调用真实 API)
Tenant: z1kqq5he
迭代:   20 / 20 ✓
```

| 阶段 | min | p50 | p95 | p99 | mean | max |
|------|-----|-----|-----|-----|------|-----|
| 数据中心 | 0 | 0 | 185 | 185 | 9 | 185 |
| Token | 0 | 0 | 91 | 91 | 5 | 91 |
| 业务 | 103 | **135** | **236** | 236 | 151 | 236 |
| **总** | 103 | 135 | 505 | 505 | 165 | 505 |

**Token 缓存收益**：

```
首次调用:  505ms  (含数据中心 + Token + 业务)
后续平均:  147ms  (Token 缓存命中，仅业务)
节省:      358ms  (71.0%)
```

## 🎯 性能目标

| 指标 | 目标 | 实测 | 状态 |
|------|------|------|------|
| 编译版启动 | < 1s | 390ms | ✅ |
| 业务 API p50 | < 500ms | 135ms | ✅ |
| 业务 API p95 | < 1s | 236ms | ✅ |
| Token 缓存节省 | > 50% | 71% | ✅ |

## 🔍 历史问题

### ❌ 之前用 `npx ts-node` 测启动（已废弃）

```bash
# 错误的性能测试方式
npx ts-node src/bin/ybc.ts --help    # 实测 ~40 秒！
```

- ts-node 启动开销 40 秒
- 掩盖了真实 API 性能（135ms）
- ts-node 启动是固定成本，跟 API 性能无关
- CI 因 ts-node 超时 10s 阈值而误报失败

### ✅ 现在的正确方式

| 测什么 | 用什么 |
|--------|--------|
| 启动性能 | `node dist/bin/ybc.js`（编译版）+ unit test |
| API 性能 | 纯 HTTP + benchmark 脚本（手动） |

## 🚀 怎么跑

### 启动性能（CI 自动）

```bash
npm run build                       # 先生成 dist
npm test -- tests/unit/cli/startup.test.ts
```

### API 性能（手动）

```bash
# MOCK 模式（无需凭证）
npx ts-node benchmarks/api-perf.ts

# 真实 API 模式
export YBC_TENANT_ID=your-tenant
export YBC_APP_KEY=your-app-key
export YBC_APP_SECRET=your-app-secret
npx ts-node benchmarks/api-perf.ts --iterations=20
```

## 📝 跟踪

- **方案 C 来源**：见 `docs/process/code-review-20260616.md` 性能基线讨论
- **历史 performance.test.ts**：保留为 `tests/e2e/scenarios/performance.test.ts.skip`（不跑）
- **ROADMAP**：待办-004（ApiClientService 注入）的 358ms 节省基线来自本文档