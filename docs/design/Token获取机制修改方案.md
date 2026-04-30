# Token 获取机制修改方案

---

## 文档信息

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2026-04-27 | Claude Code | 基于官方文档审查，对比当前实现，提出修改方案 |

---

## 一、问题清单

### 1.1 核心差异对比表

| 问题项 | 当前实现 | 官方规范 | 影响评估 | 优先级 |
|--------|---------|---------|---------|--------|
| **多数据中心支持** | ❌ 无，URL硬编码 | ✅ 动态获取gatewayUrl和tokenUrl | 🔴 **高** - 无法支持多租户场景 | **必须修改** |
| **tenantId参数** | ❌ 完全缺失 | ✅ 必需参数 | 🔴 **高** - 无法查询数据中心 | **必须修改** |
| **API URL路径** | `/open-auth/authorize/token` (POST) | `/open-auth/selfAppAuth/base/v1/getAccessToken` (GET) | 🔴 **高** - 调用错误端点 | **必须修改** |
| **请求方法** | POST | GET | 🔴 **高** - 请求方法错误 | **必须修改** |
| **参数名称** | ak, sk | appKey, timestamp, signature | 🔴 **高** - 参数名不匹配 | **必须修改** |
| **签名算法** | AES-256-GCM加密SK | HmacSHA256签名 | 🔴 **高** - 认证机制错误 | **必须修改** |
| **时间戳参数** | ❌ 无 | ✅ 毫秒级Unix timestamp | 🔴 **高** - 签名必需参数 | **必须修改** |
| **签名计算** | ❌ 无签名流程 | ✅ 5步签名流程 | 🔴 **高** - 无法通过认证 | **必须修改** |
| **Token有效期** | ✅ expires_in处理正确 | ✅ 7200秒（2小时） | 🟢 **低** - 已正确实现 | 无需修改 |
| **提前刷新** | ✅ 5分钟前刷新 | ✅ 建议提前刷新 | 🟢 **低** - 已正确实现 | 无需修改 |
| **Token缓存** | ✅ 文件缓存 | ✅ 建议 caching | 🟢 **低** - 已正确实现 | 无需修改 |

---

### 1.2 关键问题详解

#### 问题 1: 缺少多数据中心域名查询步骤

**当前实现**：
```typescript
// src/services/auth/token-manager.ts:27-30
const BIP_API_URLS = {
  sandbox: 'https://api-di.yonyoucloud.com',
  production: 'https://api.yonyoucloud.com',
};

// token-manager.ts:125
const baseUrl = BIP_API_URLS[config.env];
```

**问题**：
- URL 硬编码，无法根据租户动态获取数据中心域名
- 不同租户可能部署在不同数据中心
- 用友 BIP 多数据中心架构要求动态域名获取

**影响**：
- ❌ 无法支持多租户场景
- ❌ 可能调用错误的数据中心
- ❌ API 调用失败

---

#### 问题 2: 缺少 tenantId 参数

**当前实现**：
- 类型定义和代码中完全缺失 tenantId

**问题**：
- 无法查询数据中心域名（必需 tenantId）
- 无法标识租户身份

**影响**：
- ❌ 步骤 1 无法执行（数据中心域名查询）
- ❌ 多租户场景完全不支持

---

#### 问题 3: API 端点路径错误

**当前实现**：
```typescript
// token-manager.ts:132
`${baseUrl}/open-auth/authorize/token`
```

**官方规范**：
```
{tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken
```

**差异**：
- ❌ 路径：`/open-auth/authorize/token` vs `/open-auth/selfAppAuth/base/v1/getAccessToken`
- ❌ 方法：POST vs GET
- ❌ 版本：旧路径 vs 新路径（2023-07-21升级）

**影响**：
- ❌ 调用错误端点，无法获取 Token
- ❌ 可能使用旧版 API（已废弃或即将废弃）

---

#### 问题 4: 参数名称和格式错误

**当前实现**：
```typescript
// token-manager.ts:133-136
{
  ak: config.ak,
  sk: encryptedSk,  // AES-256-GCM加密
}
```

**官方规范**：
```typescript
{
  appKey: "xxx",
  timestamp: 1568098531823,  // 毫秒级时间戳
  signature: "计算得出的签名",
}
```

**差异**：
- ❌ 参数名：`ak/sk` vs `appKey/timestamp/signature`
- ❌ SK处理：加密传输 vs 签名验证
- ❌ 缺少 timestamp 和 signature 参数

**影响**：
- ❌ 参数名不匹配，服务端无法识别
- ❌ 认证机制错误，无法通过验证

---

#### 问题 5: 签名算法完全错误

**当前实现**：
```typescript
// token-manager.ts:128
const encryptedSk = await this.encryption.encrypt(config.sk);

// encryption-service.ts:56-88
// AES-256-GCM 加密流程
```

**官方规范**：
```
signature = URLEncode(Base64(HmacSHA256(sortedParams, appSecret)))
```

**详细签名流程**：
1. 参数按字母序排序（signature除外）
2. 拼接：`appKey` + value + `timestamp` + value（无分隔符）
3. HmacSHA256加密（密钥为 appSecret）
4. Base64 编码（对二进制签名）
5. URLEncode 编码

**差异**：
- ❌ 加密 vs 签名
- ❌ AES-256-GCM vs HmacSHA256
- ❌ 无时间戳参与
- ❌ 无签名计算流程

**影响**：
- ❌ 认证机制完全错误
- ❌ 无法通过服务端验证
- ❌ Token 获取必定失败

---

## 二、修改方案

### 2.1 总体架构调整

**新增组件**：
```
src/
├── services/
│   ├── auth/
│   │   ├── token-manager.ts         (修改：使用新API)
│   │   ├── signature-service.ts     (新增：签名计算服务)
│   │   └── datacenter-service.ts    (新增：数据中心域名管理)
│   └── config/
│   │   └── config-service.ts        (修改：添加tenantId)
│   └── utils/
│   │   └── signature.ts             (新增：签名计算工具函数)
├── types/
│   ├── auth.ts                      (修改：添加新字段)
│   └── config.ts                    (修改：添加tenantId和appKey/appSecret)
```

---

### 2.2 详细修改步骤

#### 步骤 1: 修改类型定义

**文件**: `src/types/config.ts`

**修改内容**:
```typescript
// 修改前
export interface Config {
  ak?: string;
  sk?: string;
  env?: Environment;
  format?: OutputFormat;
  // ...
}

// 修改后
export interface Config {
  tenantId?: string;          // 新增：租户ID
  appKey?: string;            // 修改：ak → appKey
  appSecret?: string;         // 修改：sk → appSecret
  env?: Environment;
  format?: OutputFormat;
  
  // 新增：数据中心域名缓存
  dataCenter?: {
    gatewayUrl?: string;      // 业务接口域名
    tokenUrl?: string;        // Token获取域名
    lastUpdate?: string;      // 最后更新时间
  };
  // ...
}
```

---

**文件**: `src/types/auth.ts`

**修改内容**:
```typescript
// 修改前
export interface TokenConfig {
  ak: string;
  sk: string;
  env: 'sandbox' | 'production';
}

// 修改后
export interface TokenConfig {
  tenantId: string;           // 新增：租户ID
  appKey: string;             // 修改：ak → appKey
  appSecret: string;          // 修改：sk → appSecret
  env: 'sandbox' | 'production';
  
  // 新增：数据中心域名（可选，优先级高于env）
  tokenUrl?: string;          // Token获取域名
  gatewayUrl?: string;        // 业务接口域名
}

// 新增：签名计算参数
export interface SignatureParams {
  appKey: string;
  timestamp: number;          // 毫秒级时间戳
  appSecret: string;
}

// 新增：数据中心域名响应
export interface DataCenterResponse {
  code: string;
  message: string;
  data: {
    gatewayUrl: string;
    tokenUrl: string;
  };
}
```

---

#### 步骤 2: 创建数据中心域名管理服务

**新建文件**: `src/services/auth/datacenter-service.ts`

```typescript
/**
 * 数据中心域名管理服务
 * 
 * 负责查询和缓存租户所在数据中心的域名
 */

import axios from 'axios';
import { FileStorage } from '../../infrastructure/storage/file-storage';
import { DataCenterResponse, TokenConfig } from '../../types/auth';
import { AuthError, AuthErrorReason } from '../error/errors';

const DATA_CENTER_API_URL = 'https://api.yonyoucloud.com';

export class DataCenterService {
  private storage: FileStorage;
  private cacheFilePath: string;

  constructor(storage?: FileStorage) {
    this.storage = storage || new FileStorage();
    this.cacheFilePath = path.join(os.homedir(), '.ybc', 'datacenter.json');
  }

  /**
   * 获取数据中心域名
   * 
   * @param tenantId 租户ID
   * @returns 数据中心域名信息
   */
  async getDataCenterUrls(tenantId: string): Promise<{ gatewayUrl: string; tokenUrl: string }> {
    // 1. 检查缓存
    const cached = await this.loadFromCache(tenantId);
    if (cached) {
      return cached;
    }

    // 2. 调用API查询
    try {
      const response = await axios.get<DataCenterResponse>(
        `${DATA_CENTER_API_URL}/open-auth/dataCenter/getGatewayAddress`,
        {
          params: { tenantId },
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.data.code !== '00000') {
        throw new AuthError(
          AuthErrorReason.INVALID_CREDENTIALS,
          `Failed to get data center URLs: ${response.data.message}`
        );
      }

      const urls = {
        gatewayUrl: response.data.data.gatewayUrl,
        tokenUrl: response.data.data.tokenUrl,
      };

      // 3. 保存到缓存
      await this.saveToCache(tenantId, urls);

      return urls;
    } catch (error) {
      throw new AuthError(
        AuthErrorReason.TOKEN_REFRESH_FAILED,
        'Failed to query data center URLs',
        error as Error
      );
    }
  }

  /**
   * 从缓存加载数据中心域名
   */
  private async loadFromCache(tenantId: string): Promise<{ gatewayUrl: string; tokenUrl: string } | null> {
    try {
      const exists = await this.storage.exists(this.cacheFilePath);
      if (!exists) return null;

      const cache = await this.storage.read(this.cacheFilePath);
      if (cache.tenantId === tenantId && cache.urls) {
        return cache.urls;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 保存数据中心域名到缓存
   */
  private async saveToCache(tenantId: string, urls: { gatewayUrl: string; tokenUrl: string }): Promise<void> {
    try {
      await this.storage.write(this.cacheFilePath, {
        tenantId,
        urls,
        lastUpdate: new Date().toISOString(),
      }, { mode: 0o600 });
    } catch {
      // 缓存失败不影响主流程
    }
  }
}
```

---

#### 步骤 3: 创建签名计算服务

**新建文件**: `src/services/auth/signature-service.ts`

```typescript
/**
 * 签名计算服务
 * 
 * 实现用友 BIP API 的 HmacSHA256 签名算法
 */

import * as crypto from 'crypto';
import { SignatureParams } from '../../types/auth';

export class SignatureService {
  /**
   * 计算签名
   * 
   * 签名算法: URLEncode(Base64(HmacSHA256(sortedParams, appSecret)))
   * 
   * @param params 签名参数
   * @returns 签名值
   */
  calculateSignature(params: SignatureParams): string {
    // 步骤 1: 构建参数对象
    const paramMap = {
      appKey: params.appKey,
      timestamp: params.timestamp.toString(),
    };

    // 步骤 2: 按参数名字母序排序
    const sortedKeys = Object.keys(paramMap).sort(); // ['appKey', 'timestamp']

    // 步骤 3: 拼接参数名和值（无分隔符）
    let signString = '';
    for (const key of sortedKeys) {
      signString += key + paramMap[key];
    }
    // 结果: "appKey{value}timestamp{value}"

    // 步骤 4: HmacSHA256 加密（密钥为 appSecret）
    const hmac = crypto.createHmac('sha256', params.appSecret);
    hmac.update(signString, 'utf8');
    const signatureBinary = hmac.digest(); // 返回 Buffer

    // 步骤 5: Base64 编码
    const signatureBase64 = signatureBinary.toString('base64');

    // 步骤 6: URLEncode 编码
    const signatureEncoded = encodeURIComponent(signatureBase64);

    return signatureEncoded;
  }

  /**
   * 生成时间戳（毫秒级）
   */
  generateTimestamp(): number {
    return Date.now(); // JavaScript Date.now() 返回毫秒级时间戳
  }

  /**
   * 验证签名计算是否正确（用于测试）
   */
  verifySignature(params: SignatureParams, expectedSignature: string): boolean {
    const calculated = this.calculateSignature(params);
    return calculated === expectedSignature;
  }
}
```

---

#### 步骤 4: 修改 TokenManager

**文件**: `src/services/auth/token-manager.ts`

**主要修改**:

1. **导入新服务**:
```typescript
import { DataCenterService } from './datacenter-service';
import { SignatureService } from './signature-service';
```

2. **修改 BIP_API_URLS**（删除硬编码URL，使用动态域名）:
```typescript
// 删除旧的 BIP_API_URLS
// const BIP_API_URLS = { ... };

// 新增服务实例
private dataCenterService: DataCenterService;
private signatureService: SignatureService;
```

3. **修改 refreshToken 方法**:
```typescript
async refreshToken(config: TokenConfig): Promise<TokenInfo> {
  try {
    // 👉 步骤 1: 获取数据中心域名（如果未提供）
    let tokenUrl = config.tokenUrl;
    if (!tokenUrl) {
      const urls = await this.dataCenterService.getDataCenterUrls(config.tenantId);
      tokenUrl = urls.tokenUrl;
    }

    // 👉 步骤 2: 生成时间戳（毫秒级）
    const timestamp = this.signatureService.generateTimestamp();

    // 👉 步骤 3: 计算签名
    const signature = this.signatureService.calculateSignature({
      appKey: config.appKey,
      timestamp,
      appSecret: config.appSecret,
    });

    // 👉 步骤 4: 构建请求URL（GET方法）
    const requestUrl = `${tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken`;

    // 👉 步骤 5: 发送GET请求
    const response = await this.httpClient.get<BipTokenResponse>(
      requestUrl,
      {
        params: {
          appKey: config.appKey,
          timestamp,
          signature,
        },
        headers: {
          'Content-Type': 'application/json', // 即使GET也需要此Header
        },
      }
    );

    // 👉 步骤 6: 解析响应（与之前相同）
    const data = response.data;
    const expiresAt = Date.now() + data.expire * 1000; // 注意：字段名可能为 expire 或 expires_in

    const tokenInfo: TokenInfo = {
      access_token: data.access_token,
      expires_in: data.expire || data.expires_in,
      expires_at: expiresAt,
      token_type: 'Bearer',
    };

    return tokenInfo;
  } catch (error) {
    // 错误处理（与之前相同）
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data;

      if (errorData?.code !== '00000' || error.response.status === 401) {
        throw new AuthError(
          AuthErrorReason.INVALID_CREDENTIALS,
          'Invalid appKey/appSecret credentials',
          error
        );
      }

      throw new AuthError(
        AuthErrorReason.TOKEN_REFRESH_FAILED,
        `Failed to refresh token: ${errorData?.message || error.message}`,
        error
      );
    }

    throw new AuthError(
      AuthErrorReason.TOKEN_REFRESH_FAILED,
      'Failed to refresh token due to network error',
      error as Error
    );
  }
}
```

---

#### 步骤 5: 修改 ConfigService

**文件**: `src/services/config/config-service.ts`

**主要修改**:

1. **添加 tenantId 字段处理**:
```typescript
async init(config: Partial<Config>): Promise<void> {
  // 验证必需字段（修改）
  if (!config.tenantId) {
    throw new ValidationError('Tenant ID (tenantId) is required', {
      field: 'tenantId',
    });
  }

  if (!config.appKey) {
    throw new ValidationError('App Key (appKey) is required', {
      field: 'appKey',
    });
  }

  if (!config.appSecret) {
    throw new ValidationError('App Secret (appSecret) is required', {
      field: 'appSecret',
    });
  }

  // 验证 tenantId 格式
  this.validateTenantId(config.tenantId);

  // 验证 appKey 格式
  this.validateAppKey(config.appKey);

  // 验证 appSecret 格式
  this.validateAppSecret(config.appSecret);

  // 加密 appSecret（与之前加密sk相同）
  const encryptedSecret = await this.encryption.encrypt(config.appSecret);

  // 创建配置对象（修改字段名）
  const fullConfig: Config = {
    tenantId: config.tenantId,
    appKey: config.appKey,
    appSecret: encryptedSecret,
    env: config.env || 'sandbox',
    format: config.format || 'table',
    version: '2.0', // 版本升级
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 保存配置
  await this.storage.write(this.configFilePath, fullConfig, {
    mode: 0o600,
  });
}
```

2. **添加验证方法**:
```typescript
private validateTenantId(tenantId: string): void {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new ValidationError('Tenant ID cannot be empty', {
      field: 'tenantId',
      value: tenantId,
    });
  }
}

private validateAppKey(appKey: string): void {
  if (!appKey || appKey.trim().length === 0) {
    throw new ValidationError('App Key cannot be empty', {
      field: 'appKey',
      value: appKey,
    });
  }

  // appKey 通常是32-64字符
  if (appKey.length < 16 || appKey.length > 128) {
    throw new ValidationError('App Key must be between 16 and 128 characters', {
      field: 'appKey',
      value: appKey,
    });
  }
}

private validateAppSecret(appSecret: string): void {
  if (!appSecret || appSecret.trim().length === 0) {
    throw new ValidationError('App Secret cannot be empty', {
      field: 'appSecret',
      value: appSecret,
    });
  }

  if (appSecret.length < 16 || appSecret.length > 256) {
    throw new ValidationError('App Secret must be between 16 and 256 characters', {
      field: 'appSecret',
      value: appSecret,
    });
  }
}
```

---

#### 步骤 6: 修改 CLI 命令

**文件**: `src/cli/commands/config/init.ts`

**修改交互式提示**:
```typescript
// 修改前
prompts.push({
  type: 'input',
  name: 'ak',
  message: '请输入 Access Key (AK):',
});

prompts.push({
  type: 'password',
  name: 'sk',
  message: '请输入 Secret Key (SK):',
});

// 修改后
prompts.push({
  type: 'input',
  name: 'tenantId',
  message: '请输入租户ID (Tenant ID):',
  validate: (input) => input.trim().length > 0 || '租户ID不能为空',
});

prompts.push({
  type: 'input',
  name: 'appKey',
  message: '请输入 App Key:',
  validate: (input) => input.length >= 16 || 'App Key长度至少16字符',
});

prompts.push({
  type: 'password',
  name: 'appSecret',
  message: '请输入 App Secret:',
  validate: (input) => input.length >= 16 || 'App Secret长度至少16字符',
});
```

---

### 2.3 配置文件格式变更

**旧格式** (`~/.ybc/config.json`):
```json
{
  "ak": "YOUR_ACCESS_KEY",
  "sk": "ENCRYPTED_SECRET_KEY",
  "env": "sandbox",
  "format": "table"
}
```

**新格式**:
```json
{
  "tenantId": "your-tenant-id",
  "appKey": "YOUR_APP_KEY",
  "appSecret": "ENCRYPTED_APP_SECRET",
  "env": "sandbox",
  "format": "table",
  "dataCenter": {
    "gatewayUrl": "https://yonbip.diwork.com/iuap-api-gateway",
    "tokenUrl": "https://yonbip.diwork.com/iuap-api-auth",
    "lastUpdate": "2026-04-27T10:00:00Z"
  },
  "version": "2.0"
}
```

---

## 三、实施顺序建议

### 3.1 分阶段实施

**阶段 1: 核心功能（必须）**
1. ✅ 创建类型定义修改（types）
2. ✅ 创建签名计算服务（SignatureService）
3. ✅ 创建数据中心域名管理服务（DataCenterService）
4. ✅ 修改 TokenManager（使用新API和签名）
5. ✅ 修改 ConfigService（添加tenantId和字段改名）

**阶段 2: CLI适配（必须）**
1. ✅ 修改 config init 命令（交互式提示）
2. ✅ 修改 config show 命令（显示新字段）
3. ✅ 修改 config set 命令（支持新字段）
4. ✅ 添加环境变量支持（YBC_TENANT_ID）

**阶段 3: 测试验证（必须）**
1. ✅ 编写签名计算单元测试
2. ✅ 编写数据中心域名查询测试
3. ✅ 编写 Token 获取集成测试
4. ✅ 测试真实 API（如果有真实凭证）

**阶段 4: 文档更新（建议）**
1. ✅ 更新 CLAUDE.md（反映新机制）
2. ✅ 更新本地使用指南
3. ✅ 添加迁移指南（从旧版升级）
4. ✅ 更新架构设计文档

---

### 3.2 文件修改清单

| 文件 | 操作 | 优先级 |
|------|------|--------|
| `src/types/config.ts` | 修改 | 必须 |
| `src/types/auth.ts` | 修改 | 必须 |
| `src/services/auth/datacenter-service.ts` | 新建 | 必须 |
| `src/services/auth/signature-service.ts` | 新建 | 必须 |
| `src/services/auth/token-manager.ts` | 修改 | 必须 |
| `src/services/config/config-service.ts` | 修改 | 必须 |
| `src/cli/commands/config/init.ts` | 修改 | 必须 |
| `src/cli/commands/config/show.ts` | 修改 | 必须 |
| `src/cli/commands/config/set.ts` | 修改 | 必须 |
| `src/infrastructure/env/env-service.ts` | 修改 | 建议 |
| `tests/unit/services/auth/signature-service.test.ts` | 新建 | 必须 |
| `tests/unit/services/auth/datacenter-service.test.ts` | 新建 | 必须 |
| `tests/integration/auth/token-flow.test.ts` | 修改 | 必须 |
| `docs/迁移指南.md` | 新建 | 建议 |

---

## 四、影响范围评估

### 4.1 破坏性变更

**配置文件格式变更**:
- 🔴 **不兼容** - 旧配置文件无法直接使用
- 💡 **缓解措施**: 提供迁移脚本或版本检测+自动转换

**参数名称变更**:
- 🔴 **不兼容** - `ak/sk` → `appKey/appSecret`
- 💡 **缓解措施**: CLI 交互式引导，环境变量改名

**API 调用流程变更**:
- 🔴 **新增步骤** - 需要先查询数据中心域名
- 💡 **缓解措施**: 自动缓存，无需用户干预

---

### 4.2 向后兼容方案

**方案 1: 版本检测**
```typescript
// ConfigService.getConfig()
const config = await this.storage.read(this.configFilePath);

if (config.version === '1.0') {
  // 旧版本配置，提示用户升级
  console.log('检测到旧版本配置，请运行: ybc config migrate');
  return this.migrateConfig(config);
}

if (config.version === '2.0') {
  // 新版本配置，正常使用
  return config;
}
```

**方案 2: 字段兼容**
```typescript
// 支持两种字段名（过渡期）
const appKey = config.appKey || config.ak; // 优先新字段
const appSecret = config.appSecret || config.sk;
```

**建议**: 采用方案 2，同时支持新旧字段名，并提示用户迁移。

---

## 五、风险提示

### 5.1 高风险项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **签名计算错误** | 无法获取Token，功能完全失效 | 1. 严格按官方文档实现<br>2. 编写详细测试<br>3. 对照官方示例验证 |
| **时间戳精度错误** | 签名验证失败 | 使用 `Date.now()`（毫秒级） |
| **参数排序错误** | 签名验证失败 | 使用 `Object.keys().sort()` |
| **URL编码错误** | Token使用失败 | 调用业务接口时对token进行encodeURIComponent |
| **数据中心域名查询失败** | 无法获取Token | 1. 错误处理<br>2. 提示用户检查tenantId |

---

### 5.2 测试重点

**签名计算测试**（最重要）:
```typescript
describe('SignatureService', () => {
  it('should calculate signature correctly', () => {
    const service = new SignatureService();
    
    // 使用官方文档示例验证
    const params = {
      appKey: '41832a3d2df94989b500da6a22268747',
      timestamp: 1568098531823,
      appSecret: 'your-app-secret',
    };
    
    const signature = service.calculateSignature(params);
    
    // 验证签名格式正确
    expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64格式
    
    // 验证拼接字符串
    const expectedString = 'appKey41832a3d2df94989b500da6a22268747timestamp1568098531823';
    // ...
  });
});
```

**Token 获取测试**:
```typescript
describe('TokenManager (New)', () => {
  it('should get token using new API', async () => {
    // Mock 数据中心域名API
    mockAxios.onGet(/getGatewayAddress/).reply(200, {
      code: '00000',
      message: '成功！',
      data: {
        gatewayUrl: 'https://yonbip.diwork.com/iuap-api-gateway',
        tokenUrl: 'https://yonbip.diwork.com/iuap-api-auth',
      },
    });
    
    // Mock Token API
    mockAxios.onGet(/getAccessToken/).reply(200, {
      code: '00000',
      message: '成功！',
      data: {
        access_token: 'test-token',
        expire: 7200,
      },
    });
    
    const token = await tokenManager.getValidToken({
      tenantId: 'test-tenant',
      appKey: 'test-appkey',
      appSecret: 'test-secret',
      env: 'sandbox',
    });
    
    expect(token).toBe('test-token');
  });
});
```

---

## 六、下一步行动

### 6.1 立即执行（Phase 1）

1. **确认修改方案**（当前步骤）
   - ✅ 审查文档
   - ✅ 提出修改方案（本文档）

2. **实施核心修改**（下一个步骤）
   - 📝 创建 SignatureService
   - 📝 创建 DataCenterService
   - 📝 修改 TokenManager
   - 📝 修改类型定义
   - 📝 修改 ConfigService

3. **编写测试**
   - 📝 签名计算单元测试
   - 📝 数据中心域名查询测试
   - 📝 Token获取集成测试

---

### 6.2 验证与调试（Phase 2）

1. **本地测试**
   - 运行所有单元测试
   - 运行集成测试
   - 验证签名计算正确性

2. **真实API测试**（如果有凭证）
   - 测试数据中心域名查询
   - 测试 Token 获取
   - 测试业务接口调用

3. **CLI测试**
   - 测试 config init
   - 测试 config show
   - 测试业务命令

---

### 6.3 文档与发布（Phase 3）

1. **更新文档**
   - 迁移指南
   - API文档
   - 使用指南

2. **向后兼容处理**
   - 版本检测
   - 字段兼容
   - 迁移脚本

3. **发布**
   - 更新 CHANGELOG
   - 发布新版本

---

## 七、总结

### 核心差异

当前实现与官方规范存在**重大差异**，主要集中在：

1. 🔴 **缺少多数据中心支持**（关键）
2. 🔴 **API端点和请求方法错误**
3. 🔴 **参数名称和签名算法完全错误**
4. 🔴 **缺少 tenantId 参数**

### 修改优先级

**必须修改**（影响功能）:
- ✅ 签名算法实现
- ✅ 数据中心域名查询
- ✅ API端点和参数修改
- ✅ tenantId 支持

**建议修改**（提升质量）:
- ✅ 向后兼容处理
- ✅ 文档更新
- ✅ 迁移指南

### 预期结果

修改完成后：
- ✅ 符合官方 API 规范
- ✅ 支持多数据中心架构
- ✅ 签名认证正确
- ✅ Token 获取流程完整
- ✅ 多租户场景支持

---

**建议立即开始实施核心修改，编写测试验证，确保功能正确性。**