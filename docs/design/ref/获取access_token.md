# 获取 access_token

## 说明

调用接口令牌 `access_token` 是应用调用开放平台业务接口的凭证，**有效期为2小时，过期后需要重新获取**。

用户需要先「开发流程 -> 创建应用」，然后获取「开发流程 -> 接口授权」，获取授权时，会生成应用的 `appKey` 和 `appSecret` 的值。租户管理员可将这两个值交给开发者，开发者可用 `appKey` 和 `appSecret` 获取 `access_token` 进行接口调用。

在【API授权】页面，租户管理员可以查看到所创建应用的 App Key 和 Secret 值。

`access_token` 的获取方式为主动调用开放平台的令牌授权接口，该接口说明如下：

## 请求地址

| 项目 | 值 |
|------|-----|
| **URL** | `https://c2.yonyoucloud.com/iuap-api-auth/open-auth/selfAppAuth/getAccessToken` |
| **请求方法** | GET |

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| appKey | string | 应用 appKey |
| timestamp | number long | unix timestamp, 毫秒时间戳 |
| signature | string | 校验签名，HmacSHA256，加签方式看下文 |

## 加签方式

签名字段 `signature` 计算使用 **HmacSHA256**，具体计算方式如下：

```
URLEncode( Base64( HmacSHA256( parameterMap ) ) )
```

其中，`parameterMap` 按照参数名称排序，参数名称与参数值依次拼接（signature字段除外），形成待计算签名的字符串。

### 示例

若发送请求参数 `appKey` 为 `41832a3d2df94989b500da6a22268747`，时间戳 `timestamp` 为 `1568098531823`，则待加密字符串的值为：

```
appKey41832a3d2df94989b500da6a22268747timestamp1568098531823
```

之后对 `parameterMap` 使用 `HmacSHA256` 计算签名，`Hmac` 的 `key` 为自建应用的 `appSecret`。计算出的二进制签名先进行 `base64`，之后进行 `urlEncode`，即得到 `signature` 字段的值。

> 📎 自建应用获取token示例：https://gitee.com/yycloudopen/corp-demo#获取-access_token

（开发者也可以选择 SDK 方式获取 token）

获得 `access_token` 后，开发者就可以调用具体的业务接口，获得具体的业务数据。

## Java加密的常见问题

1. **关于 Java 不同 JDK 之间的 Base64 加密**
   - IBM 中的 JDK 默认使用 `sun.misc.BASE64Decoder`、`sun.misc.BASE64Encoder`，这种 Base64 的加密不推荐使用，他跟 `java.util.Base64` 不互通
   - `org.apache.commons.codec.binary.Base64` 是与 `java.util.Base64` 互通的
   - IBM 的 JDK 建议使用 `org.apache.commons.codec.binary.Base64` 替换 `sun.misc.BASE64`

2. **AES 解密报错：java.security.InvalidKeyException: Illegal key size**
   - JDK 1.8 及以下需要替换 `local_policy.jar` 和 `US_export_policy.jar`
   - Oracle JDK 去 Oracle 官网下载，IBM 的 JDK 去 IBM 官网下载

## 请求示例

```
https://c2.yonyoucloud.com/iuap-api-auth/open-auth/selfAppAuth/getAccessToken?appKey=xxx&timestamp=xxx&signature=xxx
```

## 返回参数说明

| 字段 | 类型 | 说明 |
|------|------|------|
| code | String | 结果码，正确返回 `"00000"` |
| message | String | 结果信息，若有错误，该字段会返回具体错误信息 |
| data.access_token | String | 接口令牌 access_token |
| data.expire | number int | 有效期，单位秒 |

## 返回数据示例

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

---

## 2023-07-21 地址调整说明

### 一、开放平台获取 token 的 URL 进行升级

为了支持与友互通鉴权保持一致，开放平台对获取 AccessToken 进行改造升级。

| 应用类型 | 旧路径 | 新路径 |
|----------|--------|--------|
| 自建应用 | `/iuap-api-auth/open-auth/selfAppAuth/getAccessToken` | `/iuap-api-auth/open-auth/selfAppAuth/base/v1/getAccessToken` |
| 生态应用 | `/iuap-api-auth/open-auth/suiteApp/getAccessToken` | `/iuap-api-auth/open-auth/suiteApp/base/v1/getAccessToken` |

参数不变。

### 二、调整示例

**新的获取自建 token（预发布）：**
```
https://bip-pre.diwork.com/iuap-api-auth/open-auth/selfAppAuth/base/v1/getAccessToken?appKey=app_key&timestamp=1689561299693&signature=xxx
```

**老的获取自建 token（预发布）：**
```
https://bip-pre.diwork.com/iuap-api-auth/open-auth/selfAppAuth/getAccessToken?appKey=app_key&timestamp=1689561299694&signature=xxx
```

**新的获取生态 token（预发布）：**
```
https://bip-pre.diwork.com/iuap-api-auth/open-auth/suiteApp/base/v1/getAccessToken?suiteKey=suit_key&tenantId=tenant_id&timestamp=xxx&signature=xxx
```

**老的获取生态 token（预发布）：**
```
https://bip-pre.diwork.com/iuap-api-auth/open-auth/suiteApp/getAccessToken?suiteKey=app_key&tenantId=tenant_id&timestamp=xxx&signature=xxx
```

### 三、改造接口需要注意的事项

1. 改造后调用方式不变，参数不变，请注意保持 Header 中的 `ContentType` 是 `application/json`
2. 在代码调用中为了保持编码一致请使用 **UTF-8**
3. 新版本获取的 token 会比较长，并且包含特殊字符，请在使用新 token 调用 OpenAPI 时对 token 进行 **encode 编码**
   - Go / Python：默认会在请求时对参数进行 encode，一般不需要手动 encode
   - Java：需要调用 `java.net.URLEncoder.encode(accessToken)`
   - PHP：需要调用 `urlencode(accessToken)`

---

> 📌 **来源**: [用友iuap开放平台 - 开放平台接入文档](https://open.yonyoucloud.com/#/doc-center/docDes/doc?code=open_jrwd&section=022c941650ae4989af7dd6ac7fd4d412&from=&iframe=)
