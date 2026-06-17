/**
 * API HTTP 包装器
 *
 * 为所有业务命令提供统一的 HTTP 调用入口，确保：
 * 1. access_token 作为 query 参数传递（ADR-7，非 Authorization Header）
 * 2. 业务接口 401 自动清除缓存 → 刷新 Token → 重试一次（MISS-001）
 * 3. 错误按 HTTP 状态码分类（CR-012 / CR-043）：
 *    - 401 → 鉴权错误（AuthError）
 *    - 4xx → 业务错误（BusinessError）
 *    - 5xx → 网络错误（NetworkError）
 *    - 超时/连接失败 → 网络错误（NetworkError）
 *
 * 待办-004（2026-06-17）：构造函数注入 ApiClientService
 * 解决原 new ApiClientService() 单例无法跨命令共享 cachedGatewayUrl 的问题
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiClientService } from './api-client-service';
import { Configuration } from '../../api/generated';
import { AuthError, AuthErrorReason, BusinessError, NetworkError } from '../error/errors';
import { NetworkErrorDetails, BusinessErrorDetails } from '../../types/error';

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
 * // 单例场景（推荐）：在 bootstrap() 创建一次，注入到所有命令
 * const apiClientService = new ApiClientService();
 * const wrapper = new ApiHttpWrapper(apiClientService);
 * const data = await wrapper.call({ method: 'GET', path: '/api/xxx' });
 * ```
 */
export class ApiHttpWrapper {
  private apiClientService: ApiClientService;

  /**
   * 构造函数
   * @param apiClientService ApiClientService 实例（依赖注入，单例复用）
   */
  constructor(apiClientService: ApiClientService) {
    this.apiClientService = apiClientService;
  }

  /**
   * 执行业务 API 调用
   *
   * @param request 请求参数
   * @returns API 响应数据
   * @throws AuthError 401（含重试后仍失败）/ Token 获取失败
   * @throws BusinessError 4xx 业务错误
   * @throws NetworkError 5xx 或网络异常（超时/DNS/连接失败）
   */
  async call<T = unknown>(request: ApiRequest): Promise<T> {
    const { method, path, params = {}, body } = request;
    const configuration = await this.apiClientService.getConfiguration();

    const httpClient = this.createHttpClient(configuration);
    const attempt = (token: string): Promise<{ data: T }> =>
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
        try {
          await this.apiClientService.clearToken();
          const retryConfig = await this.apiClientService.getConfiguration();
          const retryResponse = await attempt(retryConfig.accessToken as string);
          return retryResponse.data;
        } catch (retryError) {
          // 重试仍 401 → 抛鉴权错误
          if (retryError instanceof AuthError) {
            throw retryError;
          }
          throw new AuthError(
            AuthErrorReason.INVALID_CREDENTIALS,
            'Authentication failed after token refresh',
            retryError as Error
          );
        }
      }

      // CR-043: 按 HTTP 状态码分类错误
      throw this.classifyError(error, httpClient.defaults.baseURL);
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

  /**
   * 将 axios 错误按 HTTP 状态码分类为对应 CliError 子类（CR-043）
   *
   * 分类规则：
   * - 4xx（除 401 之外）→ BusinessError（exitCode 4）
   * - 5xx → NetworkError（exitCode 5）
   * - 超时 / 连接失败 → NetworkError（exitCode 5）
   * - 其它 AxiosError → NetworkError（保守兜底）
   * - 非 AxiosError → 透传原始错误
   */
  private classifyError(error: unknown, baseURL?: string): Error {
    if (!(error instanceof Error)) {
      return new Error(String(error));
    }

    if (!axios.isAxiosError(error)) {
      return error;
    }

    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const url = `${baseURL || ''}${axiosError.config?.url || ''}`;

    // 4xx 业务错误（除 401 已在 call() 中处理）
    if (status && status >= 400 && status < 500) {
      const responseData = axiosError.response?.data as Record<string, unknown> | undefined;
      const businessCode =
        (responseData?.code as string) || (responseData?.errorCode as string) || String(status);
      const businessMessage =
        (responseData?.message as string) ||
        (responseData?.error as string) ||
        axiosError.message ||
        `Business error ${status}`;
      const details: BusinessErrorDetails = {
        businessCode,
        statusCode: status,
        endpoint: url,
      };
      return new BusinessError(businessMessage, details);
    }

    // 5xx 网络/服务端错误
    if (status && status >= 500) {
      const details: NetworkErrorDetails = {
        statusCode: status,
        url,
      };
      return new NetworkError(`Server error ${status}: ${axiosError.message}`, details);
    }

    // 超时
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      const details: NetworkErrorDetails = {
        isTimeout: true,
        url,
      };
      return new NetworkError(`请求超时：${url}`, details);
    }

    // 连接失败（无 response）
    if (!axiosError.response) {
      const details: NetworkErrorDetails = {
        isConnectionError: true,
        url,
      };
      return new NetworkError(`网络连接失败：${axiosError.message || 'unknown'}`, details);
    }

    // 兜底：透传原始 AxiosError（避免丢失堆栈）
    return error;
  }
}
