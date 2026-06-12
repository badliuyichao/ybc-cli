# 鉴权规范（auth-spec）

> **本文档是 ybc 鉴权机制的权威设计文档**。覆盖：用友 BIP 多数据中心架构、HmacSHA256 签名算法、Token 生命周期管理、当前实现要点、关键决策记录（ADR）。
>
> 用友官方 API 规范原文请参阅 [`ref/`](ref/) 目录。

---

## 1. 背景与挑战

用友 YonBIP 从单数据中心升级为**多数据中心架构**，开放平台在每个数据中心独立部署一套。开发者调用接口前必须：

1. 先按 `tenantId` 查询该租户所在数据中心的 **核心网关域名** 和 **auth 域名**
2. 用 auth 域名 + HmacSHA256 签名换取 `access_token`
3. 用 `access_token` + 核心网关域名 调用业务接口

这与传统"一个固定域名 + AK/SK 直传"的模式有本质差异——必须**先查域名，再做签名换 Token**。

---

## 2. 三类外部 API

### 2.1 数据中心域名查询

| 项 | 值 |
|---|---|
| URL | `https://api.yonyoucloud.com/open-auth/dataCenter/getGatewayAddress` |
| 方法 | GET |
| 参数 | `tenantId`（必需，租户 ID）|

**响应**：

```json
{
  "code": "00000",
  "message": "成功！",
  "data": {
    "gatewayUrl": "https://yonbip.diwork.com/iuap-api-gateway",
    "tokenUrl":   "https://yonbip.diwork.com/iuap-api-auth"
  }
}
```

- `gatewayUrl` —— 业务接口的核心网关域名
- `tokenUrl` —— 用于获取 access_token 的 auth 域名

### 2.2 Token 获取

| 项 | 值 |
|---|---|
| URL | `{tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken` |
| 方法 | **GET**（注意不是 POST）|
| Header | `Content-Type: application/json`（即使 GET 也必需）|
| 参数 | `appKey`、`timestamp`（毫秒级）、`signature`（HmacSHA256，详见第 3 节）|

**响应**：

```json
{
  "code": "00000",
  "message": "成功！",
  "data": {
    "access_token": "b8743244c5b44b8fb1e52a55be7e2f",
    "expire": 7200
  }
}
```

- `access_token` 有效期 **2 小时**（7200 秒），过期后需重新获取
- 实际响应也可能直接返回 `{ access_token, expires_in }`（简化格式）—— ybc 实现已兼容两种

> ⚠️ **历史 URL（已废弃）**：`/iuap-api-auth/open-auth/selfAppAuth/getAccessToken`
> **新 URL（2023-07-21 起）**：`/iuap-api-auth/open-auth/selfAppAuth/base/v1/getAccessToken`
> ybc 已采用新路径。参数不变，仅路径升级。

### 2.3 业务接口调用

| 项 | 值 |
|---|---|
| Base URL | `{gatewayUrl}` |
| 鉴权方式 | **`access_token` 作为 query 参数**（实测用友 BIP 业务接口不接受 `Authorization` Header）|
| Token 编码 | URL 不安全字符必须 encode（Java: `URLEncoder.encode`；Go/Python/Node 默认会自动 encode）|

示例（员工详情查询）：

```
GET {gatewayUrl}/yonbip/digitalModel/staff/detail?access_token=xxx&code=EMP001
```

---

## 3. HmacSHA256 签名算法（核心）

签名公式：

```
signature = URLEncode( Base64( HmacSHA256( sortedParams, appSecret ) ) )
```

### 3.1 五步详解

#### 步骤 1：构建参数对象（不含 signature 自身）

```
{ appKey: "<value>", timestamp: "<毫秒级 Unix 时间戳>" }
```

#### 步骤 2：按参数名字母序排序

```
["appKey", "timestamp"]
```

#### 步骤 3：拼接参数名和值（无任何分隔符）

```
appKey<value>timestamp<value>
```

**示例**：`appKey=41832a3d2df94989b500da6a22268747`、`timestamp=1568098531823` 时：

```
appKey41832a3d2df94989b500da6a22268747timestamp1568098531823
```

#### 步骤 4：HmacSHA256，密钥为 `appSecret`，编码 UTF-8

```javascript
const hmac = crypto.createHmac('sha256', appSecret);
hmac.update(signString, 'utf8');
const binary = hmac.digest();   // Buffer
```

#### 步骤 5：Base64 编码

```javascript
const signature = binary.toString('base64');
```

> ⚠️ **关于 URLEncode**：官方公式末尾的 `URLEncode` 应该由 HTTP 客户端在拼接 query 时自动完成。**ybc 实现中不手动 URLEncode**——直接把 Base64 字符串作为 axios 的 `params.signature` 传入，由 axios 完成 URL 编码。**手动再 URLEncode 一次会导致双重编码**，签名校验失败。

### 3.2 时间戳要求

- **必须毫秒级**（13 位），用 JavaScript `Date.now()` 直接得到
- 机器时间必须与互联网时间同步（容差通常 ≤ 5 分钟，超出则签名失效）

### 3.3 实现位置

`src/services/auth/signature-service.ts` —— `SignatureService.calculateSignature()`

---

## 4. Token 完整流程

```
                          ┌──────────────┐
                          │   用户命令    │
                          └──────┬───────┘
                                 │
                                 ▼
                ┌────────────────────────────────┐
                │   TokenManager.getValidToken    │
                └──────────┬─────────────────────┘
                           │
            ┌──────────────┼─────────────────┐
            │              │                  │
            ▼              ▼                  ▼
       ┌────────┐    ┌──────────┐      ┌─────────────┐
       │内存缓存│    │~/.ybc/   │      │ refreshToken│
       │ ?     │     │token.json│      │   (远程)     │
       └────┬───┘    └────┬─────┘      └──────┬──────┘
            │ 未过期      │ 命中且未过期        │
            └────┬───────┴────────────────────┘
                 │ 返回 access_token            │
                 ▼                              │
       ┌────────────────────┐                   │
       │ 业务接口调用        │                   │
       │ (access_token in   │◄──────────────────┘
       │   query parameter) │
       └────────────────────┘

refreshToken 内部流程：
  1. 查询数据中心 → DataCenterService（先命中 ~/.ybc/datacenter.json 缓存）
  2. 生成毫秒级时间戳
  3. HmacSHA256 签名（appKey + timestamp，密钥 appSecret）
  4. GET {tokenUrl}/open-auth/selfAppAuth/base/v1/getAccessToken
  5. 解析响应（兼容简化 / 完整两种格式）
  6. 写回 ~/.ybc/token.json（权限 600）
```

### 4.1 缓存策略

| 层级 | 位置 | 命中条件 |
|------|------|---------|
| L1 内存 | `TokenManager.cachedToken` | 进程内未过期 |
| L2 文件 | `~/.ybc/token.json` | 文件存在 + 未过期 + **configFingerprint 匹配** |
| L3 远程 | `tokenUrl` 端点 | L1/L2 均失效时调用 |

**configFingerprint** = `sha256(tenantId + appKey + appSecret + env)`，用于检测配置变更——配置一旦改动（如换 appKey），旧 Token 立即作废。

### 4.2 过期与提前刷新

- 实际过期：服务端返回的 `expire` 秒数（通常 7200 秒 = 2 小时）
- **提前刷新**：剩余 ≤ 5 分钟时即视为过期，主动刷新——避免临界点失效

### 4.3 401 自动重试

业务接口返回 401 时，TokenManager 自动清除缓存并重试一次。再次失败则退出码 6。

### 4.4 数据中心域名缓存

`DataCenterService` 把查询结果缓存到 `~/.ybc/datacenter.json`，结构：

```json
{
  "tenantId": "your-tenant-id",
  "urls": {
    "gatewayUrl": "https://yonbip.diwork.com/iuap-api-gateway",
    "tokenUrl":   "https://yonbip.diwork.com/iuap-api-auth"
  },
  "lastUpdate": "2026-06-12T10:00:00Z"
}
```

**命中条件**：`cache.tenantId === 当前 tenantId`。换租户后立即重新查询。

> 💡 **测试技巧**：手工 seed 这个文件可以让所有 URL 指向本地 Mock Server，**绕过真实数据中心查询**——常用于离线测试。

---

## 5. 当前实现

| 组件 | 文件 | 职责 |
|------|------|------|
| `TokenManager` | `src/services/auth/token-manager.ts` | Token 三级缓存 + 自动刷新 |
| `SignatureService` | `src/services/auth/signature-service.ts` | HmacSHA256 签名计算 |
| `DataCenterService` | `src/services/auth/datacenter-service.ts` | 数据中心域名查询 + 缓存 |
| `ConfigService` | `src/services/config/config-service.ts` | 配置管理（含 appSecret AES-256-GCM 加密）|
| `ApiClientService` | `src/services/api/api-client-service.ts` | 统一装配 `basePath` + `accessToken` |

### 类型契约

```typescript
// src/types/auth.ts
interface TokenConfig {
  tenantId: string;          // 必需
  appKey: string;            // 推荐
  appSecret: string;         // 推荐
  env: 'sandbox' | 'production';
  tokenUrl?: string;         // 可选，跳过数据中心查询
  gatewayUrl?: string;       // 可选
}

interface SignatureParams {
  appKey: string;
  timestamp: number;         // 毫秒级
  appSecret: string;
}

interface DataCenterResponse {
  code: string;              // '00000' 表示成功
  message: string;
  data: { gatewayUrl: string; tokenUrl: string };
}
```

### 测试覆盖

| 测试 | 用例数 | 覆盖率 |
|------|-------|--------|
| `signature-service.test.ts` | 20 | **100%** |
| `datacenter-service.test.ts` | 19 | **97.5%** |
| `token-flow.test.ts`（集成）| 13 | **82%** |

---

## 6. 向后兼容

| 维度 | 策略 |
|------|------|
| **字段名** | 优先 `appKey/appSecret`，fallback 到 `ak/sk` |
| **环境变量** | 优先 `YBC_APP_KEY/YBC_APP_SECRET`，fallback 到 `YBC_AK/YBC_SK` |
| **配置文件** | `version: "2.0"` 标识新格式 |
| **响应格式** | 同时识别 `{ code, data: { access_token, expires_in/expire } }` 和 `{ access_token, expires_in/expire }` |

实现细节在 `config-service.ts` 的 `getConfig()` 中——合并环境变量与文件配置时做的字段融合。

---

## 7. 关键决策（ADR）

### ADR-1：URLEncode 由 HTTP 客户端而非签名服务负责

**背景**：官方公式 `URLEncode(Base64(HmacSHA256(…)))` 末尾包含 URLEncode。

**决策**：`SignatureService.calculateSignature()` **只返回 Base64**，不做 URLEncode。

**理由**：
- axios 在拼接 query 参数时会自动 URL-encode。如果签名服务先 encode 一次，axios 再 encode 一次，得到双重编码（`+` 变成 `%2B` 再变成 `%252B`），服务端校验失败。
- 把"网络编码"的责任留给 HTTP 层是更通用的设计。

**反例风险**：换 HTTP 库后若新库不自动 encode，需要在调用处显式 `encodeURIComponent(signature)`。已在代码注释中标注。

---

### ADR-2：用 `~/.ybc/datacenter.json` 缓存而不是硬编码 `tokenUrl/gatewayUrl`

**背景**：多数据中心架构下，域名按 `tenantId` 动态分配，不能硬编码。

**决策**：
- 唯一硬编码的 URL 是 `https://api.yonyoucloud.com`（数据中心查询入口本身）
- 查询结果缓存到 `~/.ybc/datacenter.json`，按 `tenantId` 命中

**好处**：
- 用户无感知（首次调用时自动查询并缓存）
- 离线测试场景可以预先 seed 缓存文件，**绕过真实查询**

**未来演进**：若要支持私有部署 BIP，应在 `config.json` 增加 `dataCenter` 字段让用户显式配置，自然延续缓存机制。

---

### ADR-3：业务接口用 query 参数传 `access_token`，而非 Authorization Header

**背景**：实测用友 BIP 业务接口不接受 `Authorization: Bearer xxx` Header；只识别 `access_token` query 参数。

**决策**：所有业务命令（如 `staff/queryStaff.ts`）直接构造 axios 请求，把 `access_token` 放在 `params` 里——**绕过 OpenAPI Generator 生成的 client 默认行为**（默认走 Authorization Header）。

**代价**：失去 generator 的部分价值（手动构造 URL）；新增业务命令需特殊处理。

**未来考虑**：若用友 BIP 后续支持 Header 方式，可统一切回生成的 client 路径。

---

### ADR-4：Token 缓存指纹用 sha256，而非明文拼接

**背景**：缓存指纹要识别配置变更，但又不能暴露明文 `appSecret`。

**决策**：`configFingerprint = sha256(tenantId + appKey + appSecret + env)`，写入 `token.json`。

**好处**：
- 配置变更立即作废旧 Token
- 文件即使外泄，也无法反推 `appSecret`

---

## 8. 常见错误与定位

| 症状 | 直接原因 | 排查 |
|------|---------|------|
| `code !== '00000'` 在数据中心查询 | `tenantId` 无效或拼写错 | 检查 `ybc config show` 输出 |
| `Invalid appKey/appSecret credentials` | 签名校验失败 | 1) 检查机器时间；2) 检查 appSecret 长度与拼写；3) `--verbose` 看待签字符串是否符合 `appKey<v>timestamp<v>` 格式 |
| 业务接口 401 | `access_token` 失效或未传 | 删除 `~/.ybc/token.json` 强制刷新；查 verbose 日志中 token 是否成功透传到 query |
| 业务接口 404 | URL 路径错误 | 比对 `openapi.yaml` 与 ybc 业务命令构造的 URL；用 `--dry-run` 看完整请求 |
| 签名总是失败但参数都对 | 可能是双重 URLEncode（见 ADR-1）| 在 `SignatureService` 中**只返 Base64**，让 axios 处理 URL 编码 |

---

## 9. 参考

- 用友官方：[`获取access_token.md`](获取access_token.md)
- 用友官方：[`获取租户所在数据中心域名.md`](获取租户所在数据中心域名.md)
- 实现入口：`src/services/auth/`
