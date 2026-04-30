/**
 * 日志拦截器
 *
 * 负责记录 HTTP 请求和响应日志，支持脱敏处理
 */

import { AxiosError } from 'axios';
import { Logger } from '../../services/logger/logger';
import { HttpInterceptor, HttpRequestConfig, HttpResponse } from '../../types/http';

/**
 * 敏感字段列表
 */
const SENSITIVE_FIELDS = [
  'authorization',
  'token',
  'access_token',
  'refresh_token',
  'sk',
  'secretkey',
  'secret_key',
  'password',
  'passwd',
];

/**
 * 脱敏处理函数
 * @param str 需要脱敏的字符串
 * @returns 脱敏后的字符串
 */
function maskSensitiveData(str: string): string {
  if (!str || str.length <= 10) {
    return '***';
  }
  // 只显示前 10 位，其余用 * 替代
  return `${str.substring(0, 10)}***`;
}

/**
 * 脱敏对象中的敏感字段
 * @param obj 需要处理的对象
 * @returns 脱敏后的对象
 */
function maskObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskObject(item));
  }

  const masked: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // 检查是否为敏感字段
    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field));

    if (isSensitive && typeof value === 'string') {
      masked[key] = maskSensitiveData(value);
    } else if (typeof value === 'object') {
      masked[key] = maskObject(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * 创建日志拦截器
 *
 * @param logger Logger 实例
 * @returns HTTP 拦截器
 */
export function createLoggingInterceptor(logger: Logger): HttpInterceptor {
  /**
   * 请求拦截器：记录请求日志
   */
  const requestInterceptor = {
    onFulfilled: (config: HttpRequestConfig): HttpRequestConfig => {
      // 如果标记为跳过日志，直接返回
      if (config.skipLogging) {
        return config;
      }

      // 记录请求基本信息
      const method = (config.method ?? 'GET').toUpperCase();
      const url = config.baseURL
        ? `${config.baseURL}${config.url ?? ''}`
        : config.url ?? 'unknown';

      logger.debug(`HTTP Request: ${method} ${url}`);

      // verbose 模式下记录详细信息
      if (logger) {
        const maskedHeaders = maskObject(config.headers);
        logger.debug('Request Headers:', JSON.stringify(maskedHeaders, null, 2));

        if (config.data) {
          const maskedData = maskObject(config.data);
          logger.debug('Request Data:', JSON.stringify(maskedData, null, 2));
        }
      }

      return config;
    },
    onRejected: (error: Error): Promise<Error> => {
      logger.error('Request Interceptor Error:', error.message);
      return Promise.reject(error);
    },
  };

  /**
   * 响应拦截器：记录响应日志
   */
  const responseInterceptor = {
    onFulfilled: (response: HttpResponse): HttpResponse => {
      const config = response.config as HttpRequestConfig;

      // 如果标记为跳过日志，直接返回
      if (config.skipLogging) {
        return response;
      }

      // 记录响应基本信息
      const method = (config.method ?? 'GET').toUpperCase();
      const url = config.baseURL
        ? `${config.baseURL}${config.url ?? ''}`
        : config.url ?? 'unknown';
      const status = response.status;

      logger.debug(`HTTP Response: ${method} ${url} - ${status}`);

      // verbose 模式下记录详细信息
      if (logger) {
        logger.debug('Response Status:', status);
        logger.debug('Response Headers:', JSON.stringify(response.headers, null, 2));

        if (response.data) {
          const maskedData = maskObject(response.data);
          logger.debug('Response Data:', JSON.stringify(maskedData, null, 2));
        }
      }

      return response;
    },
    onRejected: (error: AxiosError): Promise<never> => {
      const config = error.config as HttpRequestConfig;

      // 如果标记为跳过日志，直接抛出
      if (config?.skipLogging) {
        return Promise.reject(error);
      }

      // 记录错误信息
      const method = (config?.method ?? 'GET').toUpperCase();
      const url = config?.baseURL
        ? `${config.baseURL}${config.url ?? ''}`
        : config?.url ?? 'unknown';

      if (error.response) {
        // 服务器返回错误响应
        const status = error.response.status;
        logger.error(`HTTP Error: ${method} ${url} - ${status}`);

        if (logger) {
          const maskedData = maskObject(error.response.data);
          logger.error('Error Response:', JSON.stringify(maskedData, null, 2));
        }
      } else if (error.request) {
        // 请求已发出但没有收到响应
        logger.error(`HTTP Network Error: ${method} ${url} - No response received`);
      } else {
        // 请求配置错误
        logger.error(`HTTP Request Error: ${error.message}`);
      }

      return Promise.reject(error);
    },
  };

  return {
    request: requestInterceptor,
    response: responseInterceptor,
  };
}