# 下一步行动计划

---

## 📋 当前项目状态

### ✅ 已完成（Phase 1）

| 完成项 | 状态 | 说明 |
|--------|------|------|
| **核心代码修改** | ✅ 完成 | TokenManager、SignatureService、DataCenterService |
| **类型定义更新** | ✅ 完成 | 支持 tenantId, appKey, appSecret, dataCenter |
| **新功能测试** | ✅ 完成 | 52个新测试全部通过 |
| **向后兼容** | ✅ 完成 | 新旧字段名都支持 |
| **文档体系重组** | ✅ 完成 | design/process分类完成 |
| **使用指南创建** | ✅ 完成 | 详细的使用和测试指南 |
| **构建验证** | ✅ 完成 | TypeScript编译成功 |

---

### ⏸️ 待完成（Phase 2）

| 待完成项 | 优先级 | 预估工作量 |
|---------|--------|-----------|
| **CLI命令适配** | 🔴 高 | 1-2小时 |
| **E2E测试修复** | 🟡 中 | 30分钟-1小时 |
| **真实API测试** | 🟢 低 | 需凭证 |

---

## 🎯 Phase 2 工作清单

### 优先级排序

**优先级 1（立即执行）**：
- ✅ **CLI命令适配（已完成）**（`config init/show/set`）
  - 影响：用户无法通过CLI配置新字段
  - 当前状态：✅ **已完成**（2026-04-28，Agent并行执行）
  - 完成报告：`docs/process/CLI命令适配完成报告.md`

**优先级 2（建议执行）**：
- ✅ **E2E测试修复（大部分完成）**（2026-04-28，Agent并行执行）
  - 影响：34个旧测试失败
  - 当前状态：✅ **参数格式已修复**，增加29个测试通过（从412→441）
  - 通过率：92.7%（从92.0%提升）
  - 完成报告：`docs/process/E2E测试修复完成报告.md`
  - 剩余：35个测试失败（主要是退出码验证和集成测试逻辑）

**优先级 3（可选执行）**：
- ⏸️ 真实API测试
  - 影响：验证真实环境
  - 前提：需要真实凭证

---

## 📝 Phase 2 详细任务

### 任务 1：CLI命令适配（🔴 必须完成）

**目标**：更新 CLI 命令的交互提示，支持新的字段名

**需要修改的文件**：

| 文件 | 修改内容 | 预估时间 |
|------|----------|---------|
| `src/cli/commands/config/init.ts` | 添加 tenantId、appKey、appSecret 提示 | 30分钟 |
| `src/cli/commands/config/show.ts` | 显示新字段 | 15分钟 |
| `src/cli/commands/config/set.ts` | 支持新字段设置 | 15分钟 |
| `src/infrastructure/env/env-service.ts` | 添加新环境变量常量 | 10分钟 |

**总计**：约 1-1.5 小时

---

#### 子任务 1.1：修改 config init 命令

**文件**：`src/cli/commands/config/init.ts`

**当前问题**：
- ❌ 提示输入 `ak/sk` 而非 `appKey/appSecret`
- ❌ 缺少 `tenantId` 提示

**修改内容**：
```typescript
// 添加 tenantId 提示（必需，第一个提示）
prompts.push({
  type: 'input',
  name: 'tenantId',
  message: '请输入租户ID (Tenant ID):',
  validate: (input) => input.trim().length > 0 || '租户ID不能为空',
});

// 修改 ak 提示为 appKey
prompts.push({
  type: 'input',
  name: 'appKey',
  message: '请输入 App Key:',
  validate: (input) => input.length >= 16 || 'App Key长度至少16字符',
});

// 修改 sk 提示为 appSecret
prompts.push({
  type: 'password',
  name: 'appSecret',
  message: '请输入 App Secret:',
  validate: (input) => input.length >= 16 || 'App Secret长度至少16字符',
});
```

---

#### 子任务 1.2：修改 config show 命令

**文件**：`src/cli/commands/config/show.ts`

**修改内容**：
```typescript
// 显示新字段
console.log('当前配置:');
console.log(`  租户ID: ${config.tenantId || '未设置'}`);
console.log(`  App Key: ${config.appKey || config.ak || '未设置'}`);
console.log(`  App Secret: ${maskSecret(config.appSecret || config.sk)}`);
console.log(`  环境: ${config.env || 'sandbox'}`);
console.log(`  输出格式: ${config.format || 'table'}`);

// 显示数据中心域名（如有）
if (config.dataCenter) {
  console.log('\n数据中心域名:');
  console.log(`  Token URL: ${config.dataCenter.tokenUrl || '未设置'}`);
  console.log(`  Gateway URL: ${config.dataCenter.gatewayUrl || '未设置'}`);
  console.log(`  最后更新: ${config.dataCenter.lastUpdate || '未知'}`);
}
```

---

#### 子任务 1.3：修改 config set 命令

**文件**：`src/cli/commands/config/set.ts`

**修改内容**：
```typescript
// 支持新字段名
const validFields = ['tenantId', 'appKey', 'appSecret', 'env', 'format', 'ak', 'sk'];

// 提示说明
if (field === 'tenantId') {
  console.log('设置租户ID（必需）');
}
if (field === 'appKey') {
  console.log('设置 App Key（推荐使用，替代 ak）');
}
if (field === 'appSecret') {
  console.log('设置 App Secret（推荐使用，替代 sk）');
  console.log('注意：appSecret 将加密存储');
}
```

---

#### 子任务 1.4：更新环境变量常量

**文件**：`src/infrastructure/env/env-service.ts`

**修改内容**：
```typescript
// 添加新环境变量常量
export const EnvKey = {
  // 新字段（推荐）
  YBC_TENANT_ID: 'YBC_TENANT_ID',
  YBC_APP_KEY: 'YBC_APP_KEY',
  YBC_APP_SECRET: 'YBC_APP_SECRET',
  
  // 旧字段（向后兼容）
  YBC_AK: 'YBC_AK',
  YBC_SK: 'YBC_SK',
  
  // 其他
  YBC_FORMAT: 'YBC_FORMAT',
  YBC_ENV: 'YBC_ENV',
} as const;
```

---

### 任务 2：E2E测试修复（🟡 建议完成）

**目标**：修复34个失败的旧测试，更新参数格式

**需要修改的文件**：

| 文件类型 | 文件数 | 预估时间 |
|---------|-------|---------|
| E2E测试 | ~8个 | 30分钟 |
| 集成测试 | ~3个 | 20分钟 |
| Mock更新 | ~2个 | 10分钟 |

**总计**：约 1 小时

---

#### 典型修改示例

**修改前**（旧参数格式）：
```typescript
await configService.init({
  ak: 'test-access-key',
  sk: 'test-secret-key',
  env: 'sandbox',
});
```

**修改后**（新参数格式）：
```typescript
await configService.init({
  tenantId: 'test-tenant-id',
  appKey: 'test-app-key',
  appSecret: 'test-app-secret',
  env: 'sandbox',
});
```

---

### 任务 3：真实API测试（🟢 可选）

**目标**：使用真实凭证验证完整流程

**前提条件**：
- ✅ 拥有真实的 tenantId
- ✅ 拥有真实的 appKey 和 appSecret
- ✅ 任务 1 完成（CLI命令适配）

**测试步骤**：
1. 使用 `ybc config init` 配置真实凭证
2. 运行 `ybc staff query --verbose` 查看 Token 获取过程
3. 验证签名计算、数据中心查询、Token获取是否正确
4. 验证业务接口调用是否返回数据

**验证清单**：
- ✅ 签名计算正确（code='00000'）
- ✅ 数据中心域名正确返回
- ✅ Token成功获取（access_token）
- ✅ 业务接口返回数据

---

## 🎯 推荐执行顺序

### 顺序 A：完整流程（推荐）

```
任务 1: CLI命令适配（1-1.5小时）
    ↓
任务 2: E2E测试修复（1小时）
    ↓
任务 3: 真实API测试（需凭证）
```

**优点**：
- ✅ 完整的功能验证
- ✅ 所有测试通过
- ✅ 真实环境验证

---

### 顺序 B：快速验证（推荐）

```
任务 1: CLI命令适配（1-1.5小时）
    ↓
任务 3: 真实API测试（如有凭证）
```

**优点**：
- ✅ 最快验证核心功能
- ✅ 真实环境优先
- ⏸️ E2E测试可后续修复

---

### 顺序 C：测试优先

```
任务 2: E2E测试修复（1小时）
    ↓
任务 1: CLI命令适配（1-1.5小时）
```

**优点**：
- ✅ 测试覆盖率最大化
- ✅ 确保代码质量

---

## 💡 执行建议

### 建议 1：立即执行任务 1（CLI命令适配）

**理由**：
- 🔴 高优先级
- ✅ 用户无法通过CLI配置新字段
- ✅ 当前只能使用环境变量（不够友好）

**执行方式**：
- 使用多Agent并行实施（推荐）
- 或手动逐个文件修改

---

### 建议 2：E2E测试修复可选

**理由**：
- 🟡 中优先级
- ✅ 新功能测试已全部通过（52个）
- ⏸️ E2E测试失败不影响核心功能验证

**建议时机**：
- Phase 2 完成后，作为代码质量优化
- 或在真实API测试前修复

---

### 建议 3：真实API测试需要凭证

**前提**：
- ✅ tenantId（租户ID）
- ✅ appKey（应用Key）
- ✅ appSecret（应用Secret）

**获取方式**：
- 登录用友 BIP 开放平台
- 创建应用并获取授权
- 从平台获取凭证

---

## 📊 工作量评估

### 总工作量

| 任务 | 工作量 | Agent并行 | 手动执行 |
|------|--------|----------|---------|
| **任务 1: CLI命令适配** | 1-1.5小时 | 20分钟 | 1-1.5小时 |
| **任务 2: E2E测试修复** | 1小时 | 15分钟 | 1小时 |
| **任务 3: 真实API测试** | 30分钟 | - | 30分钟 |
| **总计** | **2.5-3小时** | **35分钟** | **2.5-3小时** |

---

## 🤖 Agent并行执行方案

### 方案：使用 3 个 Agent 并行

**Agent 1**：CLI命令适配（config init/show/set）
**Agent 2**：环境变量常量更新
**Agent 3**：E2E测试修复（可选，并行）

**预估时间**：20-35 分钟完成所有工作

---

## 📋 任务检查清单

### 任务 1 完成标准

- ✅ `config init` 支持输入 tenantId, appKey, appSecret
- ✅ `config show` 显示新字段和数据中心域名
- ✅ `config set` 支持设置新字段
- ✅ 环境变量常量更新完成
- ✅ CLI命令测试通过

---

### 任务 2 完成标准

- ✅ 所有E2E测试通过
- ✅ 参数格式更新完成
- ✅ Mock API更新完成
- ✅ 测试覆盖率保持

---

### 任务 3 完成标准

- ✅ 真实Token获取成功（code='00000'）
- ✅ 签名计算正确
- ✅ 数据中心域名正确
- ✅ 业务接口返回数据
- ✅ verbose 日志验证流程正确

---

## 🎯 立即行动计划

### 推荐方案：启动多Agent执行任务 1

**立即执行**：
```bash
# 创建 3 个 Agent 并行执行 CLI命令适配
1. Agent 修改 config init（添加 tenantId/appKey/appSecret 提示）
2. Agent 修改 config show（显示新字段）
3. Agent 修改 config set（支持新字段设置） + 环境变量常量
```

**预估完成时间**：20-30 分钟

---

### 可选方案：手动逐步执行

**顺序执行**：
1. 手动修改 `config/init.ts`（30分钟）
2. 手动修改 `config/show.ts`（15分钟）
3. 手动修改 `config/set.ts`（15分钟）
4. 手动更新环境变量常量（10分钟）

**预估完成时间**：1-1.5 小时

---

## ✅ 完成后的预期结果

### 任务 1 完成后

**用户可以**：
- ✅ 使用 `ybc config init` 交互式配置 tenantId, appKey, appSecret
- ✅ 使用 `ybc config show` 查看新字段和数据中心域名
- ✅ 使用 `ybc config set tenantId xxx` 设置新字段
- ✅ 不再依赖环境变量配置

---

### 任务 2 完成后

**项目状态**：
- ✅ 所有测试通过（包括E2E）
- ✅ 测试覆盖率最大化
- ✅ 代码质量优化

---

### 任务 3 完成后

**验证结果**：
- ✅ 真实环境功能验证
- ✅ Token获取流程正确
- ✅ 业务接口调用成功
- ✅ 符合官方API规范

---

## 🎉 总结

### 当前决策点

**请选择下一步执行方案**：

| 方案 | 执行方式 | 预估时间 | 推荐度 |
|------|---------|---------|--------|
| **方案 1** | Agent并行执行任务 1 | 20-30分钟 | ⭐⭐⭐⭐⭐ 推荐 |
| **方案 2** | 手动执行任务 1 | 1-1.5小时 | ⭐⭐⭐ 可选 |
| **方案 3** | Agent并行执行任务 1+2 | 35分钟 | ⭐⭐⭐⭐ 推荐 |
| **方案 4** | 真实API测试（需凭证） | 30分钟 | ⭐⭐ 可选 |

---

### 推荐立即执行

**最优方案**：启动 Agent 并行执行 CLI命令适配（任务 1）

**理由**：
- ✅ 高优先级（影响用户使用）
- ✅ 快速完成（20-30分钟）
- ✅ Agent并行效率高
- ✅ 完成后用户可正常使用CLI

---

**准备好后，启动 Agent 执行任务 1：CLI命令适配！**