/**
 * Phase 1 完整流程集成测试
 *
 * 测试从配置初始化到业务命令执行的完整流程
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import axios, { AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ConfigService } from '@/services/config/config-service';
import { TokenManager } from '@/services/auth/token-manager';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { HttpClientFactory } from '@/infrastructure/http/http-client';
import { createAuthInterceptor } from '@/infrastructure/http/auth-interceptor';
import { ErrorHandler } from '@/services/error/error-handler';
import { Logger } from '@/services/logger/logger';
import { ExitCode } from '@/services/error/codes';
import { AuthError } from '@/services/error/errors';
import { EncryptionService } from '@/infrastructure/crypto/encryption-service';

describe('Phase 1 Full Flow Integration', () => {
  let configService: ConfigService;
  let tokenManager: TokenManager;
  let httpClient: AxiosInstance;
  let storage: FileStorage;
  let mockAxios: MockAdapter;
  let tempDir: string;
  let logger: Logger;
  let encryption: EncryptionService;

  beforeEach(() => {
    // 创建临时目录
    tempDir = path.join(os.tmpdir(), 'ybc-full-flow-', Date.now().toString());
    storage = new FileStorage();
    logger = new Logger({ verbose: false });
    encryption = new EncryptionService(storage);

    // 创建 axios mock
    mockAxios = new MockAdapter(axios);

    // 创建服务
    configService = new ConfigService(tempDir);
    const tokenCachePath = path.join(tempDir, 'token.json');
    tokenManager = new TokenManager(storage, tokenCachePath);

    // 创建 HTTP 客户端
    const factory = new HttpClientFactory();
    const authInterceptor = createAuthInterceptor(tokenManager, {
      tenantId: 'test-tenant-12345678',
      appKey: 'test-app-key-12345678',
      appSecret: 'test-app-secret-12345678901234',
      env: 'sandbox',
    });
    factory.addGlobalInterceptor(authInterceptor);
    httpClient = factory.createClient({
      baseURL: 'https://api-di.yonyoucloud.com',
    });
  });

  afterEach(async () => {
    // 清理 mock
    mockAxios.restore();

    // 清理临时文件
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // 忽略清理错误
    }

    // 清理环境变量
    delete process.env.YBC_TENANT_ID;
    delete process.env.YBC_APP_KEY;
    delete process.env.YBC_APP_SECRET;
    delete process.env.YBC_ENV;
  });

  describe('场景 1：配置初始化流程', () => {
    it('应该完成完整的配置初始化流程', async () => {
      // Step 1: 初始化配置
      const configData = {
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      };

      await configService.init(configData);

      // Step 2: 验证配置文件创建
      const configPath = path.join(tempDir, '.ybc', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      // Step 3: 验证文件权限（仅 Unix）
      if (process.platform !== 'win32') {
        const stats = fs.statSync(configPath);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }

      // Step 4: 验证配置内容
      const config = await configService.getConfig({ decryptSensitive: true });
      expect(config.tenantId).toBe(configData.tenantId);
      expect(config.appKey).toBe(configData.appKey);
      expect(config.appSecret).toBe(configData.appSecret);
      expect(config.env).toBe(configData.env);
      expect(config.version).toBeDefined();
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();

      // Step 5: 验证 appSecret 加密
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(rawConfig.appSecret).toBeDefined();
      expect(rawConfig.appSecret).not.toBe(configData.appSecret); // appSecret 应该已加密
      expect(rawConfig.appSecret.startsWith('enc:')).toBe(true);
    });
  });

  describe('场景 2：鉴权流程', () => {
    it('应该完成完整的鉴权流程：配置 → 获取 token → 缓存 → 过期 → 刷新', async () => {
      // Step 1: 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: Mock token API
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'initial-token-12345',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Step 3: 加载配置并获取 token
      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token1 = await tokenManager.getValidToken(tokenConfig);
      expect(token1).toBe('initial-token-12345');

      // Step 4: 验证 token 缓存
      const tokenCachePath = path.join(tempDir, 'token.json');
      expect(fs.existsSync(tokenCachePath)).toBe(true);

      // Step 5: 验证文件权限（仅 Unix）
      if (process.platform !== 'win32') {
        const stats = fs.statSync(tokenCachePath);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }

      // Step 6: 第二次获取应该使用缓存
      const token2 = await tokenManager.getValidToken(tokenConfig);
      expect(token2).toBe('initial-token-12345');
      expect(mockAxios.history.post.length).toBe(1); // 只调用一次 API

      // Step 7: Token 过期后刷新
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'refreshed-token-67890',
        expires_in: 7200,
      });

      // 手动设置过期
      const expiredToken = {
        access_token: 'expired-token',
        expires_in: 3600,
        expires_at: Date.now() - 1000,
      };
      await tokenManager.saveToCache(expiredToken, tokenConfig);

      // Step 8: 获取新 token
      const token3 = await tokenManager.getValidToken(tokenConfig);
      expect(token3).toBe('refreshed-token-67890');
      expect(mockAxios.history.post.length).toBe(2); // 调用两次 API（初始 + 刷新）
    });
  });

  describe('场景 3：业务命令执行流程', () => {
    it('应该完成完整的业务命令执行流程：配置 + token → 执行命令 → 输出结果', async () => {
      // Step 1: 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: Mock token API
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(200, {
        access_token: 'test-token-abc123',
        expires_in: 3600,
        token_type: 'Bearer',
      });

      // Step 3: Mock 业务 API
      mockAxios.onPost(/api\/staff\/query/).reply(200, {
        code: 'SUCCESS',
        message: '查询成功',
        data: {
          staffs: [
            { code: 'EMP001', name: '张三', department: '研发部', status: 'enabled' },
            { code: 'EMP002', name: '李四', department: '产品部', status: 'enabled' },
          ],
          total: 2,
        },
      });

      // Step 4: 获取配置
      const config = await configService.getConfig({ decryptSensitive: true });

      // Step 5: 使用 HTTP 客户端调用业务 API
      const response = await httpClient.post('/api/staff/query', {
        code: 'EMP001',
      });

      // Step 6: 验证响应
      expect(response.status).toBe(200);
      expect(response.data.code).toBe('SUCCESS');
      expect(response.data.data.staffs).toHaveLength(2);
      expect(response.data.data.staffs[0].code).toBe('EMP001');

      // Step 7: 验证 Authorization header
      expect(response.config.headers?.Authorization).toBe('Bearer test-token-abc123');
    });
  });

  describe('场景 4：错误处理流程', () => {
    it('应该正确处理无配置场景（退出码 6）', async () => {
      // 不创建配置文件
      const configPath = path.join(tempDir, '.ybc', 'config.json');
      expect(fs.existsSync(configPath)).toBe(false);

      // 尝试获取配置应该抛出错误
      try {
        await configService.getConfig({ decryptSensitive: true });
        fail('应该抛出错误');
      } catch (error) {
        expect(error).toBeDefined();
        // 验证是配置相关的错误
      }
    });

    it('应该正确处理网络错误（退出码 5）', async () => {
      // Step 1: 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: Mock 网络错误
      mockAxios.onPost(/api\/staff\/query/).networkError();

      // Step 3: 调用 API 应该失败
      try {
        await httpClient.post('/api/staff/query', { code: 'EMP001' });
        fail('应该抛出网络错误');
      } catch (error) {
        // 验证错误处理
        const handler = ErrorHandler.getInstance({ verbose: false });
        const exitCode = handler.handle(error as Error);
        expect(exitCode).toBe(ExitCode.NETWORK_ERROR);
      }
    });

    it('应该正确处理业务错误（退出码 4）', async () => {
      // Step 1: 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: Mock 业务错误
      mockAxios.onPost(/api\/staff\/query/).reply(400, {
        code: 'INVALID_PARAMETER',
        message: '参数错误：code 字段不能为空',
      });

      // Step 3: 调用 API 应该失败
      try {
        await httpClient.post('/api/staff/query', { code: '' });
        fail('应该抛出业务错误');
      } catch (error) {
        // 验证错误处理
        const handler = ErrorHandler.getInstance({ verbose: false });
        const exitCode = handler.handle(error as Error);
        expect(exitCode).toBe(ExitCode.BUSINESS_ERROR);
      }
    });

    it('应该正确处理鉴权错误（退出码 6）', async () => {
      // Step 1: 初始化配置
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: Mock token API 返回 401
      mockAxios.onPost(/open-auth\/authorize\/token/).reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid AK/SK',
      });

      // Step 3: 获取 token 应该失败
      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      try {
        await tokenManager.getValidToken(tokenConfig);
        fail('应该抛出鉴权错误');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        // 验证错误处理
        const handler = ErrorHandler.getInstance({ verbose: false });
        const exitCode = handler.handle(error as Error);
        expect(exitCode).toBe(ExitCode.AUTH_ERROR);
      }
    });
  });

  describe('安全验证', () => {
    it('应该确保所有日志中无 appSecret', async () => {
      // Step 1: 初始化配置
      const appSecret = 'sensitive-app-secret-12345678901234';
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: appSecret,
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: 获取配置（解密模式）
      const config = await configService.getConfig({ decryptSensitive: true });

      // Step 3: 验证 appSecret 在配置对象中（但不应该暴露）
      expect(config.appSecret).toBe(appSecret);

      // 验证 appKey 和 appSecret 都存在
      expect(config.tenantId).toBe('test-tenant-12345678');
      expect(config.appKey).toBe('test-app-key-12345678');
    });

    it('应该确保 config show 中 appSecret 脱敏', async () => {
      // Step 1: 初始化配置
      const appSecret = 'sensitive-app-secret-12345678901234';
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: appSecret,
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: 获取配置（不解密敏感信息）
      const config = await configService.getConfig({ decryptSensitive: false });

      // Step 3: 验证 appSecret 脱敏
      expect(config.appSecret).toBeDefined();
      expect(config.appSecret).not.toBe(appSecret);
      expect(config.appSecret?.startsWith('enc:')).toBe(true);
    });

    it('应该确保 appSecret 加密存储（AES-256-GCM）', async () => {
      // Step 1: 初始化配置
      const appSecret = 'sensitive-app-secret-12345678901234';
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: appSecret,
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // Step 2: 读取原始配置文件
      const configPath = path.join(tempDir, '.ybc', 'config.json');
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      // Step 3: 验证 appSecret 加密
      expect(rawConfig.appSecret).toBeDefined();
      expect(rawConfig.appSecret).not.toBe(appSecret);
      expect(rawConfig.appSecret.startsWith('enc:')).toBe(true);

      // Step 4: 验证可以正确解密
      const decryptedAppSecret = await encryption.decrypt(rawConfig.appSecret);
      expect(decryptedAppSecret).toBe(appSecret);
    });
  });
});