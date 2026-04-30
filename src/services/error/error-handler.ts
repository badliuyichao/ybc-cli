import { ExitCode, getExitCodeDescription } from './codes';
import { isCliError } from './errors';

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  /**
   * 是否启用静默模式
   * 静默模式下只输出错误消息，不输出详细信息和恢复建议
   */
  quiet?: boolean;

  /**
   * 是否启用详细模式
   * 详细模式下输出完整的错误堆栈
   */
  verbose?: boolean;

  /**
   * 是否输出错误堆栈
   */
  showStackTrace?: boolean;
}

/**
 * 全局错误处理器
 *
 * 负责统一处理所有错误，设置退出码，并提供用户友好的错误消息
 */
export class ErrorHandler {
  private static instance: ErrorHandler | null = null;
  private config: ErrorHandlerConfig;

  private constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      quiet: config.quiet ?? process.env.YBC_QUIET === 'true',
      verbose: config.verbose ?? process.env.YBC_VERBOSE === 'true',
      showStackTrace: config.showStackTrace ?? false,
    };
  }

  /**
   * 获取错误处理器单例
   */
  public static getInstance(config?: ErrorHandlerConfig): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config);
    }
    return ErrorHandler.instance;
  }

  /**
   * 重置单例（用于测试）
   */
  public static resetInstance(): void {
    ErrorHandler.instance = null;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 处理错误
   *
   * @param error 错误对象
   * @returns 退出码
   */
  public handle(error: Error): number {
    const exitCode = this.getExitCode(error);
    const message = this.formatErrorMessage(error);

    // 输出错误消息
    console.error(message);

    return exitCode;
  }

  /**
   * 获取错误的退出码
   */
  public getExitCode(error: Error): ExitCode {
    if (isCliError(error)) {
      return error.exitCode;
    }

    // 对于非 CLI 错误，返回通用错误码
    return ExitCode.GENERAL_ERROR;
  }

  /**
   * 格式化错误消息
   */
  private formatErrorMessage(error: Error): string {
    const lines: string[] = [];

    // 错误标题
    if (isCliError(error)) {
      const exitCodeDesc = getExitCodeDescription(error.exitCode);
      lines.push(`\n错误 [${exitCodeDesc}]:`);
      lines.push(`  ${error.getUserFriendlyMessage()}`);

      // 恢复建议（非静默模式）
      if (!this.config.quiet) {
        const suggestion = error.getRecoverySuggestion();
        if (suggestion) {
          lines.push(`\n建议:`);
          lines.push(`  ${suggestion}`);
        }
      }
    } else {
      // 非 CLI 错误
      lines.push(`\n错误:`);
      lines.push(`  ${error.message || '未知错误'}`);

      if (!this.config.quiet) {
        lines.push(`\n建议:`);
        lines.push(`  如果问题持续，请使用 --verbose 选项查看详细信息，或联系技术支持。`);
      }
    }

    // 详细模式：输出错误堆栈
    if (this.config.verbose || this.config.showStackTrace) {
      lines.push(`\n详细信息:`);
      lines.push(`  错误类型: ${error.name}`);
      lines.push(`  错误消息: ${error.message}`);

      if (isCliError(error) && error.details) {
        // 输出错误详情，但要确保不暴露敏感信息
        const safeDetails = this.sanitizeDetails(error.details);
        lines.push(`  详情: ${JSON.stringify(safeDetails, null, 2)}`);
      }

      if (error.stack) {
        lines.push(`\n堆栈追踪:`);
        lines.push(error.stack);
      }
    }

    lines.push(''); // 结尾空行

    return lines.join('\n');
  }

  /**
   * 清理错误详情，移除敏感信息
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'secret', 'sk', 'secretKey', 'token', 'authorization'];

    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();

      // 检查是否为敏感字段
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '***';
      } else if (typeof value === 'object' && value !== null) {
        // 递归处理嵌套对象
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 创建用户友好的错误消息（静态方法，便于外部调用）
   */
  public static createUserFriendlyMessage(error: Error): string {
    if (isCliError(error)) {
      return error.getUserFriendlyMessage();
    }

    return error.message || '未知错误';
  }

  /**
   * 创建恢复建议（静态方法，便于外部调用）
   */
  public static createRecoverySuggestion(error: Error): string {
    if (isCliError(error)) {
      return error.getRecoverySuggestion();
    }

    return '请检查错误信息，或使用 --verbose 选项查看详细信息。';
  }
}

/**
 * 全局错误处理器实例
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * 注册全局错误处理器
 *
 * 应该在 CLI 启动时调用
 */
export function setupGlobalErrorHandler(config?: ErrorHandlerConfig): void {
  const handler = ErrorHandler.getInstance(config);

  // 处理未捕获的异常
  process.on('uncaughtException', (error: Error) => {
    console.error('\n致命错误：未捕获的异常');
    const exitCode = handler.handle(error);
    process.exit(exitCode);
  });

  // 处理未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('\n致命错误：未处理的 Promise 拒绝');

    const error = reason instanceof Error ? reason : new Error(String(reason));
    const exitCode = handler.handle(error);
    process.exit(exitCode);
  });
}

/**
 * 便捷函数：处理错误并退出
 */
export function handleErrorAndExit(error: Error, config?: ErrorHandlerConfig): never {
  const handler = ErrorHandler.getInstance(config);
  const exitCode = handler.handle(error);
  process.exit(exitCode);
}
