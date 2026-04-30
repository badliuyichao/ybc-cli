/**
 * 鉴权拦截器单元测试
 */

import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TokenManager } from '../../../../src/services/auth/token-manager';
import { createAuthInterceptor } from '../../../../src/infrastructure/http/auth-interceptor';
import { AuthError, AuthErrorReason } from '../../../../src/services/error/errors';
import { HttpClientConfig, HttpRequestConfig } from '../../../../src/types/http';
import { TokenConfig } from '../../../../src/types/auth';

describe('AuthInterceptor', () => {
  let mockAxios: MockAdapter;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let tokenConfig: TokenConfig;
  let client: AxiosInstance;

  beforeEach(() => {
    // 创建 Mock axios
    mockAxios = new MockAdapter(axios);

    // 创建 Mock TokenManager
    mockTokenManager = {
      getValidToken: jest.fn(),
      refreshToken: jest.fn(),
      clearCache: jest.fn(),
      loadFromCache: jest.fn(),
      saveToCache: jest.fn(),
      isExpired: jest.fn(),
    } as any;

    tokenConfig = {
      tenantId: 'test-tenant-id-12345',
      appKey: 'test-app-key-12345678',
      appSecret: 'test-app-secret-1234567890',
      env: 'sandbox',
    };

    // 创建测试客户端
    client = axios.create();

    // 创建拦截器并传入客户端实例
    const interceptor = createAuthInterceptor(mockTokenManager, tokenConfig, client);

    if (interceptor.request) {
      client.interceptors.request.use(
        interceptor.request.onFulfilled as any,
        interceptor.request.onRejected
      );
    }
    if (interceptor.response) {
      client.interceptors.response.use(
        interceptor.response.onFulfilled as any,
        interceptor.response.onRejected
      );
    }
  });

  afterEach(() => {
    mockAxios.restore();
    jest.clearAllMocks();
  });

  describe('请求拦截器', () => {
    it('应该自动注入 Authorization 头', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token-123');
      mockAxios.onGet('/test').reply(200, { success: true });

      const response = await client.get('/test');

      expect(mockTokenManager.getValidToken).toHaveBeenCalledWith(tokenConfig);
      expect(response.config.headers?.Authorization).toBe('Bearer test-token-123');
    });

    it('应该跳过鉴权（skipAuth 标记）', async () => {
      mockAxios.onGet('/test').reply(200, { success: true });

      const response = await client.get('/test', {
        skipAuth: true,
      } as HttpRequestConfig);

      expect(mockTokenManager.getValidToken).not.toHaveBeenCalled();
      expect(response.config.headers?.Authorization).toBeUndefined();
    });

    it('应该处理 Token 获取失败', async () => {
      mockTokenManager.getValidToken.mockRejectedValue(
        new AuthError(AuthErrorReason.INVALID_CREDENTIALS, 'Invalid credentials')
      );

      await expect(client.get('/test')).rejects.toThrow(AuthError);
      await expect(client.get('/test')).rejects.toThrow('Invalid credentials');
    });

    it('应该处理 Token 获取过程中的非 AuthError', async () => {
      mockTokenManager.getValidToken.mockRejectedValue(new Error('Network error'));

      await expect(client.get('/test')).rejects.toThrow(AuthError);
      await expect(client.get('/test')).rejects.toThrow('Failed to inject authentication token');
    });
  });

  describe('响应拦截器 - 错误处理', () => {
    it('应该处理非 401 错误（不重试）', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/test').reply(500, { code: 'INTERNAL_ERROR' });

      await expect(client.get('/test')).rejects.toThrow();

      expect(mockTokenManager.clearCache).not.toHaveBeenCalled();
      expect(mockTokenManager.getValidToken).toHaveBeenCalledTimes(1);
    });

    it('应该处理网络错误（不重试）', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/test').networkError();

      await expect(client.get('/test')).rejects.toThrow();

      expect(mockTokenManager.clearCache).not.toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('应该正确处理并发请求', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/test1').reply(200, { success: true });
      mockAxios.onGet('/test2').reply(200, { success: true });

      const [response1, response2] = await Promise.all([
        client.get('/test1'),
        client.get('/test2'),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(mockTokenManager.getValidToken).toHaveBeenCalledTimes(2);
    });
  });
});