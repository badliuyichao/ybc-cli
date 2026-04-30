# 用友BIP CLI（ybc）测试策略

---

## 文档信息

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-25 | 测试主管 | 初稿，基于架构设计和技术实现方案 |

**适用范围**：`ybc` CLI 工具的测试计划、测试用例、质量验收标准。
**目标读者**：测试主管、开发工程师、QA工程师。

---

## 1. 测试目标与范围

### 1.1 测试目标

确保 `ybc` CLI 工具满足以下质量标准:

- **功能完整性**: 所有产品需求功能正常实现
- **稳定性**: 异常情况处理正确,不崩溃、不卡死
- **性能**: 响应时间满足设计要求
- **安全性**: 无安全漏洞,凭证保护到位
- **可用性**: 用户体验友好,错误提示清晰
- **兼容性**: 跨平台运行正常
- **可维护性**: 代码质量高,测试覆盖率达标

### 1.2 测试范围

| 测试类型 | 覆盖范围 | 负责角色 |
|----------|----------|----------|
| **单元测试** | 所有 Service 层、Infrastructure 层模块 | 开发工程师 |
| **集成测试** | CLI 层与 Service 层集成、鉴权流程、命令执行流程 | 测试工程师 |
| **E2E 测试** | 用户端到端场景测试 | 测试工程师 |
| **性能测试** | 启动性能、API调用性能、大数据量输出性能 | 测试工程师 |
| **安全测试** | 凭证保护、Token安全、加密机制 | 安全工程师 |
| **兼容性测试** | Windows/macOS/Linux、Node.js 版本兼容 | 测试工程师 |
| **回归测试** | 每次版本发布前的回归验证 | 测试工程师 |

---

## 2. 测试计划

### 2.1 测试阶段划分

```
Phase 1: 单元测试（开发阶段）
  └─ 与开发同步进行
  └─ 开发工程师编写并运行
  └─ 目标覆盖率: ≥80%

Phase 2: 集成测试（开发完成后）
  └─ 每个模块完成后进行
  └─ 测试工程师编写并运行
  └─ 目标覆盖率: ≥70%

Phase 3: E2E 测试（MVP 完成后）
  └─ MVP 功能完成后进行
  └─ 测试工程师编写并运行
  └─ 目标覆盖率: 核心场景100%

Phase 4: 性能测试（发布前）
  └─ 版本发布前进行
  └─ 测试工程师执行
  └─ 目标: 满足性能指标

Phase 5: 安全测试（发布前）
  └─ 版本发布前进行
  └─ 安全工程师执行
  └─ 目标: 无安全漏洞

Phase 6: 兼容性测试（发布前）
  └─ 版本发布前进行
  └─ 测试工程师执行
  └─ 目标: 全平台兼容

Phase 7: 回归测试（每次发布）
  └─ 每次版本发布前执行
  └─ 测试工程师执行
  └─ 目标: 无已知缺陷
```

### 2.2 测试时间安排（基于实施路线图）

| 阶段 | 时间周期 | 测试活动 | 交付物 |
|------|----------|----------|--------|
| **Phase 1: 基础验证** | 1 周 | 单元测试框架搭建、基础 API 测试 | 测试框架、单元测试用例 |
| **Phase 2: MVP** | 2 周 | 单元测试、集成测试、E2E 测试（核心场景） | 单元测试覆盖率报告、集成测试报告、E2E 测试脚本 |
| **Phase 3: 全量命令** | 2 周 | 扩展测试用例、性能测试、兼容性测试 | 完整测试报告、性能报告 |
| **Phase 4: 高级特性** | 2 周 | 新功能测试、回归测试、安全测试 | 安全测试报告、回归测试报告 |
| **Phase 5: 生态与维护** | 持续 | 自动化测试、持续回归 | 自动化测试系统、持续测试报告 |

---

## 3. 测试环境准备

### 3.1 测试环境配置

| 环境 | 用途 | 配置要求 |
|------|------|----------|
| **开发环境** | 单元测试、集成测试 | Node.js ≥16、本地开发机器 |
| **沙箱环境** | E2E 测试、API 调用测试 | 用友 BIP Sandbox AK/SK |
| **生产环境** | 回归测试、最终验收测试 | 用友 BIP Production AK/SK（受限权限） |
| **多平台环境** | 兼容性测试 | Windows/macOS/Linux 各一台 |
| **性能测试环境** | 性能压测 | 独立机器、模拟网络延迟 |

### 3.2 测试数据准备

#### `tests/fixtures/config.json`

```json
{
  "ak": "test-ak-12345",
  "sk": "test-sk-abcde",
  "env": "sandbox",
  "format": "table",
  "verbose": false,
  "timeout": 5000
}
```

#### `tests/fixtures/token.json`

```json
{
  "access_token": "mock-access-token-xxx",
  "expires_at": 9999999999999,
  "token_type": "Bearer"
}
```

#### `tests/fixtures/mock-api.ts`

```typescript
/**
 * Mock API 响应数据
 */
export const mockStaffQueryResponse = {
  code: 0,
  message: "success",
  data: [
    {
      code: "EMP001",
      name: "张三",
      dept: "研发部",
      status: "在职"
    },
    {
      code: "EMP002",
      name: "李四",
      dept: "财务部",
      status: "在职"
    }
  ]
};

export const mockTodoListResponse = {
  code: 0,
  message: "success",
  data: [
    {
      id: "todo-001",
      title: "审批凭证",
      status: "pending",
      assignee: "张三"
    },
    {
      id: "todo-002",
      title: "提交报销",
      status: "done",
      assignee: "李四"
    }
  ]
};

export const mockErrorResponse = {
  code: 1001,
  message: "业务错误：参数不合法"
};

export const mockAuthErrorResponse = {
  code: 401,
  message: "Token已过期"
};
```

### 3.3 Mock 服务配置

#### `tests/mocks/api-responses.ts`

```typescript
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);

// Mock Token API
mock.onPost('/token').reply(200, {
  access_token: 'mock-token-xxx',
  expires_in: 7200
});

// Mock Staff Query API
mock.onGet('/api/staff/query').reply(200, mockStaffQueryResponse);

// Mock Todo List API
mock.onGet('/api/todo/list').reply(200, mockTodoListResponse);

// Mock Error Response
mock.onGet('/api/error').reply(400, mockErrorResponse);

export default mock;
```

---

## 4. 测试清单

### 4.1 单元测试清单

#### 4.1.1 Service 层测试

| 模块 | 测试项 | 测试内容 | 优先级 |
|------|--------|----------|--------|
| **TokenManager** | getValidToken | 缓存Token有效时返回 | P0 |
| | getValidToken | 缓存Token过期时刷新 | P0 |
| | getValidToken | 缓存不存在时获取新Token | P0 |
| | refreshToken | Token刷新成功 | P0 |
| | refreshToken | Token刷新失败（AK/SK错误） | P0 |
| | isExpired | Token未过期判断 | P1 |
| | isExpired | Token已过期判断 | P1 |
| | clearCache | 清除缓存成功 | P1 |
| **ConfigManager** | load | 配置加载成功 | P0 |
| | load | 配置文件不存在 | P1 |
| | save | 配置保存成功 | P0 |
| | save | SK加密保存 | P0 |
| | get | 配置项读取 | P1 |
| | set | 配置项修改 | P1 |
| | validate | 配置验证成功 | P0 |
| | validate | 配置验证失败（AK格式错误） | P0 |
| **CommandRouter** | route | 命令路由正确 | P0 |
| | route | 命令不存在 | P1 |
| | register | 命令注册成功 | P1 |
| **ErrorHandler** | handle | CLI错误处理 | P0 |
| | handle | 网络错误处理 | P0 |
| | handle | 业务错误处理 | P0 |
| | getUserMessage | 错误消息生成 | P1 |

#### 4.1.2 Infrastructure 层测试

| 模块 | 测试项 | 测试内容 | 优先级 |
|------|--------|----------|--------|
| **FileStorage** | read | 文件读取成功 | P0 |
| | read | 文件不存在 | P1 |
| | write | 文件写入成功 | P0 |
| | write | 文件权限设置 | P0 |
| | delete | 文件删除成功 | P1 |
| **Encryptor** | encrypt | SK加密成功 | P0 |
| | encrypt | 加密算法验证 | P0 |
| | decrypt | SK解密成功 | P0 |
| | decrypt | 解密失败（密钥错误） | P1 |
| **HttpClient** | create | HTTP客户端创建 | P1 |
| | timeout | 超时设置 | P1 |
| | interceptors | 拦截器安装 | P1 |

#### 4.1.3 Utils 层测试

| 函数 | 测试项 | 测试内容 | 优先级 |
|------|--------|----------|--------|
| **validator** | validateAK | AK格式验证 | P0 |
| | validateSK | SK格式验证 | P0 |
| | validateEnv | 环境验证 | P1 |
| **formatter** | formatDate | 日期格式化 | P1 |
| | formatTable | 表格格式化 | P1 |
| **obfuscator** | obfuscateSK | SK脱敏处理 | P0 |

### 4.2 集成测试清单

#### 4.2.1 鉴权流程集成测试

| 测试场景 | 测试内容 | 优先级 |
|----------|----------|--------|
| **首次调用** | 无缓存Token时自动获取并调用成功 | P0 |
| **Token过期** | Token过期时自动刷新并调用成功 | P0 |
| **401重试** | 401错误时自动刷新Token并重试一次 | P0 |
| **AK/SK错误** | AK/SK错误时抛出AuthError | P0 |
| **环境变量注入** | YBC_AK/YBC_SK环境变量优先级 | P1 |
| **配置文件加载** | 配置文件加载并初始化鉴权 | P0 |

#### 4.2.2 命令执行流程集成测试

| 测试场景 | 测试内容 | 优先级 |
|----------|----------|--------|
| **命令解析** | commander解析命令参数成功 | P0 |
| **全局选项** | --format/--verbose/--dry-run选项生效 | P0 |
| **业务命令执行** | staff query命令完整流程 | P0 |
| **输出格式化** | JSON/Table/CSV输出格式正确 | P0 |
| **错误处理** | 业务错误时正确退出码和提示 | P0 |
| **网络错误** | 网络错误时正确退出码和提示 | P0 |
| **配置命令** | config init/show/set完整流程 | P0 |

#### 4.2.3 输出适配集成测试

| 测试场景 | 测试内容 | 优先级 |
|----------|----------|--------|
| **JSON输出** | JSON格式化输出正确 | P0 |
| **Table输出** | 表格格式化输出正确 | P0 |
| **CSV输出** | CSV格式化输出正确 | P1 |
| **RAW输出** | RAW模式输出原始响应 | P0 |
| **无颜色输出** | --no-color选项生效 | P1 |

### 4.3 E2E 测试清单

#### 4.3.1 用户故事测试场景

| 用户角色 | 测试场景 | 测试内容 | 优先级 |
|----------|----------|----------|--------|
| **集成开发者** | 查询员工信息 | ybc staff query --code EMP001 → 返回员工信息 | P0 |
| | 启用员工 | ybc staff enable <id> → 成功启用 | P0 |
| | 创建凭证 | ybc voucher create --data @payload.json → 成功创建 | P0 |
| **运维工程师** | 批量查询 | ybc staff query --dept-id D001 --json → 返回JSON数据 | P0 |
| | 非交互运行 | YBC_QUIET=1 ybc staff query → 无进度提示 | P1 |
| | 环境变量配置 | YBC_AK/YBC_SK注入 → 自动鉴权 | P0 |
| **业务顾问** | 查询待办 | ybc todo list --status pending → 表格展示 | P0 |
| | 标记完成 | ybc todo done <id> → 成功标记 | P0 |
| | 搜索命令 | ybc search 待办 → 返回相关命令列表 | P1 |
| **大模型Agent** | JSON输出 | ybc staff query --json → 固定JSON格式 | P0 |
| | Schema输出 | ybc staff query --help-json → 输出JSON Schema | P1 |
| | 退出码判断 | 业务错误 → 退出码4，网络错误 → 退出码5 | P0 |

#### 4.3.2 完整业务流程测试

| 测试场景 | 测试步骤 | 优先级 |
|----------|----------|--------|
| **完整配置流程** | 1. ybc config init → 配置AK/SK<br>2. ybc config show → 查看配置<br>3. ybc login → 手动刷新Token<br>4. ybc staff query → 成功调用 | P0 |
| **完整员工管理流程** | 1. ybc staff query --code EMP001 → 查询员工<br>2. ybc staff disable EMP001 → 停用<br>3. ybc staff enable EMP001 → 启用<br>4. ybc staff update EMP001 --data @update.json → 更新 | P0 |
| **完整待办管理流程** | 1. ybc todo list --status pending → 查询待办<br>2. ybc todo create --title "新任务" → 创建<br>3. ybc todo done <id> → 完成<br>4. ybc todo delete <id> → 删除 | P0 |
| **完整凭证管理流程** | 1. ybc voucher query --date 2026-04-25 → 查询凭证<br>2. ybc voucher create --data @voucher.json → 创建<br>3. ybc voucher query --voucher-code V001 → 查询特定凭证 | P0 |

---

## 5. 测试用例设计

### 5.1 单元测试用例示例

#### `tests/unit/services/auth/token-manager.test.ts`

```typescript
import { TokenManager } from '../../../src/services/auth/token-manager';
import { FileStorage } from '../../../src/infrastructure/storage';
import { Logger } from '../../../src/services/logger';
import { AuthError } from '../../../src/services/error';
import mockAxios from '../../../tests/mocks/api-responses';

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let storage: FileStorage;
  let logger: Logger;

  beforeEach(() => {
    storage = new FileStorage();
    logger = new Logger(false, true);
    tokenManager = new TokenManager(storage, logger, {
      ak: 'test-ak',
      sk: 'test-sk',
      env: 'sandbox'
    });
    mockAxios.reset();
  });

  describe('getValidToken', () => {
    test('缓存Token有效时返回缓存的Token', async () => {
      // Mock 缓存Token
      await storage.write('token.json', JSON.stringify({
        access_token: 'cached-token',
        expires_at: Date.now() + 3600000, // 1小时后过期
        token_type: 'Bearer'
      }));

      const token = await tokenManager.getValidToken();
      expect(token).toBe('cached-token');
    });

    test('缓存Token过期时刷新Token', async () => {
      // Mock 过期Token
      await storage.write('token.json', JSON.stringify({
        access_token: 'expired-token',
        expires_at: Date.now() - 1000, // 已过期
        token_type: 'Bearer'
      }));

      // Mock API响应
      mockAxios.onPost('/token').reply(200, {
        access_token: 'new-token',
        expires_in: 7200
      });

      const token = await tokenManager.getValidToken();
      expect(token).toBe('new-token');
    });

    test('缓存不存在时获取新Token', async () => {
      // 无缓存

      // Mock API响应
      mockAxios.onPost('/token').reply(200, {
        access_token: 'new-token',
        expires_in: 7200
      });

      const token = await tokenManager.getValidToken();
      expect(token).toBe('new-token');
    });

    test('Token刷新失败时抛出AuthError', async () => {
      // Mock API错误响应
      mockAxios.onPost('/token').reply(401, {
        code: 401,
        message: 'AK/SK错误'
      });

      await expect(tokenManager.getValidToken()).rejects.toThrow(AuthError);
    });
  });

  describe('refreshToken', () => {
    test('Token刷新成功', async () => {
      mockAxios.onPost('/token').reply(200, {
        access_token: 'refreshed-token',
        expires_in: 7200
      });

      const tokenInfo = await tokenManager.refreshToken();
      expect(tokenInfo.access_token).toBe('refreshed-token');
      expect(tokenInfo.expires_at).toBeGreaterThan(Date.now());
    });
  });

  describe('isExpired', () => {
    test('Token未过期返回false', () => {
      const tokenInfo = {
        access_token: 'test',
        expires_at: Date.now() + 3600000,
        token_type: 'Bearer'
      };
      expect(tokenManager.isExpired(tokenInfo)).toBe(false);
    });

    test('Token已过期返回true', () => {
      const tokenInfo = {
        access_token: 'test',
        expires_at: Date.now() - 1000,
        token_type: 'Bearer'
      };
      expect(tokenManager.isExpired(tokenInfo)).toBe(true);
    });
  });
});
```

### 5.2 集成测试用例示例

#### `tests/integration/auth.test.ts`

```typescript
import { CLI } from '../../../src/cli';
import { ConfigManager } from '../../../src/services/config';
import { TokenManager } from '../../../src/services/auth';
import mockAxios from '../../../tests/mocks/api-responses';

describe('鉴权流程集成测试', () => {
  let cli: CLI;
  let configManager: ConfigManager;
  let tokenManager: TokenManager;

  beforeEach(async () => {
    // 初始化服务
    configManager = new ConfigManager();
    tokenManager = new TokenManager();

    // Mock配置
    await configManager.save({
      ak: 'test-ak',
      sk: 'test-sk',
      env: 'sandbox'
    });

    mockAxios.reset();
  });

  test('首次调用无缓存Token时自动获取并调用成功', async () => {
    // Mock Token API
    mockAxios.onPost('/token').reply(200, {
      access_token: 'first-token',
      expires_in: 7200
    });

    // Mock Staff Query API
    mockAxios.onGet('/api/staff/query').reply(200, {
      code: 0,
      data: [{ code: 'EMP001', name: '张三' }]
    });

    // 执行命令
    const result = await cli.execute('staff query --code EMP001');
    expect(result.code).toBe(0);
    expect(result.data[0].code).toBe('EMP001');
  });

  test('Token过期时自动刷新并调用成功', async () => {
    // Mock 过期Token
    await tokenManager.saveToCache({
      access_token: 'expired-token',
      expires_at: Date.now() - 1000,
      token_type: 'Bearer'
    });

    // Mock Token刷新
    mockAxios.onPost('/token').reply(200, {
      access_token: 'refreshed-token',
      expires_in: 7200
    });

    // Mock Staff Query API
    mockAxios.onGet('/api/staff/query').reply(200, {
      code: 0,
      data: [{ code: 'EMP001' }]
    });

    const result = await cli.execute('staff query --code EMP001');
    expect(result.code).toBe(0);
  });

  test('401错误时自动刷新Token并重试一次', async () => {
    // Mock 缓存Token
    await tokenManager.saveToCache({
      access_token: 'invalid-token',
      expires_at: Date.now() + 3600000,
      token_type: 'Bearer'
    });

    // 第一次请求返回401
    mockAxios.onGet('/api/staff/query').replyOnce(401, {
      code: 401,
      message: 'Token无效'
    });

    // Token刷新
    mockAxios.onPost('/token').reply(200, {
      access_token: 'new-token',
      expires_in: 7200
    });

    // 第二次请求成功
    mockAxios.onGet('/api/staff/query').reply(200, {
      code: 0,
      data: [{ code: 'EMP001' }]
    });

    const result = await cli.execute('staff query --code EMP001');
    expect(result.code).toBe(0);
  });
});
```

### 5.3 E2E 测试用例示例

#### `tests/e2e/scenarios/staff-query.test.ts`

```typescript
import { execSync } from 'child_process';
import fs from 'fs';

describe('员工查询E2E测试', () => {
  beforeAll(() => {
    // 配置环境
    execSync('ybc config init --ak test-ak --sk test-sk --env sandbox');
  });

  afterAll(() => {
    // 清理环境
    execSync('ybc config clear');
  });

  test('查询员工信息返回正确的表格输出', () => {
    const output = execSync('ybc staff query --code EMP001').toString();

    // 验证表格格式
    expect(output).toContain('code');
    expect(output).toContain('name');
    expect(output).toContain('EMP001');

    // 验证退出码
    expect(process.exitCode).toBe(0);
  });

  test('查询员工信息返回正确的JSON输出', () => {
    const output = execSync('ybc staff query --code EMP001 --json').toString();

    // 验证JSON格式
    const data = JSON.parse(output);
    expect(data.code).toBe(0);
    expect(data.data[0].code).toBe('EMP001');

    // 验证退出码
    expect(process.exitCode).toBe(0);
  });

  test('查询不存在员工返回空数据', () => {
    const output = execSync('ybc staff query --code NOT_EXIST').toString();

    expect(output).toContain('无数据');
    expect(process.exitCode).toBe(0);
  });

  test('参数错误返回退出码1', () => {
    try {
      execSync('ybc staff query');
    } catch (error) {
      expect(error.status).toBe(1);
    }
  });
});
```

---

## 6. 测试工具选型

### 6.1 测试框架

| 工具 | 用途 | 选择理由 |
|------|------|----------|
| **Jest** | 单元测试、集成测试 | 成熟稳定、TypeScript支持、Mock功能强大、覆盖率报告 |
| **ts-jest** | TypeScript测试支持 | Jest官方支持、类型安全 |
| **axios-mock-adapter** | HTTP Mock | 轻量、易用、支持拦截器 |
| **execSync** | E2E测试 | Node.js内置、CLI命令执行 |
| **Playwright** (可选) | E2E测试 | 跨平台、自动化程度高 |

### 6.2 测试辅助工具

| 工具 | 用途 |
|------|------|
| **nock** | HTTP请求Mock（替代axios-mock-adapter） |
| **sinon** | 函数Mock、Spy |
| **faker** | 测试数据生成 |
| **chance** | 随机数据生成 |
| **mockdate** | 时间Mock |

### 6.3 测试覆盖率工具

- **Jest Coverage**: 内置覆盖率统计
- **Istanbul**: 代码覆盖率工具（Jest内置）
- **Codecov**: 覆盖率报告上传服务（可选）

---

## 7. 自动化测试方案

### 7.1 CI/CD集成

#### `.github/workflows/test.yml`

```yaml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
    - uses: actions/checkout@v3

    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}

    - name: Install dependencies
      run: npm ci

    - name: Run lint
      run: npm run lint

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/lcov.info
```

### 7.2 本地自动化测试脚本

#### `scripts/test-all.sh`

```bash
#!/bin/bash

echo "开始完整测试..."

# 1. Lint检查
echo "1. 运行Lint检查..."
npm run lint

# 2. 单元测试
echo "2. 运行单元测试..."
npm run test:unit

# 3. 集成测试
echo "3. 运行集成测试..."
npm run test:integration

# 4. E2E测试
echo "4. 运行E2E测试..."
npm run test:e2e

# 5. 覆盖率报告
echo "5. 生成覆盖率报告..."
npm run test:coverage

echo "测试完成！"

# 检查覆盖率是否达标
if grep -q "All files" coverage/lcov-report/index.html; then
  echo "覆盖率达标"
else
  echo "覆盖率未达标，请检查"
  exit 1
fi
```

---

## 8. 质量验收标准

### 8.1 功能验收标准

| 功能 | 验收标准 | 验收方法 |
|------|----------|----------|
| **配置管理** | `config init/show/set`命令正常执行，配置正确保存和加载 | E2E测试 |
| **鉴权管理** | Token自动获取、刷新、缓存，401自动重试 | 集成测试 |
| **业务命令** | staff/todo/voucher命令正确执行并返回数据 | E2E测试 |
| **输出格式** | JSON/Table/CSV/RAW输出格式正确 | 单元测试+E2E测试 |
| **帮助系统** | 三级帮助、搜索、统计功能正常 | E2E测试 |
| **错误处理** | 正确退出码、友好错误提示 | 单元测试+E2E测试 |
| **环境变量** | YBC_AK/YBC_SK/YBC_FORMAT优先级正确 | 集成测试 |

### 8.2 性能验收标准

| 性能指标 | 目标值 | 测试方法 |
|----------|--------|----------|
| **CLI启动时间** | < 500ms | 启动性能测试 |
| **首次API调用** | < 2s（含Token获取） | API调用性能测试 |
| **后续API调用** | < 1s（缓存Token） | API调用性能测试 |
| **帮助命令响应** | < 100ms | 帮助性能测试 |
| **大数据量输出** | < 3s（1000行） | 大数据量输出测试 |

#### 性能测试脚本

```typescript
// tests/performance/startup.test.ts
describe('CLI启动性能测试', () => {
  test('CLI启动时间 < 500ms', async () => {
    const startTime = Date.now();
    await execAsync('ybc --help');
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(500);
  });
});

// tests/performance/api-call.test.ts
describe('API调用性能测试', () => {
  test('首次API调用 < 2s', async () => {
    // 清除Token缓存
    await tokenManager.clearCache();

    const startTime = Date.now();
    await cli.execute('staff query --code EMP001');
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(2000);
  });

  test('后续API调用 < 1s', async () => {
    // 确保Token已缓存
    await tokenManager.getValidToken();

    const startTime = Date.now();
    await cli.execute('staff query --code EMP001');
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(1000);
  });
});
```

### 8.3 测试覆盖率标准

| 覆盖率类型 | 目标覆盖率 | 验收方法 |
|----------|-----------|----------|
| **语句覆盖率** | ≥ 80% | Jest Coverage |
| **分支覆盖率** | ≥ 80% | Jest Coverage |
| **函数覆盖率** | ≥ 80% | Jest Coverage |
| **行覆盖率** | ≥ 80% | Jest Coverage |
| **核心模块覆盖率** | ≥ 90% | Jest Coverage（Service层、API层） |

### 8.4 兼容性验收标准

| 平台/版本 | 验收标准 | 测试方法 |
|----------|----------|----------|
| **Node.js 16.x** | 所有功能正常 | CI测试 |
| **Node.js 18.x** | 所有功能正常 | CI测试 |
| **Node.js 20.x** | 所有功能正常 | CI测试 |
| **Windows** | CLI命令正常执行 | 手动测试 |
| **macOS** | CLI命令正常执行 | 手动测试 |
| **Linux** | CLI命令正常执行 | CI测试 |

### 8.5 安全验收标准

| 安全项 | 验收标准 | 测试方法 |
|--------|----------|----------|
| **SK加密** | SK不在日志、配置文件中明文出现 | 安全测试 |
| **Token安全** | Token文件权限600，过期自动清除 | 安全测试 |
| **配置权限** | 配置文件权限600 | 安全测试 |
| **环境变量** | 环境变量注入不写文件 | 安全测试 |
| **参数注入** | 无命令注入漏洞 | 安全测试 |

---

## 9. 测试执行与报告

### 9.1 测试执行流程

```
每日测试:
  └─ 开发工程师提交代码前运行单元测试
  └─ Git Hook自动运行lint + 单元测试

每周测试:
  └─ 测试工程师运行集成测试
  └─ 测试工程师运行E2E测试
  └─ 生成测试报告

发布前测试:
  └─ 运行完整测试套件（单元+集成+E2E+性能+安全+兼容性）
  └─ 测试覆盖率检查
  └─ 性能基准测试
  └─ 安全审计
  └─ 兼容性验证
  └─ 回归测试
  └─ 最终验收报告
```

### 9.2 测试报告模板

#### `tests/reports/test-report-YYYYMMDD.md`

```markdown
# ybc CLI 测试报告

**测试日期**: 2026-04-25
**测试版本**: v0.1.0
**测试工程师**: XXX

## 1. 测试概述

本次测试覆盖 ybc CLI v0.1.0 的 MVP 功能。

### 测试范围
- 单元测试
- 集成测试
- E2E测试
- 性能测试

## 2. 测试结果汇总

| 测试类型 | 用例总数 | 通过数 | 失败数 | 覆盖率 |
|----------|---------|--------|--------|--------|
| 单元测试 | 50 | 48 | 2 | 85% |
| 集成测试 | 20 | 20 | 0 | 70% |
| E2E测试 | 10 | 10 | 0 | 100% |
| 性能测试 | 5 | 5 | 0 | - |

## 3. 详细测试结果

### 3.1 单元测试结果
[详细结果列表]

### 3.2 集成测试结果
[详细结果列表]

### 3.3 E2E测试结果
[详细结果列表]

### 3.4 性能测试结果
| 性能指标 | 实测值 | 目标值 | 结果 |
|----------|--------|--------|------|
| CLI启动时间 | 450ms | <500ms | ✅ |
| 首次API调用 | 1.8s | <2s | ✅ |
| 后续API调用 | 800ms | <1s | ✅ |

## 4. 缺陷列表

| 缺陷ID | 严重程度 | 描述 | 状态 |
|--------|----------|------|------|
| BUG-001 | P0 | Token刷新失败 | 已修复 |
| BUG-002 | P1 | CSV格式化错误 | 待修复 |

## 5. 测试结论

✅ **通过验收**

本次测试满足质量验收标准，覆盖率达标，性能达标，无P0缺陷遗留。

建议发布 v0.1.0 版本。

## 6. 附录

- 测试覆盖率报告: `coverage/lcov-report/index.html`
- 详细测试日志: `tests/logs/test-YYYYMMDD.log`
```

---

## 10. 测试最佳实践

### 10.1 测试编写原则

- **FIRST原则**:
  - Fast（快速）：单元测试执行时间 < 100ms
  - Independent（独立）：测试之间无依赖
  - Repeatable（可重复）：多次运行结果一致
  - Self-Validating（自验证）：自动判断通过/失败
  - Timely（及时）：与开发同步编写

- **AAA模式**:
  - Arrange（准备）：设置测试数据和环境
  - Act（执行）：执行被测试的代码
  - Assert（验证）：验证结果是否符合预期

### 10.2 Mock 使用建议

- 优先使用轻量级Mock（如axios-mock-adapter）
- Mock只Mock外部依赖，不Mock内部逻辑
- Mock数据要真实可信（使用fixtures）
- 测试完成后清理Mock状态

### 10.3 测试数据管理

- 测试数据放在 `tests/fixtures/` 目录
- 使用faker生成随机测试数据
- 避免硬编码测试数据
- 测试数据要覆盖边界情况

### 10.4 测试维护

- 定期清理无用测试
- 测试失败及时修复
- 新功能必须编写测试
- 重构时同步更新测试

---

## 附录：测试检查清单

### 单元测试检查清单

- [ ] 所有核心函数有单元测试
- [ ] 边界情况有测试覆盖
- [ ] 异常情况有测试覆盖
- [ ] Mock使用正确
- [ ] 测试覆盖率 ≥ 80%

### 集成测试检查清单

- [ ] 鉴权流程有集成测试
- [ ] 命令执行流程有集成测试
- [ ] 输出格式化有集成测试
- [ ] 错误处理有集成测试
- [ ] 环境变量注入有集成测试

### E2E测试检查清单

- [ ] 所有用户故事有E2E测试
- [ ] 完整业务流程有E2E测试
- [ ] 退出码验证正确
- [ ] 输出格式验证正确
- [ ] 错误提示验证正确

### 性能测试检查清单

- [ ] CLI启动性能测试
- [ ] API调用性能测试
- [ ] 大数据量输出性能测试
- [ ] 性能指标满足目标值

### 安全测试检查清单

- [ ] SK加密机制验证
- [ ] Token安全验证
- [ ] 配置文件权限验证
- [ ] 无命令注入漏洞

---

**文档维护**：本文档将随项目演进持续更新，所有新功能需同步补充测试用例。