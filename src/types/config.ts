/**
 * 配置相关类型定义
 *
 * 定义 CLI 配置、用户偏好设置相关的接口和类型
 */

/**
 * 环境类型
 */
export type Environment = 'sandbox' | 'production';

/**
 * 输出格式类型
 */
export type OutputFormat = 'json' | 'table' | 'csv' | 'raw';

/**
 * CLI 配置
 */
export interface Config {
  /** 租户ID（必需） */
  tenantId?: string;

  /** App Key（新版字段名，推荐使用） */
  appKey?: string;

  /** App Secret（加密存储） */
  appSecret?: string;

  /** 环境 */
  env?: Environment;

  /** 输出格式 */
  format?: OutputFormat;

  /** 数据中心域名缓存 */
  dataCenter?: {
    /** 业务接口域名 */
    gatewayUrl?: string;
    /** Token获取域名 */
    tokenUrl?: string;
    /** 最后更新时间 */
    lastUpdate?: string;
  };

  /** API 基础 URL（可选，覆盖默认值） */
  apiUrl?: string;

  /** 调试模式 */
  debug?: boolean;

  /** 配置版本 */
  version?: string;

  /** 创建时间 */
  createdAt?: string;

  /** 最后更新时间 */
  updatedAt?: string;
}

/**
 * 配置字段名
 */
export type ConfigField = keyof Config;

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  /** 是否有效 */
  valid: boolean;

  /** 错误消息列表 */
  errors: string[];

  /** 警告消息列表 */
  warnings: string[];
}

/**
 * 配置更新选项
 */
export interface ConfigUpdateOptions {
  /** 是否合并现有配置 */
  merge?: boolean;

  /** 是否验证配置 */
  validate?: boolean;

  /** 是否加密敏感字段 */
  encryptSensitive?: boolean;

  /** 是否覆盖现有值 */
  overwrite?: boolean;
}

/**
 * 配置查询选项
 */
export interface ConfigQueryOptions {
  /** 是否解密敏感字段 */
  decryptSensitive?: boolean;

  /** 是否脱敏显示 */
  maskSensitive?: boolean;
}
