import { ExitCode } from './codes';
import {
  ErrorDetails,
  ICliError,
  AuthErrorDetails,
  NetworkErrorDetails,
  BusinessErrorDetails,
  ValidationErrorDetails,
} from '../../types/error';

/**
 * 鉴权错误原因
 */
export enum AuthErrorReason {
  /** 凭据无效 */
  INVALID_CREDENTIALS = 'invalid_credentials',
  /** Token 过期 */
  TOKEN_EXPIRED = 'token_expired',
  /** Token 刷新失败 */
  TOKEN_REFRESH_FAILED = 'token_refresh_failed',
  /** 权限不足 */
  PERMISSION_DENIED = 'permission_denied',
  /** Token 缓存失败 */
  TOKEN_CACHE_FAILED = 'token_cache_failed',
}

/**
 * CLI 错误基类
 *
 * 所有自定义错误的基类，提供统一的错误处理接口
 */
export class CliError extends Error implements ICliError {
  public readonly exitCode: ExitCode;
  public readonly details?: ErrorDetails;

  constructor(
    message: string,
    exitCode: ExitCode = ExitCode.GENERAL_ERROR,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
    this.details = details;

    // 确保原型链正确
    Object.setPrototypeOf(this, CliError.prototype);
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    return this.message;
  }

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(): string {
    return '请检查错误信息并重试。如需帮助，请运行 ybc --help';
  }
}

/**
 * 鉴权错误
 *
 * 用于 AK/SK 无效、token 获取失败、token 刷新失败等鉴权相关问题
 */
export class AuthError extends CliError {
  public readonly authDetails: AuthErrorDetails;

  constructor(
    reason: AuthErrorReason | string,
    message: string,
    cause?: Error,
    details?: Omit<AuthErrorDetails, 'reason' | 'originalError'>
  ) {
    const authDetails: AuthErrorDetails = {
      ...details,
      reason: reason as AuthErrorReason,
      originalError: cause,
    };
    super(message, ExitCode.AUTH_ERROR, authDetails);
    this.name = 'AuthError';
    this.authDetails = authDetails;

    Object.setPrototypeOf(this, AuthError.prototype);
  }

  /**
   * 获取用户友好的错误消息
   * 注意：绝不在错误消息中暴露 SK
   */
  getUserFriendlyMessage(): string {
    const reason = this.authDetails.reason;

    switch (reason) {
      case 'invalid_credentials':
        return '鉴权失败：App Key 或 App Secret 无效';
      case 'token_expired':
        return '鉴权失败：访问令牌已过期';
      case 'token_refresh_failed':
        return '鉴权失败：无法刷新访问令牌';
      case 'permission_denied':
        return '鉴权失败：权限不足';
      default:
        return this.message || '鉴权失败';
    }
  }

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(): string {
    const reason = this.authDetails.reason;

    switch (reason) {
      case 'invalid_credentials':
        return '请检查您的 App Key 和 App Secret 是否正确。您可以运行 "ybc config set appKey <your-appKey>" 来更新配置。';
      case 'token_expired':
      case 'token_refresh_failed':
        return '请运行 "ybc auth refresh" 手动刷新令牌，或检查您的网络连接。';
      case 'permission_denied':
        return '请联系管理员为您的账号分配相应权限。';
      default:
        return '请检查您的鉴权配置，或运行 "ybc auth status" 查看当前状态。';
    }
  }
}

/**
 * 网络错误
 *
 * 用于网络连接失败、请求超时等网络相关问题
 */
export class NetworkError extends CliError {
  public readonly networkDetails: NetworkErrorDetails;

  constructor(message: string, details?: NetworkErrorDetails) {
    super(message, ExitCode.NETWORK_ERROR, details);
    this.name = 'NetworkError';
    this.networkDetails = details || {};

    Object.setPrototypeOf(this, NetworkError.prototype);
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    if (this.networkDetails.isTimeout) {
      return `请求超时：无法连接到服务器 (${this.networkDetails.url || 'unknown'})`;
    }

    if (this.networkDetails.isConnectionError) {
      return `连接失败：无法建立与服务器的连接`;
    }

    return this.message || '网络请求失败';
  }

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(): string {
    if (this.networkDetails.isTimeout) {
      return '请检查网络连接，或稍后重试。您可以尝试增加请求超时时间。';
    }

    if (this.networkDetails.isConnectionError) {
      return '请检查网络连接，确保能够访问用友 BIP 服务。您也可以尝试使用 --verbose 选项查看详细错误信息。';
    }

    return '请检查网络连接，或稍后重试。如问题持续，请联系技术支持。';
  }
}

/**
 * 业务错误
 *
 * 用于 API 返回的业务错误（如资源不存在、权限不足等）
 */
export class BusinessError extends CliError {
  public readonly businessDetails: BusinessErrorDetails;

  constructor(message: string, details?: BusinessErrorDetails) {
    super(message, ExitCode.BUSINESS_ERROR, details);
    this.name = 'BusinessError';
    this.businessDetails = details || {};

    Object.setPrototypeOf(this, BusinessError.prototype);
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    const businessCode = this.businessDetails.businessCode;

    if (businessCode) {
      return `业务错误 [${businessCode}]: ${this.message}`;
    }

    return this.message || '业务操作失败';
  }

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(): string {
    const businessCode = this.businessDetails.businessCode;

    // 根据业务错误码提供针对性建议
    if (businessCode?.includes('not_found') || businessCode?.includes('NOT_FOUND')) {
      return '请检查您请求的资源是否存在，或运行 "ybc list" 查看可用资源。';
    }

    if (businessCode?.includes('permission') || businessCode?.includes('PERMISSION')) {
      return '您没有足够的权限执行此操作，请联系管理员。';
    }

    if (businessCode?.includes('invalid') || businessCode?.includes('INVALID')) {
      return '请检查您的输入参数是否正确。';
    }

    return '请检查错误信息，或使用 --verbose 选项查看详细信息。';
  }
}

/**
 * 验证错误
 *
 * 用于 CLI 参数验证失败、输入格式错误等
 */
export class ValidationError extends CliError {
  public readonly validationDetails: ValidationErrorDetails;

  constructor(message: string, details?: ValidationErrorDetails) {
    super(message, ExitCode.GENERAL_ERROR, details);
    this.name = 'ValidationError';
    this.validationDetails = details || {};

    Object.setPrototypeOf(this, ValidationError.prototype);
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserFriendlyMessage(): string {
    const field = this.validationDetails.field;

    if (field) {
      return `参数验证失败 [${field}]: ${this.message}`;
    }

    return `参数验证失败: ${this.message}`;
  }

  /**
   * 获取恢复建议
   */
  getRecoverySuggestion(): string {
    const field = this.validationDetails.field;

    if (field) {
      return `请检查 --${field} 参数的值是否正确，或运行 "ybc <command> --help" 查看参数说明。`;
    }

    return '请检查命令行参数是否正确，或运行 "ybc <command> --help" 查看帮助信息。';
  }
}

/**
 * 判断错误是否为 CLI 错误
 */
export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError;
}

/**
 * 判断错误是否为鉴权错误
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * 判断错误是否为网络错误
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * 判断错误是否为业务错误
 */
export function isBusinessError(error: unknown): error is BusinessError {
  return error instanceof BusinessError;
}

/**
 * 判断错误是否为验证错误
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
