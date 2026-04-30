/**
 * Infrastructure 层类型定义
 *
 * 定义文件存储、加密服务、环境变量管理相关的接口和类型
 */

/**
 * 文件存储选项
 */
export interface StorageOptions {
  /** 文件权限模式（默认 0o600） */
  mode?: number;
  /** 是否创建父目录（默认 true） */
  createDir?: boolean;
  /** 是否格式化 JSON（默认 true） */
  pretty?: boolean;
}

/**
 * 加密选项
 */
export interface EncryptionOptions {
  /** 加密算法（默认 'aes-256-gcm'） */
  algorithm?: string;
  /** IV 长度（默认 12） */
  ivLength?: number;
  /** Salt 长度（默认 16） */
  saltLength?: number;
  /** 认证标签长度（默认 16） */
  tagLength?: number;
}

/**
 * 加密数据结构
 */
export interface EncryptedData {
  /** 加密后的数据（Base64 编码） */
  encrypted: string;
  /** 初始化向量（Base64 编码） */
  iv: string;
  /** 认证标签（Base64 编码） */
  authTag: string;
  /** 加密版本（用于未来升级） */
  version: string;
}

/**
 * 环境变量配置
 */
export interface EnvConfig {
  /** 租户ID */
  YBC_TENANT_ID?: string;

  /** App Key */
  YBC_APP_KEY?: string;

  /** App Secret */
  YBC_APP_SECRET?: string;

  /** 输出格式 */
  YBC_FORMAT?: 'json' | 'table' | 'csv' | 'raw';

  /** 环境（sandbox/production） */
  YBC_ENV?: 'sandbox' | 'production';
}

/**
 * 环境变量键名
 */
export type EnvKey = keyof EnvConfig;

/**
 * 文件存储错误类型
 */
export enum StorageErrorType {
  /** 文件不存在 */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  /** 权限错误 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** 文件已存在 */
  FILE_EXISTS = 'FILE_EXISTS',
  /** 目录创建失败 */
  DIRECTORY_CREATE_FAILED = 'DIRECTORY_CREATE_FAILED',
  /** 读写错误 */
  IO_ERROR = 'IO_ERROR',
  /** JSON 解析错误 */
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
}

/**
 * 加密错误类型
 */
export enum EncryptionErrorType {
  /** 加密失败 */
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  /** 解密失败 */
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  /** 密钥生成失败 */
  KEY_GENERATION_FAILED = 'KEY_GENERATION_FAILED',
  /** 密钥存储失败 */
  KEY_STORAGE_FAILED = 'KEY_STORAGE_FAILED',
  /** 密钥加载失败 */
  KEY_LOAD_FAILED = 'KEY_LOAD_FAILED',
  /** 无效的加密数据 */
  INVALID_ENCRYPTED_DATA = 'INVALID_ENCRYPTED_DATA',
}

/**
 * 环境变量错误类型
 */
export enum EnvErrorType {
  /** 缺少必需的环境变量 */
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  /** 无效的环境变量值 */
  INVALID_VALUE = 'INVALID_VALUE',
}

/**
 * 文件存储错误
 */
export class StorageError extends Error {
  constructor(
    public type: StorageErrorType,
    message: string,
    public readonly filePath?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * 加密错误
 */
export class EncryptionError extends Error {
  constructor(
    public type: EncryptionErrorType,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

/**
 * 环境变量错误
 */
export class EnvError extends Error {
  constructor(
    public type: EnvErrorType,
    message: string,
    public readonly key?: string
  ) {
    super(message);
    this.name = 'EnvError';
  }
}
