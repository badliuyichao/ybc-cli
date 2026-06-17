# 性能基准测试

`api-perf.ts` — 不依赖项目代码的纯 HTTP 性能基准工具，用于：
1. 客观测量真实用友 API 性能
2. 为 ApiClientService 注入重构（待办-004）的 200-500ms 收益提供基线
3. CI 性能回归检测

## 使用方法

### 1. MOCK 模式（默认，无需凭证）

```bash
npx ts-node benchmarks/api-perf.ts
```

输出各阶段 mock 延迟（数据中心 200ms / Token 150ms / 业务 300ms），用于本地调试。

### 2. 真实 API 模式

```bash
export YBC_TENANT_ID=your-tenant
export YBC_APP_KEY=your-app-key
export YBC_APP_SECRET=your-app-secret
export YBC_STAFF_CODE=EMP001
npx ts-node benchmarks/api-perf.ts --iterations=20
```

### 3. 自定义参数

```bash
# 自定义迭代次数（注意：必须用 = 不能用空格）
npx ts-node benchmarks/api-perf.ts --iterations=50

# 用 id 而非 code 查询
YBC_STAFF_ID=1001 npx ts-node benchmarks/api-perf.ts
```

## 输出说明

```
阶段               次数      min      p50      p95      p99     mean      max
数据中心             10     0ms     0ms   213ms   213ms    21ms   213ms
Token                10     0ms     0ms   151ms   151ms    15ms   151ms
业务                 10   306ms   310ms   312ms   312ms   309ms   312ms
总                  10   306ms   310ms   674ms   674ms   345ms   674ms
```

- **min/p50/p95/p99/mean/max**：各阶段耗时的最小值、中位数、95/99 百分位、平均值、最大值
- **Token缓存分析**：首次 vs 后续的平均耗时对比
- **每次迭代明细**：每轮具体各阶段耗时

## 业务含义

- **数据中心查询**（200-500ms）：获取租户所在数据中心的 `tokenUrl` / `gatewayUrl`
- **Token 获取**（150-300ms）：HmacSHA256 签名 + 调用 OAuth 接口
- **业务调用**（200-500ms）：实际业务 API

**单进程多命令场景收益**（如未来 `ybc batch` / `ybc shell`）：
- 数据中心 + Token 阶段合计 **350-800ms** 可节省
- 这就是 ApiClientService 注入重构（待办-004）的实际收益

## 已知限制

- MOCK 模式用 `setTimeout` 模拟延迟，不反映真实网络抖动
- 真实模式依赖外网 `api.yonyoucloud.com`，CI 环境需保证可访问
- 阈值仅用于单次调用的延迟分布，不测量吞吐量（QPS）

## 跟踪

- ROADMAP 待办-004（收益基线）
- 项目性能回归检测