/**
 * API HTTP 包装器
 *
 * 为所有业务命令提供统一的 HTTP 调用入口，确保：
 * 1. access_token 作为 query 参数传递（ADR-7，非 Authorization Header）
 * 2. 业务接口 401 自动清除缓存 → 刷新 Token → 重试一次（MISS-001）
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ApiClientService } from './api-client-service';
import { Configuration } from '../../api/generated';
import { AuthError, AuthErrorReason } from '../error/errors';

/**
 * HTTP 请求参数
 */
export interface ApiRequest {
  method: 'GET' | 'POST';
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

/**
 * API HTTP 包装器类
 *
 * 用法：
 * ```typescript
 * const wrapper = new ApiHttpWrapper();
 * const data = await wrapper.call({ method: 'GET', path: '/api/xxx', params: { id: '123' } });
 * ```
 */
export class ApiHttpWrapper {
  private apiClientService: ApiClientService;

  constructor() {
    this.apiClientService = new ApiClientService();
  }

  /**
   * 执行业务 API 调用
   *
   * @param request 请求参数
   * @returns API 响应数据
   * @throws AuthError 鉴权失败（含 401 重试后仍失败）
   */
  async call<T = unknown>(request: ApiRequest): Promise<T> {
    const { method, path, params = {}, body } = request;
    const configuration = await this.apiClientService.getConfiguration();

    const httpClient = this.createHttpClient(configuration);
    const attempt = (token: string) =>
      httpClient.request<T>({
        method,
        url: path,
        params: { access_token: token, ...params },
        data: body,
      });

    try {
      const response = await attempt(configuration.accessToken as string);
      return response.data;
    } catch (error) {
      if (this.is401(error)) {
        // MISS-001: 401 → 清除缓存 → 刷新 Token → 重试一次
        await this.apiClientService.clearToken();
        const retryConfig = await this.apiClientService.getConfiguration();
        const retryResponse = await attempt(retryConfig.accessToken as string);
        return retryResponse.data;
      }

      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError(
        AuthErrorReason.TOKEN_REFRESH_FAILED,
        'API request failed',
        error as Error
      );
    }
  }

  /**
   * 清除所有缓存（gatewayUrl + Token）
   */
  clearCache(): void {
    this.apiClientService.clearCache();
  }

  /**
   * 创建 HTTP 客户端实例
   */
  private createHttpClient(configuration: Configuration): AxiosInstance {
    return axios.create({
      baseURL: configuration.basePath,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 判断错误是否为 401
   */
  private is401(error: unknown): boolean {
    return axios.isAxiosError(error) && error.response?.status === 401;
  }
}
