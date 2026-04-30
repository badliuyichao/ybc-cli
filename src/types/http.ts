/**
 * HTTP 相关类型定义
 *
 * 定义 HTTP 客户端、请求/响应、拦截器相关的接口和类型
 */

import { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * HTTP 客户端配置
 */
export interface HttpClientConfig {
  /** 基础 URL */
  baseURL: string;

  /** 请求超时时间（毫秒，默认 30000） */
  timeout?: number;

  /** 默认请求头 */
  headers?: Record<string, string>;

  /** 是否启用 HTTPS 证书校验（默认 true） */
  httpsAgent?: boolean;
}

/**
 * HTTP 请求配置
 */
export interface HttpRequestConfig extends AxiosRequestConfig {
  /** 是否跳过鉴权拦截器 */
  skipAuth?: boolean;

  /** 是否跳过日志记录 */
  skipLogging?: boolean;

  /** 重试次数 */
  retryCount?: number;
}

/**
 * HTTP 响应
 */
export type HttpResponse<T = unknown> = AxiosResponse<T>;

/**
 * HTTP 错误
 */
export interface HttpError extends AxiosError {
  /** 是否为网络错误 */
  isNetworkError?: boolean;

  /** 是否为超时错误 */
  isTimeout?: boolean;

  /** 重试次数 */
  retryCount?: number;
}

/**
 * HTTP 拦截器
 */
export interface HttpInterceptor {
  /** 请求拦截器 */
  request?: {
    onFulfilled: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>;
    onRejected?: (error: Error) => Error | Promise<Error>;
  };

  /** 响应拦截器 */
  response?: {
    onFulfilled: (response: HttpResponse) => HttpResponse | Promise<HttpResponse>;
    onRejected?: (error: HttpError) => Error | Promise<Error>;
  };
}

/**
 * HTTP 客户端工厂接口
 */
export interface IHttpClientFactory {
  /**
   * 创建 HTTP 客户端
   * @param config 客户端配置
   * @returns Axios 实例
   */
  createClient(config: HttpClientConfig): AxiosInstance;

  /**
   * 添加全局拦截器
   * @param interceptor 拦截器
   */
  addGlobalInterceptor(interceptor: HttpInterceptor): void;
}

/**
 * 日志级别
 */
export enum LogLevel {
  /** 调试级别 */
  DEBUG = 'debug',

  /** 信息级别 */
  INFO = 'info',

  /** 警告级别 */
  WARN = 'warn',

  /** 错误级别 */
  ERROR = 'error',
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 是否启用 verbose 模式 */
  verbose?: boolean;

  /** 是否启用颜色 */
  colorize?: boolean;

  /** 日志级别 */
  level?: LogLevel;

  /** 前缀 */
  prefix?: string;
}