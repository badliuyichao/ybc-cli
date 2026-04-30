/**
 * 鉴权拦截器
 *
 * 负责自动注入 Token 和处理 401 错误重试
 */

import { AxiosError, AxiosRequestConfig } from 'axios';
import { TokenManager } from '../../services/auth/token-manager';
import { AuthError, AuthErrorReason } from '../../services/error/errors';
import { HttpInterceptor, HttpRequestConfig, HttpError } from '../../types/http';
import { TokenConfig } from '../../types/auth';

/**
 * 创建鉴权拦截器
 *
 * @param tokenManager Token 管理器
 * @param tokenConfig Token 配置
 * @param client Axios 客户端实例（可选，用于重试）
 * @returns HTTP 拦截器
 */
export function createAuthInterceptor(
  tokenManager: TokenManager,
  tokenConfig: TokenConfig,
  client?: any
): HttpInterceptor {
  // 用于防止重试循环
  const retryCache = new WeakMap<AxiosRequestConfig, number>();

  // 保存客户端实例引用（用于重试）
  let clientInstance: any = client;

  /**
   * 请求拦截器：自动注入 Authorization 头
   */
  const requestInterceptor = {
    onFulfilled: async (config: HttpRequestConfig): Promise<HttpRequestConfig> => {
      // 如果标记为跳过鉴权，直接返回
      if (config.skipAuth) {
        return config;
      }

      // 如果客户端实例未设置，从配置中获取（动态绑定）
      if (!clientInstance && (config as any)._client) {
        clientInstance = (config as any)._client;
      }

      // 保存客户端实例到配置中（用于重试）
      if (clientInstance) {
        (config as any)._client = clientInstance;
      }

      try {
        // 获取有效 Token
        const token = await tokenManager.getValidToken(tokenConfig);

        // 注入 Authorization 头
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };

        return config;
      } catch (error) {
        // Token 获取失败，抛出鉴权错误
        if (error instanceof AuthError) {
          throw error;
        }

        throw new AuthError(
          AuthErrorReason.TOKEN_REFRESH_FAILED,
          'Failed to inject authentication token',
          error as Error
        );
      }
    },
    onRejected: (error: Error): Promise<Error> => {
      return Promise.reject(error);
    },
  };

  /**
   * 响应拦截器：处理 401 错误并重试
   */
  const responseInterceptor = {
    onFulfilled: (response: any): any => {
      return response;
    },
    onRejected: async (error: AxiosError): Promise<any> => {
      const config = error.config as HttpRequestConfig;

      // 如果不是 401 错误，直接抛出
      if (!error.response || error.response.status !== 401) {
        throw error;
      }

      // 如果已经重试过，抛出鉴权错误
      const retryCount = retryCache.get(config) ?? 0;
      if (retryCount >= 1) {
        throw new AuthError(
          AuthErrorReason.INVALID_CREDENTIALS,
          'Authentication failed after retry',
          error
        );
      }

      // 标记为已重试
      retryCache.set(config, retryCount + 1);

      try {
        // 清除缓存
        await tokenManager.clearCache();

        // 获取新 Token
        const newToken = await tokenManager.getValidToken(tokenConfig);

        // 更新 Authorization 头
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${newToken}`,
        };

        // 使用保存的客户端实例重试
        if (clientInstance) {
          return clientInstance.request(config) as any;
        }

        // 如果没有客户端实例，尝试从 config 中获取
        const retryClient = (config as any)._client;
        if (retryClient) {
          return retryClient.request(config) as any;
        }

        // 最后的后备方案：使用 axios 默认实例
        const axiosModule = await import('axios');
        return axiosModule.default.request(config) as any;
      } catch (retryError) {
        // 重试失败，抛出鉴权错误
        if (retryError instanceof AuthError) {
          throw retryError;
        }

        throw new AuthError(
          AuthErrorReason.TOKEN_REFRESH_FAILED,
          'Failed to refresh token and retry request',
          retryError as Error
        );
      }
    },
  };

  return {
    request: requestInterceptor,
    response: responseInterceptor,
  };
}