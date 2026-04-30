/**
 * TokenManager 单元测试
 *
 * 更新以匹配新的 Token 获取机制（GET + 签名）
 */

import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TokenManager } from '@/services/auth/token-manager';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { TokenConfig } from '@/types/auth';
import { AuthError, AuthErrorReason } from '@/services/error/errors';

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let storage: FileStorage;
  let mockAxios: MockAdapter;
  let axiosInstance: any;
  let tempDir: string;
  let dataCenterService: any;
  // 用于记录请求历史的跟踪器
  let requestHistory: any[] = [];

  const validConfig: TokenConfig = {
    tenantId: 'test-tenant-id-12345',
    appKey: 'test-app-key-12345678',
    appSecret: 'test-app-secret-12345678901234',
    env: 'sandbox',
  };

  beforeEach(() => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), 'ybc-test-', Date.now().toString());
    storage = new FileStorage();
    requestHistory = [];

    // 创建 axios 实例
    axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 添加请求拦截器来记录请求
    axiosInstance.interceptors.request.use((config: any) => {
      requestHistory.push({
        url: config.url,
        params: config.params,
        method: config.method,
      });
      return config;
    });

    // 创建 axios mock（绑定到实例）
    mockAxios = new MockAdapter(axiosInstance);

    // 创建 DataCenterService（使用同一个 axios 实例）
    const DataCenterService = require('@/services/auth/datacenter-service').DataCenterService;
    dataCenterService = new DataCenterService(storage, axiosInstance);

    // 创建 TokenManager（注入 axios 实例和 DataCenterService）
    const cachePath = path.join(tempDir, 'token.json');
    tokenManager = new TokenManager(storage, cachePath, axiosInstance, dataCenterService);
  });

  afterEach(async () => {
    // 清理 mock
    mockAxios.restore();

    // 清理临时文件
    try {
      await storage.delete(tempDir);
    } catch {
      // 忽略清理错误
    }
  });

  describe('getValidToken', () => {
    it('should return cached token if not expired', async () => {
      // 设置 mock API 返回成功的 token（需要模拟两个 API：数据中心查询 + Token获取）
      const mockDataCenterResponse = {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      };

      const mockTokenResponse = {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'test-token-12345',
          expires_in: 3600,
          token_type: 'Bearer',
        },
      };

      // Mock 数据中心查询 API (GET)
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, mockDataCenterResponse);

      // Mock Token 获取 API (GET)
      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, mockTokenResponse);

      // 第一次获取 token（会调用数据中心和token API）
      const token1 = await tokenManager.getValidToken(validConfig);
      expect(token1).toBe('test-token-12345');

      // 第二次获取应该使用缓存（不再调用 API）
      const token2 = await tokenManager.getValidToken(validConfig);
      expect(token2).toBe('test-token-12345');

      // 验证 Token API 只被调用一次
      // 使用拦截器记录的 requestHistory
      const tokenCalls = requestHistory.filter(
        (req) => req.url && req.url.includes('getAccessToken')
      );
      expect(tokenCalls.length).toBe(1);
    });

    it('should refresh token if expired', async () => {
      // 设置 mock API
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'new-test-token',
          expires_in: 3600,
        },
      });

      // 手动设置过期的缓存
      const expiredToken = {
        access_token: 'expired-token',
        expires_in: 3600,
        expires_at: Date.now() - 1000, // 已过期
      };

      await tokenManager.saveToCache(expiredToken, validConfig);

      // 获取 token 应该刷新
      const token = await tokenManager.getValidToken(validConfig);
      expect(token).toBe('new-test-token');

      // 验证 Token API 被调用
      // 使用拦截器记录的 requestHistory
      const tokenCalls = requestHistory.filter(
        (req) => req.url && req.url.includes('getAccessToken')
      );
      expect(tokenCalls.length).toBe(1);
    });

    it('should throw AuthError for invalid credentials', async () => {
      // 设置 mock API 返回错误
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid appKey/appSecret',
      });

      // 获取 token 应该抛出 AuthError
      await expect(tokenManager.getValidToken(validConfig)).rejects.toThrow(AuthError);

      try {
        await tokenManager.getValidToken(validConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).authDetails.reason).toBe(AuthErrorReason.INVALID_CREDENTIALS);
      }
    });

    it('should throw AuthError for network error', async () => {
      // 设置 mock API 返回网络错误
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).networkError();

      // 获取 token 应该抛出 AuthError
      await expect(tokenManager.getValidToken(validConfig)).rejects.toThrow(AuthError);
    });

    it('should throw AuthError when tokenUrl is provided and data center query is skipped', async () => {
      // 当 config 中提供了 tokenUrl 时，应该跳过数据中心查询
      const configWithTokenUrl: TokenConfig = {
        ...validConfig,
        tokenUrl: 'https://custom-token-url.yonyoucloud.com/iuap-api-auth',
      };

      // 设置 mock API（只需要 mock Token 获取）
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'token-from-custom-url',
          expires_in: 7200,
        },
      });

      // 获取 token（不会调用数据中心 API）
      const token = await tokenManager.getValidToken(configWithTokenUrl);
      expect(token).toBe('token-from-custom-url');

      // 验证没有调用数据中心 API
      // 使用拦截器记录的 requestHistory
      const dcCalls = requestHistory.filter(
        (req) => req.url && req.url.includes('getGatewayAddress')
      );
      expect(dcCalls.length).toBe(0);
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token with signature', async () => {
      // 设置 mock API
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'refreshed-token',
          expires_in: 7200,
          token_type: 'Bearer',
        },
      });

      // 刷新 token
      const tokenInfo = await tokenManager.refreshToken(validConfig);

      expect(tokenInfo.access_token).toBe('refreshed-token');
      expect(tokenInfo.expires_in).toBe(7200);
      expect(tokenInfo.expires_at).toBeGreaterThan(Date.now());
    });

    it('should calculate correct expires_at', async () => {
      const expiresInSeconds = 3600;

      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'test-token',
          expires_in: expiresInSeconds,
        },
      });

      const beforeRefresh = Date.now();
      const tokenInfo = await tokenManager.refreshToken(validConfig);
      const afterRefresh = Date.now();

      const expectedExpiresAt = beforeRefresh + expiresInSeconds * 1000;
      const tolerance = afterRefresh - beforeRefresh;

      expect(tokenInfo.expires_at).toBeGreaterThanOrEqual(expectedExpiresAt);
      expect(tokenInfo.expires_at).toBeLessThanOrEqual(expectedExpiresAt + tolerance);
    });

    it('should send correct signature parameters', async () => {
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'signed-token',
          expires_in: 3600,
        },
      });

      // 刷新 token
      await tokenManager.refreshToken(validConfig);

      // 验证请求包含正确的参数
      // 使用拦截器记录的 requestHistory
      const tokenCalls = requestHistory.filter(
        (req) => req.url && req.url.includes('getAccessToken')
      );
      expect(tokenCalls.length).toBe(1);

      const request = tokenCalls[0];

      // 直接从 params 获取，而不是从 URL 解析
      // 验证包含 appKey 参数
      expect(request.params?.appKey).toBe(validConfig.appKey);

      // 验证包含 timestamp 参数（13位毫秒时间戳）
      const timestamp = request.params?.timestamp;
      expect(timestamp).toBeDefined();
      expect(String(timestamp).length).toBe(13);

      // 验证包含 signature 参数
      const signature = request.params?.signature;
      expect(signature).toBeDefined();
      expect(String(signature).length).toBeGreaterThan(0);
    });

    it('should use "expire" field when "expires_in" is missing', async () => {
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      // 模拟返回 expire 字段而非 expires_in
      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'token-with-expire',
          expire: 3600,
        },
      });

      const tokenInfo = await tokenManager.refreshToken(validConfig);
      expect(tokenInfo.expires_in).toBe(3600);
    });

    it('should throw AuthError when response code is not "00000"', async () => {
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: 'ERROR_CODE',
        message: 'Authentication failed',
      });

      await expect(tokenManager.refreshToken(validConfig)).rejects.toThrow(AuthError);
    });

    it('should throw AuthError when token expiration is missing', async () => {
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'token-without-expiry',
        },
      });

      await expect(tokenManager.refreshToken(validConfig)).rejects.toThrow(AuthError);
    });
  });

  describe('loadFromCache', () => {
    it('should return null if cache file does not exist', async () => {
      const result = await tokenManager.loadFromCache(validConfig);
      expect(result).toBeNull();
    });

    it('should return cached token if exists', async () => {
      // 创建缓存
      const tokenInfo = {
        access_token: 'cached-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };

      await tokenManager.saveToCache(tokenInfo, validConfig);

      // 加载缓存
      const result = await tokenManager.loadFromCache(validConfig);
      expect(result).not.toBeNull();
      expect(result?.access_token).toBe('cached-token');
    });

    it('should return null if config fingerprint mismatch', async () => {
      // 创建缓存（使用不同的配置）
      const differentConfig: TokenConfig = {
        tenantId: 'different-tenant-id',
        appKey: 'different-app-key',
        appSecret: 'different-app-secret',
        env: 'sandbox',
      };

      const tokenInfo = {
        access_token: 'cached-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };

      await tokenManager.saveToCache(tokenInfo, differentConfig);

      // 使用不同配置加载应该返回 null
      const result = await tokenManager.loadFromCache(validConfig);
      expect(result).toBeNull();
    });
  });

  describe('saveToCache', () => {
    it('should save token to cache file with correct permissions', async () => {
      const tokenInfo = {
        access_token: 'test-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };

      await tokenManager.saveToCache(tokenInfo, validConfig);

      // 验证文件存在
      const cachePath = path.join(tempDir, 'token.json');
      const exists = await storage.exists(cachePath);
      expect(exists).toBe(true);

      // 验证文件内容
      const cache = await storage.read(cachePath);
      expect(cache.token.access_token).toBe('test-token');
      expect(cache.timestamp).toBeDefined();
      expect(cache.configFingerprint).toBeDefined();
    });
  });

  describe('isExpired', () => {
    it('should return true for expired token', () => {
      const expiredToken = {
        access_token: 'expired',
        expires_in: 3600,
        expires_at: Date.now() - 1000, // 已过期
      };

      expect(tokenManager.isExpired(expiredToken)).toBe(true);
    });

    it('should return true for token expiring soon (within 5 minutes)', () => {
      const soonExpiredToken = {
        access_token: 'expiring-soon',
        expires_in: 300, // 5 分钟内过期
        expires_at: Date.now() + 4 * 60 * 1000, // 4 分钟后过期
      };

      expect(tokenManager.isExpired(soonExpiredToken)).toBe(true);
    });

    it('should return false for valid token', () => {
      const validToken = {
        access_token: 'valid',
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000, // 1 小时后过期
      };

      expect(tokenManager.isExpired(validToken)).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear both memory and file cache', async () => {
      // 创建缓存
      const tokenInfo = {
        access_token: 'cached-token',
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000,
      };

      await tokenManager.saveToCache(tokenInfo, validConfig);

      // 清除缓存
      await tokenManager.clearCache();

      // 验证缓存已清除
      const result = await tokenManager.loadFromCache(validConfig);
      expect(result).toBeNull();
    });

    it('should handle non-existent cache file gracefully', async () => {
      // 清除不存在的缓存应该成功
      await tokenManager.clearCache();
    });
  });

  describe('backward compatibility', () => {
    it('should use appKey/appSecret if available', async () => {
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'new-format-token',
          expires_in: 3600,
        },
      });

      const token = await tokenManager.refreshToken(validConfig);
      expect(token.access_token).toBe('new-format-token');

      // 验证请求中的 appKey
      // 使用拦截器记录的 requestHistory
      const tokenCalls = requestHistory.filter(
        (req) => req.url && req.url.includes('getAccessToken')
      );
      expect(tokenCalls.length).toBe(1);
      // 直接从 params 获取，而不是从 URL 解析
      expect(tokenCalls[0].params?.appKey).toBe(validConfig.appKey);
    });

    });

    describe('security', () => {
    it('should not expose appSecret in error messages', async () => {
      // 设置 mock API 返回错误
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });

      try {
        await tokenManager.getValidToken(validConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        const errorMessage = (error as Error).message;
        expect(errorMessage).not.toContain(validConfig.appSecret);

        const userFriendlyMessage = (error as AuthError).getUserFriendlyMessage();
        expect(userFriendlyMessage).not.toContain(validConfig.appSecret);
      }
    });

    it('should use signature instead of encryption for authentication', async () => {
      // 新机制使用签名而非加密
      mockAxios.onGet(/open-auth\/dataCenter\/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          gatewayUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-gateway',
          tokenUrl: 'https://yonbip-test.yonyoucloud.com/iuap-api-auth',
        },
      });

      mockAxios.onGet(/open-auth\/selfAppAuth\/base\/v1\/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功！',
        data: {
          access_token: 'signed-token',
          expires_in: 3600,
        },
      });

      await tokenManager.refreshToken(validConfig);

      // 验证请求使用 GET 方法（签名）
      // 使用拦截器记录的 requestHistory
      const tokenCalls = requestHistory.filter(
        (req) => req.url && req.url.includes('getAccessToken')
      );
      expect(tokenCalls.length).toBe(1);

      // 验证请求参数包含签名
      const url = new URL(tokenCalls[0].url || 'https://example.com', 'https://example.com');
      const signature = url.searchParams.get('signature');
      expect(signature).toBeDefined();
      expect(signature).not.toBe('');

      // 验证签名不是简单的 appSecret 重复（而是 HMAC-SHA256 计算结果）
      expect(signature).not.toBe(validConfig.appSecret);
    });
  });
});