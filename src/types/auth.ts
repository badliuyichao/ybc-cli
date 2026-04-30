/**
 * 鉴权相关类型定义
 *
 * 定义 Token 管理、鉴权配置相关的接口和类型
 */

/**
 * Token 信息
 */
export interface TokenInfo {
  /** 访问令牌 */
  access_token: string;

  /** 过期时间（秒） */
  expires_in: number;

  /** 过期时间戳（毫秒） */
  expires_at: number;

  /** 刷新令牌（可选） */
  refresh_token?: string;

  /** Token 类型 */
  token_type?: string;
}

/**
 * Token 配置
 */
export interface TokenConfig {
  /** 租户ID（必需） */
  tenantId: string;

  /** App Key */
  appKey?: string;

  /** App Secret */
  appSecret?: string;

  /** 环境 */
  env: 'sandbox' | 'production';

  /** Token获取域名（可选，优先级高于env） */
  tokenUrl?: string;

  /** 业务接口域名（可选，优先级高于env） */
  gatewayUrl?: string;
}

/**
 * Token 缓存结构
 */
export interface TokenCache {
  /** Token 信息 */
  token: TokenInfo;

  /** 缓存时间戳（毫秒） */
  timestamp: number;

  /** 配置指纹（用于验证缓存有效性） */
  configFingerprint: string;
}

/**
 * BIP API Token 响应
 */
export interface BipTokenResponse {
  /** 访问令牌 */
  access_token: string;

  /** 过期时间（秒） */
  expires_in: number;

  /** Token 类型 */
  token_type?: string;

  /** 刷新令牌 */
  refresh_token?: string;
}

/**
 * 签名计算参数
 */
export interface SignatureParams {
  /** App Key */
  appKey: string;

  /** 时间戳（毫秒级） */
  timestamp: number;

  /** App Secret */
  appSecret: string;
}

/**
 * 数据中心域名响应
 */
export interface DataCenterResponse {
  /** 响应码 */
  code: string;

  /** 响应消息 */
  message: string;

  /** 数据中心域名信息 */
  data: {
    /** 业务接口域名 */
    gatewayUrl: string;

    /** Token获取域名 */
    tokenUrl: string;
  };
}

/**
 * BIP API 错误响应
 */
export interface BipErrorResponse {
  /** 错误码 */
  code: string;

  /** 错误消息 */
  message: string;

  /** 详细信息 */
  details?: unknown;
}

/**
 * 数据中心缓存结构
 */
export interface DataCenterCache {
  /** 租户ID */
  tenantId: string;

  /** 数据中心域名 */
  urls: {
    gatewayUrl: string;
    tokenUrl: string;
  };

  /** 最后更新时间 */
  lastUpdate: string;
}
