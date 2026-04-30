/**
 * HTTP 客户端工厂
 *
 * 负责创建配置好的 Axios 实例，并管理拦截器
 */

import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { HttpClientConfig, HttpRequestConfig, HttpInterceptor } from '../../types/http';

/**
 * HTTP 客户端工厂类
 *
 * 负责创建和管理 HTTP 客户端实例
 */
export class HttpClientFactory {
  private globalInterceptors: HttpInterceptor[] = [];

  /**
   * 创建 HTTP 客户端
   * @param config 客户端配置
   * @returns Axios 实例
   */
  createClient(config: HttpClientConfig): AxiosInstance {
    // 创建 Axios 实例
    const client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      // 强制启用 HTTPS
      httpsAgent: new https.Agent({
        rejectUnauthorized: config.httpsAgent !== false,
      }),
    });

    // 添加全局拦截器
    for (const interceptor of this.globalInterceptors) {
      this.applyInterceptor(client, interceptor);
    }

    return client;
  }

  /**
   * 添加全局拦截器
   * @param interceptor 拦截器
   */
  addGlobalInterceptor(interceptor: HttpInterceptor): void {
    this.globalInterceptors.push(interceptor);
  }

  /**
   * 应用拦截器到客户端
   * @param client Axios 实例
   * @param interceptor 拦截器
   */
  private applyInterceptor(client: AxiosInstance, interceptor: HttpInterceptor): void {
    // 添加请求拦截器
    if (interceptor.request) {
      client.interceptors.request.use(
        interceptor.request.onFulfilled as any,
        interceptor.request.onRejected
      );
    }

    // 添加响应拦截器
    if (interceptor.response) {
      client.interceptors.response.use(
        interceptor.response.onFulfilled as any,
        interceptor.response.onRejected
      );
    }
  }
}

/**
 * 创建默认的 HTTP 客户端工厂实例
 */
export function createHttpClientFactory(): HttpClientFactory {
  return new HttpClientFactory();
}