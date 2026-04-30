/**
 * Logger 服务
 *
 * 提供统一的日志记录功能，支持多级别、颜色化输出
 */

import { LogLevel, LoggerConfig } from '../../types/http';

/**
 * Logger 类
 *
 * 负责统一的日志输出，支持不同级别和格式化
 */
export class Logger {
  private readonly verbose: boolean;
  private readonly colorize: boolean;
  private readonly level: LogLevel;
  private readonly prefix: string;

  /**
   * 日志级别优先级
   */
  private static readonly levelPriority: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  /**
   * ANSI 颜色代码
   */
  private static readonly colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  };

  /**
   * 构造函数
   * @param config 日志配置
   */
  constructor(config: LoggerConfig = {}) {
    this.verbose = config.verbose ?? process.env.YBC_VERBOSE === 'true';
    this.colorize = config.colorize ?? true;
    this.level = config.level ?? (this.verbose ? LogLevel.DEBUG : LogLevel.INFO);
    this.prefix = config.prefix ?? '';
  }

  /**
   * 调试日志（仅在 verbose 模式下输出）
   * @param message 消息
   * @param args 额外参数
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, ...args);
    }
  }

  /**
   * 信息日志
   * @param message 消息
   * @param args 额外参数
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, ...args);
    }
  }

  /**
   * 警告日志
   * @param message 消息
   * @param args 额外参数
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, ...args);
    }
  }

  /**
   * 错误日志
   * @param message 消息
   * @param args 额外参数
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, ...args);
    }
  }

  /**
   * 判断是否应该输出日志
   * @param level 日志级别
   * @returns 是否输出
   */
  private shouldLog(level: LogLevel): boolean {
    return Logger.levelPriority[level] >= Logger.levelPriority[this.level];
  }

  /**
   * 输出日志
   * @param level 日志级别
   * @param message 消息
   * @param args 额外参数
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const timestamp = this.formatTimestamp(new Date());
    const levelStr = this.formatLevel(level);
    const prefix = this.prefix ? `[${this.prefix}] ` : '';

    const formattedMessage = `${timestamp} ${levelStr} ${prefix}${message}`;

    // 选择输出流
    const output = level === LogLevel.ERROR ? console.error : console.log;

    if (args.length > 0) {
      output(formattedMessage, ...args);
    } else {
      output(formattedMessage);
    }
  }

  /**
   * 格式化时间戳
   * @param date 日期对象
   * @returns 格式化的时间戳
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    const timestamp = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

    if (this.colorize) {
      return `${Logger.colors.dim}${timestamp}${Logger.colors.reset}`;
    }

    return timestamp;
  }

  /**
   * 格式化日志级别
   * @param level 日志级别
   * @returns 格式化的级别字符串
   */
  private formatLevel(level: LogLevel): string {
    const levelStr = level.toUpperCase().padEnd(5);

    if (!this.colorize) {
      return `[${levelStr}]`;
    }

    const colorMap: Record<LogLevel, string> = {
      [LogLevel.DEBUG]: Logger.colors.cyan,
      [LogLevel.INFO]: Logger.colors.green,
      [LogLevel.WARN]: Logger.colors.yellow,
      [LogLevel.ERROR]: Logger.colors.red,
    };

    const color = colorMap[level];
    return `${color}[${levelStr}]${Logger.colors.reset}`;
  }

  /**
   * 创建子 Logger（带前缀）
   * @param prefix 前缀
   * @returns 新的 Logger 实例
   */
  child(prefix: string): Logger {
    const fullPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({
      verbose: this.verbose,
      colorize: this.colorize,
      level: this.level,
      prefix: fullPrefix,
    });
  }
}

/**
 * 创建默认 Logger 实例
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new Logger(config);
}