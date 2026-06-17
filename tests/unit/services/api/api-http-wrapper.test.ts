/**
 * ApiHttpWrapper 单元测试（CR-045）
 *
 * 测试 ApiHttpWrapper 的核心逻辑：
 * 1. access_token 注入到 query 参数（ADR-7）
 * 2. 401 自动清除缓存 → 刷新 Token → 重试一次
 * 3. 按 HTTP 状态码分类错误（CR-043）
 * 4. 超时 / 连接失败 → NetworkError
 * 5. 业务请求 method/path/params/body 转发
 *
 * 用 Mock 隔离 ApiClientService 和 axios，避免依赖外部资源。
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ApiHttpWrapper, ApiRequest } from '@/services/api/api-http-wrapper';
import { ApiClientService } from '@/services/api/api-client-service';
import { Configuration } from '@/api/generated';
import { AuthError, BusinessError, NetworkError } from '@/services/error/errors';

/**
 * 创建 ApiHttpWrapper 子类，注入 Mock ApiClientService
 */
function createWrapperWithMock(mockApiClientService: jest.Mocked<ApiClientService>): ApiHttpWrapper {
  // 待办-004：构造函数注入 apiClientService
  return new ApiHttpWrapper(mockApiClientService);
}

/**
 * 默认 Configuration fixture
 */
function buildConfiguration(accessToken = 'mock-access-token-abc'): Configuration {
  return new Configuration({
    basePath: 'https://test-gateway.example.com/iuap-api-gateway',
    accessToken,
    baseOptions: {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  });
}

describe('ApiHttpWrapper (CR-045 单元测试)', () => {
  let mockAxios: MockAdapter;
  let mockApiClientService: jest.Mocked<ApiClientService>;
  let wrapper: ApiHttpWrapper;

  beforeEach(() => {
    mockAxios = new MockAdapter(axios);
    mockAxios.resetHistory();

    // 默认 ApiClientService mock：返回固定 Configuration
    mockApiClientService = {
      getConfiguration: jest.fn().mockResolvedValue(buildConfiguration()),
      clearCache: jest.fn(),
      clearToken: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ApiClientService>;

    wrapper = createWrapperWithMock(mockApiClientService);
  });

  afterEach(() => {
    mockAxios.restore();
  });

  // ============================================================
  // 1. 基本请求转发
  // ============================================================
  describe('基本请求转发', () => {
    it('应该把 access_token 作为 query 参数附加到所有请求（ADR-7）', async () => {
      mockAxios.onGet('/api/staff/detail').reply(200, { code: '200', data: { name: '张三' } });

      await wrapper.call({
        method: 'GET',
        path: '/api/staff/detail',
        params: { code: 'EMP001' },
      });

      const req = mockAxios.history.get.find((r) =>
        (r.url || '').includes('/api/staff/detail')
      );
      expect(req).toBeDefined();
      expect(req?.params?.access_token).toBe('mock-access-token-abc');
      expect(req?.params?.code).toBe('EMP001');
      // 关键：不应该在 Header 里
      expect(req?.headers?.Authorization).toBeUndefined();
    });

    it('应该正确转发 POST 请求的 body', async () => {
      mockAxios.onPost('/api/create').reply(201, { id: 123 });

      await wrapper.call({
        method: 'POST',
        path: '/api/create',
        body: { name: 'test', value: 123 },
      });

      const req = mockAxios.history.post.find((r) => (r.url || '').includes('/api/create'));
      expect(req).toBeDefined();
      expect(req?.params?.access_token).toBe('mock-access-token-abc');
      expect(JSON.parse(req?.data || '{}')).toEqual({ name: 'test', value: 123 });
    });

    it('应该使用 Configuration 中的 basePath', async () => {
      mockApiClientService.getConfiguration.mockResolvedValue(
        buildConfiguration()
      );
      mockAxios.onGet('/api/resource').reply(200, { ok: true });

      await wrapper.call({ method: 'GET', path: '/api/resource' });

      // baseURL 应为 Configuration.basePath
      const req = mockAxios.history.get[0];
      expect(req?.baseURL).toBe('https://test-gateway.example.com/iuap-api-gateway');
    });

    it('应该只调用一次 ApiClientService.getConfiguration（每个请求）', async () => {
      mockAxios.onGet('/api/a').reply(200, {});
      mockAxios.onGet('/api/b').reply(200, {});

      await wrapper.call({ method: 'GET', path: '/api/a' });
      await wrapper.call({ method: 'GET', path: '/api/b' });

      expect(mockApiClientService.getConfiguration).toHaveBeenCalledTimes(2);
    });

    it('应该返回 response.data', async () => {
      const expected = { code: 'SUCCESS', data: { items: [1, 2, 3] } };
      mockAxios.onGet('/api/list').reply(200, expected);

      const result = await wrapper.call<typeof expected>({
        method: 'GET',
        path: '/api/list',
      });

      expect(result).toEqual(expected);
    });
  });

  // ============================================================
  // 2. 401 重试流程（MISS-001）
  // ============================================================
  describe('401 重试流程', () => {
    it('应该 401 → 清除缓存 → 重新获取 token → 重试成功', async () => {
      let count = 0;
      mockAxios.onGet('/api/resource').reply(() => {
        count += 1;
        return count === 1
          ? [401, { code: 'TOKEN_EXPIRED', message: 'Token expired' }]
          : [200, { success: true }];
      });

      // 第二次 getConfiguration 返回新 token（模拟刷新后）
      mockApiClientService.getConfiguration
        .mockResolvedValueOnce(buildConfiguration('old-token'))
        .mockResolvedValueOnce(buildConfiguration('new-token'));

      const data = await wrapper.call<{ success: boolean }>({
        method: 'GET',
        path: '/api/resource',
      });

      expect(data).toEqual({ success: true });
      expect(count).toBe(2); // 确实重试了
      expect(mockApiClientService.clearToken).toHaveBeenCalledTimes(1);
      expect(mockApiClientService.getConfiguration).toHaveBeenCalledTimes(2); // 初次 + 重试
    });

    it('应该 401 重试仍 401 → 抛 AuthError', async () => {
      mockAxios.onGet('/api/resource').reply(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Token invalid',
      });

      await expect(
        wrapper.call({ method: 'GET', path: '/api/resource' })
      ).rejects.toThrow(AuthError);

      // 重试仍然失败也应被识别为 AuthError
      expect(mockApiClientService.clearToken).toHaveBeenCalled();
    });

    it('应该 401 重试时使用新 token', async () => {
      let count = 0;
      mockAxios.onGet('/api/resource').reply(() => {
        count += 1;
        return count === 1
          ? [401, { code: 'TOKEN_EXPIRED' }]
          : [200, { success: true }];
      });

      mockApiClientService.getConfiguration
        .mockResolvedValueOnce(buildConfiguration('first-token'))
        .mockResolvedValueOnce(buildConfiguration('second-token'));

      await wrapper.call({ method: 'GET', path: '/api/resource' });

      // 第一次请求用 first-token，第二次（重试用 second-token
      const requests = mockAxios.history.get.filter((r) =>
        (r.url || '').includes('/api/resource')
      );
      expect(requests[0].params?.access_token).toBe('first-token');
      expect(requests[1].params?.access_token).toBe('second-token');
    });

    it('应该在 getConfiguration 抛错时不重试', async () => {
      mockAxios.onGet('/api/resource').reply(401, {});
      mockApiClientService.getConfiguration.mockResolvedValue(buildConfiguration());

      await expect(
        wrapper.call({ method: 'GET', path: '/api/resource' })
      ).rejects.toThrow();
    });
  });

  // ============================================================
  // 3. 错误分类（CR-043）
  // ============================================================
  describe('错误分类（CR-043）', () => {
    it('应该把 4xx（除 401）抛为 BusinessError（exitCode 4）', async () => {
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

    it('应该把 403 抛为 BusinessError', async () => {
      mockAxios.onGet('/api/resource').reply(403, {
        code: 'PERMISSION_DENIED',
        message: 'No permission',
      });

      try {
        await wrapper.call({ method: 'GET', path: '/api/resource' });
        fail('应抛出 BusinessError');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessError);
        expect((error as BusinessError).exitCode).toBe(4);
      }
    });

    it('应该把 404 抛为 BusinessError', async () => {
      mockAxios.onGet('/api/missing').reply(404, {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      });

      await expect(
        wrapper.call({ method: 'GET', path: '/api/missing' })
      ).rejects.toThrow(BusinessError);
    });

    it('应该把 500 抛为 NetworkError（exitCode 5）', async () => {
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

    it('应该把 502/503/504 抛为 NetworkError', async () => {
      for (const status of [502, 503, 504]) {
        mockAxios.reset();
        mockAxios.onGet('/api/resource').reply(status, { error: 'Server error' });

        try {
          await wrapper.call({ method: 'GET', path: '/api/resource' });
          fail(`应抛出 NetworkError（${status}）`);
        } catch (error) {
          expect(error).toBeInstanceOf(NetworkError);
          expect((error as NetworkError).networkDetails.statusCode).toBe(status);
        }
      }
    });

    it('应该把网络错误（无 response）抛为 NetworkError', async () => {
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

    it('BusinessError 应该包含 endpoint URL 用于调试', async () => {
      mockAxios.onGet('/api/staff/detail').reply(400, { code: 'BAD', message: 'bad' });

      try {
        await wrapper.call({ method: 'GET', path: '/api/staff/detail' });
        fail('应抛出');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessError);
        const be = error as BusinessError;
        expect(be.businessDetails.endpoint).toContain('/api/staff/detail');
      }
    });

    it('NetworkError 应该包含 URL 用于调试', async () => {
      mockAxios.onGet('/api/server-error').reply(503, {});

      try {
        await wrapper.call({ method: 'GET', path: '/api/server-error' });
        fail('应抛出');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        const ne = error as NetworkError;
        expect(ne.networkDetails.url).toContain('/api/server-error');
      }
    });
  });

  // ============================================================
  // 4. 缓存管理
  // ============================================================
  describe('缓存管理', () => {
    it('clearCache 应该清空 ApiClientService 的缓存', () => {
      wrapper.clearCache();
      expect(mockApiClientService.clearCache).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 5. 边界情况
  // ============================================================
  describe('边界情况', () => {
    it('应该处理空的 params 对象', async () => {
      mockAxios.onGet('/api/resource').reply(200, { ok: true });

      await wrapper.call({
        method: 'GET',
        path: '/api/resource',
        params: {},
      });

      const req = mockAxios.history.get[0];
      expect(req?.params?.access_token).toBe('mock-access-token-abc');
      // params 应只有 access_token（没有额外业务参数）
      expect(Object.keys(req?.params || {}).length).toBe(1);
    });

    it('应该处理 undefined params（默认空对象）', async () => {
      mockAxios.onGet('/api/resource').reply(200, { ok: true });

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/resource',
      };
      await wrapper.call(request);

      const req = mockAxios.history.get[0];
      expect(req?.params?.access_token).toBe('mock-access-token-abc');
    });

    it('应该处理 undefined body', async () => {
      mockAxios.onPost('/api/resource').reply(200, { ok: true });

      await wrapper.call({
        method: 'POST',
        path: '/api/resource',
      });

      const req = mockAxios.history.post[0];
      expect(req?.data).toBeUndefined();
    });
  });
});