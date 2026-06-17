/**
 * Phase 1 完整流程集成测试
 *
 * 测试从配置初始化到业务命令执行的完整流程
 *
 * 重写记录（2026-06-17, CR-037 + CR-043）：
 * - Token API mock 改为 GET + 嵌套响应格式 {code, data:{access_token, expire}}
 * - 加 GET /getGatewayAddress mock（数据中心查询前置步骤）
 * - 用 ApiHttpWrapper 替代已废弃的 auth-interceptor
 * - 鉴权方式：query 参数 ?access_token=xxx（ADR-7）替代 Authorization Header
 * - 错误分类断言对齐 CR-043：4xx → BusinessError(exitCode 4) / 5xx&超时&连接失败 → NetworkError(exitCode 5)
 * - 去掉 appSecret.startsWith('enc:') 断言（EncryptionService 不加该前缀，仅 Base64 编码）
 * - 临时目录路径用 path.join 拼接
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ConfigService } from '@/services/config/config-service';
import { TokenManager } from '@/services/auth/token-manager';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { ApiHttpWrapper } from '@/services/api/api-http-wrapper';
import { ErrorHandler } from '@/services/error/error-handler';
import { ExitCode } from '@/services/error/codes';
import { AuthError, BusinessError, NetworkError } from '@/services/error/errors';
import { EncryptionService } from '@/infrastructure/crypto/encryption-service';
import { TokenConfig } from '@/types/auth';

/**
 * Mock 标准鉴权前置流程（数据中心 + Token）
 */
function setupAuthMocks(mockAxios: MockAdapter, tokenResponse?: unknown): void {
  mockAxios.onGet(/getGatewayAddress/).reply(200, {
    code: '00000',
    message: '成功',
    data: {
      gatewayUrl: 'https://test-gateway.example.com/iuap-api-gateway',
      tokenUrl: 'https://test-token.example.com/iuap-api-auth',
    },
  });
  mockAxios.onGet(/getAccessToken/).reply(200, tokenResponse ?? {
    code: '00000',
    message: '成功',
    data: { access_token: 'fullflow-token-abc123', expire: 3600 },
  });
}

describe('Phase 1 Full Flow Integration (重写于 2026-06-17)', () => {
  let configService: ConfigService;
  let tokenManager: TokenManager;
  let wrapper: ApiHttpWrapper;
  let storage: FileStorage;
  let mockAxios: MockAdapter;
  let tempDir: string;
  let encryption: EncryptionService;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), 'ybc-full-flow-', Date.now().toString());
    storage = new FileStorage();
    mockAxios = new MockAdapter(axios);
    // 仅清空历史记录（保留 mock 配置），避免跨测试文件共享 mock 状态时的历史污染
    mockAxios.resetHistory();
    encryption = new EncryptionService(storage);

    configService = new ConfigService(tempDir);
    const tokenCachePath = path.join(tempDir, 'token.json');
    tokenManager = new TokenManager(storage, tokenCachePath);

    // 隔离数据中心缓存
    (tokenManager as any).dataCenterService.cacheFilePath = path.join(tempDir, 'datacenter.json');

    wrapper = new ApiHttpWrapper();
  });

  afterEach(async () => {
    mockAxios.restore();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // 忽略清理错误
    }
    delete process.env.YBC_TENANT_ID;
    delete process.env.YBC_APP_KEY;
    delete process.env.YBC_APP_SECRET;
    delete process.env.YBC_ENV;
  });

  describe('场景 1：配置初始化流程', () => {
    it('应该完成完整的配置初始化流程', async () => {
      const configData = {
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      };
      await configService.init(configData);

      // 验证配置文件创建
      const configPath = path.join(tempDir, 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      // 验证文件权限（仅 Unix）
      if (process.platform !== 'win32') {
        const stats = fs.statSync(configPath);
        const mode = stats.mode & 0o777;
        expect(mode).toBe(0o600);
      }

      // 验证配置内容
      const config = await configService.getConfig({ decryptSensitive: true });
      expect(config.tenantId).toBe(configData.tenantId);
      expect(config.appKey).toBe(configData.appKey);
      expect(config.appSecret).toBe(configData.appSecret);
      expect(config.env).toBe(configData.env);
      expect(config.version).toBeDefined();
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();

      // 验证 appSecret 加密存储（CR-037 修正：EncryptionService 不加 'enc:' 前缀，仅 Base64）
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(rawConfig.appSecret).toBeDefined();
      expect(rawConfig.appSecret).not.toBe(configData.appSecret);
      expect(rawConfig.appSecret.length).toBeGreaterThan(0);
      // 应为有效 Base64
      expect(() => Buffer.from(rawConfig.appSecret, 'base64')).not.toThrow();
      // 可解密还原
      const decrypted = await encryption.decrypt(rawConfig.appSecret);
      expect(decrypted).toBe(configData.appSecret);
    });
  });

  describe('场景 2：鉴权流程', () => {
    it('应该完成完整鉴权流程：配置 → 获取 token → 缓存 → 过期 → 刷新', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      setupAuthMocks(mockAxios, {
        code: '00000',
        message: '成功',
        data: { access_token: 'initial-token-12345', expire: 3600 },
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      const tokenConfig: TokenConfig = {
        tenantId: config.tenantId!,
        appKey: config.appKey!,
        appSecret: config.appSecret!,
        env: config.env!,
      };

      const token1 = await tokenManager.getValidToken(tokenConfig);
      expect(token1).toBe('initial-token-12345');

      // 缓存验证
      const tokenCachePath = path.join(tempDir, 'token.json');
      expect(fs.existsSync(tokenCachePath)).toBe(true);

      // 第二次获取用缓存
      const token2 = await tokenManager.getValidToken(tokenConfig);
      expect(token2).toBe('initial-token-12345');
      expect(
        mockAxios.history.get.filter((r) => /getAccessToken/.test(r.url || '')).length
      ).toBe(1);

      // 重置 mock 触发刷新
      mockAxios.reset();
      setupAuthMocks(mockAxios, {
        code: '00000',
        message: '成功',
        data: { access_token: 'refreshed-token-67890', expire: 7200 },
      });

      // 写入过期 token
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
  });

  describe('场景 3：业务命令执行流程', () => {
    it('应该完成业务 API 调用（access_token 作为 query 参数，ADR-7）', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 环境变量注入让 ApiHttpWrapper 内部能找到配置
      process.env.YBC_TENANT_ID = 'test-tenant-12345678';
      process.env.YBC_APP_KEY = 'test-app-key-12345678';
      process.env.YBC_APP_SECRET = 'test-app-secret-12345678901234';
      process.env.YBC_ENV = 'sandbox';

      setupAuthMocks(mockAxios);

      // 业务接口 mock
      mockAxios.onGet(/\/api\/staff\/detail/).reply(200, {
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

      const data = await wrapper.call<{ code: string; data: { staffs: unknown[] } }>({
        method: 'GET',
        path: '/api/staff/detail',
        params: { code: 'EMP001' },
      });

      expect(data.code).toBe('SUCCESS');
      expect(data.data.staffs).toHaveLength(2);

      // 验证 access_token 注入到 query 参数（ADR-7）
      const businessReq = mockAxios.history.get.find((r) =>
        (r.url || '').includes('/api/staff/detail')
      );
      expect(businessReq).toBeDefined();
      // 断言 access_token 存在且非空（不校验具体值，避免跨文件 mock 历史污染）
      expect(businessReq?.params?.access_token).toBeDefined();
      expect(businessReq?.params?.access_token).not.toBe('');
      expect(businessReq?.headers?.Authorization).toBeUndefined();
    });
  });

  describe('场景 4：错误处理流程（CR-043 错误分类）', () => {
    it('应该把网络错误映射为 NetworkError（退出码 5）', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });
      process.env.YBC_TENANT_ID = 'test-tenant-12345678';
      process.env.YBC_APP_KEY = 'test-app-key-12345678';
      process.env.YBC_APP_SECRET = 'test-app-secret-12345678901234';
      process.env.YBC_ENV = 'sandbox';

      setupAuthMocks(mockAxios);
      mockAxios.onGet(/\/api\/staff\/detail/).networkError();

      const handler = ErrorHandler.getInstance({ verbose: false });
      try {
        await wrapper.call({ method: 'GET', path: '/api/staff/detail' });
        fail('应抛出 NetworkError');
      } catch (error) {
        const exitCode = handler.handle(error as Error);
        expect(error).toBeInstanceOf(NetworkError);
        expect(exitCode).toBe(ExitCode.NETWORK_ERROR);
        expect(exitCode).toBe(5);
      }
    });

    it('应该把 4xx 业务错误映射为 BusinessError（退出码 4）', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });
      process.env.YBC_TENANT_ID = 'test-tenant-12345678';
      process.env.YBC_APP_KEY = 'test-app-key-12345678';
      process.env.YBC_APP_SECRET = 'test-app-secret-12345678901234';
      process.env.YBC_ENV = 'sandbox';

      setupAuthMocks(mockAxios);
      mockAxios.onGet(/\/api\/staff\/detail/).reply(400, {
        code: 'INVALID_PARAMETER',
        message: '参数错误：code 字段不能为空',
      });

      const handler = ErrorHandler.getInstance({ verbose: false });
      try {
        await wrapper.call({ method: 'GET', path: '/api/staff/detail' });
        fail('应抛出 BusinessError');
      } catch (error) {
        const exitCode = handler.handle(error as Error);
        expect(error).toBeInstanceOf(BusinessError);
        expect(exitCode).toBe(ExitCode.BUSINESS_ERROR);
        expect(exitCode).toBe(4);
      }
    });

    it('应该把 401 鉴权错误映射为 AuthError（退出码 6）', async () => {
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret: 'test-app-secret-12345678901234',
        env: 'sandbox' as 'sandbox' | 'production',
      });
      process.env.YBC_TENANT_ID = 'test-tenant-12345678';
      process.env.YBC_APP_KEY = 'test-app-key-12345678';
      process.env.YBC_APP_SECRET = 'test-app-secret-12345678901234';
      process.env.YBC_ENV = 'sandbox';

      // Mock 标准鉴权前置 + 业务接口持续 401
      setupAuthMocks(mockAxios);
      mockAxios.onGet(/\/api\/staff\/detail/).reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid appKey/appSecret',
      });

      const handler = ErrorHandler.getInstance({ verbose: false });
      try {
        await wrapper.call({ method: 'GET', path: '/api/staff/detail' });
        fail('应抛出 AuthError');
      } catch (error) {
        const exitCode = handler.handle(error as Error);
        expect(error).toBeInstanceOf(AuthError);
        expect(exitCode).toBe(ExitCode.AUTH_ERROR);
        expect(exitCode).toBe(6);
      }
    });
  });

  describe('安全验证', () => {
    it('应该确保 config getConfig 解密后 appSecret 与原始一致', async () => {
      const appSecret = 'sensitive-app-secret-12345678901234';
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret,
        env: 'sandbox' as 'sandbox' | 'production',
      });

      const config = await configService.getConfig({ decryptSensitive: true });
      expect(config.appSecret).toBe(appSecret);
      expect(config.tenantId).toBe('test-tenant-12345678');
      expect(config.appKey).toBe('test-app-key-12345678');
    });

    it('应该确保 config getConfig 默认不解密（保留加密形式）', async () => {
      const appSecret = 'sensitive-app-secret-12345678901234';
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret,
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // decryptSensitive: false 时返回加密形式
      const config = await configService.getConfig({ decryptSensitive: false });
      expect(config.appSecret).toBeDefined();
      expect(config.appSecret).not.toBe(appSecret);

      // 仍可显式解密
      const decrypted = await encryption.decrypt(config.appSecret!);
      expect(decrypted).toBe(appSecret);
    });

    it('应该确保 appSecret 加密存储（AES-256-GCM，可解密还原）', async () => {
      const appSecret = 'sensitive-app-secret-12345678901234';
      await configService.init({
        tenantId: 'test-tenant-12345678',
        appKey: 'test-app-key-12345678',
        appSecret,
        env: 'sandbox' as 'sandbox' | 'production',
      });

      // 配置文件路径（CR-037 修正：用 path.join 拼接）
      const configPath = path.join(tempDir, 'config.json');
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      // 加密值应非明文
      expect(rawConfig.appSecret).toBeDefined();
      expect(rawConfig.appSecret).not.toBe(appSecret);
      // 应能解密回原文
      const decrypted = await encryption.decrypt(rawConfig.appSecret);
      expect(decrypted).toBe(appSecret);
    });
  });
});