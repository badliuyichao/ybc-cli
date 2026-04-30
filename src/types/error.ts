import { ExitCode } from '../services/error/codes';

/**
 * 错误详情类型
 *
 * 用于存储错误的额外信息，便于调试和错误处理
 */
export interface ErrorDetails {
  /**
   * 原始错误
   */
  originalError?: Error;

  /**
   * 错误代码
   */
  code?: string;

  /**
   * HTTP 状态码
   */
  statusCode?: number;

  /**
   * 请求 ID（用于追踪）
   */
  requestId?: string;

  /**
   * 时间戳
   */
  timestamp?: string;

  /**
   * 其他自定义字段
   */
  [key: string]: unknown;
}

/**
 * CLI 错误接口
 *
 * 定义所有自定义错误类必须实现的接口
 */
export interface ICliError {
  /**
   * 错误消息
   */
  message: string;

  /**
   * 错误名称
   */
  name: string;

  /**
   * 退出码
   */
  exitCode: ExitCode;

  /**
   * 错误详情
   */
  details?: ErrorDetails;

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string;

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(): string;
}

/**
 * 鉴权错误详情
 */
export interface AuthErrorDetails extends ErrorDetails {
  /**
   * 鉴权失败的原因
   */
  reason?:
    | 'invalid_credentials'
    | 'token_expired'
    | 'token_refresh_failed'
    | 'permission_denied'
    | 'token_cache_failed';

  /**
   * 相关的 AK（仅前 4 位）
   */
  akHint?: string;
}

/**
 * 网络错误详情
 */
export interface NetworkErrorDetails extends ErrorDetails {
  /**
   * 请求的 URL
   */
  url?: string;

  /**
   * 请求方法
   */
  method?: string;

  /**
   * 是否超时
   */
  isTimeout?: boolean;

  /**
   * 是否为连接错误
   */
  isConnectionError?: boolean;
}

/**
 * 业务错误详情
 */
export interface BusinessErrorDetails extends ErrorDetails {
  /**
   * 业务错误码
   */
  businessCode?: string;

  /**
   * API 端点
   */
  endpoint?: string;

  /**
   * 业务错误数据
   */
  data?: unknown;
}

/**
 * 验证错误详情
 */
export interface ValidationErrorDetails extends ErrorDetails {
  /**
   * 验证失败的字段
   */
  field?: string;

  /**
   * 验证失败的值
   */
  value?: unknown;

  /**
   * 验证规则
   */
  rule?: string;
}
