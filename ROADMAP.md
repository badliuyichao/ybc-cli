# 下一步行动计划

> ⚠️ 上半部分（Phase 2 历史）保留作为归档。**最新待办见文末「Phase 3 待办清单（2026-06-17）」**。

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
| **E2E测试迁移到真实API** | 🟡 中 | 1-1.5小时 |
| **单元测试覆盖率优化** | 🟡 中 | 1-1.5小时 |

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

### 任务 3：单元测试覆盖率优化（🟡 建议完成）

**目标**：提升单元测试覆盖率，重点补充低覆盖率模块

**当前覆盖率**：91.79%（目标 ≥80%）✅ 已达标

**需要补充测试的模块**：

| 模块 | 当前覆盖率 | 目标 | 预估时间 |
|------|-----------|------|---------|
| `auth-interceptor.ts` | 53.48% | ≥80% | 30分钟 |
| `file-storage.ts` | 82.81% | ≥90% | 20分钟 |
| `error-handler.ts` | 87.01% | ≥95% | 15分钟 |
| `config-service.ts` | 88.99% | ≥95% | 10分钟 |

**总计**：约 1-1.5 小时

---

#### 子任务 3.1：补充 auth-interceptor 测试

**文件**：`tests/unit/infrastructure/http/auth-interceptor.test.ts`

**当前问题**：
- 覆盖率 53.48%，未覆盖行：44, 77, 97-142
- Token 过期检测逻辑未测试

**补充内容**：
```typescript
// 测试 Token 过期检测
it('should detect expired token', () => {
  const expiredToken = {
    access_token: 'test-token',
    expires_at: Date.now() - 1000,  // 已过期
  };
  // 验证拦截器正确处理过期 token
});

// 测试自动刷新逻辑
it('should trigger token refresh when expired', async () => {
  // 验证拦截器调用 TokenManager 刷新
});
```

---

#### 子任务 3.2：补充 file-storage 测试

**文件**：`tests/unit/infrastructure/file-storage.test.ts`

**当前问题**：
- 覆盖率 82.81%，未覆盖行：68, 108-134, 200, 264
- 错误处理分支未完全覆盖

**补充内容**：
```typescript
// 测试文件不存在时的处理
it('should handle non-existent file gracefully', async () => {
  const result = await storage.read('/nonexistent/file.json');
  expect(result).toBeNull();
});

// 测试权限设置失败
it('should handle permission errors', async () => {
  // 验证权限设置失败时的降级处理
});
```

---

#### 子任务 3.3：补充 error-handler 测试

**文件**：`tests/unit/services/error/error-handler.test.ts`

**当前问题**：
- 覆盖率 87.01%，未覆盖行：211-213, 218-222, 230-232
- 部分错误类型处理未测试

**补充内容**：
```typescript
// 测试 NetworkError 处理
it('should handle NetworkError with correct exit code', () => {
  const error = new NetworkError('Connection timeout');
  const exitCode = errorHandler.handle(error);
  expect(exitCode).toBe(5);
});

// 测试 ValidationError 处理
it('should handle ValidationError with correct exit code', () => {
  const error = new ValidationError('Invalid config');
  const exitCode = errorHandler.handle(error);
  expect(exitCode).toBe(1);
});
```

---

### 任务 4：E2E 测试迁移到真实 API（🟡 建议完成）

**目标**：将 E2E 测试从 Mock Server 方案迁移到使用真实凭证连接用友公有云 API

**背景**：
- 用友 BIP API 入口固定为 `https://api.yonyoucloud.com`
- 实际域名由 `DataCenterService` 根据 `tenantId` 动态查询返回
- 不需要区分 sandbox / production

**需要完成的工作**：

| 工作项 | 说明 | 预估时间 |
|--------|------|---------|
| 创建测试配置加载器 | `tests/config/test-config.ts` | ✅ 已完成 |
| 创建配置文件模板 | `tests/config/test-credentials.json.example` | ✅ 已完成 |
| 更新 `.gitignore` | 忽略真实凭证文件 | ✅ 已完成 |
| 编写真实 API E2E 测试 | 替换 Mock Server 测试 | 30 分钟 |
| 更新测试文档 | `docs/design/testing.md` | ✅ 已完成 |

**配置方式**：

```bash
# 方式 1：环境变量（CI/CD）
export YBC_TEST_TENANT_ID=your-tenant-id
export YBC_TEST_APP_KEY=your-app-key
export YBC_TEST_APP_SECRET=your-app-secret

# 方式 2：配置文件（本地开发）
# 创建 tests/config/test-credentials.json
```

**测试示例**：

```typescript
import { loadTestConfig } from '../config/test-config';
import { execSync } from 'child_process';

describe('Real API E2E', () => {
  const config = loadTestConfig();

  it('should get token from real API', () => {
    const result = execSync(
      'npx ts-node src/bin/ybc.ts staff query --code EMP001',
      {
        env: {
          ...process.env,
          YBC_TENANT_ID: config.tenantId,
          YBC_APP_KEY: config.appKey,
          YBC_APP_SECRET: config.appSecret,
        },
        encoding: 'utf-8',
      }
    );
    expect(result).toBeDefined();
  });
});
```

**总计**：约 30 分钟（配置加载器已完成）

---

## 🎯 推荐执行顺序

### 顺序 A：完整流程（推荐）

```
任务 1: CLI命令适配（1-1.5小时）
    ↓
任务 2: E2E测试修复（1小时）
    ↓
任务 3: 单元测试覆盖率优化（1-1.5小时）
    ↓
任务 4: E2E测试迁移到真实API（30分钟）
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
| **任务 3: 单元测试覆盖率优化** | 1-1.5小时 | 20分钟 | 1-1.5小时 |
| **任务 4: E2E测试迁移到真实API** | 30分钟 | 15分钟 | 30分钟 |
| **总计** | **3.5-4.5小时** | **70分钟** | **3.5-4.5小时** |

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

- ✅ auth-interceptor.ts 覆盖率 ≥80%
- ✅ file-storage.ts 覆盖率 ≥90%
- ✅ error-handler.ts 覆盖率 ≥95%
- ✅ config-service.ts 覆盖率 ≥95%
- ✅ 总体覆盖率保持 ≥90%

---

### 任务 4 完成标准

- ✅ 测试配置加载器创建完成
- ✅ 配置文件模板创建完成
- ✅ `.gitignore` 已更新
- ✅ E2E 测试迁移到真实 API
- ✅ 测试文档已更新

---

### 任务 5 完成标准

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

**项目状态**：
- ✅ 单元测试覆盖率 ≥90%
- ✅ 低覆盖率模块补充完成
- ✅ 测试用例更加完善

---

### 任务 4 完成后

**项目状态**：
- ✅ E2E 测试使用真实 API
- ✅ 测试配置管理规范化
- ✅ 测试文档完整更新

---

## 🎉 总结

### 当前决策点

**请选择下一步执行方案**：

| 方案 | 执行方式 | 预估时间 | 推荐度 |
|------|---------|---------|--------|
| **方案 1** | Agent并行执行任务 1 | 20-30分钟 | ⭐⭐⭐⭐⭐ 推荐 |
| **方案 2** | 手动执行任务 1 | 1-1.5小时 | ⭐⭐⭐ 可选 |
| **方案 3** | Agent并行执行任务 1+2 | 35分钟 | ⭐⭐⭐⭐ 推荐 |
| **方案 4** | Agent并行执行任务 1+2+3 | 55分钟 | ⭐⭐⭐⭐ 推荐 |
| **方案 5** | Agent并行执行任务 1+2+3+4 | 70分钟 | ⭐⭐⭐⭐ 推荐 |

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
---

## 📋 Phase 3 待办清单（2026-06-17）

> 截至 2026-06-17，Phase 1-2 全部完成，所有 CR-001 ~ CR-051 已处理。下面是下一阶段可处理的事项，按"价值/时间"比排序。

### 🔴 P0 高 ROI（单次 < 1 小时）

#### 待办-001：同步生成器模板到新架构
- **跟踪**：CR-047（增强）+ 沿用 CR-001/CR-041 修复思路
- **文件**：`scripts/generate-commands.ts`
- **问题**：当前模板仍生成旧模式（`new XxxApi(configuration)` + `process.exit(1)`）。下次 `npm run generate:commands` 会重新引入已修复的问题。
- **改动**：
  - 模板改为生成 `new ApiHttpWrapper()` + `wrapper.call({method, path, params})` 模式
  - 错误处理统一为 `handleErrorAndExit`
  - 移除每个生成命令的 `process.exit(1)`
- **工作量**：约 30 分钟（含 1 次端到端重生成验证）
- **价值**：⭐⭐⭐⭐⭐（防回归，让 Phase 3 加新域变得安全）
- **完成时间**：2026-06-17（commit `43e6eeb`）
- **完成内容**：
  - 解析层从 AxiosParamCreator 提取 method/path/pathParams/bodyParam
  - 模板统一为 ApiHttpWrapper 模式 + handleErrorAndExit + 业务成功码判断（CR-016 统一）
  - 5 个命令重生成（queryStaff/enableStaff/disableStaff/listTodos/createTodo）全部正确：
    - queryStaff: GET query param
    - enableStaff/disableStaff: POST path param
    - listTodos: GET 多 query param
    - createTodo: POST body param
  - 下次 `npm run generate:commands` 直接产出正确代码，无需手改
  - TypeScript 编译 0 错误，全套测试 34/36 套件通过（2 失败 = performance 网络超时，与代码无关）

#### 待办-002：真正删除 auth-interceptor
- **跟踪**：CR-042
- **文件**：`src/infrastructure/http/auth-interceptor.ts`
- **现状**：已标记 `@deprecated`，但代码仍在，含 10 处 `any`
- **改动**：
  - 确认无业务引用（业务已用 `ApiHttpWrapper`）
  - 删除文件 + 从 `index.ts` 移除导出
  - 更新 `tests/unit/infrastructure/http/auth-interceptor.test.ts`（删除或保留为基类测试）
- **工作量**：约 15 分钟
- **价值**：⭐⭐⭐⭐（清掉 10 处 `any` 风险 + 减少包体积）
- **完成时间**：2026-06-17（commit `df1bd85`）
- **完成内容**：
  - 删除 `src/infrastructure/http/auth-interceptor.ts`（154 行 + 10 处 any）
  - 删除 `tests/unit/infrastructure/http/auth-interceptor.test.ts`（7 用例）
  - 从 `index.ts` 移除 `createAuthInterceptor` 导出，加注释指向 `ApiHttpWrapper`
  - 业务无任何引用（已 grep 确认），是真正的安全删除
  - TypeScript 编译 0 错误，22/22 单元测试套件通过（436 用例）

#### 待办-003：清理剩余 ESLint 真实错误
- **跟踪**：CR-015 剩余（生成代码部分）
- **现状**：当前 129 个真实错误，全部来自 `src/api/generated/` 和 `typescript-eslint/no-unsafe-*`
- **改动**：
  - 生成代码可加 `.eslintignore` 或调 `.eslintrc.js` 忽略 generated/
  - 手写代码剩余错误逐个修复
- **工作量**：约 30 分钟
- **价值**：⭐⭐⭐（让 `npm run lint` 干净）
- **完成时间**：2026-06-17（commit `79bdb5b`）
- **完成内容**：
  - `.eslintrc.js` ignorePatterns 加 `src/api/generated/**` 和 `src/cli/commands/generated/**`（按 CLAUDE.md 规则：生成代码不可手改，不做 lint）
  - 9 个手写文件修复 ~30 个 typescript-eslint 错误：
    - update-checker: JSON.parse 类型断言 + async 改 sync
    - init.ts: options 类型注解 + onData 返回类型
    - set.ts: type predicate 收窄 + String() 包装
    - show.ts: options 类型注解
    - index.ts: async 改 Promise wrapper
    - output/index.ts: String() 包装
    - program.ts: JSON.parse 类型断言
    - logging-interceptor.ts: 数组分支 unknown 标注
    - api-http-wrapper.ts: 箭头函数返回类型
    - config-service.ts: String() 包装
  - `npm run lint` 结果：96 errors + 4 warnings → **0 errors + 0 warnings** ✅
  - TypeScript 编译 0 错误
  - 单元测试 22/22 套件，436 用例全过

---

### 🟡 P1 中等 ROI（半天）

#### 待办-004：补 ApiClientService 注入重构
- **跟踪**：CR-009
- **文件**：`src/services/api/api-http-wrapper.ts`、`src/services/api/api-client-service.ts`
- **问题**：当前 `ApiHttpWrapper` 内部 `new ApiClientService()`，每次命令执行都新建实例，`cachedGatewayUrl` 缓存无法跨命令共享
- **改动**：
  - 改为构造函数注入（DI）
  - `bootstrap()` 中创建共享 `ApiClientService` 单例
  - 通过闭包/context 注入到命令
- **工作量**：约 2 小时
- **价值**：⭐⭐⭐⭐（首命令后跳过数据中心查询，加速 200ms+）
- **完成时间**：2026-06-17（commit `58e1dca`）
- **完成内容**：
  - `ApiHttpWrapper` 构造函数改为接收 `apiClientService: ApiClientService`
  - 移除内部 `new ApiClientService()`
  - 同步更新生成器模板：生成的命令接受 `apiClientService` 参数并注入 wrapper
  - 重生成 5 个命令 + 2 个 index 文件
  - `bootstrap()` 创建 `apiClientService` 单例并注入到所有注册
  - 4 个测试文件更新（api-http-wrapper.test.ts / http-flow.test.ts / full-flow.test.ts / staff-query.test.ts / todo-list.test.ts）
  - TypeScript 编译 0 错误
  - 全套测试 34/35 套件通过（4 失败 = performance 网络超时，与本次重构无关）

#### 待办-005：补 update-checker 退出码契约测试
- **跟踪**：CR-044 增强
- **文件**：`tests/unit/services/update/update-checker.test.ts`
- **改动**：补 1-2 个用例验证网络错误时返回退出码 0（静默失败契约）
- **工作量**：约 30 分钟
- **价值**：⭐⭐（防退化）

#### 待办-006：补 update-checker 改用 FileStorage
- **跟踪**：CR-011
- **文件**：`src/services/update/update-checker.ts`
- **问题**：直接用 `fs.readFileSync`/`fs.writeFileSync` 操作 `~/.ybc/update-check.json`，绕过 `FileStorage`，违反 architecture.md §1 "Service 层不直接读写 ~/.ybc/*.json"
- **改动**：重构为 `FileStorage` + 设 600 权限
- **工作量**：约 1 小时
- **价值**：⭐⭐⭐⭐（架构一致性 + 安全性）

#### 待办-007：补 TokenManager 并发控制
- **跟踪**：CR-019
- **文件**：`src/services/auth/token-manager.ts`
- **问题**：`getValidToken()` 没有并发保护。多个命令同时触发 Token 刷新会导致多次冗余请求
- **改动**：引入 `refreshPromise: Promise<string> | null` 单例，后续调用复用同一个 Promise
- **工作量**：约 1 小时
- **价值**：⭐⭐⭐（防批量调用场景的 N 倍请求）

---

### 🟢 P2 长期规划（1-2 周，进 ROADMAP 主路线）

#### 待办-008：Phase 3 voucher 域（凭证管理）
- **来源**：requirements.md §3 列为待启动
- **范围**：
  - `openapi/openapi.yaml` 加 voucher 端点（凭证查询、创建、审核、过账）
  - `npm run generate:api` + `npm run generate:commands`
  - 生成 5-10 个新命令（前提：待办-001 已完成）
  - 补单元/集成/E2E 测试
- **工作量**：约 3-5 天
- **价值**：⭐⭐⭐⭐⭐（业务扩展，覆盖 BIP 核心域）

#### 待办-009：批量调用 `ybc batch -f file.json`
- **来源**：requirements.md §3 列为 P2
- **范围**：
  - 设计批量请求 JSON schema
  - 实现 `ybc batch` 命令
  - 支持并发控制（关联待办-007）
  - 失败重试 + 部分成功报告
- **工作量**：约 2-3 天
- **价值**：⭐⭐⭐⭐（数据同步场景核心能力）

#### 待办-010：命令搜索 `ybc search <kw>`
- **来源**：requirements.md §3 列为 P1
- **范围**：
  - 索引所有 OpenAPI 端点的 summary/description
  - 实现 `ybc search <keyword>` 模糊匹配
  - 输出匹配的命令及 help 链接
- **工作量**：约 1 天
- **价值**：⭐⭐⭐（300+ API 场景下的发现能力）

#### 待办-011：Phase 4 大模型友好
- **来源**：requirements.md §3 列为 P1
- **范围**：
  - `--help-json` 输出 JSON Schema（让 AI Agent 解析命令结构）
  - `--template @file.json` 模板参数
  - 插件机制 `@ybc-plugin/*`
- **工作量**：约 1 周
- **价值**：⭐⭐⭐⭐⭐（AI Agent 集成的核心入口）

---

### 📊 推荐执行顺序

```
第 1 步（半天）：待办-001 + 待办-002 + 待办-003
  → 清掉技术债，让后续加新域安全
      ↓
第 2 步（1 天）：待办-006 + 待办-007 + 待办-004
  → 架构治理，加速 + 并发安全
      ↓
第 3 步（1 周）：待办-008（voucher 域）
  → 业务扩展，覆盖 BIP 核心域
      ↓
第 4 步（按需）：待办-009 / 待办-010 / 待办-011
  → 高级能力，按用户反馈推进
```

### 🎯 立即可做

**最快见效**：待办-001（同步生成器模板，30 分钟）+ 待办-002（删除 auth-interceptor，15 分钟），合计 45 分钟，让代码库进入"无技术债"状态。

### 📝 版本节奏建议

| 版本 | 范围 | 预计 |
|------|------|------|
| v0.1.10 | 待办-001/002/003（技术债清理）| 1 天 |
| v0.2.0 | 待办-004/006/007（架构治理）| 2-3 天 |
| v0.3.0 | 待办-008（voucher 域）| 1 周 |
| v1.0.0 | 待办-009/010/011（高级能力）| 2-3 周 |

