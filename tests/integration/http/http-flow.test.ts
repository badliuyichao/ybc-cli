/**
 * HTTP 客户端集成测试（ApiHttpWrapper）
 *
 * 测试 ApiHttpWrapper 完整流程：
 * - access_token 作为 query 参数传递（ADR-7）
 * - 401 自动清除缓存 → 刷新 Token → 重试一次
 * - 按 HTTP 状态码分类错误（CR-043）
 *
 * 重写记录（2026-06-17, CR-037 + CR-042）：
 * - 从已废弃的 `auth-interceptor`（Bearer Header）迁移到 `ApiHttpWrapper`（query 参数）
 * - 移除日志拦截器相关断言（业务层不直接依赖日志）
 * - 错误分类断言对齐 CR-043：4xx → BusinessError / 5xx / 超时 → NetworkError / 401 → AuthError
 */

import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ApiHttpWrapper } from '@/services/api/api-http-wrapper';
import { FileStorage } from '@/infrastructure/storage/file-storage';
import { ConfigService } from '@/services/config/config-service';
import {
  AuthError,
  BusinessError,
  NetworkError,
} from '@/services/error/errors';

/**
 * Mock 鉴权前置流程（数据中心 + Token）
 */
function setupAuthMocks(mockAxios: MockAdapter): void {
  mockAxios.onGet(/getGatewayAddress/).reply(200, {
    code: '00000',
    message: '成功',
    data: {
      gatewayUrl: 'https://test-gateway.example.com/iuap-api-gateway',
      tokenUrl: 'https://test-token.example.com/iuap-api-auth',
    },
  });
  mockAxios.onGet(/getAccessToken/).reply(200, {
    code: '00000',
    message: '成功',
    data: { access_token: 'wrapper-token-abc', expire: 3600 },
  });
}

describe('HTTP 客户端集成测试 (ApiHttpWrapper)', () => {
  let wrapper: ApiHttpWrapper;
  let mockAxios: MockAdapter;
  let storage: FileStorage;
  let configService: ConfigService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'ybc-http-flow-', Date.now().toString());
    storage = new FileStorage();
    mockAxios = new MockAdapter(axios);
    // 仅清空历史记录，避免跨测试文件 mock 历史污染
    mockAxios.resetHistory();

    configService = new ConfigService(tempDir);

    // 初始化配置 + env 注入（双保险，让 ApiClientService 能读到）
    await configService.init({
      tenantId: 'test-tenant-12345678',
      appKey: 'test-app-key-12345678',
      appSecret: 'test-app-secret-12345678901234',
      env: 'sandbox' as 'sandbox' | 'production',
    });

    // 通过环境变量让 ApiClientService 找到凭证（避免其内部创建 ConfigService 时的 home dir 不一致）
    process.env.YBC_TENANT_ID = 'test-tenant-12345678';
    process.env.YBC_APP_KEY = 'test-app-key-12345678';
    process.env.YBC_APP_SECRET = 'test-app-secret-12345678901234';
    process.env.YBC_ENV = 'sandbox';

    wrapper = new ApiHttpWrapper();

    // 标准 mock（数据中心 + Token）
    setupAuthMocks(mockAxios);
  });

  afterEach(async () => {
    mockAxios.restore();

    try {
      await storage.delete(tempDir);
    } catch {
      // 忽略
    }

    delete process.env.YBC_TENANT_ID;
    delete process.env.YBC_APP_KEY;
    delete process.env.YBC_APP_SECRET;
    delete process.env.YBC_ENV;
  });

  describe('完整请求流程', () => {
    it('应该完成 GET 请求并把 access_token 作为 query 参数（ADR-7）', async () => {
      mockAxios.onGet('/api/resource').reply(200, { success: true, data: 'test' });

      const data = await wrapper.call<{ success: boolean; data: string }>({
        method: 'GET',
        path: '/api/resource',
      });

      expect(data).toEqual({ success: true, data: 'test' });

      // 验证 access_token 注入到 query 参数（断言存在+非空，不校验具体值避免跨文件污染）
      const businessReq = mockAxios.history.get.find((r) =>
        (r.url || '').includes('/api/resource')
      );
      expect(businessReq).toBeDefined();
      expect(businessReq?.params?.access_token).toBeDefined();
      expect(businessReq?.params?.access_token).not.toBe('');
      // 关键：不应该在 Header 中
      expect(businessReq?.headers?.Authorization).toBeUndefined();
    });

    it('应该支持 POST 请求并传递 body', async () => {
      mockAxios.onPost('/api/create').reply(201, { id: 123, created: true });

      const data = await wrapper.call<{ id: number; created: boolean }>({
        method: 'POST',
        path: '/api/create',
        body: { name: 'test', value: 123 },
      });

      expect(data).toEqual({ id: 123, created: true });

      const req = mockAxios.history.post.find((r) => (r.url || '').includes('/api/create'));
      expect(req?.params?.access_token).toBeDefined();
      expect(req?.params?.access_token).not.toBe('');
      expect(JSON.parse(req?.data || '{}')).toEqual({ name: 'test', value: 123 });
    });

    it('应该支持业务参数与 access_token 合并', async () => {
      mockAxios.onGet('/api/staff/detail').reply(200, { code: '200', data: { name: '张三' } });

      await wrapper.call({
        method: 'GET',
        path: '/api/staff/detail',
        params: { code: 'EMP001' },
      });

      const req = mockAxios.history.get.find((r) => (r.url || '').includes('/api/staff/detail'));
      expect(req?.params?.access_token).toBeDefined();
      expect(req?.params?.access_token).not.toBe('');
      expect(req?.params?.code).toBe('EMP001');
    });
  });

  describe('401 错误重试流程（MISS-001）', () => {
    it('应该处理 401 → 清除缓存 → 刷新 Token → 重试成功', async () => {
      // 第一次返回 401，第二次返回 200
      let count = 0;
      mockAxios.onGet('/api/resource').reply(() => {
        count += 1;
        return count === 1
          ? [401, { code: 'TOKEN_EXPIRED', message: 'Token expired' }]
          : [200, { success: true }];
      });

      const data = await wrapper.call<{ success: boolean }>({
        method: 'GET',
        path: '/api/resource',
      });

      expect(data).toEqual({ success: true });
      expect(count).toBe(2); // 确实重试了
    });

    it('应该处理 401 → 重试仍 401 → 抛 AuthError', async () => {
      mockAxios.onGet('/api/resource').reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Token invalid',
      });

      await expect(
        wrapper.call({ method: 'GET', path: '/api/resource' })
      ).rejects.toThrow(AuthError);
    });
  });

  describe('错误分类流程（CR-043）', () => {
    it('应该把 4xx 业务错误（除 401）抛为 BusinessError', async () => {
      mockAxios.onGet('/api/staff/detail').reply(400, {
        code: 'INVALID_PARAMETER',
        message: '参数错误：code 字段不能为空',
      });

      try {
        await wrapper.call({ method: 'GET', path: '/api/staff/detail' });
        fail('应抛出 BusinessError');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessError);
        const be = error as BusinessError;
        expect(be.businessDetails.businessCode).toBe('INVALID_PARAMETER');
        expect(be.businessDetails.statusCode).toBe(400);
        expect(be.exitCode).toBe(4);
      }
    });

    it('应该把 5xx 服务端错误抛为 NetworkError', async () => {
      mockAxios.onGet('/api/resource').reply(500, { error: 'Internal Server Error' });

      try {
        await wrapper.call({ method: 'GET', path: '/api/resource' });
        fail('应抛出 NetworkError');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        const ne = error as NetworkError;
        expect(ne.networkDetails.statusCode).toBe(500);
        expect(ne.exitCode).toBe(5);
      }
    });

    it('应该把网络连接失败抛为 NetworkError', async () => {
      mockAxios.onGet('/api/resource').networkError();

      try {
        await wrapper.call({ method: 'GET', path: '/api/resource' });
        fail('应抛出 NetworkError');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        const ne = error as NetworkError;
        expect(ne.networkDetails.isConnectionError).toBe(true);
        expect(ne.exitCode).toBe(5);
      }
    });

    it('应该把超时抛为 NetworkError', async () => {
      mockAxios.onGet('/api/resource').timeout();

      try {
        await wrapper.call({ method: 'GET', path: '/api/resource' });
        fail('应抛出 NetworkError');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        const ne = error as NetworkError;
        expect(ne.networkDetails.isTimeout).toBe(true);
        expect(ne.exitCode).toBe(5);
      }
    });
  });

  describe('并发请求', () => {
    it('应该正确处理多个并发 GET 请求', async () => {
      mockAxios.onGet('/api/resource1').reply(200, { id: 1 });
      mockAxios.onGet('/api/resource2').reply(200, { id: 2 });
      mockAxios.onGet('/api/resource3').reply(200, { id: 3 });

      const [d1, d2, d3] = await Promise.all([
        wrapper.call<{ id: number }>({ method: 'GET', path: '/api/resource1' }),
        wrapper.call<{ id: number }>({ method: 'GET', path: '/api/resource2' }),
        wrapper.call<{ id: number }>({ method: 'GET', path: '/api/resource3' }),
      ]);

      expect(d1).toEqual({ id: 1 });
      expect(d2).toEqual({ id: 2 });
      expect(d3).toEqual({ id: 3 });
    });
  });
});