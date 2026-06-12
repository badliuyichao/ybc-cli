# 用友BIP CLI（ybc）安全方案

---

## 文档信息

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-04-25 | 安全专家 | 初稿，基于需求与产品设计文档 |

**适用范围**：`ybc` CLI 工具的安全设计、加密策略、密钥管理、安全审计。
**目标读者**：安全工程师、开发工程师、架构师。

---

## 1. 安全目标与原则

### 1.1 安全目标

确保 `ybc` CLI 工具满足以下安全目标:

- ✅ **凭证安全**: AK/SK 不明文存储、不泄露到日志、不暴露给用户
- ✅ **Token安全**: Token 加密存储、自动过期、权限控制
- ✅ **传输安全**: HTTPS 强制、证书校验、防止中间人攻击
- ✅ **参数安全**: 参数严格校验、防止注入攻击
- ✅ **审计安全**: 操作日志记录、异常检测、安全审计
- ✅ **恢复安全**: 错误恢复不泄露敏感信息

### 1.2 安全原则

- **最小权限原则**: 仅授予必需的权限
- **防御深度原则**: 多层防御，不依赖单一措施
- **默认安全原则**: 默认配置为最安全状态
- **失败安全原则**: 失败时进入安全状态，不泄露信息
- **审计可追溯原则**: 所有操作可追溯审计

---

## 2. 加密策略

### 2.1 SK 加密方案

#### 方案对比

| 方案 | 安全等级 | 实现复杂度 | 适用场景 | 结论 |
|------|----------|-----------|----------|------|
| **方案1: 系统密钥链** | 最高 | 中 | macOS/Windows/Linux | ✅ 推荐（优先级1） |
| **方案2: 文件加密** | 高 | 低 | 所有平台 | ✅ 采用（优先级2） |
| **方案3: 环境变量** | 中 | 低 | CI/CD环境 | ✅ 采用（优先级3） |
| **方案4: 明文存储** | 极低 | 低 | - | ❌ 禁止 |

#### 方案1: 系统密钥链集成（推荐）

**实现方式**:
- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service (如 GNOME Keyring)

**技术方案**:
使用 `keytar` 库访问系统密钥链:

```typescript
import keytar from 'keytar';

const SERVICE_NAME = 'ybc-cli';
const ACCOUNT_NAME = 'secret-key';

// 加密存储 SK
async function saveSK(sk: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, sk);
}

// 解密读取 SK
async function loadSK(): Promise<string | null> {
  const sk = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  return sk;
}

// 删除 SK
async function deleteSK(): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}
```

**优势**:
- 系统级加密，安全性最高
- 自动权限控制
- 跨应用共享（可选）
- 用户友好（系统管理）

**劣势**:
- 需要编译原生模块
- Linux 需要安装 Secret Service
- CI 环境不支持

**适用场景**: 正式版本（v1.0.0），桌面环境

---

#### 方案2: 文件加密（MVP采用）

**加密算法**: AES-256-GCM

**密钥派生**:
- 从机器特征派生（如 MAC 地址、用户名、主机名）
- 或从用户密码派生（PBKDF2）

**技术方案**:

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;

// 密钥派生（从机器特征）
function deriveKey(machineId: string): Buffer {
  const salt = crypto.createHash('sha256').update(machineId).digest();
  const key = crypto.pbkdf2Sync(machineId, salt, 100000, 32, 'sha256');
  return key;
}

// 获取机器ID
function getMachineId(): string {
  const hostname = require('os').hostname();
  const username = require('os').userInfo().username;
  const platform = require('os').platform();
  return `${hostname}-${username}-${platform}`;
}

// 加密 SK
function encryptSK(sk: string): string {
  const machineId = getMachineId();
  const key = deriveKey(machineId);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(sk, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // 组合: iv + authTag + encrypted
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
  return combined.toString('base64');
}

// 解密 SK
function decryptSK(encryptedData: string): string {
  const machineId = getMachineId();
  const key = deriveKey(machineId);

  const combined = Buffer.from(encryptedData, 'base64');

  // 解析: iv + authTag + encrypted
  const iv = combined.slice(0, IV_LENGTH);
  const authTag = combined.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.slice(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, null, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// 验证示例
const sk = 'test-secret-key-12345';
const encrypted = encryptSK(sk);
console.log('加密后:', encrypted);

const decrypted = decryptSK(encrypted);
console.log('解密后:', decrypted);
assert(decrypted === sk, '加密解密验证失败');
```

**存储格式**:

```json
// ~/.ybc/config.json
{
  "ak": "test-access-key",
  "sk_encrypted": "base64-encrypted-string...",
  "env": "sandbox",
  "encryption_version": "v1"
}
```

**优势**:
- 纯 JavaScript 实现，无需原生模块
- 跨平台兼容
- CI 环境可用

**劣势**:
- 密钥派生依赖机器特征（换机器需重新配置）
- 安全性略低于系统密钥链

**适用场景**: MVP版本（v0.1.0），所有环境

---

#### 方案3: 环境变量注入（CI环境）

**实现方式**:
- 环境变量 `YBC_AK` / `YBC_SK`
- 不写入任何文件

**优先级**:
环境变量优先级 > 配置文件

```typescript
function getCredentials(): { ak: string; sk: string } {
  // 优先级1: 环境变量
  if (process.env.YBC_AK && process.env.YBC_SK) {
    return {
      ak: process.env.YBC_AK,
      sk: process.env.YBC_SK,
    };
  }

  // 优先级2: 配置文件（加密）
  const config = loadConfig();
  const sk = decryptSK(config.sk_encrypted);

  return {
    ak: config.ak,
    sk,
  };
}
```

**优势**:
- 最高安全性（不写文件）
- CI/CD友好
- 无密钥管理复杂度

**劣势**:
- 需每次设置环境变量
-不适合交互式使用

**适用场景**: CI/CD环境、自动化脚本

---

### 2.2 Token 加密方案

#### Token 存储

```json
// ~/.ybc/token.json (权限 600)
{
  "access_token": "encrypted-base64-string...",
  "expires_at": 9999999999999,
  "token_type": "Bearer",
  "encryption_version": "v1"
}
```

#### Token 加密实现

```typescript
// Token 加密（与 SK 加密相同方案）
function encryptToken(token: string): string {
  return encryptSK(token); // 使用相同的加密算法
}

function decryptToken(encryptedToken: string): string {
  return decryptSK(encryptedToken);
}
```

#### Token 过期清除

```typescript
// 检查 Token 是否过期
function isTokenExpired(tokenInfo: TokenInfo): boolean {
  return Date.now() >= tokenInfo.expires_at;
}

// 过期自动清除
async function clearExpiredToken(): Promise<void> {
  const tokenInfo = await loadTokenInfo();

  if (isTokenExpired(tokenInfo)) {
    await deleteTokenFile();
    logger.info('Token已过期，已自动清除');
  }
}
```

---

### 2.3 传输加密

#### HTTPS 强制

```typescript
import axios from 'axios';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: getBaseUrl(),
  timeout: 5000,
  httpsAgent: new https.Agent({
    rejectUnauthorized: true, // 强制证书校验
    minVersion: 'TLSv1.2', // 最低 TLS 版本
  }),
});

// 禁止 HTTP
if (baseURL.startsWith('http://')) {
  throw new Error('不支持 HTTP，请使用 HTTPS');
}
```

#### 证书校验

```typescript
// 禁用不安全的证书校验
const httpsAgent = new https.Agent({
  rejectUnauthorized: true, // 强制校验证书
  checkServerIdentity: (host, cert) => {
    // 自定义证书校验逻辑
    // 检查证书有效期、域名匹配等
    return undefined; // 返回 undefined 表示校验通过
  },
});
```

---

## 3. 密钥管理流程

### 3.1 密钥生成流程

```
密钥来源:
  ├─ 系统密钥链（方案1）
  ├─ 机器特征派生（方案2）
  └─ 用户密码派生（可选）

密钥生成流程:
  1. 检测运行环境
     ├─ 支持系统密钥链？→ 使用 keytar
     └─ 不支持？→ 使用机器特征派生

  2. 生成加密密钥
     ├─ 机器特征: hostname + username + platform
     ├─ SHA256 哈希
     └─ PBKDF2 派生（100000轮，32字节）

  3. 加密密钥存储
     ├─ 密钥本身不存储
     └─ 仅存储派生参数（可选）

  4. 密钥验证
     └─ 加密解密测试
```

### 3.2 密钥轮换流程

```
密钥轮换触发:
  ├─ 定期轮换（可选，每90天）
  ├─ 安全事件触发
  └─ 用户主动轮换

密钥轮换流程:
  1. 生成新密钥
     └─ 更新机器特征或用户密码

  2. 解密旧数据
     └─ 使用旧密钥解密 SK、Token

  3. 加密新数据
     └─ 使用新密钥重新加密

  4. 保存新数据
     └─ 更新配置文件

  5. 清除旧数据
     └─ 删除旧的加密数据

密钥轮换命令:
  ybc config rotate-key
```

### 3.3 密钥销毁流程

```
密钥销毁触发:
  ├─ 用户主动清除（ybc config clear）
  ├─ Token过期自动清除
  └─ 安全事件触发

密钥销毁流程:
  1. 删除配置文件
     └─ rm ~/.ybc/config.json

  2. 删除 Token 文件
     └─ rm ~/.ybc/token.json

  3. 删除系统密钥链（方案1）
     └─ keytar.deletePassword()

  4. 清除环境变量（方案3）
     └─ unset YBC_AK YBC_SK

  5. 清除日志缓存
     └─ rm ~/.ybc/logs/*

密钥销毁命令:
  ybc config clear
```

---

## 4. Token 安全方案

### 4.1 Token 生命周期管理

```
Token 生命周期:
  ├─ 获取（/token API）
  ├─ 存储（加密文件，权限600）
  ├─ 使用（Authorization Header）
  ├─ 刷新（过期前5分钟）
  ├─ 过期（自动清除）
  └─ 销毁（用户主动清除）

Token 有效期:
  ├─ 标准有效期: 2小时
  ├─ 提前续期: 过期前5分钟
  └─ 最大缓存: 24小时（强制刷新）

Token 刷新策略:
  ├─ 后台异步刷新（过期前5分钟）
  ├─ 401触发刷新（立即刷新）
  └─ 手动刷新（ybc login）
```

### 4.2 Token 存储安全

#### 文件权限控制

```typescript
import fs from 'fs';
import path from 'path';

const TOKEN_FILE = path.join(process.env.HOME, '.ybc', 'token.json');

// 保存 Token（权限 600）
async function saveToken(tokenInfo: TokenInfo): Promise<void> {
  const encryptedToken = encryptToken(tokenInfo.access_token);

  const data = {
    access_token: encryptedToken,
    expires_at: tokenInfo.expires_at,
    token_type: tokenInfo.token_type,
    encryption_version: 'v1',
  };

  // 写入文件
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), {
    mode: 0o600, // 仅用户可读写
  });

  // 验证权限
  const stats = fs.statSync(TOKEN_FILE);
  if (stats.mode !== 0o600) {
    fs.chmodSync(TOKEN_FILE, 0o600);
  }
}
```

#### Token 脱敏显示

```typescript
// Token 显示时脱敏
function obfuscateToken(token: string): string {
  if (token.length <= 10) {
    return '***';
  }

  // 仅显示前10位和后4位
  const prefix = token.substring(0, 10);
  const suffix = token.substring(token.length - 4);
  return `${prefix}***${suffix}`;
}

// 示例: "abc123def456ghi789jkl012" → "abc123def4***012"
```

---

## 5. 安全审计机制

### 5.1 操作日志记录

#### 日志内容

```typescript
interface AuditLog {
  timestamp: string;          // ISO 8601格式
  action: string;             // 操作类型
  command?: string;           // 执行的命令
  params?: Record<string, any>; // 参数（脱敏）
  result: 'success' | 'failure'; // 结果
  errorMessage?: string;      // 错误信息（脱敏）
  exitCode?: number;          // 退出码
  duration?: number;          // 执行时长（ms）
  ip?: string;                // IP地址（可选）
}
```

#### 日志实现

```typescript
import fs from 'fs';
import path from 'path';

const AUDIT_LOG_FILE = path.join(process.env.HOME, '.ybc', 'audit.log');

// 记录审计日志
function logAudit(log: AuditLog): void {
  // 脱敏处理
  const sanitizedLog = sanitizeLog(log);

  // 写入日志文件
  const logLine = JSON.stringify(sanitizedLog) + '\n';
  fs.appendFileSync(AUDIT_LOG_FILE, logLine, {
    mode: 0o600,
  });
}

// 脱敏处理
function sanitizeLog(log: AuditLog): AuditLog {
  const sanitized = { ...log };

  // 脱敏 SK、Token
  if (sanitized.params) {
    if (sanitized.params.sk) {
      sanitized.params.sk = obfuscateSK(sanitized.params.sk);
    }
    if (sanitized.params.token) {
      sanitized.params.token = obfuscateToken(sanitized.params.token);
    }
  }

  // 脱敏错误信息中的敏感信息
  if (sanitized.errorMessage) {
    sanitized.errorMessage = sanitizeErrorMessage(sanitized.errorMessage);
  }

  return sanitized;
}

// 示例日志
{
  "timestamp": "2026-04-25T10:00:00Z",
  "action": "api_call",
  "command": "staff query --code EMP001",
  "params": { "code": "EMP001" },
  "result": "success",
  "exitCode": 0,
  "duration": 1200
}
```

#### 日志查询命令

```bash
# 查看最近的审计日志
ybc audit logs --limit 100

# 查看特定时间段的日志
ybc audit logs --from 2026-04-01 --to 2026-04-25

# 查看失败的操作
ybc audit logs --status failure

# 清除审计日志
ybc audit clear
```

---

### 5.2 异常检测机制

#### 异常行为检测

```typescript
// 检测异常登录
function detectAbnormalLogin(logs: AuditLog[]): boolean {
  // 检测短时间内大量鉴权失败
  const recentFailures = logs.filter(
    (log) =>
      log.action === 'auth' &&
      log.result === 'failure' &&
      Date.now() - new Date(log.timestamp).getTime() < 3600000 // 1小时内
  );

  if (recentFailures.length > 10) {
    logger.warn('检测到异常鉴权失败，可能存在攻击');
    return true;
  }

  return false;
}

// 检测异常API调用
function detectAbnormalApiCalls(logs: AuditLog[]): boolean {
  // 检测短时间内大量API调用
  const recentCalls = logs.filter(
    (log) =>
      log.action === 'api_call' &&
      Date.now() - new Date(log.timestamp).getTime() < 60000 // 1分钟内
  );

  if (recentCalls.length > 100) {
    logger.warn('检测到异常API调用频率，可能存在滥用');
    return true;
  }

  return false;
}
```

---

### 5.3 安全审计报告

#### 审计报告内容

```markdown
# ybc 安全审计报告

**审计时间**: 2026-04-25
**审计范围**: 2026-04-01 ~ 2026-04-25

## 1. 操作统计

- 总操作数: 500
- 成功操作: 480
- 失败操作: 20
- 鉴权失败: 5
- API调用失败: 15

## 2. 异常检测

- 异常鉴权失败: 0
- 异常API调用: 0
- 参数注入尝试: 0

## 3. 安全事件

- 无安全事件

## 4. 建议

- 定期清理审计日志（保留30天）
- 监控鉴权失败频率
- 启用异常检测告警
```

#### 审计报告命令

```bash
# 生成审计报告
ybc audit report --from 2026-04-01 --to 2026-04-25

# 审计报告输出到文件
ybc audit report --output audit-report-2026-04.md
```

---

## 6. 安全风险分析

### 6.1 威胁建模

#### STRIDE 威胁分类

| 威胁类型 | 威胁描述 | 风险等级 | 缓解措施 |
|----------|----------|----------|----------|
| **Spoofing（欺骗）** | AK/SK被盗用，伪造身份 | 高 | SK加密存储、环境变量注入、多因素认证（可选） |
| **Tampering（篡改）** | 配置文件被篡改 | 中 | 文件权限600、签名验证（可选） |
| **Repudiation（否认）** | 操作不可追溯 | 中 | 操作日志记录、审计机制 |
| **Information Disclosure（信息泄露）** | SK/Token泄露到日志 | 高 | 脱敏显示、日志过滤 |
| **Denial of Service（拒绝服务）** | API限流导致不可用 | 低 | 限流提示、重试机制 |
| **Elevation of Privilege（权限提升）** | 命令注入执行恶意操作 | 中 | 参数严格校验、禁用动态代码 |

### 6.2 安全风险矩阵

| 风险 | 概率 | 影响 | 风险等级 | 缓解措施 |
|------|------|------|----------|----------|
| **SK泄露** | 低 | 极高 | 高 | 加密存储、环境变量、日志过滤 |
| **Token泄露** | 低 | 高 | 中 | 加密存储、过期清除、权限600 |
| **中间人攻击** | 极低 | 高 | 中 | HTTPS强制、证书校验 |
| **命令注入** | 低 | 中 | 中 | 参数校验、禁用eval |
| **配置篡改** | 中 | 中 | 中 | 文件权限600、配置验证 |
| **API滥用** | 中 | 低 | 低 | 限流提示、审计监控 |

---

## 7. 安全编码规范

### 7.1 禁止事项

```typescript
// ❌ 禁止：SK 明文存储
const config = { ak: 'xxx', sk: 'yyy' }; // SK明文

// ✅ 正确：SK 加密存储
const config = { ak: 'xxx', sk_encrypted: encryptSK('yyy') };

// ❌ 禁止：SK 打印到日志
console.log('SK:', sk);

// ✅ 正确：SK 脱敏打印
console.log('SK:', obfuscateSK(sk));

// ❌ 禁止：动态代码执行
eval(userInput);
new Function(userInput);

// ✅ 正确：禁用动态代码

// ❌ 禁止：不安全的 HTTP
const baseURL = 'http://api.example.com';

// ✅ 正确：HTTPS
const baseURL = 'https://api.example.com';

// ❌ 禁止：证书校验禁用
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// ✅ 正确：强制证书校验
const httpsAgent = new https.Agent({ rejectUnauthorized: true });
```

### 7.2 安全编码检查清单

- [ ] SK 不明文存储
- [ ] SK 不打印到日志
- [ ] SK 不出现在错误信息中
- [ ] Token 文件权限 600
- [ ] 配置文件权限 600
- [ ] HTTPS 强制
- [ ] 证书校验启用
- [ ] 参数严格校验（无注入）
- [ ] 禁用 eval 和动态代码
- [ ] 错误信息脱敏
- [ ] 操作日志记录
- [ ] 异常检测启用

---

## 8. 安全测试方案

### 8.1 安全测试清单

| 测试项 | 测试内容 | 测试方法 | 预期结果 |
|--------|----------|----------|----------|
| **SK加密验证** | SK不在配置文件明文出现 | 检查配置文件 | SK为加密字符串 |
| **SK日志验证** | SK不在日志明文出现 | 检查日志文件 | SK脱敏显示 |
| **SK环境变量验证** | 环境变量注入不写文件 | 环境变量测试 | 配置文件不存在 |
| **Token权限验证** | Token文件权限600 | 检查文件权限 | 权限600 |
| **配置权限验证** | 配置文件权限600 | 检查文件权限 | 权限600 |
| **HTTPS强制** | HTTP请求被拒绝 | 尝试HTTP请求 | 报错拒绝 |
| **证书校验** | 伪造证书被拒绝 | 尝试伪造证书 | 报错拒绝 |
| **参数注入测试** | 命令注入失败 | 尝试注入攻击 | 参数校验失败 |
| **错误信息脱敏** | 错误信息不含敏感信息 | 触发错误 | 信息脱敏 |
| **操作日志记录** | 操作被记录到审计日志 | 执行命令 | 日志存在 |
| **异常检测** | 异常行为被检测 | 模拟异常 | 告警触发 |

### 8.2 安全测试用例

#### `tests/security/sk-encryption.test.ts`

```typescript
describe('SK加密安全测试', () => {
  test('SK不在配置文件明文出现', async () => {
    await configManager.save({ ak: 'test-ak', sk: 'test-sk' });

    const configFile = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(configFile);

    expect(config.sk).toBeUndefined();
    expect(config.sk_encrypted).toBeDefined();
    expect(config.sk_encrypted).not.toBe('test-sk');
  });

  test('SK不在日志明文出现', async () => {
    const sk = 'test-secret-key-12345';
    logger.info('配置完成，SK:', sk);

    const logFile = fs.readFileSync(LOG_FILE, 'utf8');
    expect(logFile).not.toContain('test-secret-key-12345');
    expect(logFile).toContain('***45'); // 脱敏显示
  });

  test('SK加密解密一致性', async () => {
    const sk = 'my-secret-key';
    const encrypted = encryptSK(sk);
    const decrypted = decryptSK(encrypted);

    expect(decrypted).toBe(sk);
  });
});
```

#### `tests/security/token-security.test.ts`

```typescript
describe('Token安全测试', () => {
  test('Token文件权限600', async () => {
    await tokenManager.saveToken({
      access_token: 'test-token',
      expires_at: Date.now() + 3600000,
    });

    const stats = fs.statSync(TOKEN_FILE);
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test('Token过期自动清除', async () => {
    await tokenManager.saveToken({
      access_token: 'test-token',
      expires_at: Date.now() - 1000, // 已过期
    });

    await tokenManager.clearExpiredToken();

    expect(fs.existsSync(TOKEN_FILE)).toBe(false);
  });

  test('Token脱敏显示', async () => {
    const token = 'abc123def456ghi789jkl012';
    const obfuscated = obfuscateToken(token);

    expect(obfuscated).toBe('abc123def4***012');
    expect(obfuscated).not.toContain('ghi789');
  });
});
```

#### `tests/security/https-enforcement.test.ts`

```typescript
describe('HTTPS强制测试', () => {
  test('HTTP请求被拒绝', async () => {
    const baseURL = 'http://openapi.yonyoucloud.com';

    expect(() => {
      createApiClient(baseURL);
    }).toThrow('不支持 HTTP，请使用 HTTPS');
  });

  test('证书校验启用', async () => {
    const apiClient = createApiClient('https://openapi.yonyoucloud.com');

    // 尝试伪造证书（模拟）
    // 应被拒绝
    await expect(
      apiClient.get('/test', { httpsAgent: fakeAgent })
    ).rejects.toThrow();
  });
});
```

#### `tests/security/parameter-injection.test.ts`

```typescript
describe('参数注入安全测试', () => {
  test('命令注入被拒绝', async () => {
    const maliciousInput = 'EMP001; rm -rf /';

    await expect(
      cli.execute(`staff query --code "${maliciousInput}"`)
    ).rejects.toThrow('参数不合法');
  });

  test('特殊字符被拒绝', async () => {
    const maliciousInput = 'EMP001$(whoami)';

    await expect(
      cli.execute(`staff query --code "${maliciousInput}"`)
    ).rejects.toThrow('参数不合法');
  });

  test('正常参数通过', async () => {
    const normalInput = 'EMP001';

    const result = await cli.execute(`staff query --code "${normalInput}"`);
    expect(result.code).toBe(0);
  });
});
```

---

## 9. 安全事件响应流程

### 9.1 安全事件分级

| 等级 | 定义 | 示例 | 响应时限 |
|------|------|------|----------|
| **P0 - 严重** | 凭证大规模泄露、系统被攻破 | SK泄露到公开日志、配置文件被篡改 | 立即响应，1小时内修复 |
| **P1 - 高危** | 单个凭证泄露、异常行为 | SK泄露到单个日志文件、异常鉴权失败 | 4小时内响应，24小时内修复 |
| **P2 - 中危** | 安全机制失效 | 文件权限错误、证书校验禁用 | 24小时内响应，1周内修复 |
| **P3 - 低危** | 安全审计不足 | 日志记录缺失、异常检测未启用 | 1周内响应，下版本修复 |

### 9.2 安全事件响应流程

```
安全事件响应流程:

1. 发现安全事件
   ├─ 用户报告
   ├─ 自动检测（异常检测）
   └─ 安全审计发现

2. 评估事件等级
   ├─ P0: 立即响应
   ├─ P1: 4小时内响应
   ├─ P2: 24小时内响应
   └─ P3: 1周内响应

3. 应急处理
   ├─ 立即修复漏洞
   ├─ 清除泄露信息
   ├─ 通知受影响用户
   └─ 发布安全补丁

4. 根因分析
   ├─ 分析事件原因
   ├─ 找出漏洞根源
   └─ 制定长期解决方案

5. 持续改进
   ├─ 更新安全机制
   ├─ 加强安全测试
   └─ 发布安全公告
```

---

## 10. 安全最佳实践建议

### 10.1 用户安全建议

- ✅ **定期更换 AK/SK**: 建议每90天更换一次
- ✅ **启用系统密钥链**: macOS/Windows用户优先使用系统密钥链
- ✅ **CI环境使用环境变量**: 不写入配置文件
- ✅ **定期清理审计日志**: 保留30天，避免日志过大
- ✅ **监控鉴权失败**: 定期检查审计日志中的鉴权失败
- ✅ **更新CLI版本**: 及时更新到最新版本，获取安全补丁
- ❌ **不要分享配置文件**: ~/.ybc/ 目录不应分享或上传
- ❌ **不要在公共环境保存凭证**: 公共计算机不应保存凭证

### 10.2 开发安全建议

- ✅ **代码审查**: 所有涉及安全的代码必须审查
- ✅ **安全测试**: 每次发布前运行完整安全测试
- ✅ **依赖审计**: 定期运行 `npm audit` 检查依赖漏洞
- ✅ **最小权限**: 仅授予必需的权限
- ✅ **加密算法**: 使用 AES-256-GCM、PBKDF2 等标准算法
- ❌ **不要硬编码密钥**: 密钥不应硬编码在代码中
- ❌ **不要自定义加密算法**: 使用标准算法，不自行发明

---

## 附录：安全检查清单

### 发布前安全检查清单

- [ ] SK加密机制验证通过
- [ ] SK不在日志明文出现
- [ ] SK不在配置文件明文出现
- [ ] Token文件权限600
- [ ] 配置文件权限600
- [ ] HTTPS强制启用
- [ ] 证书校验启用
- [ ] 参数注入测试通过
- [ ] 错误信息脱敏验证
- [ ] 操作日志记录验证
- [ ] 异常检测启用
- [ ] 依赖安全审计通过（npm audit）
- [ ] 安全测试覆盖率 ≥ 90%
- [ ] 无已知安全漏洞

### 用户使用安全检查清单

- [ ] 配置文件权限600
- [ ] Token文件权限600
- [ ] ~/.ybc/ 目录不分享
- [ ] 审计日志定期清理
- [ ] AK/SK定期更换
- [ ] CLI版本及时更新
- [ ] 异常鉴权失败监控

---

**文档维护**：本文档将随项目演进持续更新，每次安全事件发生后需重新评估并更新安全措施。