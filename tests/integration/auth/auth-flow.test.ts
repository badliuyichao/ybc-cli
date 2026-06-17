/**
 * 鉴权流程集成测试
 *
 * 测试完整的配置 → 获取 Token → 缓存 → 过期 → 刷新流程
 *
 * 重写记录（2026-06-17, CR-037）：
 * - 适配新版 TokenManager（GET + HmacSHA256 + 嵌套响应格式）
 * - 加 GET /getGatewayAddress mock（数据中心查询前置步骤）
 * - mock 响应格式改为 {code: '00000', data: {access_token, expire}}
 * - 移除 Bearer Header 断言（ADR-7：query 参数传 token）
 */

import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ConfigService } from '@/services/config/config-service';
import { TokenManager } from '@/services/auth/token-manager';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { AuthError, AuthErrorReason } from '@/services/error/errors';
import { TokenConfig } from '@/types/auth';

/**
 * 标准 mock：数据中心查询 + Token 获取
 */
function setupStandardMocks(
  mockAxios: MockAdapter,
  options: {
    tokenResponse?: unknown;
    tokenStatus?: number;
    dataCenterResponse?: unknown;
  } = {}
): void {
  // 数据中心查询 mock
  mockAxios
    .onGet(/getGatewayAddress/)
    .reply(200, options.dataCenterResponse ?? {
      code: '00000',
      message: '成功',
      data: {
        gatewayUrl: 'https://test-gateway.example.com/iuap-api-gateway',
        tokenUrl: 'https://test-token.example.com/iuap-api-auth',
      },
    });

  // Token 获取 mock
  mockAxios
    .onGet(/getAccessToken/)
    .reply(
      options.tokenStatus ?? 200,
      options.tokenResponse ?? {
        code: '00000',
        message: '成功',
        data: { access_token: 'mock-token-12345', expire: 3600 },
      }
    );
}

describe('Auth Flow Integration (重写于 2026-06-17)', () => {
  let configService: ConfigService;
  let tokenManager: TokenManager;
  let storage: FileStorage;
  let mockAxios: MockAdapter;
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), 'ybc-auth-flow-', Date.now().toString());
    storage = new FileStorage();
    mockAxios = new MockAdapter(axios);

    configService = new ConfigService(tempDir);
    const tokenCachePath = path.join(tempDir, 'token.json');
    tokenManager = new TokenManager(storage, tokenCachePath);

    // 把 tokenManager 内部的 datacenterService 也指向同一个临时目录
    // 避免不同测试之间的数据中心缓存污染
    (tokenManager as any).dataCenterService.cacheFilePath = path.join(tempDir, 'datacenter.json');
  });

  afterEach(async () => {
    mockAxios.restore();

    try {
      await storage.delete(tempDir);
    } catch {
      // 忽略清理错误
    }

    delete process.env.YBC_TENANT_ID;
    delete process.env.YBC_APP_KEY;
    delete process.env.YBC_APP_SECRET;
    delete process.env.YBC_ENV;
  });

  describe('complete auth flow', () => {
    it('应该完成完整鉴权流程：配置 → 获取 token → 缓存 → 刷新', async () => {
      // 1. 初始化配置
      const configData = {
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      };
      await configService.init(configData);
      expect(await configService.exists()).toBe(true);

      // 2. 设置标准 mock（首次 token）
      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'initial-token-12345', expire: 3600 },
        },
      });

      // 3. 加载配置并获取 Token
      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig: TokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token1 = await tokenManager.getValidToken(tokenConfig);
      expect(token1).toBe('initial-token-12345');

      // 4. 验证缓存
      const cachedToken = await tokenManager.loadFromCache(tokenConfig);
      expect(cachedToken).not.toBeNull();
      expect(cachedToken?.access_token).toBe('initial-token-12345');

      // 5. 第二次获取应使用缓存（不调 API）
      const token2 = await tokenManager.getValidToken(tokenConfig);
      expect(token2).toBe('initial-token-12345');

      // 数据中心 + token 获取只调用 1 次
      expect(mockAxios.history.get.filter(r => /getAccessToken/.test(r.url || '')).length).toBe(1);

      // 6. Token 过期后刷新
      mockAxios.reset();
      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'refreshed-token-67890', expire: 7200 },
        },
      });

      // 手动写入过期 token 到缓存
      await tokenManager.saveToCache(
        {
          access_token: 'expired-token',
          expires_in: 3600,
          expires_at: Date.now() - 1000,
        },
        tokenConfig
      );

      const token3 = await tokenManager.getValidToken(tokenConfig);
      expect(token3).toBe('refreshed-token-67890');
    });

    it('应该优雅处理鉴权失败', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Mock 数据中心查询成功，但 Token 获取失败
      setupStandardMocks(mockAxios, {
        tokenStatus: 401,
        tokenResponse: { code: 'INVALID_CREDENTIALS', message: 'Invalid appKey/appSecret' },
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig: TokenConfig = {
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

    it('应该支持环境变量配置（无需配置文件）', async () => {
      // 1. 设置环境变量
      process.env.YBC_TENANT_ID = 'env-test-tenant';
      process.env.YBC_APP_KEY = 'env-test-app-key-12345678';
      process.env.YBC_APP_SECRET = 'env-test-app-secret-12345678901234';
      process.env.YBC_ENV = 'production';

      // 2. 不创建配置文件，从环境变量读取
      const config = await configService.getConfig({ decryptSensitive: true });
      expect(config.tenantId).toBe('env-test-tenant');
      expect(config.appKey).toBe('env-test-app-key-12345678');
      expect(config.appSecret).toBe('env-test-app-secret-12345678901234');
      expect(config.env).toBe('production');

      // 3. mock 并获取 Token
      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'env-token', expire: 3600 },
        },
      });

      const token = await tokenManager.getValidToken({
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      });
      expect(token).toBe('env-token');
    });

    it('应该清除缓存后重新认证', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'first-token', expire: 3600 },
        },
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig: TokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token1 = await tokenManager.getValidToken(tokenConfig);
      expect(token1).toBe('first-token');

      // 清除缓存
      await tokenManager.clearCache();

      // 重置 mock 给新响应
      mockAxios.reset();
      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'second-token', expire: 3600 },
        },
      });

      const token2 = await tokenManager.getValidToken(tokenConfig);
      expect(token2).toBe('second-token');
    });
  });

  describe('config and token consistency', () => {
    it('应该配置变更后作废旧 Token 缓存（configFingerprint）', async () => {
      // 1. 初始化第一个配置
      await configService.init({
        tenantId: 'first-tenant-12345678',
        appKey: 'first-app-key-12345678',
        appSecret: 'first-app-secret-12345678901234',
        env: 'sandbox',
      });

      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'first-token', expire: 3600 },
        },
      });

      const config1 = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig1: TokenConfig = {
        tenantId: config1.tenantId!,
        appKey: config1.appKey!,
        appSecret: config1.appSecret!,
        env: config1.env!,
      };

      const token1 = await tokenManager.getValidToken(tokenConfig1);
      expect(token1).toBe('first-token');

      // 2. 更新配置
      await configService.setConfig('tenantId', 'second-tenant-12345678');
      await configService.setConfig('appKey', 'second-app-key-12345678');
      await configService.setConfig('appSecret', 'second-app-secret-1234567890');

      // 3. 使用新配置加载缓存 → 缓存应无效（configFingerprint 不匹配）
      const config2 = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig2: TokenConfig = {
        tenantId: config2.tenantId!,
        appKey: config2.appKey!,
        appSecret: config2.appSecret!,
        env: config2.env!,
      };

      const cachedToken = await tokenManager.loadFromCache(tokenConfig2);
      expect(cachedToken).toBeNull();
    });

    it('应该支持 sandbox / production 环境切换', async () => {
      // 1. 测试 sandbox 环境
      await configService.init({
        tenantId: 'sandbox-tenant-12345678',
        appKey: 'sandbox-app-key-12345678',
        appSecret: 'sandbox-app-secret-12345678901',
        env: 'sandbox',
      });

      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'sandbox-token', expire: 3600 },
        },
      });

      const sandboxConfig = await configService.getConfig({ decryptSensitive: true });
      const sandboxToken = await tokenManager.getValidToken({
        tenantId: sandboxConfig.tenantId!,
        appKey: sandboxConfig.appKey!,
        appSecret: sandboxConfig.appSecret!,
        env: 'sandbox',
      });
      expect(sandboxToken).toBe('sandbox-token');

      // 2. 切换到 production 环境（只验证配置层，不重新获取）
      await configService.setConfig('env', 'production');
      const prodConfig = await configService.getConfig({ decryptSensitive: true });
      expect(prodConfig.env).toBe('production');
    });
  });

  describe('error handling and recovery', () => {
    it('应该从网络错误中恢复', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 数据中心查询成功
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功',
        data: {
          gatewayUrl: 'https://test-gateway.example.com',
          tokenUrl: 'https://test-token.example.com',
        },
      });

      // 第一次 token 请求：网络错误
      mockAxios.onGet(/getAccessToken/).networkErrorOnce();

      // 第二次 token 请求：成功
      mockAxios.onGet(/getAccessToken/).reply(200, {
        code: '00000',
        message: '成功',
        data: { access_token: 'recovered-token', expire: 3600 },
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig: TokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      // 第一次应该失败
      await expect(tokenManager.getValidToken(tokenConfig)).rejects.toThrow(AuthError);

      // 第二次应该成功
      const token = await tokenManager.getValidToken(tokenConfig);
      expect(token).toBe('recovered-token');
    });

    it('应该处理 Token 刷新失败', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 首次获取成功
      setupStandardMocks(mockAxios, {
        tokenResponse: {
          code: '00000',
          message: '成功',
          data: { access_token: 'initial-token', expire: 3600 },
        },
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig: TokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token = await tokenManager.getValidToken(tokenConfig);
      expect(token).toBe('initial-token');

      // 重置 mock 让刷新失败
      mockAxios.reset();
      mockAxios.onGet(/getGatewayAddress/).reply(200, {
        code: '00000',
        message: '成功',
        data: {
          gatewayUrl: 'https://test-gateway.example.com',
          tokenUrl: 'https://test-token.example.com',
        },
      });
      mockAxios.onGet(/getAccessToken/).reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Credentials expired',
      });

      // 写入过期 token 强制刷新
      await tokenManager.saveToCache(
        {
          access_token: 'expired',
          expires_in: 3600,
          expires_at: Date.now() - 1000,
        },
        tokenConfig
      );

      // 刷新应该失败
      await expect(tokenManager.getValidToken(tokenConfig)).rejects.toThrow(AuthError);
    });
  });
});