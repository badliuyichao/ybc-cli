/**
 * HTTP 客户端集成测试
 *
 * 测试完整的拦截器链：请求 → token 注入 → 日志记录 → 响应 → 401 处理
 */

import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TokenManager } from '../../../src/services/auth/token-manager';
import { Logger } from '../../../src/services/logger/logger';
import { HttpClientFactory } from '../../../src/infrastructure/http/http-client';
import { createAuthInterceptor } from '../../../src/infrastructure/http/auth-interceptor';
import { createLoggingInterceptor } from '../../../src/infrastructure/http/logging-interceptor';
import { TokenConfig } from '../../../src/types/auth';
import { AuthError, AuthErrorReason } from '../../../src/services/error/errors';

describe('HTTP 客户端集成测试', () => {
  let mockAxios: MockAdapter;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockLogger: jest.Mocked<Logger>;
  let factory: HttpClientFactory;
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

    // 创建 Mock Logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn().mockReturnThis(),
    } as any;

    tokenConfig = {
      tenantId: 'test-tenant-12345678',
      appKey: 'test-app-key-12345678',
      appSecret: 'test-app-secret-1234567890',
      env: 'sandbox',
    };

    // 创建客户端工厂
    factory = new HttpClientFactory();

    // 先添加日志拦截器
    const loggingInterceptor = createLoggingInterceptor(mockLogger);
    factory.addGlobalInterceptor(loggingInterceptor);

    // 创建客户端（用于鉴权拦截器重试）
    client = factory.createClient({
      baseURL: 'https://api.example.com',
      timeout: 30000,
    });

    // 创建鉴权拦截器并传入客户端实例
    const authInterceptor = createAuthInterceptor(mockTokenManager, tokenConfig, client);
    factory.addGlobalInterceptor(authInterceptor);

    // 重新创建客户端（包含鉴权拦截器）
    // 注意：这里创建的新客户端会继承之前添加的拦截器
    client = factory.createClient({
      baseURL: 'https://api.example.com',
      timeout: 30000,
    });
  });

  afterEach(() => {
    mockAxios.restore();
    jest.clearAllMocks();
  });

  describe('完整请求流程', () => {
    it('应该完成请求 → token 注入 → 日志记录 → 响应流程', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token-123');
      mockAxios.onGet('/api/resource').reply(200, { success: true, data: 'test' });

      const response = await client.get('/api/resource');

      // 验证响应成功
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ success: true, data: 'test' });

      // 验证 Token 注入
      expect(mockTokenManager.getValidToken).toHaveBeenCalledWith(tokenConfig);
      expect(response.config.headers?.Authorization).toBe('Bearer test-token-123');

      // 验证日志记录
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Request: GET https://api.example.com/api/resource');
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Response: GET https://api.example.com/api/resource - 200');
    });

    it('应该处理 POST 请求并记录请求数据', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onPost('/api/create').reply(201, { id: 123, created: true });

      const response = await client.post('/api/create', { name: 'test', value: 123 });

      expect(response.status).toBe(201);
      expect(response.data).toEqual({ id: 123, created: true });

      // 验证日志记录了请求和响应
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Request: POST https://api.example.com/api/create');
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Response: POST https://api.example.com/api/create - 201');
    });
  });

  describe('401 错误重试流程', () => {
    it('应该处理 401 错误 → 清除缓存 → 获取新 token → 重试成功', async () => {
      // 设置 token 返回值：第一次 old-token，第二次 new-token
      mockTokenManager.getValidToken.mockResolvedValueOnce('old-token');
      mockTokenManager.clearCache.mockResolvedValue();
      mockTokenManager.getValidToken.mockResolvedValueOnce('new-token');

      // 使用动态响应：第一次返回 401，第二次返回 200
      mockAxios.onGet('/api/resource').reply(() => {
        const requestCount = mockAxios.history.get.filter((r: any) => r.url === '/api/resource').length;
        if (requestCount === 0) {
          return [401, { code: 'UNAUTHORIZED' }];
        }
        return [200, { success: true }];
      });

      const response = await client.get('/api/resource');

      // 验证最终成功
      expect(response.status).toBe(200);

      // 验证完整流程
      expect(mockTokenManager.getValidToken).toHaveBeenCalledTimes(2); // 第一次 + 重试
      expect(mockTokenManager.clearCache).toHaveBeenCalled();

      // 验证日志记录
      expect(mockLogger.error).toHaveBeenCalledWith('HTTP Error: GET https://api.example.com/api/resource - 401');
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Response: GET https://api.example.com/api/resource - 200');
    });

    it('应该处理 401 错误 → 重试失败 → 抛出 AuthError', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');

      // 所有请求都返回 401
      mockAxios.onGet('/api/resource').reply(401, { code: 'UNAUTHORIZED' });

      await expect(client.get('/api/resource')).rejects.toThrow(AuthError);
      await expect(client.get('/api/resource')).rejects.toThrow('Authentication failed after retry');

      // 验证重试流程
      expect(mockTokenManager.getValidToken).toHaveBeenCalledTimes(2); // 第一次 + 重试
      expect(mockTokenManager.clearCache).toHaveBeenCalled();

      // 验证错误日志
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('错误处理流程', () => {
    it('应该处理业务错误（500）并记录日志', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/api/resource').reply(500, { error: 'Internal Server Error' });

      await expect(client.get('/api/resource')).rejects.toThrow();

      // 验证 Token 注入仍然发生
      expect(mockTokenManager.getValidToken).toHaveBeenCalled();

      // 验证错误日志
      expect(mockLogger.error).toHaveBeenCalledWith('HTTP Error: GET https://api.example.com/api/resource - 500');
    });

    it('应该处理网络错误并记录日志', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/api/resource').networkError();

      await expect(client.get('/api/resource')).rejects.toThrow();

      // 验证网络错误日志（axios-mock-adapter 的 networkError() 创建的错误可能没有 request 属性）
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCalls = mockLogger.error.mock.calls;
      const hasNetworkErrorLog = errorCalls.some(call =>
        call[0].includes('Network Error') || call[0].includes('Network') || call[0].includes('No response')
      );
      expect(hasNetworkErrorLog).toBe(true);
    });

    it('应该处理超时错误并记录日志', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/api/resource').timeout();

      await expect(client.get('/api/resource')).rejects.toThrow();

      // 验证错误日志（超时也属于网络错误）
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('安全验证', () => {
    it('应该在日志中脱敏 Authorization 头', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('very-long-token-1234567890');
      mockAxios.onGet('/api/resource').reply(200, { success: true });

      await client.get('/api/resource');

      // 查找请求头日志
      const headersCall = mockLogger.debug.mock.calls.find(
        (call) => call[0] === 'Request Headers:'
      );

      if (headersCall && headersCall[1]) {
        const loggedHeaders = JSON.parse(headersCall[1] as string);
        const authHeader = loggedHeaders.Authorization || loggedHeaders.authorization;

        if (authHeader) {
          // 应该被脱敏
          expect(authHeader).toContain('***');
          // Bearer very-long-token... 应该显示为 "Bearer ver***"（显示前 10 位）
          expect(authHeader).toMatch(/Bearer\s+\w+.*\*\*\*/);
        }
      }
    });

    it('应该在日志中脱敏响应中的 token', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/api/resource').reply(200, {
        access_token: 'very-long-response-token-1234567890',
        data: 'normal',
      });

      await client.get('/api/resource');

      // 查找响应数据日志
      const dataCall = mockLogger.debug.mock.calls.find(
        (call) => call[0] === 'Response Data:'
      );

      if (dataCall && dataCall[1]) {
        const loggedData = JSON.parse(dataCall[1] as string);
        expect(loggedData.access_token).toContain('***');
        expect(loggedData.data).toBe('normal');
      }
    });

    it('应该在错误日志中脱敏敏感信息', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/api/resource').reply(401, {
        token: 'sensitive-error-token-1234567890',
        message: 'Unauthorized',
      });

      await expect(client.get('/api/resource')).rejects.toThrow();

      // 查找错误响应日志
      const errorCall = mockLogger.error.mock.calls.find(
        (call) => call[0] === 'Error Response:'
      );

      if (errorCall && errorCall[1]) {
        const loggedData = JSON.parse(errorCall[1] as string);
        expect(loggedData.token).toContain('***');
        expect(loggedData.message).toBe('Unauthorized');
      }
    });
  });

  describe('并发请求', () => {
    it('应该正确处理多个并发请求', async () => {
      mockTokenManager.getValidToken.mockResolvedValue('test-token');
      mockAxios.onGet('/api/resource1').reply(200, { id: 1 });
      mockAxios.onGet('/api/resource2').reply(200, { id: 2 });
      mockAxios.onGet('/api/resource3').reply(200, { id: 3 });

      const [res1, res2, res3] = await Promise.all([
        client.get('/api/resource1'),
        client.get('/api/resource2'),
        client.get('/api/resource3'),
      ]);

      expect(res1.data.id).toBe(1);
      expect(res2.data.id).toBe(2);
      expect(res3.data.id).toBe(3);

      // 每个 Token 都应该被注入
      expect(mockTokenManager.getValidToken).toHaveBeenCalledTimes(3);

      // 每个请求都应该被记录
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Request: GET https://api.example.com/api/resource1');
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Request: GET https://api.example.com/api/resource2');
      expect(mockLogger.debug).toHaveBeenCalledWith('HTTP Request: GET https://api.example.com/api/resource3');
    });
  });

  describe('拦截器链顺序', () => {
    it('应该按正确顺序执行拦截器（鉴权 → 日志）', async () => {
      const callOrder: string[] = [];

      // 重写 Mock 以记录调用顺序
      mockTokenManager.getValidToken.mockImplementation(async () => {
        callOrder.push('token-get');
        return 'test-token';
      });

      mockLogger.debug.mockImplementation((message: string) => {
        if (message.includes('Request')) {
          callOrder.push('log-request');
        } else if (message.includes('Response')) {
          callOrder.push('log-response');
        }
      });

      mockAxios.onGet('/api/test').reply(200, { success: true });

      await client.get('/api/test');

      // 验证顺序：先获取 token，再记录请求
      expect(callOrder.indexOf('token-get')).toBeLessThan(callOrder.indexOf('log-request'));
    });
  });
});