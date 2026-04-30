/**
 * 鉴权流程集成测试
 *
 * 测试完整的配置 → 获取 Token → 缓存 → 过期 → 刷新流程
 */

import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ConfigService } from '@/services/config/config-service';
import { TokenManager } from '@/services/auth/token-manager';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { AuthError, AuthErrorReason } from '@/services/error/errors';

describe('Auth Flow Integration', () => {
  let configService: ConfigService;
  let tokenManager: TokenManager;
  let storage: FileStorage;
  let mockAxios: MockAdapter;
  let tempDir: string;

  beforeEach(() => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), 'ybc-auth-flow-', Date.now().toString());
    storage = new FileStorage();

    // 创建 axios mock
    mockAxios = new MockAdapter(axios);

    // 创建服务
    configService = new ConfigService(tempDir);
    const tokenCachePath = path.join(tempDir, 'token.json');
    tokenManager = new TokenManager(storage, tokenCachePath);
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

    // 清理环境变量
    delete process.env.YBC_TENANT_ID;
    delete process.env.YBC_APP_KEY;
    delete process.env.YBC_APP_SECRET;
    delete process.env.YBC_ENV;
  });

  describe('complete auth flow', () => {
    it('should complete full auth flow: config → get token → cache → refresh', async () => {
      // 1. 初始化配置
      const configData = {
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      };

      await configService.init(configData);

      // 验证配置文件创建
      const configExists = await configService.exists();
      expect(configExists).toBe(true);

      // 2. 设置 mock API
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'initial-token-12345',
        expires_in: 3600, // 1 小时
        token_type: 'Bearer',
      });

      // 3. 加载配置并获取 Token
      const config = await configService.getConfig({ decryptSensitive: true });

      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token1 = await tokenManager.getValidToken(tokenConfig);
      expect(token1).toBe('initial-token-12345');

      // 4. 验证 Token 缓存
      const cachedToken = await tokenManager.loadFromCache(tokenConfig);
      expect(cachedToken).not.toBeNull();
      expect(cachedToken?.access_token).toBe('initial-token-12345');

      // 5. 第二次获取应该使用缓存（不调用 API）
      const token2 = await tokenManager.getValidToken(tokenConfig);
      expect(token2).toBe('initial-token-12345');
      expect(mockAxios.history.post.length).toBe(1); // 只调用一次

      // 6. Token 过期后刷新
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'refreshed-token-67890',
        expires_in: 7200, // 2 小时
      });

      // 手动设置过期
      const expiredToken = {
        access_token: 'expired-token',
        expires_in: 3600,
        expires_at: Date.now() - 1000,
      };
      await tokenManager.saveToCache(expiredToken, tokenConfig);

      // 获取新 Token
      const token3 = await tokenManager.getValidToken(tokenConfig);
      expect(token3).toBe('refreshed-token-67890');
      expect(mockAxios.history.post.length).toBe(2); // 调用两次
    });

    it('should handle auth failure gracefully', async () => {
      // 1. 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 2. 设置 mock API 返回错误
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid AK/SK',
      });

      // 3. 获取 Token 应该失败
      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      await expect(tokenManager.getValidToken(tokenConfig)).rejects.toThrow(AuthError);

      try {
        await tokenManager.getValidToken(tokenConfig);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).authDetails.reason).toBe(AuthErrorReason.INVALID_CREDENTIALS);
      }
    });

    it('should work with environment variables', async () => {
      // 1. 设置环境变量
      process.env.YBC_TENANT_ID = 'env-test-tenant';
      process.env.YBC_APP_KEY = 'env-test-app-key-12345678';
      process.env.YBC_APP_SECRET = 'env-test-app-secret-12345678901234';
      process.env.YBC_ENV = 'production';

      // 2. 不创建配置文件，直接从环境变量读取
      const config = await configService.getConfig({ decryptSensitive: true });

      expect(config.tenantId).toBe('env-test-tenant');
      expect(config.appKey).toBe('env-test-app-key-12345678');
      expect(config.appSecret).toBe('env-test-app-secret-12345678901234');
      expect(config.env).toBe('production');

      // 3. 设置 mock API
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'env-token',
        expires_in: 3600,
      });

      // 4. 使用环境变量配置获取 Token
      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token = await tokenManager.getValidToken(tokenConfig);
      expect(token).toBe('env-token');
    });

    it('should clear cache and re-authenticate', async () => {
      // 1. 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 2. 设置 mock API
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'first-token',
        expires_in: 3600,
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      // 3. 获取 Token
      const token1 = await tokenManager.getValidToken(tokenConfig);
      expect(token1).toBe('first-token');

      // 4. 清除缓存
      await tokenManager.clearCache();

      // 5. 设置新的 mock 响应
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'second-token',
        expires_in: 3600,
      });

      // 6. 再次获取应该重新认证
      const token2 = await tokenManager.getValidToken(tokenConfig);
      expect(token2).toBe('second-token');
      expect(mockAxios.history.post.length).toBe(2);
    });
  });

  describe('config and token consistency', () => {
    it('should invalidate token cache when config changes', async () => {
      // 1. 初始化第一个配置
      await configService.init({
        tenantId: 'first-tenant-12345678',
        appKey: 'first-app-key-12345678',
        appSecret: 'first-app-secret-12345678901234',
        env: 'sandbox',
      });

      // 2. 设置 mock API
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'first-token',
        expires_in: 3600,
      });

      // 3. 获取 Token
      const config1 = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig1 = {
        tenantId: config1.tenantId!,
        appKey: config1.appKey!,
        appSecret: config1.appSecret!,
        env: config1.env!,
      };

      const token1 = await tokenManager.getValidToken(tokenConfig1);
      expect(token1).toBe('first-token');

      // 4. 更新配置（不同的 tenantId/appKey/appSecret）
      await configService.setConfig('tenantId', 'second-tenant-12345678');
      await configService.setConfig('appKey', 'second-app-key-12345678');
      await configService.setConfig('appSecret', 'second-app-secret-1234567890');

      // 5. 使用新配置
      const config2 = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig2 = {
        tenantId: config2.tenantId!,
        appKey: config2.appKey!,
        appSecret: config2.appSecret!,
        env: config2.env!,
      };

      // 6. 旧的缓存应该无效，重新获取 Token
      const cachedToken = await tokenManager.loadFromCache(tokenConfig2);
      expect(cachedToken).toBeNull(); // 配置指纹不匹配
    });

    it('should handle multiple environments', async () => {
      // 1. 测试 sandbox 环境
      await configService.init({
        tenantId: 'sandbox-tenant-12345678',
        appKey: 'sandbox-app-key-12345678',
        appSecret: 'sandbox-app-secret-12345678901',
        env: 'sandbox',
      });

      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'sandbox-token',
        expires_in: 3600,
      });

      const sandboxConfig = await configService.getConfig({ decryptSensitive: true });
      const sandboxToken = await tokenManager.getValidToken({
        tenantId: sandboxConfig.tenantId!,
        appKey: sandboxConfig.appKey!,
        appSecret: sandboxConfig.appSecret!,
        env: 'sandbox',
      });

      expect(sandboxToken).toBe('sandbox-token');

      // 2. 更新为 production 环境
      await configService.setConfig('env', 'production');

      // 注意：BIP 的不同环境使用不同的 API URL
      // production: https://api.yonyoucloud.com
      // sandbox: https://api-di.yonyoucloud.com

      // 这里主要验证配置可以切换
      const prodConfig = await configService.getConfig({ decryptSensitive: true });
      expect(prodConfig.env).toBe('production');
    });
  });

  describe('error handling and recovery', () => {
    it('should recover from network error', async () => {
      // 1. 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 2. 第一次请求失败
      mockAxios.onPost(/open-auth\/authorize\/token/).networkErrorOnce();

      // 3. 第二次请求成功
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'recovered-token',
        expires_in: 3600,
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      // 4. 第一次应该失败
      await expect(tokenManager.getValidToken(tokenConfig)).rejects.toThrow(AuthError);

      // 5. 第二次应该成功
      const token = await tokenManager.getValidToken(tokenConfig);
      expect(token).toBe('recovered-token');
    });

    it('should handle token refresh failure', async () => {
      // 1. 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 2. 获取初始 Token
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'initial-token',
        expires_in: 3600,
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token = await tokenManager.getValidToken(tokenConfig);
      expect(token).toBe('initial-token');

      // 3. 设置过期并刷新失败
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Credentials expired',
      });

      const expiredToken = {
        access_token: 'expired',
        expires_in: 3600,
        expires_at: Date.now() - 1000,
      };
      await tokenManager.saveToCache(expiredToken, tokenConfig);

      // 4. 刷新应该失败
      await expect(tokenManager.getValidToken(tokenConfig)).rejects.toThrow(AuthError);
    });
  });
});
